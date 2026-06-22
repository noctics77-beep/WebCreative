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

## Verification Status (Feb 22, 2026)
- Backend pytest: **54/54 PASS** (28 prior + 26 new)
- Frontend e2e (testing_agent_v3_fork iteration_3): **100% PASS** after Rp Rp fix
- Reports: `/app/test_reports/iteration_2.json`, `/app/test_reports/iteration_3.json`

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
