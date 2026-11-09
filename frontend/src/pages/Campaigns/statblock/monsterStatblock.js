import {
  ABILITY,
  ABILITY_ORDER,
  CR_OPTIONS,
  EFFECT_SECTIONS,
  abilityMod,
  crStats,
  formatTypedBlock,
  formatXp,
  getMonsterSubtypes,
  getMonsterType,
  titleCase,
} from "../../Catalogues/Monsters/monsterHelpers";
import { effectChips, rechargeLabel } from "../../Characters/sheet/minions/minionHelpers";
import { idGen } from "../../Characters/sheet/define/effectEditor";
import { CONDITION_OPTIONS, DAMAGE_TYPES, LANGUAGE_OPTIONS, SKILL_OPTIONS } from "../../../utils/Constants";

/* ═══════════════════════════════════════════════════════════════════
   monsterStatblock.js — a campaign's monster, as the statblock card sees it.

   Same three exports as characterStatblock.js, so both draw with the
   same card (Statblock.jsx):

     monsterView(raw)   what to draw; rows carry ref = { list, id }
     MONSTER_EDITS      get/set pairs for single values
     MONSTER_ACTIONS    whole-row changes by ref, uses, adding

   plus prepareMonster(entry): a catalogue monster made ready to keep in
   a campaign (ids on its rows, current HP, uses filled). The file keeps
   the catalogue layout (see MonsterCreatePopup) with a few extras:

     hp_current, hp_temp            how hurt it is right now
     effects.<section>.items[]      + id, active (false = hidden), and
                                    charges.current_charges
     spellcasting[] / groups[] / spells[]
                                    + id; group.current (shared uses),
                                    spell.current ("each" uses)
     gear[]                         + id
     legendary_action_points.current
     dm_notes, catalogue { name, source }

   Every function returns a new object; nothing is changed in place.
   ═══════════════════════════════════════════════════════════════════ */

const asList = (v) => (Array.isArray(v) ? v : []);
const toInt = (v, fallback = 0) => {
  if (v === "" || v == null) return fallback;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
};
const signed = (n) => `${n >= 0 ? "+" : ""}${n}`;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export const SIZES = [
  { value: "T", label: "Tiny" },
  { value: "S", label: "Small" },
  { value: "M", label: "Medium" },
  { value: "L", label: "Large" },
  { value: "H", label: "Huge" },
  { value: "G", label: "Gargantuan" },
];
const sizeName = (s) => SIZES.find((x) => x.value === s)?.label || s;

const SPEED_MODES = ["fly", "swim", "climb", "burrow"];
const SENSES = ["darkvision", "blindsight", "tremorsense", "truesight"];

// Damage / condition blocks keep the catalogue shape { types, conditional, special }.
const DEFENSES = [
  { key: "resistances", label: "Resistances", options: DAMAGE_TYPES },
  { key: "immunities", label: "Immunities", options: DAMAGE_TYPES },
  { key: "vulnerabilities", label: "Vulnerabilities", options: DAMAGE_TYPES },
  { key: "condition_immunities", label: "Condition Immunities", options: CONDITION_OPTIONS.map((c) => c.toLowerCase()) },
];

/* ─── small readers ──────────────────────────────────────────────── */

export const pbOf = (m) => {
  const pb = toInt(m?.cr?.pb, NaN);
  return Number.isFinite(pb) ? pb : crStats(m?.cr?.base)?.pb ?? 2;
};
export const hpMaxOf = (m) => Math.max(0, toInt(m?.hp?.average, 0));
export const hpCurOf = (m) => clamp(toInt(m?.hp_current, hpMaxOf(m)), 0, Math.max(hpMaxOf(m), 0) || Infinity);
const acOf = (m) => toInt(asList(m?.ac)[0]?.value, null);
export const speedNum = (v) => (typeof v === "number" ? v : typeof v?.number === "number" ? v.number : null);
const scoresOf = (m) => m?.ability_scores || {};
const scoreOf = (m, a) => toInt(scoresOf(m)[a]?.score, 10);
export const saveOf = (m, a) => {
  const row = scoresOf(m)[a] || {};
  const mod = abilityMod(scoreOf(m, a));
  return Number.isFinite(Number(row.save)) ? Number(row.save) : mod + (row.proficient ? pbOf(m) : 0);
};
export const initiativeOf = (m) => toInt(m?.initiative?.total, abilityMod(scoreOf(m, "dex")));

