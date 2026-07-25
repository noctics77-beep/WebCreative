"""Daily Telegram summary scheduler with per-day idempotency lock.

Sends a recap of yesterday's activity to TELEGRAM_CHAT_ID every day at 08:00 WIB
(Asia/Jakarta). Idempotent via MongoDB lock so multiple workers/reloads won't
send duplicates.

Also runs a pending-order reminder job every 15 minutes that pings admin about
manual-payment orders (qris_manual/transfer) that have been sitting unconfirmed.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from pymongo.errors import DuplicateKeyError

logger = logging.getLogger(__name__)

WIB = pytz.timezone("Asia/Jakarta")


async def build_daily_summary(db) -> str:
    """Compute yesterday's metrics (WIB calendar day) and return Telegram-ready text."""
    now_wib = datetime.now(WIB)
    today_wib_midnight = now_wib.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_wib_start = today_wib_midnight - timedelta(days=1)
    yesterday_wib_end = today_wib_midnight

    start_iso = yesterday_wib_start.astimezone(timezone.utc).isoformat()
    end_iso = yesterday_wib_end.astimezone(timezone.utc).isoformat()
    date_label = yesterday_wib_start.strftime("%d %B %Y")

    paid_match = {
        "status": "confirmed",
        "created_at": {"$gte": start_iso, "$lt": end_iso},
    }

    agg = [
        {"$match": paid_match},
        {
            "$group": {
                "_id": None,
                "count": {"$sum": 1},
                "revenue": {"$sum": {"$ifNull": ["$pakasir_total", "$product_price"]}},
            }
        },
    ]
    rows = await db.orders.aggregate(agg).to_list(1)
    count = int(rows[0]["count"]) if rows else 0
    revenue = float(rows[0]["revenue"] or 0) if rows else 0.0

    top_agg = [
        {"$match": paid_match},
        {"$group": {"_id": "$product_id", "name": {"$first": "$product_name"}, "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
        {"$limit": 1},
    ]
    top_rows = await db.orders.aggregate(top_agg).to_list(1)
    top_name = top_rows[0].get("name") if top_rows else None

    new_aff = await db.affiliates.count_documents({"created_at": {"$gte": start_iso, "$lt": end_iso}})
    pending_wd = await db.withdrawals.count_documents({"status": "pending"})

    return (
        f"<b>📊 Ringkasan CreativeStore — {date_label}</b>\n\n"
        f"🛒 <b>Order:</b> {count} transaksi\n"
        f"💰 <b>Omzet:</b> Rp {int(revenue):,}\n"
        f"🔥 <b>Terlaris:</b> {top_name or '-'}\n"
        f"👥 <b>Affiliate baru:</b> {new_aff}\n"
        f"⏳ <b>WD pending:</b> {pending_wd}"
    )


def init_scheduler(db, send_telegram_fn) -> AsyncIOScheduler:
    """Initialize APScheduler with the daily 08:00 WIB job.

    Uses MongoDB idempotency lock: even if scheduler fires multiple times
    (multiple workers, reloads, misfires), the actual send happens at most once
    per WIB calendar day.
    """
    scheduler = AsyncIOScheduler(timezone=WIB)

    async def _job():
        # === ATOMIC IDEMPOTENCY LOCK ===
        # Gunakan `_id` (auto unique index MongoDB) supaya DuplicateKeyError
        # dijamin atomik. `$setOnInsert + upsert` bisa memiliki race pada
        # collection tanpa unique index; ini menghindarinya sepenuhnya.
        today_wib = datetime.now(WIB).strftime("%Y-%m-%d")
        lock_id = f"daily_summary_{today_wib}"
        try:
            await db.job_locks.insert_one({
                "_id": lock_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "worker_pid": os.getpid(),
            })
        except DuplicateKeyError:
            logger.info(f"Daily summary already sent today ({today_wib}) by another worker, skip")
            return
        except Exception as e:
            logger.error(f"Failed to acquire daily summary lock: {e}")
            return

        # === SEND (jangan pernah rollback lock — lebih baik miss 1 hari daripada dupe) ===
        try:
            text = await build_daily_summary(db)
            await send_telegram_fn(text)
            logger.info(f"Daily Telegram summary sent for {today_wib} (pid={os.getpid()})")
        except Exception as e:
            # LOG ONLY — jangan rollback lock. Admin bisa trigger manual kalau perlu.
            logger.error(f"Daily summary send failed: {e}")

    scheduler.add_job(
        _job,
        CronTrigger(hour=8, minute=0, timezone=WIB),
        id="daily_telegram_summary",
        replace_existing=True,
        max_instances=1,      # cegah overlap
        coalesce=True,         # merge missed runs jadi 1
        misfire_grace_time=600,  # tolerate 10 menit misfire
    )

    # ============================================================
    # Pending-order reminder job (every 15 min)
    # ============================================================
    async def _pending_reminder_job():
        try:
            # Load settings
            stats_doc = await db.settings.find_one({"id": "stats"}, {"_id": 0}) or {}
            enabled = stats_doc.get("pending_reminder_enabled", True)
            if not enabled:
                return
            interval_min = int(stats_doc.get("pending_reminder_interval_minutes", 30) or 30)
            max_count = int(stats_doc.get("pending_reminder_max_count", 3) or 3)

            if interval_min <= 0 or max_count <= 0:
                return

            now = datetime.now(timezone.utc)
            threshold_iso = (now - timedelta(minutes=interval_min)).isoformat()

            # Find pending manual-payment orders eligible for reminder
            q = {
                "status": "pending",
                "payment_method": {"$in": ["qris", "transfer"]},
                "created_at": {"$lt": threshold_iso},
                "$or": [
                    {"admin_reminder_count": {"$exists": False}},
                    {"admin_reminder_count": {"$lt": max_count}},
                ],
            }
            orders = await db.orders.find(q, {"_id": 0}).limit(50).to_list(50)
            if not orders:
                return

            for o in orders:
                # Additional check: last reminder was sent at least interval_min ago (or never)
                last_at = o.get("last_admin_reminder_at")
                if last_at:
                    try:
                        last_dt = datetime.fromisoformat(last_at.replace("Z", "+00:00"))
                        if (now - last_dt).total_seconds() < interval_min * 60:
                            continue
                    except Exception:
                        pass

                # Compose reminder
                created_iso = o.get("created_at", "")
                try:
                    created_dt = datetime.fromisoformat(created_iso.replace("Z", "+00:00"))
                    minutes_ago = int((now - created_dt).total_seconds() // 60)
                except Exception:
                    minutes_ago = interval_min

                if minutes_ago >= 60:
                    ago_text = f"{minutes_ago // 60} jam {minutes_ago % 60} menit"
                else:
                    ago_text = f"{minutes_ago} menit"

                variant_line = ""
                if o.get("variant_name"):
                    variant_line = f" ({o['variant_name']})"

                total = o.get("pakasir_total") or o.get("product_price") or 0
                reminder_no = int(o.get("admin_reminder_count", 0)) + 1

                text = (
                    f"⏰ <b>Reminder Order Belum Dikonfirmasi ({reminder_no}/{max_count})</b>\n\n"
                    f"<b>Order ID:</b> {o.get('order_code', '-')}\n"
                    f"<b>Pembeli:</b> {o.get('buyer_name', '-')} | {o.get('contact', '-')}\n"
                    f"<b>Produk:</b> {o.get('product_name', '-')}{variant_line}\n"
                    f"<b>Total:</b> Rp {int(float(total)):,}\n"
                    f"<b>Metode Bayar:</b> {o.get('payment_method', '-').upper()}\n"
                    f"<b>Menunggu sejak:</b> {ago_text} yang lalu\n\n"
                    f"→ Segera konfirmasi di admin panel:\n"
                    f"https://creativestore.my.id/admin"
                )

                try:
                    kb = {
                        "inline_keyboard": [
                            [
                                {"text": "✅ Konfirmasi", "callback_data": f"confirm:{o['id']}"},
                                {"text": "❌ Batalkan", "callback_data": f"cancel:{o['id']}"},
                            ],
                            [{"text": "🔗 Buka Admin Panel", "url": "https://creativestore.my.id/admin"}],
                        ]
                    }
                    await send_telegram_fn(text, reply_markup=kb)
                    await db.orders.update_one(
                        {"id": o["id"]},
                        {"$set": {
                            "last_admin_reminder_at": now.isoformat(),
                        }, "$inc": {"admin_reminder_count": 1}},
                    )
                    logger.info(f"Pending reminder #{reminder_no} sent for order {o.get('order_code')}")
                except Exception as e:
                    logger.error(f"Failed sending pending reminder for {o.get('order_code')}: {e}")
        except Exception as e:
            logger.error(f"Pending reminder job error: {e}")

    scheduler.add_job(
        _pending_reminder_job,
        IntervalTrigger(minutes=15),
        id="pending_order_reminder",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,
        next_run_time=datetime.now(WIB) + timedelta(minutes=1),
    )
    return scheduler
