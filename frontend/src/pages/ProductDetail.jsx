import { useEffect, useState } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { api, formatIDR, resolveImageUrl } from "@/lib/api";
import OrderModal from "@/components/OrderModal";
import WaitlistModal from "@/components/WaitlistModal";
import ReviewSection from "@/components/ReviewSection";
import ShareButtons from "@/components/ShareButtons";
import StockBadge from "@/components/StockBadge";
import { ArrowLeft, ShoppingBag, Bell, Flame, Zap, Sparkles, Tag, Hourglass, Check, ChevronRight, Loader2 } from "lucide-react";

function computeBadges(product) {
  const badges = [];
  const isDraft = product.publish_status === "draft";
  if (isDraft) {
    badges.push({ key: "coming", label: "Coming Soon", icon: <Hourglass size={12} />, className: "badge-coming" });
    return badges;
  }
  if (product.is_bestseller) badges.push({ key: "bs", label: "Terlaris", icon: <Flame size={12} />, className: "badge-bestseller" });
  if (product.discount_active && product.discount_price) badges.push({ key: "fs", label: "Flash Sale", icon: <Zap size={12} />, className: "badge-flash" });
  if (product.created_at) {
    const d = (Date.now() - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (d >= 0 && d <= 7) badges.push({ key: "new", label: "Baru", icon: <Sparkles size={12} />, className: "badge-new" });
  }
  if (product.is_promo) badges.push({ key: "pr", label: "Promo", icon: <Tag size={12} />, className: "badge-promo" });
  return badges;
}

/** Parse deskripsi jadi bullet items kalau ada baris yang mulai dengan • / - / *  */
function parseFeatures(desc) {
  if (!desc) return { intro: "", features: [] };
  const lines = desc.split(/\r?\n/);
  const features = [];
  const introLines = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/^[•\-\*]\s+/.test(t)) {
      features.push(t.replace(/^[•\-\*]\s+/, ""));
    } else {
      introLines.push(t);
    }
  }
  return { intro: introLines.join("\n\n"), features };
}

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const referral = params.get("ref");
  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOrder, setShowOrder] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/products/slug/${slug}`),
      api.get("/categories"),
    ])
      .then(([pr, cr]) => {
        setProduct(pr.data);
        setCategories(cr.data);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <Loader2 className="animate-spin mx-auto text-[#F5A623]" size={32} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="font-display text-2xl mb-2">Produk tidak ditemukan</h1>
        <p className="text-white/50 mb-6">Mungkin sudah dihapus atau URL salah.</p>
        <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F5A623] text-[#0f1117] font-semibold">
          <ArrowLeft size={16} /> Kembali ke Toko
        </Link>
      </div>
    );
  }

  const isDraft = product.publish_status === "draft";
  const hasDiscount = product.discount_active && product.discount_price;
  const finalPrice = hasDiscount ? product.discount_price : product.original_price;
  const badges = computeBadges(product);
  const { intro, features } = parseFeatures(product.description);
  const catName = categories.find((c) => c.slug === product.category)?.name || "Lainnya";

  const stockOut =
    !isDraft && product.stock_limit_enabled && parseInt(product.stock_quantity || 0, 10) <= 0;

  return (
    <div data-testid="product-detail-page" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Kembali + Breadcrumb */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <button
          data-testid="btn-back-to-store"
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-[#F5A623] transition-colors"
        >
          <ArrowLeft size={16} /> Kembali ke Toko
        </button>
        <nav className="text-xs text-white/50 flex items-center gap-1 flex-wrap" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-[#F5A623]">Beranda</Link>
          <ChevronRight size={12} />
          <span>{catName}</span>
          <ChevronRight size={12} />
          <span className="text-white/80 truncate max-w-[200px]">{product.name}</span>
        </nav>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Photo */}
        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-[#0a0c12] border border-white/5">
          <img
            src={resolveImageUrl(product.photo_url)}
            alt={product.name}
            className={`w-full h-full object-cover ${isDraft ? "opacity-40" : ""}`}
            onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1625838144804-300f3907c110?w=800"; }}
          />
          {isDraft && <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/70" />}
          <div className="absolute top-4 left-4 flex flex-col gap-1.5">
            {badges.map((b) => (
              <span key={b.key} className={`badge-anim inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${b.className}`}>
                {b.icon} {b.label}
              </span>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <h1 className="font-display text-3xl md:text-4xl leading-tight">{product.name}</h1>
          <div className="text-sm text-white/50 mt-1">{catName}</div>

          <div className="mt-4">
            {isDraft ? (
              <div className="text-2xl font-display italic text-white/70">Segera Hadir</div>
            ) : (
              <>
                {hasDiscount && (
                  <div className="text-white/40 line-through text-sm">{formatIDR(product.original_price)}</div>
                )}
                <div className="text-3xl md:text-4xl font-display font-semibold gold-text">{formatIDR(finalPrice)}</div>
                <div className="mt-2">
                  <StockBadge product={product} size="lg" />
                </div>
              </>
            )}
          </div>

          {intro && (
            <p className="mt-6 text-white/80 leading-relaxed whitespace-pre-line">{intro}</p>
          )}

          {features.length > 0 && (
            <div className="mt-5">
              <h3 className="font-display text-lg mb-3">Keunggulan Produk</h3>
              <ul className="space-y-2">
                {features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                    <Check size={16} className="text-[#F5A623] flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA */}
          <div className="mt-6">
            {isDraft ? (
              <button
                data-testid="detail-notify-btn"
                onClick={() => setShowWaitlist(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium px-6 py-3 rounded-full transition-colors"
              >
                <Bell size={16} /> Beritahu Saya
              </button>
            ) : (
              <button
                data-testid="detail-order-btn"
                onClick={() => setShowOrder(true)}
                disabled={stockOut}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#F5A623] disabled:bg-white/10 disabled:text-white/40 hover:bg-[#d98f1a] text-[#0f1117] text-base font-semibold px-8 py-3 rounded-full transition-colors"
              >
                <ShoppingBag size={17} /> {stockOut ? "Stok Habis" : "Pesan Sekarang"}
              </button>
            )}
          </div>

          <div className="mt-6">
            <ShareButtons product={product} />
          </div>
        </div>
      </div>

      {/* Ulasan */}
      <ReviewSection productId={product.id} />

      <OrderModal
        open={showOrder}
        product={product}
        referral={referral}
        onClose={() => setShowOrder(false)}
      />
      <WaitlistModal
        open={showWaitlist}
        product={product}
        onClose={() => setShowWaitlist(false)}
      />
    </div>
  );
}
