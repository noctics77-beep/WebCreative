# CreativeStore — PRD

## Original Problem Statement
Full-stack "CreativeStore" web app — Indonesian-language digital-goods storefront with an Affiliate & Reseller partnership program. Dark navy (#0f1117) + gold (#F5A623) premium theme. Single-page app with routing, mobile responsive. No login on storefront/partnership pages, Affiliate logs in by Affiliate ID, Admin panel password protected.

## User Choices Captured
- Product images: external URL only
- Notifications: Telegram bot (token & chat id provided)
- Admin WhatsApp: 6287741449684
- Admin password: `Blokirsandi12`
- Affiliate login: by Affiliate ID only
- Logo: custom uploaded by user (gold "CA" mark + "Access • Premium • Trusted" tagline)

## Architecture
- Backend: FastAPI + MongoDB (Motor), httpx for Telegram, all routes under `/api`
- Frontend: React (CRA) + React Router + Shadcn UI + Sonner + Tailwind, fonts Outfit + Manrope
- Models: products, orders, affiliates, withdrawals (UUID `id` field, no ObjectId leak)

## Implemented (Feb 2026 — Day 1)
- Storefront `/` — hero, 6 seeded products, discount badges, order modal with QRIS/Transfer choice
- Referral tracking via `?ref=AFFXXXXX` URL param → captured in order, banner shown in modal
- Partnership `/partnership` — Affiliate registration form (auto-generates AFFXXXXX + referral link) and Reseller WhatsApp redirect to 6287741449684
- Affiliate Dashboard `/affiliate` — login by ID, shows balance + total earned + total withdrawn, sales history, withdrawal history, request WD form
- Admin Panel `/admin` — password protected (env), 4 tabs: Products (CRUD with discount toggle, commission %, stock), Orders (confirm = auto pay commission, cancel), Affiliates list, Withdrawals (approve = increment total_withdrawn, reject = refund balance)
- Telegram notification on new order, new affiliate, new WD request
- All copy in Bahasa Indonesia
- Tested: 18/18 backend pytest pass; frontend critical flows verified

## Backlog (P0 / P1 / P2)
- P1: Sales analytics dashboard for admin (charts of orders/commission per day)
- P1: Email/Telegram OTP for affiliate login (instead of plain ID) for security
- P1: Bulk product import via CSV
- P2: Storefront search + category filter
- P2: Affiliate leaderboard for gamification
- P2: Payment gateway integration (real QRIS/Midtrans) instead of manual confirmation
- P2: Product detail page with full description + screenshots gallery

## Next Tasks
- Real payment gateway integration (Midtrans/Xendit)
- Image upload (object storage) instead of URL-only
- Email receipt to buyer

## Pakasir Automated QRIS (Jun 18, 2026 — DONE)
- New payment method `qris_otomatis` alongside QRIS Manual & Transfer Bank.
- Backend `/app/backend/pakasir.py`: create_qris, get_transaction (authoritative verification), cancel_transaction, qr_to_data_uri (qrcode lib).
- `POST /api/orders` with `qris_otomatis` → calls Pakasir `transactioncreate/qris` (LIVE/production project), stores qr string/total/fee, sets 15-min `expires_at`, returns base64 QR image.
- `GET /api/orders/{order_code}/status` → polled by frontend; verifies via Pakasir transactiondetail, settles on "completed", auto-expires after 15 min (cancels Pakasir txn, no reuse).
- `POST /api/pakasir/webhook` → re-verifies via transactiondetail before settling (webhook is unsigned per docs).
- `_settle_paid_order()` → idempotent: marks confirmed + pays affiliate commission once + Telegram "Lunas - Terverifikasi Otomatis". Unit tested in `tests/test_pakasir_settle.py`.
- Frontend `OrderModal.jsx`: dynamic QR display, 15-min countdown, 4s status polling, expired/new-order UI, auto success screen.
- WEBHOOK URL to register in Pakasir dashboard (Edit Proyek): `{APP_URL}/api/pakasir/webhook` (use the DEPLOYED url, not preview).
- Tested: real Pakasir API create + status (curl), settlement idempotency (pytest), frontend QR/countdown (screenshot e2e). Could NOT simulate real payment (project is in production mode, simulation disabled).
