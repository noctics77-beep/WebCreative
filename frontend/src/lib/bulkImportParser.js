/**
 * Parse teks bulk import.
 * Return array of {name, price} tanpa duplikat.
 *
 * Format prefix yang dikenali (auto-strip):
 *   ⟥, -, •, *, >, #, +, 1., [nama], atau tanpa prefix
 *
 * Format harga (opsional, setelah nama dgn pemisah | atau :):
 *   150000 | 150.000 | Rp 150.000 | 150rb | 150K
 */
const PREFIX_REGEX = /^[^A-Za-z0-9\u00C0-\uFFFF\[]+/;
const NUM_PATTERN = /^([\d]+(?:[.,]\d+)*)\s*(rb|ribu|k|jt|juta)?$/i;

function parsePrice(raw) {
  if (!raw) return 0;
  let s = String(raw).trim().toLowerCase();
  // strip "Rp" prefix
  s = s.replace(/^rp\.?\s*/, "").replace(/[\s.,]*rp\.?\s*/, "").trim();
  const m = s.match(NUM_PATTERN);
  if (!m) {
    // Fallback: strip semua non-digit
    const cleaned = s.replace(/[^\d]/g, "");
    return cleaned ? parseInt(cleaned, 10) : 0;
  }
  let num = parseFloat(m[1].replace(/\./g, "").replace(/,/g, "."));
  const suffix = (m[2] || "").toLowerCase();
  if (suffix === "rb" || suffix === "ribu" || suffix === "k") num *= 1000;
  else if (suffix === "jt" || suffix === "juta") num *= 1_000_000;
  return Math.round(num);
}

function stripPrefix(line) {
  let s = line.trim();
  // Handle [nama] bracket format
  const bracket = s.match(/^\[(.+?)\]\s*(.*)$/);
  if (bracket) {
    return (bracket[1] + " " + (bracket[2] || "")).trim();
  }
  // Handle numbered list (1., 2., 3.)
  s = s.replace(/^\d+[.):]\s+/, "");
  // Strip other prefixes
  s = s.replace(PREFIX_REGEX, "");
  return s.trim();
}

export function parseBulkImportText(text) {
  const lines = String(text || "").split(/\r?\n/);
  const seen = new Set();
  const items = [];

  for (const rawLine of lines) {
    if (!rawLine || !rawLine.trim()) continue;
    const line = stripPrefix(rawLine);
    if (!line) continue;

    // Split by | or : (last occurrence, so name bisa berisi karakter tsb)
    let name = line;
    let price = 0;
    const sepIdx = Math.max(line.lastIndexOf("|"), line.lastIndexOf(" - "));
    if (sepIdx > 0) {
      const nm = line.substring(0, sepIdx).trim();
      const pr = line.substring(sepIdx + 1).trim();
      // Only take split if the right side looks price-ish
      if (/[\d]/.test(pr)) {
        name = nm;
        price = parsePrice(pr);
      }
    }

    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ name, price });
  }
  return items;
}