// The catalogue writes skill keys either like the constants ("animalHandling")
// or in plain words ("animal handling"); both are matched.
export const squash = (k) => String(k || "").replace(/[\s_]+/g, "").toLowerCase();
export const SKILL_KEY = Object.fromEntries(Object.keys(SKILL_OPTIONS).map((k) => [squash(k), k]));
export const skillBonus = (m, key) => {
  const hit = Object.entries(m?.skill || {}).find(([k]) => squash(k) === squash(key));
  return hit ? toInt(String(hit[1]).replace("+", ""), null) : null;
};
const passiveOf = (m) => 10 + (skillBonus(m, "perception") ?? abilityMod(scoreOf(m, "wis")));

// Uses an effect item can spend, or null.
const usesOf = (charges) => {
  if (!charges) return null;
  const max = toInt(charges.max_charges ?? charges.per_rest_count, 0);
  if (max <= 0) return null;
  return { max, cur: clamp(toInt(charges.current_charges, max), 0, max) };
};

/* ─── where rows live ────────────────────────────────────────────── */

const SECTION_KEYS = EFFECT_SECTIONS.map((s) => s.key);
const isSection = (list) => SECTION_KEYS.includes(list);

const itemsOf = (m, list) => asList(m?.effects?.[list]?.items);
const withItems = (m, list, items) => ({
  ...m,
  effects: { ...(m?.effects || {}), [list]: { ...(m?.effects?.[list] || {}), items } },
});

const blocksOf = (m) => asList(m?.spellcasting);
const withBlocks = (m, blocks) => ({ ...m, spellcasting: blocks });
// Change every group (or spell) with a matching id, wherever it is.
const mapGroups = (m, fn) => withBlocks(m, blocksOf(m).map((b) => ({ ...b, groups: asList(b.groups).map(fn) })));
const findGroup = (m, id) => {
  for (const b of blocksOf(m)) for (const g of asList(b.groups)) if (g?.id === id) return g;
  return null;
};
const findSpell = (m, id) => {
  for (const b of blocksOf(m)) for (const g of asList(b.groups)) for (const s of asList(g.spells)) if (s?.id === id) return { group: g, spell: s };
  return null;
};

/* ─── catalogue → campaign copy ──────────────────────────────────── */

const withId = (row) => ({ ...row, id: row?.id || idGen() });

export function prepareMonster(entry) {
  // The catalogue's own id and visibility belong to the catalogue, not the copy.
  const { visibility, id, ...copy } = structuredClone(entry || {});
  const effects = {};
  for (const [key, block] of Object.entries(copy.effects || {})) {
    effects[key] = {
      ...block,
      items: asList(block?.items).map((it) => {
        const row = { ...withId(it), active: true };
        const uses = usesOf(it?.charges);
        if (uses) row.charges = { ...it.charges, current_charges: uses.max };
        return row;
      }),
    };
  }
  const spellcasting = asList(copy.spellcasting).map((b) => ({
    ...withId(b),
    groups: asList(b?.groups).map((g) => ({ ...withId(g), spells: asList(g?.spells).map(withId) })),
  }));
  const out = {
    ...copy,
    effects,
    gear: asList(copy.gear).map(withId),
    hp_current: hpMaxOf(copy),
    hp_temp: 0,
    dm_notes: "",
    catalogue: { name: entry?.name ?? null, source: entry?.source ?? null },
  };
  if (spellcasting.length) out.spellcasting = spellcasting;
  if (out.legendary_action_points?.legendary_actions != null) {
    out.legendary_action_points = { ...out.legendary_action_points, current: toInt(out.legendary_action_points.legendary_actions, 0) };
  }
  return out;
}

