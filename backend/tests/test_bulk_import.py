"""Regression tests for POST /api/admin/products/bulk-import."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rizky-web-build.preview.emergentagent.com").rstrip("/")
ADMIN_PASSWORD = "Blokirsandi12"
API = f"{BASE_URL}/api"

HEADERS_ADMIN = {"Content-Type": "application/json", "X-Admin-Password": ADMIN_PASSWORD}
HEADERS_NOAUTH = {"Content-Type": "application/json"}

CREATED_IDS = []


def _cleanup(ids):
    for pid in ids:
        try:
            requests.delete(f"{API}/admin/products/{pid}", headers=HEADERS_ADMIN, timeout=10)
        except Exception:
            pass


@pytest.fixture(scope="module", autouse=True)
def cleanup_all():
    yield
    _cleanup(CREATED_IDS)
    # also cleanup any leftover BulkTest / Test Bulk products
    try:
        all_products = requests.get(f"{API}/products", timeout=10).json()
        for p in all_products:
            name = p.get("name", "")
            if name.startswith(("BulkTest", "Test Bulk", "TEST_")):
                requests.delete(f"{API}/admin/products/{p['id']}", headers=HEADERS_ADMIN, timeout=10)
    except Exception:
        pass


# --- Auth check ---
def test_bulk_import_requires_admin_password():
    r = requests.post(f"{API}/admin/products/bulk-import", json={"names": ["BulkTest NoAuth"]}, headers=HEADERS_NOAUTH, timeout=10)
    assert r.status_code == 401


# --- Empty / invalid ---
def test_bulk_import_empty_array_returns_400():
    r = requests.post(f"{API}/admin/products/bulk-import", json={"names": []}, headers=HEADERS_ADMIN, timeout=10)
    assert r.status_code == 400
    assert "Tidak ada nama produk valid" in r.text


def test_bulk_import_all_blank_returns_400():
    r = requests.post(f"{API}/admin/products/bulk-import", json={"names": ["", "   ", "\t"]}, headers=HEADERS_ADMIN, timeout=10)
    assert r.status_code == 400


# --- Happy path ---
def test_bulk_import_creates_products_with_defaults():
    names = ["BulkTest Netflix Premium", "BulkTest Spotify Family", "BulkTest Canva Pro"]
    r = requests.post(f"{API}/admin/products/bulk-import", json={"names": names}, headers=HEADERS_ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["created"] == 3
    assert len(data["products"]) == 3
    for prod in data["products"]:
        assert prod["photo_url"] == ""
        assert prod["original_price"] == 0
        assert prod["discount_price"] is None
        assert prod["discount_active"] is False
        assert prod["description"] == ""
        assert prod["commission_percent"] == 10.0
        assert prod["stock_status"] == "available"
        assert prod["monthly_sold"] == 0
        assert "id" in prod and isinstance(prod["id"], str) and len(prod["id"]) > 0
        assert "created_at" in prod
        assert "_id" not in prod  # Mongo ObjectId must be stripped
        CREATED_IDS.append(prod["id"])


def test_bulk_import_trims_and_dedupes_case_insensitive():
    names = ["  BulkTest Dedup A  ", "BulkTest Dedup A", "bulktest dedup a", "BulkTest Dedup B", "", "   "]
    r = requests.post(f"{API}/admin/products/bulk-import", json={"names": names}, headers=HEADERS_ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["created"] == 2, f"expected 2 got {data['created']}: {[p['name'] for p in data['products']]}"
    created_names = [p["name"] for p in data["products"]]
    assert "BulkTest Dedup A" in created_names
    assert "BulkTest Dedup B" in created_names
    for p in data["products"]:
        CREATED_IDS.append(p["id"])


def test_bulk_imported_products_appear_in_public_storefront():
    # Create one
    name = "BulkTest Storefront Visibility"
    r = requests.post(f"{API}/admin/products/bulk-import", json={"names": [name]}, headers=HEADERS_ADMIN, timeout=15)
    assert r.status_code == 200
    pid = r.json()["products"][0]["id"]
    CREATED_IDS.append(pid)

    # GET public /api/products
    r2 = requests.get(f"{API}/products", timeout=10)
    assert r2.status_code == 200
    products = r2.json()
    ids = [p["id"] for p in products]
    assert pid in ids, "Newly bulk-imported product not returned by public /api/products"
    match = next(p for p in products if p["id"] == pid)
    assert match["name"] == name
    assert match["stock_status"] == "available"
