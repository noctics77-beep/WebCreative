import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

/**
 * Parses a stat string like "243+" / "89+" / "4.9/5"
 * into { target:Number, prefix:String, suffix:String, decimals:Number }
 */
function parseStat(value) {
  const str = String(value ?? "").trim();
  const match = str.match(/^([^\d-]*)(-?\d+(?:\.\d+)?)(.*)$/);
  if (!match) return { target: 0, prefix: "", suffix: str, decimals: 0 };
  const [, prefix, num, suffix] = match;
  const decimals = num.includes(".") ? num.split(".")[1].length : 0;
  return { target: parseFloat(num), prefix, suffix, decimals };
}

function CountUp({ value, duration = 1400 }) {
  const { target, prefix, suffix, decimals } = parseStat(value);
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            const start = performance.now();
            const tick = (t) => {
              const p = Math.min(1, (t - start) / duration);
              // easeOutCubic
              const eased = 1 - Math.pow(1 - p, 3);
              setDisplay(target * eased);
              if (p < 1) requestAnimationFrame(tick);
              else setDisplay(target);
            };
            requestAnimationFrame(tick);
          }
        });
      },
      { threshold: 0.3 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

export default function SocialProof() {
  const [stats, setStats] = useState({
    products_sold: "243+",
    active_partners: "89+",
    rating: "4.9/5",
  });

  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const items = [
    { value: stats.products_sold, label: "Produk Terjual", testId: "stat-products-sold" },
    { value: stats.active_partners, label: "Mitra Aktif", testId: "stat-active-partners" },
    { value: stats.rating, label: "Rating Kepuasan", testId: "stat-rating" },
  ];

  return (
    <div
      data-testid="social-proof"
      className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-5 max-w-3xl mx-auto"
    >
      {items.map((it, i) => (
        <div
          key={i}
          data-testid={it.testId}
          className={`glass rounded-2xl px-4 py-5 md:py-6 border border-[#F5A623]/15 ${
            i === 2 ? "col-span-2 sm:col-span-1" : ""
          }`}
        >
          <div className="font-display font-bold text-3xl md:text-4xl gold-text tabular-nums leading-none">
            <CountUp value={it.value} />
          </div>
          <div className="mt-2 text-[11px] md:text-xs uppercase tracking-[0.2em] text-white/55">
            {it.label}
          </div>
        </div>
      ))}
    </div>
  );
}
