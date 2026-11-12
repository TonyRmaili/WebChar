/* Pure logic for the Biography Define tab.

   Data shape (unchanged):
     race: { name, source, edition, subrace, subrace_source, size, spell_ability, traits[], subrace_traits[] }
     background: { name, source, edition, notes }
     character_profile: { alignment: { prefix, suffix }, appearance, height, age, weight,
                          personality_traits, ideals, bonds, flaws, backstory } */

export const asList = (v) => (Array.isArray(v) ? v : []);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

/* ─── Catalogue entries ──────────────────────────────────────────── */

export const EDITIONS = [
  { id: "one", label: "One D&D" },
  { id: "classic", label: "Classic" },
];
const EDITION_LABEL = Object.fromEntries(EDITIONS.map((e) => [e.id, e.label]));

// Missing edition means classic: only a few entries carry the key.
export const entryEdition = (e) => e?.edition || "classic";
export const editionLabel = (e) => EDITION_LABEL[entryEdition(e)] ?? entryEdition(e);
export const entryKey = (e) => `${e.name}|${e.source}|${entryEdition(e)}`;

// Subraces are identified by name AND source: two can share a name.
export const sameSubrace = (sub, race) => sub.name === race.subrace && (sub.source ?? "") === (race.subrace_source ?? "");

const copyTraits = (list) => asList(list).map((t) => ({ name: t?.name ?? "", notes: t?.notes ?? "" }));

/* ─── Options ────────────────────────────────────────────────────── */

export const SIZES = [
  { value: "tiny", label: "Tiny" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "huge", label: "Huge" },
  { value: "gargantuan", label: "Garg.", hint: "Gargantuan" },
];

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

export const LAW_AXIS = ["lawful", "neutral", "chaotic"];
export const GOOD_AXIS = ["good", "neutral", "evil"];

export const alignmentLabel = ({ prefix, suffix } = {}) => {
  if (!prefix && !suffix) return "";
  if (prefix === "neutral" && suffix === "neutral") return "True Neutral";
  return [cap(prefix), cap(suffix)].filter(Boolean).join(" ");
};

/* ─── Reading stored data ────────────────────────────────────────── */

export const EMPTY_RACE = {
  name: "",
  source: "",
  edition: "classic",
  subrace: "",
  subrace_source: "",
  size: "",
  spell_ability: "",
  traits: [],
  subrace_traits: [],
};
export const EMPTY_BACKGROUND = { name: "", source: "", edition: "classic", notes: "" };
const EMPTY_PROFILE = {
  alignment: { prefix: "", suffix: "" },
  appearance: "",
  height: 0,
  age: 0,
  weight: 0,
  personality_traits: "",
  ideals: "",
  bonds: "",
  flaws: "",
  backstory: "",
};

export const raceOf = (charData) => ({ ...EMPTY_RACE, ...(isObj(charData?.race) ? charData.race : {}) });
export const backgroundOf = (charData) => ({ ...EMPTY_BACKGROUND, ...(isObj(charData?.background) ? charData.background : {}) });
export const profileOf = (charData) => {
  const stored = isObj(charData?.character_profile) ? charData.character_profile : {};
  return { ...EMPTY_PROFILE, ...stored, alignment: { ...EMPTY_PROFILE.alignment, ...(stored.alignment || {}) } };
};

/* ─── Choosing from the catalogue ────────────────────────────────── */

// Changing race resets everything below it: subrace, size, spell ability, traits.
export const raceFromEntry = (entry) => ({
  ...EMPTY_RACE,
  name: entry.name,
  source: entry.source,
  edition: entryEdition(entry),
  traits: copyTraits(entry.traits),
});

export const withSubrace = (race, sub) => ({
  ...race,
  subrace: sub.name,
  subrace_source: sub.source ?? race.source,
  subrace_traits: copyTraits(sub.traits),
});

export const withoutSubrace = (race) => ({ ...race, subrace: "", subrace_source: "", subrace_traits: [] });

export const backgroundFromEntry = (entry) => ({
  name: entry.name,
  source: entry.source,
  edition: entryEdition(entry),
  notes: entry.notes ?? "",
});

/* ─── Header line ────────────────────────────────────────────────── */

// "Hill Dwarf · Soldier · Lawful Good · 142 years"
export const identityLine = (race, background, profile, charName) =>
  [
    charName,
    race.subrace ? race.subrace : race.name,
    background.name,
    alignmentLabel(profile.alignment),
    Number(profile.age) > 0 ? `${profile.age} years` : "",
  ]
    .filter(Boolean)
    .join(" · ");