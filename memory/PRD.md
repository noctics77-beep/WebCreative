# CreativeStore — Product Requirements Document

## Original Problem Statement
Import GitHub repo `https://github.com/noctics77-beep/WebCreative` (branch: main) and apply enhancements (Bahasa Indonesia request) on top of the existing CreativeStore digital goods marketplace.

## User Persona
- **Owner/Admin** — manages products, orders, affiliates, customers via `/admin`.
- **Customer** — browses storefront, opens OrderModal, pays via Pakasir/QRIS, tracks order on `/lacak-pesanan`.
- **Affiliate** — logs in via Affiliate ID (`AFFXXXXX`) to track referrals & commission.

## Tech Stack
- React 18 + Tailwind CSS + Recharts + Lucide icons (frontend)
- FastAPI + Motor async MongoDB driver (backend)
- google-generativeai SDK (Gemini 2.5 Flash) for Chat
- Meta Pixel + GA4 gtag.js for analytics
- Pakasir for QRIS payments
- openpyxl for XLSX exports
- APScheduler + pytz for daily 08:00 WIB Telegram summary

## Implemented Features

### Iteration 1 (Feb 22, 2026)
- [x] GitHub import + MongoDB seed
- [x] Chat Widget refactored from EMERGENT_LLM_KEY to personal `GEMINI_API_KEY` (google-generativeai SDK, gemini-2.5-flash) with graceful "Asisten sedang offline" fallback
- [x] Meta Pixel tracking (ViewContent, InitiateCheckout, Purchase) — ID `2203703337115796`
- [x] GA4 tracking (pageview, view_item, begin_checkout, purchase) — ID `G-3F5MDW7N7R`
- [x] Admin Panel Dashboard tab (default) with order stats, revenue, top products, 7-day Recharts trend
- [x] Regression suite `/app/backend/tests/test_chat_dashboard.py` — 28/28 PASS

### Iteration 2 (Feb 22, 2026)
- [x] **Export Laporan** (Dashboard) — period (today/week/month/custom) × format (XLSX/CSV). XLSX has bold gold-on-navy header + auto column width
- [x] **Daily Telegram Summary** — APScheduler cron at 08:00 Asia/Jakarta with yesterday's metrics (orders, omzet, top product, new affiliates, WD pending). Manual trigger endpoint `/api/admin/telegram/daily-summary/test`
- [x] **Public Order Tracking** `/lacak-pesanan` — lookup by Order ID OR WA number (with normalization 0/62 prefix). Multi-result list. Link added to NavBar + Footer
- [x] **Customers Tab** (Admin) — orders grouped by WA, search by name/WA, click row → detail dialog with order history, XLSX/CSV export
- [x] **Affiliate Export** — per-row Export button + bulk "Export Semua Affiliate". XLSX = 1 sheet per affiliate, CSV = combined with affiliate column. Period: all/month/custom. Summary header block (Name, Code, Total Sales, Komisi, Saldo, Withdrawn)
- [x] Cosmetic fix: removed duplicate "Rp Rp" prefix on Dashboard stat cards
- [x] Regression suite `/app/backend/tests/test_new_features.py` — 26/26 PASS

### Iteration 3+ (Feb 24 – Jul 11, 2026)
- [x] Product Statuses (PUBLISHED/DRAFT) + Telegram Waitlist for draft products
- [x] Categories, Product Badges, Storefront Search Bar
- [x] Gemini 2.5 Flash "Generate Product Info" (admin)
- [x] Product Detail Pages (`/produk/:slug`) + Stock Limits
- [x] Rating & Reviews (customer + admin moderation)
- [x] Share Buttons + Referral CTA card
- [x] FAQ page, About Us page, Footer redesign, Trust Badges
- [x] Fix duplicate Telegram daily summary via `db.job_locks` idempotency lock
- [x] Admin Product Reordering (drag/index) + Bulk Import v2 (price parsing + duplicate detection)
- [x] Telegram order status notifications to buyers (public webhook)
- [x] Coupon/Voucher CRUD (percentage & nominal) + validation endpoint
- [x] Welcome Popup + Responsive 2/3/4 column grid
- [x] Chat widget CSS fix (no overlap with Made-with-Emergent watermark)

### Iteration 7 (Jul 11, 2026) — Coupon + Loyalty Wiring
- [x] **Unified discount field in OrderModal** — single "Kode Voucher / Diskon" field with sequential validation:
  1. Try `POST /api/coupons/validate` (admin coupon)
  2. Fallback to `GET /api/discount/validate/{code}` (loyalty code)
  3. Both fail → exact copy: *"Kode tidak valid atau sudah expired ya, Sobat Creative 😢"*
