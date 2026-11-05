import { DEFAULT_ABILITY_SCORES, DEFAULT_SKILLS } from "../../../../utils/Constants";

/* Pure logic for the Abilities Define tab (ability scores + skills).

   Data shape (unchanged):
     ability_scores.str = { score, mod, check_mod, save_mod, proficient, expertise, label }
     skills.athletics   = { value, proficient, expertise, label, ability: "Strength" }
   `mod` is stored because other parts of the app read it; it is
   recomputed whenever a score is saved. `value` on a skill is a manual
   adjustment, not the total. */

export const ABILITIES = [
  { key: "str", label: "Strength", short: "Str" },
  { key: "dex", label: "Dexterity", short: "Dex" },
  { key: "con", label: "Constitution", short: "Con" },
  { key: "int", label: "Intelligence", short: "Int" },
  { key: "wis", label: "Wisdom", short: "Wis" },
  { key: "cha", label: "Charisma", short: "Cha" },
];
const KEY_BY_LABEL = Object.fromEntries(ABILITIES.map((a) => [a.label, a.key]));
const SHORT_BY_LABEL = Object.fromEntries(ABILITIES.map((a) => [a.label, a.short]));

const toInt = (v, fallback = 0) => {
  if (v === "" || v == null) return fallback;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
};

export const signed = (n) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n}`);

export const scoreToMod = (score) => {
  const n = toInt(score, null);
  return n == null ? null : Math.floor((n - 10) / 2);
};

export const pbOf = (charData) => toInt(charData?.pb?.total, 0);

/* ─── Proficiency levels ─────────────────────────────────────────── */

export const profLevel = (row) => (row?.expertise ? "expertise" : row?.proficient ? "proficient" : "none");

// none → proficient → expertise → none
export const nextProf = (row) => {
  const level = profLevel(row);
  if (level === "none") return { proficient: true, expertise: false };
  if (level === "proficient") return { proficient: true, expertise: true };
  return { proficient: false, expertise: false };
};

const profBonus = (row, pb) => (row?.expertise ? 2 * pb : row?.proficient ? pb : 0);

/* ─── Abilities ──────────────────────────────────────────────────── */

export const abilitiesOf = (charData) => {
  const stored = charData?.ability_scores || {};
  return Object.fromEntries(ABILITIES.map((a) => [a.key, { ...DEFAULT_ABILITY_SCORES[a.key], ...(stored[a.key] || {}) }]));
};

// Uses the score, so a stale stored mod never shows.
export const modOf = (row) => scoreToMod(row?.score);

export const checkTotal = (row) => {
  const mod = modOf(row);
  return mod == null ? null : mod + toInt(row?.check_mod);
};

export const saveTotal = (row, pb) => {
  const mod = modOf(row);
  return mod == null ? null : mod + profBonus(row, pb) + toInt(row?.save_mod);
};

// Writing any ability also brings every stored `mod` in line with its score.
const withFreshMods = (abilities) =>
  Object.fromEntries(Object.entries(abilities).map(([k, row]) => [k, { ...row, mod: scoreToMod(row.score) }]));

export const patchAbility = (abilities, key, patch) => withFreshMods({ ...abilities, [key]: { ...abilities[key], ...patch } });

/* ─── Skills ─────────────────────────────────────────────────────── */

export const skillsOf = (charData) => ({ ...DEFAULT_SKILLS, ...(charData?.skills || {}) });

export const isCustomSkill = (key) => !(key in DEFAULT_SKILLS);

export const skillAbilityShort = (row) => SHORT_BY_LABEL[row?.ability] || "";

export const skillTotal = (row, abilities, pb) => {
  const mod = modOf(abilities[KEY_BY_LABEL[row?.ability]]) ?? 0;
  return mod + toInt(row?.value) + profBonus(row, pb);
};

export const sortedSkills = (skills) =>
  Object.entries(skills)
    .filter(([, row]) => row && typeof row === "object")
    .sort(([, a], [, b]) => String(a.label || "").localeCompare(String(b.label || "")));

export const passiveOf = (skills, key, abilities, pb) => (skills[key] ? 10 + skillTotal(skills[key], abilities, pb) : null);

const toKey = (name) =>
  String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""));

export const addSkill = (skills, name, abilityLabel) => {
  const base = toKey(name) || "skill";
  let key = base;
  let i = 1;
  while (skills[key]) key = `${base}${++i}`;
  return { ...skills, [key]: { value: null, proficient: false, expertise: false, label: name.trim(), ability: abilityLabel } };
};

export const removeSkill = (skills, key) => {
  const next = { ...skills };
  delete next[key];
  return next;
};

// Any manual adjustment set? Then the adjustment column starts open.
export const hasAdjustments = (abilities, skills) =>
  Object.values(abilities).some((r) => toInt(r?.check_mod) !== 0 || toInt(r?.save_mod) !== 0) ||
  Object.values(skills).some((r) => toInt(r?.value) !== 0);

export { toInt };