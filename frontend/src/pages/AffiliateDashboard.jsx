import { useState } from "react";
import { api, formatIDR } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, LogOut, Wallet, TrendingUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AffiliateDashboard() {
  const [code, setCode] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await api.get(`/affiliates/${code.trim()}`);
      setData(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Affiliate ID tidak ditemukan");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    const res = await api.get(`/affiliates/${data.affiliate.affiliate_code}`);
    setData(res.data);
  };

  if (!data) {
    return (
      <div
        data-testid="affiliate-login-page"
        className="max-w-md mx-auto px-4 pt-20 pb-24"
      >
        <div className="glass rounded-2xl p-8">
          <h1 className="font-display text-3xl">Affiliate Login</h1>
          <p className="text-white/55 text-sm mt-1">
            Masuk ke dashboard dengan <b>Affiliate ID</b> kamu.
          </p>
          <form onSubmit={login} className="mt-6 space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-widest text-white/60">Affiliate ID</Label>
              <Input
                data-testid="affiliate-login-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="AFFXXXXX"
                className="mt-1 bg-[#0f1117] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623] font-mono tracking-widest"
              />
            </div>
            <Button
              type="submit"
              data-testid="affiliate-login-btn"
              disabled={loading}
              className="w-full bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : "Masuk"}
            </Button>
          </form>
          <p className="text-xs text-white/40 mt-4 text-center">
            Belum punya ID?{" "}
            <a href="/partnership" className="text-[#F5A623] hover:underline">Daftar di sini</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <DashboardView data={data} onLogout={() => setData(null)} onRefresh={refresh} />
  );
}

function DashboardView({ data, onLogout, onRefresh }) {
  const { affiliate, orders, withdrawals } = data;
  const referralLink = `${window.location.origin}/?ref=${affiliate.affiliate_code}`;

  return (
    <div
      data-testid="affiliate-dashboard"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-white/40">Welcome back</p>
          <h1 className="font-display text-3xl md:text-4xl">
            {affiliate.name}
          </h1>
          <p className="font-mono text-sm text-[#F5A623] mt-1" data-testid="affiliate-id-display">
            {affiliate.affiliate_code}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={onLogout}
          data-testid="affiliate-logout-btn"
          className="bg-transparent border-white/20 hover:bg-white/5 text-white"
        >
          <LogOut size={15} className="mr-2" /> Logout
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<Wallet size={18} />}
          label="Saldo Komisi"
          value={formatIDR(affiliate.balance)}
          testId="stat-balance"
          accent
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="Total Earned"
          value={formatIDR(affiliate.total_earned)}
          testId="stat-earned"
        />
        <StatCard
          icon={<Wallet size={18} />}
          label="Total Withdrawn"
          value={formatIDR(affiliate.total_withdrawn)}
          testId="stat-withdrawn"
        />
      </div>

      {/* Referral Link */}
      <div className="glass rounded-2xl p-6 mb-8">
        <Label className="text-xs uppercase tracking-widest text-white/60">Link Referral kamu</Label>
        <div className="flex items-center gap-2 mt-2">
          <code
            data-testid="dashboard-referral-link"
            className="flex-1 text-xs md:text-sm bg-[#0f1117] border border-white/10 rounded-md px-3 py-2.5 truncate"
          >
            {referralLink}
          </code>
          <button
            data-testid="copy-referral-link-btn"
            onClick={() => {
              navigator.clipboard.writeText(referralLink);
              toast.success("Link referral disalin");
            }}
            className="p-2.5 rounded-md bg-[#F5A623]/15 hover:bg-[#F5A623]/25 text-[#F5A623]"
          >
            <Copy size={15} />
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section title="Riwayat Penjualan" testId="sales-history">
            {orders.length === 0 ? (
              <p className="text-white/40 text-sm py-6 text-center">Belum ada penjualan.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/60">Order ID</TableHead>
                    <TableHead className="text-white/60">Produk</TableHead>
                    <TableHead className="text-white/60">Komisi</TableHead>
                    <TableHead className="text-white/60">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id} className="border-white/5">
                      <TableCell className="font-mono text-xs">{o.order_code}</TableCell>
                      <TableCell className="text-sm">{o.product_name}</TableCell>
                      <TableCell className="text-sm gold-text font-semibold">
                        {formatIDR(o.commission_amount)}
                      </TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section title="Riwayat Penarikan" testId="withdraw-history">
            {withdrawals.length === 0 ? (
              <p className="text-white/40 text-sm py-6 text-center">Belum ada penarikan.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/60">Nominal</TableHead>
                    <TableHead className="text-white/60">Metode</TableHead>
                    <TableHead className="text-white/60">Rekening</TableHead>
                    <TableHead className="text-white/60">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((w) => (
                    <TableRow key={w.id} className="border-white/5">
                      <TableCell className="font-semibold">{formatIDR(w.amount)}</TableCell>
                      <TableCell className="text-sm">{w.method}</TableCell>
                      <TableCell className="text-sm font-mono">{w.account_number}</TableCell>
                      <TableCell><StatusBadge status={w.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>
        </div>

        <WithdrawForm
          affiliate={affiliate}
          onSuccess={onRefresh}
        />
      </div>
    </div>
  );
}

function WithdrawForm({ affiliate, onSuccess }) {
  const [form, setForm] = useState({ amount: "", method: "Dana", account_number: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return toast.error("Nominal harus lebih dari 0");
    if (!form.account_number.trim()) return toast.error("Nomor rekening wajib diisi");
    setLoading(true);
    try {
      await api.post("/withdrawals", {
        affiliate_code: affiliate.affiliate_code,
        amount: amt,
        method: form.method,
        account_number: form.account_number,
      });
      toast.success("Permintaan WD terkirim");
      setForm({ amount: "", method: "Dana", account_number: "" });
      onSuccess();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal request WD");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section title="Request Penarikan" testId="withdraw-form-section">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-widest text-white/60">Nominal WD</Label>
          <Input
            data-testid="wd-amount-input"
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="50000"
            className="mt-1 bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
          />
          <p className="text-[11px] text-white/40 mt-1">
            Saldo tersedia: <b className="text-white/70">{formatIDR(affiliate.balance)}</b>
          </p>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-white/60">Metode</Label>
          <Select
            value={form.method}
            onValueChange={(v) => setForm({ ...form, method: v })}
          >
            <SelectTrigger
              data-testid="wd-method-select"
              className="mt-1 bg-[#0f1117] border-white/15 focus:ring-[#F5A623]/30"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1d27] border-white/10 text-white">
              {["Dana", "Gopay", "Ovo", "BCA", "BRI", "BNI", "Mandiri"].map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-white/60">Nomor Rekening / HP</Label>
          <Input
            data-testid="wd-account-input"
            value={form.account_number}
            onChange={(e) => setForm({ ...form, account_number: e.target.value })}
            placeholder="08xxxxxx / 12345"
            className="mt-1 bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
          />
        </div>
        <Button
          type="submit"
          data-testid="wd-submit-btn"
          disabled={loading}
          className="w-full bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : "Request Penarikan"}
        </Button>
      </form>
    </Section>
  );
}

const Section = ({ title, children, testId }) => (
  <div data-testid={testId} className="glass rounded-2xl p-6">
    <h3 className="font-display text-lg mb-4">{title}</h3>
    {children}
  </div>
);

const StatCard = ({ icon, label, value, testId, accent }) => (
  <div
    data-testid={testId}
    className={`rounded-2xl p-6 border ${
      accent
        ? "bg-gradient-to-br from-[#F5A623]/15 to-transparent border-[#F5A623]/30"
        : "bg-[#1a1d27] border-white/5"
    }`}
  >
    <div className="flex items-center gap-2 text-white/60 text-xs uppercase tracking-widest">
      <span className="text-[#F5A623]">{icon}</span>
      {label}
    </div>
    <div className={`font-display text-2xl md:text-3xl mt-2 ${accent ? "gold-text font-semibold" : ""}`}>
      {value}
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const map = {
    pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    confirmed: "bg-green-500/15 text-green-300 border-green-500/30",
    approved: "bg-green-500/15 text-green-300 border-green-500/30",
    cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
    rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${map[status] || "bg-white/5 text-white/60 border-white/10"}`}
    >
      {status}
    </span>
  );
};
