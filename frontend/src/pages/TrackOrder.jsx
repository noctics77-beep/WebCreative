import { useState } from "react";
import { Search, Loader2, PackageCheck, Clock, XCircle, CheckCircle2, AlertCircle, Star } from "lucide-react";
import { api, formatIDR } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import ReviewFormModal from "@/components/ReviewFormModal";
import { toast } from "sonner";

const STATUS_META = {
  pending: { label: "Menunggu Pembayaran", icon: Clock, cls: "text-amber-300 border-amber-500/30 bg-amber-500/10" },
  confirmed: { label: "Lunas", icon: CheckCircle2, cls: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" },
  cancelled: { label: "Dibatalkan", icon: XCircle, cls: "text-red-300 border-red-500/30 bg-red-500/10" },
  expired: { label: "Kadaluarsa", icon: AlertCircle, cls: "text-white/60 border-white/15 bg-white/5" },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border ${meta.cls}`}
    >
      <Icon size={12} /> {meta.label}
    </span>
  );
}

export default function TrackOrder() {
  const [tab, setTab] = useState("order"); // order | wa
  const [orderCode, setOrderCode] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);
  const [reviewEligibility, setReviewEligibility] = useState(null);
  const [showReview, setShowReview] = useState(false);

  const openReview = async (orderCode) => {
    try {
      const r = await api.get(`/orders/${orderCode}/review-eligibility`);
      if (!r.data.eligible) {
        toast.error(r.data.reason || "Belum bisa memberikan ulasan");
        return;
      }
      setReviewEligibility(r.data);
      setShowReview(true);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal cek eligibility");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setResults(null);
    setLoading(true);
    try {
      const params = tab === "order"
        ? { order_code: orderCode.trim() }
        : { contact: contact.trim() };
      const res = await api.get("/track-order", { params });
      setResults(res.data.orders || []);
    } catch (err) {
      setError(err?.response?.data?.detail || "Gagal mencari pesanan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="track-order-page" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
      <div className="text-center mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-white/40">Layanan Pelanggan</p>
        <h1 className="font-display text-3xl md:text-4xl mt-2">Lacak Pesanan</h1>
        <p className="text-white/55 text-sm mt-2 max-w-md mx-auto">
          Cek status pesanan kamu dengan <b className="text-white">Order ID</b> atau{" "}
          <b className="text-white">Nomor WhatsApp</b> yang dipakai saat order.
        </p>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex gap-2 mb-5">
          <button
            data-testid="track-tab-order"
            type="button"
            onClick={() => { setTab("order"); setResults(null); setError(""); }}
            className={`px-4 py-2 text-sm rounded-full transition-colors ${
              tab === "order"
                ? "bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/30"
                : "text-white/60 hover:text-white border border-white/10"
            }`}
          >
            Pakai Order ID
          </button>
          <button
            data-testid="track-tab-wa"
            type="button"
            onClick={() => { setTab("wa"); setResults(null); setError(""); }}
            className={`px-4 py-2 text-sm rounded-full transition-colors ${
              tab === "wa"
                ? "bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/30"
                : "text-white/60 hover:text-white border border-white/10"
            }`}
          >
            Pakai Nomor WhatsApp
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {tab === "order" ? (
            <div>
              <Label className="text-xs uppercase tracking-widest text-white/60">Order ID</Label>
              <Input
                data-testid="track-order-input"
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value)}
                placeholder="ORDXXXXXX"
                className="mt-1 bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623] font-mono"
              />
            </div>
          ) : (
            <div>
              <Label className="text-xs uppercase tracking-widest text-white/60">Nomor WhatsApp</Label>
              <Input
                data-testid="track-wa-input"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="08xxxxxxxxxx"
                className="mt-1 bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623] font-mono"
              />
            </div>
          )}

          <Button
            type="submit"
            data-testid="track-submit-btn"
            disabled={loading}
            className="w-full bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <>
                <Search size={16} className="mr-2" /> Lacak Pesanan
              </>
            )}
          </Button>
        </form>

        {error && (
          <div
            data-testid="track-error"
            className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"
          >
            {error}
          </div>
        )}
      </div>

      {results && results.length > 0 && (
        <div className="mt-6 space-y-3" data-testid="track-results">
          <p className="text-xs uppercase tracking-[0.25em] text-white/40">
            {results.length} Pesanan Ditemukan
          </p>
          {results.map((o) => (
            <div
              key={o.order_code}
              data-testid={`track-result-${o.order_code}`}
              className="glass rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-xs text-white/50 mb-1">Order ID</div>
                  <div className="font-mono text-sm gold-text">{o.order_code}</div>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-white/50">Produk</div>
                  <div className="text-white/90">{o.product_name}</div>
                </div>
                <div>
                  <div className="text-xs text-white/50">Total</div>
                  <div className="gold-text font-semibold">{formatIDR(o.product_price)}</div>
                </div>
                <div>
                  <div className="text-xs text-white/50">Pembeli</div>
                  <div className="text-white/90">{o.buyer_name}</div>
                </div>
                <div>
                  <div className="text-xs text-white/50">Tanggal Order</div>
                  <div className="text-white/90 text-xs">
                    {o.created_at ? new Date(o.created_at).toLocaleString("id-ID") : "-"}
                  </div>
                </div>
              </div>
              {o.status === "pending" && (
                <div className="mt-3 text-xs text-amber-300/80 flex items-center gap-2">
                  <PackageCheck size={14} />
                  Selesaikan pembayaran agar pesanan diproses.
                </div>
              )}
              {o.status === "confirmed" && (
                <div className="mt-3 flex justify-end">
                  <Button
                    data-testid={`btn-review-${o.order_code}`}
                    onClick={() => openReview(o.order_code)}
                    size="sm"
                    className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold h-8"
                  >
                    <Star size={13} className="mr-1" /> Beri Ulasan
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ReviewFormModal
        open={showReview}
        eligibility={reviewEligibility}
        onClose={() => setShowReview(false)}
        onSuccess={() => {}}
      />
    </div>
  );
}
