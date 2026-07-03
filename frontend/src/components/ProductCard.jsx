import { formatIDR, resolveImageUrl } from "@/lib/api";
import { ShoppingBag, Sparkles } from "lucide-react";

export default function ProductCard({ product, onOrder }) {
  const hasDiscount =
    product.discount_active && product.discount_price && product.discount_price < product.original_price;
  const finalPrice = hasDiscount ? product.discount_price : product.original_price;
  const available = product.stock_status === "available";

  return (
    <div
      data-testid={`product-card-${product.id}`}
      className="glass hover-card-lift rounded-2xl overflow-hidden flex flex-col"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#0a0c12]">
        <img
          src={resolveImageUrl(product.photo_url)}
          alt={product.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src =
              "https://images.unsplash.com/photo-1625838144804-300f3907c110?w=800";
          }}
        />
        {hasDiscount && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#F5A623] text-[#0f1117] text-[11px] font-bold flex items-center gap-1">
            <Sparkles size={12} /> DISKON
          </div>
        )}
        {!available && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <span className="px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs uppercase tracking-widest">
              Stok Habis
            </span>
          </div>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-display text-lg text-white">{product.name}</h3>
        {product.monthly_sold > 0 && (
          <div
            data-testid={`monthly-sold-${product.id}`}
            className="text-sm text-[#F5A623] font-medium mt-1 flex items-center gap-1"
          >
            🔥 {product.monthly_sold} terjual bulan ini
          </div>
        )}
        <p className="text-sm text-white/55 mt-1 line-clamp-2 flex-1">
          {product.description}
        </p>
        <div className="mt-4 flex items-end justify-between">
          <div>
            {hasDiscount && (
              <div className="text-xs text-white/40 line-through">
                {formatIDR(product.original_price)}
              </div>
            )}
            <div className="text-xl font-display font-semibold gold-text">
              {formatIDR(finalPrice)}
            </div>
          </div>
          <button
            data-testid={`order-now-btn-${product.id}`}
            disabled={!available}
            onClick={() => onOrder(product)}
            className="inline-flex items-center gap-2 bg-[#F5A623] disabled:bg-white/10 disabled:text-white/40 hover:bg-[#d98f1a] text-[#0f1117] text-sm font-semibold px-4 py-2 rounded-full transition-colors"
          >
            <ShoppingBag size={15} /> Pesan
          </button>
        </div>
      </div>
    </div>
  );
}
