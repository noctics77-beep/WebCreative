"""Backend tests for CreativeStore - covers products, orders, affiliates, withdrawals, admin flows."""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://dynamic-qr-payment-1.preview.emergentagent.com"
API = f"{BASE_URL}/api"
ADMIN_PWD = "Blokirsandi12"
ADMIN_HEADERS = {"X-Admin-Password": ADMIN_PWD, "Content-Type": "application/json"}


# ---------- Health & Products ----------
def test_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200

def test_list_products():
    r = requests.get(f"{API}/products")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 6
    p = data[0]
    for k in ["id", "name", "photo_url", "original_price", "commission_percent", "stock_status"]:
        assert k in p

def test_config():
    r = requests.get(f"{API}/config")
    assert r.status_code == 200
    assert r.json().get("admin_whatsapp") == "6287741449684"


# ---------- Admin auth ----------
def test_admin_login_wrong():
    r = requests.post(f"{API}/admin/login", json={"password": "wrong"})
    assert r.status_code == 401

def test_admin_login_ok():
    r = requests.post(f"{API}/admin/login", json={"password": ADMIN_PWD})
    assert r.status_code == 200
    assert r.json()["ok"] is True

def test_admin_endpoint_requires_password():
    r = requests.get(f"{API}/admin/orders")
    assert r.status_code == 401


# ---------- Admin Product CRUD ----------
@pytest.fixture(scope="module")
def test_product():
    payload = {
        "name": "TEST_Product_1",
        "photo_url": "https://picsum.photos/300",
        "original_price": 20000,
        "discount_price": 15000,
        "discount_active": True,
        "description": "test desc",
        "commission_percent": 12,
        "stock_status": "available",
    }
    r = requests.post(f"{API}/admin/products", json=payload, headers=ADMIN_HEADERS)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["name"] == "TEST_Product_1"
    yield p
    requests.delete(f"{API}/admin/products/{p['id']}", headers=ADMIN_HEADERS)

def test_product_update(test_product):
    pid = test_product["id"]
    payload = {**test_product, "name": "TEST_Product_UPDATED"}
    payload.pop("id", None); payload.pop("created_at", None)
    r = requests.put(f"{API}/admin/products/{pid}", json=payload, headers=ADMIN_HEADERS)
    assert r.status_code == 200
    assert r.json()["name"] == "TEST_Product_UPDATED"
    # verify persist
    r2 = requests.get(f"{API}/products/{pid}")
    assert r2.status_code == 200
    assert r2.json()["name"] == "TEST_Product_UPDATED"


# ---------- Affiliate registration & dashboard ----------
@pytest.fixture(scope="module")
def affiliate():
    r = requests.post(f"{API}/affiliates", json={"name": "TEST_Aff", "contact": "0812"})
    assert r.status_code == 200
    data = r.json()
    assert data["affiliate_code"].startswith("AFF")
    assert len(data["affiliate_code"]) == 8
    return data

def test_affiliate_dashboard_ok(affiliate):
    code = affiliate["affiliate_code"]
    r = requests.get(f"{API}/affiliates/{code}")
    assert r.status_code == 200
    d = r.json()
    assert d["affiliate"]["affiliate_code"] == code
    assert d["affiliate"]["balance"] == 0
    assert isinstance(d["orders"], list)
    assert isinstance(d["withdrawals"], list)

def test_affiliate_dashboard_404():
    r = requests.get(f"{API}/affiliates/AFFZZZZZ")
    assert r.status_code == 404


# ---------- Order flow without ref ----------
def test_order_no_ref(test_product):
    payload = {
        "buyer_name": "TEST_Buyer",
        "contact": "08123",
        "product_id": test_product["id"],
        "payment_method": "qris",
    }
    r = requests.post(f"{API}/orders", json=payload)
    assert r.status_code == 200
    o = r.json()
    assert o["order_code"].startswith("ORD")
    assert len(o["order_code"]) == 9


