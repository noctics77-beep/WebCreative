"""Daily Telegram summary scheduler.

Sends a recap of yesterday's activity to TELEGRAM_CHAT_ID every day at 08:00 WIB
(Asia/Jakarta). Hooked into FastAPI startup.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

WIB = pytz.timezone("Asia/Jakarta")


async def build_daily_summary(db) -> str:
    """Compute yesterday's metrics (WIB calendar day) and return Telegram-ready text."""
    # Use WIB calendar day for "kemarin"
    now_wib = datetime.now(WIB)
    today_wib_midnight = now_wib.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_wib_start = today_wib_midnight - timedelta(days=1)
    yesterday_wib_end = today_wib_midnight

    # Convert to UTC ISO for matching `created_at`
    start_iso = yesterday_wib_start.astimezone(timezone.utc).isoformat()
    end_iso = yesterday_wib_end.astimezone(timezone.utc).isoformat()
    date_label = yesterday_wib_start.strftime("%d %B %Y")

    paid_match = {
        "status": "confirmed",
        "created_at": {"$gte": start_iso, "$lt": end_iso},
    }

    # Total orders + revenue
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

    # Top product
    top_agg = [
        {"$match": paid_match},
        {
            "$group": {
                "_id": "$product_id",
                "name": {"$first": "$product_name"},
                "n": {"$sum": 1},
            }
        },
        {"$sort": {"n": -1}},
        {"$limit": 1},
    ]
    top_rows = await db.orders.aggregate(top_agg).to_list(1)
    top_name = top_rows[0].get("name") if top_rows else None

    # New affiliates yesterday
    new_aff = await db.affiliates.count_documents({"created_at": {"$gte": start_iso, "$lt": end_iso}})

    # Pending withdrawals (all-time)
    pending_wd = await db.withdrawals.count_documents({"status": "pending"})

    msg = (
        f"<b>📊 Ringkasan CreativeStore — {date_label}</b>\n\n"
        f"🛒 <b>Order:</b> {count} transaksi\n"
        f"💰 <b>Omzet:</b> Rp {int(revenue):,}\n"
        f"🔥 <b>Terlaris:</b> {top_name or '-'}\n"
        f"👥 <b>Affiliate baru:</b> {new_aff}\n"
        f"⏳ <b>WD pending:</b> {pending_wd}"
    )
    return msg


def init_scheduler(db, send_telegram_fn) -> AsyncIOScheduler:
    """Initialize APScheduler with the daily 08:00 WIB job. Returns scheduler instance."""
    scheduler = AsyncIOScheduler(timezone=WIB)

    async def _job():
        try:
            text = await build_daily_summary(db)
            await send_telegram_fn(text)
            logger.info("Daily Telegram summary sent")
        except Exception as e:
            logger.error(f"Daily summary failed: {e}")

    scheduler.add_job(
        _job,
        CronTrigger(hour=8, minute=0, timezone=WIB),
        id="daily_telegram_summary",
        replace_existing=True,
    )
    return scheduler
