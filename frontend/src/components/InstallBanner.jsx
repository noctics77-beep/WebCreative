import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const STORAGE_KEY = "cs_install_dismissed";
const READY_TIME_MS = 30000; // 30 detik browsing dulu

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    // Already installed / standalone mode?
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Delay show until user has browsed ≥30s
      const shownAt = parseInt(sessionStorage.getItem("cs_session_start") || "0", 10);
      if (!shownAt) {
        sessionStorage.setItem("cs_session_start", String(Date.now()));
        setTimeout(() => setVisible(true), READY_TIME_MS);
      } else {
        const elapsed = Date.now() - shownAt;
        if (elapsed >= READY_TIME_MS) setVisible(true);
        else setTimeout(() => setVisible(true), READY_TIME_MS - elapsed);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    setDeferredPrompt(null);
    setVisible(false);
  };

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  if (!visible || !deferredPrompt) return null;

  return (
    <div
      data-testid="install-banner"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-40 bg-[#1a1d27] border border-[#F5A623]/40 rounded-xl shadow-2xl p-3 flex items-center gap-3 animate-in slide-in-from-bottom duration-500"
    >
      <div className="w-10 h-10 rounded-lg bg-[#F5A623]/15 border border-[#F5A623]/40 flex items-center justify-center flex-shrink-0">
        <Download className="text-[#F5A623]" size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white font-semibold">📱 Install CreativeStore di HP kamu!</p>
        <p className="text-[10px] text-white/60 mt-0.5">Akses cepat seperti aplikasi native.</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          data-testid="install-btn"
          onClick={install}
          className="px-3 py-1.5 rounded-md bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] text-xs font-semibold"
        >
          Install
        </button>
        <button
          type="button"
          data-testid="install-dismiss"
          onClick={dismiss}
          aria-label="Nanti saja"
          className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded-md"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
