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

### Iteration 11 (Jul 14, 2026) — AI Auto-Suggest Image Position
- [x] New endpoint `POST /api/admin/ai/suggest-image-position` — accepts image_url (external HTTP or local /api/uploads/), fetches bytes, sends to Gemini 2.5 Flash Vision, returns `{position, reason}`. Validates position against 9-value whitelist; falls back to "center center" if AI returns invalid.
- [x] `<ObjectPositionPicker>` upgraded:
  - Added **[✨ Auto AI]** + **[⟲ Reset]** buttons under 9-grid
  - Purple sparkle badge on AI-suggested cell + reason tooltip below
  - Manual click on another cell auto-clears AI badge (no confirmation)
  - Reset → sets to "center center" + clears AI state
  - Loading spinner + disabled during Gemini call (~2-3s)
  - Error handling: distinguishes "GEMINI_API_KEY belum dikonfigurasi" vs generic error
- [x] Applied to both Product form & Banner form (existing integration via `<ObjectPositionPicker>` — no changes needed there).
- [x] Verified via curl → Gemini responded with valid position + Indonesian reason. UI screenshot confirms buttons render correctly.

## Pending User Action (Iteration 11)
- 🚀 User must **Save to GitHub + Redeploy** production to apply AI feature.


### Iteration 12 (Jul 14, 2026) — Drag-and-Drop Reorder Produk
- [x] Hapus tombol ▲▼ move-up/move-down. Ganti dengan drag-and-drop via `@dnd-kit/core` + `@dnd-kit/sortable` (support touch/mobile long-press 300ms + desktop pointer 8px activation).
- [x] Icon drag handle (⋮⋮ GripVertical) di kolom paling kiri setiap baris — cursor grab, tidak konflik dengan klik edit/delete/toggle.
- [x] Visual feedback saat drag: opacity 0.5 + shadow elevation + background gold tint.
- [x] Setelah drop: optimistic UI update → `POST /admin/products/reorder` dengan renumber grup published & draft terpisah (kelipatan 10). Kalau gagal → rollback ke snapshot + error toast.
- [x] Toast sukses: "Urutan berhasil diperbarui ✓". Toast gagal: "Gagal simpan urutan, dikembalikan ke sebelumnya".
- [x] Cegah cross-status swap: kalau tarik produk Published ke area Draft (atau sebaliknya) → toast error + skip.
- [x] Pagination client-side 20 per halaman dengan nav Prev/Next + numbered buttons. Drag hanya aktif di halaman yang ditampilkan (kebal untuk 100+ produk).
- [x] Verified via curl + screenshot: drag TEST Import1 ke atas TEST Import3 → order=10 vs 20 persisted; toast tampil.

## Pending User Action (Iteration 12)
- 🚀 Save to Github + Redeploy production.

- Split `/app/backend/server.py` (~1360 lines) into `routers/orders.py`, `routers/admin.py`, `routers/exports.py`, `routers/tracking.py`, `routers/loyalty.py`
- Extract `_compute_customers()` helper to decouple from handler

## Key API Endpoints
### Public
- `GET /api/products`

