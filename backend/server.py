from fastapi import FastAPI, APIRouter, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
import string
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
ADMIN_WHATSAPP = os.environ.get("ADMIN_WHATSAPP", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

app = FastAPI()
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)


# ---------- Helpers ----------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def gen_order_code():
    return "ORD" + "".join(random.choices(string.digits, k=6))


def gen_affiliate_code():
    return "AFF" + "".join(random.choices(string.ascii_uppercase + string.digits, k=5))


async def send_telegram(message: str):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10.0) as cli:
            await cli.post(
                url,
                json={
                    "chat_id": TELEGRAM_CHAT_ID,
                    "text": message,
                    "parse_mode": "HTML",
                },
            )
    except Exception as e:
        logger.error(f"Telegram send failed: {e}")


def verify_admin(x_admin_password: Optional[str]):
    if not x_admin_password or x_admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Password admin salah")


# ---------- Models ----------
class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    photo_url: str
    original_price: float
    discount_price: Optional[float] = None
    discount_active: bool = False
    description: str
    commission_percent: float = 10.0
    stock_status: str = "available"  # available | unavailable
    monthly_sold: int = 0
    created_at: str = Field(default_factory=now_iso)


class ProductCreate(BaseModel):
    name: str
    photo_url: str
    original_price: float
    discount_price: Optional[float] = None
    discount_active: bool = False
    description: str
    commission_percent: float = 10.0
    stock_status: str = "available"
    monthly_sold: int = 0


class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_code: str
    buyer_name: str
    contact: str
    product_id: str
    product_name: str
    product_price: float
    payment_method: str  # qris | transfer
    referral_affiliate_code: Optional[str] = None
    status: str = "pending"  # pending | confirmed | cancelled
    commission_amount: float = 0.0
    created_at: str = Field(default_factory=now_iso)


class OrderCreate(BaseModel):
    buyer_name: str
    contact: str
    product_id: str
    payment_method: str
    referral_affiliate_code: Optional[str] = None
    discount_code: Optional[str] = None


class Affiliate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    affiliate_code: str
    name: str
    contact: str
    balance: float = 0.0
    total_earned: float = 0.0
    total_withdrawn: float = 0.0
    created_at: str = Field(default_factory=now_iso)


class AffiliateCreate(BaseModel):
    name: str
    contact: str


class Withdrawal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    affiliate_id: str
    affiliate_code: str
    affiliate_name: str
    amount: float
    method: str
    account_number: str
    status: str = "pending"  # pending | approved | rejected
    created_at: str = Field(default_factory=now_iso)


class WithdrawalCreate(BaseModel):
    affiliate_code: str
    amount: float
    method: str
    account_number: str


class AdminLogin(BaseModel):
    password: str


class StatusUpdate(BaseModel):
    status: str


# ---------- Public: Products ----------
@api_router.get("/products")
async def list_products():
    products = await db.products.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return products


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    return p


# ---------- Public: Config ----------
@api_router.get("/config")
async def get_config():
    return {"admin_whatsapp": ADMIN_WHATSAPP}


# ---------- Public: Stats / Settings ----------
DEFAULT_STATS = {
    "products_sold": "243+",
    "active_partners": "89+",
    "rating": "4.9/5",
    "online_base": 50,
    "live_feed_enabled": True,
    "live_feed_names": [
        "Andi", "Budi", "Cinta", "Dewi", "Eka", "Fajar", "Gita",
        "Hadi", "Indra", "Joko", "Kirana", "Lutfi", "Maya", "Nanda",
        "Oka", "Putra", "Rina", "Sari", "Tio", "Umar", "Vina",
        "Wahyu", "Yanto", "Zaki", "Bagas", "Citra", "Doni",
    ],
}


@api_router.get("/stats")
async def get_stats():
    doc = await db.settings.find_one({"id": "stats"}, {"_id": 0})
    if not doc:
        return DEFAULT_STATS
    return {k: doc.get(k, v) for k, v in DEFAULT_STATS.items()}


