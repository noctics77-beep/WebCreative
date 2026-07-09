import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ChevronDown, HelpCircle } from "lucide-react";

export default function FAQ() {
  const [items, setItems] = useState([]);
  const [openIdx, setOpenIdx] = useState(0);

  useEffect(() => {
    api.get("/faqs").then((r) => setItems(r.data)).catch(() => setItems([]));
  }, []);

  return (
    <div data-testid="faq-page" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#F5A623]/15 border border-[#F5A623]/30 text-[#F5A623] mb-4">
          <HelpCircle size={26} />
        </div>
        <h1 className="font-display text-4xl md:text-5xl">Pertanyaan Umum</h1>
        <p className="text-white/60 mt-3">Semua yang perlu Sobat Creative ketahui sebelum belanja 💫</p>
      </div>

      {items.length === 0 ? (
        <div className="text-center text-white/40 py-8">Belum ada FAQ.</div>
      ) : (
        <div className="space-y-3">
          {items.map((f, idx) => (
            <div
              key={f.id}
              data-testid={`faq-item-${idx}`}
              className="bg-[#1a1d27]/70 border border-white/5 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIdx(openIdx === idx ? -1 : idx)}
                className="w-full flex items-center justify-between text-left px-5 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <span className="font-medium text-white pr-4">{f.question}</span>
                <ChevronDown
                  size={18}
                  className={`flex-shrink-0 text-[#F5A623] transition-transform ${openIdx === idx ? "rotate-180" : ""}`}
                />
              </button>
              {openIdx === idx && (
                <div className="px-5 pb-5 pt-1 text-white/75 leading-relaxed whitespace-pre-line text-sm">
                  {f.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
