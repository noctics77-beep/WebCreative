import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, Copy, Flame, Gift, Loader2, LogOut, Search } from "lucide-react";

const LS_KEY = "cs_loyalty_wa";

export default function LoyaltyPage() {
  const [wa, setWa] = useState(() => localStorage.getItem(LS_KEY) || "");
  const [name, setName] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [tab, setTab] = useState("checkin"); // checkin | check

  const loadMember = async (whatsapp) => {
    setLoading(true);
    try {
      const res = await api.get(`/loyalty/member/${whatsapp}`);
      setData(res.data);
      localStorage.setItem(LS_KEY, whatsapp);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (wa) loadMember(wa);
    // eslint-disable-next-line
  }, []);

  const register = async (e) => {
    e.preventDefault();
    if (!name.trim() || !wa.trim()) return toast.error("Nama dan nomor WA wajib diisi");
    setLoading(true);
    try {
      await api.post("/loyalty/register", { name, whatsapp: wa });
      toast.success("Berhasil daftar, ayo check-in!");
      await loadMember(wa);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mendaftar");
    } finally { setLoading(false); }
  };

  const checkin = async () => {
    setChecking(true);
    try {
      const res = await api.post("/loyalty/checkin", { whatsapp: data.member.whatsapp });
      if (res.data.new_code) {
        toast.success(`🎉 Selamat! Kode diskon baru: ${res.data.new_code}`);
      } else {
        toast.success(`Check-in berhasil! Streak: ${res.data.streak} hari`);
      }
      await loadMember(data.member.whatsapp);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal check-in");
    } finally { setChecking(false); }
  };

  const logout = () => {
    localStorage.removeItem(LS_KEY);
    setData(null);
    setWa("");
    setName("");
  };

  return (
    <div data-testid="loyalty-page" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#F5A623]/30 bg-[#F5A623]/10 text-[#F5A623] text-[11px] uppercase tracking-[0.25em] mb-4">
          <Gift size={12} /> Program Loyalitas
        </div>
        <h1 className="font-display text-4xl md:text-5xl">Poin <span className="gold-text">Harian</span></h1>
        <p className="text-white/55 mt-3 text-sm">
          Check-in tiap hari 7 hari berturut-turut, dapat <b className="text-white">kode diskon 10%</b>.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-8">
        <button
          data-testid="tab-checkin"
          onClick={() => setTab("checkin")}
          className={`px-4 py-2 rounded-full text-sm transition ${tab === "checkin" ? "bg-[#F5A623] text-[#0f1117] font-semibold" : "bg-white/5 text-white/60 hover:text-white"}`}
        >
          Check-in Hari Ini
        </button>
        <button
          data-testid="tab-check"
          onClick={() => setTab("check")}
          className={`px-4 py-2 rounded-full text-sm transition ${tab === "check" ? "bg-[#F5A623] text-[#0f1117] font-semibold" : "bg-white/5 text-white/60 hover:text-white"}`}
        >
          Cek Poin Saya
        </button>
      </div>

      {tab === "check" ? (
        <CheckByWA onFound={(d) => { setData(d); setTab("checkin"); }} />
      ) : !data ? (
        <div className="glass rounded-2xl p-8">
          <h3 className="font-display text-xl">Daftar Member Poin</h3>
          <p className="text-white/55 text-sm mt-1">Cukup sekali daftar, gratis.</p>
          <form onSubmit={register} className="mt-6 space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-widest text-white/60">Nama</Label>
              <Input data-testid="loyalty-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kamu"
                className="mt-1 bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-white/60">Nomor WhatsApp</Label>
              <Input data-testid="loyalty-wa-input" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="08xxxx"
                className="mt-1 bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
            </div>
            <Button type="submit" data-testid="loyalty-register-btn" disabled={loading}
              className="w-full bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold">
              {loading ? <Loader2 className="animate-spin" size={16} /> : "Daftar Sekarang"}
            </Button>
          </form>
        </div>
      ) : (
        <Dashboard data={data} onCheckin={checkin} checking={checking} onLogout={logout} />
      )}
    </div>
  );
}

