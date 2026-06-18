"""Export all MongoDB collections to JSON files.

Usage:
    python export_db.py                 # uses MONGO_URL + DB_NAME from backend/.env
    MONGO_URL="..." DB_NAME="..." python export_db.py   # override (e.g. production)

Output: writes one <collection>.json file (array of documents) into ./db_export/
ObjectId and datetime values are converted to JSON-safe strings.
"""
import asyncio
import os
import json
from pathlib import Path
from datetime import datetime, date
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

OUT_DIR = Path(__file__).parent.parent / "db_export"


def _default(o):
    if isinstance(o, ObjectId):
        return str(o)
    if isinstance(o, (datetime, date)):
        return o.isoformat()
    return str(o)


async def main():
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    OUT_DIR.mkdir(exist_ok=True)

    collections = await db.list_collection_names()
    summary = {}
    for col in sorted(collections):
        docs = await db[col].find({}).to_list(100000)
        # Convert ObjectId _id to string id-friendly value
        for d in docs:
            if isinstance(d.get("_id"), ObjectId):
                d["_id"] = str(d["_id"])
        out_file = OUT_DIR / f"{col}.json"
        out_file.write_text(json.dumps(docs, indent=2, default=_default, ensure_ascii=False))
        summary[col] = len(docs)
        print(f"  exported {col}: {len(docs)} docs -> {out_file}")

    (OUT_DIR / "_manifest.json").write_text(
        json.dumps(
            {"database": db_name, "exported_at": datetime.utcnow().isoformat() + "Z", "collections": summary},
            indent=2,
        )
    )
    print(f"\nDone. Files in: {OUT_DIR}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