/* ─── header lines ───────────────────────────────────────────────── */

const typeWord = (m) => {
  const subs = getMonsterSubtypes(m);
  return `${titleCase(getMonsterType(m))}${subs.length ? ` (${subs.join(", ")})` : ""}`;
};
const subtitleOf = (m) => {
  const head = [asList(m?.size).map(sizeName).join(" or "), typeWord(m)].filter(Boolean).join(" ");
  const align = asList(m?.alignment).join(" ");
  return [head, align].filter(Boolean).join(", ");
};

const crLine = (m) => {
  const cr = m?.cr;
  if (!cr) return { value: "—", sub: null };
  if (cr.level != null) return { value: `Lv ${cr.level}`, sub: `PB ${signed(pbOf(m))}` };
  const xp = toInt(cr.xp, crStats(cr.base)?.xp ?? NaN);
  return { value: String(cr.base ?? "—"), sub: [Number.isFinite(xp) ? `${formatXp(xp)} XP` : "", `PB ${signed(pbOf(m))}`].filter(Boolean).join(" · ") };
};

/* ─── traits, actions… ───────────────────────────────────────────── */

export function entryFrom(list, it) {
  const uses = usesOf(it.charges);
  const recharge = rechargeLabel(it.charges);
  const parts = effectChips(it).map((c) => c.text);
  if (it.charges?.reset_type === "recharge_dice") parts.push(recharge);
  return {
    // Rows a template gives (see templateLogic) keep their uses on the creature's template_uses.
    ref: it.from_template ? { list, id: it.id, template: true } : { list, id: it.id },
    name: it.name || "Unnamed",
    tag: null,
    fromTemplate: it.from_template || null,
    catalogue: null,
    roll: parts.join(" · "),
    uses,
    regain: uses ? (recharge ? `${uses.max} ${recharge}` : "") : "",
    text: String(it.notes || "").trim(),
    inactive: it.active === false,
  };
}

export function sectionsOf(m, editing) {
  const legendaryMax = toInt(m?.legendary_action_points?.legendary_actions, 0);
  return EFFECT_SECTIONS.map(({ key, title }) => {
    const entries = itemsOf(m, key)
      .filter((it) => it && (editing || it.active !== false))
      .map((it) => entryFrom(key, it));
    const section = { key, title, entries };
    if (key === "legendary_actions" && (legendaryMax > 0 || (editing && entries.length))) {
      section.pool = {
        label: "legendary action",
        max: legendaryMax,
        cur: clamp(toInt(m?.legendary_action_points?.current, legendaryMax), 0, legendaryMax),
        ref: { list: "legendary" },
        edit: "legendaryMax",
      };
    }
    return section;
  }).filter((s) => s.entries.length > 0);
}

/* ─── spells ─────────────────────────────────────────────────────── */

const ABILITY_OPTIONS = ABILITY_ORDER.map((a) => ({ value: a, label: ABILITY[a] }));

