import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";

/**
 * ObjectPositionPicker — 3×3 grid selector for CSS object-position with
 * optional AI Auto-Suggest via Gemini Vision (only shown when `imageUrl` given).
 *
 * Props:
 *   - value: string (current position)
 *   - onChange: (newVal: string) => void
 *   - previewImage: URL used both for preview <img> and AI analysis
 *   - testIdPrefix: prefix for data-testid
 */
const CELLS = [
  ["top left", "↖"],
  ["top center", "↑"],
  ["top right", "↗"],
  ["center left", "←"],
  ["center center", "✦"],
  ["center right", "→"],
  ["bottom left", "↙"],
  ["bottom center", "↓"],
  ["bottom right", "↘"],
];

export default function ObjectPositionPicker({ value, onChange, previewImage, testIdPrefix = "obj-pos" }) {
  const current = value || "center center";
  const [hover, setHover] = useState(null);
  const [aiSuggested, setAiSuggested] = useState(null); // "top left" | null
  const [aiReason, setAiReason] = useState("");
  const [loading, setLoading] = useState(false);
  const displayed = hover || current;

  const handleManualClick = (pos) => {
    onChange(pos);
    // Kalau admin klik manual, hilangkan label "Disarankan AI"
    if (aiSuggested && pos !== aiSuggested) {
      setAiSuggested(null);
      setAiReason("");
    }
  };

  const runAI = async () => {
    if (!previewImage) {
      toast.error("Upload atau isi URL gambar dulu ya, Sobat Creative 📸");
      return;
    }
    setLoading(true);
    try {
      // Kirim path relatif kalau server-upload, atau URL absolut
      let img = previewImage;
      const BE = process.env.REACT_APP_BACKEND_URL || "";
      if (img.startsWith(BE + "/api/uploads/")) img = img.substring(BE.length);
      const res = await api.post("/admin/ai/suggest-image-position", { image_url: img });
      const pos = res.data?.position || "center center";
      const reason = res.data?.reason || "";
      onChange(pos);
      setAiSuggested(pos);
      setAiReason(reason);
      toast.success(`AI menyarankan: ${pos} ✨`);
    } catch (e) {
      const msg = e?.response?.data?.detail || "";
      if (msg.includes("GEMINI_API_KEY")) {
        toast.error("API key belum dikonfigurasi");
      } else {
        toast.error("Gagal analisa, pilih posisi manual ya 🙏");
      }
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    onChange("center center");
    setAiSuggested(null);
    setAiReason("");
  };

  return (
    <div className="space-y-2" data-testid={`${testIdPrefix}-container`}>
      <div className="flex items-start gap-3">
        {/* 3x3 grid */}
        <div className="flex flex-col gap-2">
          <div
            className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#0f1117] border border-white/10"
            role="radiogroup"
            aria-label="Pilih posisi gambar"
          >
            {CELLS.map(([pos, icon]) => {
              const selected = current === pos;
              const isAI = aiSuggested === pos && selected;
              return (
                <button
                  key={pos}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`${testIdPrefix}-${pos.replace(/\s+/g, "-")}`}
                  onClick={() => handleManualClick(pos)}
                  onMouseEnter={() => setHover(pos)}
                  onMouseLeave={() => setHover(null)}
                  title={pos + (isAI ? " (disarankan AI)" : "")}
                  className={`relative w-7 h-7 rounded flex items-center justify-center text-sm transition-all ${
                    selected
                      ? "bg-[#F5A623] text-[#0f1117] font-bold shadow-[0_0_0_2px_rgba(245,166,35,0.35)]"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {icon}
                  {isAI && (
                    <span
                      data-testid={`${testIdPrefix}-ai-badge`}
                      className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-purple-500 border border-[#0f1117] flex items-center justify-center"
                    >
                      <Sparkles size={7} className="text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={runAI}
              disabled={loading || !previewImage}
              data-testid={`${testIdPrefix}-ai-btn`}
              title={!previewImage ? "Isi gambar dulu" : "Analisa AI"}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-[#F5A623]/15 hover:bg-[#F5A623]/25 border border-[#F5A623]/40 text-[#F5A623] text-[10px] font-semibold uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 size={11} className="animate-spin" />
                  <span>Analisa…</span>
                </>
              ) : (
                <>
                  <Sparkles size={11} />
                  <span>Auto AI</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={reset}
              data-testid={`${testIdPrefix}-reset-btn`}
              title="Reset ke center center"
              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/15 text-white/70 text-[10px] font-semibold uppercase tracking-wider transition-colors"
            >
              <RotateCcw size={11} />
              Reset
            </button>
          </div>
        </div>

        {/* Live preview */}
        {previewImage ? (
          <div
            className="flex-1 aspect-[16/9] rounded-lg overflow-hidden bg-[#0a0c12] border border-white/10 relative"
            data-testid={`${testIdPrefix}-preview`}
          >
            <img
              src={previewImage}
              alt="Position preview"
              className="w-full h-full object-cover transition-all duration-300"
              style={{ objectPosition: displayed }}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-mono text-white/70">
              {displayed}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center px-2 text-xs text-white/50">
            Upload/isi URL gambar dulu untuk preview.
            <br />
            Terpilih: <b className="text-[#F5A623] ml-1">{current}</b>
          </div>
        )}
      </div>

      {/* AI Reason tooltip */}
      {aiSuggested && aiReason && aiSuggested === current && (
        <div
          data-testid={`${testIdPrefix}-ai-reason`}
          className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-[11px] text-purple-200 leading-relaxed"
        >
          <Sparkles size={11} className="mt-0.5 flex-shrink-0 text-purple-400" />
          <span>
            <b className="text-purple-300">AI menyarankan posisi ini karena:</b> {aiReason}
          </span>
        </div>
      )}
    </div>
  );
}
