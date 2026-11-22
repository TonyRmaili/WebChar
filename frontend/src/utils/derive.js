import { evaluate, tableRow } from "./formulas";

/* ═══════════════════════════════════════════════════════════════════
   derive — every number the character sheet shows, worked out from the
   save file (version 2). Nothing here is stored: the file keeps what was
   picked and what is used; this works out the rest each time.

   The same rules as the backend's app/builder/derive.py, function for
   function, so the sheet and the server always agree (HP for healing,
   resources for a rest…). Change one, change the other.

   Where the numbers come from:
     layers        every layer's `grants`, its features' `modifiers` (a
                   toggle's only while switched on: `on: true`), and the
                   layer's own `modifiers`
     manual layer  { from: "manual", grants, removes, modifiers, custom_skills,
                     slot_overrides, pact_overrides, resources, spell_ability }
                   what the player added or changed by hand; `removes`
                   takes away what another layer gave; the slot overrides
                   and `resources` replace or add slots and pools
     inventory     equipped items' grants, modifiers and features (attuned
                   ones only when they need it), worn armour and shield
     classes       the file's copy of each class and subclass record

   A modifier is { target, add | set | min | base, requires? }:
     add  added on top     set  the final value     min  at least this
     base an unarmoured AC option (AC only)
   Targets: ac, hp_max, pb, initiative, str…cha, save, save.<ab>, check,
   check.<ab>, check.<skill>, speed, speed.<type>, senses.<type>, attack, spell_attack,
   spell_dc, concentration, damage, spell_damage.

   derive(ch) → { level, pb, classes, abilities, skills, initiative,
     hp_max, ac, speed, senses, defenses, proficiencies, hit_dice,
     spell_slots, spellcasting, attacks, concentration, bonuses,
     resources, removed }
   ═══════════════════════════════════════════════════════════════════ */

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const SCORE_CAP = 20;
const BODY_ARMOR = new Set(["light", "medium", "heavy"]);

export const SKILLS = {
  acrobatics: ["Acrobatics", "dex"],
  animal_handling: ["Animal Handling", "wis"],
  arcana: ["Arcana", "int"],
  athletics: ["Athletics", "str"],
  deception: ["Deception", "cha"],
  history: ["History", "int"],
  insight: ["Insight", "wis"],
  intimidation: ["Intimidation", "cha"],
  investigation: ["Investigation", "int"],
  medicine: ["Medicine", "wis"],
  nature: ["Nature", "int"],
  perception: ["Perception", "wis"],
  performance: ["Performance", "cha"],
  persuasion: ["Persuasion", "cha"],
  religion: ["Religion", "int"],
  sleight_of_hand: ["Sleight of Hand", "dex"],
  stealth: ["Stealth", "dex"],
  survival: ["Survival", "wis"],
};

// Grant kinds that are plain lists of ids.
export const LIST_KINDS = ["skills", "saves", "expertise", "armor", "weapons", "tools", "languages", "weapon_masteries"];
export const DEFENSES = ["resist", "immune", "vulnerable", "condition_immune"];

// Multiclass spell slots by caster level (the shared table), 1st..9th.
const MULTICLASS_SLOTS = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
const CLASS_FROM = /^class:([^@/]+)@(\d+)$/;

const asList = (v) => (Array.isArray(v) ? v : []);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const isN = (v) => typeof v === "number" && Number.isInteger(v);
const num = (v, fallback = 0) => (isN(v) ? v : fallback);

// A level table's row for `level`; anything else is returned as it is.
const table = (t, level) => (isObj(t) ? tableRow(t, level) : t ?? null);

const union = (a, b) => {
  const out = [...asList(a)];
  for (const x of asList(b)) if (!out.includes(x)) out.push(x);
  return out;
};

const layersOf = (ch) => asList(ch?.layers).filter(isObj);

// The player's own layer (an empty one when there is none yet).
export const manualLayer = (ch) => layersOf(ch).find((l) => l.from === "manual") || { from: "manual" };

