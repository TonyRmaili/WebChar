/* ═══════════════════════════════════════════════════════════════════
   wizardHelpers.js — token normalization and labels.

   WHY THIS EXISTS
   Race data and background data spell the same concepts differently:

     race.proficiencies.skills.fixed   → ["survival"]
     background.skill_proficiencies    → ["sleight of hand"]
     SKILL_OPTIONS keys                → "sleightOfHand"

     background languages              → ["celestial"]   (lowercase)
     LANGUAGE_OPTIONS                  → ["Celestial"]   (Title Case)

     equipment items                   → "dagger|xphb"   (name|source)

   Every value that crosses a module boundary is normalized here first,
   so overlap detection compares apples to apples. Without this,
   "sleight of hand" and "sleightOfHand" look like different skills and
   collisions silently go undetected.

   (The wizard's look lives in wizardInk.jsx and the parchment kit; the
   old slate chip / field styles that used to be here are gone.)
   ═══════════════════════════════════════════════════════════════════ */

import {
  SKILL_OPTIONS,
  TOOL_OPTIONS,
  WEAPON_OPTIONS,
  ARMOR_OPTIONS,
  PC_LANGUAGE_OPTIONS,
} from "../../../utils/Constants";

/* ───────── generic string helpers ───────── */

export const cap = (s) =>
  s ? String(s)[0].toUpperCase() + String(s).slice(1) : s;

export const titleCase = (s) =>
  String(s || "")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

/** "dagger|xphb" → "dagger"; "holy symbol|phb" → "holy symbol" */
export const stripSource = (token) =>
  String(token || "").split("|")[0].trim();

/**
 * 5etools @-tag → identity + display.
 *
 * Class data writes weapon proficiencies as "{@item dagger|phb|daggers}".
 * classHelpers.stripAtNotation returns parts[2] ("daggers") because it is
 * built for prose. For identity we need parts[0] ("dagger") — the plural
 * would never match WEAPON_OPTIONS and every weapon overlap would be missed.
 */
export const parseTag = (raw) => {
  const s = String(raw ?? "");
  const m = s.match(/\{@\w+\s([^}]+)\}/);
  if (!m) {
    const id = stripSource(s);
    return { id: id.toLowerCase(), label: titleCase(id) };
  }
  const parts = m[1].split("|").map((p) => p.trim());
  return {
    id: (parts[0] || "").toLowerCase(),
    label: titleCase(parts[2] || parts[0] || ""),
  };
};

/* Armor and weapon proficiencies are granted by CATEGORY, not by item —
   "light", "martial". These are not in ARMOR_OPTIONS / WEAPON_OPTIONS and
   must not be treated as unmatched literals. */
export const ARMOR_CATEGORY_LABELS = {
  light: "Light Armor", medium: "Medium Armor",
  heavy: "Heavy Armor", shield: "Shields",
};

export const WEAPON_CATEGORY_LABELS = {
  simple: "Simple Weapons", martial: "Martial Weapons",
};

/** Collapse to a comparison key: "Sleight of Hand" → "sleightofhand" */
const squash = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/* ───────── skills ─────────
   SKILL_OPTIONS keys are camelCase ("sleightOfHand"). Data uses
   space-separated lowercase ("sleight of hand"). Map both onto the
   canonical camelCase key. */

const SKILL_KEY_BY_SQUASH = Object.keys(SKILL_OPTIONS).reduce((acc, key) => {
  acc[squash(key)] = key;
  return acc;
}, {});

export const normSkill = (token) =>
  SKILL_KEY_BY_SQUASH[squash(token)] || String(token || "").toLowerCase();

export const skillLabel = (token) => {
  const key = normSkill(token);
  return SKILL_OPTIONS[key]?.label || titleCase(token);
};

export const ALL_SKILL_KEYS = Object.keys(SKILL_OPTIONS);

/* ───────── tools ─────────
   Data and TOOL_OPTIONS are both lowercase, but data carries source
   suffixes and stray whitespace. */

const TOOL_BY_SQUASH = TOOL_OPTIONS.reduce((acc, t) => {
  acc[squash(t)] = t;
  return acc;
}, {});