export function spellcastingOf(m) {
  const blocks = blocksOf(m).map((b) => {
    const line = [
      b.ability ? ABILITY[b.ability] || String(b.ability).toUpperCase() : "",
      b.save_dc != null ? `spell save DC ${b.save_dc}` : "",
      b.spell_attack_bonus != null ? `${signed(toInt(b.spell_attack_bonus))} to hit` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      ref: { list: "spellblock", id: b.id },
      title: b.name || "Spellcasting",
      line,
      notes: String(b.notes || "").trim(),
      ability: b.ability || "",
      saveDc: b.save_dc ?? null,
      attack: b.spell_attack_bonus ?? null,
      groups: asList(b.groups).map((g) => {
        const max = toInt(g.uses, 0);
        const label = g.label || (max ? `${max}/day${g.each ? " each" : ""}` : "At will");
        return {
          ref: g.from_template ? { list: "spellgroup", id: g.id, template: true } : { list: "spellgroup", id: g.id },
          label,
          rawLabel: g.label || "",
          max: g.uses == null || g.uses === "" ? null : max,
          each: !!g.each,
          // Shared uses ("2/day" for the whole list) sit on the group…
          uses: max > 0 && !g.each ? { max, cur: clamp(toInt(g.current, max), 0, max) } : null,
          spells: asList(g.spells)
            .filter((s) => s?.name)
            .map((s) => ({
              ref: s.from_template ? { list: "spell", id: s.id, template: true } : { list: "spell", id: s.id },
              name: titleCase(s.name) + (s.note ? ` (${s.note})` : ""),
              catalogue: { type: "spell", name: s.name, source: s.source || null },
              // …"each" uses sit on every spell.
              uses: max > 0 && g.each ? { max, cur: clamp(toInt(s.current, max), 0, max) } : null,
            })),
        };
      }),
    };
  });
  return { kind: "groups", empty: !blocks.some((b) => b.groups.some((g) => g.spells.length)), abilityOptions: ABILITY_OPTIONS, blocks };
}

/* ─── gear ───────────────────────────────────────────────────────── */

export function equipmentOf(m) {
  const gear = asList(m?.gear)
    .filter((g) => g?.name)
    .map((g) => ({
      ref: { list: "gear", id: g.id },
      name: g.name,
      catalogue: g.source ? { type: "item", name: g.name, source: g.source } : null,
      amount: toInt(g.quantity, 1),
    }));
  return { empty: !gear.length, magic: [], gear, coins: null };
}

/* ─── the view ───────────────────────────────────────────────────── */

