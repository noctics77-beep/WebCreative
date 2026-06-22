# Migrasi CreativeStore → Railway / MongoDB Atlas

## 📦 Isi folder ini
- `db_export_latest/` — **EXPORT DATABASE PREVIEW** (bukan production!)
  Sebagai backup awal + schema reference. 9 produk, 12 order, 2 affiliate, dll.
- `scripts/export_db.py` — Helper Python untuk export MongoDB → JSON.
  Bisa dijalankan dari mana saja yang punya akses ke `MONGO_URL`.

## 🚨 Cara dapat data PRODUCTION yang real-time
Saya (agent) hanya punya akses ke preview environment, **bukan** ke MongoDB
production (`https://creativestore.my.id`). Untuk dapat data live:

### Opsi 1 — Minta MONGO_URL production dari Emergent Support
1. Klik tombol **Support** di sidebar Emergent → minta connection string MongoDB production
2. Setelah dapat:
   ```bash
   pip install pymongo
   MONGO_URL="<prod-url>" DB_NAME="creativestore_db" \
     python3 scripts/export_db.py db_export_production
   ```
3. Hasil: `db_export_production/*.json` siap import ke Atlas/Railway

### Opsi 2 — Pakai `mongoexport` langsung
```bash
for c in products orders affiliates withdrawals loyalty_members \
         checkins checkin_log redemption_history settings wd_audit; do
  mongoexport --uri="<prod-url>" --db=creativestore_db \
              --collection="$c" --out="${c}.json" --jsonArray
done
```

## 📥 Import ke Railway / MongoDB Atlas
Setelah punya file JSON:
```bash
for f in db_export_production/*.json; do
  col=$(basename "$f" .json)
  mongoimport --uri="<atlas-or-railway-url>" --db=creativestore_db \
              --collection="$col" --file="$f" --jsonArray
done
```

## 🔧 Setelah migrasi
- Update `backend/.env` di Railway: `MONGO_URL`, `DB_NAME`, semua env lain
- Update `frontend/.env`: `REACT_APP_BACKEND_URL` ke Railway URL
- Deploy ulang
