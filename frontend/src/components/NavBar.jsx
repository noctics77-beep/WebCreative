import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_digital-goods-hub-14/artifacts/gqk3po8e_6109359171045101715.jpg";

const links = [
  { to: "/", label: "Storefront" },
  { to: "/partnership", label: "Partnership" },
  { to: "/loyalty", label: "Poin Harian" },
  { to: "/affiliate", label: "Affiliate" },
  { to: "/admin", label: "Admin" },
];

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-testid="navbar"
      className={`sticky top-0 z-40 transition-all ${
        scrolled
          ? "bg-[#0f1117]/85 backdrop-blur-xl border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link
          to="/"
          data-testid="logo-home-link"
          className="flex items-center gap-3"
        >
          <img
            src={LOGO_URL}
            alt="CreativeStore"
            className="h-10 w-10 rounded-md object-cover ring-1 ring-[#F5A623]/40"
          />
          <div className="leading-tight">
            <div className="font-display text-base tracking-wide">
              Creative<span className="gold-text font-semibold">Store</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">
              Access • Premium • Trusted
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              data-testid={`nav-${l.label.toLowerCase()}`}
              className={({ isActive }) =>
                `px-4 py-2 text-sm rounded-full transition-colors ${
                  isActive
                    ? "bg-[#F5A623]/10 text-[#F5A623]"
                    : "text-white/70 hover:text-white"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <button
          data-testid="menu-toggle"
          className="md:hidden p-2 text-white/80"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/5 bg-[#0f1117]">
          <div className="px-4 py-3 flex flex-col gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                onClick={() => setOpen(false)}
                data-testid={`mobile-nav-${l.label.toLowerCase()}`}
                className={({ isActive }) =>
                  `px-3 py-2 text-sm rounded-md ${
                    isActive
                      ? "bg-[#F5A623]/10 text-[#F5A623]"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
