import { useEffect, useState } from "react";

/**
 * BannerCountdown — digital clock style countdown JJ:MM:DD.
 * Props:
 *   - target: ISO datetime string (deadline)
 *   - onExpire: () => void (called sekali saat expired)
 */
function calcRemain(targetMs) {
  const now = Date.now();
  const diff = Math.max(0, targetMs - now);
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { diff, hours, minutes, seconds };
}

export default function BannerCountdown({ target, onExpire }) {
  const targetMs = target ? new Date(target).getTime() : 0;
  const [state, setState] = useState(() => calcRemain(targetMs));

  useEffect(() => {
    if (!targetMs) return;
    const t = setInterval(() => {
      const next = calcRemain(targetMs);
      setState(next);
      if (next.diff <= 0) {
        clearInterval(t);
        if (onExpire) onExpire();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [targetMs, onExpire]);

  if (!targetMs) return null;

  if (state.diff <= 0) {
    return (
      <div
        data-testid="banner-countdown-expired"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold"
      >
        ⏰ Promo Telah Berakhir
      </div>
    );
  }

  const pad = (n) => String(n).padStart(2, "0");

  return (
    <div
      data-testid="banner-countdown"
      className="inline-flex items-center gap-2 text-white/90"
    >
      <span className="text-[10px] sm:text-xs uppercase tracking-widest text-white/60">
        ⏱️ Berakhir dalam:
      </span>
      <div className="flex items-center gap-1">
        <Unit value={pad(state.hours)} label="Jam" />
        <span className="text-[#F5A623] font-mono font-bold text-sm animate-pulse">:</span>
        <Unit value={pad(state.minutes)} label="Menit" />
        <span className="text-[#F5A623] font-mono font-bold text-sm animate-pulse">:</span>
        <Unit value={pad(state.seconds)} label="Detik" />
      </div>
    </div>
  );
}

function Unit({ value, label }) {
  return (
    <div className="flex flex-col items-center min-w-[2rem]">
      <span
        className="tabular-nums font-mono font-bold text-sm sm:text-base text-[#F5A623] bg-black/50 border border-[#F5A623]/40 rounded px-1.5 py-0.5 leading-none"
        style={{ transition: "transform 150ms ease" }}
      >
        {value}
      </span>
      <span className="text-[8px] text-white/50 uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}
