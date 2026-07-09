"""
Comprehensive Backend Testing for CreativeStore - Iteration 3
Tests all new features: publish_status, categories, waitlist, notifications, etc.
"""
import httpx
import asyncio
import json
from typing import Optional, Dict, Any, List

# Backend URL from frontend .env
BASE_URL = "https://rizky-web-build.preview.emergentagent.com/api"
ADMIN_PASSWORD = "Blokirsandi12"

# Test data storage
test_data = {
    "products": [],
    "categories": [],
    "waitlist": [],
}


class TestResult:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
    
    def add_pass(self, test_name: str, detail: str = ""):
        self.passed.append(f"✅ {test_name}" + (f": {detail}" if detail else ""))
    
    def add_fail(self, test_name: str, detail: str):
        self.failed.append(f"❌ {test_name}: {detail}")
    
    def add_warning(self, test_name: str, detail: str):
        self.warnings.append(f"⚠️  {test_name}: {detail}")
    
    def print_summary(self):
        print("\n" + "="*80)
        print("BACKEND TEST SUMMARY")
        print("="*80)
        
        if self.failed:
            print("\n🔴 FAILED TESTS:")
            for f in self.failed:
                print(f"  {f}")
        
        if self.warnings:
            print("\n🟡 WARNINGS:")
            for w in self.warnings:
                print(f"  {w}")
        
        if self.passed:
            print("\n🟢 PASSED TESTS:")
            for p in self.passed:
                print(f"  {p}")
        
        print("\n" + "="*80)
        print(f"Total: {len(self.passed)} passed, {len(self.failed)} failed, {len(self.warnings)} warnings")
        print("="*80 + "\n")


result = TestResult()


async def api_call(
    method: str,
    endpoint: str,
    data: Optional[Dict] = None,
    headers: Optional[Dict] = None,
    expect_status: int = 200,
) -> tuple[int, Any]:
    """Make API call and return (status_code, response_data)"""
    url = f"{BASE_URL}{endpoint}"
    hdrs = headers or {}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            if method == "GET":
                resp = await client.get(url, headers=hdrs)
            elif method == "POST":
                resp = await client.post(url, json=data, headers=hdrs)
            elif method == "PUT":
                resp = await client.put(url, json=data, headers=hdrs)
            elif method == "PATCH":
                resp = await client.patch(url, json=data, headers=hdrs)
            elif method == "DELETE":
                resp = await client.delete(url, headers=hdrs)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            try:
                return resp.status_code, resp.json()
            except:
                return resp.status_code, resp.text
        except Exception as e:
            return 0, str(e)


def admin_headers() -> Dict[str, str]:
    return {"X-Admin-Password": ADMIN_PASSWORD}


# =============================================================================
# TEST 1: CATEGORIES - Seed & CRUD
# =============================================================================

async def test_categories_seed():
    """Test that 7 default categories are seeded on startup"""
    print("\n📦 Testing Categories Seed...")
    
    status, data = await api_call("GET", "/categories")
    
    if status != 200:
        result.add_fail("Categories Seed", f"GET /categories returned {status}")
        return
    
    if not isinstance(data, list):
        result.add_fail("Categories Seed", "Response is not a list")
        return
    
    if len(data) < 7:
        result.add_fail("Categories Seed", f"Expected 7 categories, got {len(data)}")
        return
    
    # Check for required slugs
    slugs = [c.get("slug") for c in data]
    required = ["ai-tools", "video-kreatif", "vpn-keamanan", "produktivitas", "hiburan", "email-akun", "lainnya"]
    missing = [s for s in required if s not in slugs]
    
    if missing:
        result.add_fail("Categories Seed", f"Missing categories: {missing}")
        return
    
    # Check sorted by order
    orders = [c.get("order", 999) for c in data]
    if orders != sorted(orders):
        result.add_warning("Categories Seed", "Categories not sorted by order field")
    
    # Store for later tests
    test_data["categories"] = data
    result.add_pass("Categories Seed", f"Found {len(data)} categories, all required slugs present")


