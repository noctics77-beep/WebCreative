/**
 * Parse teks bulk import.
 * Return array of {name, price, variants[]} tanpa duplikat.
 *
 * Format prefix yang dikenali (auto-strip):
 *   ⟥, -, •, *, >, #, +, 1., [nama], atau tanpa prefix
 *
 * Format harga (opsional, setelah nama dgn pemisah | atau : atau -):
 *   150000 | 150.000 | Rp 150.000 | 150rb | 150K
 *
 * Format VARIASI (pisahkan nama & variasi dengan `::`):
 *   CapCut Pro :: 7 Hari=15000 | 30 Hari=40000* | 90 Hari=50000**
 *   *  = tandai sebagai "Paling Dipilih" (is_recommended)
 *   ** = tandai sebagai "Best Value" (is_best_value)
 *   > untuk harga diskon: `30 Hari=50000>40000` = normal 50000, diskon 40000
 */
const PREFIX_REGEX = /^[^A-Za-z0-9\u00C0-\uFFFF[]+/;
const NUM_PATTERN = /^([\d]+(?:[.,]\d+)*)\s*(rb|ribu|k|jt|juta)?$/i;

function parsePrice(raw) {
  if (!raw) return 0;
  let s = String(raw).trim().toLowerCase();
  s = s.replace(/^rp\.?\s*/, "").replace(/[\s.,]*rp\.?\s*/, "").trim();
  const m = s.match(NUM_PATTERN);
  if (!m) {
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
  const bracket = s.match(/^\[(.+?)\]\s*(.*)$/);
  if (bracket) {
    return (bracket[1] + " " + (bracket[2] || "")).trim();
  }
  s = s.replace(/^\d+[.):]\s+/, "");
  s = s.replace(PREFIX_REGEX, "");
  return s.trim();
}

/**
 * Parse single variant token like "30 Hari=40000*" or "30 Hari=50000>40000**".
 * Returns {name, price, discount_price, is_recommended, is_best_value}.
 */
function parseVariantToken(raw) {
  const s = raw.trim();
  if (!s) return null;
  const eqIdx = s.indexOf("=");
  if (eqIdx <= 0) return null;
  const nm = s.substring(0, eqIdx).trim();
  let priceRaw = s.substring(eqIdx + 1).trim();
  // Detect flag suffix ** first (best_value), then * (recommended)
  let isBestValue = false;
  let isRecommended = false;
  if (priceRaw.endsWith("**")) {
    isBestValue = true;
    priceRaw = priceRaw.slice(0, -2).trim();
  } else if (priceRaw.endsWith("*")) {
    isRecommended = true;
    priceRaw = priceRaw.slice(0, -1).trim();
  }
  // Detect discount format normal>diskon
  let priceNormal;
  let discountPrice = null;
  const gtIdx = priceRaw.indexOf(">");
  if (gtIdx > 0) {
    priceNormal = parsePrice(priceRaw.substring(0, gtIdx));
    discountPrice = parsePrice(priceRaw.substring(gtIdx + 1));
  } else {
    priceNormal = parsePrice(priceRaw);
  }
  return {
    name: nm || "Variasi",
    price: priceNormal,
    discount_price: discountPrice,
    is_recommended: isRecommended,
    is_best_value: isBestValue,
  };
}

export function parseBulkImportText(text) {
  const lines = String(text || "").split(/\r?\n/);
  const seen = new Set();
  const items = [];

  for (const rawLine of lines) {
    if (!rawLine || !rawLine.trim()) continue;
    const line = stripPrefix(rawLine);
    if (!line) continue;

    // ── Variant format detection: `Name :: v1=X | v2=Y* | v3=Z**` ──
    const varSepIdx = line.indexOf("::");
    if (varSepIdx > 0) {
      const name = line.substring(0, varSepIdx).trim();
      const variantsRaw = line.substring(varSepIdx + 2).trim();
      if (!name || !variantsRaw) continue;
      const tokens = variantsRaw.split("|").map((t) => t.trim()).filter(Boolean);
      const variants = tokens.map(parseVariantToken).filter(Boolean);
      // Enforce exclusivity: hanya 1 recommended dan 1 best_value; ambil yang pertama
      let seenRec = false;
      let seenBv = false;
      for (const v of variants) {
        if (v.is_recommended) {
          if (seenRec) v.is_recommended = false;
          else seenRec = true;
        }
        if (v.is_best_value) {
          if (seenBv) v.is_best_value = false;
          else seenBv = true;
        }
      }
      const startingPrice = variants.length
        ? Math.min(...variants.map((v) => (v.discount_price || v.price)))
        : 0;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ name, price: startingPrice, variants });
      continue;
    }

    // ── Flat format (no variants) ──
    let name = line;
    let price = 0;
    const sepIdx = Math.max(line.lastIndexOf("|"), line.lastIndexOf(" - "));
    if (sepIdx > 0) {
      const nm = line.substring(0, sepIdx).trim();
      const pr = line.substring(sepIdx + 1).trim();
      if (/[\d]/.test(pr)) {
        name = nm;
        price = parsePrice(pr);
      }
    }

    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ name, price, variants: [] });
  }
  return items;
}
