"""Import JSON files (produced by export_db.py) into a MongoDB database.

Usage (point env vars at your NEW database first):
    MONGO_URL="mongodb+srv://..." DB_NAME="creativestore_db" python import_db.py

Reads every <collection>.json file in ./db_export/ and inserts the documents.
By default it SKIPS collections that already contain data (safe). Pass --drop to
wipe each target collection before importing.
"""
import asyncio
import os
import sys
import json
from pathlib import Path
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

IN_DIR = Path(__file__).parent.parent / "db_export"
DROP = "--drop" in sys.argv


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    for f in sorted(IN_DIR.glob("*.json")):
        if f.name.startswith("_"):
            continue
        col = f.stem
        docs = json.loads(f.read_text())
        if not docs:
            print(f"  {col}: empty, skipped")
            continue
        # Drop bson _id strings so MongoDB regenerates ObjectIds (app uses its own `id` field)
        for d in docs:
            d.pop("_id", None)
        if DROP:
            await db[col].delete_many({})
        elif await db[col].count_documents({}) > 0:
            print(f"  {col}: target not empty, skipped (use --drop to overwrite)")
            continue
        await db[col].insert_many(docs)
        print(f"  {col}: imported {len(docs)} docs")

    print(f"\nDone at {datetime.utcnow().isoformat()}Z")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