# ---------- Order with ref + commission flow ----------
@pytest.fixture(scope="module")
def referral_order(test_product, affiliate):
    payload = {
        "buyer_name": "TEST_Referred",
        "contact": "08999",
        "product_id": test_product["id"],
        "payment_method": "transfer",
        "referral_affiliate_code": affiliate["affiliate_code"],
    }
    r = requests.post(f"{API}/orders", json=payload)
    assert r.status_code == 200
    return r.json()

def test_commission_calculation(referral_order, affiliate):
    # find order in admin list
    r = requests.get(f"{API}/admin/orders", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    orders = r.json()
    order = next((o for o in orders if o["id"] == referral_order["id"]), None)
    assert order is not None
    # discounted price 15000 * 12% = 1800
    assert order["referral_affiliate_code"] == affiliate["affiliate_code"]
    assert order["commission_amount"] == 1800.0

def test_confirm_order_credits_balance(referral_order, affiliate):
    oid = referral_order["id"]
    r = requests.patch(f"{API}/admin/orders/{oid}/status", json={"status": "confirmed"}, headers=ADMIN_HEADERS)
    assert r.status_code == 200
    # check balance
    r2 = requests.get(f"{API}/affiliates/{affiliate['affiliate_code']}")
    assert r2.json()["affiliate"]["balance"] == 1800.0
    assert r2.json()["affiliate"]["total_earned"] == 1800.0

def test_reprocess_order_400(referral_order):
    r = requests.patch(f"{API}/admin/orders/{referral_order['id']}/status", json={"status": "cancelled"}, headers=ADMIN_HEADERS)
    assert r.status_code == 400


# ---------- Withdrawals ----------
def test_withdrawal_exceeds_balance(affiliate):
    r = requests.post(f"{API}/withdrawals", json={
        "affiliate_code": affiliate["affiliate_code"], "amount": 999999, "method": "bca", "account_number": "1234"
    })
    assert r.status_code == 400

def test_withdrawal_ok_and_balance(affiliate):
    r = requests.post(f"{API}/withdrawals", json={
        "affiliate_code": affiliate["affiliate_code"], "amount": 1000, "method": "bca", "account_number": "1234"
    })
    assert r.status_code == 200
    wd = r.json()
    # balance reduced
    r2 = requests.get(f"{API}/affiliates/{affiliate['affiliate_code']}")
    assert r2.json()["affiliate"]["balance"] == 800.0
    # approve
    r3 = requests.patch(f"{API}/admin/withdrawals/{wd['id']}/status", json={"status": "approved"}, headers=ADMIN_HEADERS)
    assert r3.status_code == 200
    r4 = requests.get(f"{API}/affiliates/{affiliate['affiliate_code']}")
    assert r4.json()["affiliate"]["total_withdrawn"] == 1000.0

def test_withdrawal_reject_refunds(affiliate):
    r = requests.post(f"{API}/withdrawals", json={
        "affiliate_code": affiliate["affiliate_code"], "amount": 500, "method": "bca", "account_number": "1234"
    })
    assert r.status_code == 200
    wd_id = r.json()["id"]
    # balance went 800 -> 300
    bal = requests.get(f"{API}/affiliates/{affiliate['affiliate_code']}").json()["affiliate"]["balance"]
    assert bal == 300.0
    r2 = requests.patch(f"{API}/admin/withdrawals/{wd_id}/status", json={"status": "rejected"}, headers=ADMIN_HEADERS)
    assert r2.status_code == 200
    bal2 = requests.get(f"{API}/affiliates/{affiliate['affiliate_code']}").json()["affiliate"]["balance"]
    assert bal2 == 800.0


# ---------- Admin lists ----------
def test_admin_affiliates_list():
    r = requests.get(f"{API}/admin/affiliates", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    affs = r.json()
    assert isinstance(affs, list)
    if affs:
        assert "total_sales" in affs[0]

def test_admin_withdrawals_list():
    r = requests.get(f"{API}/admin/withdrawals", headers=ADMIN_HEADERS)
    assert r.status_code == 200
