from fastapi import FastAPI, APIRouter, HTTPException, Header, Query, Response, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
import re
import string
import httpx
import bcrypt
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import Dict, List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import Request
import pakasir
import exports
from scheduler import init_scheduler, build_daily_summary

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
TELEGRAM_PUBLIC_BOT_TOKEN = os.environ.get("TELEGRAM_PUBLIC_BOT_TOKEN", "")
TELEGRAM_PUBLIC_BOT_USERNAME = os.environ.get("TELEGRAM_PUBLIC_BOT_USERNAME", "[USERNAME_BOT_PUBLIK]")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "notif@creativestore.my.id")
PUBLIC_STORE_URL = os.environ.get("PUBLIC_STORE_URL", "https://creativestore.my.id")
ADMIN_WHATSAPP = os.environ.get("ADMIN_WHATSAPP", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# Default kategori (di-seed saat startup jika koleksi kosong)
DEFAULT_CATEGORIES = [
    {"slug": "ai-tools", "name": "AI Tools", "icon": "sparkles", "order": 1},
    {"slug": "video-kreatif", "name": "Video & Kreatif", "icon": "video", "order": 2},
    {"slug": "vpn-keamanan", "name": "VPN & Keamanan", "icon": "shield", "order": 3},
    {"slug": "produktivitas", "name": "Produktivitas", "icon": "zap", "order": 4},
    {"slug": "hiburan", "name": "Hiburan", "icon": "play", "order": 5},
    {"slug": "email-akun", "name": "Email & Akun", "icon": "mail", "order": 6},
    {"slug": "lainnya", "name": "Lainnya", "icon": "grid", "order": 99},
]

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


async def send_public_telegram(chat_id: str, message: str) -> bool:
    """Kirim pesan via BOT PUBLIK (TELEGRAM_PUBLIC_BOT_TOKEN) ke chat_id specific user."""
    if not TELEGRAM_PUBLIC_BOT_TOKEN or not chat_id:
        return False
    url = f"https://api.telegram.org/bot{TELEGRAM_PUBLIC_BOT_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10.0) as cli:
            r = await cli.post(
                url,
                json={
                    "chat_id": chat_id,
                    "text": message,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": False,
                },
            )
            return r.status_code == 200
    except Exception as e:
        logger.error(f"Public telegram send failed: {e}")
        return False


async def send_email_resend(to_email: str, subject: str, html_body: str) -> bool:
    """Kirim email via Resend API. Return True kalau sukses."""
    if not RESEND_API_KEY or not to_email:
        return False
    try:
        async with httpx.AsyncClient(timeout=15.0) as cli:
            r = await cli.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": RESEND_FROM_EMAIL,
                    "to": [to_email],
                    "subject": subject,
                    "html": html_body,
                },
            )
            if r.status_code >= 400:
                logger.error(f"Resend error {r.status_code}: {r.text}")
                return False
            return True
    except Exception as e:
        logger.error(f"Resend send failed: {e}")
        return False


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


async def _check_admin_password(plain: str) -> bool:
    """Verify against stored bcrypt hash if set, else fall back to env ADMIN_PASSWORD."""
    if not plain:
        return False
    doc = await db.settings.find_one({"id": "admin_auth"}, {"_id": 0})
    if doc and doc.get("password_hash"):
        return verify_password(plain, doc["password_hash"])
    return plain == ADMIN_PASSWORD


async def verify_admin(x_admin_password: Optional[str]):
    if not await _check_admin_password(x_admin_password):
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
    # === FIELD BARU ===
    publish_status: str = "draft"  # published | draft (default draft untuk produk baru)
    category: str = "lainnya"  # slug kategori
    is_bestseller: bool = False  # badge TERLARIS (manual)
    is_promo: bool = False  # badge PROMO (manual)
    stock_limit_enabled: bool = False  # jika True, gunakan stock_quantity
    stock_quantity: int = 0  # sisa slot (relevan hanya jika stock_limit_enabled)
    slug: str = ""  # slug untuk URL /produk/[slug]
    display_order: int = 999  # urutan tampil admin (kecil = atas)
    has_variants: bool = False  # jika True, gunakan tabel product_variants
    image_position: str = "center center"  # CSS object-position (top left | center center | dst.)
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
    publish_status: str = "draft"
    category: str = "lainnya"
    is_bestseller: bool = False
    is_promo: bool = False
    stock_limit_enabled: bool = False
    stock_quantity: int = 0
    display_order: int = 999
    has_variants: bool = False
    image_position: str = "center center"


