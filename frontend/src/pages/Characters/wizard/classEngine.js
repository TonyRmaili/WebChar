import {
  opt, expandTokens, parseStartingEquipment, isCategoryToken,
} from "./choiceEngine";
import {
  parseTag, titleCase, normSkill, skillLabel, normTool, toolLabel,
  normWeapon, normArmor, ARMOR_CATEGORY_LABELS, WEAPON_CATEGORY_LABELS,
} from "./wizardHelpers";
import { TOOL_CATEGORY_TOKENS, XP_BY_LEVEL } from "../../../utils/Constants";

export const MAX_CHARACTER_LEVEL = 20;
export const CLASS_EDITIONS = ["one", "classic"];

const lower = (s) => String(s ?? "").toLowerCase().trim();
const num = (v) => (v == null ? null : Number(v));

/* ═══════════ shape access ═══════════ */

/** The `{class, subclasses, class_features}` block for one edition. */
export const classVariant = (classes, key, edition) =>
  classes?.[key]?.[edition] || null;

/** Which editions this class actually ships with. */
export const availableEditions = (classes, key) =>
  CLASS_EDITIONS.filter((e) => !!classes?.[key]?.[e]);

export const classDisplayName = (classes, key, edition) =>
  classVariant(classes, key, edition)?.class?.name || titleCase(key);

/** Every class key, sorted, filtered to the enabled editions. */
export const classKeys = (classes, editions = CLASS_EDITIONS) =>
  Object.keys(classes || {})
    .filter((k) => availableEditions(classes, k).some((e) => editions.includes(e)))
    .sort((a, b) => a.localeCompare(b));

/* ═══════════ subclass timing ═══════════ */

const subclassMinLevel = (subclass) => {
  const levels = (subclass?.features || [])
    .map((f) => num(f?.level))
    .filter((n) => Number.isFinite(n));
  return levels.length ? Math.min(...levels) : null;
};

/**
 * The level at which this class gains a subclass, read out of the data.
 * Returns null when the class has no subclasses at all.
 */
export function subclassUnlockLevel(variant) {
  const subs = variant?.subclasses || [];
  const mins = subs.map(subclassMinLevel).filter((n) => Number.isFinite(n));
  return mins.length ? Math.min(...mins) : null;
}

/** Subclasses with their own first-feature level, for the picker. */
export function subclassOptions(variant) {
  return (variant?.subclasses || []).map((sc) => ({
    name: sc.name,
    unlockLevel: subclassMinLevel(sc),
  }));
}

/* ═══════════ ASI / feat slots ═══════════ */

// A class grants a feat-or-ability-score-improvement choice wherever
// level_progression names an "Ability Score Improvement" feature — the
// same signal 5e itself uses. Derived from data, never hardcoded, so a
// class with a nonstandard progression (Fighter's extra ASIs) is counted
// correctly with no special-casing.
const ASI_RE = /ability score improvement/i;

export function asiSlotsAt(variant, level) {
  const cap = num(level) || 0;
  let count = 0;
  for (const row of variant?.class?.level_progression || []) {
    const lv = num(row.level);
    if (!Number.isFinite(lv) || lv > cap) continue;
    if ((row.feature_names || []).some((n) => ASI_RE.test(String(n)))) count += 1;
  }
  return count;
}

export const EPIC_BOON_LEVEL = 19;

export const isEpicBoonFeat = (feat) => feat?.category === "epic_boon";

export const canTakeEpicBoon = (entry) =>
  entry?.edition === "one" && (Number(entry?.level) || 0) >= EPIC_BOON_LEVEL;

/**
 * Total feat slots a class entry offers, and whether Epic Boons are in play
 * for it. Keyed to THIS class's own level, so a 10/9 split never qualifies.
 */
export function classFeatSlots({ entry, variant }) {
  const epicBoonEligible = canTakeEpicBoon(entry);
  const slots = asiSlotsAt(variant, entry.level) + (epicBoonEligible ? 1 : 0);
  return { slots, epicBoonEligible };
}

/* ═══════════ progression ═══════════ */

export const progressionRow = (variant, level) =>
  (variant?.class?.level_progression || []).find((r) => num(r.level) === num(level)) || null;

export const proficiencyBonusAt = (variant, level) =>
  progressionRow(variant, level)?.proficiency_bonus ?? null;

