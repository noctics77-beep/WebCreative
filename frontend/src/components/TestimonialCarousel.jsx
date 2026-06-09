import { Star } from "lucide-react";

const TESTIMONIALS = [
  { name: "Rizal A.", role: "Affiliate", text: "Baru 2 minggu udah cair komisi 1,2jt. Linknya tinggal sebar di story IG, auto closing.", rating: 5 },
  { name: "Mira S.", role: "Reseller", text: "Margin reseller-nya gede banget. Stok aman, admin fast respon, langganan saya nambah terus.", rating: 5 },
  { name: "Bayu T.", role: "Pembeli", text: "Pesan ChatGPT Plus jam 10 malam, jam 10.05 udah dikirim. Garansinya beneran jalan.", rating: 5 },
  { name: "Putri W.", role: "Affiliate", text: "Modal 0 rupiah, sekarang udah jadi side income tetap. Gak nyangka segampang ini.", rating: 5 },
  { name: "Dani P.", role: "Pembeli", text: "Harga paling murah dibanding tempat lain, tapi kualitas akun premium banget. Worth it.", rating: 5 },
  { name: "Kiki H.", role: "Reseller", text: "Adminnya helpful, ada grup khusus reseller. Sistemnya udah dipikirin sampai detail.", rating: 5 },
  { name: "Yoga R.", role: "Affiliate", text: "Awal cuma iseng, eh ternyata cuan tiap minggu cair. Recommended buat yang mau side income.", rating: 5 },
  { name: "Tasya L.", role: "Pembeli", text: "Canva Pro 1 tahun cuma 80rb? Gila murahnya. Akun saya udah jalan 6 bulan masih aman.", rating: 5 },
];

export default function TestimonialCarousel() {
  // duplicate the list for seamless loop
  const items = [...TESTIMONIALS, ...TESTIMONIALS];

  return (
    <section
      data-testid="testimonials-section"
      className="relative overflow-hidden py-16 md:py-20 border-y border-white/5 bg-[#0a0c12]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#F5A623]/30 bg-[#F5A623]/10 text-[#F5A623] text-[11px] uppercase tracking-[0.25em] mb-4">
            Testimoni Asli
          </div>
          <h2 className="font-display text-3xl md:text-4xl">
            Mereka sudah <span className="gold-text">cuan & puas</span>
          </h2>
          <p className="text-white/55 text-sm mt-3">
            Ribuan transaksi sukses, ratusan affiliate aktif. Saatnya giliran kamu.
          </p>
        </div>
      </div>

      {/* Marquee track */}
      <div
        className="relative group"
        data-testid="testimonials-marquee"
      >
        {/* fade edges */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-16 md:w-32 z-10 bg-gradient-to-r from-[#0a0c12] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-16 md:w-32 z-10 bg-gradient-to-l from-[#0a0c12] to-transparent" />

        <div className="marquee-track flex gap-5 will-change-transform">
          {items.map((t, i) => (
            <article
              key={i}
              data-testid={`testimonial-card-${i}`}
              className="shrink-0 w-[300px] md:w-[360px] glass rounded-2xl p-5 md:p-6"
            >
              <div className="flex items-center gap-0.5 text-[#F5A623] mb-3">
                {[...Array(t.rating)].map((_, k) => (
                  <Star key={k} size={14} fill="currentColor" strokeWidth={0} />
                ))}
              </div>
              <p className="text-white/80 text-sm leading-relaxed">&ldquo;{t.text}&rdquo;</p>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#F5A623] to-[#7a4a0e] flex items-center justify-center font-display font-semibold text-sm text-[#0f1117]">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-[11px] uppercase tracking-widest text-white/40">{t.role}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
