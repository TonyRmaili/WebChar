export const RARITY_COLORS = {
  common: "text-slate-300 border-slate-500/40",
  uncommon: "text-green-400 border-green-500/40",
  rare: "text-blue-400 border-blue-500/40",
  "very rare": "text-purple-400 border-purple-500/40",
  legendary: "text-amber-400 border-amber-500/40",
  artifact: "text-red-400 border-red-500/40",
  none: "text-slate-400 border-slate-600/40",
};

export const rarityClass = (rarity) =>
  RARITY_COLORS[(rarity || "").toLowerCase()] || RARITY_COLORS.none;

// Collect all unique values for a top-level key across items.
// For array values (e.g. tags) it flattens.
export const collectUnique = (items, key) => {
  const set = new Set();
  for (const it of items) {
    const v = it?.[key];
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => x && set.add(x));
    else set.add(v);
  }
  return [...set].sort((a, b) => String(a).localeCompare(String(b)));
};

// Renders attune string: true -> "Attunement", "by a wizard" -> "Attunement (by a wizard)"
export const attuneLabel = (reqAttune) => {
  if (!reqAttune) return null;
  if (reqAttune === true) return "Attunement";
  return `Attunement (${reqAttune})`;
};