class StatsUpdate(BaseModel):
    products_sold: str
    active_partners: str
    rating: str
    online_base: int = 50
    live_feed_enabled: bool = True
    live_feed_names: List[str] = []


@api_router.put("/admin/stats")
async def admin_update_stats(payload: StatsUpdate, x_admin_password: Optional[str] = Header(None)):
    verify_admin(x_admin_password)
    data = {"id": "stats", **payload.model_dump()}
    await db.settings.update_one({"id": "stats"}, {"$set": data}, upsert=True)
    return {k: data[k] for k in DEFAULT_STATS.keys()}


# ---------- Public: Orders ----------
@api_router.post("/orders")
async def create_order(payload: OrderCreate):
    product = await db.products.find_one({"id": payload.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Produk tidak ditemukan")
    if product.get("stock_status") != "available":
        raise HTTPException(400, "Produk sedang tidak tersedia")

    price = (
        product["discount_price"]
        if product.get("discount_active") and product.get("discount_price")
        else product["original_price"]
    )

    # Apply loyalty discount code (10% off)
    if payload.discount_code:
        code = payload.discount_code.strip().upper()
        code_doc = await db.discount_codes.find_one({"code": code, "used": False}, {"_id": 0})
        if code_doc:
            price = round(price * (1 - code_doc["percentage"] / 100), 2)
            await db.discount_codes.update_one({"code": code}, {"$set": {"used": True, "used_at": now_iso()}})

    referral = payload.referral_affiliate_code
    if referral:
        aff = await db.affiliates.find_one({"affiliate_code": referral}, {"_id": 0})
        if not aff:
            referral = None  # invalid ref ignored

    commission = round(price * (product.get("commission_percent", 10) / 100), 2) if referral else 0.0

    order = Order(
        order_code=gen_order_code(),
        buyer_name=payload.buyer_name,
        contact=payload.contact,
        product_id=product["id"],
        product_name=product["name"],
        product_price=price,
        payment_method=payload.payment_method,
        referral_affiliate_code=referral,
        commission_amount=commission,
    )
    await db.orders.insert_one(order.model_dump())

    msg = (
        f"<b>🛒 Pesanan Baru</b>\n\n"
        f"<b>Order:</b> {order.order_code}\n"
        f"<b>Nama:</b> {order.buyer_name}\n"
        f"<b>Kontak:</b> {order.contact}\n"
        f"<b>Produk:</b> {order.product_name}\n"
        f"<b>Harga:</b> Rp {int(price):,}\n"
        f"<b>Pembayaran:</b> {order.payment_method.upper()}\n"
        f"<b>Referral:</b> {referral or '-'}"
    )
    await send_telegram(msg)
    return {"order_code": order.order_code, "id": order.id}


# ---------- Public: Affiliates ----------
@api_router.post("/affiliates")
async def register_affiliate(payload: AffiliateCreate):
    code = gen_affiliate_code()
    while await db.affiliates.find_one({"affiliate_code": code}):
        code = gen_affiliate_code()
    aff = Affiliate(affiliate_code=code, name=payload.name, contact=payload.contact)
    await db.affiliates.insert_one(aff.model_dump())

    await send_telegram(
        f"<b>🤝 Affiliate Baru</b>\n\nKode: <b>{aff.affiliate_code}</b>\nNama: {aff.name}\nKontak: {aff.contact}"
    )
    return {"affiliate_code": aff.affiliate_code, "id": aff.id, "name": aff.name}


@api_router.get("/affiliates/{affiliate_code}")
async def get_affiliate_dashboard(affiliate_code: str):
    aff = await db.affiliates.find_one({"affiliate_code": affiliate_code}, {"_id": 0})
    if not aff:
        raise HTTPException(404, "Affiliate ID tidak ditemukan")
    orders = (
        await db.orders.find({"referral_affiliate_code": affiliate_code}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(500)
    )
    withdrawals = (
        await db.withdrawals.find({"affiliate_code": affiliate_code}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(500)
    )
    return {"affiliate": aff, "orders": orders, "withdrawals": withdrawals}


# ---------- Public: Withdrawals ----------
@api_router.post("/withdrawals")
async def request_withdrawal(payload: WithdrawalCreate):
    aff = await db.affiliates.find_one({"affiliate_code": payload.affiliate_code}, {"_id": 0})
    if not aff:
        raise HTTPException(404, "Affiliate tidak ditemukan")
    if payload.amount <= 0:
        raise HTTPException(400, "Nominal harus lebih dari 0")
    if payload.amount > aff["balance"]:
        raise HTTPException(400, "Saldo tidak mencukupi")

    wd = Withdrawal(
        affiliate_id=aff["id"],
        affiliate_code=aff["affiliate_code"],
        affiliate_name=aff["name"],
        amount=payload.amount,
        method=payload.method,
        account_number=payload.account_number,
    )
    await db.withdrawals.insert_one(wd.model_dump())
    # hold balance
    await db.affiliates.update_one(
        {"affiliate_code": payload.affiliate_code},
        {"$inc": {"balance": -payload.amount}},
    )
    await send_telegram(
        f"<b>💸 Permintaan WD</b>\n\nAffiliate: {aff['name']} ({aff['affiliate_code']})\nJumlah: Rp {int(payload.amount):,}\nMetode: {payload.method}\nRekening: {payload.account_number}"
    )
    return {"id": wd.id, "status": wd.status}


# ---------- Admin ----------
@api_router.post("/admin/login")
async def admin_login(payload: AdminLogin):
    if payload.password != ADMIN_PASSWORD:
        raise HTTPException(401, "Password salah")
    return {"ok": True}


@api_router.post("/admin/products")
async def admin_create_product(payload: ProductCreate, x_admin_password: Optional[str] = Header(None)):
    verify_admin(x_admin_password)
    p = Product(**payload.model_dump())
    await db.products.insert_one(p.model_dump())
    return p.model_dump()


@api_router.put("/admin/products/{product_id}")
async def admin_update_product(product_id: str, payload: ProductCreate, x_admin_password: Optional[str] = Header(None)):
    verify_admin(x_admin_password)
    await db.products.update_one({"id": product_id}, {"$set": payload.model_dump()})
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    return p


@api_router.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, x_admin_password: Optional[str] = Header(None)):
    verify_admin(x_admin_password)
    r = await db.products.delete_one({"id": product_id})
    return {"deleted": r.deleted_count}


@api_router.get("/admin/orders")
async def admin_list_orders(x_admin_password: Optional[str] = Header(None)):
    verify_admin(x_admin_password)
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api_router.patch("/admin/orders/{order_id}/status")
async def admin_update_order_status(order_id: str, payload: StatusUpdate, x_admin_password: Optional[str] = Header(None)):
    verify_admin(x_admin_password)
    if payload.status not in ("confirmed", "cancelled"):
        raise HTTPException(400, "Status tidak valid")
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order tidak ditemukan")
    if order["status"] != "pending":
        raise HTTPException(400, "Order sudah diproses")

    await db.orders.update_one({"id": order_id}, {"$set": {"status": payload.status}})

    # If confirmed and has referral, add commission to affiliate
    if payload.status == "confirmed" and order.get("referral_affiliate_code") and order.get("commission_amount", 0) > 0:
        await db.affiliates.update_one(
            {"affiliate_code": order["referral_affiliate_code"]},
            {
                "$inc": {
                    "balance": order["commission_amount"],
                    "total_earned": order["commission_amount"],
                }
            },
        )

    return {"ok": True}


@api_router.get("/admin/affiliates")
async def admin_list_affiliates(x_admin_password: Optional[str] = Header(None)):
    verify_admin(x_admin_password)
    affs = await db.affiliates.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # total sales per affiliate
    for a in affs:
        count = await db.orders.count_documents(
            {"referral_affiliate_code": a["affiliate_code"], "status": "confirmed"}
        )
        a["total_sales"] = count
    return affs


@api_router.get("/admin/withdrawals")
async def admin_list_withdrawals(x_admin_password: Optional[str] = Header(None)):
    verify_admin(x_admin_password)
    return await db.withdrawals.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api_router.patch("/admin/withdrawals/{wd_id}/status")
async def admin_update_withdrawal(wd_id: str, payload: StatusUpdate, x_admin_password: Optional[str] = Header(None)):
    verify_admin(x_admin_password)
    if payload.status not in ("approved", "rejected"):
        raise HTTPException(400, "Status tidak valid")
    wd = await db.withdrawals.find_one({"id": wd_id}, {"_id": 0})
    if not wd:
        raise HTTPException(404, "WD tidak ditemukan")
    if wd["status"] != "pending":
        raise HTTPException(400, "WD sudah diproses")

    await db.withdrawals.update_one({"id": wd_id}, {"$set": {"status": payload.status}})

    if payload.status == "approved":
        await db.affiliates.update_one(
            {"affiliate_code": wd["affiliate_code"]},
            {"$inc": {"total_withdrawn": wd["amount"]}},
        )
    else:
        # rejected -> refund balance
        await db.affiliates.update_one(
            {"affiliate_code": wd["affiliate_code"]},
            {"$inc": {"balance": wd["amount"]}},
        )
    return {"ok": True}


# Health
@api_router.get("/")
async def root():
    return {"message": "CreativeStore API"}


# ---------- Loyalty / Daily Check-in ----------
class LoyaltyRegister(BaseModel):
    name: str
    whatsapp: str


class CheckinPayload(BaseModel):
    whatsapp: str


def _norm_wa(w: str) -> str:
    return "".join(ch for ch in (w or "") if ch.isdigit())


def _calc_streak(checkin_dates: List[str]) -> int:
    """checkin_dates: list of YYYY-MM-DD strings. Returns current streak ending today/yesterday."""
    if not checkin_dates:
        return 0
    today = datetime.now(timezone.utc).date()
    days = sorted({datetime.fromisoformat(d).date() for d in checkin_dates}, reverse=True)
    # Streak only valid if last checkin is today or yesterday
    if (today - days[0]).days > 1:
        return 0
    streak = 1
    for i in range(1, len(days)):
        if (days[i - 1] - days[i]).days == 1:
            streak += 1
        else:
            break
    return streak


def _gen_disc_code() -> str:
    return "DISC-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


@api_router.post("/loyalty/register")
async def loyalty_register(payload: LoyaltyRegister):
    wa = _norm_wa(payload.whatsapp)
    if not wa or not payload.name.strip():
        raise HTTPException(400, "Nama dan WhatsApp wajib diisi")
    existing = await db.loyalty_members.find_one({"whatsapp": wa}, {"_id": 0})
    if existing:
        return existing
    member = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "whatsapp": wa,
        "created_at": now_iso(),
    }
    await db.loyalty_members.insert_one(member)
    return member


@api_router.post("/loyalty/checkin")
async def loyalty_checkin(payload: CheckinPayload):
    wa = _norm_wa(payload.whatsapp)
    member = await db.loyalty_members.find_one({"whatsapp": wa}, {"_id": 0})
    if not member:
        raise HTTPException(404, "Member tidak ditemukan, daftar dulu ya")

    today_str = datetime.now(timezone.utc).date().isoformat()
    already = await db.checkins.find_one({"member_id": member["id"], "checkin_date": today_str})
    if already:
        raise HTTPException(400, "Kamu sudah check-in hari ini")

    await db.checkins.insert_one({
        "id": str(uuid.uuid4()),
        "member_id": member["id"],
        "checkin_date": today_str,
        "created_at": now_iso(),
    })

    # Compute streak
    rows = await db.checkins.find({"member_id": member["id"]}, {"_id": 0, "checkin_date": 1}).to_list(1000)
    dates = [r["checkin_date"] for r in rows]
    streak = _calc_streak(dates)

    new_code = None
    if streak > 0 and streak % 7 == 0:
        code = _gen_disc_code()
        while await db.discount_codes.find_one({"code": code}):
            code = _gen_disc_code()
        doc = {
            "id": str(uuid.uuid4()),
            "member_id": member["id"],
            "member_name": member["name"],
            "member_whatsapp": member["whatsapp"],
            "code": code,
            "percentage": 10,
            "used": False,
            "created_at": now_iso(),
        }
        await db.discount_codes.insert_one(doc)
        new_code = code

    return {"streak": streak, "new_code": new_code, "checkin_date": today_str}


@api_router.get("/loyalty/member/{whatsapp}")
async def loyalty_member(whatsapp: str):
    wa = _norm_wa(whatsapp)
    member = await db.loyalty_members.find_one({"whatsapp": wa}, {"_id": 0})
    if not member:
        raise HTTPException(404, "Member belum terdaftar")
    rows = await db.checkins.find({"member_id": member["id"]}, {"_id": 0}).sort("checkin_date", -1).to_list(500)
    codes = await db.discount_codes.find({"member_id": member["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    dates = [r["checkin_date"] for r in rows]
    streak = _calc_streak(dates)
    today_str = datetime.now(timezone.utc).date().isoformat()
    return {
        "member": member,
        "checkins": dates,
        "streak": streak,
        "checked_today": today_str in dates,
        "codes": codes,
    }


@api_router.get("/discount/validate/{code}")
async def discount_validate(code: str):
    doc = await db.discount_codes.find_one({"code": code.upper(), "used": False}, {"_id": 0})
    if not doc:
        return {"valid": False}
    return {"valid": True, "percentage": doc["percentage"]}


@api_router.get("/admin/loyalty/members")
async def admin_loyalty_members(x_admin_password: Optional[str] = Header(None)):
    verify_admin(x_admin_password)
    members = await db.loyalty_members.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for m in members:
        rows = await db.checkins.find({"member_id": m["id"]}, {"_id": 0, "checkin_date": 1}).to_list(500)
        m["streak"] = _calc_streak([r["checkin_date"] for r in rows])
    return members


@api_router.get("/admin/loyalty/codes")
async def admin_loyalty_codes(x_admin_password: Optional[str] = Header(None)):
    verify_admin(x_admin_password)
    return await db.discount_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


# ---------- Chat ----------
CHAT_SYSTEM_PROMPT = """Kamu adalah Asisten CreativeStore — toko digital Indonesia yang menjual:
- Akun AI premium (ChatGPT Plus, Claude Pro)
- Tools premium (Canva Pro, Capcut Pro, Adobe)
- Akun streaming (Netflix, Spotify, YouTube Premium)
- Kursus & e-book digital

Aturan jawaban:
- SELALU jawab dalam Bahasa Indonesia yang ramah, santai, dan singkat (max 3-4 kalimat).
- Pembayaran: QRIS atau Transfer Bank. Setelah pesan, admin konfirmasi via WhatsApp/Telegram.
- Cara order: pilih produk → klik "Pesan Sekarang" → isi nama+kontak → pilih metode bayar → submit → catat Order ID (ORDXXXXXX) → tunggu konfirmasi admin.
- Program Affiliate: gratis tanpa modal, komisi 10-15% per produk, daftar di halaman /partnership, login dashboard pakai Affiliate ID (AFFXXXXX).
- Program Reseller: harga grosir, jual mandiri, hubungi admin via WhatsApp untuk daftar.
- Jangan janjikan harga spesifik produk kecuali ditanya umum (harga selalu tampil di katalog).
- Jika ditanya hal di luar CreativeStore, arahkan kembali ke produk/order/affiliate.
- Gunakan emoji secukupnya untuk hangat (😊, 🔥, ✨)."""


class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None


@api_router.post("/chat")
async def chat_endpoint(payload: ChatMessage):
    api_key = EMERGENT_LLM_KEY or GEMINI_API_KEY
    if not api_key:
        raise HTTPException(503, "AI chat belum dikonfigurasi. Hubungi admin.")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        raise HTTPException(500, f"Library error: {e}")

    session_id = payload.session_id or str(uuid.uuid4())
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=CHAT_SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    try:
        reply = await chat.send_message(UserMessage(text=payload.message))
        return {"reply": str(reply), "session_id": session_id}
    except Exception as e:
        logger.error(f"LLM error: {e}")
        raise HTTPException(500, "Maaf, AI sedang sibuk. Coba lagi sebentar 🙏")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
