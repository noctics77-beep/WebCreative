"""Backend tests for Product Variants + Banner Countdown (iteration 8)."""
import os
import time
from datetime import datetime, timedelta, timezone
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    import re
    with open("/app/frontend/.env") as f:
        for line in f:
            m = re.match(r"REACT_APP_BACKEND_URL=(.+)", line.strip())
            if m:
                BASE_URL = m.group(1).rstrip("/")
                break

ADMIN_PWD = "Blokirsandi12"
ADMIN_HDR = {"Content-Type": "application/json", "x-admin-password": ADMIN_PWD}
API = f"{BASE_URL}/api"


# ---- Helpers ----
def _iso_utc(dt):
    return dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


@pytest.fixture(scope="module")
def created_state():
    state = {"product_ids": [], "coupon_ids": [], "banner_ids": []}
    yield state
    # Teardown
    for pid in state["product_ids"]:
        try:
            requests.delete(f"{API}/admin/products/{pid}", headers=ADMIN_HDR, timeout=15)
        except Exception:
            pass
    for cid in state["coupon_ids"]:
        try:
            requests.delete(f"{API}/admin/coupons/{cid}", headers=ADMIN_HDR, timeout=15)
        except Exception:
            pass
    for bid in state["banner_ids"]:
        try:
            requests.delete(f"{API}/admin/banners/{bid}", headers=ADMIN_HDR, timeout=15)
        except Exception:
            pass


