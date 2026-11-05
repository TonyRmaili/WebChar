import { XP_BY_LEVEL } from "../../../../utils/Constants";

/* Pure logic for the General Define tab: classes, level, proficiency
   bonus, hit dice, core numbers, movement, senses, offense, experience.

   Stored shapes (unchanged; `edition` on a class row is new and optional):
     classes:   [{ id, class_name, subclass, level, hit_dice, hit_dice_overridden, edition? }]
     total_level, pb: { standard, modifier, total }, hit_dice: { d8: { max, current } }
     ac, health.max_hp, initiative: { mod, total }, exp
     speed:  { walk: 30, fly: 60, hover: true }      (hover belongs to fly)
     senses: { darkvision: 120, devilsight: true }    (devilsight belongs to darkvision)
     offense: { melee|ranged|spell: { base, mod, total }, save_dcs: { save_str: { base, mod, total, active } } }

   total_level, pb, hit_dice and the offense totals are derived. They are
   stored because other screens read them, and are recomputed whenever
   something they depend on is saved here — never just by opening the tab. */

export const asList = (v) => (Array.isArray(v) ? v : []);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const canon = (s) => (typeof s === "string" ? s.trim().toLowerCase() : "");
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

export const toInt = (v, fallback = 0) => {
  if (v === "" || v == null) return fallback;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
};

