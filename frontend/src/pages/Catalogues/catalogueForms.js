import { HOMEBREW, isGroup, pruneEmpty, titleCase, formatItemGrant, formatCurrency } from "./catalogueHelpers";

/* ═══════════════════════════════════════════════════════════════════
   catalogueForms — turning a catalogue record into the flat object a
   create / edit form works on, and back. Shared by every category,
   because every category stores the same parts:

     header        name · edition · visibility · text      headerToForm / formToHeader
     grants +      what it gives, fixed and by choice        grantsToForm / formToGrants
     choices
     prerequisites (feats; later optional features)          prereqsToForm / formToPrereqs

   Whatever a form has no field for is carried through untouched
   (`extraGrants`, `extraChoices`, a prerequisite group's other keys), so
   editing a copy never loses data. Ids of existing choices are kept,
   because other parts point at them (a spell's {"ability": {"choice":
   "spell_ability"}}).
   ═══════════════════════════════════════════════════════════════════ */

// ─── Header ────────────────────────────────────────────────────────

export const emptyHeaderForm = () => ({ name: "", edition: "one", visibility: "private", text: "" });

export const headerToForm = (entry, { copy = false } = {}) => ({
  name: copy ? `${entry.name} (copy)` : entry.name || "",
  edition: entry.edition || "one",
  visibility: copy ? "private" : entry.visibility || "private",
  text: entry.text || "",
  // kept as they are: other names it goes by, the book's trait tags, the settings it's for
  aliases: entry.aliases,
  tags: entry.tags,
  campaigns: entry.campaigns,
});

// The record's header. An edit keeps the record's id; a new or copied
// record gets its id from the backend.
export const formToHeader = (form, kind, original) => ({
  ...(original?.id ? { id: original.id } : {}),
  kind,
  name: form.name.trim(),
  source: HOMEBREW,
  edition: form.edition,
  visibility: form.visibility,
  text: form.text,
  aliases: form.aliases,
  tags: form.tags,
  campaigns: form.campaigns,
});

// ─── Grants & choices ──────────────────────────────────────────────

// The id lists the form edits as "always" + "choose N from" (PoolEditor).
export const POOL_KINDS = ["skills", "expertise", "tools", "languages", "saves", "weapons", "armor"];

// Ability bonus sets ("+2/+1 or +1/+1/+1" in 2024 backgrounds).
export const BONUS_SETS = {
  "2/1": [2, 1],
  "1/1/1": [1, 1, 1],
  "2": [2],
  "1": [1],
  "1/1": [1, 1],
};
const setKey = (set) => set.join("/");

export const emptyPool = () => ({ fixed: [], from: [], count: 1 });

export const emptySpellPool = () => ({
  count: 1, levels: [0], classes: [], schools: [], ritual: false, how: "prepared", uses: undefined,
});

export const emptyGrantsForm = () => ({
  abilityFixed: {},                             // { dex: 2 }: raised outright
  speed: {},                                    // { walk: 30, fly: "walk" }: "walk" = equal to the walking speed
  senses: {},                                   // { darkvision: 60 }
  defenses: { resist: [], immune: [], vulnerable: [], condition_immune: [] },
  ability: { from: [], sets: [] },              // the ability choice
  ...Object.fromEntries(POOL_KINDS.map((k) => [k, emptyPool()])),
  feats: [],                                    // [{ feat, option }]
  featPool: { on: false, count: 1, categories: [] },
  items: [],                                    // item grants
  currency: {},
  spells: [],                                   // spell grants [{ spell, how, at, … }]
  spellPools: [],                               // "choose N level-1 wizard spells"
  spellAbility: { on: false, from: [] },        // "Int, Wis or Cha is your spellcasting ability"
  extraGrants: {},                              // grants the form has no field for
  extraChoices: [],                             // choices the form has no field for
});

const isPoolOf = (c, kind) => c?.type === "pool" && c.grant === kind;
const fromList = (from) => (typeof from === "string" ? [from] : Array.isArray(from) ? from : []);
const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/* grants + choices → form. `claim(pred)` may be passed in by a category
   form to take its own choices first (a background's equipment bundle);
   the rest are left for this one. Returns { form, rest }: rest = choices
   nobody claimed, which go to extraChoices. */
