import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { Wrench, MessageCircle, Send } from "lucide-react";

/**
 * MaintenanceGate — jika `enabled=true` di /api/maintenance, tampilkan halaman
 * maintenance untuk semua pengunjung KECUALI path /admin. Admin bisa akses
 * panel untuk mematikan mode.
 */
export default function MaintenanceGate({ children }) {
  const [state, setState] = useState({ loading: true, config: null });
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    api
      .get("/maintenance")
      .then((r) => mounted && setState({ loading: false, config: r.data }))
      .catch(() => mounted && setState({ loading: false, config: null }));
    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  if (state.loading) return children;
  const cfg = state.config;
  const isAdminRoute = location.pathname.startsWith("/admin");
  if (!cfg?.enabled || isAdminRoute) return children;

  return (
    <div
      data-testid="maintenance-screen"
      className="min-h-screen flex items-center justify-center px-6 py-12 bg-gradient-to-b from-[#0a0c12] via-[#0f1117] to-[#0a0c12]"
    >
      <div className="max-w-lg w-full text-center">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-[#F5A623]/10 border border-[#F5A623]/30 flex items-center justify-center mb-6 animate-pulse">
          <Wrench className="text-[#F5A623]" size={36} />
        </div>
        <h1 className="font-display text-3xl sm:text-4xl mb-3">
          Sedang Dalam <span className="gold-text">Pemeliharaan</span> 🛠️
        </h1>
        <p className="text-white/70 text-sm sm:text-base leading-relaxed mb-6">
          {cfg.message || "Kami sedang melakukan peningkatan layanan untuk Sobat Creative. Mohon tunggu sebentar ya! 🙏"}
        </p>
        {cfg.estimated_finish && (
          <div
            data-testid="maintenance-eta"
            className="inline-block px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-white/60 mb-6"
          >
            <span className="text-white/40">Estimasi selesai: </span>
            <span className="text-[#F5A623] font-semibold">{cfg.estimated_finish}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-3 justify-center mt-4">
          {cfg.contact_wa && (
            <a
              href={`https://wa.me/${cfg.contact_wa.replace(/[^\d]/g, "")}`}
              target="_blank"
              rel="noreferrer"
              data-testid="maintenance-wa-link"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#25D366]/15 border border-[#25D366]/40 text-[#25D366] text-sm hover:bg-[#25D366]/25 transition-colors"
            >
              <MessageCircle size={15} /> WhatsApp
            </a>
          )}
          {cfg.contact_telegram && (
            <a
              href={`https://t.me/${cfg.contact_telegram.replace(/^@/, "")}`}
              target="_blank"
              rel="noreferrer"
              data-testid="maintenance-tg-link"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0088cc]/15 border border-[#0088cc]/40 text-[#3aa3ff] text-sm hover:bg-[#0088cc]/25 transition-colors"
            >
              <Send size={15} /> Telegram
            </a>
          )}
        </div>
        <p className="text-white/30 text-xs mt-8">
          &copy; CreativeStore — kembali sebentar lagi 💛
        </p>
      </div>
    </div>
  );
}
