import { useState } from "react";
import { MessageCircle, Link2, Check } from "lucide-react";
import { toast } from "sonner";

export default function ShareButtons({ product }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/produk/${product.slug || product.id}`
    : "";

  const shareText = `Hei! Cek produk ini di CreativeStore: ${product.name} — ${url} 🛍️ creativestore.my.id`;

  const shareWa = () => {
    const wa = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(wa, "_blank", "noopener");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link berhasil disalin! 🔗");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin link");
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-white/50 mr-1">Bagikan:</span>
      <button
        data-testid="share-wa"
        onClick={shareWa}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-[#25D366] text-xs font-medium transition-colors"
      >
        <MessageCircle size={13} /> WhatsApp
      </button>
      <button
        data-testid="share-copy"
        onClick={copyLink}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 text-xs font-medium transition-colors"
      >
        {copied ? <Check size={13} className="text-green-400" /> : <Link2 size={13} />}
        {copied ? "Tersalin!" : "Copy Link"}
      </button>
    </div>
  );
}
