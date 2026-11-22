import {
  ABILITIES, CONDITIONS, DAMAGE_TYPES, SKILLS, SENSES, labelFromId, nameFromId, titleCase,
} from "../../Catalogues/catalogueHelpers";
import {
  CR_OPTIONS, SECTIONS, SECTION_TITLES, abilityMod, crStats, formatDefense, monsterSubtitle, spellGroupLabel,
} from "../../Catalogues/Monsters/monsterHelpers";
import { actionWords, isNumber, newId, regainWords, usesOf } from "../../../utils/featureRuntime";
import { LANGUAGE_OPTIONS } from "../../../utils/Constants";

/* ═══════════════════════════════════════════════════════════════════
   monsterStatblock.js — a campaign's monster, as the statblock card sees it.

   Same three exports as characterStatblock.js, so both draw with the
   same card (Statblock.jsx):

     monsterView(raw)   what to draw; rows carry ref = { list, id }
     MONSTER_EDITS      get/set pairs for single values
     MONSTER_ACTIONS    whole-row changes by ref, uses, adding

   plus prepareMonster(entry): a catalogue monster made ready to keep in
   a campaign. The copy is the catalogue's monster record (data-model
   §4h) with a few things for play:

     hp_current, hp_temp, dm_notes
     catalogue { id, name, source }      where it was copied from
     features[]          + uses_left, active (false = hidden; a variant's
                         features start hidden until you switch them on)
     spellcasting[] / groups[] / spells[]
                         + id; uses_left on a group (shared uses or
                         slots) or on each spell ("each")
     items[]             + id (and name, for gear added by hand)
     legendary_actions.left
     templates, template_uses, group_id   (templateLogic, encounters)

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
const thousands = (n) => new Intl.NumberFormat("en-US").format(n);

export const SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"].map((value) => ({ value, label: titleCase(value) }));
export const MONSTER_SECTIONS = SECTIONS.map((key) => ({ key, title: SECTION_TITLES[key] }));
const OTHER_SPEEDS = ["fly", "swim", "climb", "burrow"];
const ABILITY_OPTIONS = ABILITIES.map((a) => ({ value: a, label: a.toUpperCase() }));

const DEFENSES = [
  { key: "vulnerable", label: "Vulnerabilities", options: DAMAGE_TYPES },
  { key: "resist", label: "Resistances", options: DAMAGE_TYPES },
  { key: "immune", label: "Immunities", options: DAMAGE_TYPES },
  { key: "condition_immune", label: "Condition Immunities", options: CONDITIONS },
];

/* ─── small readers ──────────────────────────────────────────────── */

export const pbOf = (m) => {
  if (isNumber(m?.cr?.pb)) return m.cr.pb;
  const fromCr = crStats(m?.cr?.cr)?.pb;
  if (fromCr) return fromCr;
  return isNumber(m?.level) ? 2 + Math.floor((m.level - 1) / 4) : 2;
};
export const hpMaxOf = (m) => Math.max(0, toInt(m?.hp?.average, 0));
export const hpCurOf = (m) => clamp(toInt(m?.hp_current, hpMaxOf(m)), 0, hpMaxOf(m) || Infinity);
export const acOf = (m) => toInt(asList(m?.ac)[0]?.value, null);
export const scoreOf = (m, a) => toInt(m?.abilities?.[a], 10);
export const modOf = (m, a) => abilityMod(scoreOf(m, a));
export const saveOf = (m, a) => (isNumber(m?.saves?.[a]) ? m.saves[a] : modOf(m, a));
export const initiativeOf = (m) => (isNumber(m?.initiative?.bonus) ? m.initiative.bonus : modOf(m, "dex"));
export const skillBonus = (m, key) => (isNumber(m?.skills?.[key]) ? m.skills[key] : null);
const passiveOf = (m) => 10 + (skillBonus(m, "perception") ?? modOf(m, "wis"));
export const speedOf = (m, k) => (isNumber(m?.speed?.[k]) ? m.speed[k] : null);

// A catalogue id's name: from the loaded catalogues when we have them,
// otherwise read from the id ("fire-bolt-xphb" → "Fire Bolt").
const named = (row, id, names) => row?.name || nameFromId(id, names);

/* ─── where rows live ────────────────────────────────────────────── */

