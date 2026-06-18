import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

const DEFAULT_NAMES = ["Andi", "Budi", "Cinta", "Dewi", "Eka", "Joko", "Maya", "Rina"];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export default function LiveFeed() {
  const [enabled, setEnabled] = useState(true);
  const [names, setNames] = useState(DEFAULT_NAMES);
  const [products, setProducts] = useState([]);
  const [active, setActive] = useState(null);
  const timeoutsRef = useRef([]);

  useEffect(() => {
    Promise.all([api.get("/stats"), api.get("/products")]).then(([s, p]) => {
      setEnabled(s.data.live_feed_enabled !== false);
      const n = Array.isArray(s.data.live_feed_names) && s.data.live_feed_names.length
        ? s.data.live_feed_names
        : DEFAULT_NAMES;
      setNames(n);
      setProducts(p.data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (names.length === 0) return;

    const buildMessage = () => {
      const variants = [
        () => `🟢 ${pick(names)} baru saja membeli ${products.length ? pick(products).name : "produk premium"}`,
        () => `🟢 ${Math.floor(Math.random() * 30) + 8} orang sedang melihat produk ini`,
        () => `🟢 ${pick(names)} baru saja bergabung sebagai affiliate`,
      ];
      return pick(variants)();
    };

    const schedule = () => {
      const showDelay = 1500 + Math.random() * 800; // initial wait
      const t1 = setTimeout(() => {
        setActive({ text: buildMessage(), id: Date.now() });
        const t2 = setTimeout(() => {
          setActive(null);
          const gap = 8000 + Math.random() * 7000; // 8-15s
          const t3 = setTimeout(schedule, gap);
          timeoutsRef.current.push(t3);
        }, 4000);
        timeoutsRef.current.push(t2);
      }, showDelay);
      timeoutsRef.current.push(t1);
    };
    schedule();
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [enabled, names, products]);

  if (!enabled) return null;

  return (
    <div
      data-testid="live-feed"
      className="fixed bottom-5 left-5 z-30 pointer-events-none"
      aria-live="polite"
    >
      {active && (
        <div
          key={active.id}
          data-testid="live-feed-toast"
          className="live-feed-toast pointer-events-auto bg-[#1a1d27] border border-[#F5A623]/40 rounded-xl shadow-2xl px-4 py-3 max-w-[300px] text-sm text-white/90 flex items-start gap-2"
          style={{ boxShadow: "0 12px 40px -10px rgba(245,166,35,0.25)" }}
        >
          <span className="mt-0.5">{active.text.startsWith("🟢") ? "" : "🟢"}</span>
          <span>{active.text}</span>
        </div>
      )}
    </div>
  );
}
