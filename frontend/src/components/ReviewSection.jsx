import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Star } from "lucide-react";

export default function ReviewSection({ productId }) {
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ avg_rating: 0, count: 0 });

  useEffect(() => {
    if (!productId) return;
    api.get(`/reviews?product_id=${productId}`).then((r) => setReviews(r.data)).catch(() => setReviews([]));
    api.get(`/reviews/summary?product_id=${productId}`).then((r) => setSummary(r.data)).catch(() => {});
  }, [productId]);

  const renderStars = (rating) => (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={n <= rating ? "text-[#F5A623] fill-[#F5A623]" : "text-white/20"}
          fill={n <= rating ? "#F5A623" : "none"}
        />
      ))}
    </div>
  );

  return (
    <section data-testid="review-section" className="mt-10 pt-8 border-t border-white/10">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-display text-2xl">Ulasan Pembeli</h2>
        {summary.count > 0 && (
          <div className="flex items-center gap-2">
            {renderStars(Math.round(summary.avg_rating))}
            <span className="text-lg font-display gold-text">{summary.avg_rating}</span>
            <span className="text-sm text-white/50">({summary.count} ulasan)</span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-8 text-white/40 text-sm bg-white/[0.02] rounded-xl border border-dashed border-white/10">
          Belum ada ulasan untuk produk ini. Jadi yang pertama! 💛
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div
              key={r.id}
              data-testid={`review-${r.id}`}
              className="bg-[#1a1d27]/60 border border-white/5 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#F5A623]/15 flex items-center justify-center text-[#F5A623] font-semibold text-xs">
                    {(r.buyer_name_masked || "A").charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{r.buyer_name_masked}</div>
                    <div className="text-[10px] text-white/40">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" }) : ""}
                    </div>
                  </div>
                </div>
                {renderStars(r.rating)}
              </div>
              {r.comment && (
                <p className="text-sm text-white/80 leading-relaxed mt-2">{r.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
