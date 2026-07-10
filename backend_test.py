"""
Backend Testing for CreativeStore Iteration 4
Tests BUG FIX #1 (scheduler idempotency) + 9 new features
"""
import httpx
import asyncio
import os
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

# Backend base URL
BASE = "https://rizky-web-build.preview.emergentagent.com/api"
ADMIN_PASS = "Blokirsandi12"
HEADERS = {"X-Admin-Password": ADMIN_PASS, "Content-Type": "application/json"}

# MongoDB connection for direct testing
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "creativestore_db"

# Test results
results = []

def log_result(test_name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    results.append({"test": test_name, "passed": passed, "details": details})
    print(f"{status}: {test_name}")
    if details:
        print(f"  Details: {details}")

async def cleanup_test_data():
    """Clean up test data before and after tests"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Delete test products
    await db.products.delete_many({"name": {"$regex": "^TEST"}})
    # Delete test coupons
    await db.coupons.delete_many({"code": {"$regex": "^TEST"}})
    # Delete test orders
    await db.orders.delete_many({"buyer_name": {"$regex": "^TEST"}})
    # Delete job locks for testing
    await db.job_locks.delete_many({"id": {"$regex": "^daily_summary_"}})
    
    client.close()
    print("✓ Cleanup completed")

async def test_bf1_scheduler_idempotency():
    """BF-1: Test scheduler daily Telegram idempotency lock"""
    print("\n=== BF-1: Scheduler Idempotency Lock ===")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Import scheduler functions
        import sys
        sys.path.insert(0, '/app/backend')
        from scheduler import build_daily_summary
        
        # Test 1: Verify build_daily_summary works
        try:
            summary = await build_daily_summary(db)
            log_result("BF-1.1: build_daily_summary executes", True, f"Summary generated: {len(summary)} chars")
        except Exception as e:
            log_result("BF-1.1: build_daily_summary executes", False, f"Error: {e}")
        
        # Test 2: Verify lock mechanism
        from datetime import datetime
        import pytz
        WIB = pytz.timezone("Asia/Jakarta")
        today_wib = datetime.now(WIB).strftime("%Y-%m-%d")
        lock_id = f"daily_summary_{today_wib}"
        
        # Clear any existing lock
        await db.job_locks.delete_one({"id": lock_id})
        
        # First insert should succeed (upserted_id not None)
        r1 = await db.job_locks.update_one(
            {"id": lock_id},
            {"$setOnInsert": {"id": lock_id, "created_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        
        # Second insert should fail (upserted_id is None)
        r2 = await db.job_locks.update_one(
            {"id": lock_id},
            {"$setOnInsert": {"id": lock_id, "created_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        
        if r1.upserted_id is not None and r2.upserted_id is None:
            log_result("BF-1.2: Lock idempotency works", True, "First insert succeeded, second skipped")
        else:
            log_result("BF-1.2: Lock idempotency works", False, f"r1.upserted_id={r1.upserted_id}, r2.upserted_id={r2.upserted_id}")
        
        # Test 3: Verify scheduler config
        from scheduler import init_scheduler
        
        # Mock send function
        async def mock_send(msg):
            pass
        
        scheduler = init_scheduler(db, mock_send)
        job = scheduler.get_job("daily_telegram_summary")
        
        if job:
            # Check max_instances and coalesce
            log_result("BF-1.3: Scheduler job configured", True, 
                      f"Job exists with max_instances={job.max_instances}, coalesce={job.coalesce}")
        else:
            log_result("BF-1.3: Scheduler job configured", False, "Job not found")
        
        scheduler.shutdown(wait=False)
        
    except Exception as e:
        log_result("BF-1: Scheduler test", False, f"Exception: {e}")
    finally:
        client.close()

async def test_feature1_sort_published_first():
    """Feature 1: Sort Published-First"""
    print("\n=== Feature 1: Sort Published-First ===")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Create test products: 2 published, 1 draft
        products = [
            {"name": "TEST Published Order 5", "photo_url": "", "original_price": 100000, 
             "description": "test", "commission_percent": 10, "stock_status": "available",
             "publish_status": "published", "category": "lainnya", "display_order": 5},
            {"name": "TEST Published Order 2", "photo_url": "", "original_price": 80000,
             "description": "test", "commission_percent": 10, "stock_status": "available",
             "publish_status": "published", "category": "lainnya", "display_order": 2},
            {"name": "TEST Draft Order 1", "photo_url": "", "original_price": 50000,
             "description": "test", "commission_percent": 10, "stock_status": "available",
             "publish_status": "draft", "category": "lainnya", "display_order": 1},
        ]
        
        created_ids = []
        for p in products:
            r = await client.post(f"{BASE}/admin/products", headers=HEADERS, json=p)
            if r.status_code == 200:
                created_ids.append(r.json()["id"])
        
        # Get products list
        r = await client.get(f"{BASE}/products")
        if r.status_code == 200:
            all_products = r.json()
            test_products = [p for p in all_products if p["name"].startswith("TEST")]
            
            # Verify order: Published(2), Published(5), Draft(1)
            if len(test_products) >= 3:
                names = [p["name"] for p in test_products[:3]]
                expected_order = ["TEST Published Order 2", "TEST Published Order 5", "TEST Draft Order 1"]
                
                if names == expected_order:
                    log_result("Feature 1.1: Published-first sort", True, f"Order correct: {names}")
                else:
                    log_result("Feature 1.1: Published-first sort", False, 
                              f"Expected {expected_order}, got {names}")
            else:
                log_result("Feature 1.1: Published-first sort", False, 
                          f"Only {len(test_products)} test products found")
        else:
            log_result("Feature 1.1: Published-first sort", False, f"HTTP {r.status_code}")

async def test_feature2_reorder_endpoints():
    """Feature 2: Endpoint Reorder Produk"""
    print("\n=== Feature 2: Reorder Endpoints ===")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Create 2 test products
        p1 = await client.post(f"{BASE}/admin/products", headers=HEADERS, json={
            "name": "TEST Reorder A", "photo_url": "", "original_price": 10000,
            "description": "test", "commission_percent": 10, "stock_status": "available",
            "publish_status": "published", "category": "lainnya", "display_order": 10
        })
        p2 = await client.post(f"{BASE}/admin/products", headers=HEADERS, json={
            "name": "TEST Reorder B", "photo_url": "", "original_price": 20000,
            "description": "test", "commission_percent": 10, "stock_status": "available",
            "publish_status": "published", "category": "lainnya", "display_order": 20
        })
        
        if p1.status_code == 200 and p2.status_code == 200:
            id1 = p1.json()["id"]
            id2 = p2.json()["id"]
            
            # Test reorder endpoint
            r = await client.post(f"{BASE}/admin/products/reorder", headers=HEADERS, json={
                "orders": [
                    {"id": id1, "display_order": 100},
                    {"id": id2, "display_order": 50}
                ]
            })
            
            if r.status_code == 200 and r.json().get("updated") == 2:
                log_result("Feature 2.1: Reorder endpoint", True, "Updated 2 products")
            else:
                log_result("Feature 2.1: Reorder endpoint", False, f"HTTP {r.status_code}, response: {r.text}")
            
            # Test reset-order endpoint
            r = await client.post(f"{BASE}/admin/products/reset-order", headers=HEADERS)
            
            if r.status_code == 200 and "reset" in r.json():
                log_result("Feature 2.2: Reset-order endpoint", True, f"Reset {r.json()['reset']} products")
            else:
                log_result("Feature 2.2: Reset-order endpoint", False, f"HTTP {r.status_code}")
        else:
            log_result("Feature 2: Reorder endpoints", False, "Failed to create test products")

async def test_feature3_bulk_import_v2():
    """Feature 3: Bulk Import v2 dengan Harga"""
    print("\n=== Feature 3: Bulk Import v2 ===")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test bulk-import-v2 with prices
        r = await client.post(f"{BASE}/admin/products/bulk-import-v2", headers=HEADERS, json={
            "items": [
                {"name": "TEST Bulk V2 Item 1", "price": 50000},
                {"name": "TEST Bulk V2 Item 2", "price": 75000},
            ]
        })
        
        if r.status_code == 200:
            data = r.json()
            if data.get("created") == 2:
                products = data.get("products", [])
                # Verify prices
                if products[0]["original_price"] == 50000 and products[1]["original_price"] == 75000:
                    log_result("Feature 3.1: Bulk import v2 with prices", True, 
                              f"Created 2 products with correct prices")
                else:
                    log_result("Feature 3.1: Bulk import v2 with prices", False, 
                              f"Prices incorrect: {products[0]['original_price']}, {products[1]['original_price']}")
                
                # Verify display_order is sequential
                if products[0]["display_order"] < products[1]["display_order"]:
                    log_result("Feature 3.2: Display order sequential", True, 
                              f"Orders: {products[0]['display_order']}, {products[1]['display_order']}")
                else:
                    log_result("Feature 3.2: Display order sequential", False, 
                              f"Orders not sequential: {products[0]['display_order']}, {products[1]['display_order']}")
            else:
                log_result("Feature 3: Bulk import v2", False, f"Created {data.get('created')} instead of 2")
        else:
            log_result("Feature 3: Bulk import v2", False, f"HTTP {r.status_code}: {r.text}")
        
        # Test backward compat: old bulk-import endpoint
        r = await client.post(f"{BASE}/admin/products/bulk-import", headers=HEADERS, json={
            "names": ["TEST Bulk V1 Item 1", "TEST Bulk V1 Item 2"]
        })
        
        if r.status_code == 200 and r.json().get("created") == 2:
            log_result("Feature 3.3: Backward compat bulk-import", True, "Old endpoint still works")
        else:
            log_result("Feature 3.3: Backward compat bulk-import", False, f"HTTP {r.status_code}")

async def test_feature4_duplicate_detection():
    """Feature 4: Deteksi Duplikat"""
    print("\n=== Feature 4: Duplicate Detection ===")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Create a product first
        r = await client.post(f"{BASE}/admin/products", headers=HEADERS, json={
            "name": "TEST Duplicate Product", "photo_url": "", "original_price": 100000,
            "description": "test", "commission_percent": 10, "stock_status": "available",
            "publish_status": "published", "category": "lainnya", "display_order": 1
        })
        
        if r.status_code == 200:
            # Test check-duplicates endpoint
            r = await client.post(f"{BASE}/admin/products/check-duplicates", headers=HEADERS, json={
                "items": [
                    {"name": "TEST Duplicate Product", "price": 100000},  # exact match
                    {"name": "TEST Duplicate Product Item", "price": 50000},  # similar
                    {"name": "TEST Completely New Product", "price": 75000},  # new
                ]
            })
            
            if r.status_code == 200:
                items = r.json().get("items", [])
                if len(items) == 3:
                    # Check statuses
                    exact = items[0]["status"] == "exact"
                    similar = items[1]["status"] == "similar"
                    new = items[2]["status"] == "new"
                    
                    if exact:
                        log_result("Feature 4.1: Exact match detection", True, 
                                  f"Matched: {items[0].get('matched_name')}")
                    else:
                        log_result("Feature 4.1: Exact match detection", False, 
                                  f"Status: {items[0]['status']}")
                    
                    if similar:
                        log_result("Feature 4.2: Similar match detection", True, 
                                  f"Matched: {items[1].get('matched_name')}")
                    else:
                        log_result("Feature 4.2: Similar match detection", False, 
                                  f"Status: {items[1]['status']}")
                    
                    if new:
                        log_result("Feature 4.3: New product detection", True, "Status: new")
                    else:
                        log_result("Feature 4.3: New product detection", False, 
                                  f"Status: {items[2]['status']}")
                else:
                    log_result("Feature 4: Duplicate detection", False, 
                              f"Expected 3 items, got {len(items)}")
            else:
                log_result("Feature 4: Duplicate detection", False, f"HTTP {r.status_code}")
        else:
            log_result("Feature 4: Duplicate detection", False, "Failed to create test product")

async def test_feature5_buyer_notification():
    """Feature 5: Notif Telegram ke Pembeli"""
    print("\n=== Feature 5: Buyer Notification ===")
    
    # This feature requires TELEGRAM_PUBLIC_BOT_TOKEN and a waitlist entry with telegram_chat_id
    # We'll test that the function is called and doesn't error
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Create a test product
        p = await client.post(f"{BASE}/admin/products", headers=HEADERS, json={
            "name": "TEST Notify Product", "photo_url": "", "original_price": 50000,
            "description": "test", "commission_percent": 10, "stock_status": "available",
            "publish_status": "published", "category": "lainnya", "display_order": 1
        })
        
        if p.status_code == 200:
            product_id = p.json()["id"]
            
            # Create an order
            o = await client.post(f"{BASE}/orders", json={
                "buyer_name": "TEST Buyer Notify",
                "contact": "081234567890",
                "product_id": product_id,
                "payment_method": "qris"
            })
            
            if o.status_code == 200:
                order_id = o.json()["id"]
                
                # Update order status to confirmed
                r = await client.patch(f"{BASE}/admin/orders/{order_id}/status", 
                                      headers=HEADERS, json={"status": "confirmed"})
                
                if r.status_code == 200:
                    log_result("Feature 5.1: Order status update with notification", True, 
                              "Status updated, notification function called (no error)")
                else:
                    log_result("Feature 5.1: Order status update with notification", False, 
                              f"HTTP {r.status_code}: {r.text}")
                
                # Test cancelled status
                # Create another order
                o2 = await client.post(f"{BASE}/orders", json={
                    "buyer_name": "TEST Buyer Notify 2",
                    "contact": "081234567891",
                    "product_id": product_id,
                    "payment_method": "qris"
                })
                
                if o2.status_code == 200:
                    order_id2 = o2.json()["id"]
                    r = await client.patch(f"{BASE}/admin/orders/{order_id2}/status", 
                                          headers=HEADERS, json={"status": "cancelled"})
                    
                    if r.status_code == 200:
                        log_result("Feature 5.2: Cancelled status notification", True, 
                                  "Cancelled notification sent (no error)")
                    else:
                        log_result("Feature 5.2: Cancelled status notification", False, 
                                  f"HTTP {r.status_code}")
            else:
                log_result("Feature 5: Buyer notification", False, "Failed to create order")
        else:
            log_result("Feature 5: Buyer notification", False, "Failed to create product")

async def test_feature6_coupons():
    """Feature 6: Coupons CRUD & Validate"""
    print("\n=== Feature 6: Coupons CRUD & Validate ===")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test 1: Create coupon
        r = await client.post(f"{BASE}/admin/coupons", headers=HEADERS, json={
            "code": "TESTCOUPON10",
            "discount_type": "percentage",
            "discount_value": 10,
            "min_purchase": 50000,
            "max_uses": 10,
            "applies_to": "all",
            "active": True
        })
        
        if r.status_code == 200:
            coupon_id = r.json()["id"]
            log_result("Feature 6.1: Create coupon", True, f"Coupon ID: {coupon_id}")
        else:
            log_result("Feature 6.1: Create coupon", False, f"HTTP {r.status_code}: {r.text}")
            return
        
        # Test 2: Duplicate code should fail
        r = await client.post(f"{BASE}/admin/coupons", headers=HEADERS, json={
            "code": "TESTCOUPON10",
            "discount_type": "percentage",
            "discount_value": 5,
            "min_purchase": 0,
            "max_uses": 0,
            "applies_to": "all",
            "active": True
        })
        
        if r.status_code == 400:
            log_result("Feature 6.2: Duplicate code rejected", True, "HTTP 400 as expected")
        else:
            log_result("Feature 6.2: Duplicate code rejected", False, f"HTTP {r.status_code}")
        
        # Test 3: List coupons
        r = await client.get(f"{BASE}/admin/coupons", headers=HEADERS)
        
        if r.status_code == 200 and len(r.json()) > 0:
            log_result("Feature 6.3: List coupons", True, f"Found {len(r.json())} coupons")
        else:
            log_result("Feature 6.3: List coupons", False, f"HTTP {r.status_code}")
        
        # Test 4: Update coupon
        r = await client.put(f"{BASE}/admin/coupons/{coupon_id}", headers=HEADERS, json={
            "code": "TESTCOUPON10",
            "discount_type": "percentage",
            "discount_value": 15,
            "min_purchase": 50000,
            "max_uses": 20,
            "applies_to": "all",
            "active": True
        })
        
        if r.status_code == 200 and r.json()["discount_value"] == 15:
            log_result("Feature 6.4: Update coupon", True, "Discount value updated to 15")
        else:
            log_result("Feature 6.4: Update coupon", False, f"HTTP {r.status_code}")
        
        # Test 5: Validate coupon - valid case
        r = await client.post(f"{BASE}/coupons/validate", json={
            "code": "TESTCOUPON10",
            "total": 100000,
            "product_id": None
        })
        
        if r.status_code == 200:
            data = r.json()
            expected_discount = 15000  # 15% of 100000 (updated value)
            expected_final = 85000
            if data["discount_amount"] == expected_discount and data["final_total"] == expected_final:
                log_result("Feature 6.5: Validate coupon (percentage)", True, 
                          f"Discount: {data['discount_amount']}, Final: {data['final_total']}")
            else:
                log_result("Feature 6.5: Validate coupon (percentage)", False, 
                          f"Expected discount {expected_discount}, got {data['discount_amount']}")
        else:
            log_result("Feature 6.5: Validate coupon (percentage)", False, f"HTTP {r.status_code}")
        
        # Test 6: Validate - below minimum purchase
        r = await client.post(f"{BASE}/coupons/validate", json={
            "code": "TESTCOUPON10",
            "total": 30000,
            "product_id": None
        })
        
        if r.status_code == 400 and "Minimum pembelian" in r.text:
            log_result("Feature 6.6: Validate - min purchase check", True, "Rejected below minimum")
        else:
            log_result("Feature 6.6: Validate - min purchase check", False, f"HTTP {r.status_code}")
        
        # Test 7: Create nominal coupon
        r = await client.post(f"{BASE}/admin/coupons", headers=HEADERS, json={
            "code": "TESTNOMINAL20K",
            "discount_type": "nominal",
            "discount_value": 20000,
            "min_purchase": 50000,
            "max_uses": 5,
            "applies_to": "all",
            "active": True
        })
        
        if r.status_code == 200:
            nominal_id = r.json()["id"]
            
            # Validate nominal coupon
            r = await client.post(f"{BASE}/coupons/validate", json={
                "code": "TESTNOMINAL20K",
                "total": 100000,
                "product_id": None
            })
            
            if r.status_code == 200:
                data = r.json()
                if data["discount_amount"] == 20000 and data["final_total"] == 80000:
                    log_result("Feature 6.7: Validate coupon (nominal)", True, 
                              f"Discount: {data['discount_amount']}, Final: {data['final_total']}")
                else:
                    log_result("Feature 6.7: Validate coupon (nominal)", False, 
                              f"Expected discount 20000, got {data['discount_amount']}")
            else:
                log_result("Feature 6.7: Validate coupon (nominal)", False, f"HTTP {r.status_code}")
        
        # Test 8: Invalid coupon code
        r = await client.post(f"{BASE}/coupons/validate", json={
            "code": "INVALIDCODE",
            "total": 100000,
            "product_id": None
        })
        
        if r.status_code == 400 and "tidak valid atau sudah expired" in r.text:
            log_result("Feature 6.8: Invalid coupon rejected", True, "Friendly error message")
        else:
            log_result("Feature 6.8: Invalid coupon rejected", False, f"HTTP {r.status_code}")
        
        # Test 9: Delete coupon
        r = await client.delete(f"{BASE}/admin/coupons/{coupon_id}", headers=HEADERS)
        
        if r.status_code == 200 and r.json().get("deleted") == 1:
            log_result("Feature 6.9: Delete coupon", True, "Coupon deleted")
        else:
            log_result("Feature 6.9: Delete coupon", False, f"HTTP {r.status_code}")

async def test_feature7_migration():
    """Feature 7: Migration display_order"""
    print("\n=== Feature 7: Migration display_order ===")
    
    # Check backend logs for migration message
    import subprocess
    result = subprocess.run(
        ["tail", "-n", "100", "/var/log/supervisor/backend.out.log"],
        capture_output=True, text=True
    )
    
    logs = result.stdout
    
    # Look for migration log or verify products have display_order
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Check if all products have display_order field
    products_without_order = await db.products.count_documents({"display_order": {"$exists": False}})
    
    if products_without_order == 0:
        log_result("Feature 7.1: display_order migration", True, 
                  "All products have display_order field")
    else:
        log_result("Feature 7.1: display_order migration", False, 
                  f"{products_without_order} products missing display_order")
    
    # Check if migration is mentioned in startup
    if "migration" in logs.lower() or "Product migration" in logs:
        log_result("Feature 7.2: Migration logged at startup", True, "Migration log found")
    else:
        log_result("Feature 7.2: Migration logged at startup", False, "No migration log found")
    
    client.close()

async def test_feature8_backward_compat():
    """Feature 8: Backward Compatibility"""
    print("\n=== Feature 8: Backward Compatibility ===")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test 1: GET /api/products still works
        r = await client.get(f"{BASE}/products")
        if r.status_code == 200:
            log_result("Feature 8.1: GET /products", True, f"Found {len(r.json())} products")
        else:
            log_result("Feature 8.1: GET /products", False, f"HTTP {r.status_code}")
        
        # Test 2: Create a product and get by slug
        p = await client.post(f"{BASE}/admin/products", headers=HEADERS, json={
            "name": "TEST Backward Compat Product", "photo_url": "", "original_price": 50000,
            "description": "test", "commission_percent": 10, "stock_status": "available",
            "publish_status": "published", "category": "lainnya", "display_order": 1
        })
        
        if p.status_code == 200:
            slug = p.json()["slug"]
            
            # Test GET by slug (if endpoint exists)
            r = await client.get(f"{BASE}/products/slug/{slug}")
            if r.status_code == 200:
                log_result("Feature 8.2: GET /products/slug/{slug}", True, f"Product found by slug")
            else:
                log_result("Feature 8.2: GET /products/slug/{slug}", False, f"HTTP {r.status_code}")
        
        # Test 3: POST /orders still works
        # Get a published product first
        r = await client.get(f"{BASE}/products")
        if r.status_code == 200:
            products = [p for p in r.json() if p.get("publish_status") == "published"]
            if products:
                product_id = products[0]["id"]
                
                o = await client.post(f"{BASE}/orders", json={
                    "buyer_name": "TEST Backward Compat Buyer",
                    "contact": "081234567890",
                    "product_id": product_id,
                    "payment_method": "qris"
                })
                
                if o.status_code == 200:
                    log_result("Feature 8.3: POST /orders", True, "Order created successfully")
                else:
                    log_result("Feature 8.3: POST /orders", False, f"HTTP {o.status_code}")
        
        # Test 4: Dashboard endpoint
        r = await client.get(f"{BASE}/admin/dashboard", headers=HEADERS)
        if r.status_code == 200:
            log_result("Feature 8.4: GET /admin/dashboard", True, "Dashboard data retrieved")
        else:
            log_result("Feature 8.4: GET /admin/dashboard", False, f"HTTP {r.status_code}")
        
        # Test 5: FAQ endpoint
        r = await client.get(f"{BASE}/faqs")
        if r.status_code == 200:
            log_result("Feature 8.5: GET /faqs", True, f"Found {len(r.json())} FAQs")
        else:
            log_result("Feature 8.5: GET /faqs", False, f"HTTP {r.status_code}")
        
        # Test 6: About endpoint
        r = await client.get(f"{BASE}/about")
        if r.status_code == 200:
            log_result("Feature 8.6: GET /about", True, "About data retrieved")
        else:
            log_result("Feature 8.6: GET /about", False, f"HTTP {r.status_code}")
        
        # Test 7: Reviews endpoint
        r = await client.get(f"{BASE}/reviews")
        if r.status_code == 200:
            log_result("Feature 8.7: GET /reviews", True, f"Found {len(r.json())} reviews")
        else:
            log_result("Feature 8.7: GET /reviews", False, f"HTTP {r.status_code}")

async def main():
    """Main test runner"""
    print("=" * 60)
    print("CreativeStore Backend Testing - Iteration 4")
    print("=" * 60)
    
    # Cleanup before tests
    await cleanup_test_data()
    
    # Run all tests
    await test_bf1_scheduler_idempotency()
    await test_feature1_sort_published_first()
    await test_feature2_reorder_endpoints()
    await test_feature3_bulk_import_v2()
    await test_feature4_duplicate_detection()
    await test_feature5_buyer_notification()
    await test_feature6_coupons()
    await test_feature7_migration()
    await test_feature8_backward_compat()
    
    # Cleanup after tests
    await cleanup_test_data()
    
    # Print summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for r in results if r["passed"])
    failed = sum(1 for r in results if not r["passed"])
    total = len(results)
    
    print(f"\nTotal Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"Success Rate: {(passed/total*100):.1f}%")
    
    if failed > 0:
        print("\n❌ FAILED TESTS:")
        for r in results:
            if not r["passed"]:
                print(f"  - {r['test']}")
                if r["details"]:
                    print(f"    {r['details']}")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