async def test_categories_crud():
    """Test category CRUD operations"""
    print("\n📦 Testing Categories CRUD...")
    
    # CREATE - new category
    new_cat = {
        "slug": "test-kategori-baru",
        "name": "Test Kategori Baru",
        "icon": "sparkles",
        "order": 50
    }
    
    status, data = await api_call("POST", "/admin/categories", new_cat, admin_headers())
    
    if status != 200:
        result.add_fail("Category CREATE", f"POST returned {status}: {data}")
        return
    
    if not data.get("id"):
        result.add_fail("Category CREATE", "No ID in response")
        return
    
    cat_id = data["id"]
    test_data["categories"].append(data)
    result.add_pass("Category CREATE", f"Created category {cat_id}")
    
    # CREATE duplicate slug - should fail
    status, data = await api_call("POST", "/admin/categories", new_cat, admin_headers())
    if status != 400:
        result.add_fail("Category CREATE Duplicate", f"Expected 400, got {status}")
    else:
        result.add_pass("Category CREATE Duplicate", "Correctly rejected duplicate slug")
    
    # UPDATE - rename slug
    updated = {
        "slug": "test-kategori-updated",
        "name": "Test Kategori Updated",
        "icon": "zap",
        "order": 51
    }
    
    status, data = await api_call("PUT", f"/admin/categories/{cat_id}", updated, admin_headers())
    
    if status != 200:
        result.add_fail("Category UPDATE", f"PUT returned {status}: {data}")
    else:
        result.add_pass("Category UPDATE", "Updated category successfully")
    
    # DELETE protected category (lainnya) - should fail
    lainnya = next((c for c in test_data["categories"] if c.get("slug") == "lainnya"), None)
    if lainnya:
        status, data = await api_call("DELETE", f"/admin/categories/{lainnya['id']}", headers=admin_headers())
        if status != 400:
            result.add_fail("Category DELETE Protected", f"Expected 400, got {status}")
        else:
            result.add_pass("Category DELETE Protected", "Correctly protected 'lainnya' from deletion")
    
    # DELETE test category
    status, data = await api_call("DELETE", f"/admin/categories/{cat_id}", headers=admin_headers())
    if status != 200:
        result.add_fail("Category DELETE", f"DELETE returned {status}: {data}")
    else:
        result.add_pass("Category DELETE", "Deleted test category successfully")


# =============================================================================
# TEST 2: PRODUCTS - publish_status, category, badges
# =============================================================================

async def test_product_fields():
    """Test product model with new fields: publish_status, category, badges"""
    print("\n📦 Testing Product Fields...")
    
    # CREATE product with all new fields
    product = {
        "name": "Test Product - ChatGPT Plus",
        "photo_url": "https://example.com/test.jpg",
        "original_price": 150000,
        "discount_price": 120000,
        "discount_active": True,
        "description": "Test product untuk validasi field baru",
        "commission_percent": 15.0,
        "stock_status": "available",
        "monthly_sold": 0,
        "publish_status": "draft",
        "category": "ai-tools",
        "is_bestseller": True,
        "is_promo": True
    }
    
    status, data = await api_call("POST", "/admin/products", product, admin_headers())
    
    if status != 200:
        result.add_fail("Product CREATE with new fields", f"POST returned {status}: {data}")
        return
    
    if not data.get("id"):
        result.add_fail("Product CREATE with new fields", "No ID in response")
        return
    
    # Verify all fields
    if data.get("publish_status") != "draft":
        result.add_fail("Product publish_status", f"Expected 'draft', got '{data.get('publish_status')}'")
    else:
        result.add_pass("Product publish_status", "Default 'draft' applied correctly")
    
    if data.get("category") != "ai-tools":
        result.add_fail("Product category", f"Expected 'ai-tools', got '{data.get('category')}'")
    else:
        result.add_pass("Product category", "Category field set correctly")
    
    if not data.get("is_bestseller"):
        result.add_fail("Product is_bestseller", "Badge not set")
    else:
        result.add_pass("Product is_bestseller", "Bestseller badge set correctly")
    
    if not data.get("is_promo"):
        result.add_fail("Product is_promo", "Badge not set")
    else:
        result.add_pass("Product is_promo", "Promo badge set correctly")
    
    test_data["products"].append(data)
    
    # CREATE product without optional fields - should use defaults
    minimal = {
        "name": "Test Product Minimal",
        "photo_url": "",
        "original_price": 50000,
        "description": "Minimal product"
    }
    
    status, data = await api_call("POST", "/admin/products", minimal, admin_headers())
    
    if status != 200:
        result.add_fail("Product CREATE minimal", f"POST returned {status}: {data}")
    else:
        if data.get("publish_status") != "draft":
            result.add_fail("Product default publish_status", f"Expected 'draft', got '{data.get('publish_status')}'")
        else:
            result.add_pass("Product default publish_status", "Default 'draft' applied")
        
        if data.get("category") != "lainnya":
            result.add_fail("Product default category", f"Expected 'lainnya', got '{data.get('category')}'")
        else:
            result.add_pass("Product default category", "Default 'lainnya' applied")
        
        test_data["products"].append(data)