const classesOf = (ch, classes) => classes ?? (isObj(ch?.classes) ? ch.classes : {});

/* ─── classes and levels ─────────────────────────────────────────── */

// [[class id, level, subclass id or null]] in the order taken.
export function classLevels(ch) {
  const out = new Map();
  for (const layer of layersOf(ch)) {
    const m = CLASS_FROM.exec(String(layer.from || ""));
    if (!m) continue;
    const cid = m[1];
    const lvl = Number(m[2]);
    const cur = out.get(cid) || { level: 0, subclass: null };
    cur.level = Math.max(cur.level, lvl);
    const sub = layer.grants?.subclass;
    if (sub) cur.subclass = sub;
    out.set(cid, cur);
  }
  return [...out.entries()].map(([cid, v]) => [cid, v.level, v.subclass]);
}

export const totalLevel = (ch) => classLevels(ch).reduce((n, [, lvl]) => n + lvl, 0);

export const proficiencyBonus = (level) => 2 + Math.floor((Math.max(1, level) - 1) / 4);

/* ─── grants: what every layer gives, minus what the player removed ─ */

// Items that count: equipped, and attuned when they need it.
export const workingItems = (ch) =>
  asList(ch?.inventory?.items).filter((i) => isObj(i) && i.equipped && !(i.attunement?.required && !i.attuned));

// The toggles switched on among a layer's (or an item's) features, and
// among its spells' (Mage Armor, Shield, Bless while they're on).
function* toggledOn(layer) {
  for (const f of asList(layer.features)) {
    if (f?.on && f.active !== false && !f.removed && isObj(f.toggle)) yield f.toggle;
  }
  for (const s of asList(layer.spells)) {
    if (!isObj(s) || s.removed) continue;
    for (const f of asList(s.features)) if (f?.on && isObj(f.toggle)) yield f.toggle;
  }
}

// [grants, removed]: every layer's grants put together, then `removes`.
export function granted(ch) {
  const lists = Object.fromEntries(LIST_KINDS.map((k) => [k, []]));
  const speed = {};
  const senses = {};
  const sensesBonus = {};
  const defenses = Object.fromEntries(DEFENSES.map((k) => [k, []]));

  const add = (g) => {
    for (const k of LIST_KINDS) lists[k] = union(lists[k], g[k]);
    for (const [target, src] of [[speed, g.speed], [senses, g.senses]]) {
      for (const [k, v] of Object.entries(isObj(src) ? src : {})) {
        const old = target[k];
        if (isN(old) && isN(v)) target[k] = Math.max(old, v); // grants set: the highest wins
        else if (old === undefined || old === null || (isN(v) && !isN(old))) target[k] = v; // a number beats "walk" or a flag
      }
    }
    for (const [k, v] of Object.entries(isObj(g.senses_bonus) ? g.senses_bonus : {})) sensesBonus[k] = (sensesBonus[k] || 0) + num(v);
    for (const k of DEFENSES) defenses[k] = union(defenses[k], g.defenses?.[k]);
  };

  for (const layer of layersOf(ch)) {
    add(isObj(layer.grants) ? layer.grants : {});
    for (const t of toggledOn(layer)) add(isObj(t.grants) ? t.grants : {});
  }
  for (const item of workingItems(ch)) {
    // boots of speed, a ring of resistance…
    add(isObj(item.grants) ? item.grants : {});
    for (const t of toggledOn(item)) add(isObj(t.grants) ? t.grants : {});
  }

  const removes = isObj(manualLayer(ch).removes) ? manualLayer(ch).removes : {};
  const removed = {};
  for (const k of LIST_KINDS) {
    const gone = lists[k].filter((x) => asList(removes[k]).includes(x));
    if (gone.length) {
      removed[k] = gone;
      lists[k] = lists[k].filter((x) => !gone.includes(x));
    }
  }
  for (const [k, target] of [["speed", speed], ["senses", senses]]) {
    const gone = asList(removes[k]).filter((x) => x in target);
    if (gone.length) {
      removed[k] = gone;
      for (const x of gone) delete target[x];
    }
  }
  for (const k of DEFENSES) {
    const gone = defenses[k].filter((x) => asList(removes.defenses?.[k]).includes(x));
    if (gone.length) {
      (removed.defenses ||= {})[k] = gone;
      defenses[k] = defenses[k].filter((x) => !gone.includes(x));
    }
  }
  return [{ ...lists, speed, senses, senses_bonus: sensesBonus, defenses }, removed];
}