export function grantsToForm(grants, choices) {
  const g = { ...(grants || {}) };
  const list = choices || [];
  const taken = new Set();
  const take = (pred) => {
    const i = list.findIndex((c, j) => !taken.has(j) && pred(c));
    if (i < 0) return null;
    taken.add(i);
    return list[i];
  };
  const form = emptyGrantsForm();

  form.abilityFixed = g.ability || {};
  form.speed = g.speed || {};
  form.senses = g.senses || {};
  form.defenses = { ...emptyGrantsForm().defenses, ...(g.defenses || {}) };
  delete g.ability;
  delete g.speed;
  delete g.senses;
  delete g.defenses;

  const ability = take((c) => c.type === "ability");
  if (ability) {
    form.ability = {
      id: ability.id,
      from: ability.from || [],
      sets: (ability.bonus_sets || []).map(setKey),
      label: ability.label,
      note: ability.note,
      max: ability.max,
    };
  }

  for (const kind of POOL_KINDS) {
    const pool = take((c) => isPoolOf(c, kind));
    form[kind] = {
      fixed: g[kind] || [],
      from: pool ? fromList(pool.from) : [],
      count: pool?.count || 1,
      id: pool?.id,
      label: pool?.label,
    };
    delete g[kind];
  }

  form.feats = g.feats || [];
  delete g.feats;
  const featPool = take(
    (c) => isPoolOf(c, "feats") && (c.from === "all_feats" || (c.from && typeof c.from === "object" && !Array.isArray(c.from)))
  );
  if (featPool) {
    form.featPool = {
      on: true,
      id: featPool.id,
      count: featPool.count || 1,
      categories: featPool.from === "all_feats" ? [] : asList(featPool.from.category),
      label: featPool.label,
    };
  }

  form.items = g.items || [];
  form.currency = g.currency || {};
  form.spells = g.spells || [];
  delete g.items;
  delete g.currency;
  delete g.spells;

  // spell picks by filter; how they're ready is `how` + `uses`
  // (catalogueHelpers.spellReady); anything else (ability, at) rides along in `rest`
  let pool;
  while ((pool = take((c) => isPoolOf(c, "spells") && c.from && typeof c.from === "object" && !Array.isArray(c.from)))) {
    const { spell_level, class: cls, school, ritual, ...otherFilter } = pool.from;
    const { type, id, label, grant, count, from, how, uses, ...rest } = pool;
    form.spellPools.push({
      id,
      label,
      count: count || 1,
      levels: asList(spell_level),
      classes: asList(cls),
      schools: asList(school),
      ritual: !!ritual,
      how: how || "known",
      uses,
      otherFilter,
      rest,
    });
  }

  const spellAbility = take((c) => isPoolOf(c, "spell_ability"));
  if (spellAbility) form.spellAbility = { on: true, id: spellAbility.id, from: fromList(spellAbility.from), label: spellAbility.label };

  form.extraGrants = g;
  form.extraChoices = list.filter((_, i) => !taken.has(i));
  return form;
}

// A unique choice id: the form's own id when it has one.
const makeIds = () => {
  const used = new Set();
  return (wanted, base) => {
    let id = wanted || base;
    let n = 2;
    while (used.has(id)) id = `${base}_${n++}`;
    used.add(id);
    return id;
  };
};

const oneOrList = (list) => (list.length === 1 ? list[0] : list.length ? list : undefined);

// form → { grants, choices }. Extra choices go last, as read.
export function formToGrants(f) {
  const idFor = makeIds();
  (f.extraChoices || []).forEach((c) => c.id && idFor(c.id, c.id));
  const choices = [];

  if (f.ability.from.length && f.ability.sets.length) {
    choices.push({
      type: "ability",
      id: idFor(f.ability.id, "ability"),
      label: f.ability.label || "Ability Scores",
      from: f.ability.from,
      bonus_sets: f.ability.sets.map((k) => BONUS_SETS[k] || k.split("/").map(Number)),
      max: f.ability.max,
      note: f.ability.note,
    });
  }

  for (const kind of POOL_KINDS) {
    const p = f[kind];
    if (!p.from.length) continue;
    choices.push({
      type: "pool",
      id: idFor(p.id, kind),
      label: p.label || titleCase(kind === "saves" ? "saving throws" : kind),
      grant: kind,
      count: p.count || 1,
      // one group on its own is written as the group id ("standard_languages")
      from: p.from.length === 1 && isGroup(p.from[0]) ? p.from[0] : p.from,
    });
  }

  if (f.featPool.on) {
    choices.push({
      type: "pool",
      id: idFor(f.featPool.id, "feats"),
      label: f.featPool.label || "Feat",
      grant: "feats",
      count: f.featPool.count || 1,
      from: f.featPool.categories.length ? { category: f.featPool.categories } : "all_feats",
    });
  }

  for (const sp of f.spellPools) {
    choices.push({
      ...sp.rest,
      type: "pool",
      id: idFor(sp.id, "spells"),
      label: sp.label || "Spells",
      grant: "spells",
      count: sp.count || 1,
      from: {
        ...sp.otherFilter,
        spell_level: oneOrList(sp.levels),
        class: oneOrList(sp.classes),
        school: oneOrList(sp.schools),
        ritual: sp.ritual || undefined,
      },
      how: sp.how,
      uses: sp.uses,
    });
  }

  if (f.spellAbility.on && f.spellAbility.from.length) {
    choices.push({
      type: "pool",
      id: f.spellAbility.id || "spell_ability",
      label: f.spellAbility.label || "Spellcasting Ability",
      grant: "spell_ability",
      count: 1,
      from: f.spellAbility.from,
    });
  }

  const grants = {
    ...f.extraGrants,
    ability: f.abilityFixed,
    speed: f.speed,
    senses: f.senses,
    defenses: f.defenses,
    ...Object.fromEntries(POOL_KINDS.map((k) => [k, f[k].fixed])),
    feats: f.feats.map((g) => ({ feat: g.feat, option: g.option?.trim() || undefined })),
    items: f.items,
    currency: f.currency,
    spells: f.spells,
  };

  return {
    grants: pruneEmpty(grants) || {},
    choices: pruneEmpty([...choices, ...(f.extraChoices || [])]) || [],
  };
}