# ============ 1. Bulk Import V2 ============
def test_bulk_import_v2_with_variants(created_state):
    payload = {
        "items": [{
            "name": "TEST_V2_CapCutBulk",
            "price": 0,
            "variants": [
                {"name": "7 Hari", "price": 15000, "is_recommended": False, "is_best_value": False},
                {"name": "30 Hari", "price": 40000, "is_recommended": True, "is_best_value": False},
                {"name": "90 Hari", "price": 50000, "is_recommended": False, "is_best_value": True},
            ],
        }]
    }
    r = requests.post(f"{API}/admin/products/bulk-import-v2", json=payload, headers=ADMIN_HDR, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["created"] == 1
    assert data["variants_created"] == 3
    prod = data["products"][0]
    assert prod["has_variants"] is True
    assert prod["original_price"] == 15000  # min variant price
    created_state["product_ids"].append(prod["id"])


# ============ 2. GET public variants ============
def test_public_variants_sorted_active(created_state):
    pid = created_state["product_ids"][0]
    r = requests.get(f"{API}/products/{pid}/variants", timeout=10)
    assert r.status_code == 200
    variants = r.json()
    assert len(variants) == 3
    names = [v["name"] for v in variants]
    assert names == ["7 Hari", "30 Hari", "90 Hari"]
    for v in variants:
        assert v["is_active"] is True


# ============ 3. PUT replace variants + exclusivity ============
def test_put_replace_variants_exclusivity(created_state):
    pid = created_state["product_ids"][0]
    # Get existing
    r = requests.get(f"{API}/admin/products/{pid}/variants", headers=ADMIN_HDR, timeout=10)
    assert r.status_code == 200
    existing = r.json()
    # keep first 2, mark both as recommended -> exclusivity enforced
    payload = {"variants": [
        {"id": existing[0]["id"], "name": "7 Hari", "price": 15000, "is_recommended": True, "is_best_value": True, "is_active": True, "display_order": 0},
        {"id": existing[1]["id"], "name": "30 Hari", "price": 40000, "is_recommended": True, "is_best_value": True, "is_active": True, "display_order": 1},
        # new one, no id (insert)
        {"name": "365 Hari", "price": 100000, "is_recommended": False, "is_best_value": False, "is_active": True, "display_order": 2},
    ]}
    r = requests.put(f"{API}/admin/products/{pid}/variants", json=payload, headers=ADMIN_HDR, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["has_variants"] is True
    variants = data["variants"]
    assert len(variants) == 3  # 3rd original ("90 Hari") deleted
    names = sorted([v["name"] for v in variants])
    assert "90 Hari" not in names
    # Exclusivity: only 1 recommended, 1 best_value
    rec_count = sum(1 for v in variants if v.get("is_recommended"))
    bv_count = sum(1 for v in variants if v.get("is_best_value"))
    assert rec_count == 1
    assert bv_count == 1
    # Auto-updated original_price = min = 15000
    p = requests.get(f"{API}/products/{pid}", timeout=10).json()
    assert p["original_price"] == 15000


# ============ 4. Create order with variant_id ============
def test_create_order_with_variant_id(created_state):
    pid = created_state["product_ids"][0]
    # publish product first
    r = requests.patch(f"{API}/admin/products/{pid}/publish-status", json={"publish_status": "published"}, headers=ADMIN_HDR, timeout=10)
    assert r.status_code == 200, r.text
    variants = requests.get(f"{API}/products/{pid}/variants").json()
    # pick highest-price variant
    variants_sorted = sorted(variants, key=lambda v: v["price"], reverse=True)
    target = variants_sorted[0]
    body = {
        "product_id": pid,
        "buyer_name": "TEST_Buyer_VarID",
        "contact": "@test_variant_user",
        "payment_method": "transfer_manual",
        "variant_id": target["id"],
    }
    r = requests.post(f"{API}/orders", json=body, timeout=15)
    assert r.status_code == 200, r.text
    order_code = r.json()["order_code"]
    # Fetch via admin
    orders = requests.get(f"{API}/admin/orders", headers=ADMIN_HDR, timeout=10).json()
    order = next((o for o in orders if o["order_code"] == order_code), None)
    assert order is not None
    assert order["variant_id"] == target["id"]
    assert order["variant_name"] == target["name"]
    assert order["product_price"] == target["price"]


# ============ 5. Order without variant_id auto-selects recommended ============
def test_create_order_auto_selects_recommended(created_state):
    pid = created_state["product_ids"][0]
    body = {
        "product_id": pid,
        "buyer_name": "TEST_Buyer_Auto",
        "contact": "@test_auto",
        "payment_method": "transfer_manual",
    }
    r = requests.post(f"{API}/orders", json=body, timeout=15)
    assert r.status_code == 200, r.text
    order_code = r.json()["order_code"]
    orders = requests.get(f"{API}/admin/orders", headers=ADMIN_HDR, timeout=10).json()
    order = next((o for o in orders if o["order_code"] == order_code), None)
    assert order is not None
    # After PUT above, only the FIRST variant is_recommended (7 Hari)
    assert order["variant_id"] is not None
    assert order["variant_name"] == "7 Hari"
    assert order["product_price"] == 15000


# ============ 6. GET /products list enrichment ============
def test_products_list_enrichment(created_state):
    pid = created_state["product_ids"][0]
    r = requests.get(f"{API}/products", timeout=15)
    assert r.status_code == 200
    products = r.json()
    match = next((p for p in products if p["id"] == pid), None)
    assert match is not None
    assert match.get("has_variants") is True
    assert "starting_price" in match
    assert match["starting_price"] == 15000
    assert "variant_preview" in match
    assert isinstance(match["variant_preview"], list)
    assert 1 <= len(match["variant_preview"]) <= 3
    assert "variant_count" in match or len(match["variant_preview"]) >= 1


# ============ 7. Banner CRUD with linked_coupon + expires_at ============
def test_banner_with_linked_coupon_and_expires(created_state):
    # First create coupon
    valid_until = _iso_utc(datetime.now(timezone.utc) + timedelta(days=2))
    coupon_payload = {
        "code": "TESTHEMAT50",
        "discount_type": "percentage",
        "discount_value": 50,
        "valid_until": valid_until,
        "active": True,
    }
    r = requests.post(f"{API}/admin/coupons", json=coupon_payload, headers=ADMIN_HDR, timeout=10)
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    created_state["coupon_ids"].append(cid)

    # Banner without explicit expires_at → should inherit from coupon.valid_until on public GET
    banner_payload = {
        "title": "TEST_Banner_Countdown",
        "subtitle": "Diskon 50%",
        "cta_text": "Klaim",
        "cta_link": "#",
        "active": True,
        "linked_coupon_code": "TESTHEMAT50",
        "expires_at": "",
    }
    r = requests.post(f"{API}/admin/banners", json=banner_payload, headers=ADMIN_HDR, timeout=10)
    assert r.status_code == 200, r.text
    bid = r.json()["id"]
    created_state["banner_ids"].append(bid)

    # Public GET should enrich expires_at
    r = requests.get(f"{API}/banners", timeout=10)
    assert r.status_code == 200
    banners = r.json()
    match = next((b for b in banners if b["id"] == bid), None)
    assert match is not None
    assert match["linked_coupon_code"] == "TESTHEMAT50"
    assert match["expires_at"] == valid_until, f"expected enrichment, got {match['expires_at']}"

    # Now override with manual expires_at
    manual_expiry = _iso_utc(datetime.now(timezone.utc) + timedelta(hours=2))
    r = requests.put(
        f"{API}/admin/banners/{bid}",
        json={**banner_payload, "expires_at": manual_expiry},
        headers=ADMIN_HDR,
        timeout=10,
    )
    assert r.status_code == 200, r.text

    r = requests.get(f"{API}/banners", timeout=10)
    match = next((b for b in r.json() if b["id"] == bid), None)
    assert match["expires_at"] == manual_expiry


# ============ 8. Non-variant order sanity check ============
def test_non_variant_product_flat_order(created_state):
    # Create flat product via bulk-import-v2 (no variants)
    payload = {"items": [{"name": "TEST_V2_FlatProduct", "price": 45000, "variants": []}]}
    r = requests.post(f"{API}/admin/products/bulk-import-v2", json=payload, headers=ADMIN_HDR, timeout=15)
    assert r.status_code == 200
    pid = r.json()["products"][0]["id"]
    created_state["product_ids"].append(pid)
    prod = r.json()["products"][0]
    assert prod["has_variants"] is False
    assert prod["original_price"] == 45000
    # publish
    requests.patch(f"{API}/admin/products/{pid}/publish-status", json={"publish_status": "published"}, headers=ADMIN_HDR, timeout=10)
    # order without variant should work at product price
    body = {"product_id": pid, "buyer_name": "TEST_Flat", "contact": "@flat", "payment_method": "transfer_manual"}
    r = requests.post(f"{API}/orders", json=body, timeout=10)
    assert r.status_code == 200
    order_code = r.json()["order_code"]
    orders = requests.get(f"{API}/admin/orders", headers=ADMIN_HDR, timeout=10).json()
    order = next((o for o in orders if o["order_code"] == order_code), None)
    assert order is not None
    assert order.get("variant_id") in (None, "")
    assert order["product_price"] == 45000