async def test_bulk_import_draft():
    """Test bulk import - all products should be draft"""
    print("\n📦 Testing Bulk Import (draft status)...")
    
    payload = {
        "names": [
            "Bulk Product 1 - Canva Pro",
            "Bulk Product 2 - Netflix Premium",
            "Bulk Product 3 - Spotify Family"
        ]
    }
    
    status, data = await api_call("POST", "/admin/products/bulk-import", payload, admin_headers())
    
    if status != 200:
        result.add_fail("Bulk Import", f"POST returned {status}: {data}")
        return
    
    if data.get("created") != 3:
        result.add_fail("Bulk Import", f"Expected 3 products, got {data.get('created')}")
        return
    
    products = data.get("products", [])
    all_draft = all(p.get("publish_status") == "draft" for p in products)
    
    if not all_draft:
        result.add_fail("Bulk Import draft status", "Not all products are draft")
    else:
        result.add_pass("Bulk Import draft status", "All bulk imported products are draft")
    
    test_data["products"].extend(products)


# =============================================================================
# TEST 3: ORDER BLOCKING for DRAFT products
# =============================================================================

async def test_order_blocking_draft():
    """Test that orders for draft products are blocked"""
    print("\n📦 Testing Order Blocking for Draft Products...")
    
    # Find a draft product
    draft_product = next((p for p in test_data["products"] if p.get("publish_status") == "draft"), None)
    
    if not draft_product:
        result.add_warning("Order Blocking Draft", "No draft product found to test")
        return
    
    order = {
        "buyer_name": "Test Buyer",
        "contact": "081234567890",
        "product_id": draft_product["id"],
        "payment_method": "qris"
    }
    
    status, data = await api_call("POST", "/orders", order)
    
    if status != 400:
        result.add_fail("Order Blocking Draft", f"Expected 400, got {status}")
    else:
        if "Coming Soon" in str(data) or "belum tersedia" in str(data):
            result.add_pass("Order Blocking Draft", "Draft product order correctly blocked with proper message")
        else:
            result.add_fail("Order Blocking Draft", f"Blocked but wrong message: {data}")


async def test_order_published_product():
    """Test that orders for published products work"""
    print("\n📦 Testing Order for Published Product...")
    
    # First, publish a product
    if not test_data["products"]:
        result.add_warning("Order Published Product", "No products to test")
        return
    
    product = test_data["products"][0]
    
    # Update to published
    update = {
        "name": product["name"],
        "photo_url": product.get("photo_url", ""),
        "original_price": product["original_price"],
        "description": product.get("description", ""),
        "publish_status": "published",
        "category": product.get("category", "lainnya"),
        "stock_status": "available"
    }
    
    status, data = await api_call("PUT", f"/admin/products/{product['id']}", update, admin_headers())
    
    if status != 200:
        result.add_fail("Publish Product for Order Test", f"PUT returned {status}")
        return
    
    # Now try to order
    order = {
        "buyer_name": "Test Buyer Published",
        "contact": "081234567891",
        "product_id": product["id"],
        "payment_method": "qris"
    }
    
    status, data = await api_call("POST", "/orders", order)
    
    if status != 200:
        result.add_fail("Order Published Product", f"POST returned {status}: {data}")
    else:
        if data.get("order_code"):
            result.add_pass("Order Published Product", f"Order created successfully: {data['order_code']}")
        else:
            result.add_fail("Order Published Product", "No order_code in response")


