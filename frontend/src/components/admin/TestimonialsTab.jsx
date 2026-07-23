import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Star, Pin, Trash2, Check, EyeOff, Undo2, Edit, Plus, Image as ImageIcon, X as XIcon, Shield, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { resolveImageUrl, API } from "@/lib/api";
import axios from "axios";

const STATUS_TABS = [
  { key: "pending", label: "Menunggu Review", color: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
  { key: "approved", label: "Ditampilkan", color: "bg-green-500/15 text-green-300 border-green-500/30" },
  { key: "hidden", label: "Disembunyikan", color: "bg-white/10 text-white/60 border-white/20" },
  { key: "admin", label: "Posting Admin", color: "bg-[#F5A623]/15 text-[#F5A623] border-[#F5A623]/40" },
  { key: "settings", label: "Settings", color: "" },
];

export default function TestimonialsTab({ api }) {
  const [active, setActive] = useState("pending");
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, hidden: 0, admin_posts: 0 });
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (active === "admin") params.source = "admin";
      else if (active !== "settings") params.status = active;

      if (active !== "settings") {
        const r = await api.get("/admin/testimonials", { params });
        setItems(r.data);
      }
      const c = await api.get("/admin/testimonials/counts");
      setCounts(c.data);
    } catch (e) {
      toast.error("Gagal load testimoni");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [active]);
  useEffect(() => {
    api.get("/products").then((r) => setProducts(r.data.filter((p) => p.publish_status !== "draft"))).catch(() => {});
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/admin/testimonials/${id}/status`, { status });
      toast.success(`Status diubah → ${status}`);
      load();
    } catch (e) {
      toast.error("Gagal ubah status");
    }
  };

  const togglePin = async (id) => {
    try {
      const r = await api.patch(`/admin/testimonials/${id}/pin`);
      toast.success(r.data.is_pinned ? "Testimoni dipin ke atas 📌" : "Pin dilepas");
      load();
    } catch { toast.error("Gagal toggle pin"); }
  };

  const remove = async (id) => {
    if (!confirm("Hapus testimoni ini permanen?")) return;
    try {
      await api.delete(`/admin/testimonials/${id}`);
      toast.success("Testimoni dihapus");
      load();
    } catch { toast.error("Gagal hapus"); }
  };

  return (
    <div className="glass rounded-2xl p-6" data-testid="testimonials-tab">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="font-display text-lg">Testimoni Pembeli</h3>
          <p className="text-white/50 text-xs mt-1">Moderasi review dari pembeli publik + posting testimoni admin.</p>
        </div>
        {active === "admin" && (
          <Button
            data-testid="add-admin-testimonial-btn"
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
          >
            <Plus size={15} className="mr-1" /> Post Testimoni Admin
          </Button>
        )}
      </div>

      <Tabs value={active} onValueChange={setActive} className="w-full">
        <TabsList className="bg-[#1a1d27] border border-white/5 flex-wrap h-auto">
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} data-testid={`tt-tab-${t.key}`} className="text-xs">
              {t.label}
              {t.key === "pending" && counts.pending > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 text-[10px]">{counts.pending}</span>
              )}
              {t.key === "approved" && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 text-[10px]">{counts.approved}</span>
              )}
              {t.key === "hidden" && counts.hidden > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 text-[10px]">{counts.hidden}</span>
              )}
              {t.key === "admin" && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[#F5A623]/20 text-[#F5A623] text-[10px]">{counts.admin_posts}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {STATUS_TABS.filter((t) => t.key !== "settings").map((t) => (
          <TabsContent key={t.key} value={t.key} className="mt-4">
            {loading ? (
              <div className="py-12 text-center"><Loader2 className="inline animate-spin text-[#F5A623]" size={24} /></div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center text-white/50 text-sm border border-dashed border-white/10 rounded-xl">
                Belum ada testimoni di kategori ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((it) => (
                  <TestimonialCard
                    key={it.id}
                    item={it}
                    onApprove={() => updateStatus(it.id, "approved")}
                    onHide={() => updateStatus(it.id, "hidden")}
                    onReject={() => updateStatus(it.id, "rejected")}
                    onRestore={() => updateStatus(it.id, "approved")}
                    onPin={() => togglePin(it.id)}
                    onEdit={() => { setEditing(it); setShowForm(true); }}
                    onDelete={() => remove(it.id)}
                    activeTab={active}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}

        <TabsContent value="settings" className="mt-4">
          <TestimonialSettingsPanel api={api} />
        </TabsContent>
      </Tabs>

      {showForm && (
        <TestimonialFormDialog
          open={showForm}
          onOpenChange={setShowForm}
          editing={editing}
          products={products}
          api={api}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function TestimonialCard({ item, onApprove, onHide, onReject, onRestore, onPin, onEdit, onDelete, activeTab }) {
  return (
    <div data-testid={`testimonial-item-${item.id}`} className={`glass rounded-xl p-4 border ${item.is_pinned ? "border-[#F5A623]/40" : "border-white/5"} relative`}>
      {item.is_pinned && (
        <div className="absolute -top-2 -right-2 bg-[#F5A623] text-[#0f1117] rounded-full p-1.5">
          <Pin size={12} />
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{item.name}</div>
          <div className="text-[11px] text-white/40">{item.whatsapp || "-"}</div>
        </div>
        <div className="flex items-center gap-0.5 text-[#F5A623] flex-shrink-0">
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={11} fill={i < item.rating ? "currentColor" : "none"} strokeWidth={1.5} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {item.is_verified_buyer && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-300 border border-green-500/30 flex items-center gap-1">
            <ShieldCheck size={9} /> Verified Buyer
          </span>
        )}
        {item.is_admin_post && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/40 flex items-center gap-1">
            <Shield size={9} /> Admin Post
          </span>
        )}
        {item.product_name && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/25 truncate max-w-full">
            {item.product_name}
          </span>
        )}
      </div>

      <p className="text-xs text-white/70 line-clamp-4 mb-2">&ldquo;{item.content}&rdquo;</p>

      {item.photos && item.photos.length > 0 && (
        <div className="flex gap-1 mb-3">
          {item.photos.slice(0, 3).map((p, i) => (
            <img key={i} src={resolveImageUrl(p)} alt="" className="w-14 h-14 object-cover rounded" />
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 pt-3 border-t border-white/5 flex-wrap">
        {activeTab === "pending" && (
          <>
            <Button size="sm" onClick={onApprove} data-testid={`approve-${item.id}`} className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white">
              <Check size={12} className="mr-1" /> Approve
            </Button>
            <Button size="sm" onClick={onReject} data-testid={`reject-${item.id}`} variant="outline" className="h-7 text-xs bg-transparent border-red-500/40 text-red-400 hover:bg-red-500/10">
              <XIcon size={12} className="mr-1" /> Reject
            </Button>
          </>
        )}
        {activeTab === "approved" && (
          <>
            <Button size="sm" onClick={onPin} data-testid={`pin-${item.id}`} variant="outline" className="h-7 text-xs bg-transparent border-[#F5A623]/40 text-[#F5A623] hover:bg-[#F5A623]/10">
              <Pin size={12} className="mr-1" /> {item.is_pinned ? "Unpin" : "Pin"}
            </Button>
            <Button size="sm" onClick={onHide} data-testid={`hide-${item.id}`} variant="outline" className="h-7 text-xs bg-transparent border-white/15 text-white/70 hover:bg-white/5">
              <EyeOff size={12} className="mr-1" /> Hide
            </Button>
          </>
        )}
        {activeTab === "hidden" && (
          <Button size="sm" onClick={onRestore} data-testid={`restore-${item.id}`} className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white">
            <Undo2 size={12} className="mr-1" /> Restore
          </Button>
        )}
        {activeTab === "admin" && (
          <>
            <Button size="sm" onClick={onEdit} data-testid={`edit-${item.id}`} variant="outline" className="h-7 text-xs bg-transparent border-white/15 text-white/70 hover:bg-white/5">
              <Edit size={12} className="mr-1" /> Edit
            </Button>
            <Button size="sm" onClick={onPin} variant="outline" className="h-7 text-xs bg-transparent border-[#F5A623]/40 text-[#F5A623] hover:bg-[#F5A623]/10">
              <Pin size={12} className="mr-1" /> {item.is_pinned ? "Unpin" : "Pin"}
            </Button>
          </>
        )}
        <Button size="sm" onClick={onDelete} data-testid={`delete-${item.id}`} variant="outline" className="h-7 text-xs bg-transparent border-red-500/40 text-red-400 hover:bg-red-500/10 ml-auto">
          <Trash2 size={12} />
        </Button>
      </div>
    </div>
  );
}

function TestimonialFormDialog({ open, onOpenChange, editing, products, api, onSaved }) {
  const [form, setForm] = useState(() => editing || {
    name: "",
    whatsapp: "",
    product_id: "",
    rating: 5,
    content: "",
    photos: [],
    is_verified_buyer: false,
    is_admin_post: true,
    is_pinned: false,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadPhoto = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await axios.post(`${API}/testimonials/upload`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, photos: [...(f.photos || []), r.data.url].slice(0, 5) }));
      toast.success("Foto ter-upload");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload gagal");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (idx) => {
    setForm((f) => ({ ...f, photos: f.photos.filter((_, i) => i !== idx) }));
  };

  const save = async () => {
    if (!form.name || form.name.length < 2) return toast.error("Nama minimal 2 karakter");
    if (!form.content || form.content.length < 5) return toast.error("Isi testimoni minimal 5 karakter");
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/testimonials/${editing.id}`, form);
        toast.success("Testimoni diupdate");
      } else {
        await api.post("/admin/testimonials", form);
        toast.success("Testimoni ditambahkan 🎉");
      }
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal simpan");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1d27] border-white/10 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Testimoni" : "Post Testimoni Admin"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs">Nama</Label>
            <Input data-testid="tt-form-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-[#0f1117] border-white/15 mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">WhatsApp (opsional)</Label>
              <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="bg-[#0f1117] border-white/15 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Rating</Label>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button key={r} type="button" onClick={() => setForm({ ...form, rating: r })}>
                    <Star size={20} className={r <= form.rating ? "text-[#F5A623] fill-[#F5A623]" : "text-white/20"} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs">Produk (opsional)</Label>
            <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className="w-full mt-1 bg-[#0f1117] border border-white/15 rounded-md px-3 py-2 text-sm text-white">
              <option value="">— Tanpa produk —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Isi Testimoni</Label>
            <Textarea data-testid="tt-form-content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} className="bg-[#0f1117] border-white/15 mt-1" />
          </div>
          <div>
            <Label className="text-xs">Foto (max 5)</Label>
            <div className="flex gap-2 flex-wrap mt-2">
              {(form.photos || []).map((p, i) => (
                <div key={i} className="relative w-16 h-16 rounded overflow-hidden">
                  <img src={resolveImageUrl(p)} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removePhoto(i)} className="absolute top-0 right-0 bg-red-500 rounded-bl p-0.5">
                    <XIcon size={10} />
                  </button>
                </div>
              ))}
              {(form.photos || []).length < 5 && (
                <label className="w-16 h-16 border-2 border-dashed border-white/15 rounded flex items-center justify-center cursor-pointer hover:border-[#F5A623]/50">
                  {uploading ? <Loader2 className="animate-spin" size={16} /> : <ImageIcon size={18} className="text-white/40" />}
                  <input type="file" accept="image/*" hidden onChange={(e) => e.target.files && e.target.files[0] && uploadPhoto(e.target.files[0])} />
                </label>
              )}
            </div>
            <p className="text-[10px] text-white/40 mt-1">Max 3MB per foto</p>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
            <Label className="text-xs">Badge Verified Buyer</Label>
            <Switch checked={form.is_verified_buyer} onCheckedChange={(v) => setForm({ ...form, is_verified_buyer: v })} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
            <Label className="text-xs">Badge Admin Post</Label>
            <Switch checked={form.is_admin_post} onCheckedChange={(v) => setForm({ ...form, is_admin_post: v })} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
            <Label className="text-xs">Pin ke atas</Label>
            <Switch checked={form.is_pinned} onCheckedChange={(v) => setForm({ ...form, is_pinned: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-transparent border-white/15 text-white/70 hover:bg-white/5">Batal</Button>
          <Button data-testid="tt-form-save" onClick={save} disabled={saving} className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold">
            {saving && <Loader2 className="animate-spin mr-1" size={13} />}
            {editing ? "Update" : "Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TestimonialSettingsPanel({ api }) {
  const [s, setS] = useState({
    form_enabled: true,
    satisfied_customers_text: "5.000+",
    claim_text: "",
    public_page_headline: "",
    public_page_subheadline: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/testimonials/settings").then((r) => { setS(r.data); }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/admin/testimonials/settings", s);
      toast.success("Settings testimoni tersimpan");
    } catch { toast.error("Gagal simpan"); } finally { setSaving(false); }
  };

  if (loading) return <div className="text-center py-8"><Loader2 className="animate-spin inline text-[#F5A623]" /></div>;

  return (
    <div className="max-w-2xl space-y-4" data-testid="tt-settings-panel">
      <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
        <div>
          <Label className="text-sm">Form Submission Publik</Label>
          <p className="text-xs text-white/50 mt-1">Aktif → pembeli bisa submit testimoni di /testimoni</p>
        </div>
        <Switch data-testid="tt-toggle-form" checked={s.form_enabled} onCheckedChange={(v) => setS({ ...s, form_enabled: v })} />
      </div>
      <div>
        <Label className="text-xs">Jumlah Pembeli Puas (badge)</Label>
        <Input data-testid="tt-satisfied-count" value={s.satisfied_customers_text} onChange={(e) => setS({ ...s, satisfied_customers_text: e.target.value })} placeholder="5.000+" className="bg-[#0f1117] border-white/15 mt-1" />
      </div>
      <div>
        <Label className="text-xs">Teks Klaim Tambahan</Label>
        <Input value={s.claim_text} onChange={(e) => setS({ ...s, claim_text: e.target.value })} placeholder="Sobat Creative yang sudah cuan..." className="bg-[#0f1117] border-white/15 mt-1" />
      </div>
      <div>
        <Label className="text-xs">Headline Halaman Publik</Label>
        <Input value={s.public_page_headline} onChange={(e) => setS({ ...s, public_page_headline: e.target.value })} className="bg-[#0f1117] border-white/15 mt-1" />
      </div>
      <div>
        <Label className="text-xs">Subheadline Halaman Publik</Label>
        <Textarea value={s.public_page_subheadline} onChange={(e) => setS({ ...s, public_page_subheadline: e.target.value })} rows={2} className="bg-[#0f1117] border-white/15 mt-1" />
      </div>
      <Button data-testid="tt-save-settings" onClick={save} disabled={saving} className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold">
        {saving && <Loader2 className="animate-spin mr-1" size={13} />}
        Simpan Settings
      </Button>
    </div>
  );
}