const isSection = (list) => SECTIONS.includes(list);
const featuresOf = (m) => asList(m?.features);
const blocksOf = (m) => asList(m?.spellcasting);
const withBlocks = (m, blocks) => ({ ...m, spellcasting: blocks });
// Change every group with a matching id, wherever it is.
const mapGroups = (m, fn) => withBlocks(m, blocksOf(m).map((b) => ({ ...b, groups: asList(b.groups).map(fn) })));
const findGroup = (m, id) => {
  for (const b of blocksOf(m)) for (const g of asList(b.groups)) if (g?.id === id) return g;
  return null;
};
const findSpell = (m, id) => {
  for (const b of blocksOf(m)) for (const g of asList(b.groups)) for (const s of asList(g.spells)) if (s?.id === id) return s;
  return null;
};

// Uses a spell list has: its slots, or its uses per day (null = at will).
export const groupMax = (g) => {
  const n = isNumber(g?.slots) ? g.slots : isNumber(g?.uses) && g.how !== "recharge" ? g.uses : null;
  return n != null && n > 0 ? n : null;
};

/* ─── catalogue → campaign copy ──────────────────────────────────── */

const withId = (row) => ({ ...row, id: row?.id || newId() });

export function prepareMonster(entry) {
  // The catalogue's own bookkeeping stays in the catalogue.
  const { visibility, id, created_by, filters, srd, ...copy } = structuredClone(entry || {});
  const out = {
    ...copy,
    features: featuresOf(copy).map((f) => {
      const row = { ...withId(f), active: !f.variant };
      const uses = usesOf(f);
      if (uses) row.uses_left = uses.max;
      return row;
    }),
    hp_current: hpMaxOf(copy),
    hp_temp: 0,
    dm_notes: "",
    catalogue: { id: id ?? null, name: entry?.name ?? null, source: entry?.source ?? null },
  };
  if (blocksOf(copy).length) {
    out.spellcasting = blocksOf(copy).map((b) => ({
      ...withId(b),
      groups: asList(b.groups).map((g) => ({ ...withId(g), spells: asList(g.spells).map(withId) })),
    }));
  }
  if (asList(copy.items).length) out.items = copy.items.map(withId);
  if (copy.legendary_actions?.uses) out.legendary_actions = { ...copy.legendary_actions, left: copy.legendary_actions.uses };
  return out;
}

/* ─── header lines ───────────────────────────────────────────────── */

const crLine = (m) => {
  const pb = `PB ${signed(pbOf(m))}`;
  if (m?.cr?.cr && m.cr.cr !== "unknown") {
    const xp = isNumber(m.cr.xp) ? m.cr.xp : crStats(m.cr.cr)?.xp;
    return { value: String(m.cr.cr), sub: [xp != null ? `${thousands(xp)} XP` : "", pb].filter(Boolean).join(" · ") };
  }
  if (m?.level != null) return { value: `Lv ${m.level}`, sub: pb };
  return { value: "—", sub: null };
};

/* ─── traits, actions… ───────────────────────────────────────────── */

// One feature as a card entry. Rows a template gives (see templateLogic)
// keep their uses on the creature's template_uses.
export function entryFrom(list, f) {
  const uses = usesOf(f);
  const regain = regainWords(f.uses);
  const parts = [actionWords(f.action)];
  if (f.uses?.reset === "recharge") parts.push(regain);
  if (f.cost > 1) parts.push(`costs ${f.cost} actions`);
  return {
    ref: f.from_template ? { list, id: f.id, template: true } : { list, id: f.id },
    name: f.name || "Unnamed",
    tag: f.roll ? `roll ${f.roll}` : f.variant ? "variant" : null,
    fromTemplate: f.from_template || null,
    catalogue: null,
    roll: parts.filter(Boolean).join(" · "),
    uses,
    regain: uses ? (f.uses?.reset === "recharge" ? `${uses.max} · ${regain}` : `${uses.max} ${regain}`.trim()) : "",
    text: String(f.text || "").trim(),
    inactive: f.active === false,
  };
}