# =============================================================================
# TEST 4: STOREFRONT FILTERING (show_coming_soon)
# =============================================================================

async def test_storefront_filtering():
    """Test storefront respects show_coming_soon setting"""
    print("\n📦 Testing Storefront Filtering (show_coming_soon)...")
    
    # First, get current products
    status, all_products = await api_call("GET", "/products")
    
    if status != 200:
        result.add_fail("Storefront GET products", f"GET returned {status}")
        return
    
    draft_count = sum(1 for p in all_products if p.get("publish_status") == "draft")
    published_count = sum(1 for p in all_products if p.get("publish_status") == "published")
    
    result.add_pass("Storefront GET products (default)", f"Got {len(all_products)} products ({published_count} published, {draft_count} draft)")
    
    # Set show_coming_soon to False
    settings = {
        "products_sold": "243+",
        "active_partners": "89+",
        "rating": "4.9/5",
        "online_base": 50,
        "live_feed_enabled": True,
        "loyalty_discount_percent": 10,
        "live_feed_names": ["Test"],
        "qris_url": "",
        "bank_accounts": [],
        "show_coming_soon": False
    }
    
    status, data = await api_call("PUT", "/admin/stats", settings, admin_headers())
    
    if status != 200:
        result.add_fail("Update show_coming_soon", f"PUT returned {status}")
        return
    
    # Get products again - should only show published
    status, filtered_products = await api_call("GET", "/products")
    
    if status != 200:
        result.add_fail("Storefront GET products (filtered)", f"GET returned {status}")
        return
    
    has_draft = any(p.get("publish_status") == "draft" for p in filtered_products)
    
    if has_draft:
        result.add_fail("Storefront Filtering", "Draft products still visible when show_coming_soon=False")
    else:
        result.add_pass("Storefront Filtering", f"Only published products shown ({len(filtered_products)} products)")
    
    # Reset to True
    settings["show_coming_soon"] = True
    await api_call("PUT", "/admin/stats", settings, admin_headers())


# =============================================================================
# TEST 5: PUBLISH TOGGLE & BULK PUBLISH
# =============================================================================

async def test_publish_toggle():
    """Test single product publish status toggle"""
    print("\n📦 Testing Publish Status Toggle...")
    
    # Find a draft product
    draft = next((p for p in test_data["products"] if p.get("publish_status") == "draft"), None)
    
    if not draft:
        result.add_warning("Publish Toggle", "No draft product to test")
        return
    
    # Toggle to published
    payload = {"publish_status": "published"}
    status, data = await api_call("PATCH", f"/admin/products/{draft['id']}/publish-status", payload, admin_headers())
    
    if status != 200:
        result.add_fail("Publish Toggle", f"PATCH returned {status}: {data}")
        return
    
    if data.get("publish_status") != "published":
        result.add_fail("Publish Toggle", f"Status not updated, got {data.get('publish_status')}")
    else:
        result.add_pass("Publish Toggle", "Successfully toggled draft → published")
    
    # Toggle back to draft
    payload = {"publish_status": "draft"}
    status, data = await api_call("PATCH", f"/admin/products/{draft['id']}/publish-status", payload, admin_headers())
    
    if status != 200:
        result.add_fail("Publish Toggle (revert)", f"PATCH returned {status}")
    else:
        result.add_pass("Publish Toggle (revert)", "Successfully toggled published → draft")
    
    # Test invalid status
    payload = {"publish_status": "archived"}
    status, data = await api_call("PATCH", f"/admin/products/{draft['id']}/publish-status", payload, admin_headers())
    
    if status != 400:
        result.add_fail("Publish Toggle Invalid", f"Expected 400, got {status}")
    else:
        result.add_pass("Publish Toggle Invalid", "Correctly rejected invalid status")


