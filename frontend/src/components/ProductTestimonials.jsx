import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, ShieldCheck, Shield, Pin, MessageCircle } from "lucide-react";
import { api, resolveImageUrl } from "@/lib/api";

export default function ProductTestimonials({ productId, productName }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ count: 0, avg: 0 });
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (!productId) return;
    api.get(`/testimonials?product_id=${productId}&limit=20`).then((r) => {
      setItems(r.data.items || []);
      setSummary(r.data.summary || { count: 0, avg: 0 });
    }).finally(() => setLoading(false));
  }, [productId]);

  if (loading) return null;
  if (!items.length) return null;

  return (
    <section data-testid="product-testimonials" className="mt-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="glass rounded-2xl p-6 md:p-8">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <h3 className="font-display text-xl flex items-center gap-2">
              <MessageCircle size={20} className="text-[#F5A623]" />
              Testimoni Pembeli
              <span className="text-xs text-white/50 font-normal">({summary.count})</span>
            </h3>
            {summary.avg > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex text-[#F5A623]">
                  {[...Array(5)].map((_, k) => (
                    <Star key={k} size={13} fill={k < Math.round(summary.avg) ? "currentColor" : "none"} strokeWidth={1.5} />
                  ))}
                </div>
                <span className="text-sm font-medium gold-text">{summary.avg}</span>
                <span className="text-xs text-white/50">rata-rata</span>
              </div>
            )}
          </div>
          <Link
            to="/testimoni"
            className="text-xs text-[#F5A623] hover:text-[#d98f1a] font-medium"
            data-testid="product-testimonials-see-all"
          >
            Lihat semua testimoni →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.slice(0, 6).map((t) => (
            <article
              key={t.id}
              data-testid={`prod-tt-${t.id}`}
              className={`glass rounded-xl p-4 ${t.is_pinned ? "border-[#F5A623]/40" : ""}`}
            >
              <div className="flex items-center gap-0.5 text-[#F5A623] mb-2">
                {[...Array(5)].map((_, k) => (
                  <Star key={k} size={12} fill={k < t.rating ? "currentColor" : "none"} strokeWidth={1.5} />
                ))}
              </div>
              <p className="text-white/80 text-sm leading-relaxed line-clamp-4">&ldquo;{t.content}&rdquo;</p>
              {t.photos && t.photos.length > 0 && (
                <div className="mt-3 flex gap-1.5">
                  {t.photos.slice(0, 3).map((p, i) => (
                    <button key={i} onClick={() => setLightbox(p)} className="w-14 h-14 rounded overflow-hidden border border-white/5 hover:border-[#F5A623]/40">
                      <img src={resolveImageUrl(p)} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F5A623] to-[#7a4a0e] flex items-center justify-center font-display font-semibold text-xs text-[#0f1117]">
                  {(t.name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{t.name}</div>
                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                    {t.is_verified_buyer && (
                      <span className="text-[9px] px-1 rounded bg-green-500/15 text-green-300 border border-green-500/30 flex items-center gap-0.5">
                        <ShieldCheck size={8} /> Verified
                      </span>
                    )}
                    {t.is_admin_post && (
                      <span className="text-[9px] px-1 rounded bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/40 flex items-center gap-0.5">
                        <Shield size={8} /> Admin
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer" onClick={() => setLightbox(null)}>
          <img src={resolveImageUrl(lightbox)} alt="" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </section>
  );
}
