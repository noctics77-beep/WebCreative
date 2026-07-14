"""Daily Telegram summary scheduler with per-day idempotency lock.

Sends a recap of yesterday's activity to TELEGRAM_CHAT_ID every day at 08:00 WIB
(Asia/Jakarta). Idempotent via MongoDB lock so multiple workers/reloads won't
send duplicates.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
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
    return scheduler