export function monsterView(m, { editing = false } = {}) {
  const pb = pbOf(m);
  const max = hpMaxOf(m);
  const temp = toInt(m?.hp_temp, 0);
  const otherSpeeds = SPEED_MODES.filter((k) => speedNum(m?.speed?.[k]) > 0).map((k) => `${k} ${speedNum(m.speed[k])} ft`);
  if (m?.speed?.hover || m?.speed?.canHover) otherSpeeds.push("hover");
  const cr = crLine(m);
  const ac = acOf(m);
  const acFrom = asList(asList(m?.ac)[0]?.from).join(", ");

  const saves = ABILITY_ORDER.filter((a) => scoresOf(m)[a]?.proficient).map((a) => `${ABILITY[a]} ${signed(saveOf(m, a))}`);
  const skills = Object.entries(m?.skill || {}).map(([k, v]) => `${SKILL_OPTIONS[SKILL_KEY[squash(k)]]?.label || titleCase(k)} ${signed(toInt(String(v).replace("+", ""), 0))}`);
  const senses = SENSES.filter((k) => toInt(m?.senses?.[k], 0) > 0).map((k) => `${titleCase(k)} ${toInt(m.senses[k])} ft`);
  senses.push(`passive Perception ${toInt(m?.passive_perception, passiveOf(m))}`);

  const fields = (list) => ({ type: "fields", fields: list });
  const lines = [
    { label: "Saving Throws", text: saves.join(", ") },
    { label: "Skills", text: skills.join(", ") },
    ...DEFENSES.map((d) => ({
      label: d.label,
      text: formatTypedBlock(m?.[d.key]),
      editor: { type: "chips", edit: "list", arg: d.key, options: d.options },
    })),
    {
      label: "Senses",
      text: senses.join(", "),
      editor: fields(SENSES.map((k) => ({ kind: "number", edit: "sense", arg: k, label: k, suffix: "ft" }))),
    },
    {
      label: "Other speeds",
      text: editing ? "" : null,
      editor: fields([...SPEED_MODES.map((k) => ({ kind: "number", edit: "speedMode", arg: k, label: k, suffix: "ft", step: 5 })), { kind: "mark", edit: "hover", label: "hover" }]),
    },
    {
      label: "Languages",
      text: asList(m?.languages).join(", "),
      editor: { type: "chips", edit: "list", arg: "languages", options: LANGUAGE_OPTIONS, keepCase: true },
    },
    {
      label: "Size & type",
      text: editing ? "" : null,
      editor: fields([
        { kind: "select", edit: "size", label: "size", options: [{ value: "", label: "—" }, ...SIZES] },
        { kind: "text", edit: "type", label: "type", placeholder: "undead" },
        { kind: "text", edit: "alignment", label: "alignment", placeholder: "Lawful Evil", wide: true },
      ]),
    },
  ].filter((l) => (editing ? l.text != null && (l.text || l.editor) : l.text));

  return {
    kind: "monster",
    name: m?.name || "Unnamed",
    subtitle: subtitleOf(m),
    vitals: [
      { key: "ac", label: "Armor Class", value: ac == null ? "—" : String(ac), sub: acFrom || null, inputs: [{ edit: "ac", label: "Armor class", min: 0, max: 40 }] },
      {
        key: "hp",
        label: "Hit Points",
        value: String(hpCurOf(m)),
        sub: [`of ${max}`, temp > 0 ? `${temp} temp` : "", m?.hp?.formula ? `(${m.hp.formula})` : ""].filter(Boolean).join(" · "),
        inputs: [{ edit: "hpCurrent", label: "Current hit points", min: 0 }, { text: "of" }, { edit: "hpMax", label: "Maximum hit points", min: 0, size: "md" }],
        extra: [{ text: "temp" }, { edit: "hpTemp", label: "Temporary hit points", min: 0, size: "sm" }],
      },
      {
        key: "speed",
        label: "Speed",
        value: `${speedNum(m?.speed?.walk) ?? 0} ft`,
        sub: otherSpeeds.join(", ") || null,
        inputs: [{ edit: "speed", label: "Walking speed", min: 0, step: 5 }, { text: "ft" }],
        editSub: "other speeds below",
      },
      {
        key: "initiative",
        label: "Initiative",
        value: signed(initiativeOf(m)),
        sub: m?.initiative?.advantage ? "with advantage" : null,
        inputs: [{ edit: "initiative", label: "Initiative", size: "md", min: -10, max: 30 }, { mark: "initiativeAdv", label: "advantage" }],
      },
      {
        key: "cr",
        label: "Challenge",
        value: cr.value,
        sub: cr.sub,
        inputs: [{ select: "cr", label: "Challenge rating", options: CR_OPTIONS.map((c) => ({ value: c, label: c })) }],
        editSub: cr.sub,
      },
    ],
    abilities: ABILITY_ORDER.map((a) => ({
      key: a,
      short: ABILITY[a],
      score: scoreOf(m, a),
      mod: signed(abilityMod(scoreOf(m, a))),
      save: signed(saveOf(m, a)),
      saveProf: !!scoresOf(m)[a]?.proficient,
    })),
    skillMode: "bonus",
    skills: Object.entries(SKILL_OPTIONS).map(([key, s]) => {
      const bonus = skillBonus(m, key);
      return { key, label: s.label, ability: ABILITY[s.ability] || "", bonus, total: bonus == null ? "" : signed(bonus) };
    }),
    lines,
    sections: sectionsOf(m, editing),
    spellcasting: spellcastingOf(m),
    equipment: equipmentOf(m),
    about: [],
    notes: String(m?.dm_notes || ""),
    notesPlaceholder: "How it fights, what it wants, where it lairs…",
    editingNote: "Editing this campaign's copy only — the catalogue monster is not touched.",
  };
}

/* ─── single values ──────────────────────────────────────────────── */

// Ability rows keep the catalogue's derived numbers (mod, save) up to date.
export const withScores = (m, pb = pbOf(m)) => {
  const out = {};
  for (const a of ABILITY_ORDER) {
    const row = scoresOf(m)[a] || {};
    const score = toInt(row.score, 10);
    const mod = abilityMod(score);
    out[a] = { ...row, score, proficient: !!row.proficient, mod, save: mod + (row.proficient ? pb : 0) };
  }
  return { ...m, ability_scores: out };
};
export const withPassive = (m) => ({ ...m, passive_perception: passiveOf(m) });

