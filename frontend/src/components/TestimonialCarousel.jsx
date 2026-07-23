import { useEffect, useState, useMemo } from "react";
import { Star, ShieldCheck, Shield, Pin } from "lucide-react";
import { Link } from "react-router-dom";
import { api, resolveImageUrl } from "@/lib/api";

// Fallback static testimonials in case API returns nothing
const FALLBACK = [
  { id: "f1", name: "Rizal A.", product_name: "Affiliate Program", rating: 5, content: "Baru 2 minggu udah cair komisi 1,2jt. Linknya tinggal sebar di story IG, auto closing.", is_verified_buyer: true, is_admin_post: false, is_pinned: false, photos: [] },
  { id: "f2", name: "Mira S.", product_name: "Reseller Pack", rating: 5, content: "Margin reseller-nya gede banget. Stok aman, admin fast respon, langganan saya nambah terus.", is_verified_buyer: true, is_admin_post: false, is_pinned: false, photos: [] },
  { id: "f3", name: "Bayu T.", product_name: "ChatGPT Plus", rating: 5, content: "Pesan ChatGPT Plus jam 10 malam, jam 10.05 udah dikirim. Garansinya beneran jalan.", is_verified_buyer: true, is_admin_post: false, is_pinned: false, photos: [] },
  { id: "f4", name: "Putri W.", product_name: "Affiliate", rating: 5, content: "Modal 0 rupiah, sekarang udah jadi side income tetap. Gak nyangka segampang ini.", is_verified_buyer: true, is_admin_post: false, is_pinned: false, photos: [] },
];

export default function TestimonialCarousel() {
  const [live, setLive] = useState([]);
  const [claim, setClaim] = useState("");

  useEffect(() => {
    api.get("/testimonials?limit=6").then((r) => setLive(r.data.items || [])).catch(() => {});
    api.get("/testimonials/settings").then((r) => setClaim(r.data.claim_text || "")).catch(() => {});
  }, []);

  const list = live.length > 0 ? live : FALLBACK;
  // duplicate the list for seamless loop
  const items = useMemo(() => [...list, ...list], [list]);

  return (
    <section
      data-testid="testimonials-section"
      className="relative overflow-hidden py-16 md:py-20 border-y border-white/5 bg-[#0a0c12]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#F5A623]/30 bg-[#F5A623]/10 text-[#F5A623] text-[11px] uppercase tracking-[0.25em] mb-4">
            Testimoni Asli
          </div>
          <h2 className="font-display text-3xl md:text-4xl">
            Mereka sudah <span className="gold-text">cuan & puas</span>
          </h2>
          <p className="text-white/55 text-sm mt-3">
            {claim || "Ribuan transaksi sukses, ratusan affiliate aktif. Saatnya giliran kamu."}
          </p>
          <Link
            to="/testimoni"
            data-testid="all-testimonials-link"
            className="inline-flex items-center gap-2 mt-4 text-[#F5A623] hover:text-[#d98f1a] text-sm font-medium"
          >
            Lihat Semua Testimoni →
          </Link>
        </div>
      </div>

      {/* Marquee track */}
      <div className="relative group" data-testid="testimonials-marquee">
        {/* fade edges */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-16 md:w-32 z-10 bg-gradient-to-r from-[#0a0c12] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-16 md:w-32 z-10 bg-gradient-to-l from-[#0a0c12] to-transparent" />

        <div className="marquee-track flex gap-5 will-change-transform">
          {items.map((t, i) => (
            <article
              key={`${t.id}-${i}`}
              data-testid={`testimonial-card-${i}`}
              className={`shrink-0 w-[300px] md:w-[360px] glass rounded-2xl p-5 md:p-6 relative ${
                t.is_pinned ? "border-[#F5A623]/40" : ""
              }`}
            >
              {t.is_pinned && (
                <div className="absolute -top-2 -right-2 bg-[#F5A623] text-[#0f1117] rounded-full p-1.5">
                  <Pin size={10} />
                </div>
              )}
              <div className="flex items-center gap-0.5 text-[#F5A623] mb-3">
                {[...Array(5)].map((_, k) => (
                  <Star key={k} size={14} fill={k < (t.rating || 5) ? "currentColor" : "none"} strokeWidth={1.5} />
                ))}
              </div>
              <p className="text-white/80 text-sm leading-relaxed line-clamp-4">&ldquo;{t.content}&rdquo;</p>

              {t.photos && t.photos.length > 0 && (
                <div className="mt-3 flex gap-1.5">
                  {t.photos.slice(0, 3).map((p, k) => (
                    <img key={k} src={resolveImageUrl(p)} alt="" className="w-12 h-12 object-cover rounded" />
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#F5A623] to-[#7a4a0e] flex items-center justify-center font-display font-semibold text-sm text-[#0f1117] flex-shrink-0">
                  {(t.name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                    {t.is_verified_buyer && (
                      <span className="text-[9px] px-1 py-0 rounded bg-green-500/15 text-green-300 border border-green-500/30 flex items-center gap-0.5">
                        <ShieldCheck size={8} /> Verified
                      </span>
                    )}
                    {t.is_admin_post && (
                      <span className="text-[9px] px-1 py-0 rounded bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/40 flex items-center gap-0.5">
                        <Shield size={8} /> Admin
                      </span>
                    )}
                    {t.product_name && (
                      <span className="text-[10px] uppercase tracking-widest text-white/40 truncate">{t.product_name}</span>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