async def test_bulk_publish():
    """Test bulk publish endpoint"""
    print("\n📦 Testing Bulk Publish...")
    
    # Get draft products
    drafts = [p for p in test_data["products"] if p.get("publish_status") == "draft"][:3]
    
    if len(drafts) < 2:
        result.add_warning("Bulk Publish", "Not enough draft products to test")
        return
    
    ids = [p["id"] for p in drafts]
    payload = {
        "ids": ids,
        "publish_status": "published"
    }
    
    status, data = await api_call("POST", "/admin/products/bulk-publish", payload, admin_headers())
    
    if status != 200:
        result.add_fail("Bulk Publish", f"POST returned {status}: {data}")
        return
    
    if data.get("updated") != len(ids):
        result.add_fail("Bulk Publish", f"Expected {len(ids)} updated, got {data.get('updated')}")
    else:
        result.add_pass("Bulk Publish", f"Successfully published {data['updated']} products")
    
    # Test invalid status
    payload["publish_status"] = "invalid"
    status, data = await api_call("POST", "/admin/products/bulk-publish", payload, admin_headers())
    
    if status != 400:
        result.add_fail("Bulk Publish Invalid", f"Expected 400, got {status}")
    else:
        result.add_pass("Bulk Publish Invalid", "Correctly rejected invalid status")


# =============================================================================
# TEST 6: WAITLIST CRUD & Validation
# =============================================================================

async def test_waitlist_validation():
    """Test waitlist soft validation"""
    print("\n📦 Testing Waitlist Validation...")
    
    if not test_data["products"]:
        result.add_warning("Waitlist Validation", "No products to test")
        return
    
    product = test_data["products"][0]
    
    # Test 1: No contact at all - should fail
    payload = {
        "nama": "Test User",
        "produk_id": product["id"]
    }
    
    status, data = await api_call("POST", "/waitlist", payload)
    
    if status != 400:
        result.add_fail("Waitlist No Contact", f"Expected 400, got {status}")
    else:
        if "salah satu kontak" in str(data).lower() or "isi" in str(data).lower():
            result.add_pass("Waitlist No Contact", "Correctly rejected with friendly message")
        else:
            result.add_warning("Waitlist No Contact", f"Blocked but message could be friendlier: {data}")
    
    # Test 2: With WhatsApp only - should succeed
    payload = {
        "nama": "Test User WA",
        "whatsapp_telegram": "081234567890",
        "produk_id": product["id"]
    }
    
    status, data = await api_call("POST", "/waitlist", payload)
    
    if status != 200:
        result.add_fail("Waitlist with WA", f"POST returned {status}: {data}")
    else:
        if data.get("id"):
            test_data["waitlist"].append({"id": data["id"]})
            result.add_pass("Waitlist with WA", "Successfully created with WA only")
        else:
            result.add_fail("Waitlist with WA", "No ID in response")
    
    # Test 3: With Email only - should succeed
    payload = {
        "nama": "Test User Email",
        "email": "test@example.com",
        "produk_id": product["id"]
    }
    
    status, data = await api_call("POST", "/waitlist", payload)
    
    if status != 200:
        result.add_fail("Waitlist with Email", f"POST returned {status}: {data}")
    else:
        if data.get("id"):
            test_data["waitlist"].append({"id": data["id"]})
            result.add_pass("Waitlist with Email", "Successfully created with Email only")
        else:
            result.add_fail("Waitlist with Email", "No ID in response")
    
    # Test 4: Invalid product - should fail
    payload = {
        "nama": "Test User",
        "email": "test@example.com",
        "produk_id": "invalid-product-id"
    }
    
    status, data = await api_call("POST", "/waitlist", payload)
    
    if status != 404:
        result.add_fail("Waitlist Invalid Product", f"Expected 404, got {status}")
    else:
        result.add_pass("Waitlist Invalid Product", "Correctly rejected invalid product")


