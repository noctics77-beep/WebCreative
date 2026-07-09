import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Star, ShieldCheck, Clock, Users, MessageCircle } from "lucide-react";

export default function TrustBadges() {
  const [stats, setStats] = useState({
    trust_rating: "5.0",
    trust_transactions: "5000+",
    trust_since_year: "2021",
    trust_process_time: "1x24 Jam",
  });

  useEffect(() => {
    api.get("/stats").then((r) => setStats((s) => ({ ...s, ...r.data }))).catch(() => {});
  }, []);

  const badges = [
    {
      icon: <Star size={20} fill="currentColor" />,
      title: "Trusted Seller",
      desc: `Rating ${stats.trust_rating || "5.0"} ⭐`,
      shimmer: true,
    },
    {
      icon: <ShieldCheck size={20} />,
      title: "Pembayaran Aman",
      desc: "QRIS & Transfer Resmi",
    },
    {
      icon: <Clock size={20} />,
      title: "Proses Cepat",
      desc: `Pesanan ${stats.trust_process_time || "1x24 Jam"}`,
    },
    {
      icon: <Users size={20} />,
      title: `${stats.trust_transactions || "5000+"} Transaksi`,
      desc: `Sejak ${stats.trust_since_year || "2021"}`,
    },
    {
      icon: <MessageCircle size={20} />,
      title: "Support Responsif",
      desc: "Siap Bantu Kapanpun",
    },
  ];

  return (
    <section data-testid="trust-badges" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
      <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory md:grid md:grid-cols-5 md:overflow-visible pb-1">
        {badges.map((b, i) => (
          <div
            key={i}
            className={`snap-start flex-shrink-0 w-40 md:w-auto flex flex-col items-center text-center bg-[#1a1d27]/60 border border-[#F5A623]/25 rounded-xl px-4 py-4 backdrop-blur-sm transition-transform hover:scale-[1.02] ${b.shimmer ? "trust-badge-shimmer" : ""}`}
          >
            <span className="text-[#F5A623] mb-1.5">{b.icon}</span>
            <div className="font-display text-sm text-white">{b.title}</div>
            <div className="text-[11px] text-white/55 mt-0.5">{b.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
