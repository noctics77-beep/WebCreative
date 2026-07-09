import { useState } from "react";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ReviewFormModal({ open, order, eligibility, onClose, onSuccess }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (rating < 1) return toast.error("Pilih rating dulu");
    setSaving(true);
    try {
      const r = await api.post("/reviews", {
        order_id: eligibility.order_id,
        rating,
        comment,
      });
      toast.success(r.data.message || "Terima kasih!");
      onSuccess && onSuccess();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal submit ulasan");
    } finally { setSaving(false); }
  };

  if (!eligibility) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#1a1d27] border-white/10 text-white sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-display">Beri Ulasan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm">
            <span className="text-white/50">Produk:</span> <span className="font-medium">{eligibility.product_name}</span>
          </div>

          <div>
            <label className="text-sm text-white/70 mb-2 block">Rating kamu</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  data-testid={`rating-star-${n}`}
                  onClick={() => setRating(n)}
                  className="p-1 hover:scale-110 transition-transform"
                  aria-label={`Rating ${n} bintang`}
                >
                  <Star
                    size={28}
                    className={n <= rating ? "text-[#F5A623]" : "text-white/20"}
                    fill={n <= rating ? "#F5A623" : "none"}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-white/70 mb-2 block">Komentar (opsional)</label>
            <Textarea
              data-testid="review-comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Bagaimana pengalamanmu?"
              className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
            />
          </div>

          <Button
            data-testid="review-submit"
            onClick={submit}
            disabled={saving}
            className="w-full bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : "Kirim Ulasan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
