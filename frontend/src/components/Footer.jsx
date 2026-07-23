import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Footer() {
  const [startYear, setStartYear] = useState("2021");
  useEffect(() => {
    api.get("/stats").then((r) => setStartYear(r.data.footer_start_year || "2021")).catch(() => {});
  }, []);

  const currentYear = new Date().getFullYear();
  const yearLabel = startYear && String(startYear) !== String(currentYear)
    ? `${startYear} - ${currentYear}`
    : String(startYear || currentYear);

  return (
    <footer
      data-testid="footer"
      className="mt-24 border-t border-white/5 bg-[#0a0c12]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-3">
        <p data-testid="footer-copyright" className="text-sm text-white/50">
          © {yearLabel}{" "}
          <span className="gold-text font-semibold">CreativeStore</span> — Digital
          goods marketplace.
        </p>
        <div className="flex items-center gap-5 flex-wrap justify-center">
          <a
            href="/faq"
            data-testid="footer-faq-link"
            className="text-xs text-white/60 hover:text-[#F5A623] transition-colors"
          >
            FAQ
          </a>
          <a
            href="/tentang"
            data-testid="footer-about-link"
            className="text-xs text-white/60 hover:text-[#F5A623] transition-colors"
          >
            Tentang Kami
          </a>
          <a
            href="/lacak-pesanan"
            data-testid="footer-track-link"
            className="text-xs text-white/60 hover:text-[#F5A623] transition-colors"
          >
            Lacak Pesanan
          </a>
          <a
            href="/testimoni"
            data-testid="footer-testimoni-link"
            className="text-xs text-white/60 hover:text-[#F5A623] transition-colors"
          >
            Testimoni
          </a>
          <p className="text-xs uppercase tracking-[0.25em] text-white/30 hidden md:block">
            Access • Premium • Trusted
          </p>
        </div>
      </div>
    </footer>
  );
}
