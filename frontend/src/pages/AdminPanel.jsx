import { useEffect, useState, useMemo } from "react";
import { adminApi, formatIDR, downloadAdminFile } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Edit, LogOut, Plus, Trash2, Loader2, Check, X, Download, Search } from "lucide-react";

export default function AdminPanel() {
  const [password, setPassword] = useState(localStorage.getItem("cs_admin_pw") || "");
  const [authed, setAuthed] = useState(!!localStorage.getItem("cs_admin_pw"));
  const [loading, setLoading] = useState(false);

  const tryLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminApi(password).post("/admin/login", { password });
      localStorage.setItem("cs_admin_pw", password);
      setAuthed(true);
      toast.success("Login admin berhasil");
    } catch {
      toast.error("Password salah");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("cs_admin_pw");
    setPassword("");
    setAuthed(false);
  };

  const handlePasswordChanged = (newPw) => {
    setPassword(newPw);
    localStorage.setItem("cs_admin_pw", newPw);
  };

  if (!authed) {
    return (
      <div data-testid="admin-login-page" className="max-w-md mx-auto px-4 pt-20 pb-24">
        <div className="glass rounded-2xl p-8">
          <h1 className="font-display text-3xl">Admin Panel</h1>
          <p className="text-white/55 text-sm mt-1">Masuk dengan password admin.</p>
          <form onSubmit={tryLogin} className="mt-6 space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-widest text-white/60">Password</Label>
              <Input
                type="password"
                data-testid="admin-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
              />
            </div>
            <Button
              type="submit"
              data-testid="admin-login-btn"
              disabled={loading}
              className="w-full bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : "Masuk"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const api = adminApi(password);

  return (
    <div data-testid="admin-panel" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-white/40">Control Center</p>
          <h1 className="font-display text-3xl md:text-4xl">Admin Panel</h1>
        </div>
        <Button
          variant="outline"
          onClick={logout}
          data-testid="admin-logout-btn"
          className="bg-transparent border-white/20 hover:bg-white/5 text-white"
        >
          <LogOut size={15} className="mr-2" /> Logout
        </Button>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="bg-[#1a1d27] border border-white/5 flex-wrap h-auto">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-products">Produk</TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-orders">Order</TabsTrigger>
          <TabsTrigger value="customers" data-testid="tab-customers">Pelanggan</TabsTrigger>
          <TabsTrigger value="affiliates" data-testid="tab-affiliates">Affiliate</TabsTrigger>
          <TabsTrigger value="withdrawals" data-testid="tab-withdrawals">WD</TabsTrigger>
          <TabsTrigger value="loyalty" data-testid="tab-loyalty">Loyalty</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">Keamanan</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardTab api={api} password={password} />
        </TabsContent>
        <TabsContent value="products" className="mt-6">
          <ProductsTab api={api} />
        </TabsContent>
        <TabsContent value="orders" className="mt-6">
          <OrdersTab api={api} />
        </TabsContent>
        <TabsContent value="customers" className="mt-6">
          <CustomersTab api={api} password={password} />
        </TabsContent>
        <TabsContent value="affiliates" className="mt-6">
          <AffiliatesTab api={api} password={password} />
        </TabsContent>
        <TabsContent value="withdrawals" className="mt-6">
          <WithdrawalsTab api={api} />
        </TabsContent>
        <TabsContent value="loyalty" className="mt-6">
          <LoyaltyTab api={api} />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <SettingsTab api={api} />
        </TabsContent>
        <TabsContent value="security" className="mt-6">
          <ChangePasswordTab api={api} currentPassword={password} onPasswordChanged={handlePasswordChanged} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Products ----------
function ProductsTab({ api }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = () => api.get("/products").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!confirm("Hapus produk ini?")) return;
    await api.delete(`/admin/products/${id}`);
    toast.success("Produk dihapus");
    load();
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg">Daftar Produk ({items.length})</h3>
        <Button
          data-testid="add-product-btn"
          onClick={() => { setEditing(null); setOpen(true); }}
          className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
        >
          <Plus size={15} className="mr-1" /> Tambah Produk
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-white/60">Produk</TableHead>
            <TableHead className="text-white/60">Harga</TableHead>
            <TableHead className="text-white/60">Komisi</TableHead>
            <TableHead className="text-white/60">Terjual</TableHead>
            <TableHead className="text-white/60">Stok</TableHead>
            <TableHead className="text-white/60 text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => {
            const has = p.discount_active && p.discount_price;
            return (
              <TableRow key={p.id} className="border-white/5" data-testid={`product-row-${p.id}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <img src={p.photo_url} alt="" className="w-10 h-10 rounded-md object-cover" />
                    <div>
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-white/40 line-clamp-1 max-w-xs">{p.description}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {has && <div className="text-white/40 line-through text-xs">{formatIDR(p.original_price)}</div>}
                  <div className="gold-text font-semibold">{formatIDR(has ? p.discount_price : p.original_price)}</div>
                </TableCell>
                <TableCell className="text-sm">{p.commission_percent}%</TableCell>
                <TableCell className="text-sm">
                  <span className="text-[#F5A623] font-medium">🔥 {p.monthly_sold || 0}</span>
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] border ${
                    p.stock_status === "available"
                      ? "bg-green-500/15 text-green-300 border-green-500/30"
                      : "bg-red-500/15 text-red-300 border-red-500/30"
                  }`}>
                    {p.stock_status === "available" ? "Tersedia" : "Habis"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <button
                    data-testid={`edit-product-${p.id}`}
                    onClick={() => { setEditing(p); setOpen(true); }}
                    className="p-2 rounded-md text-white/70 hover:bg-white/5 hover:text-[#F5A623]"
                  >
                    <Edit size={15} />
                  </button>
                  <button
                    data-testid={`delete-product-${p.id}`}
                    onClick={() => remove(p.id)}
                    className="p-2 rounded-md text-white/70 hover:bg-white/5 hover:text-red-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-white/40 py-6">Belum ada produk</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      {open && (
        <ProductFormDialog
          key={editing?.id || "new"}
          open={open}
          onOpenChange={setOpen}
          editing={editing}
          api={api}
          onSaved={() => { setOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function ProductFormDialog({ open, onOpenChange, editing, api, onSaved }) {
  const [form, setForm] = useState(() => editing ? {
    ...editing,
    original_price: editing.original_price,
    discount_price: editing.discount_price || "",
    monthly_sold: editing.monthly_sold || 0,
  } : {
    name: "",
    photo_url: "",
    original_price: "",
    discount_price: "",
    discount_active: false,
    description: "",
    commission_percent: 10,
    stock_status: "available",
    monthly_sold: 0,
  });
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!form.name || !form.photo_url || !form.original_price) return toast.error("Lengkapi data wajib");
    setSaving(true);
    const payload = {
      name: form.name,
      photo_url: form.photo_url,
      original_price: parseFloat(form.original_price),
      discount_price: form.discount_price ? parseFloat(form.discount_price) : null,
      discount_active: form.discount_active,
      description: form.description,
      commission_percent: parseFloat(form.commission_percent),
      stock_status: form.stock_status,
      monthly_sold: parseInt(form.monthly_sold || 0, 10),
    };
    try {
      if (editing) await api.put(`/admin/products/${editing.id}`, payload);
      else await api.post("/admin/products", payload);
      toast.success(editing ? "Produk diupdate" : "Produk ditambahkan");
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menyimpan");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="product-form-dialog" className="bg-[#1a1d27] border-white/10 text-white sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{editing ? "Edit Produk" : "Tambah Produk"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Field label="Nama Produk">
            <Input data-testid="pf-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
          </Field>
          <Field label="URL Foto">
            <Input data-testid="pf-photo" value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
              className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Harga Asli">
              <Input data-testid="pf-original-price" type="number" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })}
                className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
            </Field>
            <Field label="Harga Diskon (opsional)">
              <Input data-testid="pf-discount-price" type="number" value={form.discount_price} onChange={(e) => setForm({ ...form, discount_price: e.target.value })}
                className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
            </Field>
          </div>
          <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#0f1117] border border-white/10">
            <Label className="text-sm">Aktifkan Diskon</Label>
            <Switch
              data-testid="pf-discount-active"
              checked={form.discount_active}
              onCheckedChange={(v) => setForm({ ...form, discount_active: v })}
              className="data-[state=checked]:bg-[#F5A623]"
            />
          </div>
          <Field label="Deskripsi Singkat">
            <Textarea data-testid="pf-description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Komisi (%)">
              <Input data-testid="pf-commission" type="number" min="0" max="100" value={form.commission_percent} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })}
                className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
            </Field>
            <Field label="Status Stok">
              <Select value={form.stock_status} onValueChange={(v) => setForm({ ...form, stock_status: v })}>
                <SelectTrigger data-testid="pf-stock" className="bg-[#0f1117] border-white/15"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1d27] border-white/10 text-white">
                  <SelectItem value="available">Tersedia</SelectItem>
                  <SelectItem value="unavailable">Tidak tersedia</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Jumlah Terjual Bulan Ini (manual)">
            <Input
              data-testid="pf-monthly-sold"
              type="number"
              min="0"
              value={form.monthly_sold}
              onChange={(e) => setForm({ ...form, monthly_sold: e.target.value })}
              placeholder="0"
              className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
            />
          </Field>
          <DialogFooter>
            <Button type="submit" data-testid="pf-submit" disabled={saving} className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold">
              {saving ? <Loader2 className="animate-spin" size={15} /> : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const Field = ({ label, children }) => (
  <div>
    <Label className="text-xs uppercase tracking-widest text-white/60">{label}</Label>
    <div className="mt-1">{children}</div>
  </div>
);

// ---------- Orders ----------
function OrdersTab({ api }) {
  const [items, setItems] = useState([]);
  const load = () => api.get("/admin/orders").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/admin/orders/${id}/status`, { status });
      toast.success(status === "confirmed" ? "Order dikonfirmasi" : "Order dibatalkan");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal update");
    }
  };

  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="font-display text-lg mb-4">Order ({items.length})</h3>
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-white/60">Order</TableHead>
            <TableHead className="text-white/60">Pembeli</TableHead>
            <TableHead className="text-white/60">Produk</TableHead>
            <TableHead className="text-white/60">Bayar</TableHead>
            <TableHead className="text-white/60">Ref</TableHead>
            <TableHead className="text-white/60">Status</TableHead>
            <TableHead className="text-white/60 text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((o) => (
            <TableRow key={o.id} className="border-white/5" data-testid={`order-row-${o.id}`}>
              <TableCell className="font-mono text-xs">{o.order_code}</TableCell>
              <TableCell>
                <div className="text-sm">{o.buyer_name}</div>
                <div className="text-xs text-white/40">{o.contact}</div>
              </TableCell>
              <TableCell className="text-sm">
                {o.product_name}
                <div className="text-xs gold-text">{formatIDR(o.product_price)}</div>
              </TableCell>
              <TableCell className="text-sm uppercase text-white/70">{o.payment_method}</TableCell>
              <TableCell className="text-xs font-mono text-[#F5A623]">{o.referral_affiliate_code || "-"}</TableCell>
              <TableCell><Badge status={o.status} /></TableCell>
              <TableCell className="text-right">
                {o.status === "pending" ? (
                  <>
                    <button
                      data-testid={`confirm-order-${o.id}`}
                      onClick={() => updateStatus(o.id, "confirmed")}
                      className="p-1.5 mr-1 rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-300"
                    ><Check size={15} /></button>
                    <button
                      data-testid={`cancel-order-${o.id}`}
                      onClick={() => updateStatus(o.id, "cancelled")}
                      className="p-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-300"
                    ><X size={15} /></button>
                  </>
                ) : <span className="text-xs text-white/30">—</span>}
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-center text-white/40 py-6">Belum ada order</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------- Affiliates ----------
function AffiliatesTab({ api, password }) {
  const [items, setItems] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [individualOpen, setIndividualOpen] = useState(null); // affiliate object
  useEffect(() => { api.get("/admin/affiliates").then((r) => setItems(r.data)); }, []);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="font-display text-lg">Affiliate ({items.length})</h3>
        <Button
          data-testid="export-all-affiliates-btn"
          onClick={() => setBulkOpen(true)}
          className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
          size="sm"
        >
          <Download size={14} className="mr-2" /> Export Semua Affiliate
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-white/60">Affiliate</TableHead>
            <TableHead className="text-white/60">Kontak</TableHead>
            <TableHead className="text-white/60">Saldo</TableHead>
            <TableHead className="text-white/60">Total Earned</TableHead>
            <TableHead className="text-white/60">Total Sales</TableHead>
            <TableHead className="text-white/60 text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((a) => (
            <TableRow key={a.id} className="border-white/5" data-testid={`affiliate-row-${a.id}`}>
              <TableCell>
                <div className="text-sm">{a.name}</div>
                <div className="text-xs font-mono text-[#F5A623]">{a.affiliate_code}</div>
              </TableCell>
              <TableCell className="text-sm">{a.contact}</TableCell>
              <TableCell className="gold-text font-semibold">{formatIDR(a.balance)}</TableCell>
              <TableCell className="text-sm">{formatIDR(a.total_earned)}</TableCell>
              <TableCell className="text-sm">{a.total_sales}</TableCell>
              <TableCell className="text-right">
                <button
                  data-testid={`export-affiliate-${a.affiliate_code}`}
                  onClick={() => setIndividualOpen(a)}
                  className="p-1.5 rounded-md bg-[#F5A623]/10 hover:bg-[#F5A623]/20 text-[#F5A623] inline-flex items-center gap-1 text-xs"
                >
                  <Download size={13} /> Export
                </button>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-white/40 py-6">Belum ada affiliate</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      {bulkOpen && (
        <AffiliateExportDialog
          mode="all"
          password={password}
          open={bulkOpen}
          onOpenChange={setBulkOpen}
        />
      )}
      {individualOpen && (
        <AffiliateExportDialog
          mode="single"
          affiliate={individualOpen}
          password={password}
          open={!!individualOpen}
          onOpenChange={(v) => !v && setIndividualOpen(null)}
        />
      )}
    </div>
  );
}

// ---------- Withdrawals ----------
function WithdrawalsTab({ api }) {
  const [items, setItems] = useState([]);
  const load = () => api.get("/admin/withdrawals").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const update = async (id, status) => {
    try {
      await api.patch(`/admin/withdrawals/${id}/status`, { status });
      toast.success(status === "approved" ? "WD disetujui" : "WD ditolak");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal update");
    }
  };

  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="font-display text-lg mb-4">Withdrawal ({items.length})</h3>
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-white/60">Affiliate</TableHead>
            <TableHead className="text-white/60">Nominal</TableHead>
            <TableHead className="text-white/60">Metode</TableHead>
            <TableHead className="text-white/60">Rekening</TableHead>
            <TableHead className="text-white/60">Status</TableHead>
            <TableHead className="text-white/60 text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((w) => (
            <TableRow key={w.id} className="border-white/5" data-testid={`wd-row-${w.id}`}>
              <TableCell>
                <div className="text-sm">{w.affiliate_name}</div>
                <div className="text-xs font-mono text-[#F5A623]">{w.affiliate_code}</div>
              </TableCell>
              <TableCell className="gold-text font-semibold">{formatIDR(w.amount)}</TableCell>
              <TableCell className="text-sm">{w.method}</TableCell>
              <TableCell className="text-sm font-mono">{w.account_number}</TableCell>
              <TableCell><Badge status={w.status} /></TableCell>
              <TableCell className="text-right">
                {w.status === "pending" ? (
                  <>
                    <button
                      data-testid={`approve-wd-${w.id}`}
                      onClick={() => update(w.id, "approved")}
                      className="p-1.5 mr-1 rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-300"
                    ><Check size={15} /></button>
                    <button
                      data-testid={`reject-wd-${w.id}`}
                      onClick={() => update(w.id, "rejected")}
                      className="p-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-300"
                    ><X size={15} /></button>
                  </>
                ) : <span className="text-xs text-white/30">—</span>}
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-white/40 py-6">Belum ada WD</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------- Loyalty ----------
function LoyaltyTab({ api }) {
  const [members, setMembers] = useState([]);
  const [codes, setCodes] = useState([]);

  useEffect(() => {
    api.get("/admin/loyalty/members").then((r) => setMembers(r.data));
    api.get("/admin/loyalty/codes").then((r) => setCodes(r.data));
  }, []);

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6">
        <h3 className="font-display text-lg mb-4">Member Poin ({members.length})</h3>
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-white/60">Nama</TableHead>
              <TableHead className="text-white/60">WhatsApp</TableHead>
              <TableHead className="text-white/60">Streak</TableHead>
              <TableHead className="text-white/60">Daftar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id} className="border-white/5" data-testid={`loyalty-member-${m.id}`}>
                <TableCell className="text-sm">{m.name}</TableCell>
                <TableCell className="font-mono text-xs">+{m.whatsapp}</TableCell>
                <TableCell className="text-sm gold-text font-semibold">🔥 {m.streak}</TableCell>
                <TableCell className="text-xs text-white/50">{m.created_at?.slice(0, 10)}</TableCell>
              </TableRow>
            ))}
            {members.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-white/40 py-6">Belum ada member</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="font-display text-lg mb-4">Kode Diskon ({codes.length})</h3>
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-white/60">Kode</TableHead>
              <TableHead className="text-white/60">Member</TableHead>
              <TableHead className="text-white/60">Diskon</TableHead>
              <TableHead className="text-white/60">Status</TableHead>
              <TableHead className="text-white/60">Dibuat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {codes.map((c) => (
              <TableRow key={c.id} className="border-white/5" data-testid={`loyalty-code-${c.code}`}>
                <TableCell className="font-mono text-sm gold-text">{c.code}</TableCell>
                <TableCell className="text-sm">{c.member_name}<div className="text-xs text-white/40 font-mono">+{c.member_whatsapp}</div></TableCell>
                <TableCell className="text-sm">{c.percentage}%</TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] border ${
                    c.used ? "bg-white/5 text-white/50 border-white/10" : "bg-green-500/15 text-green-300 border-green-500/30"
                  }`}>{c.used ? "Sudah dipakai" : "Aktif"}</span>
                </TableCell>
                <TableCell className="text-xs text-white/50">{c.created_at?.slice(0, 10)}</TableCell>
              </TableRow>
            ))}
            {codes.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-white/40 py-6">Belum ada kode</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------- Settings ----------
function SettingsTab({ api }) {
  const [stats, setStats] = useState({
    products_sold: "",
    active_partners: "",
    rating: "",
    online_base: 50,
    live_feed_enabled: true,
    loyalty_discount_percent: 10,
    live_feed_names: [],
    qris_url: "",
    bank_accounts: [],
  });
  const [namesText, setNamesText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/stats").then((r) => {
      setStats(r.data);
      setNamesText((r.data.live_feed_names || []).join(", "));
    }).finally(() => setLoading(false));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!stats.products_sold || !stats.active_partners || !stats.rating) {
      return toast.error("Field social proof wajib diisi");
    }
    const namesArr = namesText.split(",").map((s) => s.trim()).filter(Boolean);
    setSaving(true);
    try {
      const res = await api.put("/admin/stats", {
        ...stats,
        online_base: parseInt(stats.online_base, 10) || 50,
        loyalty_discount_percent: Math.max(1, Math.min(100, parseInt(stats.loyalty_discount_percent, 10) || 10)),
        live_feed_names: namesArr,
        qris_url: stats.qris_url || "",
        bank_accounts: stats.bank_accounts || [],
      });
      setStats(res.data);
      toast.success("Pengaturan berhasil disimpan");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-white/40 text-sm">Memuat...</div>;

  return (
    <div className="glass rounded-2xl p-6 max-w-2xl">
      <h3 className="font-display text-lg">Social Proof Statistics</h3>
      <p className="text-white/50 text-sm mt-1">
        Angka ini tampil di urgency section storefront. Update manual seiring bisnis berkembang.
      </p>
      <div className="mt-4 p-3 rounded-lg bg-[#F5A623]/5 border border-[#F5A623]/20 text-xs text-white/65">
        <b className="text-[#F5A623]">💡 Format bebas:</b> kamu boleh isi pakai apa aja —
        misal <code className="text-white">&quot;243+&quot;</code>,{" "}
        <code className="text-white">&quot;1.2K+&quot;</code>,{" "}
        <code className="text-white">&quot;10rb+&quot;</code>,{" "}
        <code className="text-white">&quot;5.0/5&quot;</code>, atau{" "}
        <code className="text-white">&quot;Rp 1.5jt&quot;</code>. Animasi count-up akan otomatis menyesuaikan.
      </div>
      <form onSubmit={save} className="space-y-4 mt-6">
        <Field label="Produk Terjual">
          <Input
            data-testid="settings-products-sold-input"
            value={stats.products_sold}
            onChange={(e) => setStats({ ...stats, products_sold: e.target.value })}
            placeholder='Contoh: 243+ / 1.2K+ / 10rb+'
            className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
          />
        </Field>
        <Field label="Mitra Aktif">
          <Input
            data-testid="settings-active-partners-input"
            value={stats.active_partners}
            onChange={(e) => setStats({ ...stats, active_partners: e.target.value })}
            placeholder='Contoh: 89+ / 250+ / 1K+'
            className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
          />
        </Field>
        <Field label="Rating Kepuasan">
          <Input
            data-testid="settings-rating-input"
            value={stats.rating}
            onChange={(e) => setStats({ ...stats, rating: e.target.value })}
            placeholder='Contoh: 4.9/5 / 5.0/5 / 98%'
            className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
          />
        </Field>
        <Button
          type="submit"
          data-testid="settings-save-btn"
          disabled={saving}
          className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
        >
          {saving ? <Loader2 className="animate-spin" size={15} /> : "Simpan"}
        </Button>
      </form>

      <div className="border-t border-white/5 mt-8 pt-6 space-y-4">
        <h3 className="font-display text-lg">Online Counter</h3>
        <Field label="Base Number (sistem fluktuasi ±5 di sekitar angka ini)">
          <Input
            data-testid="settings-online-base-input"
            type="number"
            min="1"
            value={stats.online_base}
            onChange={(e) => setStats({ ...stats, online_base: e.target.value })}
            placeholder="50"
            className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
          />
        </Field>

        <h3 className="font-display text-lg pt-2">Loyalty Program</h3>
        <Field label="Persentase Diskon Kode Loyalty (1–100)">
          <Input
            data-testid="settings-loyalty-discount-input"
            type="number"
            min="1"
            max="100"
            value={stats.loyalty_discount_percent}
            onChange={(e) => setStats({ ...stats, loyalty_discount_percent: e.target.value })}
            placeholder="10"
            className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
          />
        </Field>
        <p className="text-[11px] text-white/40 -mt-2">
          Diskon ini diterapkan ke kode baru yang di-generate setelah 7 hari streak. Kode lama tetap pakai % saat dibuat.
        </p>

        <h3 className="font-display text-lg pt-2">Live Activity Feed</h3>
        <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#0f1117] border border-white/10">
          <Label className="text-sm">Aktifkan pop-up notifikasi live</Label>
          <Switch
            data-testid="settings-livefeed-toggle"
            checked={stats.live_feed_enabled}
            onCheckedChange={(v) => setStats({ ...stats, live_feed_enabled: v })}
            className="data-[state=checked]:bg-[#F5A623]"
          />
        </div>
        <Field label="Daftar nama (pisahkan dengan koma)">
          <Textarea
            data-testid="settings-livefeed-names"
            rows={4}
            value={namesText}
            onChange={(e) => setNamesText(e.target.value)}
            placeholder="Andi, Budi, Cinta, Dewi, ..."
            className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
          />
        </Field>

        <h3 className="font-display text-lg pt-4">Pengaturan Pembayaran</h3>
        <Field label="URL Gambar QRIS">
          <Input
            data-testid="settings-qris-url-input"
            value={stats.qris_url || ""}
            onChange={(e) => setStats({ ...stats, qris_url: e.target.value })}
            placeholder="https://..."
            className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
          />
        </Field>
        {stats.qris_url && (
          <img src={stats.qris_url} alt="QRIS Preview" className="max-w-[180px] rounded-lg border border-white/10 bg-white p-2" />
        )}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-white/60">Daftar Rekening Bank</Label>
          {(stats.bank_accounts || []).map((b, i) => (
            <div key={i} data-testid={`bank-row-${i}`} className="rounded-lg border border-white/10 bg-[#0f1117] p-3 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <Input data-testid={`bank-name-${i}`} placeholder="Bank" value={b.bank_name || ""}
                onChange={(e) => { const a=[...stats.bank_accounts]; a[i]={...a[i], bank_name:e.target.value}; setStats({...stats, bank_accounts:a}); }}
                className="sm:col-span-3 bg-[#1a1d27] border-white/10" />
              <Input data-testid={`bank-num-${i}`} placeholder="Nomor Rekening" value={b.account_number || ""}
                onChange={(e) => { const a=[...stats.bank_accounts]; a[i]={...a[i], account_number:e.target.value}; setStats({...stats, bank_accounts:a}); }}
                className="sm:col-span-4 bg-[#1a1d27] border-white/10 font-mono" />
              <Input data-testid={`bank-holder-${i}`} placeholder="Atas Nama" value={b.holder || ""}
                onChange={(e) => { const a=[...stats.bank_accounts]; a[i]={...a[i], holder:e.target.value}; setStats({...stats, bank_accounts:a}); }}
                className="sm:col-span-4 bg-[#1a1d27] border-white/10" />
              <button type="button" data-testid={`delete-bank-${i}`}
                onClick={() => { if (window.confirm(`Yakin hapus rekening ${b.bank_name||''} ${b.account_number||''}?`)) { const a=[...stats.bank_accounts]; a.splice(i,1); setStats({...stats, bank_accounts:a}); } }}
                className="sm:col-span-1 p-2 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-300 flex items-center justify-center">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <Button type="button" data-testid="add-bank-btn"
            onClick={() => setStats({ ...stats, bank_accounts: [...(stats.bank_accounts||[]), { bank_name:"", account_number:"", holder:"" }] })}
            className="bg-white/5 hover:bg-white/10 text-white border border-white/15">
            <Plus size={15} className="mr-1" /> Tambah Rekening
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Change Password ----------
function ChangePasswordTab({ api, currentPassword, onPasswordChanged }) {
  const [form, setForm] = useState({ old_password: "", new_password: "", confirm_password: "" });
  const [saving, setSaving] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.old_password || !form.new_password || !form.confirm_password) {
      return toast.error("Mohon lengkapi semua field");
    }
    if (form.new_password !== form.confirm_password) {
      return toast.error("Konfirmasi password tidak cocok");
    }
    if (form.new_password.length < 8) {
      return toast.error("Password baru minimal 8 karakter");
    }
    setSaving(true);
    try {
      await api.post("/admin/change-password", form);
      toast.success("Password berhasil diubah");
      onPasswordChanged(form.new_password);
      setForm({ old_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal mengubah password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-6 max-w-md" data-testid="change-password-card">
      <h3 className="font-display text-lg">Ganti Password Admin</h3>
      <p className="text-white/50 text-sm mt-1">
        Password baru langsung berlaku untuk login admin berikutnya dan disimpan ter-enkripsi.
      </p>
      <form onSubmit={submit} className="space-y-4 mt-6">
        <Field label="Password Lama">
          <Input
            type="password"
            data-testid="old-password-input"
            value={form.old_password}
            onChange={update("old_password")}
            placeholder="••••••••"
            className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
          />
        </Field>
        <Field label="Password Baru (min. 8 karakter)">
          <Input
            type="password"
            data-testid="new-password-input"
            value={form.new_password}
            onChange={update("new_password")}
            placeholder="••••••••"
            className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
          />
        </Field>
        <Field label="Konfirmasi Password Baru">
          <Input
            type="password"
            data-testid="confirm-password-input"
            value={form.confirm_password}
            onChange={update("confirm_password")}
            placeholder="••••••••"
            className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
          />
        </Field>
        <Button
          type="submit"
          data-testid="change-password-submit-btn"
          disabled={saving}
          className="w-full bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
        >
          {saving ? <Loader2 className="animate-spin" size={15} /> : "Ubah Password"}
        </Button>
      </form>
    </div>
  );
}

const Badge = ({ status }) => {
  const map = {
    pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    confirmed: "bg-green-500/15 text-green-300 border-green-500/30",
    approved: "bg-green-500/15 text-green-300 border-green-500/30",
    cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
    rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${map[status] || "bg-white/5 text-white/60 border-white/10"}`}>
      {status}
    </span>
  );
};


// ---------- Dashboard / Evaluasi ----------
function DashboardTab({ api, password }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .get("/admin/dashboard")
      .then((r) => {
        setData(r.data);
        setError(null);
      })
      .catch((e) => {
        setError(e?.response?.data?.detail || "Gagal memuat dashboard");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-white/60">
        <Loader2 size={16} className="animate-spin" /> Memuat data evaluasi…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        {error}
        <Button
          size="sm"
          variant="outline"
          onClick={load}
          className="ml-3 bg-transparent border-white/20 hover:bg-white/5 text-white"
        >
          Coba lagi
        </Button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Ringkasan Evaluasi</h2>
          <p className="text-xs text-white/50">
            Statistik real-time dari order, affiliate, dan withdrawal yang
            terkonfirmasi lunas.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={load}
          className="bg-transparent border-white/20 hover:bg-white/5 text-white"
        >
          Refresh
        </Button>
      </div>

      <ExportReportPanel password={password} />

      {/* Stat Cards: Today / Week / Month */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Hari Ini"
          orders={data.today.count}
          revenue={data.today.revenue}
          accent="from-[#D4AF37]/30 to-[#D4AF37]/5"
        />
        <StatCard
          label="7 Hari Terakhir"
          orders={data.week.count}
          revenue={data.week.revenue}
          accent="from-emerald-500/30 to-emerald-500/5"
        />
        <StatCard
          label="30 Hari Terakhir"
          orders={data.month.count}
          revenue={data.month.revenue}
          accent="from-sky-500/30 to-sky-500/5"
        />
      </div>

      {/* Affiliate summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SmallStat
          label="Affiliate Aktif"
          value={data.active_affiliates.toLocaleString("id-ID")}
        />
        <SmallStat
          label="Total Komisi Earned"
          value={`Rp ${formatIDR(data.total_commission_earned)}`}
        />
        <SmallStat
          label="Total Komisi Terbayar"
          value={`Rp ${formatIDR(data.total_commission_paid)}`}
        />
      </div>

      {/* 7-day trend chart */}
      <TrendChart data={data.trend_7d || []} />

      {/* Top products */}
      <div className="rounded-xl border border-white/10 bg-[#1a1d27] p-5">
        <h3 className="text-sm font-semibold text-white/90 mb-3">
          Produk Terlaris
        </h3>
        {(!data.top_products || data.top_products.length === 0) && (
          <p className="text-xs text-white/50">Belum ada data.</p>
        )}
        <div className="space-y-2">
          {(data.top_products || []).map((p, i) => (
            <div
              key={p.product_id || i}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-6 h-6 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] text-xs font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-sm text-white/90 truncate">{p.name}</span>
              </div>
              <div className="text-right text-xs">
                <div className="text-white/80 font-medium">
                  {p.orders.toLocaleString("id-ID")} order
                </div>
                <div className="text-white/50">Rp {formatIDR(p.revenue)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, orders, revenue, accent = "from-white/10 to-white/0" }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/10 bg-[#1a1d27] p-5`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${accent} pointer-events-none`}
      />
      <div className="relative">
        <p className="text-xs uppercase tracking-wide text-white/60">{label}</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-2xl font-semibold text-white">
              {Number(orders || 0).toLocaleString("id-ID")}
            </p>
            <p className="text-[11px] text-white/50">Order lunas</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-[#D4AF37]">
              Rp {formatIDR(revenue)}
            </p>
            <p className="text-[11px] text-white/50">Omzet</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SmallStat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1d27] p-4">
      <p className="text-[11px] uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function TrendChart({ data }) {
  // Lazy import recharts to avoid SSR issues; safe in CRA dev too.
  // eslint-disable-next-line global-require
  const {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
  } = require("recharts");

  const formatted = (data || []).map((d) => {
    const dt = new Date(d.date + "T00:00:00Z");
    const label = dt.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
    });
    return { ...d, label };
  });

  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1d27] p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/90">
          Tren Order 7 Hari Terakhir
        </h3>
        <span className="text-[11px] text-white/40">
          Berdasarkan order lunas
        </span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formatted} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="rgba(255,255,255,0.5)"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            />
            <YAxis
              allowDecimals={false}
              stroke="rgba(255,255,255,0.5)"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            />
            <Tooltip
              contentStyle={{
                background: "#0f1117",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#fff",
                fontSize: 12,
              }}
              labelStyle={{ color: "#D4AF37" }}
              formatter={(value, name) => {
                if (name === "revenue") return [`Rp ${formatIDR(value)}`, "Omzet"];
                return [value, "Order"];
              }}
            />
            <Line
              type="monotone"
              dataKey="orders"
              stroke="#D4AF37"
              strokeWidth={2}
              dot={{ r: 3, fill: "#D4AF37" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


// ---------- Export Report Panel (Dashboard) ----------
function ExportReportPanel({ password }) {
  const [period, setPeriod] = useState("week");
  const [fmt, setFmt] = useState("xlsx");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (period === "custom" && (!start || !end)) {
      toast.error("Tanggal awal & akhir wajib diisi untuk Custom Range");
      return;
    }
    setBusy(true);
    try {
      const params = { period, fmt };
      if (period === "custom") {
        params.start = start;
        params.end = end;
      }
      await downloadAdminFile(password, "/admin/export/orders", params);
      toast.success("Laporan diunduh");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mengunduh laporan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="export-report-panel"
      className="rounded-xl border border-white/10 bg-[#1a1d27] p-5"
    >
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white/90">Export Laporan Order</h3>
          <p className="text-xs text-white/50">
            Download semua order (semua status) sesuai periode & format yang dipilih.
          </p>
        </div>
        <Button
          data-testid="export-orders-btn"
          onClick={download}
          disabled={busy}
          className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
          size="sm"
        >
          {busy ? <Loader2 className="animate-spin" size={14} /> : <><Download size={14} className="mr-2" /> Download</>}
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-white/60">Periode</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger data-testid="export-period-select" className="mt-1 bg-[#0f1117] border-white/15 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1d27] border-white/10 text-white">
              <SelectItem value="today">Hari Ini</SelectItem>
              <SelectItem value="week">Minggu Ini</SelectItem>
              <SelectItem value="month">Bulan Ini</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-white/60">Format</Label>
          <Select value={fmt} onValueChange={setFmt}>
            <SelectTrigger data-testid="export-format-select" className="mt-1 bg-[#0f1117] border-white/15 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1d27] border-white/10 text-white">
              <SelectItem value="xlsx">XLSX (Excel)</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {period === "custom" && (
          <>
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-white/60">Tanggal Awal</Label>
              <Input
                data-testid="export-start-date"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 bg-[#0f1117] border-white/15 text-white"
              />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-white/60">Tanggal Akhir</Label>
              <Input
                data-testid="export-end-date"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 bg-[#0f1117] border-white/15 text-white"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Customers Tab (Database Pelanggan) ----------
function CustomersTab({ api, password }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null); // {customer, orders}
  const [exportFmt, setExportFmt] = useState("xlsx");

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/admin/customers");
      setItems(r.data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (c) => (c.name || "").toLowerCase().includes(s) || (c.whatsapp || "").toLowerCase().includes(s)
    );
  }, [items, q]);

  const openDetail = async (c) => {
    try {
      const r = await api.get(`/admin/customers/${encodeURIComponent(c.whatsapp)}/orders`);
      setDetail({ customer: c, orders: r.data });
    } catch {
      toast.error("Gagal memuat riwayat order");
    }
  };

  const exportCustomers = async () => {
    try {
      await downloadAdminFile(password, "/admin/export/customers", { fmt: exportFmt });
      toast.success("Daftar pelanggan diunduh");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mengunduh");
    }
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="font-display text-lg">Database Pelanggan ({filtered.length})</h3>
        <div className="flex items-center gap-2">
          <Select value={exportFmt} onValueChange={setExportFmt}>
            <SelectTrigger data-testid="customers-export-format" className="bg-[#0f1117] border-white/15 text-white w-28 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1d27] border-white/10 text-white">
              <SelectItem value="xlsx">XLSX</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
            </SelectContent>
          </Select>
          <Button
            data-testid="customers-export-btn"
            onClick={exportCustomers}
            className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
            size="sm"
          >
            <Download size={14} className="mr-2" /> Export
          </Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <Input
          data-testid="customers-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama atau nomor WA…"
          className="pl-9 bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-white/60">Nama</TableHead>
            <TableHead className="text-white/60">Nomor WA</TableHead>
            <TableHead className="text-white/60">Total Order</TableHead>
            <TableHead className="text-white/60">Total Belanja</TableHead>
            <TableHead className="text-white/60">Order Terakhir</TableHead>
            <TableHead className="text-white/60 text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow><TableCell colSpan={6} className="text-center text-white/40 py-6">Memuat…</TableCell></TableRow>
          )}
          {!loading && filtered.map((c) => (
            <TableRow
              key={c.whatsapp}
              className="border-white/5 cursor-pointer hover:bg-white/[0.02]"
              data-testid={`customer-row-${c.whatsapp}`}
              onClick={() => openDetail(c)}
            >
              <TableCell className="text-sm">{c.name}</TableCell>
              <TableCell className="font-mono text-xs">{c.whatsapp}</TableCell>
              <TableCell className="text-sm">{c.total_orders}</TableCell>
              <TableCell className="gold-text font-semibold">{formatIDR(c.total_spent)}</TableCell>
              <TableCell className="text-xs text-white/60">
                {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("id-ID") : "-"}
              </TableCell>
              <TableCell className="text-right">
                <button className="text-xs text-[#F5A623] hover:underline" data-testid={`view-customer-${c.whatsapp}`}>
                  Lihat Detail
                </button>
              </TableCell>
            </TableRow>
          ))}
          {!loading && filtered.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-white/40 py-6">Belum ada pelanggan</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      {detail && (
        <CustomerDetailDialog
          open={!!detail}
          onOpenChange={(v) => !v && setDetail(null)}
          data={detail}
        />
      )}
    </div>
  );
}

function CustomerDetailDialog({ open, onOpenChange, data }) {
  const { customer, orders } = data;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1d27] border-white/10 text-white max-w-3xl" data-testid="customer-detail-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{customer.name}</DialogTitle>
          <p className="text-xs font-mono text-[#F5A623]">+{customer.whatsapp}</p>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 my-3">
          <div className="rounded-lg bg-[#0f1117] p-3 border border-white/5">
            <p className="text-[10px] uppercase tracking-wide text-white/50">Total Order</p>
            <p className="text-lg font-semibold">{customer.total_orders}</p>
          </div>
          <div className="rounded-lg bg-[#0f1117] p-3 border border-white/5">
            <p className="text-[10px] uppercase tracking-wide text-white/50">Total Belanja</p>
            <p className="text-base font-semibold gold-text">{formatIDR(customer.total_spent)}</p>
          </div>
          <div className="rounded-lg bg-[#0f1117] p-3 border border-white/5">
            <p className="text-[10px] uppercase tracking-wide text-white/50">Order Terakhir</p>
            <p className="text-xs mt-1">
              {customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString("id-ID") : "-"}
            </p>
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/60">Order</TableHead>
                <TableHead className="text-white/60">Produk</TableHead>
                <TableHead className="text-white/60">Harga</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Tanggal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id} className="border-white/5">
                  <TableCell className="font-mono text-xs">{o.order_code}</TableCell>
                  <TableCell className="text-sm">{o.product_name}</TableCell>
                  <TableCell className="text-sm gold-text">{formatIDR(o.product_price)}</TableCell>
                  <TableCell><Badge status={o.status} /></TableCell>
                  <TableCell className="text-xs text-white/60">
                    {o.created_at ? new Date(o.created_at).toLocaleDateString("id-ID") : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Affiliate Export Dialog (Single + Bulk) ----------
function AffiliateExportDialog({ mode, affiliate, password, open, onOpenChange }) {
  const [period, setPeriod] = useState("all");
  const [fmt, setFmt] = useState("xlsx");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (period === "custom" && (!start || !end)) {
      toast.error("Tanggal awal & akhir wajib diisi untuk Custom Range");
      return;
    }
    setBusy(true);
    try {
      const params = { period, fmt };
      if (period === "custom") {
        params.start = start;
        params.end = end;
      }
      const path =
        mode === "single"
          ? `/admin/export/affiliates/${affiliate.affiliate_code}`
          : "/admin/export/affiliates";
      await downloadAdminFile(password, path, params);
      toast.success("Laporan affiliate diunduh");
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mengunduh");
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "single"
    ? `Export Affiliate: ${affiliate?.name}`
    : "Export Semua Affiliate";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1d27] border-white/10 text-white" data-testid="affiliate-export-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{title}</DialogTitle>
          {mode === "single" && (
            <p className="text-xs font-mono text-[#F5A623]">{affiliate?.affiliate_code}</p>
          )}
          {mode === "all" && (
            <p className="text-xs text-white/55">
              XLSX = 1 sheet per affiliate. CSV = 1 baris per order dengan kolom nama affiliate.
            </p>
          )}
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-white/60">Periode</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger data-testid="aff-export-period" className="mt-1 bg-[#0f1117] border-white/15 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1d27] border-white/10 text-white">
                <SelectItem value="all">Semua Waktu</SelectItem>
                <SelectItem value="month">Bulan Ini</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-white/60">Format</Label>
            <Select value={fmt} onValueChange={setFmt}>
              <SelectTrigger data-testid="aff-export-format" className="mt-1 bg-[#0f1117] border-white/15 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1d27] border-white/10 text-white">
                <SelectItem value="xlsx">XLSX (Excel)</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] uppercase tracking-wide text-white/60">Tanggal Awal</Label>
                <Input
                  data-testid="aff-export-start"
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="mt-1 bg-[#0f1117] border-white/15 text-white"
                />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wide text-white/60">Tanggal Akhir</Label>
                <Input
                  data-testid="aff-export-end"
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="mt-1 bg-[#0f1117] border-white/15 text-white"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-transparent border-white/20 hover:bg-white/5 text-white"
          >
            Batal
          </Button>
          <Button
            data-testid="aff-export-submit"
            onClick={submit}
            disabled={busy}
            className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
          >
            {busy ? <Loader2 className="animate-spin" size={14} /> : <><Download size={14} className="mr-2" /> Download</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
