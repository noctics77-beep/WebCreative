import { useState, useEffect, useRef } from "react";
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
import { api, formatIDR } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle2, Copy, Loader2, Clock, ShieldCheck, QrCode } from "lucide-react";

const PAYMENT_OPTIONS = [
  { value: "qris_otomatis", label: "QRIS Otomatis", icon: QrCode },
  { value: "qris", label: "QRIS Manual" },
  { value: "transfer", label: "Transfer Bank" },
];

export default function OrderModal({ open, onClose, product, referral }) {
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
    }
  }, [open]);

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
  const hasDiscount =
    product.discount_active && product.discount_price < product.original_price;
  const basePrice = hasDiscount ? product.discount_price : product.original_price;
  const finalPrice = discountInfo?.valid
    ? Math.round(basePrice * (1 - discountInfo.percentage / 100))
    : basePrice;

  const validateCode = async () => {
    const c = form.discount_code.trim().toUpperCase();
    if (!c) {
      setDiscountInfo(null);
      return;
    }
    try {
      const res = await api.get(`/discount/validate/${c}`);
      if (res.data.valid) {
        setDiscountInfo(res.data);
        toast.success(`Kode valid! Diskon ${res.data.percentage}%`);
      } else {
        setDiscountInfo({ valid: false });
        toast.error("Kode tidak valid atau sudah dipakai");
      }
    } catch {
      setDiscountInfo({ valid: false });
    }
  };

  const buildPayload = () => ({
    buyer_name: form.buyer_name,
    contact: form.contact,
    payment_method: form.payment_method,
    product_id: product.id,
    referral_affiliate_code: referral || null,
    discount_code: discountInfo?.valid ? form.discount_code.trim().toUpperCase() : null,
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.buyer_name.trim() || !form.contact.trim()) {
      toast.error("Mohon lengkapi nama dan kontak");
      return;
    }
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
                <Label className="text-xs uppercase tracking-widest text-white/60">Kode Diskon (opsional)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    data-testid="discount-code-input"
                    value={form.discount_code}
                    onChange={(e) => {
                      setForm({ ...form, discount_code: e.target.value });
                      setDiscountInfo(null);
                    }}
                    placeholder="DISC-XXXXXX"
                    className="bg-[#0f1117] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-[#F5A623]/30 focus-visible:border-[#F5A623] uppercase font-mono"
                  />
                  <Button
                    type="button"
                    data-testid="apply-discount-btn"
                    onClick={validateCode}
                    className="bg-white/10 hover:bg-white/15 text-white border border-white/15"
                  >
                    Pakai
                  </Button>
                </div>
                {discountInfo?.valid && (
                  <p className="text-xs text-green-400 mt-1" data-testid="discount-applied">
                    ✓ Diskon {discountInfo.percentage}% diterapkan
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-white/55 text-sm">Total Bayar</span>
                <div className="text-right">
                  {discountInfo?.valid && (
                    <div className="text-xs text-white/40 line-through">{formatIDR(basePrice)}</div>
                  )}
                  <span className="font-display text-xl gold-text font-semibold">{formatIDR(finalPrice)}</span>
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
                    src={paySettings.qris_url}
                    alt="QRIS"
                    data-testid="qris-image"
                    className="mx-auto max-w-[260px] w-full rounded-xl border border-white/10 bg-white p-3"
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
          <div className="text-center py-4" data-testid="order-success">
            <div
              className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3 ${
                autoPaid ? "bg-[#10b981]/15" : "bg-[#10b981]/15"
              }`}
            >
              {autoPaid ? (
                <ShieldCheck className="text-[#10b981]" size={28} />
              ) : (
                <CheckCircle2 className="text-[#10b981]" size={28} />
              )}
            </div>
            <h3 className="font-display text-2xl" data-testid="success-title">
              {autoPaid ? "Pembayaran Lunas! ✅" : "Pesanan Diterima!"}
            </h3>
            <p className="text-white/55 text-sm mt-1">
              {autoPaid
                ? "Pembayaran terverifikasi otomatis. Pesanan kamu akan segera diproses."
                : "Order ID kamu — simpan untuk konfirmasi pembayaran."}
            </p>
            <div className="my-5 mx-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0f1117] border border-[#F5A623]/40">
              <span className="font-mono text-lg gold-text" data-testid="order-code-display">
                {orderCode}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(orderCode);
                  toast.success("Order ID disalin");
                }}
                className="text-white/60 hover:text-[#F5A623]"
                data-testid="copy-order-code-btn"
              >
                <Copy size={15} />
              </button>
            </div>
            {!autoPaid && (
              <p className="text-sm text-white/60">
                Mohon tunggu konfirmasi admin via <b>WhatsApp / Telegram</b>.
              </p>
            )}
            <Button
              onClick={() => handleClose(false)}
              data-testid="close-order-success-btn"
              className="mt-5 bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
            >
              Tutup
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
