import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import OrderModal from "@/components/OrderModal";
import { Sparkles, ShieldCheck, Zap } from "lucide-react";

const HERO_BG =
  "https://images.unsplash.com/photo-1709377195538-5522ed0f9e10?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDB8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGRhcmslMjB0ZWNobm9sb2d5JTIwZ29sZHxlbnwwfHx8fDE3ODA5NzY4Njd8MA&ixlib=rb-4.1.0&q=85";

export default function Storefront() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [params] = useSearchParams();
  const referral = params.get("ref");

  useEffect(() => {
    api.get("/products").then((r) => setProducts(r.data)).finally(() => setLoading(false));
  }, []);

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

      {/* PRODUCT GRID */}
      <section
        id="products"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20"
      >
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="font-display text-3xl md:text-4xl">Katalog Produk</h2>
            <p className="text-white/55 text-sm mt-1">
              Pilih produk yang kamu butuhkan, lalu klik <b>Pesan</b>.
            </p>
          </div>
          <div className="hidden md:block text-xs text-white/40 uppercase tracking-[0.25em]">
            {products.length} produk
          </div>
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
        ) : products.length === 0 ? (
          <div
            data-testid="empty-products"
            className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-white/40"
          >
            Belum ada produk. Tambahkan produk dari panel admin.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onOrder={setSelected} />
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
    </div>
  );
}

const Feature = ({ icon, label }) => (
  <div className="flex items-center gap-2 text-xs text-white/65 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
    <span className="text-[#F5A623]">{icon}</span> {label}
  </div>
);