/* ─── ability scores ─────────────────────────────────────────────── */

// Base score + every layer's ability grants; 20 at most unless `ability_max`.
export function baseScores(ch) {
  const base = ch?.abilities?.base || {};
  const scores = Object.fromEntries(ABILITIES.map((a) => [a, num(base[a], 10)]));
  const caps = Object.fromEntries(ABILITIES.map((a) => [a, SCORE_CAP]));
  for (const layer of layersOf(ch)) {
    const g = layer.grants || {};
    for (const [a, n] of Object.entries(isObj(g.ability) ? g.ability : {})) if (a in scores) scores[a] += num(n);
    for (const [a, n] of Object.entries(isObj(g.ability_max) ? g.ability_max : {})) if (a in caps) caps[a] = Math.max(caps[a], num(n, SCORE_CAP));
  }
  return Object.fromEntries(ABILITIES.map((a) => [a, Math.min(scores[a], caps[a])]));
}

export const mod = (score) => Math.floor((score - 10) / 2);

// The words a formula may use, for this character (and one of its classes).
export function words(ch, scores, cls = null, classLevel = null, spellAbility = null) {
  const level = totalLevel(ch);
  const w = { level, pb: proficiencyBonus(level) };
  for (const a of ABILITIES) {
    w[a] = scores[a];
    w[`${a}_mod`] = mod(scores[a]);
  }
  if (cls && classLevel != null) {
    w.class_level = classLevel;
    for (const col of asList(cls.columns)) {
      const v = table(col?.values, classLevel);
      if (v != null) w[col.id] = v;
    }
    spellAbility = spellAbility || cls.spellcasting?.ability || null;
  }
  if (ABILITIES.includes(spellAbility)) w.spell_mod = w[`${spellAbility}_mod`];
  return w;
}

/* Words for the numbers of one layer's features and spells (a class's
   columns and class_level for a class layer; spell_mod from `spellAbility`
   or the class's spellcasting ability). `scores` are the final scores
   (derive(ch).abilities). */
export function wordsFor(ch, from, scores, spellAbility = null) {
  const classes = classesOf(ch, null);
  const [cls, lvl] = classContext(ch, classes, from);
  return words(ch, scores, cls, lvl, spellAbility);
}

/* ─── modifiers from everywhere ──────────────────────────────────── */

function classContext(ch, classes, frm) {
  const m = CLASS_FROM.exec(String(frm || ""));
  if (!m) return [null, null];
  const hit = classLevels(ch).find(([c]) => c === m[1]);
  return [classes[m[1]] || null, hit ? hit[1] : null];
}

// [[modifier, words]] that apply now.
export function activeModifiers(ch, classes, scores) {
  const out = [];
  for (const layer of layersOf(ch)) {
    const [cls, lvl] = classContext(ch, classes, layer.from);
    const w = words(ch, scores, cls, lvl);
    for (const m of asList(layer.modifiers)) out.push([m, w]);
    for (const f of asList(layer.features)) {
      if (f?.active === false || f?.removed) continue; // hidden, or taken off the sheet
      for (const m of asList(f?.modifiers)) out.push([m, w]);
    }
    for (const t of toggledOn(layer)) for (const m of asList(t.modifiers)) out.push([m, w]);
  }
  const w = words(ch, scores);
  for (const item of workingItems(ch)) {
    for (const m of asList(item.modifiers)) out.push([m, w]);
    for (const f of asList(item.features)) {
      if (f?.active === false || f?.removed) continue; // hidden, or taken off the sheet
      for (const m of asList(f?.modifiers)) out.push([m, w]);
    }
    for (const t of toggledOn(item)) for (const m of asList(t.modifiers)) out.push([m, w]);
  }
  return out.filter(([m]) => isObj(m));
}