### Iteration 13 (Jul 17, 2026) — 7 Feature Mega-Batch
- [x] **#1 Toggle Metode Pembayaran** — 3 flag di stats: `pay_qris_otomatis_enabled`, `pay_qris_manual_enabled`, `pay_transfer_enabled`. Admin panel Settings toggle switches (dengan konfirmasi warning saat matikan QRIS Otomatis). OrderModal filter opsi + auto-select kalau tinggal 1 + warning "Pembayaran sedang tidak tersedia" kalau semua OFF.
- [x] **#2 Auto Delivery + Stok Digital** — Collection baru `digital_stocks` (FIFO). Model Product/Variant + field `auto_delivery_enabled` & `bulk_tiers`. Endpoints: `GET/POST/DELETE /admin/digital-stocks/*`, `products-summary`. Trigger di `_settle_paid_order` + `admin_update_order_status(confirmed)` → `_auto_deliver_if_enabled` yang: (a) tarik N item FIFO, (b) save `order.digital_content`, (c) kirim via Telegram public bot ke `telegram_chat_id`, (d) low-stock alert admin jika ≤3, (e) notif "Auto Delivery Gagal!" kalau stok habis. Admin Tab baru "Stok Digital" (`DigitalStocksTab`) dengan manager dialog untuk paste bulk & hapus per item.
- [x] **#3 Multi-Quantity + Bulk Pricing Tier** — `OrderCreate.quantity` field + `_apply_bulk_price` helper (tier terbesar yang ≤qty). `bulk_tiers: [{min_qty, price}]` per variant/product. **Block form kalau qty > stok digital** (error 400). Frontend OrderModal quantity picker `[−][qty][+]` + auto-highlight tier. ProductDetail tampilkan tabel "💰 Harga Grosir" dengan persen hemat.
- [x] **#4 Lacak Pesanan tampil Data Digital** — TrackOrder & OrderModal success step tampilkan section "🎁 Produk Kamu Sudah Siap!" dengan `<pre>` monospace + tombol Salin (hanya kalau status=confirmed).
- [x] **#5 Ajakan Grup Telegram** — Settings field `telegram_group_url`. OrderModal success step: card `[💬 Gabung Grup Telegram]` tampil kalau URL diisi (bawah referral card).
- [x] **#6 PWA** — `/public/manifest.json` (theme #F5A623 + icons 192/512 auto-generated dgn PIL — logo "CS" gold circle), `/public/sw.js` (Network First API, Cache First static, offline fallback), `/public/offline.html` (branded dark navy + gold). Registration di index.html. `<InstallBanner>` component: `beforeinstallprompt` capture → tampil setelah 30s browsing → tombol Install + Nanti saja (`localStorage` dismiss).
- [x] **#7 AI Auto-Generate Deskripsi** — Endpoint `POST /admin/ai/generate-description` (Gemini 2.5 Flash + prompt CreativeStore brand tone Indonesian, 50-100 kata, 2-3 emoji, no harga). Tombol kecil ✨ Sparkle di pojok kanan atas textarea deskripsi di form produk.
- [x] Verified via curl: digital-stocks summary works, AI description generates natural Indonesian copy (200+ chars), payment flags stored. Screenshot: storefront loads clean tanpa console error, service worker registered.

## Pending User Action (Iteration 13)
- 🚀 **Save to Github + Redeploy** ke production `creativestore.my.id`
- ℹ️ Untuk fitur PWA, user perlu tes install dari browser Chrome/Edge di HP setelah redeploy

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


## Iteration 14 (Feb 2026) — Inline Reorder + Testimonial System

### Inline Product Reorder (Admin > Produk)
- Number input in "Urutan" column beside drag handle → type position number + Enter to renumber the group.
- Hover-only quick actions: "↑ Top" (Set ke Teratas) and "↓ End" (Set ke Terbawah) per row.
- Coexists with existing @dnd-kit drag-and-drop.
- Backend: `POST /api/admin/products/set-position { product_id, position }`, `POST /api/admin/products/move-to-edge { product_id, edge: 'top'|'bottom' }`.
- Renumbering keeps published group before draft group in `display_order`.

### Testimonial System
- Public page `/testimoni` — masonry grid (columns-1 sm:columns-2 lg:columns-3), stats badges (Satisfied count, Avg Rating, Total approved), submission modal.
- Submission: name (min 2), WA (optional for Verified Buyer check), product select, rating 1-5 stars, content (min 10), up to 3 photos (3MB each). Public upload endpoint `POST /api/testimonials/upload`.
- All public submissions → `status='pending'`. Admin must approve before public visibility.
- Verified Buyer auto-detected if WA matches a paid/confirmed order.
- Admin can Pin testimonials — pinned show first everywhere.
- Admin Panel > Testimoni tab with 5 sub-tabs: Menunggu Review (pending), Ditampilkan (approved), Disembunyikan (hidden), Posting Admin (admin-authored, auto-approved, up to 5 photos, badge toggles Verified Buyer / Admin Post), Settings (form_enabled toggle, satisfied_customers_text, claim_text, public_page_headline, public_page_subheadline).
- Telegram notif to admin bot when a public testimonial is submitted.
- Storefront: `TestimonialCarousel` fetches `/api/testimonials?limit=6` — falls back to static if empty.
- ProductDetail: `ProductTestimonials` fetches `/api/testimonials?product_id=X` with rating summary (count + avg).
- NavBar + Footer link to `/testimoni`.

