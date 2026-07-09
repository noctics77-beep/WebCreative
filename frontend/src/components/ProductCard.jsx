import { formatIDR, resolveImageUrl } from "@/lib/api";
import { highlightMatch } from "@/components/SearchBar";
import StockBadge from "@/components/StockBadge";
import { ShoppingBag, Bell, Flame, Zap, Sparkles, Tag, Hourglass } from "lucide-react";

/**
 * Hitung badge otomatis berdasarkan data produk.
 * Return array of {key, label, icon, className}
 */
function computeBadges(product) {
  const badges = [];
  const isDraft = product.publish_status === "draft";

  if (isDraft) {
    badges.push({
      key: "coming",
      label: "Coming Soon",
      icon: <Hourglass size={11} />,
      className: "badge-coming",
    });
    return badges; // Coming Soon override lainnya
  }

  if (product.is_bestseller) {
    badges.push({
      key: "bestseller",
      label: "Terlaris",
      icon: <Flame size={11} />,
      className: "badge-bestseller",
    });
  }
  const hasDiscount =
    product.discount_active && product.discount_price && product.discount_price < product.original_price;
  if (hasDiscount) {
    badges.push({
      key: "flash",
      label: "Flash Sale",
      icon: <Zap size={11} />,
      className: "badge-flash",
    });
  }
  // BARU: created 7 hari terakhir
  if (product.created_at) {
    const created = new Date(product.created_at);
    const diffDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays >= 0 && diffDays <= 7) {
      badges.push({
        key: "new",
        label: "Baru",
        icon: <Sparkles size={11} />,
        className: "badge-new",
      });
    }
  }
  if (product.is_promo) {
    badges.push({
      key: "promo",
      label: "Promo",
      icon: <Tag size={11} />,
      className: "badge-promo",
    });
  }
  return badges;
}

export default function ProductCard({ product, onOrder, onWaitlist, query }) {
  const isDraft = product.publish_status === "draft";
  const hasDiscount =
    product.discount_active && product.discount_price && product.discount_price < product.original_price;
  const finalPrice = hasDiscount ? product.discount_price : product.original_price;
  const stockOut =
    !isDraft &&
    product.stock_limit_enabled &&
    parseInt(product.stock_quantity || 0, 10) <= 0;
  const available = product.stock_status === "available" && !stockOut;
  const badges = computeBadges(product);

  return (
    <div
      data-testid={`product-card-${product.id}`}
      data-status={isDraft ? "draft" : "published"}
      onClick={() => {
        if (isDraft) onWaitlist && onWaitlist(product);
        else onOrder && onOrder(product);
      }}
      className="glass hover-card-lift rounded-2xl overflow-hidden flex flex-col relative cursor-pointer"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#0a0c12]">
        <img
          src={resolveImageUrl(product.photo_url)}
          alt={product.name}
          className={`w-full h-full object-cover ${isDraft ? "opacity-40" : ""}`}
          onError={(e) => {
            e.currentTarget.src =
              "https://images.unsplash.com/photo-1625838144804-300f3907c110?w=800";
          }}
        />
        {/* Coming Soon overlay */}
        {isDraft && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        )}

        {/* Badge stack pojok kiri atas */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {badges.map((b) => (
            <span
              key={b.key}
              className={`badge-anim inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${b.className}`}
            >
              {b.icon} {b.label}
            </span>
          ))}
        </div>

        {/* Stok habis overlay hanya jika bukan draft */}
        {!isDraft && !available && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <span className="px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs uppercase tracking-widest">
              Stok Habis
            </span>
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-display text-lg text-white">
          {query ? highlightMatch(product.name, query) : product.name}
        </h3>
        {!isDraft && product.monthly_sold > 0 && (
          <div
            data-testid={`monthly-sold-${product.id}`}
            className="text-sm text-[#F5A623] font-medium mt-1 flex items-center gap-1"
          >
            🔥 {product.monthly_sold} terjual bulan ini
          </div>
        )}
        {!isDraft && <div className="mt-1"><StockBadge product={product} /></div>}
        <p className="text-sm text-white/55 mt-1 line-clamp-2 flex-1">
          {query ? highlightMatch(product.description, query) : product.description}
        </p>
        <div className="mt-4 flex items-end justify-between">
          <div>
            {isDraft ? (
              <div className="text-lg font-display font-semibold text-white/70 italic">
                Segera Hadir
              </div>
            ) : (
              <>
                {hasDiscount && (
                  <div className="text-xs text-white/40 line-through">
                    {formatIDR(product.original_price)}
                  </div>
                )}
                <div className="text-xl font-display font-semibold gold-text">
                  {formatIDR(finalPrice)}
                </div>
              </>
            )}
          </div>
          {isDraft ? (
            <button
              data-testid={`notify-me-btn-${product.id}`}
              onClick={(e) => { e.stopPropagation(); onWaitlist && onWaitlist(product); }}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 text-sm font-medium px-4 py-2 rounded-full transition-colors"
            >
              <Bell size={15} /> Beritahu Saya
            </button>
          ) : (
            <button
              data-testid={`order-now-btn-${product.id}`}
              disabled={!available}
              onClick={(e) => { e.stopPropagation(); onOrder(product); }}
              className="inline-flex items-center gap-2 bg-[#F5A623] disabled:bg-white/10 disabled:text-white/40 hover:bg-[#d98f1a] text-[#0f1117] text-sm font-semibold px-4 py-2 rounded-full transition-colors"
            >
              <ShoppingBag size={15} /> {stockOut ? "Stok Habis" : "Pesan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
