import { AlertTriangle, Package } from "lucide-react";

/**
 * Render badge stok terbatas.
 * - stock_limit_enabled=false → return null
 * - stock=0 → null (button akan jadi "Stok Habis")
 * - stock<=5 → merah + "Hampir Habis!"
 * - stock>5 → oranye + "Sisa X slot!"
 */
export default function StockBadge({ product, size = "sm" }) {
  if (!product?.stock_limit_enabled) return null;
  const qty = parseInt(product.stock_quantity || 0, 10);
  if (qty <= 0) return null;

  const isCritical = qty <= 5;
  const label = isCritical
    ? `Hampir Habis! Sisa ${qty} slot`
    : `Sisa ${qty} slot!`;

  const sizeCls = size === "lg"
    ? "px-3 py-1.5 text-xs"
    : "px-2 py-0.5 text-[10px]";

  return (
    <span
      data-testid="stock-badge"
      className={`inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide badge-anim ${sizeCls} ${
        isCritical
          ? "bg-red-500/15 border border-red-500/40 text-red-300 badge-bestseller"
          : "bg-orange-500/15 border border-orange-500/40 text-orange-300"
      }`}
      style={isCritical ? {} : { animation: "badgePopIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both, pulseComing 2s ease-in-out infinite 0.5s" }}
    >
      {isCritical ? <AlertTriangle size={11} /> : <Package size={11} />} {label}
    </span>
  );
}