- [x] Dual discount display: (a) green badge with "hemat Rp X" + Hapus button, and (b) subtotal → diskon → total price breakdown row
- [x] "Hapus" button to clear applied discount and reset total
- [x] Loading state on "Pakai" button (spinner while validating)
- [x] Guarded empty photo_url in OrderModal to avoid React img warning
- [x] Frontend testing_agent_v3_fork iteration_6: **100% PASS (6/6 scenarios)**


### Iteration 8 (Jul 11, 2026) — 7-Feature Batch Drop
- [x] **#1 Fix Foto Produk URL** — added `_normalize_photo_url()` on backend (auto-convert Google Drive share-link → `lh3.googleusercontent.com/d/{id}`, Dropbox `?dl=0` → `?raw=1`). Frontend PhotoPicker: red "Gagal Memuat" preview state + helper tip about direct image URLs. Also fixed React empty-src warning in ProductCard.
- [x] **#2 History Pembeli** — renamed Customers tab; added tier badges (Baru/Reguler/Setia), favorite product, first_order_at, last_order_at, order timeline in detail dialog, per-customer CSV export.
- [x] **#3 Notif Stok Menipis** — `_check_and_notify_low_stock()` triggered on paid orders (both Pakasir auto & admin manual confirm). Idempotent via `low_stock_alerted_at` / `out_of_stock_alerted_at` fields, reset when admin refills stock >5.
- [x] **#4 Slider/Banner Promo** — Banner CRUD API + Admin "Banner Promo" tab with grid preview, active toggle, drag-order. Storefront `<BannerSlider>` with auto-play 4s, arrows, dots, swipe support, infinite loop. Default banner seeded on startup.
- [x] **#5 Halaman Konfirmasi Visual** — `canvas-confetti` burst on success step + big animated checkmark + order details card (Order ID with copy, product, total, method) + "Lacak Pesanan" / "Kembali ke Toko" CTA + existing referral card.
- [x] **#6 Mode Maintenance** — `/api/maintenance` GET (public) + `/api/admin/maintenance` PUT. `<MaintenanceGate>` wraps app, blocks all non-`/admin` routes when enabled.
- [x] **#7 Statistik Pengunjung** — `/api/track/page-view` (bot-UA filtered) + `/api/admin/visitor-stats` (today/week/month + 7-day chart + top pages + top products via /produk/:slug tracking). Dashboard `VisitorStatsPanel`.
- [x] Bonus UX: WelcomePopup skipped on /admin & /lacak-pesanan; fixed React empty-src warning.
- [x] Testing_agent_v3_fork iteration_7: **Backend 93% (14/15), Frontend 100%**.

## Pending User Action
- 🚀 User must **Save to GitHub + Redeploy** production (`creativestore.my.id`) to apply all changes.


## Verification Status (Feb 22, 2026)
- Backend pytest: **54/54 PASS** (28 prior + 26 new)
- Frontend e2e (testing_agent_v3_fork iteration_3): **100% PASS** after Rp Rp fix
- Reports: `/app/test_reports/iteration_2.json`, `/app/test_reports/iteration_3.json`


### Iteration 9 (Jul 11, 2026) — Product Variants + Banner Countdown
- [x] **#1 Product Variants System** — new `product_variants` collection with fields (id, product_id, name, price, discount_price, is_recommended, is_best_value, display_order, is_active).
  - `Product.has_variants` flag toggles variant mode; when active, `original_price` = min(variant effective prices) auto-synced.
  - Endpoints: `GET /products/{id}/variants` (public), `GET/PUT /admin/products/{id}/variants` (bulk replace with exclusivity enforcement + orphan cleanup).
  - `POST /orders` accepts `variant_id`; when omitted but product has variants, auto-selects `is_recommended` (or first active). Telegram notif to admin includes `Produk: Name (Variant)`.
  - `GET /products` enriches has_variants products with `starting_price` + `variant_preview` (max 3 names) + `variant_count`.
  - Admin ProductFormDialog: new "Variasi Produk" section with inline row editor, exclusivity toggles (⭐ Paling Dipilih / 🔥 Best Value), ▲▼ reorder, add/remove rows.
  - Storefront ProductCard: shows "Mulai dari Rp X" + chips `[7 Hari] [30 Hari] [90 Hari]` (max 3 + "+X lagi").
  - ProductDetail: "Pilih Variasi" pill picker with smooth transition + savings display + auto-select recommended.
  - OrderModal: accepts `variant` prop; shows "Variasi: NAME" pill in ringkasan; sends `variant_id` in POST.
  - Bulk Import v2: parser upgraded to support `Name :: v1=15000 | v2=40000* | v3=50000**` (* = paling_dipilih, ** = best_value, `50000>40000` = normal>diskon). Legacy flat format `Name | 45000` still works (backward compatible).