const value = (v, w) => {
  const got = evaluate(v, w, w.class_level || w.level);
  return isN(got) ? got : null; // dice don't add to a fixed number
};

// `add`s, then `min`s, then `set`s of the modifiers aimed at `targets`.
function apply(total, mods, targets) {
  const hits = mods.filter(([m]) => targets.includes(m.target));
  for (const [m, w] of hits) if (m.add != null) total += value(m.add, w) ?? 0;
  for (const [m, w] of hits) {
    if (m.min != null) {
      const got = value(m.min, w);
      if (got != null) total = Math.max(total, got);
    }
  }
  for (const [m, w] of hits) {
    if (m.set != null) {
      const got = value(m.set, w);
      if (got != null) total = got;
    }
  }
  return total;
}

export function abilityScores(ch, classes = null, mods = null) {
  classes = classesOf(ch, classes);
  const scores = baseScores(ch);
  mods = mods ?? activeModifiers(ch, classes, scores);
  return Object.fromEntries(ABILITIES.map((a) => [a, apply(scores[a], mods, [a])]));
}

/* ─── HP ─────────────────────────────────────────────────────────── */

export function maxHp(ch, classes = null, scores = null, mods = null) {
  classes = classesOf(ch, classes);
  scores = scores || abilityScores(ch, classes);
  mods = mods ?? activeModifiers(ch, classes, scores);
  const hp = ch?.hp || {};
  const w = words(ch, scores);
  let total = 0;
  if (hp.mode === "manual" && isN(hp.manual)) {
    total = hp.manual;
  } else {
    // Per level: the number the player set, else a roll + Con, else the
    // first level's `first` / the average (derive.py max_hp).
    const rolls = hp.rolls || {};
    const sets = hp.set || {};
    let first = true;
    for (const [cid, lvl] of classLevels(ch)) {
      const rec = classes[cid]?.hp || {};
      for (let n = 1; n <= lvl; n += 1) {
        const key = `class:${cid}@${n}`;
        let gained;
        if (isN(sets[key])) {
          gained = Math.trunc(sets[key]);
          first = false;
        } else if (first) {
          gained = value(rec.first, w);
          first = false;
        } else if (isN(rolls[key])) {
          gained = Math.trunc(rolls[key]) + w.con_mod;
        } else {
          gained = value(rec.per_level, w);
        }
        total += Math.max(1, gained || 0);
      }
    }
  }
  return Math.max(0, apply(total, mods, ["hp_max"]));
}

/* ─── AC ─────────────────────────────────────────────────────────── */

// The armour and shield worn, from the inventory.
export function wornArmor(ch) {
  const items = asList(ch?.inventory?.items).filter((i) => i?.equipped && isObj(i.armor));
  return {
    body: items.find((i) => BODY_ARMOR.has(i.armor.category || "")) || null,
    shield: items.find((i) => i.armor.category === "shield") || null,
  };
}

export function armorClass(ch, classes = null, scores = null, mods = null) {
  classes = classesOf(ch, classes);
  scores = scores || abilityScores(ch, classes);
  mods = mods ?? activeModifiers(ch, classes, scores);
  const dex = mod(scores.dex);
  const { body, shield } = wornArmor(ch);
  const state = { armor: !!body, no_armor: !body, shield: !!shield, no_shield: !shield };
  // A base (Mage Armor, Unarmored Defense) competes with worn armour: the higher one wins.
  const met = (m) => asList(m.requires).filter((r) => m.base == null || (r !== "armor" && r !== "no_armor")).every((r) => state[r] || false);
  const acMods = mods.filter(([m]) => m.target === "ac" && met(m));

  let ac;
  if (body) {
    const cap = body.armor.dex_cap;
    ac = num(body.armor.base, 10) + (cap == null ? dex : Math.min(dex, cap));
  } else ac = 10 + dex;
  for (const [m, w] of acMods) if (m.base != null) ac = Math.max(ac, value(m.base, w) || 0);
  if (shield) ac += num(shield.armor.base, 2);
  return apply(ac, acMods, ["ac"]);
}