async def test_waitlist_admin():
    """Test admin waitlist endpoints"""
    print("\n📦 Testing Waitlist Admin Endpoints...")
    
    # GET all waitlist
    status, data = await api_call("GET", "/admin/waitlist", headers=admin_headers())
    
    if status != 200:
        result.add_fail("Waitlist GET all", f"GET returned {status}")
        return
    
    if not isinstance(data, list):
        result.add_fail("Waitlist GET all", "Response is not a list")
        return
    
    result.add_pass("Waitlist GET all", f"Retrieved {len(data)} waitlist entries")
    
    # GET filtered by product
    if test_data["products"]:
        product_id = test_data["products"][0]["id"]
        status, data = await api_call("GET", f"/admin/waitlist?product_id={product_id}", headers=admin_headers())
        
        if status != 200:
            result.add_fail("Waitlist GET filtered", f"GET returned {status}")
        else:
            result.add_pass("Waitlist GET filtered", f"Retrieved {len(data)} entries for product")
    
    # DELETE waitlist entry
    if test_data["waitlist"]:
        wid = test_data["waitlist"][0]["id"]
        status, data = await api_call("DELETE", f"/admin/waitlist/{wid}", headers=admin_headers())
        
        if status != 200:
            result.add_fail("Waitlist DELETE", f"DELETE returned {status}")
        else:
            result.add_pass("Waitlist DELETE", "Successfully deleted waitlist entry")


async def test_waitlist_export():
    """Test waitlist export (XLSX/CSV)"""
    print("\n📦 Testing Waitlist Export...")
    
    # XLSX export
    status, data = await api_call("GET", "/admin/waitlist/export?fmt=xlsx", headers=admin_headers())
    
    if status != 200:
        result.add_fail("Waitlist Export XLSX", f"GET returned {status}")
    else:
        # Check if response is binary (XLSX)
        if isinstance(data, (bytes, str)):
            result.add_pass("Waitlist Export XLSX", "XLSX export returned data")
        else:
            result.add_fail("Waitlist Export XLSX", "Response is not binary data")
    
    # CSV export
    status, data = await api_call("GET", "/admin/waitlist/export?fmt=csv", headers=admin_headers())
    
    if status != 200:
        result.add_fail("Waitlist Export CSV", f"GET returned {status}")
    else:
        result.add_pass("Waitlist Export CSV", "CSV export returned data")


# =============================================================================
# TEST 7: GENERATE INFO PRODUK (Gemini)
# =============================================================================

async def test_generate_info_no_key():
    """Test generate-info without GEMINI_API_KEY"""
    print("\n📦 Testing Generate Info (no API key)...")
    
    status, data = await api_call("POST", "/admin/generate-info", headers=admin_headers())
    
    if status != 400:
        result.add_fail("Generate Info No Key", f"Expected 400, got {status}")
    else:
        if "GEMINI_API_KEY" in str(data):
            result.add_pass("Generate Info No Key", "Correctly returned error about missing API key")
        else:
            result.add_fail("Generate Info No Key", f"Error message unclear: {data}")


# =============================================================================
# TEST 8: TELEGRAM PUBLIC WEBHOOK
# =============================================================================

async def test_telegram_public_webhook():
    """Test public telegram webhook without token"""
    print("\n📦 Testing Telegram Public Webhook...")
    
    webhook_payload = {
        "message": {
            "chat": {"id": 123456},
            "text": "/start"
        }
    }
    
    status, data = await api_call("POST", "/telegram/public-webhook", webhook_payload)
    
    if status != 200:
        result.add_fail("Telegram Public Webhook", f"POST returned {status}")
        return
    
    if not isinstance(data, dict):
        result.add_fail("Telegram Public Webhook", "Response is not a dict")
        return
    
    if data.get("ok") == False and data.get("reason") == "bot_not_configured":
        result.add_pass("Telegram Public Webhook", "Correctly handled missing bot token")
    else:
        result.add_warning("Telegram Public Webhook", f"Unexpected response: {data}")


