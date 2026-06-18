# CreativeStore — Database Export

**Database type:** MongoDB (document database). There is NO PostgreSQL/SQL — so the export is **JSON**, not a SQL dump.

## ⚠️ Important: this is the PREVIEW (dev) database
These JSON files were exported from the **preview/development** database. They do **NOT**
contain your live PRODUCTION data (`https://digital-goods-hub-14.emergent.host`).
To export the real production data, see "Production data" below.

## Files
Each file is a JSON array of documents for one collection:
- `products.json` — produk
- `orders.json` — pesanan (termasuk field Pakasir QRIS + status)
- `affiliates.json` — affiliate
- `withdrawals.json` — penarikan
- `loyalty_members.json` — member loyalty
- `checkins.json` — riwayat check-in harian
- `settings.json` — pengaturan (stats, qris_url, `bank_accounts` array, dan `admin_auth` hash password)
- `discount_codes.json` — kode diskon (jika sudah ada)
- `_manifest.json` — ringkasan jumlah dokumen + waktu export

> Catatan: `bank_accounts` BUKAN collection terpisah — tersimpan sebagai array di dalam
> dokumen `settings` (`id: "stats"`). Password admin tersimpan sebagai bcrypt hash di
> dokumen `settings` (`id: "admin_auth"`).

## Cara import ke database baru (MongoDB hosting baru)
1. Set env `MONGO_URL` & `DB_NAME` ke database baru kamu.
2. Jalankan: `python backend/import_db.py` (tambahkan `--drop` untuk menimpa data yang ada).

## Production data
Saya (AI agent) tidak punya akses ke database production Emergent. Dua opsi:
- **Self-service:** jalankan `python backend/export_db.py` di lingkungan yang `MONGO_URL`-nya menunjuk ke DB production, lalu import dengan `import_db.py`.
- **Via Emergent Support:** minta connection string / dump database production.