/* ─── spell slots ────────────────────────────────────────────────── */

const casterShare = (progression, level) =>
  ({ full: level, half: Math.floor(level / 2), half_up: Math.ceil(level / 2), third: Math.floor(level / 3) })[progression] ?? 0;

// The slots the class levels give: [[per spell level 1..9], pact or null].
export function bookSlots(ch, classes = null) {
  classes = classesOf(ch, classes);
  const casting = [];
  let pact = null;
  for (const [cid, lvl, sub] of classLevels(ch)) {
    for (const rec of [classes[cid], sub ? classes[sub] : null]) {
      const sc = rec?.spellcasting || {};
      const prog = sc.progression;
      if (prog === "pact") {
        const p = sc.pact || {};
        const count = table(p.slots, lvl);
        const slotLevel = table(p.level, lvl);
        if (count && slotLevel) pact = { count, level: slotLevel };
      } else if (prog) {
        casting.push([sc, lvl]);
      }
    }
  }
  let slots;
  if (casting.length === 1) {
    const [sc, lvl] = casting[0];
    slots = table(sc.slots, lvl) || [];
  } else {
    const casterLevel = casting.reduce((n, [sc, lvl]) => n + casterShare(sc.progression, lvl), 0);
    slots = casterLevel > 0 ? MULTICLASS_SLOTS[Math.min(casterLevel, 20) - 1] : [];
  }
  return [[...slots], pact];
}

// The player's slot numbers { "3": 2 } → Map 3 → 2, levels 1–9 only.
const levelMap = (over) => {
  const out = new Map();
  for (const [k, v] of Object.entries(isObj(over) ? over : {})) {
    const lvl = Number(k);
    if (Number.isInteger(lvl) && lvl >= 1 && lvl <= 9 && isN(v)) out.set(lvl, Math.max(0, v));
  }
  return out;
};

/* { slots: [count per spell level 1..9, trailing zeros dropped],
     pact: [{ level, count }] by level,
     book: the same two as the class levels give them }.
   The player's own numbers (the manual layer's slot_overrides and
   pact_overrides, { "<level>": count }) replace the book's for that
   level: any character can have any slots, pact slots at any levels. */
export function spellSlots(ch, classes = null) {
  classes = classesOf(ch, classes);
  const [book, pact] = bookSlots(ch, classes);
  const bookPact = new Map(pact ? [[pact.level, pact.count]] : []);
  const man = manualLayer(ch);
  const over = levelMap(man.slot_overrides);
  const pover = levelMap(man.pact_overrides);
  const slots = [];
  for (let i = 1; i <= 9; i += 1) slots.push(over.has(i) ? over.get(i) : i <= book.length ? book[i - 1] : 0);
  while (slots.length && !slots[slots.length - 1]) slots.pop();
  const pacts = new Map([...bookPact, ...pover]);
  const list = (m) => [...m.entries()].filter(([, n]) => n > 0).sort(([a], [b]) => a - b).map(([level, count]) => ({ level, count }));
  return { slots, pact: list(pacts), book: { slots: [...book], pact: list(bookPact) } };
}

/* ─── resources ──────────────────────────────────────────────────── */

