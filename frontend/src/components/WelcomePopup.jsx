import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { X, Sparkles, ArrowRight } from "lucide-react";

const STORAGE_KEY = "cs_visited";

export default function WelcomePopup() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Skip popup on admin & tracking pages to avoid blocking login / status views
    if (location.pathname.startsWith("/admin") || location.pathname.startsWith("/lacak-pesanan")) return;
    const visited = localStorage.getItem(STORAGE_KEY);
    if (visited) return;
    const t = setTimeout(() => setOpen(true), 2000);
    return () => clearTimeout(t);
  }, [location.pathname]);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  const shop = () => {
    close();
    setTimeout(() => {
      document.querySelector("#products")?.scrollIntoView({ behavior: "smooth" });
    }, 200);
  };

  if (!open) return null;

  return (
    <div
      data-testid="welcome-popup-overlay"
      className="fixed inset-0 z-[2147483646] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 welcome-fade-in"
      onClick={close}
    >
      <div
        data-testid="welcome-popup"
        onClick={(e) => e.stopPropagation()}
        className="welcome-scale-in relative bg-[#1a1d27] border border-[#F5A623]/40 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8"
      >
        <button
          data-testid="welcome-close"
          onClick={close}
          className="absolute top-3 right-3 p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10"
        >
          <X size={16} />
        </button>

        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#F5A623]/15 border border-[#F5A623]/30 text-[#F5A623] mb-4">
            <Sparkles size={26} />
          </div>
          <h2 className="font-display text-2xl md:text-3xl leading-tight mb-1">
            Selamat Datang di <span className="gold-text">CreativeStore</span>! 🎉
          </h2>
          <p className="text-sm text-white/60 mb-4">Digital goods premium, harga terjangkau</p>
          <p className="text-sm text-white/75 leading-relaxed mb-6">
            Dapatkan info produk terbaru & promo eksklusif lebih dulu! Bergabung dengan ribuan{" "}
            <span className="text-[#F5A623] font-semibold">Sobat Creative</span> kami 💛
          </p>

          <button
            data-testid="welcome-cta"
            onClick={shop}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold px-5 py-3 rounded-full transition-colors"
          >
            Lihat Produk Sekarang <ArrowRight size={16} />
          </button>

          <button
            data-testid="welcome-skip"
            onClick={close}
            className="mt-3 text-xs text-white/50 hover:text-white/80"
          >
            Lewati
          </button>
        </div>
      </div>
    </div>
  );
}
