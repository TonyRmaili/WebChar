
export const toInt = (v) => {const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
};

export const toInt2 = (v) => {const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : 0;};

export const toIntOrNull = (v) => {
  if (v === "" || v == null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

export const scoreToMod = (score) =>
  typeof score === "number" && Number.isFinite(score)
    ? Math.floor((score - 10) / 2)
    : null;

export const toKey = (name) => {
  const cleaned = name.replace(/[^a-zA-Z0-9 ]+/g, " ").trim();
  const camel = cleaned
    .split(/\s+/)
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()
    )
    .join("");
  return camel || "customSkill";
};


export const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
export const modFrom = (score) => Math.floor((toInt(score) - 10) / 2);
export const saveFrom = (score, prof, exp, pb) => modFrom(score) + (exp ? 2 * pb : prof ? pb : 0);


export const idGen = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