// ─── Bundles ("choose one of these packages") ──────────────────────

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

export const emptyOption = () => ({ label: "", items: [], currency: {}, choices: [], otherGrants: {} });

// The words an option is shown with when no label was typed:
// "Book (Prayers), Holy Symbol, 8 GP" (as the pipeline makes them).
export const optionLabel = (o, index) =>
  [...(o.items || []).map((i) => formatItemGrant(i, index)), formatCurrency(o.currency)].filter(Boolean).join(", ");

// A bundle of item/gold options → a list of option forms.
export const bundleToForm = (bundle) =>
  (bundle?.options || []).map((o) => {
    const { items = [], currency = {}, ...otherGrants } = o.grants || {};
    return { label: o.label || "", items, currency, choices: o.choices || [], otherGrants };
  });

export const formToBundle = (options, { id, label }) =>
  options.length
    ? pruneEmpty({
        type: "bundle",
        id,
        label,
        options: options.map((o, i) => ({
          id: LETTERS[i] || `o${i}`,
          label: o.label.trim() || optionLabel(o) || `Option ${(LETTERS[i] || String(i)).toUpperCase()}`,
          grants: { ...o.otherGrants, items: o.items, currency: o.currency },
          choices: o.choices,
        })),
      })
    : null;

// ─── Prerequisites ─────────────────────────────────────────────────
// One form group per alternative. The form edits level, class level,
// ability scores, spellcasting, feats, armor training, pact boon and a
// note; other keys (species, spells, items…) ride along.

export const emptyPrereqGroup = () => ({
  level: null, classLevels: [], abilities: [], spellcasting: false, feats: [], armor: [], pacts: [], note: "", rest: {},
});

export const prereqsToForm = (prereqs) =>
  (prereqs || []).map((g) => {
    const { level, class_level, ability, spellcasting, feat, proficiency, pact, note, ...rest } = g;
    const armor = (proficiency || []).filter((p) => p.armor && Object.keys(p).length === 1).map((p) => p.armor);
    const otherProf = (proficiency || []).filter((p) => !(p.armor && Object.keys(p).length === 1));
    // "Dex 13 and Wis 13" in one option can't be shown as rows: it rides along
    const together = (ability || []).some((o) => Object.keys(o).length > 1);
    if (together) rest.ability = ability;
    return {
      level: level ?? null,
      // any one of these: { class, level, subclass }
      classLevels: (class_level || []).map((c) => ({ class: c.class, level: c.level, subclass: c.subclass || "" })),
      pacts: pact || [],
      // any one of these; one row each: { ability, score }
      abilities: together ? [] : (ability || []).flatMap((o) => Object.entries(o).map(([a, n]) => ({ ability: a, score: n }))),
      spellcasting: !!spellcasting,
      feats: feat || [],
      armor,
      note: note || "",
      rest: otherProf.length ? { ...rest, proficiency: otherProf } : rest,
    };
  });

export const formToPrereqs = (groups) => {
  const out = groups.map((g) => {
    const otherProf = g.rest.proficiency || [];
    const { proficiency: _p, ...rest } = g.rest;
    const rows = g.abilities.filter((r) => r.ability && r.score).map((r) => ({ [r.ability]: Number(r.score) }));
    return pruneEmpty({
      ...rest,
      level: g.level || undefined,
      class_level: g.classLevels
        .filter((c) => c.class && c.level)
        .map((c) => ({ class: c.class, level: Number(c.level), subclass: c.subclass?.trim() || undefined })),
      ability: rows.length ? rows : rest.ability,
      pact: g.pacts,
      spellcasting: g.spellcasting || undefined,
      feat: g.feats,
      proficiency: [...g.armor.map((a) => ({ armor: a })), ...otherProf],
      note: g.note.trim(),
    });
  });
  return out.filter(Boolean);
};