export function sectionsOf(m, editing) {
  const legendaryMax = toInt(m?.legendary_actions?.uses, 0);
  return MONSTER_SECTIONS.map(({ key, title }) => {
    const entries = featuresOf(m)
      .filter((f) => f && (f.category || "traits") === key && (editing || f.active !== false))
      .map((f) => entryFrom(key, f));
    const section = { key, title, entries };
    if (key === "legendary_actions" && (legendaryMax > 0 || (editing && entries.length))) {
      section.pool = {
        label: "legendary action",
        max: legendaryMax,
        cur: clamp(toInt(m?.legendary_actions?.left, legendaryMax), 0, legendaryMax),
        ref: { list: "legendary" },
        edit: "legendaryMax",
      };
    }
    return section;
  }).filter((s) => s.entries.length > 0);
}

/* ─── spells ─────────────────────────────────────────────────────── */

export function spellcastingOf(m, names) {
  const blocks = blocksOf(m).map((b) => {
    const line = [
      b.ability ? b.ability.toUpperCase() : "",
      b.dc != null ? `spell save DC ${b.dc}` : "",
      isNumber(b.attack) ? `${signed(b.attack)} to hit` : "",
    ].filter(Boolean).join(" · ");
    return {
      ref: b.from_template ? { list: "spellblock", id: b.id, template: true } : { list: "spellblock", id: b.id },
      title: b.name || "Spellcasting",
      line,
      notes: String(b.text || "").trim(),
      ability: b.ability || "",
      saveDc: isNumber(b.dc) ? b.dc : null,
      attack: isNumber(b.attack) ? b.attack : null,
      groups: asList(b.groups).map((g) => {
        const max = groupMax(g);
        const tpl = (ref) => (g.from_template ? { ...ref, template: true } : ref);
        return {
          ref: tpl({ list: "spellgroup", id: g.id }),
          label: g.label || spellGroupLabel(g),
          rawLabel: g.label || "",
          max,
          each: !!g.each,
          // Shared uses ("2/Day" for the whole list, or slots) sit on the group…
          uses: max && !g.each ? { max, cur: clamp(toInt(g.uses_left, max), 0, max) } : null,
          spells: asList(g.spells)
            .filter((s) => s?.spell || s?.text || s?.name)
            .map((s) => {
              const name = s.spell ? named(s, s.spell, names) : s.name || s.text;
              return {
                ref: s.from_template ? { list: "spell", id: s.id, template: true } : { list: "spell", id: s.id },
                name: name + (s.note ? ` ${s.note}` : ""),
                catalogue: s.spell ? { type: "spell", id: s.spell, name } : null,
                // …"each" uses sit on every spell.
                uses: max && g.each ? { max, cur: clamp(toInt(s.uses_left, max), 0, max) } : null,
              };
            }),
        };
      }),
    };
  });
  return { kind: "groups", empty: !blocks.some((b) => b.groups.some((g) => g.spells.length)), abilityOptions: ABILITY_OPTIONS, blocks };
}

/* ─── gear ───────────────────────────────────────────────────────── */

export function equipmentOf(m, names) {
  const gear = asList(m?.items)
    .filter((it) => it?.item || it?.name)
    .map((it) => {
      const name = named(it, it.item, names);
      return {
        ref: { list: "gear", id: it.id },
        name,
        catalogue: it.item ? { type: "item", id: it.item, name } : null,
        amount: toInt(it.qty, 1),
      };
    });
  return { empty: !gear.length, magic: [], gear, coins: null };
}

/* ─── the view ───────────────────────────────────────────────────── */

