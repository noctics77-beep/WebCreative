import { useEffect, useState, useMemo } from "react";
import { api, API, resolveImageUrl } from "@/lib/api";
import { toast } from "sonner";
import axios from "axios";
import { Star, Send, Loader2, Camera, X, ShieldCheck, Shield, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export default function Testimonials() {
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState({
    form_enabled: true,
    public_page_headline: "Cerita nyata dari Sobat Creative",
    public_page_subheadline: "",
    satisfied_customers_text: "5.000+",
    claim_text: "",
  });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get("/testimonials").then((r) => setItems(r.data.items || [])),
      api.get("/testimonials/settings").then((r) => setSettings((s) => ({ ...s, ...r.data }))),
      api.get("/products").then((r) => setProducts(r.data.filter((p) => p.publish_status !== "draft"))),
    ]).finally(() => setLoading(false));
  }, []);

  const avgRating = useMemo(() => {
    if (!items.length) return 0;
    return (items.reduce((a, b) => a + (b.rating || 5), 0) / items.length).toFixed(1);
  }, [items]);

  return (
    <div data-testid="testimonials-page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#F5A623]/30 bg-[#F5A623]/10 text-[#F5A623] text-[11px] uppercase tracking-[0.25em] mb-4">
          Testimoni Verified
        </div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-tight">
          {settings.public_page_headline || <>Cerita nyata dari <span className="gold-text">Sobat Creative</span></>}
        </h1>
        {(settings.public_page_subheadline || settings.claim_text) && (
          <p className="text-white/60 text-sm md:text-base mt-4 max-w-2xl mx-auto">
            {settings.public_page_subheadline || settings.claim_text}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-6 flex-wrap">
          <div className="text-center">
            <div className="font-display text-3xl gold-text">{settings.satisfied_customers_text || "5.000+"}</div>
            <div className="text-[11px] uppercase tracking-widest text-white/50 mt-1">Pembeli Puas</div>
          </div>
          {items.length > 0 && (
            <>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <div className="font-display text-3xl gold-text flex items-center gap-1">
                  {avgRating}
                  <Star size={22} className="fill-[#F5A623] text-[#F5A623]" />
                </div>
                <div className="text-[11px] uppercase tracking-widest text-white/50 mt-1">Rating Rata-rata</div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <div className="font-display text-3xl gold-text">{items.length}</div>
                <div className="text-[11px] uppercase tracking-widest text-white/50 mt-1">Testimoni Approved</div>
              </div>
            </>
          )}
        </div>
        {settings.form_enabled && (
          <Button
            data-testid="open-submit-form"
            onClick={() => setFormOpen(true)}
            className="mt-8 bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold px-6 py-6 text-base"
          >
            <Send size={16} className="mr-2" /> Kirim Testimoni Kamu
          </Button>
        )}
        {!settings.form_enabled && (
          <p className="mt-6 text-xs text-white/40 italic">Form testimoni sedang ditutup sementara.</p>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="inline animate-spin text-[#F5A623]" size={30} /></div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center text-white/50 border border-dashed border-white/10 rounded-2xl">
          Belum ada testimoni. Jadi yang pertama! 💛
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5" data-testid="testimonials-masonry">
          {items.map((it) => (
            <TestimonialCard key={it.id} item={it} onPhotoClick={setLightbox} />
          ))}
        </div>
      )}

      {formOpen && (
        <SubmitTestimonialModal
          open={formOpen}
          onOpenChange={setFormOpen}
          products={products}
          onSubmitted={() => {
            setFormOpen(false);
            api.get("/testimonials").then((r) => setItems(r.data.items || []));
          }}
        />
      )}

      {lightbox && (
        <div
          data-testid="testimonial-lightbox"
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white p-2 rounded-full bg-white/10 hover:bg-white/20">
            <X size={20} />
          </button>
          <img src={resolveImageUrl(lightbox)} alt="" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}

function TestimonialCard({ item, onPhotoClick }) {
  return (
    <article
      data-testid={`testimonial-${item.id}`}
      className={`glass rounded-2xl p-5 md:p-6 break-inside-avoid mb-5 relative ${
        item.is_pinned ? "border-[#F5A623]/40 shadow-[0_0_28px_rgba(245,166,35,0.08)]" : ""
      }`}
    >
      {item.is_pinned && (
        <div className="absolute -top-2 -right-2 bg-[#F5A623] text-[#0f1117] rounded-full p-1.5">
          <Pin size={12} />
        </div>
      )}
      <div className="flex items-center gap-0.5 text-[#F5A623] mb-3">
        {[...Array(5)].map((_, k) => (
          <Star key={k} size={14} fill={k < item.rating ? "currentColor" : "none"} strokeWidth={1.5} />
        ))}
      </div>
      <p className="text-white/85 text-sm leading-relaxed whitespace-pre-wrap">&ldquo;{item.content}&rdquo;</p>

      {item.photos && item.photos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {item.photos.slice(0, 3).map((p, i) => (
            <button
              key={i}
              onClick={() => onPhotoClick(p)}
              className="aspect-square rounded-lg overflow-hidden border border-white/5 hover:border-[#F5A623]/40 transition-colors"
            >
              <img src={resolveImageUrl(p)} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F5A623] to-[#7a4a0e] flex items-center justify-center font-display font-semibold text-sm text-[#0f1117] flex-shrink-0">
          {(item.name || "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{item.name}</div>
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {item.is_verified_buyer && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-300 border border-green-500/30 flex items-center gap-1">
                <ShieldCheck size={9} /> Verified Buyer
              </span>
            )}
            {item.is_admin_post && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/40 flex items-center gap-1">
                <Shield size={9} /> Admin
              </span>
            )}
            {item.product_name && (
              <span className="text-[10px] text-white/50">• {item.product_name}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function SubmitTestimonialModal({ open, onOpenChange, products, onSubmitted }) {
  const [form, setForm] = useState({
    name: "",
    whatsapp: "",
    product_id: "",
    rating: 5,
    content: "",
    photos: [],
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const uploadPhoto = async (file) => {
    if (form.photos.length >= 3) return toast.error("Maksimal 3 foto");
    if (file.size > 3 * 1024 * 1024) return toast.error(`Foto max 3MB (saat ini ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await axios.post(`${API}/testimonials/upload`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, photos: [...f.photos, r.data.url].slice(0, 3) }));
      toast.success("Foto ter-upload");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload gagal");
    } finally { setUploading(false); }
  };

  const removePhoto = (i) => setForm((f) => ({ ...f, photos: f.photos.filter((_, k) => k !== i) }));

  const submit = async () => {
    if (!form.name || form.name.length < 2) return toast.error("Nama minimal 2 karakter");
    if (!form.content || form.content.length < 10) return toast.error("Testimoni minimal 10 karakter");
    setSubmitting(true);
    try {
      const r = await api.post("/testimonials", form);
      toast.success(r.data.message || "Terima kasih! Testimoni kamu sedang diperiksa 💛");
      onSubmitted();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal kirim testimoni");
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1d27] border-white/10 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kirim Testimoni Kamu</DialogTitle>
          <DialogDescription className="text-xs text-white/50 mt-1">
            Testimoni akan diperiksa admin dulu (biasanya &lt;24 jam) sebelum tampil.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-3">
          <div>
            <Label className="text-xs">Nama <span className="text-red-400">*</span></Label>
            <Input data-testid="tt-submit-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama kamu" className="bg-[#0f1117] border-white/15 mt-1" />
          </div>
          <div>
            <Label className="text-xs">WhatsApp (untuk verifikasi Verified Buyer)</Label>
            <Input data-testid="tt-submit-wa" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="081234567890" className="bg-[#0f1117] border-white/15 mt-1" />
            <p className="text-[10px] text-white/40 mt-1">Nomor kamu tidak akan ditampilkan publik.</p>
          </div>
          <div>
            <Label className="text-xs">Produk yang kamu beli (opsional)</Label>
            <select
              data-testid="tt-submit-product"
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              className="w-full mt-1 bg-[#0f1117] border border-white/15 rounded-md px-3 py-2 text-sm text-white"
            >
              <option value="">— Pilih produk —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Rating</Label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((r) => (
                <button key={r} type="button" data-testid={`tt-submit-star-${r}`} onClick={() => setForm({ ...form, rating: r })}>
                  <Star size={26} className={r <= form.rating ? "text-[#F5A623] fill-[#F5A623]" : "text-white/20"} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Ceritakan pengalaman kamu <span className="text-red-400">*</span></Label>
            <Textarea data-testid="tt-submit-content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} placeholder="Ceritakan pengalaman kamu belanja di CreativeStore..." className="bg-[#0f1117] border-white/15 mt-1" />
            <p className="text-[10px] text-white/40 mt-1">{form.content.length}/500 karakter (min. 10)</p>
          </div>
          <div>
            <Label className="text-xs">Foto (opsional, max 3, 3MB per foto)</Label>
            <div className="flex gap-2 flex-wrap mt-2">
              {form.photos.map((p, i) => (
                <div key={i} className="relative w-20 h-20 rounded overflow-hidden">
                  <img src={resolveImageUrl(p)} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removePhoto(i)} className="absolute top-0 right-0 bg-red-500 rounded-bl p-0.5">
                    <X size={10} />
                  </button>
                </div>
              ))}
              {form.photos.length < 3 && (
                <label className="w-20 h-20 border-2 border-dashed border-white/15 rounded flex items-center justify-center cursor-pointer hover:border-[#F5A623]/50 flex-col gap-1">
                  {uploading ? <Loader2 className="animate-spin" size={16} /> : <><Camera size={18} className="text-white/40" /><span className="text-[9px] text-white/40">Upload</span></>}
                  <input type="file" accept="image/*" hidden onChange={(e) => e.target.files && e.target.files[0] && uploadPhoto(e.target.files[0])} />
                </label>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-transparent border-white/15 text-white/70 hover:bg-white/5">Batal</Button>
          <Button data-testid="tt-submit-btn" onClick={submit} disabled={submitting} className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold">
            {submitting && <Loader2 className="animate-spin mr-1" size={13} />}
            <Send size={14} className="mr-1" /> Kirim Testimoni
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