function Dashboard({ data, onCheckin, checking, onLogout }) {
  const { member, streak, checked_today, codes } = data;

  return (
    <div className="space-y-6" data-testid="loyalty-dashboard">
      <div className="glass rounded-2xl p-6 md:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-white/40">Halo,</p>
            <h2 className="font-display text-2xl md:text-3xl">{member.name}</h2>
            <p className="text-xs text-white/40 font-mono mt-0.5">+{member.whatsapp}</p>
          </div>
          <button onClick={onLogout} data-testid="loyalty-logout-btn" className="text-white/40 hover:text-white/80 p-2"><LogOut size={16} /></button>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Flame className="text-[#F5A623]" size={28} />
          <div>
            <div className="text-sm text-white/55">Streak kamu</div>
            <div className="font-display text-3xl gold-text font-semibold" data-testid="streak-count">
              {streak} hari berturut-turut
            </div>
          </div>
        </div>

        {/* 7-day progress */}
        <div className="mt-6 grid grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const filled = d <= (streak % 7 === 0 && streak > 0 ? 7 : streak % 7);
            const isReward = d === 7;
            return (
              <div key={d} data-testid={`day-${d}`}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center text-xs border transition ${
                  filled ? "bg-[#F5A623]/15 border-[#F5A623] text-[#F5A623]" : "bg-white/[0.03] border-white/10 text-white/40"
                }`}>
                {filled && <CheckCircle2 size={16} />}
                <span className="mt-1">{isReward ? "🎁" : `D${d}`}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-white/40 mt-2 text-center">Hari ke-7 berturut-turut otomatis dapat kode diskon 10%</p>

        <Button
          data-testid="checkin-btn"
          onClick={onCheckin}
          disabled={checked_today || checking}
          className={`w-full mt-6 font-semibold ${
            checked_today ? "bg-white/10 text-white/40" : "bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117]"
          }`}
        >
          {checking ? <Loader2 className="animate-spin" size={16} /> : checked_today ? "Sudah Check-in ✓" : "Check-in Hari Ini"}
        </Button>
      </div>

      {/* Codes */}
      <div className="glass rounded-2xl p-6">
        <h3 className="font-display text-lg mb-4">Kode Diskon Kamu</h3>
        {codes.length === 0 ? (
          <p className="text-white/40 text-sm text-center py-4">Belum ada kode. Lanjut check-in 7 hari berturut-turut!</p>
        ) : (
          <div className="space-y-2">
            {codes.map((c) => (
              <div key={c.code} data-testid={`code-${c.code}`}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
                  c.used ? "bg-white/5 border-white/10 opacity-60" : "bg-[#F5A623]/10 border-[#F5A623]/40"
                }`}>
                <div>
                  <div className="font-mono text-base gold-text font-semibold">{c.code}</div>
                  <div className="text-xs text-white/55">Diskon {c.percentage}% • {c.used ? "Sudah dipakai" : "Aktif"}</div>
                </div>
                {!c.used && (
                  <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Kode disalin"); }}
                    className="p-2 rounded-md bg-white/5 hover:bg-[#F5A623]/15 text-white/70 hover:text-[#F5A623]">
                    <Copy size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CheckByWA({ onFound }) {
  const [wa, setWa] = useState("");
  const [loading, setLoading] = useState(false);

  const lookup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.get(`/loyalty/member/${wa}`);
      localStorage.setItem(LS_KEY, wa);
      onFound(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Member belum terdaftar");
    } finally { setLoading(false); }
  };

  return (
    <div className="glass rounded-2xl p-8 max-w-md mx-auto">
      <h3 className="font-display text-xl">Cek Poin Saya</h3>
      <p className="text-white/55 text-sm mt-1">Masukkan nomor WhatsApp yang kamu pakai saat daftar.</p>
      <form onSubmit={lookup} className="mt-5 space-y-3">
        <Input data-testid="check-wa-input" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="08xxxx"
          className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
        <Button type="submit" data-testid="check-wa-btn" disabled={loading} className="w-full bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold">
          {loading ? <Loader2 className="animate-spin" size={16} /> : (<><Search size={15} className="mr-2" /> Cek Poin</>)}
        </Button>
      </form>
    </div>
  );
}
