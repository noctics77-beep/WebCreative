import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check, Copy, Handshake, Loader2, Store, Users } from "lucide-react";
import { toast } from "sonner";

export default function Partnership() {
  const [adminWa, setAdminWa] = useState("");
  const [form, setForm] = useState({ name: "", contact: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get("/config").then((r) => setAdminWa(r.data.admin_whatsapp));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.contact.trim()) {
      toast.error("Mohon lengkapi nama dan kontak");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/affiliates", form);
      setResult(res.data);
      toast.success("Pendaftaran berhasil!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mendaftar");
    } finally {
      setLoading(false);
    }
  };

  const referralLink =
    result && `${window.location.origin}/?ref=${result.affiliate_code}`;

  return (
    <div
      data-testid="partnership-page"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24"
    >
      <div className="text-center max-w-2xl mx-auto fade-up">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#F5A623]/30 bg-[#F5A623]/10 text-[#F5A623] text-[11px] uppercase tracking-[0.25em] mb-5">
          <Handshake size={12} /> Program Kemitraan
        </div>
        <h1 className="font-display text-4xl md:text-5xl">
          Cuan bareng <span className="gold-text">CreativeStore</span>
        </h1>
        <p className="text-white/55 mt-4">
          Pilih jalurmu — jadi <b>Affiliate</b> tanpa modal atau{" "}
          <b>Reseller</b> untuk margin lebih besar.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-14">
        {/* AFFILIATE CARD */}
        <div
          data-testid="affiliate-card"
          className="glass rounded-2xl p-8 hover-card-lift"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#F5A623]/15 text-[#F5A623] flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-white/40">
                Partner
              </div>
              <h3 className="font-display text-2xl">Affiliate</h3>
            </div>
          </div>
          <ul className="mt-6 space-y-3 text-sm text-white/70">
            <Bullet>Tanpa modal awal</Bullet>
            <Bullet>Cukup sebar link referral</Bullet>
            <Bullet>Komisi 10%–15% per produk</Bullet>
            <Bullet>Cocok untuk pemula</Bullet>
          </ul>

          {!result ? (
            <form onSubmit={submit} className="mt-7 space-y-3">
              <div>
                <Label className="text-xs uppercase tracking-widest text-white/60">Nama Lengkap</Label>
                <Input
                  data-testid="affiliate-name-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nama kamu"
                  className="mt-1 bg-[#0f1117] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-white/60">WhatsApp / Telegram</Label>
                <Input
                  data-testid="affiliate-contact-input"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  placeholder="08xxxx atau @username"
                  className="mt-1 bg-[#0f1117] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
                />
              </div>
              <Button
                type="submit"
                data-testid="affiliate-register-btn"
                disabled={loading}
                className="w-full bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : "Daftar Affiliate"}
              </Button>
            </form>
          ) : (
            <div
              data-testid="affiliate-success"
              className="mt-6 rounded-xl border border-[#F5A623]/30 bg-[#F5A623]/5 p-5"
            >
              <p className="text-sm text-white/60">Affiliate ID kamu:</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  data-testid="affiliate-code-display"
                  className="font-mono text-2xl gold-text font-semibold"
                >
                  {result.affiliate_code}
                </span>
                <CopyBtn value={result.affiliate_code} label="ID disalin" />
              </div>
              <p className="text-sm text-white/60 mt-4">Link referral:</p>
              <div className="flex items-center gap-2 mt-1">
                <code
                  data-testid="referral-link-display"
                  className="flex-1 text-xs bg-[#0f1117] border border-white/10 rounded-md px-3 py-2 truncate"
                >
                  {referralLink}
                </code>
                <CopyBtn value={referralLink} label="Link referral disalin" />
              </div>
              <p className="text-xs text-white/40 mt-4">
                Gunakan Affiliate ID di atas untuk login ke dashboard.
              </p>
            </div>
          )}
        </div>

        {/* RESELLER CARD */}
        <div
          data-testid="reseller-card"
          className="glass rounded-2xl p-8 hover-card-lift relative overflow-hidden"
        >
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[#F5A623]/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#F5A623]/15 text-[#F5A623] flex items-center justify-center">
                <Store size={20} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.25em] text-white/40">
                  Partner
                </div>
                <h3 className="font-display text-2xl">Reseller</h3>
              </div>
            </div>
            <ul className="mt-6 space-y-3 text-sm text-white/70">
              <Bullet>Beli produk harga grosir</Bullet>
              <Bullet>Jual mandiri, tentukan harga sendiri</Bullet>
              <Bullet>Margin profit lebih besar</Bullet>
              <Bullet>Untuk pedagang serius</Bullet>
            </ul>

            <a
              data-testid="reseller-whatsapp-btn"
              href={`https://wa.me/${adminWa}?text=${encodeURIComponent(
                "Halo, saya ingin daftar Reseller CreativeStore"
              )}`}
              target="_blank"
              rel="noreferrer"
              className="mt-7 inline-flex w-full items-center justify-center gap-2 bg-transparent border border-[#F5A623] text-[#F5A623] hover:bg-[#F5A623] hover:text-[#0f1117] font-semibold px-4 py-2.5 rounded-md transition-colors"
            >
              Hubungi Admin via WhatsApp
            </a>
            <p className="text-xs text-white/40 mt-3 text-center">
              Admin akan mengarahkan proses pendaftaran reseller
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const Bullet = ({ children }) => (
  <li className="flex items-start gap-2">
    <Check className="text-[#F5A623] mt-0.5 shrink-0" size={16} /> {children}
  </li>
);

const CopyBtn = ({ value, label }) => (
  <button
    onClick={() => {
      navigator.clipboard.writeText(value);
      toast.success(label);
    }}
    data-testid="copy-btn"
    className="p-2 rounded-md bg-white/5 hover:bg-[#F5A623]/15 text-white/70 hover:text-[#F5A623] transition"
  >
    <Copy size={14} />
  </button>
);
