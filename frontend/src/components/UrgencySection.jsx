import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, AlertTriangle, ArrowRight } from "lucide-react";
import SocialProof from "@/components/SocialProof";

const LS_KEY = "cs_urgency_deadline";
const DURATION = 24 * 60 * 60 * 1000; // 24 hours

function getOrCreateDeadline() {
  const raw = localStorage.getItem(LS_KEY);
  const now = Date.now();
  if (raw) {
    const ts = parseInt(raw, 10);
    if (!isNaN(ts) && ts > now) return ts;
  }
  const next = now + DURATION;
  localStorage.setItem(LS_KEY, String(next));
  return next;
}

function diffParts(ms) {
  const clamped = Math.max(0, ms);
  const d = Math.floor(clamped / (1000 * 60 * 60 * 24));
  const h = Math.floor((clamped / (1000 * 60 * 60)) % 24);
  const m = Math.floor((clamped / (1000 * 60)) % 60);
  const s = Math.floor((clamped / 1000) % 60);
  return { d, h, m, s };
}

const BULLETS = [
  { icon: <Flame size={16} />, text: "Komisi 10–15% langsung masuk saldo kamu setiap ada penjualan" },
  { icon: <Flame size={16} />, text: "Tanpa modal, tanpa ribet — cukup sebar link dan hasilkan" },
  { icon: <Flame size={16} />, text: "Produk AI paling dicari saat ini, permintaan terus naik" },
  { icon: <AlertTriangle size={16} />, text: "Slot affiliate aktif kami batasi untuk menjaga kualitas mitra" },
  { icon: <AlertTriangle size={16} />, text: "Yang daftar hari ini dapat prioritas support dari admin" },
];

export default function UrgencySection() {
  const [deadline, setDeadline] = useState(() => getOrCreateDeadline());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => {
      const current = Date.now();
      if (current >= deadline) {
        // reset for another 24h
        const next = current + DURATION;
        localStorage.setItem(LS_KEY, String(next));
        setDeadline(next);
      }
      setNow(current);
    }, 1000);
    return () => clearInterval(tick);
  }, [deadline]);

  const { d, h, m, s } = diffParts(deadline - now);

  return (
    <section
      data-testid="urgency-section"
      className="relative overflow-hidden py-20 md:py-28"
    >
      {/* glow background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#F5A623]/10 blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-300 text-[11px] uppercase tracking-[0.25em] mb-6">
          <AlertTriangle size={12} /> Slot Terbatas
        </div>

        <h2
          data-testid="urgency-headline"
          className="font-display text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05]"
        >
          Jangan Sampai Kamu
          <br />
          <span className="gold-text font-semibold">Menyesal</span> Melewatkan Ini
        </h2>

        <p className="text-white/60 text-base md:text-lg mt-6 max-w-2xl mx-auto leading-relaxed">
          Ratusan orang sudah mulai menghasilkan dari CreativeStore. Slot partner
          kami <b className="text-white">terbatas</b> — dan kami{" "}
          <b className="text-white">tidak membuka ini selamanya</b>.
        </p>

        {/* Social Proof */}
        <div className="mt-10">
          <SocialProof />
        </div>

        {/* Countdown */}
        <div className="mt-10">
          <p className="text-sm md:text-base text-white/70 mb-4 flex items-center justify-center gap-2">
            <span className="text-xl">⏰</span> Penawaran spesial komisi 15% berakhir dalam:
          </p>
          <div
            data-testid="countdown-timer"
            className="flex items-center justify-center gap-2 md:gap-4"
          >
            <TimeBox value={d} label="Hari" testId="countdown-days" />
            <Colon />
            <TimeBox value={h} label="Jam" testId="countdown-hours" />
            <Colon />
            <TimeBox value={m} label="Menit" testId="countdown-minutes" />
            <Colon />
            <TimeBox value={s} label="Detik" testId="countdown-seconds" />
          </div>
        </div>

        {/* Bullets */}
        <div className="mt-12 grid sm:grid-cols-2 gap-3 max-w-3xl mx-auto text-left">
          {BULLETS.map((b, i) => (
            <div
              key={i}
              data-testid={`urgency-bullet-${i}`}
              className="flex items-start gap-3 glass rounded-xl px-4 py-3"
            >
              <span className="shrink-0 w-8 h-8 rounded-lg bg-[#F5A623]/15 text-[#F5A623] flex items-center justify-center">
                {b.icon}
              </span>
              <span className="text-sm text-white/80 leading-snug">{b.text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12">
          <Link
            to="/partnership"
            data-testid="urgency-cta-btn"
            className="inline-flex items-center gap-2 bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold px-7 py-4 rounded-full text-base md:text-lg gold-glow transition-all hover:scale-[1.02]"
          >
            Daftar Sekarang Sebelum Slot Penuh
            <ArrowRight size={18} />
          </Link>
          <p className="text-xs text-white/40 mt-3 italic">
            *Pendaftaran bisa ditutup kapan saja tanpa pemberitahuan
          </p>
        </div>
      </div>
    </section>
  );
}

const TimeBox = ({ value, label, testId }) => (
  <div
    className="flex flex-col items-center bg-[#0a0c12] border border-[#F5A623]/30 rounded-xl px-3 md:px-5 py-3 md:py-4 min-w-[64px] md:min-w-[92px]"
  >
    <span
      data-testid={testId}
      className="font-display font-bold text-3xl md:text-5xl gold-text tabular-nums leading-none"
    >
      {String(value).padStart(2, "0")}
    </span>
    <span className="mt-2 text-[10px] md:text-xs uppercase tracking-[0.2em] text-white/50">
      {label}
    </span>
  </div>
);

const Colon = () => (
  <span className="font-display text-2xl md:text-4xl text-[#F5A623]/40 leading-none -mt-3 md:-mt-5">
    :
  </span>
);