- [x] **#2 Banner Countdown Timer** — Banner model extended with `linked_coupon_code` + `expires_at`. `GET /banners` auto-fills expires_at from linked coupon's valid_until when banner.expires_at is empty (manual override honored).
  - Admin BannerFormDialog: coupon dropdown (`bf-linked-coupon`) + manual datetime picker (`bf-expires-at`).
  - New `<BannerCountdown>` component — simple digital-clock style with tick animation, format JJ:MM:DD (Jam:Menit:Detik), shows "Promo Telah Berakhir" state.
  - Banner CTA click → sessionStorage.cs_pending_coupon = code; OrderModal reads on open → auto-fills discount_code field + toast prompt.
- [x] Bonus: guarded empty photo_url in ProductDetail img fallback (React empty-src warning fix).
- [x] Testing_agent_v3_fork iteration_8: **Backend 100% (8/8 pytest), Frontend 100%** — 13/13 parser assertions PASS, all UI flows verified end-to-end.

## Pending User Action (Iteration 9)
- 🚀 User must **Save to GitHub + Redeploy** production (`creativestore.my.id`) to apply Variants + Countdown features.

### Iteration 10 (Jul 14, 2026) — 3 Bug Fixes
- [x] **#1 Image Position Control** — new `image_position` field (default "center center") on Product + Banner. New `<ObjectPositionPicker>` component (3×3 grid selector + live preview). Applied via CSS `object-position` inline style in ProductCard, ProductDetail, BannerSlider, and admin BannersTab grid preview.
- [x] **#2 Reorder Bug** — Root cause: new products all defaulted to `display_order=999`, causing swap to be a no-op. Fixed: auto-assign incremental `display_order = last_valid + 10` at product create (excluding stale 999 defaults). Frontend `movePriority` now renumbers the ENTIRE sorted list (`(idx + 1) * 10`) instead of pair-swap, so it's collision-proof.
- [x] **#3 Scheduler Duplicate (Robust Fix)** — Root cause: gunicorn multi-worker + upsert on non-unique field could race. Fixed with **atomic `insert_one({_id: lock_id})`** — MongoDB's `_id` uniqueness invariant guarantees only 1 worker succeeds; others get `DuplicateKeyError` and skip. Removed rollback-on-send-failure (better to miss 1 day than dupe). Verified via 5-concurrent-workers simulation: only 1 acquires lock. ✅
- [x] Testing self-verified via curl: reorder swap (B=10, A=20) confirmed persisted + reflected in `/api/products`. Screenshot verifies ObjectPositionPicker UI.

## Pending User Action (Iteration 10)
- 🚀 User must **Save to GitHub + Redeploy** production (`creativestore.my.id`) to apply all fixes.
- ⚠️ Bug #3 fix is CRITICAL for production — the scheduler race can only be fixed by the redeploy.


## Pending / Backlog
### P1 — Awaiting user input
- 🔑 Personal `GEMINI_API_KEY` (chat still falls back to "Asisten sedang offline")
- 📊 Server-side tracking (Meta CAPI + GA4 Measurement Protocol) for manual order approvals — requires CAPI Access Token + GA4 API Secret

### P2 — Code quality
- Split `/app/backend/server.py` (~1360 lines) into `routers/orders.py`, `routers/admin.py`, `routers/exports.py`, `routers/tracking.py`, `routers/loyalty.py`
- Extract `_compute_customers()` helper to decouple from handler

## Key API Endpoints
### Public
- `GET /api/products`
- `POST /api/orders`, `GET /api/orders/{code}/status`
- `POST /api/chat` (Gemini)
- `GET /api/track-order?order_code=…|contact=…` (NEW — public)

### Admin (X-Admin-Password header)
- `GET /api/admin/dashboard`
- `GET /api/admin/orders`, `PATCH /api/admin/orders/{id}/status`
- `GET /api/admin/affiliates`, `GET /api/admin/withdrawals`
- `GET /api/admin/customers` (NEW)
- `GET /api/admin/customers/{wa}/orders` (NEW)
- `GET /api/admin/export/orders?period=&fmt=&start=&end=` (NEW)
- `GET /api/admin/export/customers?fmt=` (NEW)
- `GET /api/admin/export/affiliates?period=&fmt=` (NEW — bulk)
- `GET /api/admin/export/affiliates/{code}?period=&fmt=` (NEW — single)
- `POST /api/admin/telegram/daily-summary/test` (NEW)

## Environment Variables
- Backend: `MONGO_URL`, `DB_NAME`, `ADMIN_PASSWORD`, `GEMINI_API_KEY`, `PAKASIR_API_KEY`, `PAKASIR_PROJECT_SLUG`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ADMIN_WHATSAPP`
- Frontend: `REACT_APP_BACKEND_URL`, `REACT_APP_META_PIXEL_ID`, `REACT_APP_GA_MEASUREMENT_ID`
