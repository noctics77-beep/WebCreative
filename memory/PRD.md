# CreativeStore — Product Requirements Document

## Original Problem Statement
Import GitHub repo `https://github.com/noctics77-beep/WebCreative` (branch: main) and apply 5 enhancements (Bahasa Indonesia request):
1. **Setup verification** — frontend/backend dependencies & seed data.
2. **Chat Widget refactor** — switch from `EMERGENT_LLM_KEY` (Universal Key) to personal `GEMINI_API_KEY` using `google-generativeai` SDK (model `gemini-2.5-flash`). Graceful fallback "Asisten sedang offline" when key is empty.
3. **Meta Pixel** — base code + events `ViewContent`, `InitiateCheckout`, `Purchase` (Pixel ID `2203703337115796` via `REACT_APP_META_PIXEL_ID`).
4. **Google Analytics GA4** — base code + automatic pageviews + `purchase` event (Measurement ID `G-3F5MDW7N7R` via `REACT_APP_GA_MEASUREMENT_ID`).
5. **Admin Panel Dashboard** — new default tab showing order stats, revenue, active affiliates, top products, and 7-day trend chart (real DB data).

## User Persona
- **Owner/Admin** — manages products, orders, affiliates from `/admin` panel.
- **Customer** — browses storefront, opens OrderModal, pays via Pakasir/QRIS.
- **Affiliate** — logs in via Affiliate ID (`AFFXXXXX`) to track referrals & commission.

## Tech Stack
- React 18 + Tailwind CSS + Recharts (frontend)
- FastAPI + Motor async MongoDB driver (backend)
- google-generativeai SDK (Gemini 2.5 Flash) for Chat
- Meta Pixel + GA4 gtag.js for analytics
- Pakasir for QRIS payments

## Implemented Features (as of Feb 22, 2026)
- [x] Storefront with product catalog, hero, social proof badge
- [x] OrderModal flow (product details → form → payment → status polling)
- [x] Pakasir QRIS payment integration + webhook
- [x] Affiliate system (referral codes, commission, balance, withdrawal)
- [x] Daily check-in / Poin Harian loyalty
- [x] Admin Panel: Products, Orders, Affiliates CRUD
- [x] **NEW** Admin Panel Dashboard tab (default) — order stats, revenue, top products, 7-day Recharts trend
- [x] **NEW** Chat Widget powered by Gemini 2.5 Flash (`google-generativeai` SDK), graceful "Asisten sedang offline" fallback
- [x] **NEW** Meta Pixel tracking (ViewContent, InitiateCheckout, Purchase) — dedupe via sessionStorage
- [x] **NEW** GA4 tracking (pageviews, view_item, begin_checkout, purchase)
- [x] **NEW** Regression test suite (`/app/backend/tests/`) — 28/28 passing

## Verification Status (Feb 22, 2026)
- Backend pytest: **28/28 PASS** (18 regression + 10 new)
- Frontend e2e (testing_agent_v3_fork): **PASS** — tracking scripts loaded, OrderModal fires all events, ChatWidget shows fallback bubble, Admin Dashboard renders with Recharts chart.
- Reports: `/app/test_reports/iteration_2.json`, `/app/test_reports/pytest/pytest_results.xml`

## Pending / Backlog
### P1 — Awaiting user input
- 🔑 **Personal `GEMINI_API_KEY`** — currently empty in `backend/.env`; chat falls back to "Asisten sedang offline".
- 📊 **Server-side tracking** (Meta CAPI + GA4 Measurement Protocol) for manual order approvals in admin — requires Meta CAPI Access Token + GA4 API Secret.

### P2 — Code quality
- Split `/app/backend/server.py` (1055 lines) into `routers/orders.py`, `routers/admin.py`, `routers/loyalty.py`.
- Add E2E Playwright tests for admin login → dashboard → chart render.

## Key API Endpoints
- `GET /api/products` — public storefront
- `POST /api/orders` — create order
- `GET /api/orders/{order_code}` — status polling
- `POST /api/chat` — Gemini chat (with offline fallback)
- `GET /api/admin/dashboard` — admin metrics (X-Admin-Password header)
- `GET /api/affiliates` — admin only

## Environment Variables
- Backend: `MONGO_URL`, `DB_NAME`, `ADMIN_PASSWORD`, `GEMINI_API_KEY`, `PAKASIR_API_KEY`, `PAKASIR_PROJECT_SLUG`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ADMIN_WHATSAPP`
- Frontend: `REACT_APP_BACKEND_URL`, `REACT_APP_META_PIXEL_ID`, `REACT_APP_GA_MEASUREMENT_ID`
