/* diceWords.js — small helpers shared by the dice tower and its bridges:
   how rolls and results are written, and building dice expressions. */

const asList = (v) => (Array.isArray(v) ? v : []);

export const MODES = [
  { value: "normal", label: "normal" },
  { value: "advantage", label: "adv" },
  { value: "disadvantage", label: "dis" },
];
export const modeWord = (mode) => (mode === "advantage" ? "advantage" : mode === "disadvantage" ? "disadvantage" : "");

export const DICE = [4, 6, 8, 10, 12, 20, 100];

// Up to this many dice a roll shows each one; more, and it shows how many of each face.
export const DICE_LIMIT_SHOWN = 40;

export const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);

// "14 fire, 3 cold" (types with 0 left out)
export const damageWords = (byType) =>
  Object.entries(byType || {})
    .filter(([, n]) => n > 0)
    .map(([t, n]) => `${n} ${t === "untyped" ? "" : t}`.trim())
    .join(", ");

export const total = (byType) => Object.values(byType || {}).reduce((a, b) => a + b, 0);

/* The dice tray: clicking d6 adds a d6 to what's written.
   "" → "1d6", "1d6" → "2d6", "2d6+3" → "3d6+3", "1d20+5" → "1d20+5+1d6". */
export function addDie(expression, sides) {
  const text = String(expression || "").trim();
  if (!text) return `1d${sides}`;
  const re = new RegExp(`(^|[+-])\\s*(\\d*)d${sides}(?![0-9%])(?!k)`, "i");
  const m = text.match(re);
  if (m) {
    const count = (parseInt(m[2], 10) || 1) + 1;
    return text.replace(re, `${m[1]}${count}d${sides}`);
  }
  return `${text}+1d${sides}`;
}

// How many dice a free-roll result holds (all its times).
export const diceCount = (line) => asList(line?.results).reduce((n, r) => n + asList(r.terms).reduce((m, t) => m + asList(t.rolls).length, 0), 0);

// "1×3 2×5 …" — for big rolls, faces instead of every die.
export function facesOf(line) {
  const faces = {};
  for (const r of asList(line?.results)) {
    for (const t of asList(r.terms)) {
      for (const [face, n] of Object.entries(t.faces || {})) faces[face] = (faces[face] || 0) + n;
    }
  }
  return Object.entries(faces)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([face, n]) => ({ face: Number(face), n }));
}

// A d20 for a save or an attack: "17" or "17 / 4" with advantage (the kept one first).
export const d20Words = (d) => {
  const rolls = asList(d?.rolls);
  if (rolls.length < 2) return String(d?.natural ?? "—");
  const other = rolls[0] === d.natural ? rolls[1] : rolls[0];
  return `${d.natural} / ${other}`;
};

export const RESULT_WORD = { hit: "hit", crit: "crit", miss: "miss", fumble: "natural 1" };

/* "vs": how many of a roll's results reach a number (an AC, a DC).
   The natural d20 counts when the roll has one: a 20 always reaches,
   a 1 never does — like attacks. → { reached, of, twenties, ones } */
export const naturalD20 = (result) => {
  const t = asList(result?.terms).find((x) => x.kind === "dice" && x.sides === 20);
  if (!t) return null;
  const kept = asList(t.rolls).filter((_, i) => t.kept?.[i] !== false);
  return kept.length === 1 ? kept[0] : null;
};

export function reachCount(line) {
  const results = asList(line?.results);
  let reached = 0, twenties = 0, ones = 0;
  for (const r of results) {
    const nat = naturalD20(r);
    if (nat === 20) twenties += 1;
    if (nat === 1) ones += 1;
    if (nat === 20 || (nat !== 1 && r.total >= line.against)) reached += 1;
  }
  return { reached, of: results.length, twenties, ones };
}