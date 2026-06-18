"""Validate Pakasir order settlement logic (idempotent paid + commission payout)."""
import os
import uuid
import asyncio
import pytest
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent.parent / ".env")

import server  # noqa: E402


def test_settle_paid_order_pays_commission_once():
    asyncio.get_event_loop().run_until_complete(_run())


async def _run():
    db = server.db
    code = "ORDTEST" + uuid.uuid4().hex[:6].upper()
    aff_code = "AFFTST" + uuid.uuid4().hex[:4].upper()

    # Seed affiliate + order
    await db.affiliates.insert_one({
        "id": str(uuid.uuid4()), "affiliate_code": aff_code, "name": "Tester",
        "contact": "08", "balance": 0.0, "total_earned": 0.0, "total_withdrawn": 0.0,
        "created_at": server.now_iso(),
    })
    await db.orders.insert_one({
        "id": str(uuid.uuid4()), "order_code": code, "buyer_name": "B", "contact": "0",
        "product_id": "x", "product_name": "P", "product_price": 100000.0,
        "payment_method": "qris_otomatis", "referral_affiliate_code": aff_code,
        "status": "pending", "commission_amount": 10000.0, "pakasir_total": 101000.0,
        "created_at": server.now_iso(),
    })

    # First settle -> should pay commission
    first = await server._settle_paid_order(code)
    assert first is True
    order = await db.orders.find_one({"order_code": code})
    assert order["status"] == "confirmed"
    assert order["paid_via"] == "pakasir_auto"
    aff = await db.affiliates.find_one({"affiliate_code": aff_code})
    assert aff["balance"] == 10000.0
    assert aff["total_earned"] == 10000.0

    # Second settle -> idempotent, no double payout
    second = await server._settle_paid_order(code)
    assert second is False
    aff2 = await db.affiliates.find_one({"affiliate_code": aff_code})
    assert aff2["balance"] == 10000.0

    # Cleanup
    await db.orders.delete_one({"order_code": code})
    await db.affiliates.delete_one({"affiliate_code": aff_code})
