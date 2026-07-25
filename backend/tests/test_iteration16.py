"""Iteration 16 — Admin Telegram inline-keyboard webhook + setup endpoints.

Covers:
  * /api/admin/telegram/webhook-info
  * /api/admin/telegram/setup-admin-webhook (HTTPS enforcement + valid path)
  * /api/telegram/admin-webhook callback flow:
      - unauthorized chat_id/from_id -> ignored
      - confirm callback -> status becomes 'confirmed' + _apply_order_status_change side effects
      - cancel (step 1) -> status unchanged (still pending)
      - cancel_confirm -> status 'cancelled'
      - back -> status unchanged
      - re-processing already-confirmed order is idempotent (no error, no change)
      - non-callback update is gracefully ignored
  * Existing PATCH /admin/orders/{id}/status via _apply_order_status_change refactor
  * _admin_order_inline_kb structural sanity + send_telegram signature accepts reply_markup
"""
import os
import sys
import uuid
import asyncio
import pathlib
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

# Make /app/backend importable for helper introspection
sys.path.insert(0, "/app/backend")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"] if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # fallback: read frontend/.env
    for line in pathlib.Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL"):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
BASE_URL = BASE_URL.rstrip("/")

ADMIN_PASSWORD = "Blokirsandi12"
ADMIN_CHAT_ID = "8887481080"  # per env
UNAUTHORIZED_CHAT_ID = "9999999999"

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "creativestore_db"


# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_headers():
    return {"X-Admin-Password": ADMIN_PASSWORD, "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


def _insert_test_order(mongo, status="pending", payment_method="qris") -> dict:
    order_id = str(uuid.uuid4())
    order = {
        "id": order_id,
        "order_code": f"TEST_it16_{order_id[:6]}",
        "buyer_name": "TEST_it16 Buyer",
        "contact": "6280000000000",
        "product_id": "nonexistent-product",  # avoid touching real products
        "product_name": "TEST_it16 Product",
        "price": 10000,
        "payment_method": payment_method,
        "status": status,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "commission_amount": 0,
    }
    mongo.orders.insert_one(order)
    return order


@pytest.fixture
def pending_order(mongo):
    o = _insert_test_order(mongo)
    yield o
    mongo.orders.delete_one({"id": o["id"]})


@pytest.fixture(autouse=True, scope="session")
def _cleanup_at_end(mongo):
    yield
    mongo.orders.delete_many({"order_code": {"$regex": "^TEST_it16_"}})


# ---------------- setup-admin-webhook / webhook-info ----------------
class TestWebhookSetupEndpoints:
    def test_webhook_info_returns_getWebhookInfo(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/admin/telegram/webhook-info", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        # Telegram getWebhookInfo returns {ok:true,result:{url,...}}
        assert "ok" in data
        assert data.get("ok") is True
        assert "result" in data
        assert "url" in data["result"]

    def test_webhook_info_requires_admin(self, api):
        r = api.get(f"{BASE_URL}/api/admin/telegram/webhook-info")
        assert r.status_code in (401, 403)

    def test_setup_rejects_non_https(self, api, admin_headers):
        r = api.post(
            f"{BASE_URL}/api/admin/telegram/setup-admin-webhook",
            headers=admin_headers,
            json={"base_url": "http://example.com"},
        )
        assert r.status_code == 400
        assert "HTTPS" in r.text or "https" in r.text.lower()

    def test_setup_https_returns_webhook_url_and_response(self, api, admin_headers):
        # Use preview URL (BASE_URL). Telegram may reject unreachable URL — that's ok, we assert
        # the endpoint plumbing (webhook_url + telegram_response present).
        r = api.post(
            f"{BASE_URL}/api/admin/telegram/setup-admin-webhook",
            headers=admin_headers,
            json={"base_url": BASE_URL},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "webhook_url" in d
        assert d["webhook_url"].endswith("/api/telegram/admin-webhook")
        assert d["webhook_url"].startswith("https://")
        assert "telegram_response" in d

        # RESTORE production webhook to avoid impacting real bot: reset to production URL
        try:
            api.post(
                f"{BASE_URL}/api/admin/telegram/setup-admin-webhook",
                headers=admin_headers,
                json={"base_url": "https://creativestore.my.id"},
                timeout=15,
            )
        except Exception:
            pass

    def test_setup_requires_admin(self, api):
        r = api.post(
            f"{BASE_URL}/api/admin/telegram/setup-admin-webhook",
            json={"base_url": "https://example.com"},
        )
        assert r.status_code in (401, 403)


# ---------------- admin-webhook callback flow ----------------
def _cb_payload(action: str, order_id: str, chat_id: str = ADMIN_CHAT_ID, from_id: str = ADMIN_CHAT_ID):
    return {
        "update_id": 1,
        "callback_query": {
            "id": f"cbid-{uuid.uuid4().hex[:8]}",
            "from": {"id": int(from_id)} if str(from_id).isdigit() else {"id": from_id},
            "message": {
                "message_id": 12345,
                "chat": {"id": int(chat_id)} if str(chat_id).isdigit() else {"id": chat_id},
                "text": "🛒 Pesanan Baru — TEST_it16",
            },
            "data": f"{action}:{order_id}",
        },
    }


class TestAdminWebhookCallbacks:
    def test_unauthorized_chat_is_ignored(self, api, mongo, pending_order):
        r = api.post(
            f"{BASE_URL}/api/telegram/admin-webhook",
            json=_cb_payload("confirm", pending_order["id"], chat_id=UNAUTHORIZED_CHAT_ID, from_id=UNAUTHORIZED_CHAT_ID),
        )
        assert r.status_code == 200
        d = r.json()
        assert d.get("ignored") is True
        after = mongo.orders.find_one({"id": pending_order["id"]}, {"_id": 0})
        assert after["status"] == "pending", "Unauthorized callback must not change status"

    def test_non_callback_update_ignored(self, api):
        r = api.post(
            f"{BASE_URL}/api/telegram/admin-webhook",
            json={"update_id": 2, "message": {"text": "hi", "chat": {"id": int(ADMIN_CHAT_ID)}}},
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_confirm_flips_status(self, api, mongo, pending_order):
        r = api.post(f"{BASE_URL}/api/telegram/admin-webhook",
                     json=_cb_payload("confirm", pending_order["id"]))
        assert r.status_code == 200, r.text
        after = mongo.orders.find_one({"id": pending_order["id"]}, {"_id": 0})
        assert after["status"] == "confirmed"

    def test_confirm_idempotent_on_already_processed(self, api, mongo, pending_order):
        # first confirm
        api.post(f"{BASE_URL}/api/telegram/admin-webhook",
                 json=_cb_payload("confirm", pending_order["id"]))
        # second confirm on same order
        r = api.post(f"{BASE_URL}/api/telegram/admin-webhook",
                     json=_cb_payload("confirm", pending_order["id"]))
        assert r.status_code == 200
        assert r.json().get("ok") is True
        after = mongo.orders.find_one({"id": pending_order["id"]}, {"_id": 0})
        assert after["status"] == "confirmed"  # unchanged from first confirm

    def test_cancel_two_step_flow(self, api, mongo, pending_order):
        # Step 1: 'cancel' should NOT change status
        r1 = api.post(f"{BASE_URL}/api/telegram/admin-webhook",
                      json=_cb_payload("cancel", pending_order["id"]))
        assert r1.status_code == 200
        mid = mongo.orders.find_one({"id": pending_order["id"]}, {"_id": 0})
        assert mid["status"] == "pending", "Step-1 cancel must NOT change status"

        # Step 2: 'cancel_confirm' should change to 'cancelled'
        r2 = api.post(f"{BASE_URL}/api/telegram/admin-webhook",
                      json=_cb_payload("cancel_confirm", pending_order["id"]))
        assert r2.status_code == 200
        after = mongo.orders.find_one({"id": pending_order["id"]}, {"_id": 0})
        assert after["status"] == "cancelled"

    def test_back_keeps_status_pending(self, api, mongo, pending_order):
        r = api.post(f"{BASE_URL}/api/telegram/admin-webhook",
                     json=_cb_payload("back", pending_order["id"]))
        assert r.status_code == 200
        after = mongo.orders.find_one({"id": pending_order["id"]}, {"_id": 0})
        assert after["status"] == "pending"

    def test_authorized_via_from_id_only(self, api, mongo, pending_order):
        # chat is somebody else but from_user is admin -> should be authorized
        r = api.post(
            f"{BASE_URL}/api/telegram/admin-webhook",
            json=_cb_payload("confirm", pending_order["id"], chat_id="1111", from_id=ADMIN_CHAT_ID),
        )
        assert r.status_code == 200
        assert not r.json().get("ignored")
        after = mongo.orders.find_one({"id": pending_order["id"]}, {"_id": 0})
        assert after["status"] == "confirmed"

    def test_unknown_action_is_safely_ignored(self, api, mongo, pending_order):
        r = api.post(
            f"{BASE_URL}/api/telegram/admin-webhook",
            json=_cb_payload("wat", pending_order["id"]),
        )
        assert r.status_code == 200
        after = mongo.orders.find_one({"id": pending_order["id"]}, {"_id": 0})
        assert after["status"] == "pending"


# ---------------- Existing PATCH endpoint still uses shared helper ----------------
class TestPatchOrderStatusStillWorks:
    def test_patch_confirm(self, api, admin_headers, mongo, pending_order):
        r = api.patch(
            f"{BASE_URL}/api/admin/orders/{pending_order['id']}/status",
            headers=admin_headers,
            json={"status": "confirmed"},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        after = mongo.orders.find_one({"id": pending_order["id"]}, {"_id": 0})
        assert after["status"] == "confirmed"

    def test_patch_reject_invalid_status(self, api, admin_headers, pending_order):
        r = api.patch(
            f"{BASE_URL}/api/admin/orders/{pending_order['id']}/status",
            headers=admin_headers,
            json={"status": "shipped"},
        )
        assert r.status_code == 400


# ---------------- helper introspection (send_telegram / kb builder) ----------------
class TestServerHelpers:
    def test_admin_order_inline_kb_initial(self):
        from server import _admin_order_inline_kb
        kb = _admin_order_inline_kb("oid-1", "ORD001")
        rows = kb["inline_keyboard"]
        # Row 0 has confirm+cancel; Row 1 has admin panel URL
        row0_data = [b.get("callback_data") for b in rows[0]]
        assert "confirm:oid-1" in row0_data
        assert "cancel:oid-1" in row0_data
        assert rows[1][0].get("url", "").endswith("/admin")

    def test_admin_order_inline_kb_confirm_cancel_stage(self):
        from server import _admin_order_inline_kb
        kb = _admin_order_inline_kb("oid-2", "ORD002", stage="confirm_cancel")
        row0_data = [b.get("callback_data") for b in kb["inline_keyboard"][0]]
        assert "cancel_confirm:oid-2" in row0_data
        assert "back:oid-2" in row0_data

    def test_send_telegram_accepts_reply_markup(self):
        import inspect
        from server import send_telegram
        sig = inspect.signature(send_telegram)
        assert "reply_markup" in sig.parameters