### New API Endpoints
Public: `GET/POST /api/testimonials`, `GET /api/testimonials/settings`, `POST /api/testimonials/upload`.
Admin (X-Admin-Password): `GET/POST /api/admin/testimonials`, `GET /api/admin/testimonials/counts`, `PUT /api/admin/testimonials/settings`, `PUT/DELETE /api/admin/testimonials/{id}`, `PATCH /api/admin/testimonials/{id}/status`, `PATCH /api/admin/testimonials/{id}/pin`, `POST /api/admin/products/set-position`, `POST /api/admin/products/move-to-edge`.

### Backlog / Upcoming
- P1: Resend Email integration for Waitlist notifications (blocked pending RESEND_API_KEY from user).
- P2: Refactor `AdminPanel.jsx` (~4700 lines) → split tabs into `components/admin/` folder (start done with `TestimonialsTab.jsx`).
- P2: Split `backend/server.py` (4288 lines) into route modules (products, orders, testimonials, payments).

## Iteration 15 (Feb 2026) — Pending Reminder + QRIS Manual UX + Screenshot Instructions

### Pending Order Reminder
- APScheduler `pending_order_reminder` job runs every 15 minutes and checks pending manual-payment orders (`qris` or `transfer` methods) that have been unconfirmed longer than the configured interval.
- Settings (Admin > Settings > Reminder Order): `pending_reminder_enabled` toggle, `pending_reminder_interval_minutes` (15/30/60/120), `pending_reminder_max_count` (1/2/3/5, default 3).
- Anti-spam: per-order `admin_reminder_count` + `last_admin_reminder_at` fields on Order model; stops after max_count; auto-halts when order is confirmed/cancelled.
- Telegram admin bot receives formatted message with Order ID, buyer, product, total, method, minutes waited, and direct admin link.

### QRIS Manual UX Fixes (OrderModal)
- 10-min countdown timer above QR (`data-testid="manual-qris-countdown"`) — red when < 2min.
- Warning card `"⚠️ PENTING: Setelah scan dan bayar, klik tombol Saya Sudah Bayar..."` (`data-testid="manual-payment-warning"`).
- Big pulsing gold confirm button `"Saya Sudah Bayar ✓"` (box-shadow-only pulse, click-stable).
- Optional transfer amount input (`data-testid="transfer-amount-input"`).
- Toast reminder every 2 minutes: "Sudah bayar? Jangan lupa klik 'Saya Sudah Bayar' ya!".
- `beforeunload` browser dialog prevents accidentally closing the page.
- On timer expiry, hides QR and shows "Generate QR Baru" button (`data-testid="regenerate-qris-btn"`).
- Same UX applied for Transfer Bank flow (warning + amount + pulsing button + timer).

### Screenshot Instructions (Success Screen)
- Manual payment success shows instructions card (`data-testid="screenshot-instructions"`) with 3-step numbered list + real Order ID + "Chat Admin WhatsApp" green shortcut and "Salin Order ID" button.
- Chat admin WhatsApp link: `wa.me/{admin_whatsapp}?text=Halo admin, saya sudah bayar. Order ID saya: {order_code}`.
- Auto-paid (qris_otomatis) success shows green `auto-paid-info` card instead ("Pembayaran otomatis terkonfirmasi").
- `GET /api/config` now prefers `settings.admin_whatsapp` over env `ADMIN_WHATSAPP` (editable in Admin Settings).
- Best-effort public bot Telegram notification on order creation reminds buyer to screenshot + send Order ID to admin WA.

### Backlog / Upcoming
- P1: Resend Email integration for Waitlist notifications (blocked pending RESEND_API_KEY from user).
- P2: Split `backend/server.py` (4325 lines) into route modules (products/orders/testimonials/settings).
- P2: Split `frontend/components/OrderModal.jsx` (1187 lines) into ManualPaymentStep + SuccessCard subcomponents.

