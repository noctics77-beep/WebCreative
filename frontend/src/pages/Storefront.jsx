import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import OrderModal from "@/components/OrderModal";
import WaitlistModal from "@/components/WaitlistModal";
import TestimonialCarousel from "@/components/TestimonialCarousel";
import UrgencySection from "@/components/UrgencySection";
import OnlineCounter from "@/components/OnlineCounter";
import LiveFeed from "@/components/LiveFeed";
import SearchBar from "@/components/SearchBar";
import TrustBadges from "@/components/TrustBadges";
import {
  Sparkles, ShieldCheck, Zap, Flame, TrendingUp, Clock, ArrowDown,
  Video, Shield, Play, Mail, Grid, LayoutGrid,
} from "lucide-react";

const HERO_BG =
  "https://images.unsplash.com/photo-1709377195538-5522ed0f9e10?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDB8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGRhcmslMjB0ZWNobm9sb2d5JTIwZ29sZHxlbnwwfHx8fDE3ODA5NzY4Njd8MA&ixlib=rb-4.1.0&q=85";

const ICON_MAP = {
  sparkles: Sparkles,
  video: Video,
  shield: Shield,
  zap: Zap,
  play: Play,
  mail: Mail,
  grid: Grid,
};

const SORT_OPTIONS = [
  { key: "all", label: "Semua", icon: LayoutGrid },
  { key: "bestseller", label: "Terlaris", icon: Flame },
  { key: "flash", label: "Flash Sale", icon: Zap },
  { key: "newest", label: "Terbaru", icon: Clock },
  { key: "cheapest", label: "Termurah", icon: ArrowDown },
];

function priceOf(p) {
  return p.discount_active && p.discount_price ? p.discount_price : p.original_price;
}

function isNewProduct(p) {
  if (!p.created_at) return false;
  const diff = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 7;
}

