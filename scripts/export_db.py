#!/usr/bin/env python3
"""
CreativeStore — DB Export Helper
=================================
Run this script ANYWHERE you have access to the MongoDB connection string
(production, preview, atau lokal). Output: file JSON per-collection siap
di-import ke MongoDB Atlas / Railway / lokal lain.

USAGE:
  pip install pymongo
  MONGO_URL="<paste connection string here>" DB_NAME="creativestore_db" \\
    python3 export_db.py [output_dir]

OUTPUT: <output_dir>/<collection>.json  (default ./db_export_<timestamp>/)
IMPORT later:
  mongoimport --uri="<atlas_url>" --collection=products \\
              --file=products.json --jsonArray
"""
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from bson import ObjectId
from pymongo import MongoClient

COLLECTIONS = [
    "products",
    "orders",
    "affiliates",
    "withdrawals",
    "loyalty_members",
    "checkins",
    "checkin_log",
    "redemption_history",
    "settings",
    "wd_audit",
]


def default(o):
    if isinstance(o, ObjectId):
        return str(o)
    if isinstance(o, datetime):
        return o.isoformat()
    raise TypeError(f"Cannot serialize {type(o)}")


def main():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "creativestore_db")
    if not mongo_url:
        print("ERROR: set MONGO_URL env var first", file=sys.stderr)
        sys.exit(1)

    out_dir = Path(sys.argv[1] if len(sys.argv) > 1 else
                   f"db_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    out_dir.mkdir(parents=True, exist_ok=True)

    client = MongoClient(mongo_url, serverSelectionTimeoutMS=10000)
    db = client[db_name]
    # Ping
    client.admin.command("ping")
    print(f"Connected to {db_name}")

    existing = set(db.list_collection_names())
    for col in COLLECTIONS:
        if col not in existing:
            (out_dir / f"{col}.json").write_text("[]", encoding="utf-8")
            print(f"  {col}: 0 (collection not present)")
            continue
        docs = list(db[col].find({}))
        path = out_dir / f"{col}.json"
        path.write_text(json.dumps(docs, default=default, ensure_ascii=False, indent=2),
                        encoding="utf-8")
        print(f"  {col}: {len(docs)} records -> {path.name}")

    # Bonus: also export any extra collections we didn't list
    for col in sorted(existing - set(COLLECTIONS)):
        if col.startswith("system."):
            continue
        docs = list(db[col].find({}))
        path = out_dir / f"{col}.json"
        path.write_text(json.dumps(docs, default=default, ensure_ascii=False, indent=2),
                        encoding="utf-8")
        print(f"  {col}: {len(docs)} records (extra) -> {path.name}")

    print(f"\nDone. Files saved to: {out_dir.resolve()}")


if __name__ == "__main__":
    main()
