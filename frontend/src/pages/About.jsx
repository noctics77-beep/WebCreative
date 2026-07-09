import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Zap, ShieldCheck, Tag, MessageCircle, ArrowRight, Sparkles, Video, Shield, Play, Mail, Grid, Star, Clock, Users } from "lucide-react";

const ICON_MAP = {
  zap: Zap, shield: ShieldCheck, tag: Tag, "message-circle": MessageCircle,
  sparkles: Sparkles, video: Video, play: Play, mail: Mail, grid: Grid,
  star: Star, clock: Clock, users: Users,
};

export default function About() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/about").then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <div className="py-20 text-center text-white/40">Loading...</div>;

  return (
    <div data-testid="about-page" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#F5A623]/30 bg-[#F5A623]/10 text-[#F5A623] text-[11px] uppercase tracking-[0.25em] mb-5">
          <Sparkles size={12} /> Tentang Kami
        </div>
        <h1 className="font-display text-4xl md:text-6xl leading-tight">CreativeStore</h1>
        <p className="mt-3 text-lg text-white/70 italic">{data.tagline}</p>
      </div>

      <div className="space-y-4 text-white/80 leading-relaxed text-base md:text-lg max-w-3xl mx-auto">
        {(data.paragraphs || []).map((p, i) => <p key={i}>{p}</p>)}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-12">
        {(data.features || []).map((f, i) => {
          const Icon = ICON_MAP[f.icon] || Sparkles;
          return (
            <div
              key={i}
              data-testid={`about-feature-${i}`}
              className="bg-[#1a1d27]/70 border border-white/5 rounded-2xl p-5 flex items-start gap-4 hover-card-lift transition-transform"
            >
              <div className="w-12 h-12 rounded-xl bg-[#F5A623]/15 border border-[#F5A623]/30 flex items-center justify-center text-[#F5A623] flex-shrink-0">
                <Icon size={20} />
              </div>
              <div>
                <div className="font-display text-lg">{f.title}</div>
                <p className="text-sm text-white/60 mt-1">{f.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-12">
        <Link
          to="/"
          data-testid="about-cta-products"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#F5A623] hover:bg-[#d98f1a] text-[#0f1117] font-semibold"
        >
          Lihat Produk Kami <ArrowRight size={16} />
        </Link>
        <Link
          to="/partnership"
          data-testid="about-cta-partnership"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-white font-semibold"
        >
          Gabung Affiliate <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