export default function Storefront() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [waitlistProduct, setWaitlistProduct] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [sort, setSort] = useState("all");
  const [query, setQuery] = useState("");
  const [params] = useSearchParams();
  const referral = params.get("ref");
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get("/products"),
      api.get("/categories"),
    ])
      .then(([pr, cr]) => {
        setProducts(pr.data);
        setCategories(cr.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const catNameMap = useMemo(() => {
    const m = {};
    categories.forEach((c) => { m[c.slug] = c.name; });
    return m;
  }, [categories]);

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (activeCategory !== "all") {
      list = list.filter((p) => (p.category || "lainnya") === activeCategory);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) => {
        const catName = (catNameMap[p.category] || "").toLowerCase();
        return (
          (p.name || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q) ||
          catName.includes(q) ||
          (p.category || "").toLowerCase().includes(q)
        );
      });
    }
    // sort published produk saja untuk badge terlaris/flash sale
    if (sort === "bestseller") {
      list.sort((a, b) => {
        const ba = a.is_bestseller ? 1 : 0;
        const bb = b.is_bestseller ? 1 : 0;
        if (bb !== ba) return bb - ba;
        return (b.monthly_sold || 0) - (a.monthly_sold || 0);
      });
    } else if (sort === "flash") {
      list.sort((a, b) => {
        const fa = a.discount_active && a.discount_price ? 1 : 0;
        const fb = b.discount_active && b.discount_price ? 1 : 0;
        return fb - fa;
      });
    } else if (sort === "newest") {
      list.sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    } else if (sort === "cheapest") {
      list.sort((a, b) => priceOf(a) - priceOf(b));
    }
    return list;
  }, [products, activeCategory, sort, query, catNameMap]);

  return (
    <div data-testid="storefront-page">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: `url(${HERO_BG})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f1117]/40 via-[#0f1117]/70 to-[#0f1117]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-36">
          <div className="max-w-3xl fade-up">
            <div className="mb-6">
              <OnlineCounter />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#F5A623]/30 bg-[#F5A623]/10 text-[#F5A623] text-[11px] uppercase tracking-[0.25em] mb-6">
              <Sparkles size={12} /> Access • Premium • Trusted
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-light tracking-tight leading-[1.05]">
              Digital goods
              <br />
              <span className="gold-text font-semibold">tanpa ribet</span>, instan
              di genggaman.
            </h1>
            <p className="mt-6 text-base md:text-lg text-white/60 leading-relaxed max-w-xl">
              Marketplace produk digital premium — akun, jasa, langganan, dan
              lainnya. Harga jujur, proses cepat, dukungan 24/7.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-4 max-w-xl">
              <Feature icon={<Zap size={16} />} label="Proses Instan" />
              <Feature icon={<ShieldCheck size={16} />} label="Garansi Resmi" />
              <Feature icon={<Sparkles size={16} />} label="Harga Terbaik" />
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BADGES */}
      <TrustBadges />

      {/* PRODUCT GRID */}
      <section
        id="products"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20"
      >
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 className="font-display text-3xl md:text-4xl">Katalog Produk</h2>
            <p className="text-white/55 text-sm mt-1">
              Pilih produk yang kamu butuhkan, lalu klik <b>Pesan</b>.
            </p>
          </div>
          <div className="hidden md:block text-xs text-white/40 uppercase tracking-[0.25em]">
            {filteredProducts.length} produk
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Cari produk berdasarkan nama, deskripsi, atau kategori..."
          />
        </div>

        {/* Kategori Tabs */}
        {categories.length > 0 && (
          <div
            data-testid="category-tabs"
            className="mb-4 flex flex-wrap gap-2"
          >
            <CategoryPill
              active={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
              label="Semua"
              iconKey="grid"
            />
            {categories.map((c) => (
              <CategoryPill
                key={c.slug}
                active={activeCategory === c.slug}
                onClick={() => setActiveCategory(c.slug)}
                label={c.name}
                iconKey={c.icon}
              />
            ))}
          </div>
        )}

        {/* Sort Tabs */}
        <div
          data-testid="sort-tabs"
          className="mb-6 flex flex-wrap gap-2 items-center"
        >
          <span className="text-[11px] uppercase tracking-widest text-white/40 mr-1">Sort:</span>
          {SORT_OPTIONS.map((s) => {
            const Icon = s.icon;
            const active = sort === s.key;
            return (
              <button
                key={s.key}
                data-testid={`sort-${s.key}`}
                onClick={() => setSort(s.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                  active
                    ? "bg-[#F5A623]/15 border-[#F5A623]/50 text-[#F5A623]"
                    : "bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                <Icon size={13} />
                {s.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-[#1a1d27] border border-white/5 h-[360px] animate-pulse"
              />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div
            data-testid="empty-products"
            className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-white/60"
          >
            {query.trim() ? (
              <>
                <div className="text-3xl mb-2">🤔</div>
                Hmm, produk yang kamu cari belum ada nih Sobat Creative 🎨 Coba kata kunci lain?
              </>
            ) : products.length === 0 ? (
              "Belum ada produk. Tambahkan produk dari panel admin."
            ) : (
              "Tidak ada produk untuk filter ini."
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                query={query}
                onOrder={() => navigate(`/produk/${p.slug || p.id}${referral ? `?ref=${referral}` : ""}`)}
                onWaitlist={() => navigate(`/produk/${p.slug || p.id}${referral ? `?ref=${referral}` : ""}`)}
              />
            ))}
          </div>
        )}
      </section>

      <OrderModal
        open={!!selected}
        product={selected}
        referral={referral}
        onClose={() => setSelected(null)}
      />

      <WaitlistModal
        open={!!waitlistProduct}
        product={waitlistProduct}
        onClose={() => setWaitlistProduct(null)}
      />

      <TestimonialCarousel />
      <UrgencySection />
      <LiveFeed />
    </div>
  );
}

const Feature = ({ icon, label }) => (
  <div className="flex items-center gap-2 text-xs text-white/65 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
    <span className="text-[#F5A623]">{icon}</span> {label}
  </div>
);

function CategoryPill({ active, onClick, label, iconKey }) {
  const Icon = ICON_MAP[iconKey] || Grid;
  return (
    <button
      data-testid={`cat-pill-${iconKey}`}
      onClick={onClick}
      className={`category-pill inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-all ${
        active
          ? "bg-[#F5A623]/15 border-[#F5A623]/50 text-[#F5A623] cat-pill-active"
          : "bg-white/[0.03] border-white/10 text-white/70 hover:bg-white/[0.08] hover:text-white"
      }`}
      data-icon={iconKey}
    >
      <Icon size={14} className="cat-icon" />
      {label}
    </button>
  );
}
