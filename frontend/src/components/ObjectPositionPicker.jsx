import { useState } from "react";

/**
 * ObjectPositionPicker — 3×3 grid selector for CSS object-position.
 * Value: one of "top left" | "top center" | "top right" |
 *              "center left" | "center center" | "center right" |
 *              "bottom left" | "bottom center" | "bottom right"
 *
 * Props:
 *   - value: string
 *   - onChange: (newVal: string) => void
 *   - previewImage: optional URL for live preview
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
  const displayed = hover || current;

  return (
    <div className="space-y-2" data-testid={`${testIdPrefix}-container`}>
      <div className="flex items-start gap-3">
        {/* 3x3 grid */}
        <div
          className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#0f1117] border border-white/10"
          role="radiogroup"
          aria-label="Pilih posisi gambar"
        >
          {CELLS.map(([pos, icon]) => {
            const selected = current === pos;
            return (
              <button
                key={pos}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`${testIdPrefix}-${pos.replace(/\s+/g, "-")}`}
                onClick={() => onChange(pos)}
                onMouseEnter={() => setHover(pos)}
                onMouseLeave={() => setHover(null)}
                title={pos}
                className={`w-7 h-7 rounded flex items-center justify-center text-sm transition-all ${
                  selected
                    ? "bg-[#F5A623] text-[#0f1117] font-bold shadow-[0_0_0_2px_rgba(245,166,35,0.35)]"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {icon}
              </button>
            );
          })}
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
    </div>
  );
}
