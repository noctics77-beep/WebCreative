import { Search, X } from "lucide-react";

export default function SearchBar({ value, onChange, placeholder = "Cari produk..." }) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
      <input
        data-testid="search-bar"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 pl-11 pr-11 rounded-full bg-white/[0.04] border border-white/10 focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/20 focus:outline-none text-white placeholder:text-white/40 text-sm transition-all"
      />
      {value && (
        <button
          data-testid="search-clear"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10"
          aria-label="Hapus pencarian"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/**
 * Highlight matched substring dalam text.
 * Return array of React nodes untuk di-render.
 */
export function highlightMatch(text, query) {
  if (!query || !text) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = String(text).split(regex);
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-[#F5A623]/25 text-[#F5A623] px-0.5 rounded">{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
