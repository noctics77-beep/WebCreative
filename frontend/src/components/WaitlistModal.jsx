import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Bell, Sparkles, Send, Loader2 } from "lucide-react";

// Ganti [USERNAME_BOT_PUBLIK] via env kalau nanti tersedia; untuk sekarang tampilkan literal placeholder.
const BOT_USERNAME = process.env.REACT_APP_TELEGRAM_PUBLIC_BOT_USERNAME || "[USERNAME_BOT_PUBLIK]";

export default function WaitlistModal({ open, product, onClose }) {
  const [form, setForm] = useState({ nama: "", whatsapp_telegram: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null); // {waitlist_id}
  const [softError, setSoftError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ nama: "", whatsapp_telegram: "", email: "" });
      setSuccess(null);
      setSoftError("");
    }
  }, [open, product?.id]);

  if (!product) return null;

  const submit = async (e) => {
    e.preventDefault();
    setSoftError("");
    const hasReachable =
      (form.whatsapp_telegram || "").trim() || (form.email || "").trim();
    if (!hasReachable) {
      setSoftError("Isi salah satu kontak ya, biar kami bisa kabarin kamu 🙂");
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.post("/waitlist", {
        nama: form.nama || null,
        whatsapp_telegram: form.whatsapp_telegram || null,
        email: form.email || null,
        produk_id: product.id,
      });
      setSuccess({ id: r.data.id });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal mendaftar waitlist");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        data-testid="waitlist-modal"
        className="bg-[#1a1d27] border-white/10 text-white sm:max-w-[440px]"
      >
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2 text-xl">
            <Bell className="text-[#F5A623]" size={20} />
            {success ? "Sip, sudah tercatat!" : "Mau dapat kabar duluan?"}
          </DialogTitle>
        </DialogHeader>

        {!success ? (
          <form onSubmit={submit} className="space-y-3 mt-1">
            <p className="text-sm text-white/75 leading-relaxed">
              Mau dapat kabar duluan pas <b>{product.name}</b> ready? Tinggal isi salah satu aja 👇
            </p>

            <div>
              <Input
                data-testid="waitlist-nama"
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                placeholder="Nama kamu (opsional)"
                className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
              />
            </div>

            <div>
              <Input
                data-testid="waitlist-wa-tele"
                value={form.whatsapp_telegram}
                onChange={(e) => setForm({ ...form, whatsapp_telegram: e.target.value })}
                placeholder="Nomor WA atau @username Telegram (opsional)"
                className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
              />
            </div>

            <div>
              <Input
                data-testid="waitlist-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email kamu (opsional)"
                className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
              />
            </div>

            <p className="text-[11px] text-white/50 italic">
              Isi salah satu aja sudah cukup — kami nggak akan spam kamu 😊
            </p>

            <div className="text-[11px] text-white/60 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 leading-relaxed">
              📱 Untuk notif Telegram, start dulu bot kami ya:{" "}
              <span className="text-[#F5A623] font-mono">@{BOT_USERNAME.replace(/^@/, "")}</span>
            </div>

            {softError && (
              <p
                data-testid="waitlist-soft-error"
                className="text-sm text-[#F5A623] bg-[#F5A623]/10 border border-[#F5A623]/30 rounded-lg px-3 py-2"
              >
                {softError}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              data-testid="waitlist-submit"
              className="w-full bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold mt-2"
            >
              {submitting ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <>
                  <Send size={15} className="mr-1.5" /> Kabarin Aku!
                </>
              )}
            </Button>
          </form>
        ) : (
          <div className="space-y-4 mt-2">
            <div className="text-center py-4">
              <div className="text-5xl mb-3">🎉</div>
              <p className="text-white/90 leading-relaxed">
                Sip! Kami akan kabarin kamu duluan pas <b className="text-[#F5A623]">{product.name}</b>{" "}
                sudah ready ya, Sobat Creative! 💛
              </p>
            </div>

            {BOT_USERNAME && !BOT_USERNAME.includes("[") && (
              <a
                href={`https://t.me/${BOT_USERNAME.replace(/^@/, "")}?start=waitlist_${success.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-[#26A5E4] hover:bg-[#1d8dc4] text-white font-semibold py-2.5 rounded-full transition-colors"
              >
                <Sparkles size={15} className="inline mr-1" /> Aktifkan Notif Telegram
              </a>
            )}

            <Button
              onClick={onClose}
              variant="outline"
              className="w-full bg-transparent border-white/20 hover:bg-white/5 text-white"
            >
              Tutup
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