export function monsterView(m, { editing = false, names } = {}) {
  const max = hpMaxOf(m);
  const temp = toInt(m?.hp_temp, 0);
  const otherSpeeds = OTHER_SPEEDS.filter((k) => speedOf(m, k) > 0).map((k) => `${k} ${speedOf(m, k)} ft`);
  if (m?.speed?.hover) otherSpeeds.push("hover");
  const cr = crLine(m);
  const ac = acOf(m);
  const acFrom = asList(asList(m?.ac)[0]?.from).join(", ");

  const saves = ABILITIES.filter((a) => isNumber(m?.saves?.[a])).map((a) => `${a.toUpperCase()} ${signed(m.saves[a])}`);
  const skills = Object.entries(m?.skills || {}).filter(([, v]) => isNumber(v)).map(([k, v]) => `${labelFromId(k)} ${signed(v)}`);
  const senses = SENSES.filter((k) => toInt(m?.senses?.[k], 0) > 0).map((k) => `${titleCase(k)} ${m.senses[k]} ft`);
  if (m?.senses?.notes) senses.push(m.senses.notes);
  senses.push(`passive Perception ${toInt(m?.passive_perception, passiveOf(m))}`);

  const fields = (list) => ({ type: "fields", fields: list });
  const lines = [
    { label: "Saving Throws", text: saves.join(", ") },
    { label: "Skills", text: skills.join(", ") },
    ...DEFENSES.map((d) => ({
      label: d.label,
      text: formatDefense(m?.defenses?.[d.key]),
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
      editor: fields([...OTHER_SPEEDS.map((k) => ({ kind: "number", edit: "speedMode", arg: k, label: k, suffix: "ft", step: 5 })), { kind: "mark", edit: "hover", label: "hover" }]),
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
        { kind: "text", edit: "alignment", label: "alignment", placeholder: "lawful evil", wide: true },
      ]),
    },
  ].filter((l) => (editing ? l.text != null && (l.text || l.editor) : l.text));

  return {
    kind: "monster",
    name: m?.name || "Unnamed",
    subtitle: monsterSubtitle(m || {}),
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
        value: `${speedOf(m, "walk") ?? 0} ft`,
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
    abilities: ABILITIES.map((a) => ({
      key: a,
      short: a.toUpperCase(),
      score: scoreOf(m, a),
      mod: signed(modOf(m, a)),
      save: signed(saveOf(m, a)),
      saveProf: isNumber(m?.saves?.[a]),
    })),
    skillMode: "bonus",
    skills: Object.entries(SKILLS).map(([key, ability]) => {
      const bonus = skillBonus(m, key);
      return { key, label: labelFromId(key), ability: ability.toUpperCase(), bonus, total: bonus == null ? "" : signed(bonus) };
    }),
    lines,
    sections: sectionsOf(m, editing),
    spellcasting: spellcastingOf(m, names),
    equipment: equipmentOf(m, names),
    about: [],
    notes: String(m?.dm_notes || ""),
    notesPlaceholder: "How it fights, what it wants, where it lairs…",
    editingNote: "Editing this campaign's copy only — the catalogue monster is not touched.",
  };
}

/* ─── single values ──────────────────────────────────────────────── */

// Saves and skills are written as totals, so they move with the scores
// and proficiency bonus they hang on.
const shiftAll = (obj, delta, keep = () => true) =>
  Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, isNumber(v) && keep(k) ? v + delta : v]));
const withPassive = (m) => ({ ...m, passive_perception: passiveOf(m) });