export const normTool = (token) => {
  const bare = stripSource(token);
  return TOOL_BY_SQUASH[squash(bare)] || bare.toLowerCase();
};

export const toolLabel = (token) => titleCase(normTool(token));

/* ───────── languages ─────────
   Data is lowercase, Constants is Title Case. Canonical form is the
   Title Case entry when we recognise it, else the raw lowercase. */

const LANG_BY_SQUASH = PC_LANGUAGE_OPTIONS.reduce((acc, l) => {
  acc[squash(l)] = l;
  return acc;
}, {});

export const normLang = (token) => {
  const bare = stripSource(token);
  return LANG_BY_SQUASH[squash(bare)] || bare.toLowerCase();
};

export const langLabel = (token) => {
  const n = normLang(token);
  return LANG_BY_SQUASH[squash(n)] || titleCase(n);
};

/* ───────── weapons / armor ───────── */

const WEAPON_BY_SQUASH = WEAPON_OPTIONS.reduce((a, w) => ((a[squash(w)] = w), a), {});
const ARMOR_BY_SQUASH = ARMOR_OPTIONS.reduce((a, w) => ((a[squash(w)] = w), a), {});

export const normWeapon = (t) => WEAPON_BY_SQUASH[squash(stripSource(t))] || stripSource(t).toLowerCase();
export const normArmor = (t) => ARMOR_BY_SQUASH[squash(stripSource(t))] || stripSource(t).toLowerCase();

/* ───────── family-aware dispatch ─────────
   `family` is the real proficiency family of a value, which is NOT
   always the group it was declared under — Nephalia Human offers
   ["any_skill", "any_tool"] under `proficiencies.skills`. */

export const normValue = (value, family) => {
  switch (family) {
    case "skills": return normSkill(value);
    case "tools": return normTool(value);
    case "languages": return normLang(value);
    case "weapons": return normWeapon(value);
    case "armor": return normArmor(value);
    case "feats": return String(value || "").toLowerCase().trim();
    case "equipment": return stripSource(value).toLowerCase();
    default: return String(value || "").toLowerCase().trim();
  }
};

export const labelFor = (value, family) => {
  switch (family) {
    case "skills": return skillLabel(value);
    case "tools": return toolLabel(value);
    case "languages": return langLabel(value);
    case "feats": return formatFeatTag(value);
    case "armor": return ARMOR_CATEGORY_LABELS[value] || titleCase(stripSource(value));
    case "weapons": return WEAPON_CATEGORY_LABELS[value] || titleCase(stripSource(value));
    default: return titleCase(stripSource(value));
  }
};

/** Stable cross-source identity for overlap: "skills:stealth" */
export const commitKey = (value, family) => `${family}:${normValue(value, family)}`;

/* ───────── feats ─────────
   "magic initiate; cleric" → "Magic Initiate (Cleric)" */

export const formatFeatTag = (raw) => {
  if (typeof raw !== "string") return raw;
  const [base, sub] = raw.split(";").map((s) => s.trim());
  return sub ? `${titleCase(base)} (${titleCase(sub)})` : titleCase(base);
};

/* ───────── entities ───────── */

/** Races and backgrounds both use edition:"one", or absent = classic. */
export const editionOf = (entity) => (entity?.edition === "one" ? "one" : "classic");

/** Name alone is not unique — there are two Acolytes and two Charlatans. */
export const entityKey = (entity) => `${entity?.name}__${entity?.source}`;

export const sameEntity = (a, b) =>
  !!a && !!b && a.name === b.name && a.source === b.source;

/* ───────── money ─────────
   Data stores copper: {value: 5000} and {containsValue: 1500}. */

export const gpFromCp = (cp) => {
  const n = Number(cp);
  if (!Number.isFinite(n)) return null;
  const gp = n / 100;
  return Number.isInteger(gp) ? gp : Math.round(gp * 100) / 100;
};

export const formatGp = (cp) => {
  const gp = gpFromCp(cp);
  return gp == null ? "" : `${gp} GP`;
};