const withHp = (m, max) => {
  const { formula, ...hp } = m?.hp || {}; // a hand-set maximum no longer matches the dice
  return { ...m, hp: { ...hp, average: max } };
};

const typeOf = (m) => (typeof m?.type === "string" ? { type: m.type, tags: [] } : { type: m?.type?.type || "", tags: asList(m?.type?.tags) });

export const MONSTER_EDITS = {
  name: { get: (m) => m?.name ?? "", set: (m, v) => ({ ...m, name: v }) },
  ac: {
    get: (m) => acOf(m),
    set: (m, v) => {
      const [first, ...rest] = asList(m?.ac);
      return { ...m, ac: [{ ...(first || {}), value: v ?? 0 }, ...rest] };
    },
  },
  hpCurrent: { get: (m) => hpCurOf(m), set: (m, v) => ({ ...m, hp_current: clamp(v ?? 0, 0, hpMaxOf(m)) }) },
  hpMax: {
    get: (m) => hpMaxOf(m),
    // Current HP follows when it was full, and never ends up above the new max.
    set: (m, v) => {
      const max = Math.max(0, v ?? 0);
      const cur = hpCurOf(m);
      return { ...withHp(m, max), hp_current: cur >= hpMaxOf(m) ? max : Math.min(cur, max) };
    },
  },
  hpTemp: { get: (m) => toInt(m?.hp_temp, 0), set: (m, v) => ({ ...m, hp_temp: Math.max(0, v ?? 0) }) },
  speed: { get: (m) => speedNum(m?.speed?.walk) ?? 0, set: (m, v) => ({ ...m, speed: { ...(m?.speed || {}), walk: v ?? 0 } }) },
  speedMode: {
    get: (m, k) => speedNum(m?.speed?.[k]),
    set: (m, k, v) => {
      const speed = { ...(m?.speed || {}) };
      if (v == null || v <= 0) delete speed[k];
      else speed[k] = v;
      return { ...m, speed };
    },
  },
  hover: { get: (m) => !!(m?.speed?.hover || m?.speed?.canHover), set: (m, v) => ({ ...m, speed: { ...(m?.speed || {}), hover: v } }) },
  initiative: { get: (m) => initiativeOf(m), set: (m, v) => ({ ...m, initiative: { ...(m?.initiative || {}), total: v ?? 0 } }) },
  initiativeAdv: {
    get: (m) => !!m?.initiative?.advantage,
    set: (m, v) => ({ ...m, initiative: { total: initiativeOf(m), ...(m?.initiative || {}), advantage: v } }),
  },
  // XP and proficiency come from the challenge rating, and the saves follow.
  cr: {
    get: (m) => (m?.cr?.base != null ? String(m.cr.base) : ""),
    set: (m, v) => {
      const stats = crStats(v);
      const next = { ...m, cr: { base: v, xp: stats?.xp ?? null, pb: stats?.pb ?? 2 } };
      return withScores(next, stats?.pb ?? 2);
    },
  },
  score: {
    get: (m, a) => scoreOf(m, a),
    set: (m, a, v) => withPassive(withScores({ ...m, ability_scores: { ...scoresOf(m), [a]: { ...(scoresOf(m)[a] || {}), score: v ?? 10 } } })),
  },
  saveProf: {
    get: (m, a) => !!scoresOf(m)[a]?.proficient,
    set: (m, a, v) => withScores({ ...m, ability_scores: { ...scoresOf(m), [a]: { ...(scoresOf(m)[a] || {}), proficient: v } } }),
  },
  // A number shows the skill on the statblock; blank takes it off.
  skillBonus: {
    get: (m, key) => skillBonus(m, key),
    set: (m, key, v) => {
      const skill = Object.fromEntries(Object.entries(m?.skill || {}).filter(([k]) => squash(k) !== squash(key)));
      if (v != null) skill[key] = signed(v);
      return withPassive({ ...m, skill });
    },
  },
  sense: {
    get: (m, k) => (toInt(m?.senses?.[k], 0) > 0 ? toInt(m.senses[k]) : null),
    set: (m, k, v) => {
      const senses = { ...(m?.senses || {}) };
      if (v == null || v <= 0) delete senses[k];
      else senses[k] = v;
      return { ...m, senses };
    },
  },
  // Lists picked from fixed words: defenses ({ types }) and languages (plain list).
  list: {
    get: (m, key) => (key === "languages" ? asList(m?.languages) : asList(m?.[key]?.types)),
    set: (m, key, values) => (key === "languages" ? { ...m, languages: values } : { ...m, [key]: { ...(m?.[key] || {}), types: values } }),
  },
  size: { get: (m) => asList(m?.size)[0] || "", set: (m, v) => ({ ...m, size: v ? [v] : [] }) },
  type: {
    get: (m) => typeOf(m).type,
    set: (m, v) => {
      const t = typeOf(m);
      return { ...m, type: t.tags.length ? { type: v, tags: t.tags } : v };
    },
  },
  alignment: { get: (m) => asList(m?.alignment).join(" "), set: (m, v) => ({ ...m, alignment: v.trim() ? [v] : [] }) },
  legendaryMax: {
    get: (m) => toInt(m?.legendary_action_points?.legendary_actions, 0),
    set: (m, v) => {
      const max = Math.max(0, v ?? 0);
      return { ...m, legendary_action_points: { ...(m?.legendary_action_points || {}), legendary_actions: max, current: max } };
    },
  },
  notes: { get: (m) => m?.dm_notes ?? "", set: (m, v) => ({ ...m, dm_notes: v }) },
};

