/* Pure logic for the Biography Define tab.

   Race, subrace and background are layers of the character (from:
   "race:elf-xphb", "race:elf-xphb/subrace:elf-drow-xphb",
   "background:acolyte-xphb"); this tab only shows them. Swapping one
   rebuilds that layer, which comes with the builder on the sheet.

   The rest is the `profile` block:
     { alignment: { prefix, suffix }, size, appearance, age, height, weight,
       personality_traits, ideals, bonds, flaws, backstory } */

export const asList = (v) => (Array.isArray(v) ? v : []);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

export const SIZES = [
  { value: "tiny", label: "Tiny" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "huge", label: "Huge" },
  { value: "gargantuan", label: "Garg.", hint: "Gargantuan" },
];

export const LAW_AXIS = ["lawful", "neutral", "chaotic"];
export const GOOD_AXIS = ["good", "neutral", "evil"];

export const alignmentLabel = ({ prefix, suffix } = {}) => {
  if (!prefix && !suffix) return "";
  if (prefix === "neutral" && suffix === "neutral") return "True Neutral";
  return [cap(prefix), cap(suffix)].filter(Boolean).join(" ");
};

const EMPTY_PROFILE = {
  alignment: { prefix: "", suffix: "" },
  size: "",
  appearance: "",
  height: "",
  age: "",
  weight: "",
  personality_traits: "",
  ideals: "",
  bonds: "",
  flaws: "",
  backstory: "",
};

export const profileOf = (ch) => {
  const stored = isObj(ch?.profile) ? ch.profile : {};
  const alignment = isObj(stored.alignment) ? stored.alignment : {};
  return { ...EMPTY_PROFILE, ...stored, alignment: { ...EMPTY_PROFILE.alignment, ...alignment } };
};

/* ─── Origin layers ──────────────────────────────────────────────── */

// { race, subrace, background }: each { id, label, picks } or null.
export function originOf(ch) {
  const out = { race: null, subrace: null, background: null };
  for (const l of asList(ch?.layers)) {
    const from = String(l?.from || "");
    let m;
    if ((m = /^race:([^/]+)\/subrace:(.+)$/.exec(from))) out.subrace = { id: m[2], raceId: m[1], label: l.label, picks: l.picks || {} };
    else if ((m = /^race:([^/]+)$/.exec(from))) out.race = { id: m[1], label: l.label, picks: l.picks || {} };
    else if ((m = /^background:(.+)$/.exec(from))) out.background = { id: m[1], label: l.label, picks: l.picks || {} };
  }
  return out;
}

// "Thaldrin · Drow · Acolyte · Chaotic Good · 142 years"
export const identityLine = (origin, profile, charName) =>
  [
    charName,
    origin.subrace?.label || origin.race?.label,
    origin.background?.label,
    alignmentLabel(profile.alignment),
    Number(profile.age) > 0 ? `${profile.age} years` : "",
  ]
    .filter(Boolean)
    .join(" · ");