# =============================================================================
# TEST 9: INTEGRATION STATUS
# =============================================================================

async def test_integration_status():
    """Test integration status endpoint"""
    print("\n📦 Testing Integration Status...")
    
    status, data = await api_call("GET", "/admin/integration-status", headers=admin_headers())
    
    if status != 200:
        result.add_fail("Integration Status", f"GET returned {status}")
        return
    
    required_keys = ["telegram_admin", "telegram_public", "resend_email", "gemini", "pakasir"]
    missing = [k for k in required_keys if k not in data]
    
    if missing:
        result.add_fail("Integration Status", f"Missing keys: {missing}")
        return
    
    # Check values
    checks = []
    if data.get("telegram_admin"):
        checks.append("Telegram Admin")
    if data.get("telegram_public"):
        checks.append("Telegram Public")
    if data.get("resend_email"):
        checks.append("Resend Email")
    if data.get("gemini"):
        checks.append("Gemini")
    if data.get("pakasir"):
        checks.append("Pakasir")
    
    result.add_pass("Integration Status", f"Retrieved status. Configured: {', '.join(checks) if checks else 'None'}")


# =============================================================================
# TEST 10: BACKWARD COMPATIBILITY
# =============================================================================

async def test_backward_compatibility():
    """Test that old endpoints still work"""
    print("\n📦 Testing Backward Compatibility...")
    
    # Dashboard
    status, data = await api_call("GET", "/admin/dashboard", headers=admin_headers())
    if status != 200:
        result.add_fail("Backward Compat: Dashboard", f"GET returned {status}")
    else:
        result.add_pass("Backward Compat: Dashboard", "Dashboard endpoint working")
    
    # Orders
    status, data = await api_call("GET", "/admin/orders", headers=admin_headers())
    if status != 200:
        result.add_fail("Backward Compat: Orders", f"GET returned {status}")
    else:
        result.add_pass("Backward Compat: Orders", "Orders endpoint working")
    
    # Affiliates
    status, data = await api_call("GET", "/admin/affiliates", headers=admin_headers())
    if status != 200:
        result.add_fail("Backward Compat: Affiliates", f"GET returned {status}")
    else:
        result.add_pass("Backward Compat: Affiliates", "Affiliates endpoint working")
    
    # Stats
    status, data = await api_call("GET", "/stats")
    if status != 200:
        result.add_fail("Backward Compat: Stats", f"GET returned {status}")
    else:
        result.add_pass("Backward Compat: Stats", "Stats endpoint working")


# =============================================================================
# CLEANUP
# =============================================================================

async def cleanup():
    """Clean up test data"""
    print("\n🧹 Cleaning up test data...")
    
    # Delete test products
    for product in test_data["products"]:
        await api_call("DELETE", f"/admin/products/{product['id']}", headers=admin_headers())
    
    # Delete test waitlist entries
    for waitlist in test_data["waitlist"]:
        await api_call("DELETE", f"/admin/waitlist/{waitlist['id']}", headers=admin_headers())
    
    print("✅ Cleanup complete")


# =============================================================================
# MAIN TEST RUNNER
# =============================================================================

async def run_all_tests():
    """Run all backend tests"""
    print("\n" + "="*80)
    print("CREATIVESTORE BACKEND TESTING - ITERATION 3")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Admin Password: {'*' * len(ADMIN_PASSWORD)}")
    print("="*80)
    
    try:
        # Test sequence
        await test_categories_seed()
        await test_categories_crud()
        
        await test_product_fields()
        await test_bulk_import_draft()
        
        await test_order_blocking_draft()
        await test_order_published_product()
        
        await test_storefront_filtering()
        
        await test_publish_toggle()
        await test_bulk_publish()
        
        await test_waitlist_validation()
        await test_waitlist_admin()
        await test_waitlist_export()
        
        await test_generate_info_no_key()
        await test_telegram_public_webhook()
        await test_integration_status()
        
        await test_backward_compatibility()
        
    finally:
        await cleanup()
        result.print_summary()


if __name__ == "__main__":
    asyncio.run(run_all_tests())