export function resources(ch, classes = null, scores = null) {
  classes = classesOf(ch, classes);
  scores = scores || abilityScores(ch, classes);
  const out = new Map();
  for (const [cid, lvl, sub] of classLevels(ch)) {
    const cls = classes[cid] || {};
    for (const recId of [cid, sub]) {
      const rec = recId ? classes[recId] : null;
      if (!rec) continue;
      const w = words(ch, scores, cls, lvl, rec.spellcasting?.ability || null);
      for (const r of asList(rec.resources)) {
        if (!isObj(r) || !r.id) continue;
        let top = evaluate(r.max, w, lvl);
        top = isN(top) ? top : 0;
        const die = r.die != null ? evaluate(r.die, w, lvl) : null;
        const old = out.get(r.id);
        if (old && old.max >= top) continue;
        out.set(r.id, {
          id: r.id,
          name: r.name || r.id,
          max: Math.max(0, top),
          die: typeof die === "string" ? die : null,
          reset: r.reset || "long",
          short_rest: r.short_rest === undefined ? "all" : r.short_rest,
          owner: recId,
          book_max: Math.max(0, top),
          own: false,
          edited: false,
        });
      }
    }
  }
  // The player's pools: their own ones, and changes to the classes' ones
  // (same id: only the fields written replace the book's; removed: true hides it).
  const w = words(ch, scores);
  for (const r of asList(manualLayer(ch).resources)) {
    if (!isObj(r) || !r.id) continue;
    if (r.removed) {
      out.delete(r.id);
      continue;
    }
    const own = !out.has(r.id);
    const cur = { ...(out.get(r.id) || { id: r.id, name: r.id, max: 0, die: null, reset: "long", short_rest: "all", owner: "manual", book_max: null }) };
    if (r.name) cur.name = r.name;
    if (r.max != null) {
      const got = evaluate(r.max, w, w.level);
      if (isN(got)) cur.max = Math.max(0, got);
    }
    if (r.die != null) {
      const got = evaluate(r.die, w, w.level);
      cur.die = typeof got === "string" ? got : null;
    }
    for (const k of ["reset", "short_rest"]) if (r[k] != null) cur[k] = r[k];
    cur.own = own;
    cur.edited = !own;
    out.set(r.id, cur);
  }
  return [...out.values()];
}

/* ─── everything at once ─────────────────────────────────────────── */

