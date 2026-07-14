import { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { api, formatIDR, resolveImageUrl } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle2, Copy, Loader2, Clock, ShieldCheck, QrCode, PackageSearch, Store } from "lucide-react";
import {
  trackViewContent,
  trackInitiateCheckout,
  trackPurchase,
} from "@/lib/tracking";

const PAYMENT_OPTIONS = [
  { value: "qris_otomatis", label: "QRIS Otomatis", icon: QrCode },
  { value: "qris", label: "QRIS Manual" },
  { value: "transfer", label: "Transfer Bank" },
];

export default function OrderModal({ open, onClose, product, variant, referral }) {
  const [form, setForm] = useState({
    buyer_name: "",
    contact: "",
    payment_method: "qris_otomatis",
    discount_code: "",
  });
  const [loading, setLoading] = useState(false);
  const [orderCode, setOrderCode] = useState(null);
  const [discountInfo, setDiscountInfo] = useState(null);
  const [step, setStep] = useState("form"); // form | payment | success
  const [paySettings, setPaySettings] = useState({ qris_url: "", bank_accounts: [] });
  const [autoData, setAutoData] = useState(null); // {qr_image, pakasir_total, pakasir_fee, expires_at}
  const [autoPaid, setAutoPaid] = useState(false);
  const [expired, setExpired] = useState(false);
  const [remaining, setRemaining] = useState(0); // seconds
  const pollRef = useRef(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (open) {
      api
        .get("/stats")
        .then((r) =>
          setPaySettings({
            qris_url: r.data.qris_url || "",
            bank_accounts: r.data.bank_accounts || [],
          })
        )
        .catch(() => {});
      // Track ViewContent when user opens product detail / order modal
      if (product) {
        trackViewContent(product);
      }
      // Auto-fill kupon dari sessionStorage (di-set oleh BannerSlider saat click CTA)
      try {
        const pending = sessionStorage.getItem("cs_pending_coupon");
        if (pending && !form.discount_code) {
          setForm((prev) => ({ ...prev, discount_code: pending }));
          toast.info(`Kode kupon ${pending} sudah terisi otomatis, klik "Pakai" untuk aktifkan 🎉`);
        }
      } catch (_) { /* storage disabled */ }
    }
  }, [open, product]);

  // Confetti burst on success ✨
  useEffect(() => {
    if (step !== "success") return;
    const fire = (particleRatio, opts) =>
      confetti({
        origin: { y: 0.7 },
        ...opts,
        particleCount: Math.floor(200 * particleRatio),
      });
    try {
      fire(0.25, { spread: 26, startVelocity: 55, colors: ["#F5A623", "#F8D471", "#10b981"] });
      fire(0.2, { spread: 60, colors: ["#F5A623", "#ffffff"] });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ["#F5A623", "#10b981", "#F8D471"] });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45, colors: ["#F5A623", "#10b981"] });
    } catch (_) {
      /* confetti optional */
    }
  }, [step]);

  // Countdown ticker for QRIS Otomatis
  useEffect(() => {
    if (step !== "payment" || form.payment_method !== "qris_otomatis" || !autoData?.expires_at) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(autoData.expires_at) - new Date()) / 1000));
      setRemaining(diff);
      if (diff <= 0) setExpired(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [step, form.payment_method, autoData]);

  // Poll payment status for QRIS Otomatis
  useEffect(() => {
    const polling =
      step === "payment" &&
      form.payment_method === "qris_otomatis" &&
      orderCode &&
      !autoPaid &&
      !expired;
    if (!polling) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await api.get(`/orders/${orderCode}/status`);
        if (r.data.status === "paid") {
          setAutoPaid(true);
          setStep("success");
          // Track Purchase when order is auto-confirmed paid via Pakasir webhook
          trackPurchase({
            order_code: orderCode,
            product_id: product?.id,
            product_name: product?.name,
            pakasir_total: autoData?.pakasir_total ?? finalPrice,
          });
          clearInterval(pollRef.current);
        } else if (r.data.status === "expired") {
          setExpired(true);
          clearInterval(pollRef.current);
        }
      } catch {
        /* keep polling */
      }
    }, 4000);
    return () => clearInterval(pollRef.current);
  }, [step, form.payment_method, orderCode, autoPaid, expired]);

  if (!product) return null;
  // Variant-aware pricing — if variant given, override product price
  const hasDiscount =
    !variant && product.discount_active && product.discount_price < product.original_price;
  const variantBase = variant
    ? (variant.discount_price || variant.price || 0)
    : null;
  const basePrice = variant
    ? variantBase
    : (hasDiscount ? product.discount_price : product.original_price);
  // Support 2 tipe: loyalty (percentage) atau coupon voucher (percentage/nominal)
  const finalPrice = discountInfo?.valid
    ? (discountInfo.discount_amount != null
        ? Math.max(0, basePrice - discountInfo.discount_amount)
        : Math.round(basePrice * (1 - (discountInfo.percentage || 0) / 100)))
    : basePrice;

  const validateCode = async () => {
    const c = form.discount_code.trim().toUpperCase();
    if (!c) {
      setDiscountInfo(null);
      return;
    }
    setValidating(true);
    // 1) Cek admin coupon voucher dulu
    try {
      const res = await api.post("/coupons/validate", {
        code: c,
        product_id: product.id,
        total: basePrice,
      });
      if (res.data?.valid) {
        setDiscountInfo({
          valid: true,
          code: c,
          type: "coupon",
          discount_amount: res.data.discount_amount,
          discount_type: res.data.discount_type,
          discount_value: res.data.discount_value,
        });
        const label = res.data.discount_type === "percentage"
          ? `${res.data.discount_value}%`
          : `Rp ${(res.data.discount_amount || 0).toLocaleString("id-ID")}`;
        toast.success(`Voucher valid! Diskon ${label} 🎉`);
        setValidating(false);
        return;
      }
    } catch (_couponErr) {
      // Coupon invalid / not found → lanjut fallback ke loyalty
    }
    // 2) Fallback: loyalty discount code
    try {
      const res2 = await api.get(`/discount/validate/${c}`);
      if (res2.data?.valid) {
        setDiscountInfo({
          valid: true,
          code: c,
          type: "loyalty",
          percentage: res2.data.percentage,
        });
        toast.success(`Kode loyalty valid! Diskon ${res2.data.percentage}% 🎉`);
        setValidating(false);
        return;
      }
    } catch (_loyaltyErr) {
      // fallthrough ke error handler
    }
    // 3) Dua-duanya gagal
    setDiscountInfo({ valid: false });
    toast.error("Kode tidak valid atau sudah expired ya, Sobat Creative 😢");
    setValidating(false);
  };

  const buildPayload = () => ({
    buyer_name: form.buyer_name,
    contact: form.contact,
    payment_method: form.payment_method,
    product_id: product.id,
    referral_affiliate_code: referral || null,
    discount_code: discountInfo?.valid ? form.discount_code.trim().toUpperCase() : null,
    variant_id: variant?.id || null,
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.buyer_name.trim() || !form.contact.trim()) {
      toast.error("Mohon lengkapi nama dan kontak");
      return;
    }
    // Track InitiateCheckout when user submits the order form
    trackInitiateCheckout({
      product,
      payment_method: form.payment_method,
    });
    if (form.payment_method === "qris_otomatis") {
      // Create order immediately to generate dynamic QRIS
      setLoading(true);
      try {
        const res = await api.post("/orders", buildPayload());
        setOrderCode(res.data.order_code);
        setAutoData({
          qr_image: res.data.qr_image,
          pakasir_total: res.data.pakasir_total,
          pakasir_fee: res.data.pakasir_fee,
          expires_at: res.data.expires_at,
        });
        setExpired(false);
        setAutoPaid(false);
        setStep("payment");
      } catch (err) {
        toast.error(err?.response?.data?.detail || "Gagal membuat QRIS otomatis");
      } finally {
        setLoading(false);
      }
      return;
    }
    setStep("payment");
  };

  const confirmPayment = async () => {
    setLoading(true);
    try {
      const res = await api.post("/orders", buildPayload());
      setOrderCode(res.data.order_code);
      setStep("success");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mengirim pesanan");
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    clearInterval(pollRef.current);
    setOrderCode(null);
    setDiscountInfo(null);
    setStep("form");
    setAutoData(null);
    setAutoPaid(false);
    setExpired(false);
    setRemaining(0);
    setForm({ buyer_name: "", contact: "", payment_method: "qris_otomatis", discount_code: "" });
  };

  const handleClose = (v) => {
    if (!v) {
      resetAll();
      onClose();
    }
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const autoTotal = autoData?.pakasir_total ?? finalPrice;
  const discountAmount = discountInfo?.valid ? Math.max(0, basePrice - finalPrice) : 0;
  const discountLabel = discountInfo?.valid
    ? (discountInfo.type === "coupon"
        ? (discountInfo.discount_type === "percentage"
            ? `Voucher ${discountInfo.discount_value}%`
            : `Voucher Rp ${(discountInfo.discount_amount || 0).toLocaleString("id-ID")}`)
        : `Kode Loyalty ${discountInfo.percentage}%`)
    : "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        data-testid="order-modal"
        className="bg-[#1a1d27] border border-white/10 text-white sm:max-w-[480px] max-h-[90vh] overflow-y-auto"
      >
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                Pesan: <span className="gold-text">{product.name}</span>
              </DialogTitle>
              <DialogDescription className="text-white/55">
                Isi data di bawah lalu pilih metode pembayaran.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={submit} className="space-y-4 pt-2">
              {/* Product summary card */}
              <div
                data-testid="order-product-summary"
                className="flex gap-3 items-start p-3 rounded-xl bg-[#22262f] border border-[#F5A623]/25"
              >
                {product.photo_url ? (
                  <img
                    src={resolveImageUrl(product.photo_url)}
                    alt={product.name}
                    data-testid="order-product-thumb"
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0 border border-white/5"
                  />
                ) : (
                  <div
                    data-testid="order-product-thumb-placeholder"
                    className="w-20 h-20 rounded-lg flex-shrink-0 border border-white/5 bg-white/5 flex items-center justify-center text-white/30 text-xs"
                  >
                    No image
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p
                    data-testid="order-product-name"
                    className="font-semibold text-[15px] text-white leading-snug"
                  >
                    {product.name}
                  </p>
                  {variant?.name && (
                    <p
                      data-testid="order-variant-name"
                      className="text-[11px] mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#F5A623]/15 border border-[#F5A623]/30 text-[#F5A623]"
                    >
                      Variasi: <b>{variant.name}</b>
                    </p>
                  )}
                  <div className="flex items-baseline gap-2 mt-1" data-testid="order-product-price-block">
                    {variant?.discount_price && variant?.price > variant.discount_price && (
                      <span className="text-xs text-white/40 line-through">
                        {formatIDR(variant.price)}
                      </span>
                    )}
                    {!variant && hasDiscount && (
                      <span className="text-xs text-white/40 line-through">
                        {formatIDR(product.original_price)}
                      </span>
                    )}
                    <span className="text-[15px] font-semibold gold-text">
                      {formatIDR(basePrice)}
                    </span>
                  </div>
                  {product.description && !variant && (
                    <p className="text-xs text-white/55 mt-1.5 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="buyer_name" className="text-xs uppercase tracking-widest text-white/60">
                  Nama Lengkap
                </Label>
                <Input
                  id="buyer_name"
                  data-testid="order-buyer-name-input"
                  value={form.buyer_name}
                  onChange={(e) => setForm({ ...form, buyer_name: e.target.value })}
                  placeholder="Nama kamu"
                  className="mt-1 bg-[#0f1117] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
                />
              </div>
              <div>
                <Label htmlFor="contact" className="text-xs uppercase tracking-widest text-white/60">
                  WhatsApp / Telegram
                </Label>
                <Input
                  id="contact"
                  data-testid="order-contact-input"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  placeholder="08xxxx atau @username"
                  className="mt-1 bg-[#0f1117] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623]"
                />
              </div>

              <div>
                <Label className="text-xs uppercase tracking-widest text-white/60">Metode Pembayaran</Label>
                <RadioGroup
                  value={form.payment_method}
                  onValueChange={(v) => setForm({ ...form, payment_method: v })}
                  className="grid grid-cols-1 gap-2 mt-2"
                >
                  {PAYMENT_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      data-testid={`payment-${opt.value}-option`}
                      className={`flex items-center gap-2 px-3 py-3 rounded-lg border cursor-pointer transition ${
                        form.payment_method === opt.value
                          ? "border-[#F5A623] bg-[#F5A623]/10"
                          : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      <RadioGroupItem
                        value={opt.value}
                        id={opt.value}
                        className="border-white/30 text-[#F5A623]"
                      />
                      <span className="text-sm flex items-center gap-2">
                        {opt.icon && <opt.icon size={15} className="text-[#F5A623]" />}
                        {opt.label}
                      </span>
                      {opt.value === "qris_otomatis" && (
                        <span className="ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#10b981]/15 text-[#10b981]">
                          Instan
                        </span>
                      )}
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {referral && (
                <div
                  data-testid="referral-banner"
                  className="px-3 py-2 rounded-lg bg-[#F5A623]/10 border border-[#F5A623]/30 text-sm text-[#F5A623]"
                >
                  Dirujuk oleh: <b>{referral}</b>
                </div>
              )}

              <div>
                <Label className="text-xs uppercase tracking-widest text-white/60">Kode Voucher / Diskon (opsional)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    data-testid="discount-code-input"
                    value={form.discount_code}
                    onChange={(e) => {
                      setForm({ ...form, discount_code: e.target.value });
                      setDiscountInfo(null);
                    }}
                    placeholder="Masukkan kode voucher"
                    className="bg-[#0f1117] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623] uppercase font-mono"
                  />
                  <Button
                    type="button"
                    data-testid="apply-discount-btn"
                    onClick={validateCode}
                    disabled={validating || !form.discount_code.trim()}
                    className="bg-white/10 hover:bg-white/15 text-white border border-white/15 disabled:opacity-50"
                  >
                    {validating ? <Loader2 className="animate-spin" size={14} /> : "Pakai"}
                  </Button>
                </div>
                {discountInfo?.valid && (
                  <div
                    data-testid="discount-applied"
                    className="mt-2 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30"
                  >
                    <div className="flex items-center gap-2 text-xs text-green-300">
                      <CheckCircle2 size={14} className="text-green-400" />
                      <span>
                        <b>{discountLabel}</b> diterapkan — hemat{" "}
                        <b className="text-green-400">{formatIDR(discountAmount)}</b>
                      </span>
                    </div>
                    <button
                      type="button"
                      data-testid="remove-discount-btn"
                      onClick={() => {
                        setDiscountInfo(null);
                        setForm({ ...form, discount_code: "" });
                      }}
                      className="text-[10px] uppercase tracking-wider text-white/50 hover:text-red-300"
                    >
                      Hapus
                    </button>
                  </div>
                )}
                {discountInfo && !discountInfo.valid && (
                  <p className="text-xs text-red-300 mt-1" data-testid="discount-invalid">
                    Kode tidak valid atau sudah expired ya, Sobat Creative 😢
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-white/5 space-y-1.5" data-testid="order-price-summary">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/55">Subtotal</span>
                  <span className="text-white/80">{formatIDR(basePrice)}</span>
                </div>
                {discountInfo?.valid && (
                  <div className="flex items-center justify-between text-sm" data-testid="summary-discount-row">
                    <span className="text-green-300">Diskon ({discountLabel})</span>
                    <span className="text-green-300">− {formatIDR(discountAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                  <span className="text-white/70 text-sm">Total Bayar</span>
                  <span
                    data-testid="order-total-final"
                    className="font-display text-xl gold-text font-semibold"
                  >
                    {formatIDR(finalPrice)}
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  data-testid="order-submit-button"
                  disabled={loading}
                  className="w-full bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
                >
                  {loading ? <Loader2 className="animate-spin" size={16} /> : "Lanjut ke Pembayaran"}
                </Button>
              </DialogFooter>
              <p
                data-testid="order-eta-note"
                className="text-xs text-white/50 text-center leading-relaxed mt-3"
              >
                <Clock size={12} className="inline -mt-0.5 mr-1 text-[#F5A623]" />
                Pesanan diproses dalam 1×24 jam hari kerja. Kami akan menghubungi kamu via
                WhatsApp/Telegram setelah pembayaran dikonfirmasi.
              </p>
            </form>
          </>
        )}

        {step === "payment" && (
          <div data-testid="payment-step" className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                Pembayaran{" "}
                <span className="gold-text">
                  {form.payment_method === "qris_otomatis"
                    ? "QRIS Otomatis"
                    : form.payment_method.toUpperCase()}
                </span>
              </DialogTitle>
              <DialogDescription className="text-white/55">
                {form.payment_method === "qris_otomatis"
                  ? "Scan QR di bawah. Pembayaran terverifikasi otomatis tanpa konfirmasi admin."
                  : 'Transfer sesuai total bayar, lalu klik "Saya Sudah Bayar".'}
              </DialogDescription>
            </DialogHeader>

            {form.payment_method === "qris_otomatis" ? (
              <div className="space-y-3" data-testid="qris-otomatis-step">
                {expired ? (
                  <div
                    data-testid="qris-expired"
                    className="text-center py-6 border border-dashed border-red-500/30 rounded-xl space-y-3"
                  >
                    <p className="text-red-400 font-semibold">QRIS Kadaluarsa ⏰</p>
                    <p className="text-white/55 text-sm">
                      Waktu pembayaran habis. Silakan buat pesanan baru.
                    </p>
                    <Button
                      onClick={resetAll}
                      data-testid="new-order-btn"
                      className="bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
                    >
                      Buat Order Baru
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="text-center">
                      {autoData?.qr_image ? (
                        <img
                          src={autoData.qr_image}
                          alt="QRIS"
                          data-testid="qris-auto-image"
                          className="mx-auto max-w-[240px] w-full rounded-xl border border-white/10 bg-white p-3"
                        />
                      ) : (
                        <Loader2 className="animate-spin mx-auto text-[#F5A623]" size={32} />
                      )}
                    </div>
                    <div
                      data-testid="qris-countdown"
                      className="flex items-center justify-center gap-2 text-sm text-white/70"
                    >
                      <Clock size={15} className="text-[#F5A623]" />
                      Bayar dalam{" "}
                      <span className="font-mono font-semibold gold-text">
                        {mm}:{ss}
                      </span>
                    </div>
                    <div
                      data-testid="qris-waiting"
                      className="flex items-center justify-center gap-2 text-xs text-white/50"
                    >
                      <Loader2 className="animate-spin" size={13} />
                      Menunggu pembayaran...
                    </div>
                  </>
                )}
              </div>
            ) : form.payment_method === "qris" ? (
              paySettings.qris_url ? (
                <div className="text-center">
                  <img
                    src={resolveImageUrl(paySettings.qris_url)}
                    alt="QRIS"
                    data-testid="qris-image"
                    className="mx-auto max-w-[260px] w-full rounded-xl border border-white/10 bg-white p-3"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                  <p className="text-xs text-white/50 mt-2">
                    Scan QRIS di atas dengan aplikasi e-wallet/bank kamu.
                  </p>
                </div>
              ) : (
                <div className="text-center text-white/55 text-sm py-6 border border-dashed border-white/10 rounded-xl">
                  Admin belum mengatur QRIS. Hubungi admin untuk metode pembayaran lain.
                </div>
              )
            ) : (
              <div className="space-y-2" data-testid="bank-info">
                {(paySettings.bank_accounts || []).length === 0 ? (
                  <div className="text-center text-white/55 text-sm py-6 border border-dashed border-white/10 rounded-xl">
                    Admin belum mengatur rekening. Hubungi admin.
                  </div>
                ) : (
                  (paySettings.bank_accounts || []).map((b, i) => (
                    <div
                      key={i}
                      data-testid={`bank-account-${i}`}
                      className="rounded-xl border border-[#F5A623]/30 bg-[#F5A623]/5 p-4 space-y-1"
                    >
                      <div className="flex justify-between text-sm">
                        <span className="text-white/55">Bank</span>
                        <b className="text-white">{b.bank_name}</b>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-white/55">No. Rekening</span>
                        <b className="font-mono gold-text text-base">{b.account_number}</b>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/55">Atas Nama</span>
                        <b className="text-white">{b.holder}</b>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="text-white/55 text-sm">Total Bayar</span>
              <div className="text-right">
                <span className="font-display text-xl gold-text font-semibold">{formatIDR(autoTotal)}</span>
                {form.payment_method === "qris_otomatis" && autoData?.pakasir_fee > 0 && (
                  <div className="text-[10px] text-white/40">termasuk biaya admin {formatIDR(autoData.pakasir_fee)}</div>
                )}
              </div>
            </div>

            {form.payment_method !== "qris_otomatis" && (
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  onClick={() => setStep("form")}
                  data-testid="back-to-form-btn"
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/15"
                >
                  Kembali
                </Button>
                <Button
                  type="button"
                  onClick={confirmPayment}
                  disabled={loading}
                  data-testid="confirm-payment-btn"
                  className="flex-1 bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
                >
                  {loading ? <Loader2 className="animate-spin" size={16} /> : "Saya Sudah Bayar"}
                </Button>
              </div>
            )}
          </div>
        )}

        {step === "success" && (
          <div className="py-2" data-testid="order-success">
            {/* Big animated checkmark */}
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-[#10b981]/30 to-[#10b981]/10 border-2 border-[#10b981]/40 flex items-center justify-center mb-4 animate-in zoom-in duration-500">
              {autoPaid ? (
                <ShieldCheck className="text-[#10b981]" size={42} strokeWidth={2.5} />
              ) : (
                <CheckCircle2 className="text-[#10b981]" size={42} strokeWidth={2.5} />
              )}
            </div>
            <h3
              className="font-display text-2xl sm:text-3xl text-center gold-text font-semibold"
              data-testid="success-title"
            >
              Terima Kasih, Sobat Creative! 🎉
            </h3>
            <p className="text-white/70 text-sm text-center mt-1.5">
              {autoPaid
                ? "Pembayaran terverifikasi otomatis. Pesananmu akan segera diproses."
                : "Pesanan kamu sudah kami terima."}
            </p>

            {/* Order details card */}
            <div
              data-testid="order-details-card"
              className="mt-5 rounded-xl bg-[#0f1117] border border-white/10 divide-y divide-white/5"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs uppercase tracking-widest text-white/45">Order ID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm gold-text font-semibold" data-testid="order-code-display">
                    {orderCode}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(orderCode);
                      toast.success("Order ID disalin ✓");
                    }}
                    className="text-white/50 hover:text-[#F5A623] transition-colors"
                    data-testid="copy-order-code-btn"
                    title="Salin"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs uppercase tracking-widest text-white/45">Produk</span>
                <span className="text-sm text-white/85 text-right max-w-[60%] truncate">{product.name}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs uppercase tracking-widest text-white/45">Total Bayar</span>
                <span className="text-sm text-white font-semibold">{formatIDR(autoTotal)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs uppercase tracking-widest text-white/45">Metode</span>
                <span className="text-sm text-white/85 uppercase">
                  {form.payment_method === "qris_otomatis" ? "QRIS Otomatis" : form.payment_method}
                </span>
              </div>
            </div>

            {/* Instructions */}
            <p className="text-xs sm:text-sm text-white/60 text-center mt-4 leading-relaxed px-2">
              {autoPaid ? (
                <>Pesananmu akan diproses dalam 1×24 jam hari kerja. Pantau status di halaman <b>Lacak Pesanan</b> ya! 🚀</>
              ) : (
                <>Mohon tunggu konfirmasi admin via <b>WhatsApp/Telegram</b>. Pantau status di halaman <b>Lacak Pesanan</b> ya! 🚀</>
              )}
            </p>

            {/* Action buttons */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <a
                href="/lacak-pesanan"
                data-testid="track-order-btn"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] text-sm font-semibold transition-colors"
              >
                <PackageSearch size={15} /> Lacak Pesanan
              </a>
              <button
                type="button"
                onClick={() => handleClose(false)}
                data-testid="back-to-store-btn"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium border border-white/10 transition-colors"
              >
                <Store size={15} /> Kembali ke Toko
              </button>
            </div>

            {/* Referral CTA */}
            <div
              data-testid="referral-cta-card"
              className="mt-4 bg-[#F5A623]/8 border border-[#F5A623]/30 rounded-xl p-3 text-left"
            >
              <div className="flex items-start gap-2.5">
                <div className="text-xl leading-none">💝</div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-sm text-white">Suka produk CreativeStore?</div>
                  <p className="text-[11px] text-white/65 mt-0.5 leading-relaxed">
                    Ajak teman kamu dan dapatkan komisi <b className="text-[#F5A623]">10-15%</b> untuk setiap pembelian!
                  </p>
                  <a
                    href="/partnership"
                    className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-[#F5A623] hover:text-[#d98f1a]"
                  >
                    Daftar sebagai Affiliate →
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
