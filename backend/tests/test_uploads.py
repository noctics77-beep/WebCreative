"""Tests for product photo upload feature (MongoDB-backed).

Endpoints under test:
  - POST /api/admin/uploads (X-Admin-Password required)
  - GET  /api/uploads/{id}  (public)
"""
import io
import os
import struct
import zlib
import hashlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Blokirsandi12")
ADMIN_HEADERS = {"X-Admin-Password": ADMIN_PASSWORD}


def _make_png(width=1, height=1):
    """Return minimal valid PNG bytes."""
    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    raw = b"".join(b"\x00" + b"\xff\x00\x00" * width for _ in range(height))
    idat = chunk(b"IDAT", zlib.compress(raw))
    iend = chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


# ---------- Upload endpoint ----------

def test_upload_png_success():
    png = _make_png()
    files = {"file": ("test.png", io.BytesIO(png), "image/png")}
    r = requests.post(f"{BASE_URL}/api/admin/uploads", files=files, headers=ADMIN_HEADERS, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "url" in j and "id" in j and "size" in j
    assert j["url"] == f"/api/uploads/{j['id']}"
    assert j["size"] == len(png)

    # GET the file back publicly (no auth)
    g = requests.get(f"{BASE_URL}{j['url']}", timeout=15)
    assert g.status_code == 200
    assert g.headers.get("content-type", "").startswith("image/png")
    assert hashlib.sha256(g.content).hexdigest() == hashlib.sha256(png).hexdigest()

    # Verify backend directly (ingress may rewrite Cache-Control)
    g2 = requests.get(f"http://localhost:8001{j['url']}", timeout=15)
    cc = g2.headers.get("cache-control", "").lower()
    assert "immutable" in cc and "max-age=31536000" in cc, f"backend cache-control={cc}"


def test_upload_no_auth_returns_401():
    files = {"file": ("t.png", io.BytesIO(_make_png()), "image/png")}
    r = requests.post(f"{BASE_URL}/api/admin/uploads", files=files, timeout=15)
    assert r.status_code == 401, r.text


def test_upload_non_image_rejected_400():
    files = {"file": ("t.txt", io.BytesIO(b"hello world"), "text/plain")}
    r = requests.post(f"{BASE_URL}/api/admin/uploads", files=files, headers=ADMIN_HEADERS, timeout=15)
    assert r.status_code == 400
    assert "gambar" in r.text.lower()


def test_upload_oversized_rejected_400():
    # 5MB + 1 byte payload, but declared as image/png
    payload = b"\x89PNG\r\n\x1a\n" + b"0" * (5 * 1024 * 1024)
    files = {"file": ("big.png", io.BytesIO(payload), "image/png")}
    r = requests.post(f"{BASE_URL}/api/admin/uploads", files=files, headers=ADMIN_HEADERS, timeout=30)
    assert r.status_code == 400
    assert "5mb" in r.text.lower() or "maksimal" in r.text.lower()


def test_upload_webp_and_gif_accepted():
    for ct in ("image/webp", "image/gif"):
        files = {"file": (f"t.{ct.split('/')[1]}", io.BytesIO(_make_png()), ct)}
        r = requests.post(f"{BASE_URL}/api/admin/uploads", files=files, headers=ADMIN_HEADERS, timeout=15)
        assert r.status_code == 200, f"{ct}: {r.text}"


# ---------- Public GET ----------

def test_get_upload_nonexistent_404():
    r = requests.get(f"{BASE_URL}/api/uploads/does-not-exist-xyz", timeout=15)
    assert r.status_code == 404


# ---------- Product integration ----------

def test_product_with_uploaded_photo_url_persists():
    # 1) Upload
    files = {"file": ("prod.png", io.BytesIO(_make_png()), "image/png")}
    up = requests.post(f"{BASE_URL}/api/admin/uploads", files=files, headers=ADMIN_HEADERS, timeout=15).json()
    photo_url = up["url"]
    assert photo_url.startswith("/api/uploads/")

    # 2) Create product referencing the relative URL
    payload = {
        "name": "TEST_UploadPhoto",
        "price": 12345,
        "original_price": 20000,
        "description": "upload test",
        "photo_url": photo_url,
        "category": "test",
    }
    c = requests.post(f"{BASE_URL}/api/admin/products", json=payload, headers=ADMIN_HEADERS, timeout=15)
    assert c.status_code in (200, 201), c.text
    created = c.json()
    prod_id = created.get("id") or created.get("_id")
    assert created.get("photo_url") == photo_url

    # 3) GET /api/products contains it
    lst = requests.get(f"{BASE_URL}/api/products", timeout=15).json()
    match = [p for p in lst if p.get("name") == "TEST_UploadPhoto"]
    assert match, "created product not found in /api/products"
    assert match[0].get("photo_url") == photo_url

    # Cleanup
    if prod_id:
        requests.delete(f"{BASE_URL}/api/admin/products/{prod_id}", headers=ADMIN_HEADERS, timeout=15)