# ---------- Product Variants ----------
class ProductVariant(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    name: str
    price: float = 0.0
    discount_price: Optional[float] = None
    is_recommended: bool = False  # "Paling Dipilih"
    is_best_value: bool = False
    display_order: int = 100
    is_active: bool = True
    created_at: str = Field(default_factory=now_iso)


class ProductVariantCreate(BaseModel):
    id: Optional[str] = None  # optional untuk update in-place
    name: str
    price: float = 0.0
    discount_price: Optional[float] = None
    is_recommended: bool = False
    is_best_value: bool = False
    display_order: int = 100
    is_active: bool = True


class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slug: str
    name: str
    icon: str = "grid"
    order: int = 100
    created_at: str = Field(default_factory=now_iso)


class CategoryCreate(BaseModel):
    slug: str
    name: str
    icon: str = "grid"
    order: int = 100


class Waitlist(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nama: Optional[str] = None
    whatsapp_telegram: Optional[str] = None
    email: Optional[str] = None
    telegram_chat_id: Optional[str] = None  # diisi saat user /start bot publik
    produk_id: str
    produk_nama: str
    notified: bool = False
    notified_via: Optional[str] = None  # telegram | email | both
    created_at: str = Field(default_factory=now_iso)


class WaitlistCreate(BaseModel):
    nama: Optional[str] = None
    whatsapp_telegram: Optional[str] = None
    email: Optional[str] = None
    produk_id: str


class BulkPublishPayload(BaseModel):
    ids: List[str]
    publish_status: str  # published | draft


class ProductStatusUpdate(BaseModel):
    publish_status: str  # published | draft


# ---------- Review Model ----------
class Review(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    product_name: str
    buyer_name: str  # akan disamarkan saat publik
    order_id: str
    rating: int = 5  # 1-5
    comment: str = ""
    visible: bool = True
    created_at: str = Field(default_factory=now_iso)


class ReviewCreate(BaseModel):
    order_id: str
    rating: int
    comment: Optional[str] = ""


class ReviewAdminUpdate(BaseModel):
    rating: Optional[int] = None
    comment: Optional[str] = None
    visible: Optional[bool] = None


# ---------- FAQ Model ----------
class FAQ(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question: str
    answer: str
    order: int = 100
    visible: bool = True
    created_at: str = Field(default_factory=now_iso)


class FAQCreate(BaseModel):
    question: str
    answer: str
    order: int = 100
    visible: bool = True


# ---------- About Us content (single-doc) ----------
DEFAULT_ABOUT = {
    "id": "about",
    "tagline": "Digital goods tanpa ribet, instan dan terpercaya",
    "paragraphs": [
        "CreativeStore hadir untuk memudahkan Sobat Creative mendapatkan akses ke tools dan layanan digital premium dengan harga terjangkau dan proses yang cepat.",
        "Kami menyediakan berbagai produk digital mulai dari AI tools, subscription premium, VPN, hingga layanan kreatif — semuanya bisa didapatkan dengan mudah dan aman.",
        "Bergabunglah dengan ribuan Sobat Creative yang sudah mempercayai CreativeStore sebagai partner digital mereka.",
    ],
    "features": [
        {"icon": "zap", "title": "Proses Cepat", "desc": "Pesanan diproses 1x24 jam"},
        {"icon": "shield", "title": "Aman & Terpercaya", "desc": "Pembayaran via QRIS resmi"},
        {"icon": "tag", "title": "Harga Terjangkau", "desc": "Produk premium harga bersahabat"},
        {"icon": "message-circle", "title": "Support Responsif", "desc": "Tim siap bantu kapanpun"},
    ],
}


class AboutUpdate(BaseModel):
    tagline: str
    paragraphs: List[str]
    features: List[dict]



class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_code: str
    buyer_name: str
    contact: str
    product_id: str
    product_name: str
    product_price: float
    payment_method: str  # qris | transfer | qris_otomatis
    referral_affiliate_code: Optional[str] = None
    status: str = "pending"  # pending | confirmed | cancelled | expired
    commission_amount: float = 0.0
    variant_id: Optional[str] = None
    variant_name: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    # Pakasir automated QRIS fields
    pakasir_amount: Optional[int] = None
    pakasir_total: Optional[float] = None
    pakasir_fee: Optional[float] = None
    pakasir_qr_string: Optional[str] = None
    pakasir_status: Optional[str] = None  # pending | completed | expired
    expires_at: Optional[str] = None
    paid_via: Optional[str] = None
    paid_at: Optional[str] = None


class OrderCreate(BaseModel):
    buyer_name: str
    contact: str
    product_id: str
    payment_method: str
    referral_affiliate_code: Optional[str] = None
    discount_code: Optional[str] = None
    variant_id: Optional[str] = None


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
    stg = await db.settings.find_one({"id": "stats"}, {"_id": 0}) or {}
    show_coming_soon = stg.get("show_coming_soon", True)
    if show_coming_soon:
        query = {}
    else:
        query = {"publish_status": {"$ne": "draft"}}
    pipeline = [
        {"$match": query},
        {"$addFields": {
            "_status_priority": {
                "$cond": [{"$eq": ["$publish_status", "published"]}, 0, 1]
            },
            "_display_order": {"$ifNull": ["$display_order", 999]}
        }},
        {"$sort": {"_status_priority": 1, "_display_order": 1, "created_at": -1}},
        {"$project": {"_id": 0, "_status_priority": 0, "_display_order": 0}},
    ]
    products = await db.products.aggregate(pipeline).to_list(1000)
    # Enrich dengan info variants (starting_price + preview chip names)
    product_ids = [p["id"] for p in products if p.get("has_variants")]
    if product_ids:
        rows = await db.product_variants.find(
            {"product_id": {"$in": product_ids}, "is_active": True},
            {"_id": 0},
        ).sort("display_order", 1).to_list(2000)
        by_pid: Dict[str, List[dict]] = {}
        for v in rows:
            by_pid.setdefault(v["product_id"], []).append(v)
        for p in products:
            if not p.get("has_variants"):
                continue
            variants = by_pid.get(p["id"], [])
            if not variants:
                # Punya toggle has_variants tapi belum ada variant aktif — fallback ke original_price
                p["variant_count"] = 0
                p["starting_price"] = p.get("discount_price") if p.get("discount_active") else p.get("original_price", 0)
                p["variant_preview"] = []
                continue
            prices = [
                (v.get("discount_price") if v.get("discount_price") else v.get("price", 0))
                for v in variants
            ]
            p["variant_count"] = len(variants)
            p["starting_price"] = min(prices) if prices else 0
            p["variant_preview"] = [v["name"] for v in variants[:3]]
    return products


@api_router.get("/products/{product_id}/variants")
async def public_list_variants(product_id: str):
    """Public: variant aktif untuk product detail page."""
    rows = await db.product_variants.find(
        {"product_id": product_id, "is_active": True},
        {"_id": 0},
    ).sort("display_order", 1).to_list(50)
    return rows


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
    "loyalty_discount_percent": 10,
    "live_feed_names": [
        "Andi", "Budi", "Cinta", "Dewi", "Eka", "Fajar", "Gita",
        "Hadi", "Indra", "Joko", "Kirana", "Lutfi", "Maya", "Nanda",
        "Oka", "Putra", "Rina", "Sari", "Tio", "Umar", "Vina",
        "Wahyu", "Yanto", "Zaki", "Bagas", "Citra", "Doni",
    ],
    "qris_url": "",
    "bank_accounts": [],
    "show_coming_soon": True,
    # Trust badges (editable via admin settings)
    "trust_rating": "5.0",
    "trust_transactions": "5000+",
    "trust_since_year": "2021",
    "trust_process_time": "1x24 Jam",
    "footer_start_year": "2021",
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
    loyalty_discount_percent: int = 10
    live_feed_names: List[str] = []
    qris_url: str = ""
    bank_accounts: List[dict] = []
    show_coming_soon: bool = True
    trust_rating: str = "5.0"
    trust_transactions: str = "5000+"
    trust_since_year: str = "2021"
    trust_process_time: str = "1x24 Jam"
    footer_start_year: str = "2021"


@api_router.put("/admin/stats")
async def admin_update_stats(payload: StatsUpdate, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    data = {"id": "stats", **payload.model_dump()}
    await db.settings.update_one({"id": "stats"}, {"$set": data}, upsert=True)
    return {k: data[k] for k in DEFAULT_STATS.keys()}


# ---------- Maintenance mode ----------
DEFAULT_MAINTENANCE = {
    "enabled": False,
    "message": "Kami sedang melakukan peningkatan layanan untuk Sobat Creative. Mohon tunggu sebentar ya! 🙏",
    "estimated_finish": "",
    "contact_wa": "",
    "contact_telegram": "",
}


class MaintenanceUpdate(BaseModel):
    enabled: bool = False
    message: str = DEFAULT_MAINTENANCE["message"]
    estimated_finish: str = ""
    contact_wa: str = ""
    contact_telegram: str = ""


@api_router.get("/maintenance")
async def get_maintenance():
    doc = await db.settings.find_one({"id": "maintenance"}, {"_id": 0}) or {}
    return {k: doc.get(k, v) for k, v in DEFAULT_MAINTENANCE.items()}


@api_router.put("/admin/maintenance")
async def admin_update_maintenance(payload: MaintenanceUpdate, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    data = {"id": "maintenance", **payload.model_dump()}
    await db.settings.update_one({"id": "maintenance"}, {"$set": data}, upsert=True)
    return {k: data[k] for k in DEFAULT_MAINTENANCE.keys()}


# ---------- Page Views (visitor tracking) ----------
_BOT_UA_PATTERN = re.compile(
    r"bot|crawl|spider|slurp|bingpreview|preview|facebookexternalhit|whatsapp|telegrambot|discordbot|linkedinbot|twitterbot|semrushbot|ahrefsbot|mj12bot|petalbot|yandex|baiduspider|duckduckbot|applebot|pingdom|uptimerobot",
    re.IGNORECASE,
)


class PageViewPayload(BaseModel):
    path: str
    product_slug: Optional[str] = None


@api_router.post("/track/page-view")
async def track_page_view(payload: PageViewPayload, request: Request):
    """Lightweight visitor tracking. Skips bots via user-agent heuristic."""
    ua = request.headers.get("user-agent", "")
    if _BOT_UA_PATTERN.search(ua or ""):
        return {"tracked": False, "reason": "bot"}
    doc = {
        "id": str(uuid.uuid4()),
        "path": (payload.path or "/")[:200],
        "product_slug": payload.product_slug,
        "user_agent": ua[:200],
        "created_at": now_iso(),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }
    await db.page_views.insert_one(doc)
    return {"tracked": True}


@api_router.get("/admin/visitor-stats")
async def admin_visitor_stats(x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    week_ago = (now - timedelta(days=6)).strftime("%Y-%m-%d")
    month_ago = (now - timedelta(days=29)).strftime("%Y-%m-%d")

    total_today = await db.page_views.count_documents({"date": today_str})
    total_week = await db.page_views.count_documents({"date": {"$gte": week_ago}})
    total_month = await db.page_views.count_documents({"date": {"$gte": month_ago}})

    # Grafik 7 hari
    daily = await db.page_views.aggregate([
        {"$match": {"date": {"$gte": week_ago}}},
        {"$group": {"_id": "$date", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]).to_list(30)
    daily_map = {r["_id"]: r["count"] for r in daily}
    chart = []
    for i in range(7):
        d = (now - timedelta(days=6 - i)).strftime("%Y-%m-%d")
        chart.append({"date": d, "count": daily_map.get(d, 0)})

    # Halaman paling banyak dikunjungi
    top_pages = await db.page_views.aggregate([
        {"$match": {"date": {"$gte": month_ago}}},
        {"$group": {"_id": "$path", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]).to_list(10)

    # Produk paling banyak dilihat (via product_slug)
    top_products_raw = await db.page_views.aggregate([
        {"$match": {"date": {"$gte": month_ago}, "product_slug": {"$ne": None}}},
        {"$group": {"_id": "$product_slug", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]).to_list(10)
    slugs = [r["_id"] for r in top_products_raw if r.get("_id")]
    prod_docs = await db.products.find({"slug": {"$in": slugs}}, {"_id": 0, "slug": 1, "name": 1}).to_list(50)
    name_map = {p["slug"]: p["name"] for p in prod_docs}
    top_products = [
        {"slug": r["_id"], "name": name_map.get(r["_id"], r["_id"]), "views": r["count"]}
        for r in top_products_raw
    ]

    return {
        "today": total_today,
        "week": total_week,
        "month": total_month,
        "chart_7d": chart,
        "top_pages": [{"path": r["_id"], "count": r["count"]} for r in top_pages],
        "top_products": top_products,
    }




# ---------- Public: Orders ----------
@api_router.post("/orders")
async def create_order(payload: OrderCreate):
    product = await db.products.find_one({"id": payload.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Produk tidak ditemukan")
    if product.get("publish_status", "published") != "published":
        raise HTTPException(400, "Produk belum tersedia (Coming Soon)")
    if product.get("stock_status") != "available":
        raise HTTPException(400, "Produk sedang tidak tersedia")
    # Cek stok terbatas
    if product.get("stock_limit_enabled") and int(product.get("stock_quantity", 0)) <= 0:
        raise HTTPException(400, "Stok habis")

    price = (
        product["discount_price"]
        if product.get("discount_active") and product.get("discount_price")
        else product["original_price"]
    )

    # Variant selection — override price + append variant name for display
    variant_doc = None
    variant_name = None
    if payload.variant_id:
        variant_doc = await db.product_variants.find_one(
            {"id": payload.variant_id, "product_id": product["id"], "is_active": True},
            {"_id": 0},
        )
        if not variant_doc:
            raise HTTPException(400, "Variasi tidak ditemukan atau tidak aktif")
        price = (
            float(variant_doc["discount_price"])
            if variant_doc.get("discount_price")
            else float(variant_doc["price"])
        )
        variant_name = variant_doc["name"]
    elif product.get("has_variants"):
        # Produk punya variasi tapi user tidak pilih — cari default (recommended → first active)
        active_variants = await db.product_variants.find(
            {"product_id": product["id"], "is_active": True},
            {"_id": 0},
        ).sort("display_order", 1).to_list(50)
        default = next((v for v in active_variants if v.get("is_recommended")), None) or (
            active_variants[0] if active_variants else None
        )
        if default:
            variant_doc = default
            variant_name = default["name"]
            price = (
                float(default["discount_price"]) if default.get("discount_price") else float(default["price"])
            )

    # Apply loyalty discount code (10% off)
    if payload.discount_code:
        code = payload.discount_code.strip().upper()
        code_doc = await db.discount_codes.find_one({"code": code, "used": False}, {"_id": 0})
        if code_doc:
            price = round(price * (1 - code_doc["percentage"] / 100), 2)
            await db.discount_codes.update_one({"code": code}, {"$set": {"used": True, "used_at": now_iso()}})
        else:
            # Cek apakah ini coupon voucher admin
            coupon = await db.coupons.find_one({"code": code}, {"_id": 0})
            if coupon and coupon.get("active"):
                now = datetime.now(timezone.utc).isoformat()
                # Basic validation
                valid = True
                if coupon.get("valid_from") and now < coupon["valid_from"]:
                    valid = False
                if coupon.get("valid_until") and now > coupon["valid_until"]:
                    valid = False
                if coupon.get("max_uses", 0) > 0 and int(coupon.get("uses_count", 0)) >= int(coupon["max_uses"]):
                    valid = False
                if price < float(coupon.get("min_purchase", 0)):
                    valid = False
                if coupon.get("applies_to") == "products" and product["id"] not in coupon.get("product_ids", []):
                    valid = False
                if valid:
                    if coupon["discount_type"] == "percentage":
                        discount = round(price * float(coupon["discount_value"]) / 100, 2)
                    else:
                        discount = float(coupon["discount_value"])
                    price = max(0, round(price - discount, 2))
                    # Increment uses_count
                    await db.coupons.update_one({"code": code}, {"$inc": {"uses_count": 1}})

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
        variant_id=(variant_doc.get("id") if variant_doc else None),
        variant_name=variant_name,
    )

    qr_image = None
    if payload.payment_method == "qris_otomatis":
        if not pakasir.is_configured():
            raise HTTPException(503, "QRIS Otomatis belum dikonfigurasi. Pilih metode lain.")
        amount_int = int(round(price))
        try:
            pay = await pakasir.create_qris(order.order_code, amount_int)
        except Exception as e:
            logger.error(f"Pakasir create failed: {e}")
            raise HTTPException(502, "Gagal membuat QRIS otomatis. Coba lagi sebentar.")
        order.pakasir_amount = amount_int
        order.pakasir_total = float(pay.get("total_payment", amount_int))
        order.pakasir_fee = float(pay.get("fee", 0))
        order.pakasir_qr_string = pay.get("payment_number")
        order.pakasir_status = "pending"
        order.expires_at = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        qr_image = pakasir.qr_to_data_uri(order.pakasir_qr_string)

    await db.orders.insert_one(order.model_dump())

    _display_name = f"{order.product_name} ({variant_name})" if variant_name else order.product_name
    msg = (
        f"<b>🛒 Pesanan Baru — Menunggu Verifikasi Pembayaran</b>\n\n"
        f"<b>Order:</b> {order.order_code}\n"
        f"<b>Nama:</b> {order.buyer_name}\n"
        f"<b>Kontak:</b> {order.contact}\n"
        f"<b>Produk:</b> {_display_name}\n"
        f"<b>Harga:</b> Rp {int(price):,}\n"
        f"<b>Pembayaran:</b> {order.payment_method.upper()}\n"
        f"<b>Referral:</b> {referral or '-'}\n\n"
        f"⏳ Cek mutasi/bukti transfer, lalu konfirmasi di admin panel."
    )
    await send_telegram(msg)
    return {
        "order_code": order.order_code,
        "id": order.id,
        "payment_method": order.payment_method,
        "qr_image": qr_image,
        "pakasir_total": order.pakasir_total,
        "pakasir_fee": order.pakasir_fee,
        "expires_at": order.expires_at,
    }


async def _settle_paid_order(order_code: str) -> bool:
    """Idempotently mark a Pakasir order as paid + pay commission + notify. Returns True if newly settled."""
    res = await db.orders.update_one(
        {"order_code": order_code, "status": {"$ne": "confirmed"}},
        {"$set": {
            "status": "confirmed",
            "pakasir_status": "completed",
            "paid_via": "pakasir_auto",
            "paid_at": now_iso(),
        }},
    )
    if res.modified_count != 1:
        return False  # already settled or not found
    order = await db.orders.find_one({"order_code": order_code}, {"_id": 0})
    # Decrement stock jika produk pakai stock_limit_enabled + trigger low-stock alert
    if order:
        prod = await db.products.find_one({"id": order.get("product_id")}, {"_id": 0})
        if prod and prod.get("stock_limit_enabled"):
            new_qty = max(0, int(prod.get("stock_quantity", 0)) - 1)
            upd = {"stock_quantity": new_qty}
            if new_qty <= 0:
                upd["stock_status"] = "unavailable"
            await db.products.update_one({"id": prod["id"]}, {"$set": upd})
            try:
                await _check_and_notify_low_stock(prod["id"])
            except Exception as e:
                logger.error(f"Low stock alert failed: {e}")
    if order and order.get("referral_affiliate_code") and order.get("commission_amount", 0) > 0:
        await db.affiliates.update_one(
            {"affiliate_code": order["referral_affiliate_code"]},
            {"$inc": {
                "balance": order["commission_amount"],
                "total_earned": order["commission_amount"],
            }},
        )
    await send_telegram(
        f"<b>✅ Lunas — Terverifikasi Otomatis (QRIS)</b>\n\n"
        f"<b>Order:</b> {order['order_code']}\n"
        f"<b>Nama:</b> {order['buyer_name']}\n"
        f"<b>Produk:</b> {order['product_name']}\n"
        f"<b>Total:</b> Rp {int(order.get('pakasir_total') or order['product_price']):,}\n"
        f"<b>Referral:</b> {order.get('referral_affiliate_code') or '-'}"
    )
    return True


@api_router.get("/orders/{order_code}/status")
async def order_status(order_code: str):
    order = await db.orders.find_one({"order_code": order_code}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order tidak ditemukan")

    if order["status"] == "confirmed":
        return {"status": "paid"}
    if order.get("pakasir_status") == "expired" or order["status"] == "expired":
        return {"status": "expired"}

    # Only relevant for automated QRIS
    if order.get("payment_method") != "qris_otomatis":
        return {"status": order["status"]}

    # Check expiry (15 min window)
    expired = False
    if order.get("expires_at"):
        try:
            expired = datetime.now(timezone.utc) >= datetime.fromisoformat(order["expires_at"])
        except Exception:
            expired = False

    # Verify against Pakasir authoritative status
    txn = await pakasir.get_transaction(order_code, order.get("pakasir_amount") or 0)
    if txn and txn.get("status") == "completed":
        await _settle_paid_order(order_code)
        return {"status": "paid"}

    if expired:
        await db.orders.update_one(
            {"order_code": order_code, "status": "pending"},
            {"$set": {"status": "expired", "pakasir_status": "expired"}},
        )
        await pakasir.cancel_transaction(order_code, order.get("pakasir_amount") or 0)
        return {"status": "expired"}

    return {"status": "pending", "expires_at": order.get("expires_at")}


@api_router.post("/pakasir/webhook")
async def pakasir_webhook(request: Request):
    try:
        body = await request.json()
    except Exception:
        return {"ok": False}
    order_id = body.get("order_id")
    amount = body.get("amount")
    status = body.get("status")
    if not order_id or status != "completed":
        return {"ok": True}
    # Re-verify with authoritative API before settling (webhook is unsigned)
    txn = await pakasir.get_transaction(order_id, int(amount) if amount else 0)
    if txn and txn.get("status") == "completed":
        await _settle_paid_order(order_id)
    else:
        logger.warning(f"Pakasir webhook for {order_id} could not be verified")
    return {"ok": True}


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
    if not await _check_admin_password(payload.password):
        raise HTTPException(401, "Password salah")
    return {"ok": True}


class ChangePassword(BaseModel):
    old_password: str
    new_password: str
    confirm_password: str


@api_router.post("/admin/change-password")
async def admin_change_password(payload: ChangePassword, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    if not await _check_admin_password(payload.old_password):
        raise HTTPException(400, "Password lama salah")
    if payload.new_password != payload.confirm_password:
        raise HTTPException(400, "Konfirmasi password tidak cocok")
    if len(payload.new_password) < 8:
        raise HTTPException(400, "Password baru minimal 8 karakter")
    await db.settings.update_one(
        {"id": "admin_auth"},
        {"$set": {"id": "admin_auth", "password_hash": hash_password(payload.new_password)}},
        upsert=True,
    )
    return {"ok": True}


def _slugify(name: str) -> str:
    """Convert product name → URL slug. Handle diacritics minimally."""
    s = (name or "").lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s)
    s = s.strip("-")
    return s or "produk"


def _normalize_photo_url(url: Optional[str]) -> str:
    """Normalisasi URL foto dari beberapa host populer supaya bisa dipakai langsung sebagai <img src>.

    - Google Drive share link (`.../file/d/FILEID/view?...`) → `https://lh3.googleusercontent.com/d/FILEID`
    - Google Drive `open?id=FILEID` → sama seperti di atas
    - Dropbox `?dl=0` → `?raw=1`
    - imgbb page link (`ibb.co/XXX`) → dibiarkan (user disarankan copy "Direct link")
    Return URL yang sudah dinormalisasi (atau URL asli kalau tidak match).
    """
    if not url:
        return ""
    u = url.strip()
    # Google Drive
    m = re.search(r"drive\.google\.com/(?:file/d/|open\?id=|uc\?(?:.*&)?id=)([\w-]{10,})", u)
    if m:
        file_id = m.group(1)
        return f"https://lh3.googleusercontent.com/d/{file_id}"
    # Dropbox
    if "dropbox.com" in u:
        if "?dl=0" in u:
            u = u.replace("?dl=0", "?raw=1")
        elif "?raw=1" not in u and "?dl=1" not in u:
            sep = "&" if "?" in u else "?"
            u = f"{u}{sep}raw=1"
        return u
    return u


async def _generate_unique_slug(name: str, ignore_id: Optional[str] = None) -> str:
    base = _slugify(name)
    slug = base
    idx = 2
    while True:
        q = {"slug": slug}
        if ignore_id:
            q["id"] = {"$ne": ignore_id}
        exist = await db.products.find_one(q, {"_id": 0, "id": 1})
        if not exist:
            return slug
        slug = f"{base}-{idx}"
        idx += 1


async def _check_and_notify_low_stock(product_id: str) -> None:
    """Kirim notif Telegram ke admin saat stok terbatas mencapai threshold ≤5 atau =0.

    Idempoten: pakai field `low_stock_alerted_at` & `out_of_stock_alerted_at` di dokumen produk
    sehingga notif tidak berulang selama stok tetap di kondisi tersebut. Reset otomatis saat
    stok ditambah kembali (lihat admin_update_product / admin_update_stock).
    """
    prod = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not prod or not prod.get("stock_limit_enabled"):
        return
    qty = int(prod.get("stock_quantity", 0) or 0)
    name = prod.get("name", "?")
    admin_url = f"{PUBLIC_STORE_URL.rstrip('/')}/admin"

    if qty <= 0 and not prod.get("out_of_stock_alerted_at"):
        await send_telegram(
            f"<b>🚨 Stok Habis!</b>\n\n"
            f"Produk: <b>{name}</b> sudah habis dan otomatis tidak bisa dipesan.\n"
            f"Tambah stok atau nonaktifkan produk.\n\n"
            f"<a href=\"{admin_url}\">Buka Admin Panel →</a>"
        )
        await db.products.update_one(
            {"id": product_id},
            {"$set": {"out_of_stock_alerted_at": now_iso(), "low_stock_alerted_at": now_iso()}},
        )
    elif 0 < qty <= 5 and not prod.get("low_stock_alerted_at"):
        await send_telegram(
            f"<b>⚠️ Stok Menipis!</b>\n\n"
            f"Produk: <b>{name}</b>\n"
            f"Sisa stok: <b>{qty} slot</b>\n\n"
            f"Segera tambah stok di admin panel.\n"
            f"<a href=\"{admin_url}\">Buka Admin Panel →</a>"
        )
        await db.products.update_one(
            {"id": product_id},
            {"$set": {"low_stock_alerted_at": now_iso()}},
        )


@api_router.post("/admin/products")
async def admin_create_product(payload: ProductCreate, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    data = payload.model_dump()
    data["photo_url"] = _normalize_photo_url(data.get("photo_url"))
    data["slug"] = await _generate_unique_slug(data["name"])
    # Auto-assign display_order kalau default (999) supaya reorder tidak collide.
    # Cari max display_order dari produk yang sudah punya urutan valid (< 999).
    if int(data.get("display_order", 999)) >= 999:
        last = await db.products.find_one(
            {"display_order": {"$lt": 999}},
            {"_id": 0, "display_order": 1},
            sort=[("display_order", -1)],
        )
        last_order = int(last["display_order"]) if last else 0
        data["display_order"] = last_order + 10  # sisa gap 10 untuk manual insert
    p = Product(**data)
    await db.products.insert_one(p.model_dump())
    return p.model_dump()


class BulkImportPayload(BaseModel):
    names: List[str]


class BulkImportVariantItem(BaseModel):
    name: str
    price: float = 0.0
    discount_price: Optional[float] = None
    is_recommended: bool = False
    is_best_value: bool = False


class BulkImportItem(BaseModel):
    name: str
    price: float = 0.0
    variants: List[BulkImportVariantItem] = []


class BulkImportFullPayload(BaseModel):
    items: List[BulkImportItem]


class ReorderPayload(BaseModel):
    orders: List[dict]  # [{id, display_order}]


class Coupon(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str  # unique, uppercased
    discount_type: str = "percentage"  # percentage | nominal
    discount_value: float = 0.0
    min_purchase: float = 0.0
    max_uses: int = 0  # 0 = unlimited
    uses_count: int = 0
    applies_to: str = "all"  # all | products
    product_ids: List[str] = []
    valid_from: Optional[str] = None  # ISO date
    valid_until: Optional[str] = None  # ISO date
    active: bool = True
    created_at: str = Field(default_factory=now_iso)


class CouponCreate(BaseModel):
    code: str
    discount_type: str = "percentage"
    discount_value: float = 0.0
    min_purchase: float = 0.0
    max_uses: int = 0
    applies_to: str = "all"
    product_ids: List[str] = []
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    active: bool = True


@api_router.post("/admin/products/bulk-import")
async def admin_bulk_import_products(
    payload: BulkImportPayload,
    x_admin_password: Optional[str] = Header(None),
):
    """Legacy: Import via names only (backward compat)."""
    await verify_admin(x_admin_password)
    seen: set = set()
    cleaned: list = []
    for raw in payload.names:
        if not raw:
            continue
        name = raw.strip()
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(name)

    if not cleaned:
        raise HTTPException(400, "Tidak ada nama produk valid")

    # Get max display_order untuk assign yang terbaru ke belakang
    last = await db.products.find_one(
        {}, {"_id": 0, "display_order": 1}, sort=[("display_order", -1)]
    )
    base_order = int(last.get("display_order", 999) if last else 999) + 1

    docs = []
    for i, n in enumerate(cleaned):
        slug = await _generate_unique_slug(n)
        docs.append(Product(
            name=n, photo_url="", original_price=0, discount_price=None,
            discount_active=False, description="", commission_percent=10.0,
            stock_status="available", monthly_sold=0, publish_status="draft",
            category="lainnya", slug=slug, display_order=base_order + i,
        ).model_dump())
    await db.products.insert_many(docs)
    for d in docs:
        d.pop("_id", None)
    return {"created": len(docs), "products": docs}


@api_router.post("/admin/products/bulk-import-v2")
async def admin_bulk_import_v2(
    payload: BulkImportFullPayload,
    x_admin_password: Optional[str] = Header(None),
):
    """New: Import dengan nama + harga per item."""
    await verify_admin(x_admin_password)
    if not payload.items:
        raise HTTPException(400, "Tidak ada item untuk diimport")

    last = await db.products.find_one(
        {}, {"_id": 0, "display_order": 1}, sort=[("display_order", -1)]
    )
    base_order = int(last.get("display_order", 999) if last else 999) + 1

    docs = []
    variants_to_insert = []
    for i, item in enumerate(payload.items):
        name = item.name.strip()
        if not name:
            continue
        slug = await _generate_unique_slug(name)
        has_variants = bool(item.variants and len(item.variants) > 0)
        # Kalau ada variants → harga produk = harga variant terendah (starting)
        base_price = float(item.price or 0)
        if has_variants:
            prices = [
                float(v.discount_price if v.discount_price else v.price)
                for v in item.variants
            ]
            base_price = min(prices) if prices else 0.0
        product = Product(
            name=name, photo_url="", original_price=base_price,
            discount_price=None, discount_active=False, description="",
            commission_percent=10.0, stock_status="available", monthly_sold=0,
            publish_status="draft", category="lainnya", slug=slug,
            display_order=base_order + i, has_variants=has_variants,
        )
        docs.append(product.model_dump())
        if has_variants:
            for vi, v in enumerate(item.variants):
                variants_to_insert.append(ProductVariant(
                    product_id=product.id,
                    name=v.name.strip() or f"Variasi {vi + 1}",
                    price=float(v.price or 0),
                    discount_price=(float(v.discount_price) if v.discount_price else None),
                    is_recommended=bool(v.is_recommended),
                    is_best_value=bool(v.is_best_value),
                    display_order=vi,
                    is_active=True,
                ).model_dump())

    if not docs:
        raise HTTPException(400, "Tidak ada item valid")
    await db.products.insert_many(docs)
    if variants_to_insert:
        await db.product_variants.insert_many(variants_to_insert)
    for d in docs:
        d.pop("_id", None)
    return {"created": len(docs), "variants_created": len(variants_to_insert), "products": docs}


@api_router.post("/admin/products/check-duplicates")
async def admin_check_duplicates(
    payload: BulkImportFullPayload,
    x_admin_password: Optional[str] = Header(None),
):
    """Cek nama produk yang akan diimport terhadap existing. Return status per item."""
    await verify_admin(x_admin_password)
    existing = await db.products.find({}, {"_id": 0, "name": 1}).to_list(2000)
    existing_lower = {p["name"].lower().strip(): p["name"] for p in existing}

    def similarity(a: str, b: str) -> float:
        # Simple Jaccard similarity on word tokens
        aw = set(a.lower().split())
        bw = set(b.lower().split())
        if not aw or not bw:
            return 0.0
        return len(aw & bw) / len(aw | bw)

    result = []
    for item in payload.items:
        n = item.name.strip()
        if not n:
            continue
        key = n.lower()
        status = "new"
        matched_name = None
        if key in existing_lower:
            status = "exact"
            matched_name = existing_lower[key]
        else:
            # find similar
            for k, v in existing_lower.items():
                if similarity(key, k) > 0.8:
                    status = "similar"
                    matched_name = v
                    break
        result.append({
            "name": n,
            "price": float(item.price or 0),
            "status": status,
            "matched_name": matched_name,
        })
    return {"items": result}


@api_router.post("/admin/products/reorder")
async def admin_reorder_products(
    payload: ReorderPayload,
    x_admin_password: Optional[str] = Header(None),
):
    """Bulk-update display_order for products."""
    await verify_admin(x_admin_password)
    updated = 0
    for o in payload.orders:
        pid = o.get("id")
        order = int(o.get("display_order", 999))
        if not pid:
            continue
        r = await db.products.update_one({"id": pid}, {"$set": {"display_order": order}})
        updated += r.modified_count
    return {"updated": updated}


@api_router.post("/admin/products/reset-order")
async def admin_reset_order(x_admin_password: Optional[str] = Header(None)):
    """Reset display_order sesuai tanggal ditambahkan (terbaru dulu → order kecil)."""
    await verify_admin(x_admin_password)
    products = await db.products.find({}, {"_id": 0, "id": 1, "created_at": 1}).sort("created_at", -1).to_list(2000)
    for i, p in enumerate(products, 1):
        await db.products.update_one({"id": p["id"]}, {"$set": {"display_order": i}})
    return {"reset": len(products)}


@api_router.put("/admin/products/{product_id}")
async def admin_update_product(product_id: str, payload: ProductCreate, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    old = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not old:
        raise HTTPException(404, "Produk tidak ditemukan")
    data = payload.model_dump()
    data["photo_url"] = _normalize_photo_url(data.get("photo_url"))
    # Reset low-stock alert flags kalau stok direfill di atas threshold
    new_qty = int(data.get("stock_quantity", 0) or 0)
    if new_qty > 5:
        data["low_stock_alerted_at"] = None
        data["out_of_stock_alerted_at"] = None
    elif new_qty > 0:
        data["out_of_stock_alerted_at"] = None
    # Regenerate slug jika nama berubah
    if data["name"] != old.get("name") or not old.get("slug"):
        data["slug"] = await _generate_unique_slug(data["name"], ignore_id=product_id)
    else:
        data["slug"] = old.get("slug", "")
    await db.products.update_one({"id": product_id}, {"$set": data})
    p = await db.products.find_one({"id": product_id}, {"_id": 0})

    # Deteksi transisi Draft -> Published → trigger notifikasi waitlist
    was_draft = old.get("publish_status", "published") == "draft"
    now_published = p.get("publish_status") == "published"
    if was_draft and now_published:
        try:
            await _notify_waitlist_on_publish(p)
        except Exception as e:
            logger.error(f"Notify waitlist failed: {e}")
    return p


@api_router.patch("/admin/products/{product_id}/publish-status")
async def admin_toggle_publish_status(
    product_id: str,
    payload: ProductStatusUpdate,
    x_admin_password: Optional[str] = Header(None),
):
    await verify_admin(x_admin_password)
    if payload.publish_status not in ("published", "draft"):
        raise HTTPException(400, "Status tidak valid")
    old = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not old:
        raise HTTPException(404, "Produk tidak ditemukan")
    await db.products.update_one(
        {"id": product_id}, {"$set": {"publish_status": payload.publish_status}}
    )
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    was_draft = old.get("publish_status", "published") == "draft"
    if was_draft and payload.publish_status == "published":
        try:
            await _notify_waitlist_on_publish(p)
        except Exception as e:
            logger.error(f"Notify waitlist failed: {e}")
    return p


@api_router.post("/admin/products/bulk-publish")
async def admin_bulk_publish(
    payload: BulkPublishPayload,
    x_admin_password: Optional[str] = Header(None),
):
    await verify_admin(x_admin_password)
    if payload.publish_status not in ("published", "draft"):
        raise HTTPException(400, "Status tidak valid")
    # ambil produk yang benar-benar transisi draft→published
    to_notify = []
    if payload.publish_status == "published":
        cursor = db.products.find(
            {"id": {"$in": payload.ids}, "publish_status": "draft"}, {"_id": 0}
        )
        to_notify = await cursor.to_list(1000)

    result = await db.products.update_many(
        {"id": {"$in": payload.ids}},
        {"$set": {"publish_status": payload.publish_status}},
    )
    # Notify satu-per-satu (async)
    for p in to_notify:
        p["publish_status"] = "published"
        try:
            await _notify_waitlist_on_publish(p)
        except Exception as e:
            logger.error(f"Notify waitlist failed for {p.get('id')}: {e}")
    return {"updated": result.modified_count, "notified": len(to_notify)}


@api_router.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    r = await db.products.delete_one({"id": product_id})
    # Cascade delete variants
    await db.product_variants.delete_many({"product_id": product_id})
    return {"deleted": r.deleted_count}


# ---------- Admin: Product Variants ----------
class VariantsBulkReplace(BaseModel):
    """Replace semua variasi produk dengan daftar baru — support in-place update via `id`."""
    variants: List[ProductVariantCreate]


@api_router.get("/admin/products/{product_id}/variants")
async def admin_list_variants(product_id: str, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    rows = await db.product_variants.find(
        {"product_id": product_id},
        {"_id": 0},
    ).sort("display_order", 1).to_list(100)
    return rows


@api_router.put("/admin/products/{product_id}/variants")
async def admin_replace_variants(
    product_id: str,
    payload: VariantsBulkReplace,
    x_admin_password: Optional[str] = Header(None),
):
    """Bulk replace: existing variants dengan id → update in-place; tanpa id → insert;
    variants existing yang tidak ada di payload → dihapus.

    Enforce exclusivity: hanya boleh 1 is_recommended dan 1 is_best_value per produk.
    """
    await verify_admin(x_admin_password)
    prod = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not prod:
        raise HTTPException(404, "Produk tidak ditemukan")

    # Enforce exclusivity — jaga urutan: variant pertama yang punya flag = pemenang
    seen_rec = False
    seen_bv = False
    for v in payload.variants:
        if v.is_recommended:
            if seen_rec:
                v.is_recommended = False
            else:
                seen_rec = True
        if v.is_best_value:
            if seen_bv:
                v.is_best_value = False
            else:
                seen_bv = True

    existing = await db.product_variants.find({"product_id": product_id}, {"_id": 0, "id": 1}).to_list(200)
    existing_ids = {v["id"] for v in existing}
    incoming_ids: set[str] = set()

    for idx, v in enumerate(payload.variants):
        data = {
            "product_id": product_id,
            "name": v.name.strip() or f"Variasi {idx + 1}",
            "price": float(v.price or 0),
            "discount_price": (float(v.discount_price) if v.discount_price else None),
            "is_recommended": bool(v.is_recommended),
            "is_best_value": bool(v.is_best_value),
            "display_order": int(v.display_order if v.display_order is not None else idx),
            "is_active": bool(v.is_active),
        }
        if v.id and v.id in existing_ids:
            incoming_ids.add(v.id)
            await db.product_variants.update_one(
                {"id": v.id, "product_id": product_id},
                {"$set": data},
            )
        else:
            new_v = ProductVariant(**data)
            incoming_ids.add(new_v.id)
            await db.product_variants.insert_one(new_v.model_dump())

    # Hapus variants yang tidak ada di payload
    to_delete = existing_ids - incoming_ids
    if to_delete:
        await db.product_variants.delete_many({"id": {"$in": list(to_delete)}, "product_id": product_id})

    # Auto-sync product.has_variants + starting price
    active_variants = await db.product_variants.find(
        {"product_id": product_id, "is_active": True}, {"_id": 0}
    ).to_list(100)
    has_active = len(active_variants) > 0
    prod_update = {"has_variants": has_active}
    if has_active:
        prices = [
            float(v.get("discount_price") if v.get("discount_price") else v.get("price", 0))
            for v in active_variants
        ]
        prod_update["original_price"] = min(prices) if prices else prod.get("original_price", 0)
    await db.products.update_one({"id": product_id}, {"$set": prod_update})

    final_rows = await db.product_variants.find(
        {"product_id": product_id}, {"_id": 0}
    ).sort("display_order", 1).to_list(100)
    return {"variants": final_rows, "has_variants": has_active}


@api_router.get("/admin/orders")
async def admin_list_orders(x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api_router.patch("/admin/orders/{order_id}/status")
async def admin_update_order_status(order_id: str, payload: StatusUpdate, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    if payload.status not in ("confirmed", "cancelled"):
        raise HTTPException(400, "Status tidak valid")
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order tidak ditemukan")
    if order["status"] != "pending":
        raise HTTPException(400, "Order sudah diproses")

    await db.orders.update_one({"id": order_id}, {"$set": {"status": payload.status}})

    # === NOTIF KE PEMBELI via Bot Publik (jika chat_id tersimpan) ===
    try:
        await _notify_buyer_order_status(order, payload.status)
    except Exception as e:
        logger.error(f"Notify buyer order status failed: {e}")

    # If confirmed: decrement stock (kalau stock_limit_enabled) & add commission
    if payload.status == "confirmed":
        prod = await db.products.find_one({"id": order.get("product_id")}, {"_id": 0})
        if prod and prod.get("stock_limit_enabled"):
            new_qty = max(0, int(prod.get("stock_quantity", 0)) - 1)
            update_data = {"stock_quantity": new_qty}
            if new_qty <= 0:
                update_data["stock_status"] = "unavailable"
            await db.products.update_one({"id": prod["id"]}, {"$set": update_data})
            try:
                await _check_and_notify_low_stock(prod["id"])
            except Exception as e:
                logger.error(f"Low stock alert failed: {e}")

        # Referral commission
        if order.get("referral_affiliate_code") and order.get("commission_amount", 0) > 0:
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
    await verify_admin(x_admin_password)
    affs = await db.affiliates.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # total sales per affiliate (single aggregation, avoids N+1)
    pipeline = [
        {"$match": {"status": "confirmed"}},
        {"$group": {"_id": "$referral_affiliate_code", "count": {"$sum": 1}}},
    ]
    sales_map = {r["_id"]: r["count"] for r in await db.orders.aggregate(pipeline).to_list(5000)}
    for a in affs:
        a["total_sales"] = sales_map.get(a["affiliate_code"], 0)
    return affs


@api_router.get("/admin/withdrawals")
async def admin_list_withdrawals(x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    return await db.withdrawals.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api_router.patch("/admin/withdrawals/{wd_id}/status")
async def admin_update_withdrawal(wd_id: str, payload: StatusUpdate, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
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


# ---------- Admin Dashboard / Evaluasi ----------
def _start_of_day_utc(dt: datetime) -> datetime:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


@api_router.get("/admin/dashboard")
async def admin_dashboard(x_admin_password: Optional[str] = Header(None)):
    """Return aggregated metrics for the admin evaluation dashboard.

    All numbers are computed from real `orders`, `affiliates`, and `withdrawals`
    collections — no mock data.
    """
    await verify_admin(x_admin_password)

    now = datetime.now(timezone.utc)
    today_start = _start_of_day_utc(now)
    week_start = today_start - timedelta(days=6)  # last 7 days incl. today
    month_start = today_start - timedelta(days=29)  # last 30 days incl. today

    today_iso = today_start.isoformat()
    week_iso = week_start.isoformat()
    month_iso = month_start.isoformat()

    paid_match = {"status": "confirmed"}

    async def _agg(start_iso: str):
        pipeline = [
            {"$match": {**paid_match, "created_at": {"$gte": start_iso}}},
            {
                "$group": {
                    "_id": None,
                    "count": {"$sum": 1},
                    "revenue": {
                        "$sum": {
                            "$ifNull": ["$pakasir_total", "$product_price"]
                        }
                    },
                }
            },
        ]
        rows = await db.orders.aggregate(pipeline).to_list(1)
        if not rows:
            return {"count": 0, "revenue": 0.0}
        return {"count": int(rows[0]["count"]), "revenue": float(rows[0]["revenue"] or 0)}

    today_stats = await _agg(today_iso)
    week_stats = await _agg(week_iso)
    month_stats = await _agg(month_iso)

    # Active affiliates = those with at least 1 confirmed order OR balance > 0
    active_aff_codes = set()
    sales_pipeline = [
        {"$match": {**paid_match, "referral_affiliate_code": {"$ne": None}}},
        {"$group": {"_id": "$referral_affiliate_code"}},
    ]
    async for r in db.orders.aggregate(sales_pipeline):
        if r.get("_id"):
            active_aff_codes.add(r["_id"])
    async for a in db.affiliates.find({"balance": {"$gt": 0}}, {"affiliate_code": 1, "_id": 0}):
        if a.get("affiliate_code"):
            active_aff_codes.add(a["affiliate_code"])
    active_affiliates = len(active_aff_codes)

    # Total commission paid out = sum of approved withdrawals
    wd_pipeline = [
        {"$match": {"status": "approved"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    wd_rows = await db.withdrawals.aggregate(wd_pipeline).to_list(1)
    total_commission_paid = float(wd_rows[0]["total"]) if wd_rows else 0.0

    # Total commission earned (all-time) across affiliates
    earned_rows = await db.affiliates.aggregate(
        [{"$group": {"_id": None, "total": {"$sum": "$total_earned"}}}]
    ).to_list(1)
    total_commission_earned = float(earned_rows[0]["total"]) if earned_rows else 0.0

    # Top products by confirmed order count
    top_pipeline = [
        {"$match": paid_match},
        {
            "$group": {
                "_id": "$product_id",
                "name": {"$first": "$product_name"},
                "orders": {"$sum": 1},
                "revenue": {
                    "$sum": {"$ifNull": ["$pakasir_total", "$product_price"]}
                },
            }
        },
        {"$sort": {"orders": -1}},
        {"$limit": 5},
    ]
    top_products = []
    async for r in db.orders.aggregate(top_pipeline):
        top_products.append(
            {
                "product_id": r["_id"],
                "name": r.get("name") or "Produk",
                "orders": int(r["orders"]),
                "revenue": float(r["revenue"] or 0),
            }
        )

    # 7-day trend (UTC days)
    trend = []
    for i in range(6, -1, -1):
        day_start = today_start - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        pipeline = [
            {
                "$match": {
                    **paid_match,
                    "created_at": {
                        "$gte": day_start.isoformat(),
                        "$lt": day_end.isoformat(),
                    },
                }
            },
            {
                "$group": {
                    "_id": None,
                    "count": {"$sum": 1},
                    "revenue": {
                        "$sum": {"$ifNull": ["$pakasir_total", "$product_price"]}
                    },
                }
            },
        ]
        rows = await db.orders.aggregate(pipeline).to_list(1)
        if rows:
            trend.append(
                {
                    "date": day_start.date().isoformat(),
                    "orders": int(rows[0]["count"]),
                    "revenue": float(rows[0]["revenue"] or 0),
                }
            )
        else:
            trend.append(
                {
                    "date": day_start.date().isoformat(),
                    "orders": 0,
                    "revenue": 0.0,
                }
            )

    return {
        "today": today_stats,
        "week": week_stats,
        "month": month_stats,
        "active_affiliates": active_affiliates,
        "total_commission_paid": total_commission_paid,
        "total_commission_earned": total_commission_earned,
        "top_products": top_products,
        "trend_7d": trend,
    }


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
        # Read current discount percentage from settings
        settings_doc = await db.settings.find_one({"id": "stats"}, {"_id": 0}) or {}
        pct = int(settings_doc.get("loyalty_discount_percent", 10))
        code = _gen_disc_code()
        while await db.discount_codes.find_one({"code": code}):
            code = _gen_disc_code()
        doc = {
            "id": str(uuid.uuid4()),
            "member_id": member["id"],
            "member_name": member["name"],
            "member_whatsapp": member["whatsapp"],
            "code": code,
            "percentage": pct,
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
    await verify_admin(x_admin_password)
    members = await db.loyalty_members.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    member_ids = [m["id"] for m in members]
    all_checkins = await db.checkins.find(
        {"member_id": {"$in": member_ids}}, {"_id": 0, "member_id": 1, "checkin_date": 1}
    ).to_list(50000)
    checkins_map = {}
    for c in all_checkins:
        checkins_map.setdefault(c["member_id"], []).append(c["checkin_date"])
    for m in members:
        m["streak"] = _calc_streak(checkins_map.get(m["id"], []))
    return members


@api_router.get("/admin/loyalty/codes")
async def admin_loyalty_codes(x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
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
    """Chat endpoint using Google Generative AI SDK (gemini-2.5-flash).

    Gracefully returns an "offline" reply when GEMINI_API_KEY is not configured,
    so the chat widget can show a friendly fallback instead of erroring out.
    """
    session_id = payload.session_id or str(uuid.uuid4())

    if not GEMINI_API_KEY:
        return {
            "reply": "Asisten sedang offline. Mohon hubungi admin via WhatsApp (link di pojok kanan bawah) atau coba lagi nanti ya 🙏",
            "session_id": session_id,
            "offline": True,
        }

    try:
        import google.generativeai as genai
    except Exception as e:
        logger.error(f"google-generativeai import error: {e}")
        return {
            "reply": "Asisten sedang offline. Coba lagi sebentar ya 🙏",
            "session_id": session_id,
            "offline": True,
        }

    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=CHAT_SYSTEM_PROMPT,
        )
        # Single-turn for now (session_id reserved for future conversation memory)
        resp = await model.generate_content_async(payload.message)
        text = (getattr(resp, "text", None) or "").strip()
        if not text:
            text = "Maaf, saya belum bisa menjawab itu. Coba pertanyaan lain ya 🙂"
        return {"reply": text, "session_id": session_id}
    except Exception as e:
        logger.error(f"Gemini error: {e}")
        return {
            "reply": "Maaf, AI sedang sibuk. Coba lagi sebentar 🙏",
            "session_id": session_id,
            "offline": True,
        }


# ---------- Helpers for export period parsing ----------
def _parse_period(period: str, start: Optional[str], end: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """Return (start_iso, end_iso) in UTC for the given period.

    period: today | week | month | custom | all
    For custom, start/end are YYYY-MM-DD strings (inclusive).
    """
    now = datetime.now(timezone.utc)
    today_start = _start_of_day_utc(now)
    if period == "today":
        return today_start.isoformat(), (today_start + timedelta(days=1)).isoformat()
    if period == "week":
        return (today_start - timedelta(days=6)).isoformat(), (today_start + timedelta(days=1)).isoformat()
    if period == "month":
        return (today_start - timedelta(days=29)).isoformat(), (today_start + timedelta(days=1)).isoformat()
    if period == "custom":
        try:
            s = datetime.fromisoformat(start).replace(tzinfo=timezone.utc) if start else None
            e = datetime.fromisoformat(end).replace(tzinfo=timezone.utc) if end else None
            if e:
                e = e + timedelta(days=1)  # inclusive end
            return (s.isoformat() if s else None, e.isoformat() if e else None)
        except Exception:
            raise HTTPException(400, "Format tanggal tidak valid. Gunakan YYYY-MM-DD.")
    # "all" or unknown -> no filter
    return None, None


def _orders_filter(start_iso: Optional[str], end_iso: Optional[str]) -> dict:
    f: dict = {}
    if start_iso or end_iso:
        rng = {}
        if start_iso:
            rng["$gte"] = start_iso
        if end_iso:
            rng["$lt"] = end_iso
        f["created_at"] = rng
    return f


def _filename(prefix: str, fmt: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    ext = "xlsx" if fmt == "xlsx" else "csv"
    return f"{prefix}_{stamp}.{ext}"


# ---------- Admin: Export Orders ----------
@api_router.get("/admin/export/orders")
async def admin_export_orders(
    period: str = Query("week"),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    fmt: str = Query("xlsx"),
    x_admin_password: Optional[str] = Header(None),
):
    await verify_admin(x_admin_password)
    start_iso, end_iso = _parse_period(period, start, end)
    cursor = db.orders.find(_orders_filter(start_iso, end_iso), {"_id": 0}).sort("created_at", -1)
    orders = await cursor.to_list(10000)
    if fmt == "csv":
        data = exports.orders_to_csv(orders)
    else:
        data = exports.orders_to_xlsx(orders, sheet_name="Orders")
    fname = _filename(f"orders_{period}", fmt)
    return Response(
        content=data,
        media_type=exports.media_type(fmt),
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ---------- Admin: Customers (grouped by WhatsApp) ----------
@api_router.get("/admin/customers")
async def admin_customers(
    q: Optional[str] = Query(None),
    x_admin_password: Optional[str] = Header(None),
):
    await verify_admin(x_admin_password)
    pipeline = [
        {"$match": {"contact": {"$ne": None}}},
        {
            "$group": {
                "_id": "$contact",
                "name": {"$last": "$buyer_name"},
                "total_orders": {"$sum": 1},
                "total_spent": {
                    "$sum": {
                        "$cond": [
                            {"$eq": ["$status", "confirmed"]},
                            {"$ifNull": ["$pakasir_total", "$product_price"]},
                            0,
                        ]
                    }
                },
                "first_order_at": {"$min": "$created_at"},
                "last_order_at": {"$max": "$created_at"},
                "product_names": {"$push": "$product_name"},
            }
        },
        {"$sort": {"last_order_at": -1}},
    ]
    rows = await db.orders.aggregate(pipeline).to_list(5000)

    def _tier(count: int) -> str:
        if count >= 6:
            return "setia"
        if count >= 2:
            return "reguler"
        return "baru"

    def _favorite(names: List[str]) -> str:
        from collections import Counter
        if not names:
            return "-"
        counter = Counter([n for n in names if n])
        if not counter:
            return "-"
        return counter.most_common(1)[0][0]

    customers = [
        {
            "whatsapp": r["_id"] or "-",
            "name": r.get("name") or "-",
            "total_orders": int(r.get("total_orders") or 0),
            "total_spent": float(r.get("total_spent") or 0),
            "first_order_at": r.get("first_order_at"),
            "last_order_at": r.get("last_order_at"),
            "favorite_product": _favorite(r.get("product_names") or []),
            "tier": _tier(int(r.get("total_orders") or 0)),
        }
        for r in rows
        if r.get("_id")
    ]
    if q:
        ql = q.lower().strip()
        customers = [
            c for c in customers
            if ql in (c["name"] or "").lower() or ql in (c["whatsapp"] or "").lower()
        ]
    return customers


@api_router.get("/admin/customers/{whatsapp}/orders")
async def admin_customer_orders(whatsapp: str, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    orders = (
        await db.orders.find({"contact": whatsapp}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(500)
    )
    return orders


@api_router.get("/admin/export/customers")
async def admin_export_customers(
    fmt: str = Query("xlsx"),
    x_admin_password: Optional[str] = Header(None),
):
    await verify_admin(x_admin_password)
    customers = await admin_customers(q=None, x_admin_password=x_admin_password)
    if fmt == "csv":
        data = exports.customers_to_csv(customers)
    else:
        data = exports.customers_to_xlsx(customers)
    fname = _filename("customers", fmt)
    return Response(
        content=data,
        media_type=exports.media_type(fmt),
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ---------- Admin: Affiliate Export ----------
async def _affiliate_summary_with_orders(
    code: str, start_iso: Optional[str], end_iso: Optional[str]
):
    aff = await db.affiliates.find_one({"affiliate_code": code}, {"_id": 0})
    if not aff:
        raise HTTPException(404, "Affiliate tidak ditemukan")
    # Total sales (confirmed)
    sales_count = await db.orders.count_documents(
        {"referral_affiliate_code": code, "status": "confirmed"}
    )
    summary = {
        "name": aff.get("name"),
        "affiliate_code": aff.get("affiliate_code"),
        "balance": aff.get("balance", 0),
        "total_earned": aff.get("total_earned", 0),
        "total_withdrawn": aff.get("total_withdrawn", 0),
        "total_sales": sales_count,
    }
    f = {"referral_affiliate_code": code}
    rng = _orders_filter(start_iso, end_iso)
    if "created_at" in rng:
        f["created_at"] = rng["created_at"]
    orders = await db.orders.find(f, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return summary, orders


@api_router.get("/admin/export/affiliates/{code}")
async def admin_export_affiliate(
    code: str,
    period: str = Query("all"),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    fmt: str = Query("xlsx"),
    x_admin_password: Optional[str] = Header(None),
):
    await verify_admin(x_admin_password)
    start_iso, end_iso = _parse_period(period, start, end)
    summary, orders = await _affiliate_summary_with_orders(code, start_iso, end_iso)
    if fmt == "csv":
        data = exports.affiliate_to_csv(summary, orders)
    else:
        data = exports.affiliate_to_xlsx(summary, orders)
    fname = _filename(f"affiliate_{code}_{period}", fmt)
    return Response(
        content=data,
        media_type=exports.media_type(fmt),
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@api_router.get("/admin/export/affiliates")
async def admin_export_all_affiliates(
    period: str = Query("all"),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    fmt: str = Query("xlsx"),
    x_admin_password: Optional[str] = Header(None),
):
    await verify_admin(x_admin_password)
    start_iso, end_iso = _parse_period(period, start, end)
    affs = await db.affiliates.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    items: list = []
    for a in affs:
        summary, orders = await _affiliate_summary_with_orders(
            a["affiliate_code"], start_iso, end_iso
        )
        items.append({"summary": summary, "orders": orders})
    if fmt == "csv":
        data = exports.all_affiliates_to_csv(items)
    else:
        data = exports.all_affiliates_to_xlsx(items)
    fname = _filename(f"all_affiliates_{period}", fmt)
    return Response(
        content=data,
        media_type=exports.media_type(fmt),
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ---------- Admin: Trigger daily summary (manual test) ----------
@api_router.post("/admin/telegram/daily-summary/test")
async def admin_trigger_daily_summary(x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    text = await build_daily_summary(db)
    await send_telegram(text)
    return {"ok": True, "preview": text}


# ---------- Public: Order tracking (by order code OR WA) ----------
@api_router.get("/track-order")
async def track_order(
    order_code: Optional[str] = Query(None),
    contact: Optional[str] = Query(None),
):
    if not order_code and not contact:
        raise HTTPException(400, "Masukkan Order ID atau Nomor WhatsApp")

    if order_code:
        oc = order_code.strip().upper()
        order = await db.orders.find_one({"order_code": oc}, {"_id": 0})
        if not order:
            raise HTTPException(404, "Order tidak ditemukan")
        return {"orders": [_public_order_view(order)]}

    # Lookup by contact (WA) — normalize digits
    raw = (contact or "").strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    # Try both original and digits version; also strip leading 0
    candidates = list({raw, digits, digits.lstrip("0"), "62" + digits.lstrip("0"), digits.lstrip("62")})
    candidates = [c for c in candidates if c]
    orders = (
        await db.orders.find({"contact": {"$in": candidates}}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(200)
    )
    if not orders:
        raise HTTPException(404, "Tidak ada pesanan ditemukan untuk nomor ini")
    return {"orders": [_public_order_view(o) for o in orders]}


def _public_order_view(o: dict) -> dict:
    """Strip sensitive fields for public response."""
    return {
        "order_code": o.get("order_code"),
        "buyer_name": o.get("buyer_name"),
        "product_name": o.get("product_name"),
        "product_price": o.get("pakasir_total") or o.get("product_price"),
        "status": o.get("status"),
        "payment_method": o.get("payment_method"),
        "created_at": o.get("created_at"),
        "paid_at": o.get("paid_at"),
        "expires_at": o.get("expires_at"),
    }


# ---------- Uploads (product photos stored in MongoDB) ----------
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_IMAGE_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
}


@api_router.post("/admin/uploads")
async def admin_upload_image(
    request: Request,
    file: UploadFile = File(...),
    x_admin_password: Optional[str] = Header(None),
):
    await verify_admin(x_admin_password)

    # Defense-in-depth: reject oversized uploads before reading them into memory.
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > MAX_UPLOAD_BYTES + 8192:
        raise HTTPException(400, "Ukuran file maksimal 5MB")

    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "File harus berupa gambar (JPG/PNG/WEBP/GIF)")

    data = await file.read()
    size = len(data)
    if size > MAX_UPLOAD_BYTES:
        raise HTTPException(400, f"Ukuran file maksimal 5MB (saat ini {size / 1024 / 1024:.1f}MB)")
    if size == 0:
        raise HTTPException(400, "File kosong")

    upload_id = str(uuid.uuid4())
    doc = {
        "id": upload_id,
        "filename": file.filename or f"{upload_id}",
        "content_type": content_type,
        "size": size,
        "data": data,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.uploads.insert_one(doc)

    # Return relative URL — frontend prepends REACT_APP_BACKEND_URL.
    return {"url": f"/api/uploads/{upload_id}", "id": upload_id, "size": size}


@api_router.get("/uploads/{upload_id}")
async def get_upload(upload_id: str):
    doc = await db.uploads.find_one({"id": upload_id})
    if not doc:
        raise HTTPException(404, "Upload tidak ditemukan")
    return Response(
        content=doc["data"],
        media_type=doc.get("content_type", "application/octet-stream"),
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


# =============================================================================
# CATEGORIES ENDPOINTS
# =============================================================================

@api_router.get("/categories")
async def list_categories():
    cats = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(200)
    return cats


@api_router.post("/admin/categories")
async def admin_create_category(payload: CategoryCreate, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    exist = await db.categories.find_one({"slug": payload.slug}, {"_id": 0})
    if exist:
        raise HTTPException(400, "Slug kategori sudah ada")
    cat = Category(**payload.model_dump())
    await db.categories.insert_one(cat.model_dump())
    return cat.model_dump()


@api_router.put("/admin/categories/{cat_id}")
async def admin_update_category(cat_id: str, payload: CategoryCreate, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    exist = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    if not exist:
        raise HTTPException(404, "Kategori tidak ditemukan")
    # Jika slug berubah, update produk-produk lama supaya tetap ter-reference
    if payload.slug != exist["slug"]:
        await db.products.update_many({"category": exist["slug"]}, {"$set": {"category": payload.slug}})
    await db.categories.update_one({"id": cat_id}, {"$set": payload.model_dump()})
    return await db.categories.find_one({"id": cat_id}, {"_id": 0})


@api_router.delete("/admin/categories/{cat_id}")
async def admin_delete_category(cat_id: str, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    cat = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    if not cat:
        raise HTTPException(404, "Kategori tidak ditemukan")
    if cat["slug"] == "lainnya":
        raise HTTPException(400, "Kategori 'Lainnya' tidak bisa dihapus (fallback)")
    # Semua produk kategori ini dipindah ke 'lainnya'
    await db.products.update_many({"category": cat["slug"]}, {"$set": {"category": "lainnya"}})
    await db.categories.delete_one({"id": cat_id})
    return {"ok": True}


# =============================================================================
# WAITLIST ENDPOINTS
# =============================================================================

@api_router.post("/waitlist")
async def create_waitlist(payload: WaitlistCreate):
    # Validasi lembut: minimal 1 kontak yang bisa dihubungi (WA/Telegram atau Email)
    has_reachable = any([
        (payload.whatsapp_telegram or "").strip(),
        (payload.email or "").strip(),
    ])
    if not has_reachable:
        raise HTTPException(400, "Isi salah satu kontak ya, biar kami bisa kabarin kamu 🙂")

    product = await db.products.find_one({"id": payload.produk_id}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Produk tidak ditemukan")

    w = Waitlist(
        nama=(payload.nama or "").strip() or None,
        whatsapp_telegram=(payload.whatsapp_telegram or "").strip() or None,
        email=(payload.email or "").strip() or None,
        produk_id=product["id"],
        produk_nama=product["name"],
    )
    await db.waitlist.insert_one(w.model_dump())
    return {"ok": True, "id": w.id, "produk_nama": w.produk_nama}


@api_router.get("/admin/waitlist")
async def admin_list_waitlist(
    product_id: Optional[str] = Query(None),
    x_admin_password: Optional[str] = Header(None),
):
    await verify_admin(x_admin_password)
    q = {}
    if product_id:
        q["produk_id"] = product_id
    items = await db.waitlist.find(q, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return items


@api_router.delete("/admin/waitlist/{waitlist_id}")
async def admin_delete_waitlist(waitlist_id: str, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    r = await db.waitlist.delete_one({"id": waitlist_id})
    return {"deleted": r.deleted_count}


@api_router.get("/admin/waitlist/export")
async def admin_export_waitlist(
    product_id: Optional[str] = Query(None),
    fmt: str = Query("xlsx"),
    x_admin_password: Optional[str] = Header(None),
):
    await verify_admin(x_admin_password)
    q = {}
    if product_id:
        q["produk_id"] = product_id
    items = await db.waitlist.find(q, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return exports.export_waitlist(items, fmt)


# =============================================================================
# WAITLIST NOTIFICATION (dipanggil saat produk di-publish)
# =============================================================================

async def _notify_waitlist_on_publish(product: dict):
    """Kirim notif ke semua waitlist yang belum di-notify untuk produk ini."""
    entries = await db.waitlist.find(
        {"produk_id": product["id"], "notified": False}, {"_id": 0}
    ).to_list(5000)

    if not entries:
        # tetap kirim ringkasan ke admin bot
        await send_telegram(
            f"✅ Produk <b>{product['name']}</b> berhasil dipublish!\n"
            f"📣 Notifikasi terkirim ke 0 kontak waitlist (belum ada waitlist)"
        )
        return

    store_url = PUBLIC_STORE_URL
    tg_msg = (
        f"Halo Sobat Creative! 🎉\n"
        f"Produk yang kamu tunggu sudah tersedia nih!\n\n"
        f"✨ <b>{product['name']}</b>\n\n"
        f"Yuk langsung cek dan pesan sebelum kehabisan:\n"
        f"👉 {store_url}\n\n"
        f"— Tim CreativeStore"
    )
    email_subject = f"✨ {product['name']} Sudah Tersedia! — CreativeStore"
    email_html = f"""
<div style="font-family: -apple-system, Segoe UI, sans-serif; background: #0f1117; color: #fff; padding: 32px; border-radius: 16px; max-width: 560px; margin: 0 auto;">
  <h2 style="color: #F5A623; margin: 0 0 16px;">Halo Sobat Creative! 🎉</h2>
  <p style="color: #d0d0d0; line-height: 1.6;">Produk yang kamu tunggu sudah tersedia nih!</p>
  <div style="background: #1a1d27; border: 1px solid rgba(245,166,35,0.3); padding: 20px; border-radius: 12px; margin: 20px 0;">
    <p style="margin: 0; font-size: 20px; color: #F5A623; font-weight: 600;">✨ {product['name']}</p>
  </div>
  <p style="color: #d0d0d0; line-height: 1.6;">Yuk langsung cek dan pesan sebelum kehabisan:</p>
  <p style="text-align: center; margin: 24px 0;">
    <a href="{store_url}" style="display:inline-block; background:#F5A623; color:#0f1117; text-decoration:none; padding:12px 28px; border-radius:9999px; font-weight:600;">Pesan Sekarang →</a>
  </p>
  <p style="color: #999; font-size: 12px; text-align:center; margin-top: 32px;">— Tim CreativeStore</p>
</div>
"""

    sent_telegram = 0
    sent_email = 0
    for w in entries:
        via = []
        # Telegram: hanya bisa jika chat_id sudah terisi (user pernah /start bot publik)
        if w.get("telegram_chat_id"):
            ok = await send_public_telegram(w["telegram_chat_id"], tg_msg)
            if ok:
                sent_telegram += 1
                via.append("telegram")
        # Email
        if w.get("email"):
            ok = await send_email_resend(w["email"], email_subject, email_html)
            if ok:
                sent_email += 1
                via.append("email")

        await db.waitlist.update_one(
            {"id": w["id"]},
            {"$set": {"notified": True, "notified_via": ",".join(via) if via else "none"}},
        )

    total = len(entries)
    await send_telegram(
        f"✅ Produk <b>{product['name']}</b> berhasil dipublish!\n"
        f"📣 Notifikasi terkirim ke {total} kontak waitlist\n"
        f"   ({sent_telegram} via Telegram, {sent_email} via Email)"
    )


# =============================================================================
# TELEGRAM PUBLIC BOT WEBHOOK (menangkap /start dari user waitlist)
# =============================================================================

@api_router.post("/telegram/public-webhook")
async def public_telegram_webhook(request: Request):
    """Webhook Telegram BOT PUBLIK. User yang /start payload waitlist_<id>
    akan tersimpan chat_id-nya ke dokumen waitlist yang sesuai."""
    if not TELEGRAM_PUBLIC_BOT_TOKEN:
        return {"ok": False, "reason": "bot_not_configured"}
    try:
        body = await request.json()
    except Exception:
        return {"ok": False}

    msg = body.get("message") or body.get("edited_message") or {}
    chat = msg.get("chat") or {}
    chat_id = chat.get("id")
    text = (msg.get("text") or "").strip()

    if not chat_id:
        return {"ok": True}

    reply_text = None
    # Handle /start [payload]
    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        payload = parts[1] if len(parts) > 1 else ""
        if payload.startswith("waitlist_"):
            wid = payload.replace("waitlist_", "", 1)
            r = await db.waitlist.update_one(
                {"id": wid}, {"$set": {"telegram_chat_id": str(chat_id)}}
            )
            if r.modified_count:
                reply_text = (
                    "Sip! ✅ Notifikasi Telegram kamu udah aktif.\n"
                    "Nanti kami kabarin di sini kalau produknya udah ready ya, Sobat Creative! 💛"
                )
            else:
                reply_text = "Halo Sobat Creative! 👋 Kirim /start setelah daftar waitlist ya."
        else:
            reply_text = (
                "Halo Sobat Creative! 👋\n"
                "Aku bot notifikasi CreativeStore. Kunjungi https://creativestore.my.id "
                "dan daftar waitlist produk yang kamu tunggu — nanti aku kabarin ke sini!"
            )

    if reply_text:
        await send_public_telegram(str(chat_id), reply_text)
    return {"ok": True}


# =============================================================================
# GENERATE INFO PRODUK (Gemini)
# =============================================================================

@api_router.post("/admin/generate-info")
async def admin_generate_info(x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    if not GEMINI_API_KEY:
        raise HTTPException(
            400,
            "GEMINI_API_KEY belum dikonfigurasi. Isi environment variable GEMINI_API_KEY untuk aktifkan fitur ini.",
        )

    # Ambil semua produk PUBLISHED
    products = await db.products.find(
        {"publish_status": "published"}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    if not products:
        raise HTTPException(400, "Belum ada produk PUBLISHED untuk di-generate.")

    # Ambil kategori untuk mapping slug → nama
    cats = await db.categories.find({}, {"_id": 0}).to_list(200)
    cat_map = {c["slug"]: c["name"] for c in cats}

    # Susun data produk untuk prompt
    lines = []
    for p in products:
        badges = []
        if p.get("is_bestseller"):
            badges.append("TERLARIS")
        if p.get("discount_active") and p.get("discount_price"):
            badges.append("FLASH SALE")
        if p.get("is_promo"):
            badges.append("PROMO")
        price = p.get("discount_price") if (p.get("discount_active") and p.get("discount_price")) else p.get("original_price")
        cat_name = cat_map.get(p.get("category", "lainnya"), "Lainnya")
        lines.append(
            f"- {p['name']} | Kategori: {cat_name} | Harga: Rp {int(price):,} | Badge: {', '.join(badges) if badges else '-'}"
        )
    products_text = "\n".join(lines)

    system_prompt = f"""Kamu adalah copywriter untuk toko digital CreativeStore (creativestore.my.id).
Buat pesan informasi produk yang tersedia untuk dikirim ke grup WhatsApp/Telegram pelanggan.

Sapaan: Sobat Creative / Sahabat Creative
Nada: warm, friendly, tidak formal, tidak memaksa.
Domain toko: creativestore.my.id

Data produk yang tersedia (PUBLISHED):
{products_text}

Buat 2 versi TERPISAH dengan format sebagai berikut:

===VERSI SINGKAT===
(Maksimal 200 kata. Format ringkas dengan emoji. Highlight produk TERLARIS/PROMO/FLASH SALE jika ada. Cocok untuk status WA atau caption pendek.)

===VERSI LENGKAP===
(Maksimal 500 kata. Kelompokkan per kategori. Sebutkan harga tiap produk. Sertakan CTA ke creativestore.my.id. Sebutkan info promo/diskon jika ada. Tutup dengan ajakan bergabung menjadi affiliate untuk dapat komisi.)

PENTING: Gunakan pemisah persis "===VERSI SINGKAT===" dan "===VERSI LENGKAP===" agar bisa di-parse otomatis."""

    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(model_name="gemini-2.5-flash")
        resp = await model.generate_content_async(system_prompt)
        text = (getattr(resp, "text", None) or "").strip()
    except Exception as e:
        logger.error(f"Gemini generate-info error: {e}")
        raise HTTPException(502, f"Gemini error: {str(e)[:200]}")

    # Parse 2 versi
    versi_singkat = ""
    versi_lengkap = ""
    if "===VERSI SINGKAT===" in text and "===VERSI LENGKAP===" in text:
        parts = text.split("===VERSI LENGKAP===", 1)
        versi_singkat = parts[0].replace("===VERSI SINGKAT===", "").strip()
        versi_lengkap = parts[1].strip()
    else:
        versi_singkat = text
        versi_lengkap = text

    return {
        "versi_singkat": versi_singkat,
        "versi_lengkap": versi_lengkap,
        "total_produk": len(products),
    }


# =============================================================================
# HEALTH CHECK: Konfigurasi Integrasi
# =============================================================================

@api_router.get("/admin/integration-status")
async def admin_integration_status(x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    return {
        "telegram_admin": bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID),
        "telegram_public": bool(TELEGRAM_PUBLIC_BOT_TOKEN),
        "telegram_public_username": TELEGRAM_PUBLIC_BOT_USERNAME,
        "resend_email": bool(RESEND_API_KEY),
        "resend_from": RESEND_FROM_EMAIL,
        "gemini": bool(GEMINI_API_KEY),
        "pakasir": pakasir.is_configured(),
    }


# =============================================================================
# PRODUCT DETAIL: get by slug + get order for review eligibility
# =============================================================================

@api_router.get("/products/slug/{slug}")
async def get_product_by_slug(slug: str):
    p = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not p:
        # fallback: try find by id (backward compat)
        p = await db.products.find_one({"id": slug}, {"_id": 0})
        if not p:
            raise HTTPException(404, "Produk tidak ditemukan")
    return p


# =============================================================================
# REVIEWS ENDPOINTS
# =============================================================================

def _mask_name(name: str) -> str:
    """Riz*** style masking. Keep first 3 chars, mask rest."""
    if not name:
        return "Anonim"
    name = name.strip()
    if len(name) <= 3:
        return name + "***"
    return name[:3] + "***"


@api_router.get("/reviews")
async def list_reviews_public(product_id: Optional[str] = Query(None)):
    q = {"visible": True}
    if product_id:
        q["product_id"] = product_id
    items = await db.reviews.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    for it in items:
        it["buyer_name_masked"] = _mask_name(it.get("buyer_name", ""))
    return items


@api_router.get("/reviews/summary")
async def reviews_summary(product_id: str):
    """Rata-rata rating dan jumlah review per produk."""
    pipeline = [
        {"$match": {"product_id": product_id, "visible": True}},
        {"$group": {"_id": "$product_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]
    result = await db.reviews.aggregate(pipeline).to_list(1)
    if not result:
        return {"avg_rating": 0, "count": 0}
    return {"avg_rating": round(result[0]["avg"], 1), "count": result[0]["count"]}


@api_router.get("/orders/{order_code}/review-eligibility")
async def review_eligibility(order_code: str):
    """Check apakah order sudah selesai + belum ada review."""
    order = await db.orders.find_one({"order_code": order_code}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order tidak ditemukan")
    if order.get("status") != "confirmed":
        return {"eligible": False, "reason": "Order belum selesai"}
    existing = await db.reviews.find_one({"order_id": order["id"]}, {"_id": 0})
    if existing:
        return {"eligible": False, "reason": "Ulasan sudah diberikan", "existing": True}
    return {
        "eligible": True,
        "order_id": order["id"],
        "product_id": order["product_id"],
        "product_name": order["product_name"],
        "buyer_name": order["buyer_name"],
    }


@api_router.post("/reviews")
async def submit_review(payload: ReviewCreate):
    """Public endpoint: pembeli submit ulasan."""
    order = await db.orders.find_one({"id": payload.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order tidak ditemukan")
    if order.get("status") != "confirmed":
        raise HTTPException(400, "Ulasan hanya bisa diberikan untuk pesanan yang sudah Selesai")
    existing = await db.reviews.find_one({"order_id": payload.order_id}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Ulasan untuk order ini sudah pernah diberikan")
    rating = max(1, min(5, int(payload.rating)))
    r = Review(
        product_id=order["product_id"],
        product_name=order["product_name"],
        buyer_name=order["buyer_name"],
        order_id=order["id"],
        rating=rating,
        comment=(payload.comment or "").strip()[:1000],
        visible=True,
    )
    await db.reviews.insert_one(r.model_dump())
    return {"ok": True, "message": "Terima kasih ulasannya, Sobat Creative! 💛"}


@api_router.get("/admin/reviews")
async def admin_list_reviews(
    product_id: Optional[str] = Query(None),
    rating: Optional[int] = Query(None),
    visible: Optional[bool] = Query(None),
    x_admin_password: Optional[str] = Header(None),
):
    await verify_admin(x_admin_password)
    q = {}
    if product_id:
        q["product_id"] = product_id
    if rating:
        q["rating"] = rating
    if visible is not None:
        q["visible"] = visible
    return await db.reviews.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api_router.patch("/admin/reviews/{review_id}")
async def admin_update_review(review_id: str, payload: ReviewAdminUpdate, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    r = await db.reviews.update_one({"id": review_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Ulasan tidak ditemukan")
    return await db.reviews.find_one({"id": review_id}, {"_id": 0})


@api_router.delete("/admin/reviews/{review_id}")
async def admin_delete_review(review_id: str, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    r = await db.reviews.delete_one({"id": review_id})
    return {"deleted": r.deleted_count}


# =============================================================================
# FAQ ENDPOINTS
# =============================================================================

@api_router.get("/faqs")
async def list_faqs():
    return await db.faqs.find({"visible": True}, {"_id": 0}).sort("order", 1).to_list(200)


@api_router.get("/admin/faqs")
async def admin_list_faqs(x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    return await db.faqs.find({}, {"_id": 0}).sort("order", 1).to_list(500)


@api_router.post("/admin/faqs")
async def admin_create_faq(payload: FAQCreate, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    f = FAQ(**payload.model_dump())
    await db.faqs.insert_one(f.model_dump())
    return f.model_dump()


@api_router.put("/admin/faqs/{faq_id}")
async def admin_update_faq(faq_id: str, payload: FAQCreate, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    r = await db.faqs.update_one({"id": faq_id}, {"$set": payload.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "FAQ tidak ditemukan")
    return await db.faqs.find_one({"id": faq_id}, {"_id": 0})


@api_router.delete("/admin/faqs/{faq_id}")
async def admin_delete_faq(faq_id: str, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    r = await db.faqs.delete_one({"id": faq_id})
    return {"deleted": r.deleted_count}


# =============================================================================
# ABOUT US ENDPOINT
# =============================================================================

@api_router.get("/about")
async def get_about():
    doc = await db.about.find_one({"id": "about"}, {"_id": 0})
    if not doc:
        # return default
        return DEFAULT_ABOUT
    return doc


@api_router.put("/admin/about")
async def admin_update_about(payload: AboutUpdate, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    data = {"id": "about", **payload.model_dump()}
    await db.about.update_one({"id": "about"}, {"$set": data}, upsert=True)
    return data


# =============================================================================
# NOTIF PEMBELI SAAT STATUS ORDER BERUBAH (Bot Publik)
# =============================================================================

async def _find_buyer_telegram_chat_id(contact: str) -> Optional[str]:
    """Coba cari telegram_chat_id dari waitlist untuk kontak yang cocok."""
    if not contact:
        return None
    contact = contact.strip()
    # Cari waitlist entry dengan wa/tele match
    w = await db.waitlist.find_one(
        {"whatsapp_telegram": contact, "telegram_chat_id": {"$exists": True, "$ne": None}},
        {"_id": 0, "telegram_chat_id": 1},
    )
    if w and w.get("telegram_chat_id"):
        return w["telegram_chat_id"]
    return None


async def _notify_buyer_order_status(order: dict, new_status: str):
    """Kirim notif ke pembeli via bot publik jika chat_id ditemukan."""
    if not TELEGRAM_PUBLIC_BOT_TOKEN:
        return
    chat_id = await _find_buyer_telegram_chat_id(order.get("contact", ""))
    if not chat_id:
        return  # skip gracefully

    name = order.get("buyer_name", "Sobat Creative")
    product = order.get("product_name", "-")
    order_code = order.get("order_code", order.get("id", "-"))
    store_url = PUBLIC_STORE_URL

    if new_status == "confirmed":
        msg = (
            f"✅ <b>Pesanan Dikonfirmasi!</b>\n\n"
            f"Halo {name}! Pembayaran kamu sudah kami terima dan pesanan sedang diproses.\n\n"
            f"🛍️ <b>Produk:</b> {product}\n"
            f"📋 <b>Order ID:</b> {order_code}\n\n"
            f"Kami akan segera mengirimkan produkmu via WhatsApp/Telegram. "
            f"Tunggu sebentar ya, Sobat Creative! 💛\n\n"
            f"— Tim CreativeStore\n"
            f"🌐 {store_url}"
        )
    elif new_status == "completed" or new_status == "selesai":
        msg = (
            f"🎉 <b>Pesanan Selesai!</b>\n\n"
            f"Halo {name}! Produk kamu sudah dikirimkan. Selamat menikmati ya!\n\n"
            f"🛍️ <b>Produk:</b> {product}\n"
            f"📋 <b>Order ID:</b> {order_code}\n\n"
            f"Puas dengan pelayanan kami? Yuk kasih ulasan di halaman Lacak Pesanan 💫\n\n"
            f"— Tim CreativeStore\n"
            f"🌐 {store_url}"
        )
    elif new_status == "cancelled":
        msg = (
            f"❌ <b>Pesanan Dibatalkan</b>\n\n"
            f"Halo {name}, pesanan kamu dengan Order ID <b>{order_code}</b> telah dibatalkan.\n\n"
            f"Jika ada pertanyaan, hubungi kami langsung via WhatsApp/Telegram ya, Sobat Creative.\n\n"
            f"— Tim CreativeStore\n"
            f"🌐 {store_url}"
        )
    else:
        return

    await send_public_telegram(chat_id, msg)


# =============================================================================
# COUPONS ENDPOINTS
# =============================================================================

@api_router.get("/admin/coupons")
async def admin_list_coupons(x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    return await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/admin/coupons")
async def admin_create_coupon(payload: CouponCreate, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    data = payload.model_dump()
    data["code"] = data["code"].strip().upper()
    if not data["code"]:
        raise HTTPException(400, "Kode voucher tidak boleh kosong")
    exist = await db.coupons.find_one({"code": data["code"]}, {"_id": 0})
    if exist:
        raise HTTPException(400, "Kode voucher sudah ada")
    c = Coupon(**data)
    await db.coupons.insert_one(c.model_dump())
    return c.model_dump()


@api_router.put("/admin/coupons/{coupon_id}")
async def admin_update_coupon(coupon_id: str, payload: CouponCreate, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    data = payload.model_dump()
    data["code"] = data["code"].strip().upper()
    await db.coupons.update_one({"id": coupon_id}, {"$set": data})
    return await db.coupons.find_one({"id": coupon_id}, {"_id": 0})


@api_router.delete("/admin/coupons/{coupon_id}")
async def admin_delete_coupon(coupon_id: str, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    r = await db.coupons.delete_one({"id": coupon_id})
    return {"deleted": r.deleted_count}


@api_router.post("/coupons/validate")
async def validate_coupon(request: Request):
    """Public: validate coupon code untuk order flow. Return diskon."""
    body = await request.json()
    code = (body.get("code") or "").strip().upper()
    product_id = body.get("product_id")
    total = float(body.get("total") or 0)

    if not code:
        raise HTTPException(400, "Kode voucher tidak boleh kosong")

    coupon = await db.coupons.find_one({"code": code}, {"_id": 0})
    if not coupon or not coupon.get("active"):
        raise HTTPException(400, "Kode voucher tidak valid atau sudah expired ya, Sobat Creative 🥲")

    now = datetime.now(timezone.utc).isoformat()
    if coupon.get("valid_from") and now < coupon["valid_from"]:
        raise HTTPException(400, "Kode voucher belum aktif")
    if coupon.get("valid_until") and now > coupon["valid_until"]:
        raise HTTPException(400, "Kode voucher tidak valid atau sudah expired ya, Sobat Creative 🥲")

    if coupon.get("max_uses", 0) > 0 and int(coupon.get("uses_count", 0)) >= int(coupon["max_uses"]):
        raise HTTPException(400, "Kode voucher sudah mencapai batas penggunaan")

    if total < float(coupon.get("min_purchase", 0)):
        raise HTTPException(400, f"Minimum pembelian Rp {int(coupon['min_purchase']):,}")

    if coupon.get("applies_to") == "products":
        if not product_id or product_id not in coupon.get("product_ids", []):
            raise HTTPException(400, "Voucher ini tidak berlaku untuk produk ini")

    # Hitung diskon
    if coupon["discount_type"] == "percentage":
        discount = int(total * float(coupon["discount_value"]) / 100)
    else:
        discount = int(coupon["discount_value"])
    discount = min(discount, int(total))

    return {
        "valid": True,
        "code": coupon["code"],
        "discount_type": coupon["discount_type"],
        "discount_value": coupon["discount_value"],
        "discount_amount": discount,
        "final_total": max(0, int(total) - discount),
    }


# ---------- Banner Promo (slider hero) ----------
class Banner(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    image_url: str = ""
    title: str = ""
    subtitle: str = ""
    cta_text: str = ""
    cta_link: str = ""
    active: bool = True
    display_order: int = 100
    # Countdown & coupon linkage
    linked_coupon_code: str = ""  # kupon yang akan otomatis di-apply saat CTA diklik
    expires_at: str = ""  # ISO datetime string; kalau kosong & ada linked_coupon → pakai coupon.valid_until
    image_position: str = "center center"  # CSS object-position untuk banner image
    created_at: str = Field(default_factory=now_iso)


class BannerCreate(BaseModel):
    image_url: str = ""
    title: str = ""
    subtitle: str = ""
    cta_text: str = ""
    cta_link: str = ""
    active: bool = True
    display_order: int = 100
    linked_coupon_code: str = ""
    expires_at: str = ""
    image_position: str = "center center"


@api_router.get("/banners")
async def public_list_banners():
    """Public: banner aktif untuk storefront slider. Enrich dengan expires_at dari kupon terkait."""
    rows = await db.banners.find({"active": True}, {"_id": 0}).sort("display_order", 1).to_list(20)
    # Enrich expires_at kalau linked ke kupon tapi banner tidak override manual
    coupon_codes = list({b.get("linked_coupon_code") for b in rows if b.get("linked_coupon_code")})
    coupons = {}
    if coupon_codes:
        c_rows = await db.coupons.find({"code": {"$in": coupon_codes}}, {"_id": 0}).to_list(50)
        coupons = {c["code"]: c for c in c_rows}
    for b in rows:
        code = b.get("linked_coupon_code")
        if code and coupons.get(code) and not b.get("expires_at"):
            b["expires_at"] = coupons[code].get("valid_until") or ""
    return rows


@api_router.get("/admin/banners")
async def admin_list_banners(x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    return await db.banners.find({}, {"_id": 0}).sort("display_order", 1).to_list(50)


@api_router.post("/admin/banners")
async def admin_create_banner(payload: BannerCreate, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    data = payload.model_dump()
    data["image_url"] = _normalize_photo_url(data.get("image_url"))
    b = Banner(**data)
    await db.banners.insert_one(b.model_dump())
    return b.model_dump()


@api_router.put("/admin/banners/{banner_id}")
async def admin_update_banner(
    banner_id: str,
    payload: BannerCreate,
    x_admin_password: Optional[str] = Header(None),
):
    await verify_admin(x_admin_password)
    data = payload.model_dump()
    data["image_url"] = _normalize_photo_url(data.get("image_url"))
    await db.banners.update_one({"id": banner_id}, {"$set": data})
    return await db.banners.find_one({"id": banner_id}, {"_id": 0})


@api_router.delete("/admin/banners/{banner_id}")
async def admin_delete_banner(banner_id: str, x_admin_password: Optional[str] = Header(None)):
    await verify_admin(x_admin_password)
    r = await db.banners.delete_one({"id": banner_id})
    return {"deleted": r.deleted_count}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


# ---------- Scheduler (daily Telegram summary at 08:00 WIB) ----------
_scheduler = None


@app.on_event("startup")
async def _start_scheduler():
    global _scheduler
    # Migration: pastikan produk existing punya field publish_status & category
    try:
        migrated_status = await db.products.update_many(
            {"publish_status": {"$exists": False}},
            {"$set": {"publish_status": "published"}},
        )
        migrated_cat = await db.products.update_many(
            {"category": {"$exists": False}},
            {"$set": {"category": "lainnya"}},
        )
        migrated_bs = await db.products.update_many(
            {"is_bestseller": {"$exists": False}},
            {"$set": {"is_bestseller": False, "is_promo": False}},
        )
        if migrated_status.modified_count or migrated_cat.modified_count or migrated_bs.modified_count:
            logger.info(
                f"Product migration: publish_status={migrated_status.modified_count}, "
                f"category={migrated_cat.modified_count}, badges={migrated_bs.modified_count}"
            )
    except Exception as e:
        logger.error(f"Product migration error: {e}")

    # Seed kategori default kalau kosong
    try:
        count = await db.categories.count_documents({})
        if count == 0:
            docs = [Category(**c).model_dump() for c in DEFAULT_CATEGORIES]
            await db.categories.insert_many(docs)
            logger.info(f"Seeded {len(docs)} default categories")
    except Exception as e:
        logger.error(f"Category seed error: {e}")

    # Seed FAQ default kalau kosong
    try:
        faq_count = await db.faqs.count_documents({})
        if faq_count == 0:
            default_faqs = [
                {"question": "Bagaimana cara order?", "answer": "Pilih produk yang kamu inginkan, klik \"Pesan Sekarang\", isi nama dan kontak WA/Telegram, pilih metode pembayaran, lalu ikuti instruksi pembayaran. Tim kami akan memproses pesanan dalam 1x24 jam hari kerja.", "order": 1},
                {"question": "Metode pembayaran apa saja yang tersedia?", "answer": "Kami menerima QRIS (otomatis via Pakasir) dan Transfer Bank. Semua metode bisa dipilih saat checkout.", "order": 2},
                {"question": "Berapa lama pesanan diproses?", "answer": "Pesanan diproses dalam 1x24 jam hari kerja setelah pembayaran dikonfirmasi. Produk akan dikirim via WhatsApp atau Telegram sesuai kontak yang kamu berikan.", "order": 3},
                {"question": "Apakah ada program affiliate?", "answer": "Ya! Kamu bisa bergabung sebagai Partner Affiliate dan dapatkan komisi 10-15% untuk setiap penjualan dari link referral kamu. Daftar di halaman Partnership.", "order": 4},
                {"question": "Bagaimana jika ada kendala setelah pembelian?", "answer": "Hubungi kami langsung via WhatsApp atau Telegram yang tertera di website. Tim kami siap membantu Sobat Creative!", "order": 5},
            ]
            docs = [FAQ(**f).model_dump() for f in default_faqs]
            await db.faqs.insert_many(docs)
            logger.info(f"Seeded {len(docs)} default FAQs")
    except Exception as e:
        logger.error(f"FAQ seed error: {e}")

    # Migrasi produk lama: pastikan punya slug
    try:
        cursor = db.products.find({"$or": [{"slug": {"$exists": False}}, {"slug": ""}]}, {"_id": 0, "id": 1, "name": 1})
        old_products = await cursor.to_list(1000)
        for p in old_products:
            new_slug = await _generate_unique_slug(p.get("name", "produk"), ignore_id=p["id"])
            await db.products.update_one({"id": p["id"]}, {"$set": {"slug": new_slug}})
        if old_products:
            logger.info(f"Migrated {len(old_products)} product slugs")
    except Exception as e:
        logger.error(f"Product slug migration error: {e}")

    # Migrasi produk: pastikan punya stock_limit_enabled & stock_quantity
    try:
        await db.products.update_many(
            {"stock_limit_enabled": {"$exists": False}},
            {"$set": {"stock_limit_enabled": False, "stock_quantity": 0}},
        )
    except Exception as e:
        logger.error(f"Stock migration error: {e}")

    # Seed banner default kalau kosong
    try:
        banner_count = await db.banners.count_documents({})
        if banner_count == 0:
            default_banner = Banner(
                image_url="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200",
                title="Selamat Datang di CreativeStore!",
                subtitle="Digital goods premium untuk Sobat Creative ✨",
                cta_text="Lihat Katalog",
                cta_link="#products",
                active=True,
                display_order=1,
            )
            await db.banners.insert_one(default_banner.model_dump())
            logger.info("Seeded default banner")
    except Exception as e:
        logger.error(f"Banner seed error: {e}")

    try:
        _scheduler = init_scheduler(db, send_telegram)
        _scheduler.start()
        logger.info("Daily Telegram summary scheduler started (08:00 WIB)")
    except Exception as e:
        logger.error(f"Scheduler init failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    global _scheduler
    try:
        if _scheduler:
            _scheduler.shutdown(wait=False)
    except Exception:
        pass
    client.close()
