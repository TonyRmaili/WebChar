import { evaluate, tableRow } from "../../../utils/formulas";
import { classLevels, wordsFor, words } from "../../../utils/derive";
import { asList, manualOf, stateOf, withManual } from "./sheetHelpers";
import { scoresOf, usesKey, workAction } from "./featureHelpers";

/* ═══════════════════════════════════════════════════════════════════
   spellbookHelpers — the character's spells, slots and spellcasting, as
   the Spellbook tab and Play's Actions & Charges see them (version-2 file).

   A spell is a copy of the catalogue record in a layer's `spells` (the
   manual layer's for spells the player added), with `granted`: how the
   character has it:
     { how: "known" | "prepared" | "item", at, uses, ability, class, cast_at }
       at       the level it unlocks (the class's level for a class layer,
                the character's level otherwise)
       uses     null (cast with slots) · "at_will" · "ritual" ·
                { max, reset } free casts · { resource, cost }
       innate   true = innate without free casts
       ability  the spellcasting ability, when it isn't the class's
   and on the copy, set by the player:
     prepared false = not prepared (cantrips too: they count against
              the class's cantrip number like spells against prepared)
     notes    the player's own note
     removed  true = the player took it off the sheet (a spell a layer
              gave: kept hidden so a rebuild doesn't bring it back;
              "bring back" undoes it). The player's own are deleted.

   How a spell is ready (its mode):
     slots    prepared: counts toward a class's prepared (or cantrip)
              number, the diamond prepares it. `granted.class` names the
              class (the class's own picks have it; a spell the player
              adds gets the casting class that has it on its list; with
              two casting classes the player picks it, "counts toward").
     innate   always prepared, on no list: free casts per rest when it
              has them. A spell with no class to count toward is innate
              (a subclass's spells, a feat's, a race's, a race's cantrip).
     at_will  always prepared, on no list, always free.
     ritual   ritual only: always ready as a ritual, never with a slot
              (Book of Ancient Secrets, Ritual Caster); spells with the
              ritual tag only.
   Where it came from shows on its line (the layer that gave it).
     edited   true once the player changed the spell itself
     book     the spell before the first change ("back to the book's")
     catalogue_id  the catalogue entry it now comes from, after it was
              saved to the player's catalogue (the copy's own `id`
              stays, so leveling and used counts keep finding it)
   The player can change how any spell is ready (`granted.uses` /
   `granted.innate`) and its spellcasting ability (`granted.ability`). Nothing
   is held back: a spell without a class uses the character's own
   spellcasting ability (the manual layer's spell_ability).

   Slots come from derive (spell_slots, pact by level; the Resources tab
   sets them); used ones sit in state.slots_used { "1": 2 } and
   state.pact_slots_used { "3": 1 }. Free casts in state.uses_used under
   `<from>#<spell id>`.
   ═══════════════════════════════════════════════════════════════════ */

const isN = (v) => typeof v === "number" && Number.isInteger(v);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const CLASS_FROM = /^class:([^@/]+)@(\d+)$/;

