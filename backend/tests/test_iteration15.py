"""Iteration 15 backend tests:
- GET /api/stats returns new pending_reminder_* + admin_whatsapp fields
- PUT /api/admin/stats persists new fields; GET /api/config prefers settings admin_whatsapp
- Order model tracks admin_reminder_count + last_admin_reminder_at
- Scheduler pending_order_reminder job registered
- _pending_reminder_job actually increments counter and honors anti-spam / skip rules
"""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_HEADERS = {"X-Admin-Password": "Blokirsandi12", "Content-Type": "application/json"}

# Make /app/backend importable for scheduler + db access tests
sys.path.insert(0, "/app/backend")


# ---------- Public/Admin API tests ----------

class TestStatsSettings:
    def test_get_stats_has_new_fields(self):
        r = requests.get(f"{BASE_URL}/api/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ["admin_whatsapp", "pending_reminder_enabled",
                  "pending_reminder_interval_minutes", "pending_reminder_max_count"]:
            assert k in d, f"missing field {k}"
        assert isinstance(d["pending_reminder_enabled"], bool)
        assert isinstance(d["pending_reminder_interval_minutes"], int)
        assert isinstance(d["pending_reminder_max_count"], int)

    def test_put_admin_stats_persists_new_fields(self):
        # Get current settings to preserve them
        cur = requests.get(f"{BASE_URL}/api/stats", timeout=15).json()
        payload = {
            "products_sold": cur.get("products_sold", "243+"),
            "active_partners": cur.get("active_partners", "89+"),
            "rating": cur.get("rating", "4.9/5"),
            "online_base": cur.get("online_base", 50),
            "live_feed_enabled": cur.get("live_feed_enabled", True),
            "loyalty_discount_percent": cur.get("loyalty_discount_percent", 10),
            "live_feed_names": cur.get("live_feed_names", []),
            "qris_url": cur.get("qris_url", ""),
            "bank_accounts": cur.get("bank_accounts", []),
            "show_coming_soon": cur.get("show_coming_soon", True),
            "trust_rating": cur.get("trust_rating", "5.0"),
            "trust_transactions": cur.get("trust_transactions", "5000+"),
            "trust_since_year": cur.get("trust_since_year", "2021"),
            "trust_process_time": cur.get("trust_process_time", "1x24 Jam"),
            "footer_start_year": cur.get("footer_start_year", "2021"),
            "pay_qris_otomatis_enabled": True,
            "pay_qris_manual_enabled": True,
            "pay_transfer_enabled": True,
            "telegram_group_url": cur.get("telegram_group_url", ""),
            "admin_whatsapp": "6287741449684",
            "pending_reminder_enabled": True,
            "pending_reminder_interval_minutes": 30,
            "pending_reminder_max_count": 3,
        }
        r = requests.put(f"{BASE_URL}/api/admin/stats", json=payload, headers=ADMIN_HEADERS, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["admin_whatsapp"] == "6287741449684"
        assert body["pending_reminder_enabled"] is True
        assert body["pending_reminder_interval_minutes"] == 30
        assert body["pending_reminder_max_count"] == 3

        # Verify persistence via GET /api/stats
        s = requests.get(f"{BASE_URL}/api/stats", timeout=15).json()
        assert s["admin_whatsapp"] == "6287741449684"
        assert s["pending_reminder_interval_minutes"] == 30

    def test_get_config_prefers_settings_admin_whatsapp(self):
        # After previous test we have admin_whatsapp set; /api/config should surface it
        r = requests.get(f"{BASE_URL}/api/config", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "admin_whatsapp" in d
        assert d["admin_whatsapp"] == "6287741449684"

    def test_put_admin_stats_requires_password(self):
        r = requests.put(f"{BASE_URL}/api/admin/stats", json={}, timeout=15)
        assert r.status_code in (401, 403, 422)


# ---------- Scheduler + reminder logic tests (direct DB / function invocation) ----------

@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def db():
    from motor.motor_asyncio import AsyncIOMotorClient  # noqa
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


class TestSchedulerJob:
    def test_scheduler_has_pending_reminder_job(self):
        import scheduler as sch  # /app/backend/scheduler.py
        # We need to init scheduler with a fake db & send_fn to inspect jobs registered
        class FakeColl:
            async def find_one(self, *a, **k): return None
            async def insert_one(self, *a, **k): return None
            async def update_one(self, *a, **k): return None
            def find(self, *a, **k):
                class _C:
                    def limit(self, n): return self
                    async def to_list(self, n): return []
                return _C()
        class FakeDB:
            def __getattr__(self, name): return FakeColl()
        async def fake_send(text): return None
        s = sch.init_scheduler(FakeDB(), fake_send)
        job_ids = {j.id for j in s.get_jobs()}
        assert "pending_order_reminder" in job_ids
        assert "daily_telegram_summary" in job_ids

    def test_reminder_increments_counter_and_respects_max(self, event_loop, db):
        """Insert a backdated pending qris order, invoke job, verify increment. Anti-spam after max."""
        import scheduler as sch
        import uuid

        async def run():
            order_id = f"TEST_it15_{uuid.uuid4().hex[:8]}"
            created_at = (datetime.now(timezone.utc) - timedelta(minutes=90)).isoformat()
            order_doc = {
                "id": order_id,
                "order_code": f"TESTIT15-{uuid.uuid4().hex[:6]}",
                "status": "pending",
                "payment_method": "qris",
                "product_name": "TEST product",
                "product_price": 10000,
                "buyer_name": "TEST buyer",
                "contact": "TEST@example.com",
                "created_at": created_at,
                "admin_reminder_count": 0,
            }
            await db.orders.insert_one(order_doc)

            # Ensure reminder settings enabled and low threshold
            await db.settings.update_one(
                {"id": "stats"},
                {"$set": {
                    "pending_reminder_enabled": True,
                    "pending_reminder_interval_minutes": 30,
                    "pending_reminder_max_count": 3,
                }}, upsert=True)

            sent = []
            async def fake_send(text): sent.append(text)

            s = sch.init_scheduler(db, fake_send)
            # Get the function
            job = s.get_job("pending_order_reminder")
            fn = job.func

            # Invocation 1
            await fn()
            o1 = await db.orders.find_one({"id": order_id}, {"_id": 0})
            assert o1["admin_reminder_count"] == 1
            assert o1.get("last_admin_reminder_at")

            # Immediate 2nd invocation should NOT increment (interval throttle)
            await fn()
            o2 = await db.orders.find_one({"id": order_id}, {"_id": 0})
            assert o2["admin_reminder_count"] == 1, "throttle by interval failed"

            # Backdate last_admin_reminder_at + created_at so it becomes eligible again
            past = (datetime.now(timezone.utc) - timedelta(minutes=60)).isoformat()
            await db.orders.update_one({"id": order_id},
                                        {"$set": {"last_admin_reminder_at": past, "created_at": created_at}})
            await fn()
            o3 = await db.orders.find_one({"id": order_id}, {"_id": 0})
            assert o3["admin_reminder_count"] == 2

            # Push to max
            past2 = (datetime.now(timezone.utc) - timedelta(minutes=60)).isoformat()
            await db.orders.update_one({"id": order_id}, {"$set": {"last_admin_reminder_at": past2}})
            await fn()
            o4 = await db.orders.find_one({"id": order_id}, {"_id": 0})
            assert o4["admin_reminder_count"] == 3

            # Beyond max — should not increment
            past3 = (datetime.now(timezone.utc) - timedelta(minutes=60)).isoformat()
            await db.orders.update_one({"id": order_id}, {"$set": {"last_admin_reminder_at": past3}})
            await fn()
            o5 = await db.orders.find_one({"id": order_id}, {"_id": 0})
            assert o5["admin_reminder_count"] == 3, "anti-spam max_count failed"

            # Cleanup
            await db.orders.delete_one({"id": order_id})

        event_loop.run_until_complete(run())

    def test_reminder_skips_confirmed_and_qris_otomatis(self, event_loop, db):
        import scheduler as sch
        import uuid

        async def run():
            base = {
                "product_name": "TEST product",
                "product_price": 10000,
                "buyer_name": "TEST buyer",
                "contact": "TEST@example.com",
                "created_at": (datetime.now(timezone.utc) - timedelta(minutes=90)).isoformat(),
                "admin_reminder_count": 0,
            }
            id_conf = f"TEST_it15c_{uuid.uuid4().hex[:8]}"
            id_auto = f"TEST_it15a_{uuid.uuid4().hex[:8]}"
            await db.orders.insert_one({**base, "id": id_conf, "order_code": id_conf,
                                        "status": "confirmed", "payment_method": "qris"})
            await db.orders.insert_one({**base, "id": id_auto, "order_code": id_auto,
                                        "status": "pending", "payment_method": "qris_otomatis"})

            async def fake_send(text): pass
            s = sch.init_scheduler(db, fake_send)
            fn = s.get_job("pending_order_reminder").func
            await fn()

            oc = await db.orders.find_one({"id": id_conf}, {"_id": 0})
            oa = await db.orders.find_one({"id": id_auto}, {"_id": 0})
            assert oc["admin_reminder_count"] == 0, "confirmed order should be skipped"
            assert oa["admin_reminder_count"] == 0, "qris_otomatis should be skipped"

            await db.orders.delete_many({"id": {"$in": [id_conf, id_auto]}})

        event_loop.run_until_complete(run())

    def test_reminder_disabled_flag_short_circuits(self, event_loop, db):
        import scheduler as sch
        import uuid

        async def run():
            order_id = f"TEST_it15d_{uuid.uuid4().hex[:8]}"
            await db.orders.insert_one({
                "id": order_id, "order_code": order_id, "status": "pending",
                "payment_method": "qris", "product_name": "T", "product_price": 1000,
                "buyer_name": "T", "contact": "t@t.com",
                "created_at": (datetime.now(timezone.utc) - timedelta(minutes=90)).isoformat(),
                "admin_reminder_count": 0,
            })
            await db.settings.update_one({"id": "stats"},
                                          {"$set": {"pending_reminder_enabled": False}}, upsert=True)
            async def fake_send(text): pass
            s = sch.init_scheduler(db, fake_send)
            fn = s.get_job("pending_order_reminder").func
            await fn()
            o = await db.orders.find_one({"id": order_id}, {"_id": 0})
            assert o["admin_reminder_count"] == 0
            # restore
            await db.settings.update_one({"id": "stats"},
                                          {"$set": {"pending_reminder_enabled": True}}, upsert=True)
            await db.orders.delete_one({"id": order_id})

        event_loop.run_until_complete(run())
