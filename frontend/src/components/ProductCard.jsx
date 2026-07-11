import { formatIDR, resolveImageUrl } from "@/lib/api";
import { highlightMatch } from "@/components/SearchBar";
import StockBadge from "@/components/StockBadge";
import { ShoppingBag, Bell, Flame, Zap, Sparkles, Tag, Hourglass } from "lucide-react";

function computeBadges(product) {
  const badges = [];
  const isDraft = product.publish_status === "draft";
  if (isDraft) {
    badges.push({ key: "coming", label: "Coming Soon", icon: <Hourglass size={9} />, className: "badge-coming" });
    return badges;
  }
  if (product.is_bestseller) badges.push({ key: "bs", label: "Terlaris", icon: <Flame size={9} />, className: "badge-bestseller" });
  const hasDiscount = product.discount_active && product.discount_price && product.discount_price < product.original_price;
  if (hasDiscount) badges.push({ key: "fs", label: "Flash", icon: <Zap size={9} />, className: "badge-flash" });
  if (product.created_at) {
    const d = (Date.now() - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (d >= 0 && d <= 7) badges.push({ key: "new", label: "Baru", icon: <Sparkles size={9} />, className: "badge-new" });
  }
  if (product.is_promo) badges.push({ key: "pr", label: "Promo", icon: <Tag size={9} />, className: "badge-promo" });
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
      className="glass hover-card-lift rounded-xl overflow-hidden flex flex-col relative cursor-pointer group"
    >
      {/* SQUARE photo 1:1 */}
      <div className="relative aspect-square overflow-hidden bg-[#0a0c12]">
        <img
          src={resolveImageUrl(product.photo_url) || "https://images.unsplash.com/photo-1625838144804-300f3907c110?w=800"}
          alt={product.name}
          className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${isDraft ? "opacity-40" : ""}`}
          onError={(e) => {
            e.currentTarget.src = "https://images.unsplash.com/photo-1625838144804-300f3907c110?w=800";
          }}
        />
        {isDraft && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        )}

        {/* Badge stack pojok kiri atas */}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10">
          {badges.map((b) => (
            <span
              key={b.key}
              className={`badge-anim inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold uppercase tracking-wide ${b.className}`}
            >
              {b.icon} {b.label}
            </span>
          ))}
        </div>

        {!isDraft && !available && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/90 text-[10px] uppercase tracking-widest">
              Stok Habis
            </span>
          </div>
        )}
      </div>

      {/* Info compact */}
      <div className="p-2 sm:p-2.5 flex flex-col flex-1">
        <h3 className="text-xs sm:text-sm font-medium text-white line-clamp-2 leading-snug min-h-[2.5em]">
          {query ? highlightMatch(product.name, query) : product.name}
        </h3>

        {!isDraft && product.monthly_sold > 0 && (
          <div
            data-testid={`monthly-sold-${product.id}`}
            className="text-[10px] text-[#F5A623] font-medium mt-0.5 flex items-center gap-0.5"
          >
            🔥 {product.monthly_sold} terjual
          </div>
        )}
        {!isDraft && <div className="mt-0.5"><StockBadge product={product} /></div>}

        {product.description && (
          <p className="text-[10px] text-white/45 mt-0.5 line-clamp-1">
            {query ? highlightMatch(product.description, query) : product.description}
          </p>
        )}

        {/* Price + button row */}
        <div className="mt-1.5 flex items-end justify-between gap-1">
          <div className="min-w-0 flex-1">
            {isDraft ? (
              <div className="text-xs font-display italic text-white/70">Segera Hadir</div>
            ) : (
              <>
                {hasDiscount && (
                  <div className="text-[10px] text-white/40 line-through leading-none">
                    {formatIDR(product.original_price)}
                  </div>
                )}
                <div className="text-sm sm:text-base font-display font-semibold gold-text leading-tight">
                  {formatIDR(finalPrice)}
                </div>
              </>
            )}
          </div>
          {isDraft ? (
            <button
              data-testid={`notify-me-btn-${product.id}`}
              onClick={(e) => { e.stopPropagation(); onWaitlist && onWaitlist(product); }}
              className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 flex items-center justify-center transition-colors"
              aria-label="Beritahu saya"
            >
              <Bell size={13} />
            </button>
          ) : (
            <button
              data-testid={`order-now-btn-${product.id}`}
              disabled={!available}
              onClick={(e) => { e.stopPropagation(); onOrder(product); }}
              className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#F5A623] disabled:bg-white/10 disabled:text-white/40 hover:bg-[#d98f1a] text-[#0f1117] flex items-center justify-center transition-colors shadow-md"
              aria-label={stockOut ? "Stok Habis" : "Pesan"}
            >
              <ShoppingBag size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