export const signed = (n) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n}`);

export const newId = () =>
  globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const abilityMod = (charData, ab) => toInt(charData?.ability_scores?.[ab]?.mod, 0);

/* ─── Class catalogue ────────────────────────────────────────────────
   The catalogue is { wizard: { one: {...}, classic: {...} }, ... }. A
   class row stores free text, so it's matched by key or display name. */

export const DIE_OPTIONS = ["d4", "d6", "d8", "d10", "d12", "d20"];

// Fallback when the catalogue isn't loaded or the class is homebrew text.
const DEFAULT_DIE = {
  wizard: "d6", sorcerer: "d6",
  artificer: "d8", warlock: "d8", druid: "d8", cleric: "d8", rogue: "d8", bard: "d8", monk: "d8",
  fighter: "d10", ranger: "d10", paladin: "d10",
  barbarian: "d12",
};

export const catalogueKeyFor = (catalogue, name) => {
  const c = canon(name);
  if (!c || !isObj(catalogue)) return null;
  if (catalogue[c]) return c;
  return (
    Object.keys(catalogue).find((k) => {
      const entry = catalogue[k];
      return canon(entry?.one?.class?.name) === c || canon(entry?.classic?.class?.name) === c;
    }) ?? null
  );
};

export const editionsOf = (catalogue, key) => ["one", "classic"].filter((e) => catalogue?.[key]?.[e]);

// The row's edition, or the first one the catalogue has.
export const editionFor = (catalogue, key, row) => {
  const available = editionsOf(catalogue, key);
  return available.includes(row?.edition) ? row.edition : available[0] ?? null;
};

export const classEntry = (catalogue, row) => {
  const key = catalogueKeyFor(catalogue, row?.class_name);
  const edition = key ? editionFor(catalogue, key, row) : null;
  return key && edition ? { key, edition, data: catalogue[key][edition] } : null;
};

export const classDisplayName = (catalogue, key) =>
  catalogue?.[key]?.one?.class?.name || catalogue?.[key]?.classic?.class?.name || cap(key);

const dieFrom = (v) => {
  const m = String(v ?? "").match(/d(4|6|8|10|12|20)\b/i);
  return m ? `d${m[1]}` : "";
};

export const defaultDie = (catalogue, row) => {
  const entry = classEntry(catalogue, row);
  return dieFrom(entry?.data?.class?.hit_dice) || DEFAULT_DIE[canon(row?.class_name)] || "";
};

export const subclassesOf = (entry) => asList(entry?.data?.subclasses).filter((s) => s?.name);

export const subclassFor = (entry, row) => {
  const want = canon(row?.subclass);
  if (!want) return null;
  return subclassesOf(entry).find((s) => canon(s.name) === want || canon(s.short_name) === want) ?? null;
};

/* ─── Class rows ─────────────────────────────────────────────────── */

export const newClassRow = () => ({
  id: newId(),
  class_name: "",
  subclass: "",
  level: 1,
  hit_dice: "",
  hit_dice_overridden: false,
});

// Fill in the hit die from the class unless the player set their own.
export const withAutoDie = (catalogue, row) =>
  row.hit_dice_overridden ? row : { ...row, hit_dice: defaultDie(catalogue, row) || row.hit_dice || "" };

export const totalLevelOf = (rows) => asList(rows).reduce((sum, r) => sum + Math.max(0, toInt(r.level, 0)), 0);

export const pbStandard = (level) => (level <= 0 ? 2 : Math.min(6, 2 + Math.floor((level - 1) / 4)));

export const pbOf = (charData) => {
  const base = isObj(charData?.pb) ? charData.pb : {};
  const standard = pbStandard(totalLevelOf(charData?.classes));
  const modifier = toInt(base.modifier, 0);
  return { standard, modifier, total: standard + modifier };
};

// { d10: { max: 5, current }, d6: {...} }, keeping "current" where possible.
export const summarizeHitDice = (rows, prev = {}) => {
  const totals = {};
  for (const r of asList(rows)) {
    const level = toInt(r.level, 0);
    const die = dieFrom(r.hit_dice);
    if (!level || !die) continue;
    totals[die] = { max: (totals[die]?.max || 0) + level };
  }
  for (const [die, t] of Object.entries(totals)) {
    const before = prev?.[die]?.current;
    t.current = Number.isFinite(before) ? Math.min(before, t.max) : t.max;
  }
  return totals;
};

export const hitDiceLabel = (hd) =>
  Object.entries(hd || {})
    .sort(([a], [b]) => DIE_OPTIONS.indexOf(a) - DIE_OPTIONS.indexOf(b))
    .map(([die, t]) => `${t.max}${die}`)
    .join(" + ");

// Everything that follows from the class list, in one patch.
export const classPatch = (charData, rows, pbModifier) => {
  const total = totalLevelOf(rows);
  const standard = pbStandard(total);
  const modifier = pbModifier ?? toInt(charData?.pb?.modifier, 0);
  const pb = { standard, modifier, total: standard + modifier };
  return {
    classes: rows,
    total_level: total,
    pb,
    hit_dice: summarizeHitDice(rows, charData?.hit_dice),
    offense: offenseWithTotals(offenseOf(charData), { ...charData, pb }),
  };
};

/* ─── Progression table ──────────────────────────────────────────── */

const formatCell = (v) => {
  if (v === 0 || v == null || v === "") return "—";
  if (isObj(v)) {
    if (v.type === "bonus" && v.value != null) return `+${v.value}`;
    return v.value != null ? String(v.value) : "—";
  }
  return String(v);
};

export const humanizeKey = (key) =>
  String(key)
    .split("_")
    .map((w) => cap(w))
    .join(" ");

export const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/* The rows to draw for one class: levels up to the character's level,
   plus the next one as a preview — or all of them when `all` is on.
   Columns that are empty for every drawn row are left out. */
export const progressionView = (entry, row, all = false) => {
  const levels = asList(entry?.data?.class?.level_progression);
  if (!levels.length) return null;

  const current = Math.max(0, toInt(row?.level, 0));
  const shown = all ? levels : levels.filter((l) => l.level <= Math.max(1, current) + 1);

  const sub = subclassFor(entry, row);
  const subFeatures = asList(sub?.features);

  const extraKeys = [];
  for (const l of shown) for (const k of Object.keys(l.extras || {})) if (!extraKeys.includes(k)) extraKeys.push(k);
  const usedExtras = extraKeys.filter((k) => shown.some((l) => formatCell(l.extras?.[k]) !== "—"));

  let slotCount = 0;
  for (const l of shown) {
    const slots = asList(l.spell_slots);
    slots.forEach((n, i) => {
      if (toInt(n, 0) > 0) slotCount = Math.max(slotCount, i + 1);
    });
  }

  return {
    current,
    columns: usedExtras.map((k) => ({ key: k, label: humanizeKey(k) })),
    slotCount,
    hasMore: !all && levels.length > shown.length,
    rows: shown.map((l) => ({
      level: l.level,
      pb: l.proficiency_bonus,
      reached: l.level <= current,
      features: [
        ...asList(l.feature_names).map((name) => ({ name, from: "class" })),
        ...subFeatures.filter((f) => toInt(f.level, 0) === l.level).map((f) => ({ name: f.name, from: "subclass" })),
      ],
      extras: usedExtras.map((k) => formatCell(l.extras?.[k])),
      slots: Array.from({ length: slotCount }, (_, i) => formatCell(asList(l.spell_slots)[i])),
    })),
  };
};

// Description text for a feature shown in the table.
export const featureText = (entry, row, name, level) => {
  const pick = (list) => asList(list).find((f) => f?.name === name && toInt(f.level, level) === level) || asList(list).find((f) => f?.name === name);
  const f = pick(entry?.data?.class_features) || pick(subclassFor(entry, row)?.features);
  return f?.clean_entries?.description || "";
};

/* ─── Core numbers ───────────────────────────────────────────────── */

export const initiativeOf = (charData) => {
  const mod = toInt(isObj(charData?.initiative) ? charData.initiative.mod : 0, 0);
  return { mod, total: abilityMod(charData, "dex") + mod };
};

/* ─── Movement & senses ──────────────────────────────────────────── */

export const SPEED_TYPES = ["walk", "fly", "swim", "climb", "burrow"];
export const SENSE_TYPES = ["darkvision", "blindsight", "tremorsense", "truesight"];

export const speedOf = (charData) => {
  const raw = isObj(charData?.speed) ? charData.speed : {};
  return { ...raw, walk: toInt(raw.walk, 0) };
};
export const sensesOf = (charData) => (isObj(charData?.senses) ? { ...charData.senses } : {});

// Entries to list (the flags hover/devilsight ride along with fly/darkvision).
export const speedEntries = (speed) => SPEED_TYPES.filter((t) => t in speed).concat(Object.keys(speed).filter((k) => !SPEED_TYPES.includes(k) && k !== "hover"));
export const senseEntries = (senses) => Object.keys(senses).filter((k) => k !== "devilsight");

export const withSpeed = (speed, type) => (type in speed ? speed : { ...speed, [type]: 0, ...(type === "fly" ? { hover: false } : {}) });
export const withoutSpeed = (speed, type) => {
  if (type === "walk") return speed;
  const next = { ...speed };
  delete next[type];
  if (type === "fly") delete next.hover;
  return next;
};
export const withSense = (senses, type) => (type in senses ? senses : { ...senses, [type]: 0, ...(type === "darkvision" ? { devilsight: false } : {}) });
export const withoutSense = (senses, type) => {
  const next = { ...senses };
  delete next[type];
  if (type === "darkvision") delete next.devilsight;
  return next;
};

/* ─── Offense ────────────────────────────────────────────────────── */

export const ATTACKS = [
  { key: "melee", label: "Melee attack", base: "str" },
  { key: "ranged", label: "Ranged attack", base: "dex" },
  { key: "spell", label: "Spell attack", base: "cha" },
];

export const offenseOf = (charData) => {
  const raw = isObj(charData?.offense) ? charData.offense : {};
  const saves = isObj(raw.save_dcs) ? raw.save_dcs : {};
  const out = { ...raw, save_dcs: {} };
  for (const a of ATTACKS) out[a.key] = { base: a.base, mod: 0, ...(isObj(raw[a.key]) ? raw[a.key] : {}) };
  for (const ab of ABILITIES) {
    const row = isObj(saves[`save_${ab}`]) ? saves[`save_${ab}`] : {};
    out.save_dcs[`save_${ab}`] = { base: ab, mod: 0, active: false, ...row };
  }
  return out;
};

export const attackTotal = (charData, row) => toInt(charData?.pb?.total, 0) + abilityMod(charData, row.base) + toInt(row.mod);
export const saveDcTotal = (charData, row) => 8 + toInt(charData?.pb?.total, 0) + abilityMod(charData, row.base) + toInt(row.mod);

// Stored totals kept in step with the numbers they come from.
export const offenseWithTotals = (offense, charData) => {
  const out = { ...offense, save_dcs: { ...offense.save_dcs } };
  for (const a of ATTACKS) out[a.key] = { ...out[a.key], mod: toInt(out[a.key].mod), total: attackTotal(charData, out[a.key]) };
  for (const key of Object.keys(out.save_dcs)) {
    const row = out.save_dcs[key];
    out.save_dcs[key] = { ...row, mod: toInt(row.mod), active: !!row.active, total: saveDcTotal(charData, row) };
  }
  return out;
};

/* ─── Experience ─────────────────────────────────────────────────── */

export const expOf = (charData) => Math.max(0, toInt(charData?.exp, 0));

// Level the XP alone would give, and what the next one needs.
export const xpProgress = (xp) => {
  let level = 1;
  for (let l = 1; l <= 20; l++) if (xp >= (XP_BY_LEVEL[l] ?? Infinity)) level = l;
  const floor = XP_BY_LEVEL[level] ?? 0;
  const next = level < 20 ? XP_BY_LEVEL[level + 1] : null;
  return { level, floor, next, fraction: next ? Math.min(1, (xp - floor) / (next - floor)) : 1 };
};

export const formatNumber = (n) => Number(n || 0).toLocaleString();