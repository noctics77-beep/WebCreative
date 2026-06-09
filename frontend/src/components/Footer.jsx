export default function Footer() {
  return (
    <footer
      data-testid="footer"
      className="mt-24 border-t border-white/5 bg-[#0a0c12]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-3">
        <p className="text-sm text-white/50">
          © {new Date().getFullYear()}{" "}
          <span className="gold-text font-semibold">CreativeStore</span> — Digital
          goods marketplace.
        </p>
        <p className="text-xs uppercase tracking-[0.25em] text-white/30">
          Access • Premium • Trusted
        </p>
      </div>
    </footer>
  );
}
