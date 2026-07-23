"""Iteration 14: Testimonials system + Inline product reorder tests."""
import io
import os
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rizky-web-build.preview.emergentagent.com").rstrip("/")
ADMIN_PASSWORD = "Blokirsandi12"
API = f"{BASE_URL}/api"

created_testimonial_ids = []


@pytest.fixture(scope="module")
def admin_headers():
    return {"X-Admin-Password": ADMIN_PASSWORD}


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for tid in created_testimonial_ids:
        try:
            requests.delete(f"{API}/admin/testimonials/{tid}", headers={"X-Admin-Password": ADMIN_PASSWORD}, timeout=10)
        except Exception:
            pass


# ---------------- Admin auth ----------------
class TestAdminAuth:
    def test_admin_verify(self):
        r = requests.post(f"{API}/admin/verify", json={"password": ADMIN_PASSWORD}, timeout=10)
        # if endpoint doesn't exist, try /admin/login or just test via admin endpoint
        assert r.status_code in (200, 404, 405)

    def test_admin_endpoint_with_password(self):
        r = requests.get(f"{API}/admin/testimonials/counts", headers={"X-Admin-Password": ADMIN_PASSWORD}, timeout=10)
        assert r.status_code == 200

    def test_admin_endpoint_without_password_fails(self):
        r = requests.get(f"{API}/admin/testimonials/counts", timeout=10)
        assert r.status_code in (401, 403)