/**
 * Features earned at or below `level`, class features plus the selected
 * subclass's own. `class_features[].level` is a STRING in the data while
 * `level_progression[].level` and subclass `features[].level` are numbers —
 * everything is coerced here so nothing silently fails to match.
 */
export function featuresEarned(variant, level, subclassName) {
  const cap = num(level) || 0;
  const out = [];

  for (const row of variant?.class?.level_progression || []) {
    const lv = num(row.level);
    if (!Number.isFinite(lv) || lv > cap) continue;
    for (const name of row.feature_names || []) {
      out.push({ level: lv, name, from: "class" });
    }
  }

  if (subclassName) {
    const sc = (variant?.subclasses || []).find((s) => s.name === subclassName);
    for (const f of sc?.features || []) {
      const lv = num(f.level);
      if (!Number.isFinite(lv) || lv > cap) continue;
      out.push({ level: lv, name: f.name, from: "subclass" });
    }
  }

  return out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

export const isCaster = (variant) => !!variant?.class?.casterProgression;

export const spellSlotsAt = (variant, level) => {
  const slots = progressionRow(variant, level)?.spell_slots;
  return Array.isArray(slots) && slots.some((n) => n > 0) ? slots : null;
};

/** { connector, pairs } or null — surfaced as info, never enforced. */
export function multiclassRequirements(variant) {
  const req = variant?.class?.multiclassing?.requirements;
  if (!req || typeof req !== "object") return null;

  if (Array.isArray(req.or)) {
    const pairs = [];
    for (const entry of req.or) {
      if (entry && typeof entry === "object") {
        for (const [ability, score] of Object.entries(entry)) {
          if (typeof score === "number") pairs.push([ability, score]);
        }
      }
    }
    return pairs.length ? { connector: "or", pairs } : null;
  }

  const pairs = Object.entries(req).filter(([, v]) => typeof v === "number");
  return pairs.length ? { connector: "and", pairs } : null;
}

/* ═══════════ proficiency normalization ═══════════ */

/* "anyArtisansTool" → "artisan's tools"; "anyGamingSet" → "gaming set" */
const CAMEL_CATEGORY_ALIASES = {
  anyartisanstool: "artisan's tools",
  anyartisanstools: "artisan's tools",
  anymusicalinstrument: "musical instrument",
  anygamingset: "gaming set",
  anytool: "any_tool",
};

const squash = (s) => lower(s).replace(/[^a-z0-9]/g, "");

/** armor: ["light"] or [{proficiency, full}] → normalized category values. */
function readArmor(list) {
  return (list || [])
    .map((a) => (typeof a === "string" ? a : a?.proficiency))
    .filter(Boolean)
    .map((a) => {
      const v = lower(a);
      return ARMOR_CATEGORY_LABELS[v]
        ? opt(v, ARMOR_CATEGORY_LABELS[v], "armor")
        : opt(normArmor(v), titleCase(v), "armor");
    });
}

/** weapons: categories, @-tagged items, or {proficiency, optional}. */
function readWeapons(list) {
  return (list || [])
    .map((w) => {
      if (typeof w === "string") {
        // "{@item dagger|phb|daggers}" must resolve to "dagger", not "daggers"
        const { id, label } = parseTag(w);
        return WEAPON_CATEGORY_LABELS[id]
          ? opt(id, WEAPON_CATEGORY_LABELS[id], "weapons")
          : opt(normWeapon(id), label, "weapons");
      }
      const p = lower(w?.proficiency);
      if (!p) return null;
      return WEAPON_CATEGORY_LABELS[p]
        ? opt(p, WEAPON_CATEGORY_LABELS[p], "weapons")
        : opt(normWeapon(p), titleCase(p), "weapons");
    })
    .filter(Boolean);
}

/**
 * toolProficiencies: [{ "thieves' tools": true }, { "anyArtisansTool": 1 }]
 * → fixed grants for `true`, choices for numeric "any*" keys.
 */
function readTools(list) {
  const fixed = [];
  const choices = [];
  for (const group of list || []) {
    if (!group || typeof group !== "object") continue;
    for (const [key, val] of Object.entries(group)) {
      const alias = CAMEL_CATEGORY_ALIASES[squash(key)];
      if (typeof val === "number" && (alias || lower(key).startsWith("any"))) {
        choices.push({ token: alias || "any_tool", count: val });
      } else if (val === true) {
        // A category sitting in a granted slot is really an unresolved pick,
        // same promotion rule the background adapter uses.
        const token = alias || lower(key);
        if (isCategoryToken(token, "tools") || TOOL_CATEGORY_TOKENS[lower(token)]) {
          choices.push({ token, count: 1, inferred: true });
        } else {
          fixed.push(opt(normTool(key), toolLabel(key), "tools"));
        }
      }
    }
  }
  return { fixed, choices };
}

/** skills: [{ choose: { from, count } }] — "animal handling" → animalHandling */
function readSkills(list) {
  const out = [];
  for (const entry of list || []) {
    if (entry?.choose?.from) {
      out.push({
        count: entry.choose.count ?? 1,
        options: entry.choose.from.map((s) => opt(normSkill(s), skillLabel(s), "skills")),
      });
    } else if (Array.isArray(entry)) {
      // defensive: a bare list of granted skills
      out.push({ granted: entry.map((s) => opt(normSkill(s), skillLabel(s), "skills")) });
    }
  }
  return out;
}

/** The proficiency block that applies to this entry's position in the build. */
export function proficiencySourceFor(variant, isPrimary) {
  if (!variant) return null;
  return isPrimary
    ? variant.class?.startingProficiencies
    : variant.class?.multiclassing?.proficienciesGained;
}

/* ═══════════ entries ═══════════ */

export const makeClassEntry = (key, edition, level = 1) => ({
  key, edition, level, subclass: null, feats: [],
});

export const totalLevel = (entries) =>
  (entries || []).reduce((sum, e) => sum + (Number(e.level) || 0), 0);

export const levelBudget = (entries, exceptKey, cap = MAX_CHARACTER_LEVEL) =>
  cap -
  (entries || []).reduce((s, e) => (e.key === exceptKey ? s : s + (Number(e.level) || 0)), 0);
/* ═══════════ choices ═══════════ */

const idFor = (entry, suffix) => `class.${entry.key}.${suffix}`;

/**
 * Every pending decision the current class entries create.
 * `choiceSel` is read for the equipment-vs-gold branch, which suppresses
 * the individual kit groups when the player takes gold instead.
 */
export function classChoices(entries, classes, choiceSel = {}) {
  const out = [];

  (entries || []).forEach((entry, index) => {
    const variant = classVariant(classes, entry.key, entry.edition);
    if (!variant) return;

    const isPrimary = index === 0;
    const owner = classDisplayName(classes, entry.key, entry.edition);

    /* ── subclass ── */
    const unlock = subclassUnlockLevel(variant);
    if (unlock != null && (Number(entry.level) || 0) >= unlock) {
      out.push({
        id: idFor(entry, "subclass"),
        scope: "class",
        kind: "subclass",
        family: null,
        count: 1,
        owner,
        classKey: entry.key,
        unlockLevel: unlock,
        satisfied: !!entry.subclass,
        subclassLabel: "Subclass",
        options: subclassOptions(variant).map((s) => opt(s.name, s.name, "subclass")),
      });
    }

    /* ── proficiencies ── */
    const profs = proficiencySourceFor(variant, isPrimary);
    if (profs) {
      readSkills(profs.skills).forEach((sk, i) => {
        if (!sk.options) return;
        out.push({
          id: idFor(entry, `prof.skills.${i}`),
          scope: "class", kind: "proficiency", family: "skills",
          count: sk.count, owner, options: sk.options,
        });
      });

      readTools(profs.toolProficiencies).choices.forEach((tc, i) => {
        out.push({
          id: idFor(entry, `prof.tools.${i}`),
          scope: "class", kind: "proficiency", family: "tools",
          count: tc.count, owner,
          inferred: !!tc.inferred, inferredFrom: tc.inferred ? tc.token : undefined,
          options: expandTokens([tc.token], "tools"),
        });
      });
    }

    /* ── starting equipment (primary class only) ── */
    if (!isPrimary) return;
    const se = variant.class?.startingEquipment;
    if (!se) return;

    const goldAlt = se.goldAlternative;
    const modeId = idFor(entry, "equipmentMode");
    let takingGold = false;

    if (goldAlt) {
      const sel = Array.isArray(choiceSel[modeId]) ? choiceSel[modeId] : [];
      takingGold = sel[0] === "GOLD";
      out.push({
        id: modeId,
        scope: "class", kind: "equipment", family: "equipment",
        count: 1, owner,
        branches: [
          { key: "KIT", summary: "Take the starting equipment below", items: [] },
          { key: "GOLD", summary: `Roll for gold instead — ${cleanDice(goldAlt)}`, items: [] },
        ],
        options: [opt("KIT", "Starting equipment", "equipment"), opt("GOLD", "Gold instead", "equipment")],
      });
    }

    if (takingGold) return; // kit groups are moot

    const { choiceGroups } = parseStartingEquipment(se.defaultData);
    choiceGroups.forEach((g) => {
      out.push({
        id: idFor(entry, `equipment.${g.index}`),
        scope: "class", kind: "equipment", family: "equipment",
        count: 1, owner,
        branches: g.branches.map((b) => ({
          ...b,
          summary: b.items.length ? b.items.map((i) => i.label).join(", ") : "Nothing",
        })),
        options: g.branches.map((b) => opt(b.key, b.key, "equipment")),
      });
    });
  });

  return out;
}

/** "{@dice 5d4 × 10|5d4 × 10|Starting Gold}" → "5d4 × 10 gp" */
export function cleanDice(raw) {
  const { label } = parseTag(raw);
  const m = String(raw).match(/\{@dice\s([^|}]+)/);
  return `${(m ? m[1] : label).trim()} gp`;
}

/* ═══════════ fixed grants ═══════════ */

/**
 * Always-granted proficiencies and kit items from the class entries, in the
 * shape collectGrants' `extraFixed` expects. Kept here rather than inside
 * collectGrants so choiceEngine never has to learn the class schema.
 */
export function classFixedGrants(entries, classes) {
  const out = [];

  (entries || []).forEach((entry, index) => {
    const variant = classVariant(classes, entry.key, entry.edition);
    if (!variant) return;

    const isPrimary = index === 0;
    const owner = classDisplayName(classes, entry.key, entry.edition);
    const push = (o) =>
      out.push({ value: o.value, family: o.family, owner, scope: "class", viaChoice: null });

    const profs = proficiencySourceFor(variant, isPrimary);
    if (profs) {
      readArmor(profs.armor).forEach(push);
      readWeapons(profs.weapons).forEach(push);
      readTools(profs.toolProficiencies).fixed.forEach(push);
      readSkills(profs.skills).forEach((sk) => (sk.granted || []).forEach(push));
    }

    if (!isPrimary) return;
    const { granted } = parseStartingEquipment(variant.class?.startingEquipment?.defaultData);
    granted.forEach((item) =>
      out.push({
        value: item.id, family: "equipment", owner, scope: "class",
        viaChoice: null, label: item.label, gp: item.gp,
      })
    );
  });

  return out;
}

/* ═══════════ derived stats ═══════════ */

/**
 * Proficiency bonus is a function of TOTAL character level, not of any one
 * class's level, so it is read from the primary class's progression table at
 * the combined level. The table is identical across classes, so this is a
 * data lookup rather than a hardcoded formula.
 */
export function derivedStats(entries, classes) {
  const total = totalLevel(entries);
  const rows = (entries || [])
    .map((e) => ({ entry: e, variant: classVariant(classes, e.key, e.edition) }))
    .filter((r) => r.variant);

  const primary = rows[0];
  const proficiencyBonus = primary
    ? proficiencyBonusAt(primary.variant, Math.min(total, MAX_CHARACTER_LEVEL))
    : null;

  const hitDice = rows.map(({ entry, variant }) => ({
    label: `${entry.level}${variant.class?.hit_dice || "?"}`,
    die: variant.class?.hit_dice,
    count: entry.level,
    owner: classDisplayName(classes, entry.key, entry.edition),
  }));

  const saves = [];
  if (primary) {
    for (const s of primary.variant.class?.saving_throw_proficiency || []) {
      saves.push(lower(s));
    }
  }

  const casters = rows.filter((r) => isCaster(r.variant));
  let spellSlots = null;
  let spellNote = null;

  if (casters.length === 1) {
    const c = casters[0];
    spellSlots = spellSlotsAt(c.variant, c.entry.level);
  } else if (casters.length > 1) {
    // Multiclass spellcasting uses a combined caster level, which is its own
    // ruleset. Saying nothing would be worse than saying "not computed".
    spellNote = `${casters.length} spellcasting classes — combined slots not calculated yet`;
  }

  return {
    totalLevel: total,
    proficiencyBonus,
    hitDice,
    saves,
    spellSlots,
    spellNote,
    casterCount: casters.length,
  };
}

/* ═══════════ experience ═══════════ */

/** Minimum XP to be at `level`. Clamped to the table's bounds. */
export function xpForLevel(level) {
  const n = Number(level) || 0;
  if (n <= 0) return 0;
  return XP_BY_LEVEL[Math.min(n, XP_BY_LEVEL.length - 1)] ?? 0;
}

/* ═══════════ hit points ═══════════ */

export const HP_MODES = ["average", "roll", "manual"];

/** "d10" → 10 */
export const hitDieMax = (die) => {
  const m = String(die || "").match(/^d(\d+)$/i);
  return m ? Number(m[1]) : 0;
};

/** 5e "average" rounding: d6→4, d8→5, d10→6, d12→7 */
export const hitDieAverage = (die) => {
  const max = hitDieMax(die);
  return max ? Math.floor(max / 2) + 1 : 0;
};

/**
 * The per-level hit-die sequence for a build, in order.
 * Entry 0 — the first level of the FIRST class — is flagged `first`, since
 * that level always takes the die's maximum rather than an average or a
 * roll. Every later level, including the first level of a multiclass, is
 * normal.
 */
export function hpLevels(entries, classes) {
  const out = [];
  (entries || []).forEach((entry, ci) => {
    const die = classVariant(classes, entry.key, entry.edition)?.class?.hit_dice || "";
    const levels = Number(entry.level) || 0;
    for (let i = 0; i < levels; i += 1) {
      out.push({
        classKey: entry.key,
        classLevel: i + 1,
        die,
        first: ci === 0 && i === 0,
      });
    }
  });
  return out;
}

/**
 * Roll a fresh die value for every non-first level, keyed by class so the
 * rolls survive re-ordering. The first level is stored as the die max so the
 * stored array and the computed total always agree.
 */
export function rollHp(entries, classes, rng = Math.random) {
  const rolls = {};
  for (const lv of hpLevels(entries, classes)) {
    if (!rolls[lv.classKey]) rolls[lv.classKey] = [];
    const max = hitDieMax(lv.die);
    rolls[lv.classKey].push(lv.first ? max : 1 + Math.floor(rng() * max));
  }
  return rolls;
}

/**
 * Total max HP.
 *
 *   level 1 of the first class → the die's maximum
 *   every other level          → average, or the stored roll
 *   plus CON mod per character level
 *
 * A level can never contribute less than 1 HP, which only matters with a
 * negative CON modifier — hence the per-level floor rather than adding
 * `conMod * totalLevel` at the end.
 */
export function computeHp({ entries, classes, conMod = 0, mode = "average", manual = 0, rolls = {} }) {
  if (mode === "manual") {
    const n = Number(manual);
    return { total: Number.isFinite(n) ? Math.max(0, n) : 0, rows: [], mode };
  }

  const con = Number(conMod) || 0;
  const used = {};
  const rows = [];
  let total = 0;

  for (const lv of hpLevels(entries, classes)) {
    const i = used[lv.classKey] || 0;
    used[lv.classKey] = i + 1;

    let base;
    if (lv.first) base = hitDieMax(lv.die);
    else if (mode === "roll") base = Number(rolls?.[lv.classKey]?.[i]) || hitDieAverage(lv.die);
    else base = hitDieAverage(lv.die);

    const gain = Math.max(1, base + con);
    total += gain;
    rows.push({ ...lv, base, con, gain });
  }

  return { total, rows, mode };
}

/** Unresolved optionalfeatureProgression entries (Fighting Style, etc). */
export function pendingOptionalFeatures(entries, classes) {
  const out = [];
  (entries || []).forEach((entry) => {
    const variant = classVariant(classes, entry.key, entry.edition);
    const owner = classDisplayName(classes, entry.key, entry.edition);
    for (const ofp of variant?.class?.optionalfeatureProgression || []) {
      let count = 0;
      for (const [lv, n] of Object.entries(ofp.progression || {})) {
        if (Number(lv) <= (Number(entry.level) || 0)) count = Math.max(count, Number(n) || 0);
      }
      if (count > 0) out.push({ name: ofp.name, count, owner, featureType: ofp.featureType });
    }
  });
  return out;
}