const withHp = (m, max) => {
  const { formula, ...hp } = m?.hp || {}; // a hand-set maximum no longer matches the dice
  return { ...m, hp: { ...hp, average: max } };
};

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
  speed: { get: (m) => speedOf(m, "walk") ?? 0, set: (m, v) => ({ ...m, speed: { ...(m?.speed || {}), walk: v ?? 0 } }) },
  speedMode: {
    get: (m, k) => speedOf(m, k),
    set: (m, k, v) => {
      const speed = { ...(m?.speed || {}) };
      if (v == null || v <= 0) delete speed[k];
      else speed[k] = v;
      return { ...m, speed };
    },
  },
  hover: { get: (m) => !!m?.speed?.hover, set: (m, v) => ({ ...m, speed: { ...(m?.speed || {}), hover: v || undefined } }) },
  initiative: { get: (m) => initiativeOf(m), set: (m, v) => ({ ...m, initiative: { ...(m?.initiative || {}), bonus: v ?? 0 } }) },
  initiativeAdv: {
    get: (m) => !!m?.initiative?.advantage,
    set: (m, v) => ({ ...m, initiative: { bonus: initiativeOf(m), ...(m?.initiative || {}), advantage: v || undefined } }),
  },
  // XP and proficiency come from the challenge rating; saves and skills follow.
  cr: {
    get: (m) => (m?.cr?.cr != null ? String(m.cr.cr) : ""),
    set: (m, v) => {
      const stats = crStats(v);
      const pb = stats?.pb ?? pbOf(m);
      const delta = pb - pbOf(m);
      return { ...m, cr: { cr: v, xp: stats?.xp ?? null, pb }, saves: shiftAll(m?.saves, delta), skills: shiftAll(m?.skills, delta) };
    },
  },
  score: {
    get: (m, a) => scoreOf(m, a),
    set: (m, a, v) => {
      const delta = abilityMod(v ?? 10) - modOf(m, a);
      const next = {
        ...m,
        abilities: { ...(m?.abilities || {}), [a]: v ?? 10 },
        saves: shiftAll(m?.saves, delta, (k) => k === a),
        skills: shiftAll(m?.skills, delta, (k) => SKILLS[k] === a),
      };
      // A written initiative bonus moves with Dexterity too.
      if (a === "dex" && isNumber(m?.initiative?.bonus)) next.initiative = { ...m.initiative, bonus: m.initiative.bonus + delta };
      return withPassive(next);
    },
  },
  saveProf: {
    get: (m, a) => isNumber(m?.saves?.[a]),
    set: (m, a, v) => {
      const saves = { ...(m?.saves || {}) };
      if (v) saves[a] = modOf(m, a) + pbOf(m);
      else delete saves[a];
      return { ...m, saves };
    },
  },
  // A number shows the skill on the statblock; blank takes it off.
  skillBonus: {
    get: (m, key) => skillBonus(m, key),
    set: (m, key, v) => {
      const skills = { ...(m?.skills || {}) };
      if (v == null) delete skills[key];
      else skills[key] = v;
      return withPassive({ ...m, skills });
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
    get: (m, key) => (key === "languages" ? asList(m?.languages) : asList(m?.defenses?.[key]?.types)),
    set: (m, key, values) =>
      key === "languages"
        ? { ...m, languages: values }
        : { ...m, defenses: { ...(m?.defenses || {}), [key]: { ...(m?.defenses?.[key] || {}), types: values } } },
  },
  size: { get: (m) => asList(m?.size)[0] || "", set: (m, v) => ({ ...m, size: v ? [v] : [] }) },
  type: {
    get: (m) => (Array.isArray(m?.creature_type?.type) ? m.creature_type.type.join(" or ") : m?.creature_type?.type || ""),
    set: (m, v) => ({ ...m, creature_type: { ...(m?.creature_type || {}), type: v.trim().toLowerCase() } }),
  },
  alignment: { get: (m) => asList(m?.alignment).join(" or "), set: (m, v) => ({ ...m, alignment: v.trim() ? [v.trim().toLowerCase()] : [] }) },
  legendaryMax: {
    get: (m) => toInt(m?.legendary_actions?.uses, 0),
    set: (m, v) => {
      const max = Math.max(0, v ?? 0);
      return { ...m, legendary_actions: { ...(m?.legendary_actions || {}), uses: max, left: max } };
    },
  },
  notes: { get: (m) => m?.dm_notes ?? "", set: (m, v) => ({ ...m, dm_notes: v }) },
};

/* ─── whole rows ─────────────────────────────────────────────────── */

export const newFeature = (category = "actions") => ({ id: newId(), name: "", category, text: "", active: true });

const replaceIn = (rows, id, next) => rows.map((r) => (r?.id === id ? next : r));
const without = (rows, id) => rows.filter((r) => r?.id !== id);

