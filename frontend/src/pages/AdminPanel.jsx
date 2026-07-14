import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { adminApi, formatIDR, downloadAdminFile, resolveImageUrl } from "@/lib/api";
import { parseBulkImportText } from "@/lib/bulkImportParser";
import ObjectPositionPicker from "@/components/ObjectPositionPicker";
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
import { Edit, LogOut, Plus, Trash2, Loader2, Check, X, Download, Search, Upload, Link2, Image as ImageIcon, Eye, EyeOff, Filter, Sparkles, Copy, RefreshCw, Bell, Tag, Star, HelpCircle, Info, GripVertical, ChevronLeft, ChevronRight } from "lucide-react";

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
          <TabsTrigger value="categories" data-testid="tab-categories">Kategori</TabsTrigger>
          <TabsTrigger value="waitlist" data-testid="tab-waitlist">Waitlist</TabsTrigger>
          <TabsTrigger value="reviews" data-testid="tab-reviews">Ulasan</TabsTrigger>
          <TabsTrigger value="faq" data-testid="tab-faq">FAQ</TabsTrigger>
          <TabsTrigger value="about" data-testid="tab-about">Tentang</TabsTrigger>
          <TabsTrigger value="coupons" data-testid="tab-coupons">Kupon</TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-orders">Order</TabsTrigger>
          <TabsTrigger value="customers" data-testid="tab-customers">History Pembeli</TabsTrigger>
          <TabsTrigger value="banners" data-testid="tab-banners">Banner Promo</TabsTrigger>
          <TabsTrigger value="affiliates" data-testid="tab-affiliates">Affiliate</TabsTrigger>
          <TabsTrigger value="withdrawals" data-testid="tab-withdrawals">WD</TabsTrigger>
          <TabsTrigger value="loyalty" data-testid="tab-loyalty">Loyalty</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          <TabsTrigger value="maintenance" data-testid="tab-maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">Keamanan</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardTab api={api} password={password} />
        </TabsContent>
        <TabsContent value="products" className="mt-6">
          <ProductsTab api={api} />
        </TabsContent>
        <TabsContent value="categories" className="mt-6">
          <CategoriesTab api={api} />
        </TabsContent>
        <TabsContent value="waitlist" className="mt-6">
          <WaitlistTab api={api} password={password} />
        </TabsContent>
        <TabsContent value="reviews" className="mt-6">
          <ReviewsTab api={api} />
        </TabsContent>
        <TabsContent value="faq" className="mt-6">
          <FAQTab api={api} />
        </TabsContent>
        <TabsContent value="about" className="mt-6">
          <AboutTab api={api} />
        </TabsContent>
        <TabsContent value="coupons" className="mt-6">
          <CouponsTab api={api} />
        </TabsContent>
        <TabsContent value="orders" className="mt-6">
          <OrdersTab api={api} />
        </TabsContent>
        <TabsContent value="customers" className="mt-6">
          <CustomersTab api={api} password={password} />
        </TabsContent>
        <TabsContent value="banners" className="mt-6">
          <BannersTab api={api} />
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
        <TabsContent value="maintenance" className="mt-6">
          <MaintenanceTab api={api} />
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
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [filter, setFilter] = useState("all"); // all | published | draft
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [generateOpen, setGenerateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // DnD sensors — pointer 8px minimum (avoid confusing with clicks) + touch long-press 300ms
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = () => api.get("/products").then((r) => setItems(r.data));
  const loadCategories = () => api.get("/categories").then((r) => setCategories(r.data));

  useEffect(() => {
    load();
    loadCategories();
  }, []);

  const publishedCount = items.filter((p) => p.publish_status !== "draft").length;
  const draftCount = items.filter((p) => p.publish_status === "draft").length;

  const filtered = items.filter((p) => {
    if (filter === "published") return p.publish_status !== "draft";
    if (filter === "draft") return p.publish_status === "draft";
    return true;
  }).sort((a, b) => {
    // Published dulu, lalu by display_order
    const sA = a.publish_status === "draft" ? 1 : 0;
    const sB = b.publish_status === "draft" ? 1 : 0;
    if (sA !== sB) return sA - sB;
    return (a.display_order || 999) - (b.display_order || 999);
  });

  // Pagination — reset ke halaman 1 ketika filter berubah
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageIds = paginated.map((p) => p.id);
  useEffect(() => { setPage(1); }, [filter]);

  const catNameMap = useMemo(() => {
    const m = {};
    categories.forEach((c) => { m[c.slug] = c.name; });
    return m;
  }, [categories]);

  const remove = async (id) => {
    if (!confirm("Hapus produk ini?")) return;
    await api.delete(`/admin/products/${id}`);
    toast.success("Produk dihapus");
    load();
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Cari posisi dalam SORTED filtered array (yang dirender)
    const pageItems = paginated;
    const oldIdx = pageItems.findIndex((p) => p.id === active.id);
    const newIdx = pageItems.findIndex((p) => p.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    // Cegah cross-status (published ↔ draft) — jaga grup
    if (pageItems[oldIdx].publish_status !== pageItems[newIdx].publish_status) {
      toast.error("Tidak bisa lintas grup Published/Draft");
      return;
    }

    // Optimistic UI: reorder items lokal terlebih dahulu
    const reordered = arrayMove(pageItems, oldIdx, newIdx);

    // Bangun full sorted list dengan reordered page menggantikan posisi lama
    const fullSorted = [...filtered];
    const pageStart = (page - 1) * PAGE_SIZE;
    for (let i = 0; i < reordered.length; i++) {
      fullSorted[pageStart + i] = reordered[i];
    }

    // Merge kembali ke items dengan display_order baru untuk grup published saja
    const publishedList = fullSorted.filter((p) => p.publish_status !== "draft");
    const draftList = fullSorted.filter((p) => p.publish_status === "draft");
    const newOrders = [];
    publishedList.forEach((p, i) => newOrders.push({ id: p.id, display_order: (i + 1) * 10 }));
    draftList.forEach((p, i) => newOrders.push({ id: p.id, display_order: (publishedList.length + i + 1) * 10 }));

    // Snapshot untuk rollback
    const snapshot = items;
    const orderMap = Object.fromEntries(newOrders.map((o) => [o.id, o.display_order]));
    setItems((prev) => prev.map((p) => (orderMap[p.id] != null ? { ...p, display_order: orderMap[p.id] } : p)));

    try {
      await api.post("/admin/products/reorder", { orders: newOrders });
      toast.success("Urutan berhasil diperbarui ✓");
    } catch (e) {
      setItems(snapshot);
      toast.error("Gagal simpan urutan, dikembalikan ke sebelumnya");
    }
  };

  const resetOrder = async () => {
    if (!confirm("Reset urutan sesuai tanggal ditambahkan (terbaru dulu)?")) return;
    try {
      const r = await api.post("/admin/products/reset-order");
      toast.success(`Urutan direset (${r.data.reset} produk)`);
      load();
    } catch { toast.error("Gagal reset urutan"); }
  };

  const togglePublish = async (product) => {
    const nextStatus = product.publish_status === "draft" ? "published" : "draft";
    if (nextStatus === "published") {
      // Ambil jumlah waitlist untuk konfirmasi
      let wCount = 0;
      try {
        const r = await api.get(`/admin/waitlist?product_id=${product.id}`);
        wCount = r.data.length;
      } catch (_e) { /* ignore */ }
      const ok = confirm(
        `Produk ini akan dipublish dan notifikasi otomatis dikirim ke ${wCount} orang di waitlist. Lanjutkan?`
      );
      if (!ok) return;
    }
    try {
      await api.patch(`/admin/products/${product.id}/publish-status`, {
        publish_status: nextStatus,
      });
      toast.success(nextStatus === "published" ? "Produk dipublish 🎉" : "Produk di-unpublish (Draft)");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal ubah status");
    }
  };

  const bulkPublish = async (status) => {
    if (selectedIds.size === 0) return toast.error("Pilih minimal 1 produk");
    if (status === "published") {
      const ok = confirm(
        `Publish ${selectedIds.size} produk terpilih? Notifikasi otomatis akan dikirim ke waitlist masing-masing produk.`
      );
      if (!ok) return;
    }
    try {
      const r = await api.post("/admin/products/bulk-publish", {
        ids: Array.from(selectedIds),
        publish_status: status,
      });
      toast.success(`${r.data.updated} produk di-${status}. ${r.data.notified} notif waitlist terkirim.`);
      setSelectedIds(new Set());
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal bulk update");
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  const toggleSelect = (id) => {
    const s = new Set(selectedIds);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelectedIds(s);
  };

  const incompleteCount = items.filter(
    (p) => !p.photo_url || !p.original_price || p.original_price <= 0
  ).length;

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="font-display text-lg">Daftar Produk ({items.length})</h3>
          <div className="text-xs mt-1 flex items-center gap-3">
            <span data-testid="counter-published" className="text-green-300">
              <Eye size={11} className="inline mr-0.5" /> {publishedCount} Published
            </span>
            <span data-testid="counter-draft" className="text-purple-300">
              <EyeOff size={11} className="inline mr-0.5" /> {draftCount} Draft
            </span>
            {incompleteCount > 0 && (
              <span data-testid="incomplete-count" className="text-amber-300/80">
                ⚠️ {incompleteCount} belum lengkap
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            data-testid="reset-order-btn"
            variant="outline"
            onClick={resetOrder}
            className="bg-transparent border-white/15 hover:bg-white/5 text-white/70"
          >
            <RefreshCw size={13} className="mr-1" /> Reset Urutan
          </Button>
          <Button
            data-testid="generate-info-btn"
            variant="outline"
            onClick={() => setGenerateOpen(true)}
            className="bg-transparent border-[#F5A623]/40 hover:bg-[#F5A623]/10 text-[#F5A623]"
          >
            <Sparkles size={15} className="mr-1" /> Generate Info Produk
          </Button>
          <Button
            data-testid="bulk-import-btn"
            variant="outline"
            onClick={() => setBulkOpen(true)}
            className="bg-transparent border-[#F5A623]/40 hover:bg-[#F5A623]/10 text-[#F5A623]"
          >
            <Upload size={15} className="mr-1" /> Import Massal
          </Button>
          <Button
            data-testid="add-product-btn"
            onClick={() => { setEditing(null); setOpen(true); }}
            className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
          >
            <Plus size={15} className="mr-1" /> Tambah Produk
          </Button>
        </div>
      </div>

      {/* Filter + Bulk Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex gap-2">
          {[
            { k: "all", label: "Semua" },
            { k: "published", label: "Published" },
            { k: "draft", label: "Draft" },
          ].map((f) => (
            <button
              key={f.k}
              data-testid={`filter-${f.k}`}
              onClick={() => setFilter(f.k)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filter === f.k
                  ? "bg-[#F5A623]/15 border-[#F5A623]/50 text-[#F5A623]"
                  : "bg-transparent border-white/15 text-white/60 hover:bg-white/5"
              }`}
            >
              <Filter size={11} className="inline mr-1" /> {f.label}
            </button>
          ))}
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">{selectedIds.size} dipilih</span>
            <Button
              data-testid="bulk-publish-btn"
              size="sm"
              onClick={() => bulkPublish("published")}
              className="bg-green-600 hover:bg-green-700 text-white h-8"
            >
              <Eye size={13} className="mr-1" /> Publish
            </Button>
            <Button
              data-testid="bulk-unpublish-btn"
              size="sm"
              onClick={() => bulkPublish("draft")}
              className="bg-purple-600 hover:bg-purple-700 text-white h-8"
            >
              <EyeOff size={13} className="mr-1" /> Unpublish
            </Button>
          </div>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pageIds} strategy={verticalListSortingStrategy}>
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-white/60 w-6"></TableHead>
            <TableHead className="text-white/60 w-8">
              <input
                type="checkbox"
                data-testid="select-all-checkbox"
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onChange={toggleSelectAll}
                className="accent-[#F5A623]"
              />
            </TableHead>
            <TableHead className="text-white/60">Produk</TableHead>
            <TableHead className="text-white/60">Kategori</TableHead>
            <TableHead className="text-white/60">Harga</TableHead>
            <TableHead className="text-white/60">Status</TableHead>
            <TableHead className="text-white/60 text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.map((p) => (
            <SortableProductRow
              key={p.id}
              product={p}
              catNameMap={catNameMap}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onTogglePublish={togglePublish}
              onEdit={(prod) => { setEditing(prod); setOpen(true); }}
              onDelete={remove}
            />
          ))}
        </TableBody>
      </Table>
        </SortableContext>
      </DndContext>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 flex-wrap gap-2" data-testid="products-pagination">
          <div className="text-xs text-white/50">
            Menampilkan {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} dari {filtered.length} produk
          </div>
          <div className="flex items-center gap-1">
            <button
              data-testid="page-prev-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-md text-white/70 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                data-testid={`page-btn-${n}`}
                onClick={() => setPage(n)}
                className={`w-8 h-8 rounded-md text-xs font-semibold transition-colors ${
                  n === currentPage
                    ? "bg-[#F5A623] text-[#0f1117]"
                    : "text-white/60 hover:bg-white/5"
                }`}
              >
                {n}
              </button>
            ))}
            <button
              data-testid="page-next-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-md text-white/70 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Halaman berikutnya"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {open && (
        <ProductFormDialog
          key={editing?.id || "new"}
          open={open}
          onOpenChange={setOpen}
          editing={editing}
          categories={categories}
          api={api}
          onSaved={() => { setOpen(false); load(); }}
        />
      )}

      {bulkOpen && (
        <BulkImportDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          api={api}
          onImported={() => { setBulkOpen(false); load(); }}
        />
      )}

      {generateOpen && (
        <GenerateInfoDialog
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          api={api}
        />
      )}
    </div>
  );
}

// ---------- SortableProductRow (dnd-kit) ----------
function SortableProductRow({ product: p, catNameMap, selectedIds, onToggleSelect, onTogglePublish, onEdit, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: p.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    boxShadow: isDragging ? "0 12px 32px rgba(0,0,0,0.6)" : undefined,
    background: isDragging ? "rgba(245, 166, 35, 0.05)" : undefined,
    zIndex: isDragging ? 10 : "auto",
    position: "relative",
  };

  const has = p.discount_active && p.discount_price;
  const incomplete = !p.photo_url || !p.original_price || p.original_price <= 0;
  const isDraft = p.publish_status === "draft";

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className="border-white/5 touch-none"
      data-testid={`product-row-${p.id}`}
    >
      <TableCell className="w-6 p-1">
        <button
          type="button"
          data-testid={`drag-handle-${p.id}`}
          {...attributes}
          {...listeners}
          aria-label="Drag untuk ubah urutan"
          className="p-1 rounded text-white/30 hover:text-[#F5A623] hover:bg-white/5 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={14} />
        </button>
      </TableCell>
      <TableCell>
        <input
          type="checkbox"
          data-testid={`select-${p.id}`}
          checked={selectedIds.has(p.id)}
          onChange={() => onToggleSelect(p.id)}
          className="accent-[#F5A623]"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          {p.photo_url ? (
            <img src={resolveImageUrl(p.photo_url)} alt="" className="w-10 h-10 rounded-md object-cover" style={{ objectPosition: p.image_position || "center center" }} />
          ) : (
            <div className="w-10 h-10 rounded-md bg-white/5 border border-dashed border-white/15 flex items-center justify-center text-white/30">
              <ImageIcon size={14} />
            </div>
          )}
          <div>
            <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
              {p.name}
              {incomplete && (
                <span
                  data-testid={`incomplete-badge-${p.id}`}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30"
                >
                  Belum Lengkap
                </span>
              )}
              {p.is_bestseller && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-300 border border-red-500/30">
                  🔥 Terlaris
                </span>
              )}
              {p.is_promo && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  🏷️ Promo
                </span>
              )}
            </div>
            <div className="text-xs text-white/40 line-clamp-1 max-w-xs">{p.description}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-xs text-white/70">
        {catNameMap[p.category] || p.category || "Lainnya"}
      </TableCell>
      <TableCell className="text-sm">
        {has && <div className="text-white/40 line-through text-xs">{formatIDR(p.original_price)}</div>}
        <div className="gold-text font-semibold">{formatIDR(has ? p.discount_price : p.original_price)}</div>
      </TableCell>
      <TableCell>
        <button
          data-testid={`toggle-status-${p.id}`}
          onClick={() => onTogglePublish(p)}
          className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
            isDraft
              ? "bg-purple-500/15 text-purple-300 border-purple-500/40 hover:bg-purple-500/25"
              : "bg-green-500/15 text-green-300 border-green-500/40 hover:bg-green-500/25"
          }`}
          title={isDraft ? "Klik untuk PUBLISH" : "Klik untuk UNPUBLISH (jadi Draft)"}
        >
          {isDraft ? <><EyeOff size={11} className="inline mr-0.5" /> DRAFT</> : <><Eye size={11} className="inline mr-0.5" /> PUBLISHED</>}
        </button>
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <button
          data-testid={`edit-product-${p.id}`}
          onClick={() => onEdit(p)}
          className="p-2 rounded-md text-white/70 hover:bg-white/5 hover:text-[#F5A623]"
        >
          <Edit size={15} />
        </button>
        <button
          data-testid={`delete-product-${p.id}`}
          onClick={() => onDelete(p.id)}
          className="p-2 rounded-md text-white/70 hover:bg-white/5 hover:text-red-400"
        >
          <Trash2 size={15} />
        </button>
      </TableCell>
    </TableRow>
  );
}



function ProductFormDialog({ open, onOpenChange, editing, categories, api, onSaved }) {
  const [form, setForm] = useState(() => editing ? {
    ...editing,
    original_price: editing.original_price,
    discount_price: editing.discount_price || "",
    monthly_sold: editing.monthly_sold || 0,
    publish_status: editing.publish_status || "draft",
    category: editing.category || "lainnya",
    is_bestseller: !!editing.is_bestseller,
    is_promo: !!editing.is_promo,
    stock_limit_enabled: !!editing.stock_limit_enabled,
    stock_quantity: editing.stock_quantity || 0,
    has_variants: !!editing.has_variants,
    image_position: editing.image_position || "center center",
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
    publish_status: "draft",
    category: "lainnya",
    is_bestseller: false,
    is_promo: false,
    stock_limit_enabled: false,
    stock_quantity: 0,
    has_variants: false,
    image_position: "center center",
  });
  const [saving, setSaving] = useState(false);
  const [variants, setVariants] = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(false);

  // Load existing variants when editing
  useEffect(() => {
    if (!editing?.id) { setVariants([]); return; }
    setVariantsLoading(true);
    api.get(`/admin/products/${editing.id}/variants`)
      .then((r) => setVariants(r.data || []))
      .catch(() => setVariants([]))
      .finally(() => setVariantsLoading(false));
  }, [editing, api]);

  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        id: null,
        name: "",
        price: 0,
        discount_price: null,
        is_recommended: false,
        is_best_value: false,
        display_order: prev.length,
        is_active: true,
      },
    ]);
  };
  const updateVariant = (idx, patch) => {
    setVariants((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      // Enforce exclusivity for is_recommended and is_best_value
      if (patch.is_recommended === true) {
        next.forEach((v, i) => { if (i !== idx) v.is_recommended = false; });
      }
      if (patch.is_best_value === true) {
        next.forEach((v, i) => { if (i !== idx) v.is_best_value = false; });
      }
      return next;
    });
  };
  const removeVariant = (idx) => {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };
  const moveVariant = (idx, dir) => {
    setVariants((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((v, i) => ({ ...v, display_order: i }));
    });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name || !form.photo_url) return toast.error("Lengkapi nama & foto produk");
    // Kalau has_variants, harga utama boleh 0 (akan di-override server). Kalau tidak, wajib.
    if (!form.has_variants && !form.original_price) return toast.error("Isi harga produk");
    if (form.has_variants) {
      const activeVars = variants.filter((v) => v.is_active);
      if (activeVars.length === 0) return toast.error("Aktifkan minimal 1 variasi atau matikan toggle 'Punya variasi'");
      if (activeVars.some((v) => !v.name || !v.price)) return toast.error("Setiap variasi wajib punya nama & harga");
    }
    setSaving(true);
    const payload = {
      name: form.name,
      photo_url: form.photo_url,
      original_price: parseFloat(form.original_price || 0),
      discount_price: form.discount_price ? parseFloat(form.discount_price) : null,
      discount_active: form.discount_active,
      description: form.description,
      commission_percent: parseFloat(form.commission_percent),
      stock_status: form.stock_status,
      monthly_sold: parseInt(form.monthly_sold || 0, 10),
      publish_status: form.publish_status,
      category: form.category,
      is_bestseller: form.is_bestseller,
      is_promo: form.is_promo,
      stock_limit_enabled: form.stock_limit_enabled,
      stock_quantity: parseInt(form.stock_quantity || 0, 10),
      has_variants: form.has_variants,
      image_position: form.image_position || "center center",
    };
    try {
      let productId = editing?.id;
      if (editing) await api.put(`/admin/products/${editing.id}`, payload);
      else {
        const res = await api.post("/admin/products", payload);
        productId = res.data.id;
      }
      // Persist variants (bulk replace) — hanya kalau produk punya id
      if (productId) {
        const variantPayload = variants.map((v, idx) => ({
          id: v.id || undefined,
          name: v.name,
          price: parseFloat(v.price || 0),
          discount_price: v.discount_price ? parseFloat(v.discount_price) : null,
          is_recommended: !!v.is_recommended,
          is_best_value: !!v.is_best_value,
          display_order: idx,
          is_active: !!v.is_active,
        }));
        await api.put(`/admin/products/${productId}/variants`, { variants: variantPayload });
      }
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
          <Field label="Foto Produk">
            <PhotoPicker
              value={form.photo_url}
              onChange={(url) => setForm({ ...form, photo_url: url })}
              api={api}
            />
          </Field>
          {form.photo_url && (
            <Field label="Posisi Gambar (crop focus)">
              <ObjectPositionPicker
                value={form.image_position}
                onChange={(pos) => setForm({ ...form, image_position: pos })}
                previewImage={form.photo_url.startsWith("/api/") ? (process.env.REACT_APP_BACKEND_URL + form.photo_url) : form.photo_url}
                testIdPrefix="pf-image-pos"
              />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategori">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="pf-category" className="bg-[#0f1117] border-white/15"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1d27] border-white/10 text-white">
                  {(categories || []).map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status Publikasi">
              <Select value={form.publish_status} onValueChange={(v) => setForm({ ...form, publish_status: v })}>
                <SelectTrigger data-testid="pf-publish-status" className="bg-[#0f1117] border-white/15"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1d27] border-white/10 text-white">
                  <SelectItem value="draft">📝 Draft (Coming Soon)</SelectItem>
                  <SelectItem value="published">✅ Published (Tayang)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          {!form.has_variants && (
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
          )}
          {!form.has_variants && (
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#0f1117] border border-white/10">
              <Label className="text-sm">Aktifkan Diskon (Flash Sale otomatis)</Label>
              <Switch
                data-testid="pf-discount-active"
                checked={form.discount_active}
                onCheckedChange={(v) => setForm({ ...form, discount_active: v })}
                className="data-[state=checked]:bg-[#F5A623]"
              />
            </div>
          )}

          {/* Variasi Produk section */}
          <div className="rounded-md bg-[#0f1117] border border-white/10 p-3 space-y-3" data-testid="variants-section">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">🎯 Produk Punya Variasi</Label>
                <p className="text-[10px] text-white/50 mt-0.5">Aktifkan kalau produk punya beberapa opsi (misal: 30 Hari, 90 Hari, 1 Tahun).</p>
              </div>
              <Switch
                data-testid="pf-has-variants"
                checked={form.has_variants}
                onCheckedChange={(v) => setForm({ ...form, has_variants: v })}
                className="data-[state=checked]:bg-[#F5A623]"
              />
            </div>
            {form.has_variants && (
              <div className="space-y-2 pt-2 border-t border-white/5" data-testid="variants-table">
                {variantsLoading && <p className="text-xs text-white/50">Memuat variasi…</p>}
                {variants.length === 0 && !variantsLoading && (
                  <p className="text-xs text-white/45">Belum ada variasi. Klik &quot;+ Tambah Variasi&quot; untuk mulai.</p>
                )}
                {variants.map((v, idx) => (
                  <div
                    key={v.id || `new-${idx}`}
                    data-testid={`variant-row-${idx}`}
                    className={`rounded-lg border p-2 space-y-2 ${v.is_active ? "border-white/10 bg-[#1a1d27]" : "border-white/5 bg-[#0f1117] opacity-60"}`}
                  >
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        data-testid={`variant-name-${idx}`}
                        placeholder="Nama variasi (30 Hari)"
                        value={v.name}
                        onChange={(e) => updateVariant(idx, { name: e.target.value })}
                        className="col-span-4 bg-[#0f1117] border-white/15 h-8 text-xs"
                      />
                      <Input
                        data-testid={`variant-price-${idx}`}
                        type="number"
                        placeholder="Harga normal"
                        value={v.price || ""}
                        onChange={(e) => updateVariant(idx, { price: e.target.value })}
                        className="col-span-3 bg-[#0f1117] border-white/15 h-8 text-xs"
                      />
                      <Input
                        data-testid={`variant-discount-${idx}`}
                        type="number"
                        placeholder="Diskon (opsional)"
                        value={v.discount_price || ""}
                        onChange={(e) => updateVariant(idx, { discount_price: e.target.value ? parseFloat(e.target.value) : null })}
                        className="col-span-3 bg-[#0f1117] border-white/15 h-8 text-xs"
                      />
                      <div className="col-span-2 flex items-center gap-0.5 justify-end">
                        <button type="button" onClick={() => moveVariant(idx, -1)} className="p-1 rounded hover:bg-white/5 text-white/50" title="Naik">▲</button>
                        <button type="button" onClick={() => moveVariant(idx, 1)} className="p-1 rounded hover:bg-white/5 text-white/50" title="Turun">▼</button>
                        <button
                          type="button"
                          onClick={() => removeVariant(idx)}
                          data-testid={`variant-remove-${idx}`}
                          className="p-1 rounded hover:bg-red-500/20 text-red-300"
                          title="Hapus"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[10px]">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          data-testid={`variant-recommended-${idx}`}
                          checked={!!v.is_recommended}
                          onChange={(e) => updateVariant(idx, { is_recommended: e.target.checked })}
                          className="accent-[#F5A623]"
                        />
                        <span className="text-[#F5A623]">⭐ Paling Dipilih</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          data-testid={`variant-bestvalue-${idx}`}
                          checked={!!v.is_best_value}
                          onChange={(e) => updateVariant(idx, { is_best_value: e.target.checked })}
                          className="accent-red-500"
                        />
                        <span className="text-red-300">🔥 Best Value</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer ml-auto">
                        <input
                          type="checkbox"
                          data-testid={`variant-active-${idx}`}
                          checked={!!v.is_active}
                          onChange={(e) => updateVariant(idx, { is_active: e.target.checked })}
                          className="accent-green-500"
                        />
                        <span className="text-white/60">Aktif</span>
                      </label>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addVariant}
                  data-testid="variant-add-btn"
                  className="w-full text-xs py-2 rounded-md border border-dashed border-white/15 text-white/60 hover:border-[#F5A623]/40 hover:text-[#F5A623] transition-colors"
                >
                  + Tambah Variasi
                </button>
              </div>
            )}
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
          {/* Badge toggles */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#0f1117] border border-white/10">
              <Label className="text-sm">🔥 Badge Terlaris</Label>
              <Switch
                data-testid="pf-bestseller"
                checked={form.is_bestseller}
                onCheckedChange={(v) => setForm({ ...form, is_bestseller: v })}
                className="data-[state=checked]:bg-red-500"
              />
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#0f1117] border border-white/10">
              <Label className="text-sm">🏷️ Badge Promo</Label>
              <Switch
                data-testid="pf-promo"
                checked={form.is_promo}
                onCheckedChange={(v) => setForm({ ...form, is_promo: v })}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
          </div>
          {/* Stok Terbatas */}
          <div className="px-3 py-3 rounded-md bg-[#0f1117] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">📦 Stok Terbatas</Label>
                <p className="text-[10px] text-white/50 mt-0.5">Aktifkan agar jumlah stok tampil & auto-decrement saat order confirmed.</p>
              </div>
              <Switch
                data-testid="pf-stock-limit-enabled"
                checked={form.stock_limit_enabled}
                onCheckedChange={(v) => setForm({ ...form, stock_limit_enabled: v })}
                className="data-[state=checked]:bg-orange-500"
              />
            </div>
            {form.stock_limit_enabled && (
              <div>
                <Label className="text-xs text-white/60">Jumlah Stok Tersedia</Label>
                <Input
                  data-testid="pf-stock-quantity"
                  type="number"
                  min="0"
                  value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                  placeholder="0"
                  className="mt-1 bg-[#1a1d27] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
                />
                <p className="text-[10px] text-white/50 mt-1">Stok = 0 → produk otomatis tampil &quot;Stok Habis&quot; di storefront.</p>
              </div>
            )}
          </div>
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


// ---------- Bulk Import Dialog ----------
const BULK_PREFIX_REGEX = /^(\s*(?:➥|→|>|[-*•]|\d+[.)])\s*)+/u;

function parseBulkInput(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(BULK_PREFIX_REGEX, "").trim())
    .filter(Boolean);
}

function BulkImportDialog({ open, onOpenChange, api, onImported }) {
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState([]);      // [{name, price}]
  const [duplicates, setDuplicates] = useState({}); // {idx: {status, matched_name}}
  const [keepDuplicates, setKeepDuplicates] = useState({}); // {idx: bool}
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const parsed = parseBulkImportText(raw);
    setPreview(parsed);
    setDuplicates({});
    setKeepDuplicates({});
  }, [raw]);

  // Auto-check duplicates when preview changes
  useEffect(() => {
    if (preview.length === 0) return;
    const t = setTimeout(async () => {
      setChecking(true);
      try {
        const r = await api.post("/admin/products/check-duplicates", { items: preview });
        const map = {};
        r.data.items.forEach((it, idx) => {
          if (it.status !== "new") {
            map[idx] = { status: it.status, matched_name: it.matched_name };
          }
        });
        setDuplicates(map);
      } catch {} finally { setChecking(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [preview, api]);

  const removeItem = (idx) => setPreview((prev) => prev.filter((_, i) => i !== idx));

  const skipAllDuplicates = () => {
    const next = {};
    Object.keys(duplicates).forEach((idx) => { next[idx] = false; });
    setKeepDuplicates(next);
  };

  const importAllDuplicates = () => {
    const next = {};
    Object.keys(duplicates).forEach((idx) => { next[idx] = true; });
    setKeepDuplicates(next);
  };

  const submit = async () => {
    // Filter items: skip duplicates that are NOT explicitly kept
    const finalItems = preview.filter((_, idx) => {
      if (!duplicates[idx]) return true;
      return keepDuplicates[idx] === true;
    });
    if (finalItems.length === 0) {
      toast.error("Tidak ada produk untuk diimpor");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post("/admin/products/bulk-import-v2", { items: finalItems });
      toast.success(`${res.data.created} produk berhasil ditambahkan`);
      setRaw("");
      onImported();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Import gagal");
    } finally { setBusy(false); }
  };

  const dupCount = Object.keys(duplicates).length;
  const importCount = preview.filter((_, idx) => !duplicates[idx] || keepDuplicates[idx]).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="bulk-import-dialog"
        className="bg-[#1a1d27] border-white/10 text-white max-w-3xl max-h-[90vh] flex flex-col"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Import Produk Massal</DialogTitle>
          <p className="text-xs text-white/55">
            Format flat: <code className="text-[#F5A623]">Nama Produk | 150000</code>. Prefix <code>➥ - • * &gt; # + 1.</code> auto-strip.
          </p>
          <p className="text-xs text-white/55 mt-1">
            Format variasi: <code className="text-[#F5A623]">Nama :: 7 Hari=15000 | 30 Hari=40000* | 90 Hari=50000**</code>
            <br />
            <span className="text-white/40">* = Paling Dipilih • ** = Best Value • harga_normal&gt;harga_diskon untuk diskon per variasi</span>
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 min-h-0 flex-1 overflow-hidden">
          <div className="flex flex-col min-h-0">
            <Label className="text-[11px] uppercase tracking-widest text-white/60 mb-1">
              Daftar Produk (nama | harga)
            </Label>
            <Textarea
              data-testid="bulk-input-textarea"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={"➥ Netflix Premium | 45000\n- Spotify Family | Rp 50.000\n• Canva Pro | 150rb\n[ChatGPT Plus] | 99K\nDisney+ Hotstar"}
              className="flex-1 min-h-[280px] bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623] font-mono text-xs resize-none"
            />
          </div>

          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[11px] uppercase tracking-widest text-white/60">
                Preview ({preview.length})
                {checking && <Loader2 className="animate-spin inline ml-1" size={11} />}
              </Label>
              {dupCount > 0 && (
                <div className="flex gap-1">
                  <button type="button" onClick={skipAllDuplicates}
                    className="text-[10px] px-2 py-0.5 rounded border border-white/15 text-white/60 hover:bg-white/5">
                    Skip Semua Duplikat
                  </button>
                  <button type="button" onClick={importAllDuplicates}
                    className="text-[10px] px-2 py-0.5 rounded border border-[#F5A623]/40 text-[#F5A623] hover:bg-[#F5A623]/10">
                    Import Semua Tetap
                  </button>
                </div>
              )}
            </div>
            <div
              data-testid="bulk-preview-list"
              className="flex-1 min-h-[280px] max-h-[380px] overflow-y-auto rounded-md border border-white/10 bg-[#0f1117] p-1"
            >
              {preview.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-8 px-3">
                  Belum ada produk. Ketik atau tempel daftar di sebelah kiri.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#0f1117]">
                    <tr className="text-white/50 text-[10px]">
                      <th className="text-left px-2 py-1">Nama</th>
                      <th className="text-right px-2 py-1">Harga</th>
                      <th className="w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((it, idx) => {
                      const dup = duplicates[idx];
                      const bgCls = dup?.status === "exact" ? "bg-red-500/10 border-red-500/30" :
                                    dup?.status === "similar" ? "bg-amber-500/10 border-amber-500/30" :
                                    "bg-[#1a1d27] border-white/5";
                      const hasVariants = Array.isArray(it.variants) && it.variants.length > 0;
                      return (
                        <React.Fragment key={idx}>
                        <tr className={`border-b ${bgCls}`}>
                          <td className="px-2 py-1.5">
                            {dup && (
                              <div className="flex items-center gap-1 mb-0.5">
                                <input
                                  type="checkbox"
                                  checked={!!keepDuplicates[idx]}
                                  onChange={(e) => setKeepDuplicates({ ...keepDuplicates, [idx]: e.target.checked })}
                                  className="accent-[#F5A623]"
                                />
                                <span className={`text-[9px] uppercase font-bold ${dup.status === "exact" ? "text-red-300" : "text-amber-300"}`}>
                                  {dup.status === "exact" ? `DUPLIKAT — sudah ada` : `MIRIP: ${dup.matched_name}`}
                                </span>
                              </div>
                            )}
                            <div className="text-white/85 truncate flex items-center gap-1">
                              {it.name}
                              {hasVariants && (
                                <span className="text-[9px] px-1 rounded bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/30" data-testid={`variant-count-${idx}`}>
                                  {it.variants.length} variasi
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="text-right px-2 py-1.5 text-white/70 whitespace-nowrap">
                            {it.price > 0 ? (hasVariants ? `mulai Rp ${it.price.toLocaleString("id-ID")}` : `Rp ${it.price.toLocaleString("id-ID")}`) : "-"}
                          </td>
                          <td className="px-1">
                            <button onClick={() => removeItem(idx)} className="p-1 text-white/40 hover:text-red-300">
                              <X size={11} />
                            </button>
                          </td>
                        </tr>
                        {hasVariants && (
                          <tr className="border-b border-white/5">
                            <td colSpan={3} className="px-2 pb-2 pt-0">
                              <div className="flex flex-wrap gap-1" data-testid={`variant-preview-${idx}`}>
                                {it.variants.map((v, vi) => (
                                  <span
                                    key={vi}
                                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                      v.is_recommended
                                        ? "bg-[#F5A623]/15 border-[#F5A623]/40 text-[#F5A623]"
                                        : v.is_best_value
                                        ? "bg-red-500/15 border-red-500/40 text-red-300"
                                        : "bg-white/5 border-white/15 text-white/70"
                                    }`}
                                  >
                                    {v.name}: Rp {(v.discount_price || v.price).toLocaleString("id-ID")}
                                    {v.discount_price && (
                                      <span className="line-through text-white/30 ml-1">
                                        Rp {v.price.toLocaleString("id-ID")}
                                      </span>
                                    )}
                                    {v.is_recommended && " ⭐"}
                                    {v.is_best_value && " 🔥"}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <p className="text-[10px] text-white/50 mt-1.5">
              Siap import <b className="text-[#F5A623]">{importCount}</b> produk baru, skip <b>{preview.length - importCount}</b> duplikat.
            </p>
          </div>
        </div>

        <DialogFooter className="mt-3 gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-transparent border-white/20 hover:bg-white/5 text-white"
          >
            Batal
          </Button>
          <Button
            data-testid="bulk-import-submit"
            onClick={submit}
            disabled={busy || preview.length === 0}
            className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
          >
            {busy ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <>
                <Plus size={14} className="mr-1" /> Import {preview.length} Produk
              </>
            )}
          </Button>
        </DialogFooter>
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

const MAX_UPLOAD_MB = 5;

function PhotoPicker({ value, onChange, api }) {
  // Determine initial mode: if value looks like a server upload path, default to upload tab.
  const initialMode = value && value.startsWith("/api/uploads/") ? "upload" : "url";
  const [mode, setMode] = useState(initialMode);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar (JPG/PNG/WEBP)");
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`Ukuran file maksimal ${MAX_UPLOAD_MB}MB (saat ini ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/admin/uploads", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange(res.data.url);
      toast.success("Foto diupload");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Upload gagal";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const preview = value ? resolveImageUrl(value) : "";

  return (
    <div data-testid="photo-picker" className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="photo-mode-url"
          onClick={() => setMode("url")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs border transition-colors ${
            mode === "url"
              ? "bg-[#F5A623]/15 text-[#F5A623] border-[#F5A623]/40"
              : "bg-[#0f1117] text-white/60 border-white/10 hover:text-white"
          }`}
        >
          <Link2 size={13} /> URL Foto
        </button>
        <button
          type="button"
          data-testid="photo-mode-upload"
          onClick={() => setMode("upload")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs border transition-colors ${
            mode === "upload"
              ? "bg-[#F5A623]/15 text-[#F5A623] border-[#F5A623]/40"
              : "bg-[#0f1117] text-white/60 border-white/10 hover:text-white"
          }`}
        >
          <Upload size={13} /> Upload dari Device
        </button>
      </div>

      {mode === "url" ? (
        <>
          <Input
            data-testid="pf-photo"
            value={value || ""}
            onChange={(e) => { setPreviewError(false); onChange(e.target.value); }}
            placeholder="https://…"
            className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
          />
          <p className="text-[10px] text-white/45 leading-relaxed">
            💡 Tip: pakai link <b>direct image</b> (URL berakhiran <code>.jpg</code>/<code>.png</code>/<code>.webp</code>).
            Google Drive share-link akan otomatis dinormalisasi. Untuk imgbb, pilih menu <b>&quot;Direct link&quot;</b>.
          </p>
        </>
      ) : (
        <div>
          <input
            ref={inputRef}
            data-testid="pf-photo-file"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            data-testid="pf-photo-upload-btn"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 px-3 py-4 rounded-md border border-dashed border-white/20 hover:border-[#F5A623]/40 bg-[#0f1117] text-sm text-white/70 hover:text-white transition-colors disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="animate-spin" size={15} /> Mengupload…
              </>
            ) : (
              <>
                <Upload size={15} /> Pilih foto (maks {MAX_UPLOAD_MB}MB)
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <p data-testid="pf-photo-error" className="text-xs text-red-400">
          {error}
        </p>
      )}

      {preview && (
        <div
          data-testid="pf-photo-preview"
          className={`flex items-center gap-3 p-2 rounded-md bg-[#0f1117] border ${previewError ? "border-red-500/40" : "border-white/10"}`}
        >
          {previewError ? (
            <div className="w-16 h-16 rounded-md border border-red-500/40 bg-red-500/5 flex items-center justify-center text-red-400">
              <X size={20} />
            </div>
          ) : (
            <img
              src={preview}
              alt="Preview"
              className="w-16 h-16 rounded-md object-cover border border-white/10"
              onError={() => setPreviewError(true)}
              onLoad={() => setPreviewError(false)}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-widest text-white/40 mb-0.5">
              {previewError ? "❌ Gagal Memuat" : "✓ Preview"}
            </p>
            <p className={`text-xs truncate font-mono ${previewError ? "text-red-300" : "text-white/70"}`} title={value}>
              {value.startsWith("/api/uploads/") ? "📦 Tersimpan di server" : value}
            </p>
            {previewError && (
              <p className="text-[10px] text-red-300/80 mt-0.5 leading-tight">
                URL tidak bisa dimuat sebagai gambar. Pastikan link direct image (bukan halaman).
              </p>
            )}
          </div>
          <button
            type="button"
            data-testid="pf-photo-clear"
            onClick={() => { onChange(""); setPreviewError(false); }}
            className="p-1 rounded hover:bg-white/5 text-white/50 hover:text-white"
            title="Hapus"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

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
    show_coming_soon: true,
    trust_rating: "5.0",
    trust_transactions: "5000+",
    trust_since_year: "2021",
    trust_process_time: "1x24 Jam",
    footer_start_year: "2021",
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

        <h3 className="font-display text-lg pt-2">Coming Soon di Storefront</h3>
        <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#0f1117] border border-white/10">
          <div>
            <Label className="text-sm">Tampilkan produk Coming Soon di storefront</Label>
            <p className="text-[11px] text-white/50 mt-0.5">Jika OFF, hanya produk PUBLISHED yang tampil di katalog.</p>
          </div>
          <Switch
            data-testid="settings-show-coming-soon"
            checked={stats.show_coming_soon}
            onCheckedChange={(v) => setStats({ ...stats, show_coming_soon: v })}
            className="data-[state=checked]:bg-[#F5A623]"
          />
        </div>

        <h3 className="font-display text-lg pt-2">Trust Badges & Footer</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rating (contoh: 5.0)">
            <Input data-testid="settings-trust-rating" value={stats.trust_rating || ""} onChange={(e) => setStats({ ...stats, trust_rating: e.target.value })}
              className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
          </Field>
          <Field label="Jumlah Transaksi (contoh: 5000+)">
            <Input data-testid="settings-trust-transactions" value={stats.trust_transactions || ""} onChange={(e) => setStats({ ...stats, trust_transactions: e.target.value })}
              className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
          </Field>
          <Field label="Tahun Berdiri (contoh: 2021)">
            <Input data-testid="settings-trust-since" value={stats.trust_since_year || ""} onChange={(e) => setStats({ ...stats, trust_since_year: e.target.value })}
              className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
          </Field>
          <Field label="Waktu Proses (contoh: 1x24 Jam)">
            <Input data-testid="settings-trust-process" value={stats.trust_process_time || ""} onChange={(e) => setStats({ ...stats, trust_process_time: e.target.value })}
              className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
          </Field>
          <Field label="Tahun Footer (contoh: 2021)">
            <Input data-testid="settings-footer-start" value={stats.footer_start_year || ""} onChange={(e) => setStats({ ...stats, footer_start_year: e.target.value })}
              className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
          </Field>
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
          value={formatIDR(data.total_commission_earned)}
        />
        <SmallStat
          label="Total Komisi Terbayar"
          value={formatIDR(data.total_commission_paid)}
        />
      </div>

      {/* 7-day trend chart */}
      <TrendChart data={data.trend_7d || []} />

      {/* Visitor Statistics */}
      <VisitorStatsPanel api={api} />

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
                <div className="text-white/50">{formatIDR(p.revenue)}</div>
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
              {formatIDR(revenue)}
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
                if (name === "revenue") return [formatIDR(value), "Omzet"];
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

// ---------- Visitor Stats (Dashboard section) ----------
function VisitorStatsPanel({ api }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get("/admin/visitor-stats").then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [api]);

  if (loading) return null;
  if (!data) return null;

  const maxCount = Math.max(1, ...data.chart_7d.map((r) => r.count));

  return (
    <div className="space-y-4" data-testid="visitor-stats-panel">
      <div>
        <h3 className="text-sm font-semibold text-white/90">📊 Statistik Pengunjung</h3>
        <p className="text-xs text-white/50">Tracking internal (bot difilter). GA4/Pixel tetap jalan untuk data eksternal.</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-[#1a1d27] border border-white/10 p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/50">Hari Ini</p>
          <p className="text-2xl font-display gold-text mt-1" data-testid="visitor-today">{data.today.toLocaleString("id-ID")}</p>
        </div>
        <div className="rounded-xl bg-[#1a1d27] border border-white/10 p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/50">7 Hari</p>
          <p className="text-2xl font-display text-white mt-1" data-testid="visitor-week">{data.week.toLocaleString("id-ID")}</p>
        </div>
        <div className="rounded-xl bg-[#1a1d27] border border-white/10 p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/50">30 Hari</p>
          <p className="text-2xl font-display text-white mt-1" data-testid="visitor-month">{data.month.toLocaleString("id-ID")}</p>
        </div>
      </div>

      <div className="rounded-xl bg-[#1a1d27] border border-white/10 p-4">
        <p className="text-[10px] uppercase tracking-wider text-white/50 mb-3">Grafik 7 Hari Terakhir</p>
        <div className="flex items-end gap-2 h-32" data-testid="visitor-chart-7d">
          {data.chart_7d.map((row) => {
            const h = (row.count / maxCount) * 100;
            return (
              <div key={row.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center h-full">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-[#F5A623]/60 to-[#F5A623] transition-all duration-500"
                    style={{ height: `${Math.max(h, 4)}%` }}
                    title={`${row.count} view`}
                  />
                </div>
                <div className="text-[9px] text-white/50 font-mono">{row.date.slice(5)}</div>
                <div className="text-[10px] text-white/80 font-semibold">{row.count}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#1a1d27] border border-white/10 p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Halaman Paling Banyak Dikunjungi</p>
          <ul className="space-y-1" data-testid="top-pages-list">
            {data.top_pages.slice(0, 5).map((p, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className="text-white/80 font-mono truncate max-w-[70%]">{p.path}</span>
                <span className="gold-text font-semibold">{p.count}</span>
              </li>
            ))}
            {data.top_pages.length === 0 && <li className="text-white/40 text-xs">Belum ada data</li>}
          </ul>
        </div>
        <div className="rounded-xl bg-[#1a1d27] border border-white/10 p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Produk Paling Banyak Dilihat</p>
          <ul className="space-y-1" data-testid="top-products-list">
            {data.top_products.slice(0, 5).map((p, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className="text-white/80 truncate max-w-[70%]">{p.name}</span>
                <span className="gold-text font-semibold">{p.views}</span>
              </li>
            ))}
            {data.top_products.length === 0 && <li className="text-white/40 text-xs">Belum ada data</li>}
          </ul>
        </div>
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
        <div>
          <h3 className="font-display text-lg">History Pembeli ({filtered.length})</h3>
          <p className="text-xs text-white/50 mt-0.5">Riwayat lengkap tiap pembeli, klik baris untuk detail timeline order.</p>
        </div>
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
            <Download size={14} className="mr-2" /> Export Semua
          </Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <Input
          data-testid="customers-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama atau nomor WA/Telegram…"
          className="pl-9 bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
        />
      </div>

      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-white/60">Nama</TableHead>
            <TableHead className="text-white/60">WA / TG</TableHead>
            <TableHead className="text-white/60">Status</TableHead>
            <TableHead className="text-white/60"># Order</TableHead>
            <TableHead className="text-white/60">Total Belanja</TableHead>
            <TableHead className="text-white/60">Produk Favorit</TableHead>
            <TableHead className="text-white/60">Sejak</TableHead>
            <TableHead className="text-white/60">Terakhir</TableHead>
            <TableHead className="text-white/60 text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow><TableCell colSpan={9} className="text-center text-white/40 py-6">Memuat…</TableCell></TableRow>
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
              <TableCell><TierBadge tier={c.tier} /></TableCell>
              <TableCell className="text-sm">{c.total_orders}</TableCell>
              <TableCell className="gold-text font-semibold">{formatIDR(c.total_spent)}</TableCell>
              <TableCell className="text-xs text-white/70 max-w-[180px] truncate" title={c.favorite_product}>{c.favorite_product}</TableCell>
              <TableCell className="text-xs text-white/50">
                {c.first_order_at ? new Date(c.first_order_at).toLocaleDateString("id-ID") : "-"}
              </TableCell>
              <TableCell className="text-xs text-white/60">
                {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("id-ID") : "-"}
              </TableCell>
              <TableCell className="text-right">
                <button className="text-xs text-[#F5A623] hover:underline" data-testid={`view-customer-${c.whatsapp}`}>
                  Timeline →
                </button>
              </TableCell>
            </TableRow>
          ))}
          {!loading && filtered.length === 0 && (
            <TableRow><TableCell colSpan={9} className="text-center text-white/40 py-6">Belum ada pelanggan</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
      </div>

      {detail && (
        <CustomerDetailDialog
          open={!!detail}
          onOpenChange={(v) => !v && setDetail(null)}
          data={detail}
          password={password}
        />
      )}
    </div>
  );
}

function TierBadge({ tier }) {
  const map = {
    baru: { label: "Baru", cls: "bg-white/10 text-white/70 border-white/20" },
    reguler: { label: "Reguler", cls: "bg-[#0088cc]/15 text-[#3aa3ff] border-[#0088cc]/40" },
    setia: { label: "Setia 💛", cls: "bg-[#F5A623]/15 text-[#F5A623] border-[#F5A623]/40" },
  };
  const t = map[tier] || map.baru;
  return (
    <span
      data-testid={`tier-badge-${tier}`}
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider border ${t.cls}`}
    >
      {t.label}
    </span>
  );
}

function CustomerDetailDialog({ open, onOpenChange, data, password }) {
  const { customer, orders } = data;
  const exportCustomer = async () => {
    try {
      // Reuse the orders export with WA filter via clientside for now
      const blob = new Blob(
        [
          "order_code,product_name,price,status,payment_method,created_at\n" +
            orders
              .map(
                (o) =>
                  `${o.order_code},"${(o.product_name || "").replace(/"/g, '""')}",${o.product_price || 0},${o.status},${o.payment_method || ""},${o.created_at || ""}`
              )
              .join("\n"),
        ],
        { type: "text/csv" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `history-${customer.whatsapp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("History pembeli diunduh");
    } catch {
      toast.error("Gagal mengunduh");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1d27] border-white/10 text-white max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="customer-detail-dialog">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div>
              <DialogTitle className="font-display text-xl">{customer.name}</DialogTitle>
              <p className="text-xs font-mono text-[#F5A623]">{customer.whatsapp}</p>
            </div>
            <TierBadge tier={customer.tier} />
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3">
          <div className="rounded-lg bg-[#0f1117] p-2.5 border border-white/5">
            <p className="text-[10px] uppercase tracking-wide text-white/50">Total Order</p>
            <p className="text-lg font-semibold" data-testid="cd-total-orders">{customer.total_orders}</p>
          </div>
          <div className="rounded-lg bg-[#0f1117] p-2.5 border border-white/5">
            <p className="text-[10px] uppercase tracking-wide text-white/50">Total Belanja</p>
            <p className="text-base font-semibold gold-text" data-testid="cd-total-spent">{formatIDR(customer.total_spent)}</p>
          </div>
          <div className="rounded-lg bg-[#0f1117] p-2.5 border border-white/5">
            <p className="text-[10px] uppercase tracking-wide text-white/50">Pelanggan Sejak</p>
            <p className="text-xs mt-1" data-testid="cd-first-order">
              {customer.first_order_at ? new Date(customer.first_order_at).toLocaleDateString("id-ID") : "-"}
            </p>
          </div>
          <div className="rounded-lg bg-[#0f1117] p-2.5 border border-white/5">
            <p className="text-[10px] uppercase tracking-wide text-white/50">Order Terakhir</p>
            <p className="text-xs mt-1">
              {customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString("id-ID") : "-"}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-widest text-white/50">Timeline Order</p>
          <button
            onClick={exportCustomer}
            data-testid="export-single-customer-btn"
            className="text-xs text-[#F5A623] hover:underline inline-flex items-center gap-1"
          >
            <Download size={11} /> Export CSV
          </button>
        </div>

        {/* Timeline */}
        <div className="space-y-2 relative pl-4 border-l border-white/10">
          {orders.map((o) => (
            <div key={o.id} data-testid={`timeline-order-${o.order_code}`} className="relative">
              <span
                className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-[#1a1d27] ${
                  o.status === "confirmed"
                    ? "bg-green-500"
                    : o.status === "cancelled" || o.status === "expired"
                    ? "bg-red-500"
                    : "bg-[#F5A623]"
                }`}
              />
              <div className="rounded-lg bg-[#0f1117] border border-white/5 p-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{o.product_name}</p>
                    <p className="text-[10px] font-mono text-white/40 mt-0.5">{o.order_code}</p>
                  </div>
                  <Badge status={o.status} />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="gold-text font-semibold">{formatIDR(o.product_price)}</span>
                  <span className="text-white/45 uppercase text-[10px]">{o.payment_method}</span>
                  <span className="text-white/55">
                    {o.created_at
                      ? new Date(o.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
                      : "-"}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <p className="text-center text-white/40 text-sm py-4">Belum ada order</p>
          )}
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


// ============================================================================
// CATEGORIES TAB
// ============================================================================
function CategoriesTab({ api }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = () => api.get("/categories").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const remove = async (c) => {
    if (c.slug === "lainnya") {
      toast.error("Kategori 'Lainnya' tidak bisa dihapus (fallback)");
      return;
    }
    if (!confirm(`Hapus kategori "${c.name}"? Produk yang pakai kategori ini akan dipindah ke "Lainnya".`)) return;
    try {
      await api.delete(`/admin/categories/${c.id}`);
      toast.success("Kategori dihapus");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal hapus");
    }
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-lg">Kelola Kategori ({items.length})</h3>
          <p className="text-xs text-white/50 mt-1">Kategori dipakai di form produk & filter storefront.</p>
        </div>
        <Button
          data-testid="add-category-btn"
          onClick={() => { setEditing(null); setOpen(true); }}
          className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
        >
          <Plus size={15} className="mr-1" /> Tambah Kategori
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-white/60">Urutan</TableHead>
            <TableHead className="text-white/60">Nama</TableHead>
            <TableHead className="text-white/60">Slug</TableHead>
            <TableHead className="text-white/60">Icon</TableHead>
            <TableHead className="text-white/60 text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c) => (
            <TableRow key={c.id} className="border-white/5" data-testid={`cat-row-${c.slug}`}>
              <TableCell className="text-white/60 w-16">{c.order}</TableCell>
              <TableCell className="text-sm">{c.name}</TableCell>
              <TableCell className="text-xs text-white/60 font-mono">{c.slug}</TableCell>
              <TableCell className="text-xs text-white/60 font-mono">{c.icon}</TableCell>
              <TableCell className="text-right">
                <button
                  onClick={() => { setEditing(c); setOpen(true); }}
                  className="p-2 rounded-md text-white/70 hover:bg-white/5 hover:text-[#F5A623]"
                >
                  <Edit size={15} />
                </button>
                <button
                  onClick={() => remove(c)}
                  className="p-2 rounded-md text-white/70 hover:bg-white/5 hover:text-red-400"
                >
                  <Trash2 size={15} />
                </button>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-white/40 py-6">Belum ada kategori</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      {open && (
        <CategoryFormDialog
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

function CategoryFormDialog({ open, onOpenChange, editing, api, onSaved }) {
  const [form, setForm] = useState(() => editing || {
    slug: "",
    name: "",
    icon: "grid",
    order: 100,
  });
  const [saving, setSaving] = useState(false);

  const ICON_OPTIONS = [
    { v: "sparkles", label: "✨ Sparkles (AI)" },
    { v: "video", label: "🎬 Video" },
    { v: "shield", label: "🛡️ Shield (VPN)" },
    { v: "zap", label: "⚡ Zap (Produktivitas)" },
    { v: "play", label: "▶️ Play (Hiburan)" },
    { v: "mail", label: "📧 Mail" },
    { v: "grid", label: "🔳 Grid (Lainnya)" },
  ];

  const save = async (e) => {
    e.preventDefault();
    if (!form.name || !form.slug) return toast.error("Nama & slug wajib");
    setSaving(true);
    const payload = {
      slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      name: form.name,
      icon: form.icon,
      order: parseInt(form.order || 100, 10),
    };
    try {
      if (editing) await api.put(`/admin/categories/${editing.id}`, payload);
      else await api.post("/admin/categories", payload);
      toast.success(editing ? "Kategori diupdate" : "Kategori ditambahkan");
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menyimpan");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1d27] border-white/10 text-white sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-display">{editing ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Field label="Nama Kategori">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
          </Field>
          <Field label="Slug (URL-friendly)">
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="contoh: ai-tools"
              className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Icon">
              <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                <SelectTrigger className="bg-[#0f1117] border-white/15"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1d27] border-white/10 text-white">
                  {ICON_OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Urutan">
              <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })}
                className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving} className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold">
              {saving ? <Loader2 className="animate-spin" size={15} /> : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// WAITLIST TAB
// ============================================================================
function WaitlistTab({ api, password }) {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [productFilter, setProductFilter] = useState("all");
  const [integrationStatus, setIntegrationStatus] = useState(null);

  const load = () => {
    const url = productFilter === "all" ? "/admin/waitlist" : `/admin/waitlist?product_id=${productFilter}`;
    api.get(url).then((r) => setItems(r.data));
  };
  useEffect(() => { load(); }, [productFilter]);
  useEffect(() => {
    api.get("/products").then((r) => setProducts(r.data));
    api.get("/admin/integration-status").then((r) => setIntegrationStatus(r.data)).catch(() => {});
  }, []);

  const remove = async (id) => {
    if (!confirm("Hapus entri waitlist ini?")) return;
    await api.delete(`/admin/waitlist/${id}`);
    toast.success("Entri dihapus");
    load();
  };

  const exportFile = async (fmt) => {
    try {
      const params = { fmt };
      if (productFilter !== "all") params.product_id = productFilter;
      await downloadAdminFile(password, "/admin/waitlist/export", params);
      toast.success("Waitlist diunduh");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal export");
    }
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="font-display text-lg flex items-center gap-2">
            <Bell size={18} className="text-[#F5A623]" /> Waitlist ({items.length})
          </h3>
          <p className="text-xs text-white/50 mt-1">Pembeli yang menunggu produk Coming Soon di-publish.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => exportFile("xlsx")}
            className="bg-transparent border-white/15 hover:bg-white/5 text-white">
            <Download size={14} className="mr-1.5" /> XLSX
          </Button>
          <Button variant="outline" onClick={() => exportFile("csv")}
            className="bg-transparent border-white/15 hover:bg-white/5 text-white">
            <Download size={14} className="mr-1.5" /> CSV
          </Button>
        </div>
      </div>

      {/* Integration status banner */}
      {integrationStatus && (
        <div className="mb-4 p-3 rounded-lg bg-white/[0.03] border border-white/10 text-xs space-y-1">
          <div className={integrationStatus.telegram_public ? "text-green-300" : "text-amber-300/80"}>
            {integrationStatus.telegram_public
              ? `✅ Bot Telegram publik aktif — @${integrationStatus.telegram_public_username}`
              : "⚠️ Bot Telegram publik belum dikonfigurasi. Isi TELEGRAM_PUBLIC_BOT_TOKEN untuk aktifkan notif Telegram waitlist."}
          </div>
          <div className={integrationStatus.resend_email ? "text-green-300" : "text-amber-300/80"}>
            {integrationStatus.resend_email
              ? `✅ Email Resend aktif — from: ${integrationStatus.resend_from}`
              : "⚠️ Email notifikasi belum dikonfigurasi. Isi RESEND_API_KEY untuk aktifkan fitur ini."}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-white/60">Filter Produk:</span>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="bg-[#0f1117] border-white/15 h-9 w-64"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#1a1d27] border-white/10 text-white max-h-72">
            <SelectItem value="all">Semua Produk</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-white/60">Tanggal</TableHead>
            <TableHead className="text-white/60">Produk</TableHead>
            <TableHead className="text-white/60">Nama</TableHead>
            <TableHead className="text-white/60">WA/Telegram</TableHead>
            <TableHead className="text-white/60">Email</TableHead>
            <TableHead className="text-white/60">Status</TableHead>
            <TableHead className="text-white/60 text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((w) => (
            <TableRow key={w.id} className="border-white/5" data-testid={`waitlist-row-${w.id}`}>
              <TableCell className="text-xs text-white/60">
                {w.created_at ? new Date(w.created_at).toLocaleString("id-ID") : "-"}
              </TableCell>
              <TableCell className="text-sm">{w.produk_nama}</TableCell>
              <TableCell className="text-sm">{w.nama || "-"}</TableCell>
              <TableCell className="text-xs text-white/70 font-mono">
                {w.whatsapp_telegram || "-"}
                {w.telegram_chat_id && <div className="text-green-400 text-[10px]">✓ TG connected</div>}
              </TableCell>
              <TableCell className="text-xs text-white/70">{w.email || "-"}</TableCell>
              <TableCell>
                {w.notified ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-green-500/15 text-green-300 border border-green-500/30">
                    ✓ Terkirim
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Pending
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <button
                  onClick={() => remove(w.id)}
                  className="p-2 rounded-md text-white/70 hover:bg-white/5 hover:text-red-400"
                >
                  <Trash2 size={15} />
                </button>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-center text-white/40 py-6">Belum ada waitlist</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================================================
// GENERATE INFO PRODUK DIALOG
// ============================================================================
function GenerateInfoDialog({ open, onOpenChange, api }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("singkat");

  const generate = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await api.post("/admin/generate-info");
      setResult(r.data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Gagal generate");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (open && !result) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Disalin ke clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1d27] border-white/10 text-white sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles size={18} className="text-[#F5A623]" /> Generate Info Produk
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="py-10 text-center">
            <Loader2 className="animate-spin mx-auto text-[#F5A623] mb-3" size={32} />
            <p className="text-sm text-white/60">Sedang menghasilkan info produk...</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
            {error}
            <div className="mt-3">
              <Button onClick={generate} size="sm" className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117]">
                <RefreshCw size={13} className="mr-1" /> Coba Lagi
              </Button>
            </div>
          </div>
        )}

        {result && !loading && (
          <>
            <div className="text-xs text-white/50 mb-2">
              {result.total_produk} produk PUBLISHED di-generate
            </div>

            <div className="flex border border-white/10 rounded-lg overflow-hidden mb-3">
              <button
                data-testid="tab-singkat"
                onClick={() => setActiveTab("singkat")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  activeTab === "singkat"
                    ? "bg-[#F5A623]/15 text-[#F5A623]"
                    : "bg-transparent text-white/60 hover:bg-white/5"
                }`}
              >
                Versi Singkat
              </button>
              <button
                data-testid="tab-lengkap"
                onClick={() => setActiveTab("lengkap")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  activeTab === "lengkap"
                    ? "bg-[#F5A623]/15 text-[#F5A623]"
                    : "bg-transparent text-white/60 hover:bg-white/5"
                }`}
              >
                Versi Lengkap
              </button>
            </div>

            <div className="bg-[#0f1117] border border-white/10 rounded-lg p-4 whitespace-pre-wrap text-sm text-white/90 max-h-80 overflow-y-auto font-mono leading-relaxed">
              {activeTab === "singkat" ? result.versi_singkat : result.versi_lengkap}
            </div>

            <div className="flex gap-2 mt-3">
              <Button
                onClick={() => copyText(activeTab === "singkat" ? result.versi_singkat : result.versi_lengkap)}
                className="flex-1 bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
              >
                <Copy size={14} className="mr-1.5" /> Copy
              </Button>
              <Button
                onClick={generate}
                variant="outline"
                className="bg-transparent border-white/20 hover:bg-white/5 text-white"
              >
                <RefreshCw size={14} className="mr-1.5" /> Generate Ulang
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// REVIEWS TAB
// ============================================================================
function ReviewsTab({ api }) {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [productFilter, setProductFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [visibleFilter, setVisibleFilter] = useState("all");
  const [editing, setEditing] = useState(null);

  const load = () => {
    const params = [];
    if (productFilter !== "all") params.push(`product_id=${productFilter}`);
    if (ratingFilter !== "all") params.push(`rating=${ratingFilter}`);
    if (visibleFilter !== "all") params.push(`visible=${visibleFilter}`);
    const qs = params.length ? `?${params.join("&")}` : "";
    api.get(`/admin/reviews${qs}`).then((r) => setItems(r.data));
  };
  useEffect(() => { load(); }, [productFilter, ratingFilter, visibleFilter]);
  useEffect(() => { api.get("/products").then((r) => setProducts(r.data)); }, []);

  const toggleVisible = async (r) => {
    await api.patch(`/admin/reviews/${r.id}`, { visible: !r.visible });
    toast.success(r.visible ? "Ulasan disembunyikan" : "Ulasan ditampilkan");
    load();
  };

  const remove = async (id) => {
    if (!confirm("Hapus ulasan permanen?")) return;
    await api.delete(`/admin/reviews/${id}`);
    toast.success("Ulasan dihapus");
    load();
  };

  const renderStars = (n) => "⭐".repeat(Math.max(0, Math.min(5, n)));

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="font-display text-lg flex items-center gap-2">
            <Star size={18} className="text-[#F5A623]" /> Ulasan Pembeli ({items.length})
          </h3>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="bg-[#0f1117] border-white/15 h-9"><SelectValue placeholder="Filter Produk" /></SelectTrigger>
          <SelectContent className="bg-[#1a1d27] border-white/10 text-white max-h-72">
            <SelectItem value="all">Semua Produk</SelectItem>
            {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="bg-[#0f1117] border-white/15 h-9"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#1a1d27] border-white/10 text-white">
            <SelectItem value="all">Semua Rating</SelectItem>
            <SelectItem value="5">⭐⭐⭐⭐⭐ (5)</SelectItem>
            <SelectItem value="4">⭐⭐⭐⭐ (4)</SelectItem>
            <SelectItem value="3">⭐⭐⭐ (3)</SelectItem>
            <SelectItem value="2">⭐⭐ (2)</SelectItem>
            <SelectItem value="1">⭐ (1)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={visibleFilter} onValueChange={setVisibleFilter}>
          <SelectTrigger className="bg-[#0f1117] border-white/15 h-9"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-[#1a1d27] border-white/10 text-white">
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="true">Tampil</SelectItem>
            <SelectItem value="false">Disembunyikan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-white/60">Tanggal</TableHead>
            <TableHead className="text-white/60">Pembeli</TableHead>
            <TableHead className="text-white/60">Produk</TableHead>
            <TableHead className="text-white/60">Rating</TableHead>
            <TableHead className="text-white/60">Komentar</TableHead>
            <TableHead className="text-white/60">Status</TableHead>
            <TableHead className="text-white/60 text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((r) => (
            <TableRow key={r.id} className="border-white/5" data-testid={`review-row-${r.id}`}>
              <TableCell className="text-xs text-white/60">{new Date(r.created_at).toLocaleDateString("id-ID")}</TableCell>
              <TableCell className="text-sm">{r.buyer_name}</TableCell>
              <TableCell className="text-xs">{r.product_name}</TableCell>
              <TableCell className="text-sm">{renderStars(r.rating)}</TableCell>
              <TableCell className="text-xs text-white/70 max-w-xs truncate">{r.comment || "-"}</TableCell>
              <TableCell>
                <button
                  onClick={() => toggleVisible(r)}
                  className={`px-2 py-0.5 rounded-full text-[10px] border ${
                    r.visible
                      ? "bg-green-500/15 text-green-300 border-green-500/30"
                      : "bg-white/5 text-white/50 border-white/15"
                  }`}
                >
                  {r.visible ? "Tampil" : "Disembunyikan"}
                </button>
              </TableCell>
              <TableCell className="text-right">
                <button onClick={() => setEditing(r)} className="p-2 rounded-md text-white/70 hover:bg-white/5 hover:text-[#F5A623]">
                  <Edit size={15} />
                </button>
                <button onClick={() => remove(r.id)} className="p-2 rounded-md text-white/70 hover:bg-white/5 hover:text-red-400">
                  <Trash2 size={15} />
                </button>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-center text-white/40 py-6">Belum ada ulasan</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      {editing && (
        <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent className="bg-[#1a1d27] border-white/10 text-white sm:max-w-[500px]">
            <DialogHeader><DialogTitle className="font-display">Edit Ulasan</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Field label="Rating">
                <Select value={String(editing.rating)} onValueChange={(v) => setEditing({ ...editing, rating: parseInt(v, 10) })}>
                  <SelectTrigger className="bg-[#0f1117] border-white/15"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1a1d27] border-white/10 text-white">
                    {[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{renderStars(n)} ({n})</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Komentar">
                <Textarea rows={4} value={editing.comment || ""} onChange={(e) => setEditing({ ...editing, comment: e.target.value })}
                  className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
              </Field>
              <Button
                onClick={async () => {
                  await api.patch(`/admin/reviews/${editing.id}`, { rating: editing.rating, comment: editing.comment });
                  toast.success("Ulasan diupdate");
                  setEditing(null); load();
                }}
                className="w-full bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
              >Simpan</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ============================================================================
// FAQ TAB
// ============================================================================
function FAQTab({ api }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = () => api.get("/admin/faqs").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!confirm("Hapus FAQ ini?")) return;
    await api.delete(`/admin/faqs/${id}`);
    toast.success("FAQ dihapus");
    load();
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg flex items-center gap-2">
          <HelpCircle size={18} className="text-[#F5A623]" /> FAQ ({items.length})
        </h3>
        <Button data-testid="add-faq-btn" onClick={() => { setEditing(null); setOpen(true); }}
          className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold">
          <Plus size={15} className="mr-1" /> Tambah FAQ
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((f) => (
          <div key={f.id} data-testid={`faq-admin-${f.id}`} className="bg-[#0f1117] border border-white/10 rounded-lg p-4 flex justify-between items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50">#{f.order}</span>
                {!f.visible && <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40">Hidden</span>}
              </div>
              <div className="font-medium text-sm">{f.question}</div>
              <div className="text-xs text-white/60 mt-1 line-clamp-2">{f.answer}</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setEditing(f); setOpen(true); }} className="p-2 rounded-md hover:bg-white/5 text-white/70 hover:text-[#F5A623]">
                <Edit size={15} />
              </button>
              <button onClick={() => remove(f.id)} className="p-2 rounded-md hover:bg-white/5 text-white/70 hover:text-red-400">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-center text-white/40 py-6">Belum ada FAQ</div>}
      </div>

      {open && (
        <FAQFormDialog
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

function FAQFormDialog({ open, onOpenChange, editing, api, onSaved }) {
  const [form, setForm] = useState(() => editing || { question: "", answer: "", order: 100, visible: true });
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!form.question || !form.answer) return toast.error("Pertanyaan & jawaban wajib");
    setSaving(true);
    const payload = { question: form.question, answer: form.answer, order: parseInt(form.order || 100, 10), visible: form.visible };
    try {
      if (editing) await api.put(`/admin/faqs/${editing.id}`, payload);
      else await api.post("/admin/faqs", payload);
      toast.success(editing ? "FAQ diupdate" : "FAQ ditambahkan");
      onSaved();
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal simpan"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1d27] border-white/10 text-white sm:max-w-[540px]">
        <DialogHeader><DialogTitle className="font-display">{editing ? "Edit FAQ" : "Tambah FAQ"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Field label="Pertanyaan">
            <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })}
              className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
          </Field>
          <Field label="Jawaban">
            <Textarea rows={5} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })}
              className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Urutan">
              <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })}
                className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
            </Field>
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#0f1117] border border-white/10">
              <Label className="text-sm">Tampilkan</Label>
              <Switch checked={form.visible} onCheckedChange={(v) => setForm({ ...form, visible: v })}
                className="data-[state=checked]:bg-[#F5A623]" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving} className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold">
              {saving ? <Loader2 className="animate-spin" size={15} /> : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// ABOUT US TAB
// ============================================================================
function AboutTab({ api }) {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [paragraphsText, setParagraphsText] = useState("");

  useEffect(() => {
    api.get("/about").then((r) => {
      setData(r.data);
      setParagraphsText((r.data.paragraphs || []).join("\n\n---\n\n"));
    });
  }, []);

  if (!data) return <div className="text-center py-8 text-white/40">Loading...</div>;

  const save = async () => {
    setSaving(true);
    const paragraphs = paragraphsText.split(/\n\n---\n\n/).map((s) => s.trim()).filter(Boolean);
    try {
      await api.put("/admin/about", {
        tagline: data.tagline,
        paragraphs,
        features: data.features,
      });
      toast.success("Halaman Tentang Kami diupdate");
    } catch (e) { toast.error("Gagal simpan"); }
    finally { setSaving(false); }
  };

  const updateFeature = (i, key, val) => {
    const next = [...(data.features || [])];
    next[i] = { ...next[i], [key]: val };
    setData({ ...data, features: next });
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Info size={18} className="text-[#F5A623]" /> Tentang Kami
        </h3>
      </div>

      <div className="space-y-4">
        <Field label="Tagline">
          <Input value={data.tagline || ""} onChange={(e) => setData({ ...data, tagline: e.target.value })}
            className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
        </Field>

        <Field label="Deskripsi (pisahkan paragraf dengan '---' di baris baru)">
          <Textarea rows={10} value={paragraphsText} onChange={(e) => setParagraphsText(e.target.value)}
            className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623] font-mono text-sm" />
        </Field>

        <div>
          <h4 className="font-display text-sm mb-2">Keunggulan (4 item)</h4>
          <div className="grid gap-2">
            {(data.features || []).map((f, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 bg-[#0f1117] p-2 rounded-lg border border-white/10">
                <Input value={f.icon || ""} onChange={(e) => updateFeature(i, "icon", e.target.value)} placeholder="icon key (zap/shield/tag/message-circle)"
                  className="bg-[#1a1d27] border-white/15 text-xs" />
                <Input value={f.title || ""} onChange={(e) => updateFeature(i, "title", e.target.value)} placeholder="Judul"
                  className="bg-[#1a1d27] border-white/15 text-xs" />
                <Input value={f.desc || ""} onChange={(e) => updateFeature(i, "desc", e.target.value)} placeholder="Deskripsi"
                  className="bg-[#1a1d27] border-white/15 text-xs" />
              </div>
            ))}
          </div>
        </div>

        <Button onClick={save} disabled={saving}
          className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold">
          {saving ? <Loader2 className="animate-spin" size={15} /> : "Simpan Perubahan"}
        </Button>
      </div>
    </div>
  );
}


// ============================================================================
// COUPONS TAB
// ============================================================================
function CouponsTab({ api }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = () => api.get("/admin/coupons").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!confirm("Hapus voucher ini?")) return;
    await api.delete(`/admin/coupons/${id}`);
    toast.success("Voucher dihapus");
    load();
  };

  const toggleActive = async (c) => {
    await api.put(`/admin/coupons/${c.id}`, { ...c, active: !c.active });
    load();
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Tag size={18} className="text-[#F5A623]" /> Kupon & Voucher ({items.length})
        </h3>
        <Button data-testid="add-coupon-btn" onClick={() => { setEditing(null); setOpen(true); }}
          className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold">
          <Plus size={15} className="mr-1" /> Tambah Voucher
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-white/60">Kode</TableHead>
            <TableHead className="text-white/60">Tipe</TableHead>
            <TableHead className="text-white/60">Nilai</TableHead>
            <TableHead className="text-white/60">Min. Beli</TableHead>
            <TableHead className="text-white/60">Kuota</TableHead>
            <TableHead className="text-white/60">Berlaku</TableHead>
            <TableHead className="text-white/60">Status</TableHead>
            <TableHead className="text-white/60 text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c) => (
            <TableRow key={c.id} className="border-white/5">
              <TableCell className="text-sm font-mono gold-text font-semibold">{c.code}</TableCell>
              <TableCell className="text-xs text-white/70">{c.discount_type === "percentage" ? "Persen" : "Nominal"}</TableCell>
              <TableCell className="text-sm">{c.discount_type === "percentage" ? `${c.discount_value}%` : formatIDR(c.discount_value)}</TableCell>
              <TableCell className="text-xs">{c.min_purchase > 0 ? formatIDR(c.min_purchase) : "-"}</TableCell>
              <TableCell className="text-xs">{c.max_uses === 0 ? "Unlimited" : `${c.uses_count}/${c.max_uses}`}</TableCell>
              <TableCell className="text-xs text-white/60">
                {c.valid_from ? new Date(c.valid_from).toLocaleDateString("id-ID") : "-"} → {c.valid_until ? new Date(c.valid_until).toLocaleDateString("id-ID") : "-"}
              </TableCell>
              <TableCell>
                <button onClick={() => toggleActive(c)}
                  className={`px-2 py-0.5 rounded-full text-[10px] border ${c.active ? "bg-green-500/15 text-green-300 border-green-500/30" : "bg-white/5 text-white/50 border-white/15"}`}>
                  {c.active ? "Aktif" : "Nonaktif"}
                </button>
              </TableCell>
              <TableCell className="text-right">
                <button onClick={() => { setEditing(c); setOpen(true); }} className="p-2 rounded-md text-white/70 hover:bg-white/5 hover:text-[#F5A623]">
                  <Edit size={15} />
                </button>
                <button onClick={() => remove(c.id)} className="p-2 rounded-md text-white/70 hover:bg-white/5 hover:text-red-400">
                  <Trash2 size={15} />
                </button>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={8} className="text-center text-white/40 py-6">Belum ada voucher</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      {open && (
        <CouponFormDialog
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

function CouponFormDialog({ open, onOpenChange, editing, api, onSaved }) {
  const [form, setForm] = useState(() => editing ? { ...editing, valid_from: editing.valid_from?.slice(0,10) || "", valid_until: editing.valid_until?.slice(0,10) || "" } : {
    code: "",
    discount_type: "percentage",
    discount_value: 10,
    min_purchase: 0,
    max_uses: 0,
    applies_to: "all",
    product_ids: [],
    valid_from: "",
    valid_until: "",
    active: true,
  });
  const [saving, setSaving] = useState(false);

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let c = "";
    for (let i = 0; i < 8; i++) c += chars[Math.floor(Math.random() * chars.length)];
    setForm({ ...form, code: c });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.code) return toast.error("Kode voucher wajib");
    setSaving(true);
    const payload = {
      code: form.code,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value || 0),
      min_purchase: parseFloat(form.min_purchase || 0),
      max_uses: parseInt(form.max_uses || 0, 10),
      applies_to: form.applies_to,
      product_ids: form.product_ids || [],
      valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
      valid_until: form.valid_until ? new Date(form.valid_until + "T23:59:59").toISOString() : null,
      active: form.active,
    };
    try {
      if (editing) await api.put(`/admin/coupons/${editing.id}`, payload);
      else await api.post("/admin/coupons", payload);
      toast.success(editing ? "Voucher diupdate" : "Voucher ditambahkan");
      onSaved();
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal simpan"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1d27] border-white/10 text-white sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">{editing ? "Edit Voucher" : "Tambah Voucher"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Field label="Kode Voucher">
            <div className="flex gap-2">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="HEMAT10"
                className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623] font-mono uppercase" />
              <Button type="button" onClick={generateCode} variant="outline" className="bg-transparent border-white/15 text-white/70 hover:bg-white/5">
                Generate
              </Button>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipe Diskon">
              <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                <SelectTrigger className="bg-[#0f1117] border-white/15"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1d27] border-white/10 text-white">
                  <SelectItem value="percentage">Persentase (%)</SelectItem>
                  <SelectItem value="nominal">Nominal (Rp)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={form.discount_type === "percentage" ? "Persen (%)" : "Nominal (Rp)"}>
              <Input type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minimum Pembelian (Rp)">
              <Input type="number" value={form.min_purchase} onChange={(e) => setForm({ ...form, min_purchase: e.target.value })}
                className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
            </Field>
            <Field label="Batas Penggunaan (0 = unlimited)">
              <Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Berlaku Dari">
              <Input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
            </Field>
            <Field label="Sampai Tanggal">
              <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                className="bg-[#0f1117] border-white/15 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]" />
            </Field>
          </div>
          <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#0f1117] border border-white/10">
            <Label className="text-sm">Aktif</Label>
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })}
              className="data-[state=checked]:bg-[#F5A623]" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving} className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold">
              {saving ? <Loader2 className="animate-spin" size={15} /> : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



// ---------- Banners (Promo Slider) ----------
function BannersTab({ api }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/admin/banners");
      setItems(r.data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const toggleActive = async (b) => {
    try {
      await api.put(`/admin/banners/${b.id}`, { ...b, active: !b.active });
      toast.success(!b.active ? "Banner diaktifkan" : "Banner dinonaktifkan");
      load();
    } catch { toast.error("Gagal update"); }
  };
  const remove = async (b) => {
    if (!window.confirm(`Hapus banner "${b.title || "(tanpa judul)"}"?`)) return;
    try { await api.delete(`/admin/banners/${b.id}`); load(); toast.success("Banner dihapus"); }
    catch { toast.error("Gagal hapus"); }
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="font-display text-lg">Banner Promo ({items.length})</h3>
          <p className="text-xs text-white/50 mt-0.5">Kelola slider hero di storefront. Urutan berdasarkan Display Order (kecil → tampil dulu).</p>
        </div>
        <Button
          data-testid="banner-add-btn"
          onClick={() => { setEditing(null); setOpen(true); }}
          className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
          size="sm"
        >
          + Tambah Banner
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {loading && <p className="text-white/40 text-sm">Memuat…</p>}
        {!loading && items.length === 0 && (
          <p className="text-white/40 text-sm col-span-2">Belum ada banner. Klik &quot;Tambah Banner&quot; untuk mulai.</p>
        )}
        {items.map((b) => (
          <div
            key={b.id}
            data-testid={`banner-item-${b.id}`}
            className={`rounded-xl overflow-hidden border ${b.active ? "border-[#F5A623]/30" : "border-white/10 opacity-60"} bg-[#0f1117]`}
          >
            <div className="aspect-[2/1] relative bg-black">
              {b.image_url ? (
                <img
                  src={resolveImageUrl(b.image_url)}
                  alt={b.title || "Banner"}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: b.image_position || "center center" }}
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">No image</div>
              )}
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-black/50 text-white/80">
                Urutan #{b.display_order}
              </div>
            </div>
            <div className="p-3">
              <div className="font-display text-sm text-white truncate">{b.title || "(tanpa judul)"}</div>
              <p className="text-xs text-white/60 truncate mt-0.5">{b.subtitle || "-"}</p>
              {b.cta_text && (
                <p className="text-[10px] text-[#F5A623] mt-1">CTA: {b.cta_text} → {b.cta_link}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <button
                  data-testid={`banner-toggle-${b.id}`}
                  onClick={() => toggleActive(b)}
                  className={`text-[11px] px-2 py-1 rounded-md border ${b.active ? "bg-green-500/15 border-green-500/30 text-green-300" : "bg-white/5 border-white/15 text-white/60"}`}
                >
                  {b.active ? "● Aktif" : "○ Nonaktif"}
                </button>
                <button
                  data-testid={`banner-edit-${b.id}`}
                  onClick={() => { setEditing(b); setOpen(true); }}
                  className="text-[11px] px-2 py-1 rounded-md bg-white/5 border border-white/15 hover:bg-white/10"
                >
                  Edit
                </button>
                <button
                  data-testid={`banner-delete-${b.id}`}
                  onClick={() => remove(b)}
                  className="text-[11px] px-2 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <BannerFormDialog
          open={open}
          onOpenChange={setOpen}
          editing={editing}
          api={api}
          onSaved={() => { setOpen(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function BannerFormDialog({ open, onOpenChange, editing, api, onSaved }) {
  const [form, setForm] = useState(() => ({
    image_url: editing?.image_url || "",
    title: editing?.title || "",
    subtitle: editing?.subtitle || "",
    cta_text: editing?.cta_text || "",
    cta_link: editing?.cta_link || "",
    active: editing?.active !== undefined ? editing.active : true,
    display_order: editing?.display_order || 100,
    linked_coupon_code: editing?.linked_coupon_code || "",
    expires_at: editing?.expires_at || "",
    image_position: editing?.image_position || "center center",
  }));
  const [saving, setSaving] = useState(false);
  const [coupons, setCoupons] = useState([]);

  useEffect(() => {
    if (!open) return;
    api.get("/admin/coupons").then((r) => setCoupons((r.data || []).filter((c) => c.active))).catch(() => setCoupons([]));
  }, [open, api]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        image_url: form.image_url,
        title: form.title,
        subtitle: form.subtitle,
        cta_text: form.cta_text,
        cta_link: form.cta_link,
        active: !!form.active,
        display_order: parseInt(form.display_order || 100, 10),
        linked_coupon_code: (form.linked_coupon_code || "").toUpperCase(),
        expires_at: form.expires_at || "",
        image_position: form.image_position || "center center",
      };
      if (editing) await api.put(`/admin/banners/${editing.id}`, payload);
      else await api.post("/admin/banners", payload);
      toast.success(editing ? "Banner diupdate" : "Banner ditambahkan");
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal simpan");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="banner-form-dialog" className="bg-[#1a1d27] border-white/10 text-white sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{editing ? "Edit Banner" : "Tambah Banner"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Field label="Gambar Banner">
            <PhotoPicker
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url })}
              api={api}
            />
          </Field>
          {form.image_url && (
            <Field label="Posisi Gambar (crop focus)">
              <ObjectPositionPicker
                value={form.image_position}
                onChange={(pos) => setForm({ ...form, image_position: pos })}
                previewImage={form.image_url.startsWith("/api/") ? (process.env.REACT_APP_BACKEND_URL + form.image_url) : form.image_url}
                testIdPrefix="bf-image-pos"
              />
            </Field>
          )}
          <Field label="Judul Banner">
            <Input data-testid="bf-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="bg-[#0f1117] border-white/15" />
          </Field>
          <Field label="Subjudul / Deskripsi (opsional)">
            <Input data-testid="bf-subtitle" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              className="bg-[#0f1117] border-white/15" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Teks CTA (opsional)">
              <Input data-testid="bf-cta-text" value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })}
                placeholder="Pakai Kode: HEMAT50" className="bg-[#0f1117] border-white/15" />
            </Field>
            <Field label="Link CTA (opsional)">
              <Input data-testid="bf-cta-link" value={form.cta_link} onChange={(e) => setForm({ ...form, cta_link: e.target.value })}
                placeholder="#products atau https://…" className="bg-[#0f1117] border-white/15" />
            </Field>
          </div>

          <div className="rounded-md bg-[#0f1117] border border-white/10 p-3 space-y-3">
            <div>
              <Label className="text-sm">⏱️ Countdown Timer (opsional)</Label>
              <p className="text-[10px] text-white/50 mt-0.5">
                Kalau banner promo terbatas waktu, link ke kupon aktif (expires_at otomatis) atau set manual.
              </p>
            </div>
            <Field label="Kupon Terkait (opsional)">
              <Select
                value={form.linked_coupon_code || "__none__"}
                onValueChange={(v) => setForm({ ...form, linked_coupon_code: v === "__none__" ? "" : v })}
              >
                <SelectTrigger data-testid="bf-linked-coupon" className="bg-[#1a1d27] border-white/15">
                  <SelectValue placeholder="— Tidak dilink —" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1d27] border-white/10 text-white">
                  <SelectItem value="__none__">— Tidak dilink —</SelectItem>
                  {coupons.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} ({c.discount_type === "percentage" ? `${c.discount_value}%` : formatIDR(c.discount_value)})
                      {c.valid_until ? ` — exp ${new Date(c.valid_until).toLocaleDateString("id-ID")}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Expired Manual (opsional, override kupon)">
              <Input
                data-testid="bf-expires-at"
                type="datetime-local"
                value={form.expires_at ? form.expires_at.slice(0, 16) : ""}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value ? new Date(e.target.value).toISOString() : "" })}
                className="bg-[#1a1d27] border-white/15"
              />
              <p className="text-[10px] text-white/45 mt-1">Kalau diisi, override tanggal expired dari kupon.</p>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <Field label="Urutan Tampil">
              <Input type="number" data-testid="bf-order" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                className="bg-[#0f1117] border-white/15" />
            </Field>
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#0f1117] border border-white/10">
              <Label className="text-sm">Aktif</Label>
              <Switch data-testid="bf-active" checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })}
                className="data-[state=checked]:bg-[#F5A623]" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving} data-testid="bf-save-btn" className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold">
              {saving ? <Loader2 className="animate-spin" size={15} /> : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Maintenance Mode ----------
function MaintenanceTab({ api }) {
  const [form, setForm] = useState({
    enabled: false,
    message: "",
    estimated_finish: "",
    contact_wa: "",
    contact_telegram: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/maintenance").then((r) => {
      setForm({
        enabled: !!r.data.enabled,
        message: r.data.message || "",
        estimated_finish: r.data.estimated_finish || "",
        contact_wa: r.data.contact_wa || "",
        contact_telegram: r.data.contact_telegram || "",
      });
    }).finally(() => setLoading(false));
  }, [api]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/admin/maintenance", form);
      toast.success(form.enabled ? "Mode maintenance AKTIF 🚧" : "Mode maintenance NONAKTIF ✅");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal simpan");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="glass rounded-2xl p-6 text-white/50 text-sm">Memuat…</div>;

  return (
    <div className="glass rounded-2xl p-6 space-y-4 max-w-2xl" data-testid="maintenance-tab">
      <div>
        <h3 className="font-display text-lg">Mode Maintenance</h3>
        <p className="text-xs text-white/50 mt-0.5">Saat aktif, storefront tampilkan halaman pemeliharaan. /admin tetap bisa diakses.</p>
      </div>

      <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${form.enabled ? "bg-red-500/10 border-red-500/30" : "bg-green-500/5 border-green-500/20"}`}>
        <div>
          <div className="font-display text-sm">Status</div>
          <div className={`text-xs mt-0.5 ${form.enabled ? "text-red-300" : "text-green-300"}`}>
            {form.enabled ? "🚧 AKTIF — storefront ditutup" : "✅ NONAKTIF — storefront normal"}
          </div>
        </div>
        <Switch
          data-testid="maintenance-toggle"
          checked={form.enabled}
          onCheckedChange={(v) => setForm({ ...form, enabled: v })}
          className="data-[state=checked]:bg-red-500"
        />
      </div>

      <Field label="Pesan Maintenance (untuk pengunjung)">
        <textarea
          data-testid="maintenance-message"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          rows={3}
          className="w-full bg-[#0f1117] border border-white/15 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#F5A623]/40"
        />
      </Field>

      <Field label="Estimasi Selesai (opsional)">
        <Input
          data-testid="maintenance-eta-input"
          value={form.estimated_finish}
          onChange={(e) => setForm({ ...form, estimated_finish: e.target.value })}
          placeholder="Contoh: Hari ini pukul 18.00 WIB"
          className="bg-[#0f1117] border-white/15"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Kontak WhatsApp (opsional)">
          <Input
            data-testid="maintenance-wa"
            value={form.contact_wa}
            onChange={(e) => setForm({ ...form, contact_wa: e.target.value })}
            placeholder="628xxxx"
            className="bg-[#0f1117] border-white/15"
          />
        </Field>
        <Field label="Kontak Telegram (opsional)">
          <Input
            data-testid="maintenance-tg"
            value={form.contact_telegram}
            onChange={(e) => setForm({ ...form, contact_telegram: e.target.value })}
            placeholder="@username"
            className="bg-[#0f1117] border-white/15"
          />
        </Field>
      </div>

      <Button
        onClick={save}
        disabled={saving}
        data-testid="maintenance-save-btn"
        className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
      >
        {saving ? <Loader2 className="animate-spin" size={15} /> : "Simpan Perubahan"}
      </Button>
    </div>
  );
}