export function derive(ch, classes = null) {
  classes = classesOf(ch, classes);
  const level = totalLevel(ch);
  const raw = baseScores(ch);
  let mods = activeModifiers(ch, classes, raw);
  const scores = Object.fromEntries(ABILITIES.map((a) => [a, apply(raw[a], mods, [a])]));
  mods = activeModifiers(ch, classes, scores); // formulas see the final scores
  const [g, removed] = granted(ch);
  const w = words(ch, scores);

  const pb = apply(proficiencyBonus(level), mods, ["pb"]);
  const expertise = new Set(g.expertise);

  const abilities = {};
  for (const a of ABILITIES) {
    const m = mod(scores[a]);
    const prof = g.saves.includes(a);
    abilities[a] = {
      score: scores[a],
      mod: m,
      check: apply(m, mods, ["check", `check.${a}`]),
      save: apply(m + (prof ? pb : 0), mods, ["save", `save.${a}`]),
      save_prof: prof,
    };
  }

  const custom = isObj(manualLayer(ch).custom_skills) ? manualLayer(ch).custom_skills : {};
  const skillDefs = Object.fromEntries(Object.entries(SKILLS).map(([k, [label, ability]]) => [k, { label, ability, custom: false }]));
  for (const [k, v] of Object.entries(custom)) {
    if (isObj(v) && ABILITIES.includes(v.ability)) skillDefs[k] = { label: v.label || k, ability: v.ability, custom: true };
  }
  const skills = {};
  for (const [k, d] of Object.entries(skillDefs)) {
    const prof = expertise.has(k) && g.skills.includes(k) ? 2 : g.skills.includes(k) ? 1 : 0;
    const total = apply(mod(scores[d.ability]) + pb * prof, mods, ["check", `check.${d.ability}`, `check.${k}`]);
    skills[k] = { ...d, prof, total, passive: 10 + total };
  }

  const speed = { ...g.speed };
  for (const [k, v] of Object.entries(speed)) if (v === "walk") speed[k] = isN(speed.walk) ? speed.walk : 0;
  for (const k of Object.keys(speed).filter((k) => isN(speed[k]))) {
    speed[k] = Math.max(0, apply(speed[k], mods, [`speed.${k}`, ...(k === "walk" ? ["speed"] : [])]));
  }
  const senses = { ...g.senses };
  for (const [k, n] of Object.entries(g.senses_bonus)) senses[k] = num(senses[k]) + n;
  for (const k of Object.keys(senses).filter((k) => isN(senses[k]))) senses[k] = Math.max(0, apply(senses[k], mods, [`senses.${k}`]));

  const spellcasting = [];
  for (const [cid, , sub] of classLevels(ch)) {
    for (const recId of [cid, sub]) {
      const sc = recId ? classes[recId]?.spellcasting || {} : {};
      const ab = sc.ability;
      if (!ABILITIES.includes(ab)) continue;
      const m = mod(scores[ab]);
      spellcasting.push({
        owner: recId,
        name: classes[recId]?.name || recId,
        ability: ab,
        attack: apply(pb + m, mods, ["spell_attack"]),
        dc: apply(8 + pb + m, mods, ["spell_dc"]),
      });
    }
  }

  const ownAb = manualLayer(ch).spell_ability;
  if (ABILITIES.includes(ownAb)) {
    // spells with no class (anyone can have them)
    const m = mod(scores[ownAb]);
    spellcasting.push({ owner: "manual", name: "Your own", ability: ownAb, attack: apply(pb + m, mods, ["spell_attack"]), dc: apply(8 + pb + m, mods, ["spell_dc"]) });
  }

  const classRows = [];
  const hitDice = {};
  for (const [cid, lvl, sub] of classLevels(ch)) {
    const rec = classes[cid] || {};
    const die = rec.hit_die || "d8";
    hitDice[die] = (hitDice[die] || 0) + lvl;
    classRows.push({
      id: cid,
      name: rec.name || cid,
      level: lvl,
      hit_die: die,
      edition: rec.edition ?? null,
      subclass: sub,
      subclass_name: sub ? classes[sub]?.name ?? null : null,
    });
  }

  return {
    level,
    pb,
    classes: classRows,
    abilities,
    skills,
    initiative: apply(mod(scores.dex), mods, ["initiative"]),
    hp_max: maxHp(ch, classes, scores, mods),
    ac: armorClass(ch, classes, scores, mods),
    speed,
    senses,
    defenses: g.defenses,
    proficiencies: Object.fromEntries(["armor", "weapons", "tools", "languages", "weapon_masteries"].map((k) => [k, g[k]])),
    hit_dice: hitDice,
    spell_slots: spellSlots(ch, classes),
    spellcasting,
    attacks: {
      melee: apply(pb + w.str_mod, mods, ["attack"]),
      ranged: apply(pb + w.dex_mod, mods, ["attack"]),
    },
    concentration: apply(abilities.con.save, mods, ["concentration"]),
    bonuses: {
      // what every attack / spell / hit gets on top (features and weapons use them)
      attack: apply(0, mods, ["attack"]),
      spell_attack: apply(0, mods, ["spell_attack"]),
      spell_dc: apply(0, mods, ["spell_dc"]),
      damage: apply(0, mods, ["damage"]),
      spell_damage: apply(0, mods, ["spell_damage"]),
    },
    resources: resources(ch, classes, scores),
    removed,
  };
}

// derive(ch), worked out once per character object (the tracker and the
// statblock ask for the same character's numbers many times).
const CACHE = new WeakMap();
export function derivedOf(ch) {
  if (!ch || typeof ch !== "object") return null;
  let d = CACHE.get(ch);
  if (!d) {
    d = derive(ch);
    CACHE.set(ch, d);
  }
  return d;
}

/* ─── play values (state counts what is used) ────────────────────── */

// HP now: `hp_current` null in the file means full.
export const currentHp = (ch, max) => {
  const cur = ch?.state?.hp_current;
  return cur == null ? max : Math.max(0, Math.min(num(cur), max));
};