/* ─── whole rows ─────────────────────────────────────────────────── */

export const newMonsterItem = () => ({ id: idGen(), name: "", effect_type: "utility", notes: "", active: true });

const replaceIn = (rows, id, next) => rows.map((r) => (r?.id === id ? next : r));
const without = (rows, id) => rows.filter((r) => r?.id !== id);

export const MONSTER_ACTIONS = {
  sections: EFFECT_SECTIONS,

  row: (m, ref) => {
    if (isSection(ref.list)) return itemsOf(m, ref.list).find((r) => r?.id === ref.id) || null;
    if (ref.list === "gear") return asList(m?.gear).find((r) => r?.id === ref.id) || null;
    if (ref.list === "spellblock") return blocksOf(m).find((b) => b?.id === ref.id) || null;
    if (ref.list === "spellgroup") return findGroup(m, ref.id);
    if (ref.list === "spell") return findSpell(m, ref.id)?.spell || null;
    return null;
  },

  replace: (m, ref, next) => {
    if (isSection(ref.list)) return withItems(m, ref.list, replaceIn(itemsOf(m, ref.list), ref.id, next));
    if (ref.list === "gear") return { ...m, gear: replaceIn(asList(m?.gear), ref.id, next) };
    if (ref.list === "spellblock") return withBlocks(m, replaceIn(blocksOf(m), ref.id, next));
    if (ref.list === "spellgroup") return mapGroups(m, (g) => (g?.id === ref.id ? next : g));
    if (ref.list === "spell") return mapGroups(m, (g) => ({ ...g, spells: replaceIn(asList(g.spells), ref.id, next) }));
    return m;
  },

  remove: (m, ref) => {
    if (isSection(ref.list)) return withItems(m, ref.list, without(itemsOf(m, ref.list), ref.id));
    if (ref.list === "gear") return { ...m, gear: without(asList(m?.gear), ref.id) };
    if (ref.list === "spellblock") return withBlocks(m, without(blocksOf(m), ref.id));
    if (ref.list === "spellgroup") return withBlocks(m, blocksOf(m).map((b) => ({ ...b, groups: without(asList(b.groups), ref.id) })));
    if (ref.list === "spell") return mapGroups(m, (g) => ({ ...g, spells: without(asList(g.spells), ref.id) }));
    return m;
  },

  // Move an entry to another section (an action that should be a bonus action…).
  move: (m, ref, toList) => {
    const row = MONSTER_ACTIONS.row(m, ref);
    if (!row || !isSection(toList) || toList === ref.list) return { raw: m, ref };
    const out = withItems(MONSTER_ACTIONS.remove(m, ref), toList, [...itemsOf(m, toList), row]);
    return { raw: out, ref: { list: toList, id: ref.id } };
  },

  // Spend or regain: `cur` is the new number left.
  setUses: (m, ref, cur) => {
    if (ref.template) return { ...m, template_uses: { ...(m?.template_uses || {}), [ref.id]: cur } };
    if (ref.list === "legendary") {
      return { ...m, legendary_action_points: { ...(m?.legendary_action_points || {}), current: cur } };
    }
    const row = MONSTER_ACTIONS.row(m, ref);
    if (!row) return m;
    if (isSection(ref.list)) return MONSTER_ACTIONS.replace(m, ref, { ...row, charges: { ...(row.charges || {}), current_charges: cur } });
    return MONSTER_ACTIONS.replace(m, ref, { ...row, current: cur }); // spell group or spell
  },

  setAmount: (m, ref, amount) => {
    const row = MONSTER_ACTIONS.row(m, ref);
    return row ? MONSTER_ACTIONS.replace(m, ref, { ...row, quantity: Math.max(0, amount ?? 0) }) : m;
  },

  /* spellcasting */
  addSpellBlock: (m) => {
    const block = { id: idGen(), name: "Spellcasting", ability: "cha", save_dc: null, spell_attack_bonus: null, notes: "", groups: [{ id: idGen(), label: "At will", uses: null, each: false, spells: [] }] };
    return withBlocks(m, [...blocksOf(m), block]);
  },
  addSpellGroup: (m, blockRef) =>
    withBlocks(
      m,
      blocksOf(m).map((b) => (b.id === blockRef.id ? { ...b, groups: [...asList(b.groups), { id: idGen(), label: "", uses: 1, each: true, spells: [] }] } : b))
    ),
  // Group uses: blank = at will; current uses start full again.
  setGroupUses: (m, ref, uses) => {
    const g = findGroup(m, ref.id);
    if (!g) return m;
    const next = { ...g, uses: uses == null || uses <= 0 ? null : uses, current: uses ?? null, spells: asList(g.spells).map(({ current, ...s }) => s) };
    return MONSTER_ACTIONS.replace(m, ref, next);
  },
  addSpell: (m, groupRef, entry) => {
    const g = findGroup(m, groupRef.id);
    if (!g) return m;
    return MONSTER_ACTIONS.replace(m, groupRef, { ...g, spells: [...asList(g.spells), { id: idGen(), name: String(entry?.name || "").toLowerCase(), source: entry?.source ?? null }] });
  },
  hasSpell: (m, groupRef, entry) => asList(findGroup(m, groupRef.id)?.spells).some((s) => String(s?.name || "").toLowerCase() === String(entry?.name || "").toLowerCase()),

  // Adding. Returns { raw, ref, open } like the character adapter.
  add: (m, kind, entry) => {
    if (kind === "own") {
      const row = newMonsterItem();
      return { raw: withItems(m, "actions", [...itemsOf(m, "actions"), row]), ref: { list: "actions", id: row.id }, open: true };
    }
    if (kind === "item") {
      const gear = asList(m?.gear);
      const same = gear.find((g) => g?.name === entry?.name && (g?.source || null) === (entry?.source || null));
      if (same) return { raw: { ...m, gear: replaceIn(gear, same.id, { ...same, quantity: toInt(same.quantity, 1) + 1 }) }, ref: { list: "gear", id: same.id } };
      const row = { id: idGen(), name: entry?.name || "Item", source: entry?.source ?? null, quantity: 1 };
      return { raw: { ...m, gear: [...gear, row] }, ref: { list: "gear", id: row.id } };
    }
    return { raw: m, ref: null };
  },

  has: () => false, // gear stacks instead
};

export const MONSTER_ADD_KINDS = [{ kind: "item", label: "gear" }];