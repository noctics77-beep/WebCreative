import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, resolveImageUrl } from "@/lib/api";
import { ChevronLeft, ChevronRight } from "lucide-react";
import BannerCountdown from "@/components/BannerCountdown";

/**
 * BannerSlider — hero promo slider dengan auto-play, arrow, dots, dan swipe.
 * Data dari GET /api/banners (public, hanya banner active).
 */
export default function BannerSlider() {
  const [banners, setBanners] = useState([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [expiredMap, setExpiredMap] = useState({});
  const touchStartX = useRef(null);

  useEffect(() => {
    api
      .get("/banners")
      .then((r) => setBanners(Array.isArray(r.data) ? r.data : []))
      .catch(() => setBanners([]));
  }, []);

  const handleCtaClick = (e, b) => {
    // Kalau banner punya kupon aktif (dan belum expired), simpan ke sessionStorage
    if (b.linked_coupon_code && !expiredMap[b.id]) {
      try {
        sessionStorage.setItem("cs_pending_coupon", b.linked_coupon_code.toUpperCase());
        toast.success(`Kode ${b.linked_coupon_code.toUpperCase()} tersimpan! Akan otomatis terpakai saat kamu order 🎉`);
      } catch (_) { /* ignore */ }
    }
    // Kalau link mengarah ke #anchor di halaman ini, scroll smooth.
    if (typeof b.cta_link === "string" && b.cta_link.startsWith("#")) {
      e.preventDefault();
      const el = document.querySelector(b.cta_link);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const markExpired = (bannerId) => {
    setExpiredMap((prev) => (prev[bannerId] ? prev : { ...prev, [bannerId]: true }));
  };

  useEffect(() => {
    if (paused || banners.length < 2) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % banners.length);
    }, 4000);
    return () => clearInterval(t);
  }, [paused, banners.length]);

  if (banners.length === 0) return null;

  const next = () => setIdx((i) => (i + 1) % banners.length);
  const prev = () => setIdx((i) => (i - 1 + banners.length) % banners.length);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > 50) prev();
    else if (dx < -50) next();
    touchStartX.current = null;
  };

  return (
    <div
      data-testid="banner-slider"
      className="relative w-full max-w-6xl mx-auto rounded-2xl overflow-hidden select-none group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Slides */}
      <div
        className="relative aspect-[2/1] sm:aspect-[16/9] bg-[#0a0c12]"
        style={{ borderRadius: 16 }}
      >
        {banners.map((b, i) => (
          <div
            key={b.id}
            data-testid={`banner-slide-${i}`}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              i === idx ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          >
            {b.image_url ? (
              <img
                src={resolveImageUrl(b.image_url)}
                alt={b.title || "Banner"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#F5A623]/20 via-[#2a1f10] to-[#0a0c12]" />
            )}
            {/* Bottom gradient overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8 space-y-2">
              {b.title && (
                <h3
                  data-testid={`banner-title-${i}`}
                  className="font-display text-lg sm:text-2xl md:text-3xl text-white font-semibold drop-shadow"
                >
                  {b.title}
                </h3>
              )}
              {b.subtitle && (
                <p className="text-white/85 text-xs sm:text-sm md:text-base max-w-2xl drop-shadow">
                  {b.subtitle}
                </p>
              )}
              {b.expires_at && (
                <div className="pt-1">
                  <BannerCountdown target={b.expires_at} onExpire={() => markExpired(b.id)} />
                </div>
              )}
              {b.cta_text && b.cta_link && (
                <a
                  href={b.cta_link}
                  onClick={(e) => handleCtaClick(e, b)}
                  data-testid={`banner-cta-${i}`}
                  className="inline-flex items-center gap-1 mt-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] text-xs sm:text-sm font-semibold transition-colors"
                >
                  {b.cta_text} →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {banners.length > 1 && (
        <>
          {/* Arrows */}
          <button
            type="button"
            onClick={prev}
            data-testid="banner-prev-btn"
            aria-label="Previous"
            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-20"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={next}
            data-testid="banner-next-btn"
            aria-label="Next"
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-20"
          >
            <ChevronRight size={18} />
          </button>

          {/* Dots */}
          <div
            data-testid="banner-dots"
            className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20"
          >
            {banners.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                data-testid={`banner-dot-${i}`}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? "bg-[#F5A623] w-6" : "bg-white/40 hover:bg-white/60 w-1.5"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