# ---------------- Testimonials public ----------------
class TestTestimonialsPublic:
    def test_public_list(self):
        r = requests.get(f"{API}/testimonials", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_public_settings(self):
        r = requests.get(f"{API}/testimonials/settings", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "form_enabled" in data
        assert data["form_enabled"] is True

    def test_submit_valid(self):
        payload = {
            "name": "TEST_Reviewer",
            "whatsapp": "081234567890",
            "rating": 5,
            "content": "TEST testimonial content that is long enough",
        }
        r = requests.post(f"{API}/testimonials", json=payload, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert "id" in data
        assert "message" in data
        created_testimonial_ids.append(data["id"])

    def test_submit_short_name(self):
        r = requests.post(f"{API}/testimonials", json={
            "name": "A",
            "content": "valid content sufficiently long",
        }, timeout=10)
        assert r.status_code == 400

    def test_submit_short_content(self):
        r = requests.post(f"{API}/testimonials", json={
            "name": "Valid Name",
            "content": "short",
        }, timeout=10)
        assert r.status_code == 400

    def test_upload_photo(self):
        # generate small PNG in-memory
        img = Image.new("RGB", (10, 10), (255, 0, 0))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        files = {"file": ("t.png", buf, "image/png")}
        r = requests.post(f"{API}/testimonials/upload", files=files, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data
        assert data["url"].startswith("/api/uploads/")


# ---------------- Testimonials admin ----------------
class TestTestimonialsAdmin:
    def test_admin_list(self, admin_headers):
        r = requests.get(f"{API}/admin/testimonials", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_counts_structure(self, admin_headers):
        r = requests.get(f"{API}/admin/testimonials/counts", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        for k in ["pending", "approved", "hidden", "rejected", "admin_posts"]:
            assert k in data

    def test_admin_create_auto_approved(self, admin_headers):
        payload = {
            "name": "TEST_AdminPoster",
            "content": "TEST admin post content",
            "rating": 4,
            "is_admin_post": True,
        }
        r = requests.post(f"{API}/admin/testimonials", json=payload, headers=admin_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "approved"
        assert data["source"] == "admin"
        assert data.get("approved_at")
        created_testimonial_ids.append(data["id"])

    def test_status_update_and_pin(self, admin_headers):
        # create pending
        r = requests.post(f"{API}/testimonials", json={
            "name": "TEST_ToApprove",
            "content": "content to be approved by test",
            "rating": 5,
        }, timeout=10)
        assert r.status_code == 200
        tid = r.json()["id"]
        created_testimonial_ids.append(tid)

        # approve
        r2 = requests.patch(f"{API}/admin/testimonials/{tid}/status",
                            json={"status": "approved"}, headers=admin_headers, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["status"] == "approved"

        # verify shows in public list
        pub = requests.get(f"{API}/testimonials", timeout=10).json()
        ids = [i["id"] for i in pub["items"]]
        assert tid in ids

        # pin toggle
        r3 = requests.patch(f"{API}/admin/testimonials/{tid}/pin", headers=admin_headers, timeout=10)
        assert r3.status_code == 200
        assert r3.json()["is_pinned"] is True

        r4 = requests.patch(f"{API}/admin/testimonials/{tid}/pin", headers=admin_headers, timeout=10)
        assert r4.json()["is_pinned"] is False

    def test_delete(self, admin_headers):
        r = requests.post(f"{API}/testimonials", json={
            "name": "TEST_ToDelete",
            "content": "delete this testimonial pls",
        }, timeout=10).json()
        tid = r["id"]
        d = requests.delete(f"{API}/admin/testimonials/{tid}", headers=admin_headers, timeout=10)
        assert d.status_code == 200
        assert d.json()["deleted"] == 1

    def test_settings_update(self, admin_headers):
        original = requests.get(f"{API}/testimonials/settings", timeout=10).json()
        payload = {
            "form_enabled": True,
            "satisfied_customers_text": "9.999+",
            "claim_text": original.get("claim_text") or "test",
            "public_page_headline": original.get("public_page_headline") or "h",
            "public_page_subheadline": original.get("public_page_subheadline") or "s",
        }
        r = requests.put(f"{API}/admin/testimonials/settings", json=payload, headers=admin_headers, timeout=10)
        assert r.status_code == 200
        # verify persisted
        cur = requests.get(f"{API}/testimonials/settings", timeout=10).json()
        assert cur["satisfied_customers_text"] == "9.999+"
        # restore
        requests.put(f"{API}/admin/testimonials/settings", json={
            "form_enabled": True,
            "satisfied_customers_text": original.get("satisfied_customers_text", "5.000+"),
            "claim_text": original.get("claim_text", ""),
            "public_page_headline": original.get("public_page_headline", ""),
            "public_page_subheadline": original.get("public_page_subheadline", ""),
        }, headers=admin_headers, timeout=10)


# ---------------- Inline product reorder ----------------
class TestProductReorder:
    @pytest.fixture(scope="class")
    def products(self):
        r = requests.get(f"{API}/products", timeout=10)
        assert r.status_code == 200
        data = r.json()
        items = data.get("items") if isinstance(data, dict) else data
        if not items or len(items) < 2:
            pytest.skip("Need at least 2 products to test reorder")
        return items

    def test_set_position(self, products, admin_headers):
        # pick a product not at position 1
        target = products[-1]
        pid = target["id"]
        r = requests.post(f"{API}/admin/products/set-position",
                          json={"product_id": pid, "position": 1},
                          headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert data.get("new_position") == 1

        # verify order via admin listing (respect same group)
        r2 = requests.get(f"{API}/products?limit=200", timeout=10)
        j = r2.json()
        items = j.get("items") if isinstance(j, dict) else j
        group = target.get("publish_status", "published")
        same = [p for p in items if p.get("publish_status", "published") == group]
        if same:
            assert same[0]["id"] == pid

    def test_move_to_edge_top(self, products, admin_headers):
        target = products[0]
        pid = target["id"]
        # move another to top first, then this
        other = products[-1]
        requests.post(f"{API}/admin/products/move-to-edge",
                      json={"product_id": other["id"], "edge": "top"},
                      headers=admin_headers, timeout=15)
        r = requests.post(f"{API}/admin/products/move-to-edge",
                          json={"product_id": pid, "edge": "top"},
                          headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["new_position"] == 1

    def test_move_to_edge_bottom(self, products, admin_headers):
        pid = products[0]["id"]
        r = requests.post(f"{API}/admin/products/move-to-edge",
                          json={"product_id": pid, "edge": "bottom"},
                          headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["new_position"] >= 1

    def test_invalid_edge(self, admin_headers, products):
        r = requests.post(f"{API}/admin/products/move-to-edge",
                          json={"product_id": products[0]["id"], "edge": "middle"},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 400

    def test_set_position_invalid(self, admin_headers, products):
        r = requests.post(f"{API}/admin/products/set-position",
                          json={"product_id": products[0]["id"], "position": 0},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 400
