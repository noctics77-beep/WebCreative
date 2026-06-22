"""Backend tests for new features: /api/chat fallback and /api/admin/dashboard."""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://repo-bootstrap-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_PWD = "Blokirsandi12"
ADMIN_HEADERS = {"X-Admin-Password": ADMIN_PWD, "Content-Type": "application/json"}


# ---------- Chat fallback ----------
def test_chat_offline_fallback():
    """When GEMINI_API_KEY is empty, /api/chat must return 200 with offline fallback."""
    r = requests.post(f"{API}/chat", json={"message": "halo", "session_id": "test-1"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "reply" in data
    assert "session_id" in data
    # offline indicator should be true; reply should mention being offline
    assert data.get("offline") is True
    assert "offline" in data["reply"].lower() or "Asisten" in data["reply"]

def test_chat_without_session_id():
    r = requests.post(f"{API}/chat", json={"message": "test"})
    assert r.status_code == 200
    assert r.json().get("session_id")


# ---------- Admin Dashboard ----------
def test_dashboard_requires_admin():
    r = requests.get(f"{API}/admin/dashboard")
    assert r.status_code == 401

def test_dashboard_wrong_password():
    r = requests.get(f"{API}/admin/dashboard", headers={"X-Admin-Password": "wrong"})
    assert r.status_code == 401

def test_dashboard_returns_all_keys():
    r = requests.get(f"{API}/admin/dashboard", headers=ADMIN_HEADERS)
    assert r.status_code == 200, r.text
    data = r.json()
    required_keys = [
        "today", "week", "month", "active_affiliates",
        "top_products", "trend_7d",
        "total_commission_paid", "total_commission_earned"
    ]
    for k in required_keys:
        assert k in data, f"Missing key {k}"

def test_dashboard_period_structure():
    r = requests.get(f"{API}/admin/dashboard", headers=ADMIN_HEADERS)
    data = r.json()
    for period in ["today", "week", "month"]:
        assert "count" in data[period]
        assert "revenue" in data[period]
        assert isinstance(data[period]["count"], int)
        assert isinstance(data[period]["revenue"], (int, float))

def test_dashboard_trend_7d_has_7_entries():
    r = requests.get(f"{API}/admin/dashboard", headers=ADMIN_HEADERS)
    data = r.json()
    trend = data["trend_7d"]
    assert isinstance(trend, list)
    assert len(trend) == 7
    for entry in trend:
        assert "date" in entry
        assert "orders" in entry
        assert "revenue" in entry
        assert isinstance(entry["orders"], int)

def test_dashboard_trend_dates_sequential():
    r = requests.get(f"{API}/admin/dashboard", headers=ADMIN_HEADERS)
    data = r.json()
    dates = [e["date"] for e in data["trend_7d"]]
    # Should be in ascending order (oldest first)
    assert dates == sorted(dates), f"Trend dates not ascending: {dates}"

def test_dashboard_top_products_sorted():
    r = requests.get(f"{API}/admin/dashboard", headers=ADMIN_HEADERS)
    data = r.json()
    tp = data["top_products"]
    assert isinstance(tp, list)
    # Each entry has the right shape
    for p in tp:
        assert "product_id" in p
        assert "name" in p
        assert "orders" in p
        assert "revenue" in p
    # Sorted by orders desc
    if len(tp) >= 2:
        for i in range(len(tp) - 1):
            assert tp[i]["orders"] >= tp[i + 1]["orders"]

def test_dashboard_active_affiliates_is_int():
    r = requests.get(f"{API}/admin/dashboard", headers=ADMIN_HEADERS)
    data = r.json()
    assert isinstance(data["active_affiliates"], int)
    assert data["active_affiliates"] >= 0