export const MONSTER_ACTIONS = {
  sections: MONSTER_SECTIONS,

  row: (m, ref) => {
    if (isSection(ref.list)) return featuresOf(m).find((r) => r?.id === ref.id) || null;
    if (ref.list === "gear") return asList(m?.items).find((r) => r?.id === ref.id) || null;
    if (ref.list === "spellblock") return blocksOf(m).find((b) => b?.id === ref.id) || null;
    if (ref.list === "spellgroup") return findGroup(m, ref.id);
    if (ref.list === "spell") return findSpell(m, ref.id);
    return null;
  },

  replace: (m, ref, next) => {
    if (isSection(ref.list)) return { ...m, features: replaceIn(featuresOf(m), ref.id, next) };
    if (ref.list === "gear") return { ...m, items: replaceIn(asList(m?.items), ref.id, next) };
    if (ref.list === "spellblock") return withBlocks(m, replaceIn(blocksOf(m), ref.id, next));
    if (ref.list === "spellgroup") return mapGroups(m, (g) => (g?.id === ref.id ? next : g));
    if (ref.list === "spell") return mapGroups(m, (g) => ({ ...g, spells: replaceIn(asList(g.spells), ref.id, next) }));
    return m;
  },

  remove: (m, ref) => {
    if (isSection(ref.list)) return { ...m, features: without(featuresOf(m), ref.id) };
    if (ref.list === "gear") return { ...m, items: without(asList(m?.items), ref.id) };
    if (ref.list === "spellblock") return withBlocks(m, without(blocksOf(m), ref.id));
    if (ref.list === "spellgroup") return withBlocks(m, blocksOf(m).map((b) => ({ ...b, groups: without(asList(b.groups), ref.id) })));
    if (ref.list === "spell") return mapGroups(m, (g) => ({ ...g, spells: without(asList(g.spells), ref.id) }));
    return m;
  },

  // Move an entry to another section (an action that should be a bonus action…).
  move: (m, ref, toList) => {
    const row = MONSTER_ACTIONS.row(m, ref);
    if (!row || !isSection(toList) || toList === ref.list) return { raw: m, ref };
    return { raw: MONSTER_ACTIONS.replace(m, ref, { ...row, category: toList }), ref: { list: toList, id: ref.id } };
  },

  // Spend or regain: `cur` is the new number left.
  setUses: (m, ref, cur) => {
    if (ref.template) return { ...m, template_uses: { ...(m?.template_uses || {}), [ref.id]: cur } };
    if (ref.list === "legendary") return { ...m, legendary_actions: { ...(m?.legendary_actions || {}), left: cur } };
    const row = MONSTER_ACTIONS.row(m, ref);
    return row ? MONSTER_ACTIONS.replace(m, ref, { ...row, uses_left: cur }) : m;
  },

  setAmount: (m, ref, amount) => {
    const row = MONSTER_ACTIONS.row(m, ref);
    return row ? MONSTER_ACTIONS.replace(m, ref, { ...row, qty: Math.max(0, amount ?? 0) }) : m;
  },

  /* spellcasting */
  addSpellBlock: (m) => {
    const block = { id: newId(), name: "Spellcasting", ability: "cha", text: "", groups: [{ id: newId(), how: "at_will", spells: [] }] };
    return withBlocks(m, [...blocksOf(m), block]);
  },
  addSpellGroup: (m, blockRef) =>
    withBlocks(
      m,
      blocksOf(m).map((b) => (b.id === blockRef.id ? { ...b, groups: [...asList(b.groups), { id: newId(), uses: 1, per: "day", each: true, spells: [] }] } : b))
    ),
  // A list's uses: its slots when it is a spell level, otherwise uses per
  // day (blank = at will). The dots start full again.
  setGroupUses: (m, ref, uses) => {
    const g = findGroup(m, ref.id);
    if (!g) return m;
    const next = { ...g, spells: asList(g.spells).map(({ uses_left: _spent, ...s }) => s) };
    delete next.uses_left;
    const n = uses == null || uses <= 0 ? null : uses;
    if (g.level != null || g.slots != null) {
      if (n == null) delete next.slots;
      else next.slots = n;
    } else if (n == null) {
      delete next.uses;
      delete next.per;
      delete next.each;
      next.how = "at_will";
    } else {
      next.uses = n;
      next.per = g.per || "day";
      if (next.how === "at_will") delete next.how;
    }
    return MONSTER_ACTIONS.replace(m, ref, next);
  },
  addSpell: (m, groupRef, entry) => {
    const g = findGroup(m, groupRef.id);
    if (!g) return m;
    return MONSTER_ACTIONS.replace(m, groupRef, { ...g, spells: [...asList(g.spells), { id: newId(), spell: entry?.id, name: entry?.name }] });
  },
  hasSpell: (m, groupRef, entry) => asList(findGroup(m, groupRef.id)?.spells).some((s) => s?.spell === entry?.id),

  // Adding. Returns { raw, ref, open } like the character adapter.
  add: (m, kind, entry) => {
    if (kind === "own") {
      const row = newFeature("actions");
      return { raw: { ...m, features: [...featuresOf(m), row] }, ref: { list: "actions", id: row.id }, open: true };
    }
    if (kind === "item") {
      const items = asList(m?.items);
      const same = items.find((it) => it?.item && it.item === entry?.id);
      if (same) return { raw: { ...m, items: replaceIn(items, same.id, { ...same, qty: toInt(same.qty, 1) + 1 }) }, ref: { list: "gear", id: same.id } };
      const row = { id: newId(), item: entry?.id, name: entry?.name || "Item", qty: 1 };
      return { raw: { ...m, items: [...items, row] }, ref: { list: "gear", id: row.id } };
    }
    return { raw: m, ref: null };
  },

  has: () => false, // gear stacks instead
};

export const MONSTER_ADD_KINDS = [{ kind: "item", label: "gear" }];