export const ORDINAL = ["Cantrips", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
export const spellLevelTitle = (l) => (l === 0 ? "Cantrips" : `${ORDINAL[l]} level`);

// The spellcasting ability of a class (or its subclass, when it casts).
const castingAbility = (ch, classId) => {
  const classes = ch?.classes || {};
  const hit = classLevels(ch).find(([c]) => c === classId);
  return classes[classId]?.spellcasting?.ability || (hit?.[2] ? classes[hit[2]]?.spellcasting?.ability : null) || null;
};

/* ─── rows ───────────────────────────────────────────────────────── */

export function spellRows(ch, d) {
  if (!ch || !d) return [];
  const scores = scoresOf(d);
  const levels = Object.fromEntries(classLevels(ch).map(([c, l]) => [c, l]));
  const out = [];
  for (const layer of asList(ch.layers)) {
    const m = CLASS_FROM.exec(String(layer?.from || ""));
    const layerClass = m ? m[1] : null;
    for (const s of asList(layer?.spells)) {
      if (!isObj(s) || !s.id || s.removed) continue;
      const g = isObj(s.granted) ? s.granted : {};
      const cls = g.class || layerClass;
      // The class it counts toward: the one named; on a spell the player
      // added without one, the casting class that has it; else none (innate).
      const counts = typeof g.class === "string" && g.class ? g.class : g.class === undefined && layer.from === "manual" ? classFor(ch, s) : null;
      const mode = castMode(g.uses, !!g.innate, counts);
      const ability =
        (typeof g.ability === "string" && g.ability) ||
        (cls ? castingAbility(ch, cls) : null) ||
        manualOf(ch).spell_ability ||
        d.spellcasting[0]?.ability ||
        null;
      const mod = ability ? d.abilities[ability]?.mod ?? 0 : 0;
      const unlock = isN(g.at) ? g.at : null;
      const reached = unlock == null || unlock <= (layerClass ? levels[layerClass] ?? 0 : d.level);
      const w = wordsFor(ch, layer.from, scores, ability);
      const key = usesKey(layer.from, s.id);
      let uses = null;
      if (isObj(g.uses) && g.uses.max != null) {
        const max = evaluate(g.uses.max, w, w.class_level || w.level);
        const used = Math.max(0, Math.trunc(Number(stateOf(ch).uses_used?.[key]) || 0));
        if (isN(max) && max > 0) uses = { max, cur: clamp(max - used, 0, max), used, reset: g.uses.reset || "long" };
      }
      out.push({
        key,
        from: layer.from,
        owner: layer.label || layer.from,
        spell: s,
        level: isN(s.level) ? s.level : 0,
        how: g.how || "known",
        classId: cls,
        reached,
        unlock,
        // counts toward this class's numbers (prepared spells only)
        counts,
        layerClass,
        // innate and at-will spells are always ready
        prepared: mode !== "slots" || s.prepared !== false,
        concentration: asList(s.duration).some((x) => x?.concentration),
        ritual: !!s.ritual,
        ability,
        attack: ability ? d.pb + mod + (d.bonuses?.spell_attack || 0) : null,
        dc: ability ? 8 + d.pb + mod + (d.bonuses?.spell_dc || 0) : null,
        atWill: g.uses === "at_will",
        mode,
        // its switches (Mage Armor, Shield, Bless): on while the spell is up
        toggles: asList(s.features).filter((f) => isObj(f) && f.toggle).map((f) => ({ id: f.id, name: f.name, on: !!f.on })),
        isToggle: asList(s.features).some((f) => isObj(f) && f.toggle),
        on: asList(s.features).some((f) => isObj(f) && f.toggle && f.on),
        // where a free cast goes in Play: by its casting time
        category: TIME_CATEGORY[asList(s.time)[0]?.unit] || "actions",
        resource: isObj(g.uses) && g.uses.resource ? g.uses : null,
        uses,
        actions: asList(s.features).filter((f) => f?.action).map((f) => ({ name: f.name, action: workAction(f.action, w, d.bonuses) })),
        own: layer.from === "manual",
      });
    }
  }
  return out.sort((a, b) => a.level - b.level || String(a.spell.name).localeCompare(String(b.spell.name)));
}

// How a spell is cast, for the Spellbook's switch.
/* How a spell is ready (the player picks it for spells of 1st level and
   up; a cantrip is prepared when it counts toward a class, else innate):
     slots    prepared: counts toward its class's list, the diamond
     innate   always prepared, on no list; free casts per rest if it has
              any (granted.uses {max, reset}), or none (granted.innate)
     at_will  always prepared, on no list, always free ("at_will")
     ritual   ritual only ("ritual"): spells with the ritual tag */
export const CAST_MODES = [
  { value: "slots", label: "prepared" },
  { value: "innate", label: "innate" },
  { value: "at_will", label: "at will" },
  { value: "ritual", label: "ritual only" },
];
export function castMode(uses, innate = false, counts = null) {
  if (uses === "at_will") return "at_will";
  if (uses === "ritual") return "ritual";
  if ((isObj(uses) && uses.max != null) || innate || !counts) return "innate";
  return "slots";
}
const TIME_CATEGORY = { action: "actions", bonus_action: "bonus_actions", reaction: "reactions" };

// Spells that use slots and can be cast now: reached, prepared, not at will.
export const castable = (r) => r.reached && r.prepared && !r.atWill && r.mode !== "ritual" && r.level > 0;

/* ─── slots ──────────────────────────────────────────────────────── */

export const slotRows = (ch, d) => {
  const used = stateOf(ch).slots_used || {};
  return asList(d?.spell_slots?.slots)
    .map((max, i) => ({ level: i + 1, max, cur: clamp(max - (Number(used[String(i + 1)]) || 0), 0, max) }))
    .filter((s) => s.max > 0);
};

// Pact slots, one row per slot level.
export const pactRows = (ch, d) => {
  const used = isObj(stateOf(ch).pact_slots_used) ? stateOf(ch).pact_slots_used : {};
  return asList(d?.spell_slots?.pact).map((p) => ({ level: p.level, max: p.count, cur: clamp(p.count - (Number(used[String(p.level)]) || 0), 0, p.count) }));
};

/* How many spells and cantrips each casting class may have prepared:
   its table or formula at its level (`book_*`), or the player's own
   number (manual.prepared_overrides { "<class id>": { spells, cantrips } }),
   and how many of its own picks are prepared now. Only a note on the
   sheet, never a limit. */
export function preparedLimits(ch, d, rows) {
  const classes = ch?.classes || {};
  const scores = scoresOf(d);
  const own = manualOf(ch).prepared_overrides || {};
  const out = [];
  for (const [cid, lvl, sub] of classLevels(ch)) {
    const sc = classes[cid]?.spellcasting || (sub ? classes[sub]?.spellcasting : null);
    if (!sc?.ability) continue;
    const w = words(ch, scores, classes[cid], lvl, sc.ability);
    const pick = (t) => (t == null ? null : isObj(t) ? tableRow(t, lvl) : evaluate(t, w, lvl));
    const bookSpells = pick(sc.known ?? sc.prepared);
    const bookCantrips = pick(sc.cantrips);
    const mine = rows.filter((r) => r.counts === cid);
    const o = isObj(own[cid]) ? own[cid] : {};
    const n = (v) => (isN(v) ? v : null);
    out.push({
      classId: cid,
      name: classes[cid]?.name || cid,
      book_spells: n(bookSpells),
      book_cantrips: n(bookCantrips),
      spells: isN(o.spells) ? o.spells : n(bookSpells),
      cantrips: isN(o.cantrips) ? o.cantrips : n(bookCantrips),
      prepared: mine.filter((r) => r.level > 0 && r.prepared && r.mode === "slots").length,
      cantripCount: mine.filter((r) => r.level === 0 && r.prepared && r.mode === "slots").length,
    });
  }
  return out;
}

// The player's own prepared / cantrip number for a class (null = the book's).
export const setPreparedOverride = (ch, classId, kind, n) =>
  withManual(ch, (m) => {
    const all = { ...(m.prepared_overrides || {}) };
    const one = { ...(all[classId] || {}) };
    if (n == null) delete one[kind];
    else one[kind] = n;
    if (Object.keys(one).length) all[classId] = one;
    else delete all[classId];
    return { ...m, prepared_overrides: all };
  });

/* Spellcasting numbers, one row per ability: the classes that cast with
   it, and the character's own ability when no class uses that one. */
export function castingRows(d) {
  const out = [];
  for (const s of asList(d?.spellcasting)) {
    const row = out.find((r) => r.ability === s.ability);
    if (row) {
      if (s.owner !== "manual") row.names.push(s.name);
    } else out.push({ ability: s.ability, names: s.owner === "manual" ? [] : [s.name], own: s.owner === "manual", attack: s.attack, dc: s.dc });
  }
  return out;
}

/* ─── components ─────────────────────────────────────────────────── */

/* V S M for a line: "M*" when the material has a cost, is used up or
   names something specific; its words go in `material` (a tooltip). */
export function componentMarks(s) {
  const c = s?.components || {};
  const m = c.m;
  const text = typeof m === "string" ? m : isObj(m) ? m.text || "" : "";
  const special = isObj(m) && (m.cost || m.consumed);
  return {
    marks: [c.v && "V", c.s && "S", m && (special ? "M*" : "M")].filter(Boolean),
    material: text || null,
  };
}

/* ─── writers (each returns a patch for CharStore.patchChar) ─────── */

export function patchSpell(ch, from, id, patch) {
  return {
    layers: asList(ch.layers).map((l) => (l?.from === from ? { ...l, spells: asList(l.spells).map((s) => (s?.id === id ? { ...s, ...patch } : s)) } : l)),
  };
}

// The casting classes (with a spellcasting ability), in class order.
export const castingClasses = (ch) =>
  classLevels(ch)
    .filter(([cid, , sub]) => ch?.classes?.[cid]?.spellcasting?.ability || (sub && ch?.classes?.[sub]?.spellcasting?.ability))
    .map(([cid]) => ({ id: cid, name: ch.classes[cid]?.name || cid }));

// The class a spell the player adds counts toward: the casting class that
// has it on its list ("wizard" or "wizard-xphb" in its classes), else the
// first casting class, else none (then it's innate).
export function classFor(ch, entry) {
  const casting = castingClasses(ch);
  const lists = asList(entry?.classes).map((c) => String(c).toLowerCase());
  const hit = casting.find((c) => lists.includes(c.id) || lists.some((l) => l.split("-")[0] === c.id.split("-")[0]));
  return (hit || casting[0] || {}).id || null;
}

/* A catalogue spell the player adds: a copy in the manual layer. It
   counts toward a class (classFor) and lands prepared while that class
   has room (`room(classId, level)` from the tab). */
export const addSpell = (ch, entry, room = () => true) =>
  withManual(ch, (m) => {
    if (asList(m.spells).some((s) => s?.id === entry.id)) return m;
    const copy = JSON.parse(JSON.stringify(entry));
    delete copy.visibility;
    const cls = classFor(ch, entry);
    const granted = cls ? { how: "known", class: cls } : { how: "known" };
    return { ...m, spells: [...asList(m.spells), { ...copy, granted, prepared: cls ? room(cls, isN(copy.level) ? copy.level : 0) : true }] };
  });

export const removeSpell = (ch, id) => withManual(ch, (m) => ({ ...m, spells: asList(m.spells).filter((s) => s?.id !== id) }));

// A spell a layer gave: hide it (removed) or bring it back.
export const setSpellRemoved = (ch, from, id, removed) => patchSpell(ch, from, id, { removed: removed || undefined });

export const hiddenSpells = (ch) =>
  asList(ch?.layers).flatMap((l) => asList(l?.spells).filter((s) => isObj(s) && s.removed).map((s) => ({ from: l.from, spell: s, owner: l.label || l.from })));

// Which class a prepared spell counts toward.
export const setSpellClass = (ch, from, spell, classId) => patchSpell(ch, from, spell.id, { granted: { ...(spell.granted || {}), class: classId } });

export function setSlotUsed(ch, level, used) {
  const st = stateOf(ch);
  const next = { ...(st.slots_used || {}) };
  if (used > 0) next[String(level)] = used;
  else delete next[String(level)];
  return { state: { ...st, slots_used: next } };
}

export function setPactUsed(ch, level, used) {
  const st = stateOf(ch);
  const next = { ...(isObj(st.pact_slots_used) ? st.pact_slots_used : {}) };
  if (used > 0) next[String(level)] = used;
  else delete next[String(level)];
  return { state: { ...st, pact_slots_used: next } };
}

/* Set how a spell is ready: "slots" | "innate" | "at_will" | "ritual". Innate takes
   `max` free casts per `reset` (no number = innate without free casts).
   Prepared needs a class to count toward: the one it has, else its
   layer's class, else the casting class that has it on its list. */
export function setCastMode(ch, from, spell, mode, max = null, reset = "long") {
  const g = { ...(spell.granted || {}) };
  delete g.innate;
  if (mode === "slots" && !(typeof g.class === "string" && g.class)) {
    const cls = CLASS_FROM.exec(String(from || ""))?.[1] || classFor(ch, spell);
    if (cls) g.class = cls;
  }
  if (mode === "innate") {
    if (isN(max) && max > 0) g.uses = { max, reset };
    else {
      g.uses = undefined;
      g.innate = true;
    }
  } else g.uses = mode === "at_will" || mode === "ritual" ? mode : undefined;
  return patchSpell(ch, from, spell.id, { granted: g });
}

// Switch a spell's toggles (Mage Armor, Shield…) on or off together.
export function setSpellOn(ch, from, spell, on) {
  return patchSpell(ch, from, spell.id, { features: asList(spell.features).map((f) => (isObj(f) && f.toggle ? { ...f, on: on || undefined } : f)) });
}

export const setSpellAbility = (ch, from, spell, ability) => patchSpell(ch, from, spell.id, { granted: { ...(spell.granted || {}), ability: ability || undefined } });

// The character's own spellcasting ability, for spells without a class.
export const setOwnSpellAbility = (ch, ability) => withManual(ch, (m) => ({ ...m, spell_ability: ability || null }));

/* ─── the spell itself: edit, back to the book's, save to the catalogue ─── */

// What the character does with a spell, kept through any edit of it.
export const SPELL_SHEET_KEYS = ["id", "granted", "prepared", "notes", "edited", "book", "catalogue_id"];
const pickKeys = (o, keys) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));
const dropKeys = (o, keys) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !keys.includes(k)));

// The spell without the character's use of it (a catalogue record).
export const spellRecord = (s) => dropKeys(s, [...SPELL_SHEET_KEYS, "visibility", "created_by", "_sheet", "_key", "_own"]);

export const editedSpell = (s, record) => ({
  ...spellRecord(record),
  source: s.source ?? record.source,
  ...pickKeys(s, SPELL_SHEET_KEYS),
  edited: true,
  book: s.book || spellRecord(s),
});

export const savedSpell = (s, saved) => ({ ...spellRecord(saved), ...pickKeys(s, SPELL_SHEET_KEYS), catalogue_id: saved.id, edited: undefined, book: undefined });

export const restoredSpell = (s) => (s.book ? { ...s.book, ...pickKeys(s, SPELL_SHEET_KEYS), edited: undefined, book: undefined } : s);

export const replaceSpell = (ch, from, copy) => ({
  layers: asList(ch.layers).map((l) => (l?.from === from ? { ...l, spells: asList(l.spells).map((x) => (x?.id === copy.id ? copy : x)) } : l)),
});

// A spell of the player's own (made in the form): the manual layer's.
export const addOwnSpell = (ch, copy) => withManual(ch, (m) => ({ ...m, spells: [...asList(m.spells), { granted: { how: "known" }, prepared: true, ...copy }] }));
