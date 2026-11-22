import { ABILITIES, SKILLS } from "../../Catalogues/catalogueHelpers";
import { abilityMod, crStats } from "../../Catalogues/Monsters/monsterHelpers";
import { derivedOf } from "../../../utils/derive";
import { isNumber } from "../../../utils/featureRuntime";
import { MONSTER_SECTIONS, entryFrom, initiativeOf, modOf, pbOf, skillBonus } from "../statblock/monsterStatblock";

/* ═══════════════════════════════════════════════════════════════════
   templateLogic.js — laying templates on a creature (layered, live).

   A creature keeps its own statblock plus a list of templates:
       templates: [{ id, on }]          on: false = switched off for now
   The statblock you see is worked out every time from the creature and
   the *current* version of each template (a live link), in the order
   they were added. Nothing of the template is written into the
   creature, so a template can be switched off or removed at any time.

   What a template does (its layout: templateStatblock.js):
     adjust   numbers up or down: AC, HP (flat and %), initiative, ability
              scores, speeds, skills, to-hit, damage, save DCs, spell DC
              and attack
     grant    save proficiencies, defenses, senses (higher wins), speeds
              (higher wins), languages, extra damage on attacks, features
              (traits, actions, …), spellcasting, gear
     set      name prefix / suffix, type, size, alignment, challenge
   Its features, spellcasting and gear are in the monster record's own
   layout, so the monster statblock actions edit them.
   Templates never take anything away, except that a resistance and a
   vulnerability to the same type cancel each other, and an immunity
   beats both.

   Rows a template gives get the id "<template id>/<row id>" and
   `from_template: <template name>`; their spent uses live on the creature
   as template_uses["<that id>"].

   HP: what a template adds (or takes) is a bonus on top. Current HP moves
   with it, and `_hp_delta` on the result says by how much, so damage can
   be written back to the creature's own number (trackerLogic.withHp).
   ═══════════════════════════════════════════════════════════════════ */

const asList = (v) => (Array.isArray(v) ? v : []);
const toInt = (v, fallback = 0) => {
  if (v === "" || v == null) return fallback;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
};
const signed = (n) => `${n >= 0 ? "+" : ""}${n}`;
const lower = (s) => String(s || "").toLowerCase();
const nameOf = (v) => (typeof v === "string" ? v : v?.name || v?.type || "");

/* ─── which templates a creature has ─────────────────────────────── */

/* A creature's templates come from two places:
     its own list      raw.templates: [{ id, on }]
     its groups        what the group(s) it came in with give *right now*
                       (live: change the group, everyone from it changes)
   Which groups reach a creature:
     monster           the group it joined the encounter with
                       (group_id "<group id>#<when>")
     party / NPC       its place in an encounter: member.groups [id, …],
                       so an NPC has a group's templates only while it is
                       in that encounter
   Both lists merge by id, so a template is never on twice. An entry in
   the creature's own list wins — that is how a group's template is
   switched off for one creature. */

// Ids of the groups whose templates reach this creature.
export function groupIdsOf(raw, member) {
  if (member) return asList(member.groups);
  return raw?.group_id ? [String(raw.group_id).split("#")[0]] : [];
}

// [{ id, group }] — templates the creature gets from its groups (group = its name).
export function groupTemplates(groupIds, groups) {
  const out = [];
  for (const gid of asList(groupIds)) {
    const g = asList(groups).find((x) => x.id === gid);
    for (const id of asList(g?.templates)) {
      const had = out.find((o) => o.id === id);
      if (had) had.group = `${had.group}, ${g.name}`;
      else out.push({ id, group: g.name || "a group" });
    }
  }
  return out;
}

// What `given` to pass below for a creature (member: its encounter entry, if any).
export const givenTemplates = (raw, member, groups) => groupTemplates(groupIdsOf(raw, member), groups);

// The encounter entry of a party member or NPC (they are in one at most).
export function memberIn(encounters, kind, file) {
  for (const e of asList(encounters)) {
    const m = asList(e.members).find((x) => x.kind === kind && x.file === file);
    if (m) return m;
  }
  return null;
}

// Own entries first, then group ones it doesn't have an entry for.
function refsOf(raw, given) {
  const own = asList(raw?.templates);
  const fromGroups = asList(given);
  return [
    ...own.map((r) => ({ ...r, group: fromGroups.find((g) => g.id === r.id)?.group || null })),
    ...fromGroups.filter((g) => !own.some((r) => r.id === g.id)).map((g) => ({ id: g.id, on: true, group: g.group })),
  ];
}

// The template objects that are switched on, in the order they were added.
export const resolveTemplates = (raw, all, given) =>
  refsOf(raw, given)
    .filter((r) => r?.on !== false)
    .map((r) => asList(all).find((t) => t.id === r.id))
    .filter(Boolean);

// Every template on it, on or off, with its name and the group it comes
// from (for menus and the card).
export const attachedTemplates = (raw, all, given) =>
  refsOf(raw, given).map((r) => ({ ...r, on: r?.on !== false, template: asList(all).find((t) => t.id === r.id) || null }));

export const addTemplate = (raw, id) => (asList(raw?.templates).some((r) => r.id === id) ? raw : { ...raw, templates: [...asList(raw?.templates), { id, on: true }] });
// Works for a group's template too: the creature gets its own entry saying on/off.
export const switchTemplate = (raw, id, on) =>
  asList(raw?.templates).some((r) => r.id === id)
    ? { ...raw, templates: asList(raw?.templates).map((r) => (r.id === id ? { ...r, on } : r)) }
    : { ...raw, templates: [...asList(raw?.templates), { id, on }] };
// Taking one off also forgets the uses its rows had.
export const removeTemplate = (raw, id) => {
  const uses = Object.fromEntries(Object.entries(raw?.template_uses || {}).filter(([k]) => !k.startsWith(`${id}/`)));
  return { ...raw, templates: asList(raw?.templates).filter((r) => r.id !== id), template_uses: uses };
};

// Right-click menu groups for a creature's templates (statblock card and
// tracker). `change(fn)` gets fn(raw) → next raw and saves it. A group's
// template can be switched off for this creature but not taken off — that
// is done on the group.
export function templateMenuGroups(raw, all, change, given) {
  const attached = attachedTemplates(raw, all, given);
  const name = (a) => a.template?.name || "a deleted template";
  const own = attached.filter((a) => !a.group);
  return [
    {
      heading: "Templates on it",
      items: attached.map((a) => ({
        label: name(a),
        note: `${a.on ? "on · click to switch off" : "off · click to switch on"}${a.group ? ` · from ${a.group}` : ""}`,
        onSelect: () => change((r) => switchTemplate(r, a.id, !a.on)),
      })),
      empty: "None yet",
    },
    {
      heading: "Give it a template",
      items: asList(all)
        .filter((t) => !attached.some((a) => a.id === t.id))
        .map((t) => ({ label: t.name, note: t.scope === "all" ? "all campaigns" : undefined, onSelect: () => change((r) => addTemplate(r, t.id)) })),
      empty: all ? "No other templates — make one on the Combat page" : "Fetching…",
    },
    ...(own.length ? [{ heading: "Take a template off", items: own.map((a) => ({ label: name(a), danger: true, onSelect: () => change((r) => removeTemplate(r, a.id)) })) }] : []),
  ];
}

/* ─── shared bits ────────────────────────────────────────────────── */

export const DEFENSE_KEYS = ["resist", "immune", "vulnerable", "condition_immune"];

// Resistance + vulnerability to the same type cancel; immunity beats both.
function settleDamage(res, imm, vul) {
  const r = new Set(res.map(lower));
  const i = new Set(imm.map(lower));
  const v = new Set(vul.map(lower));
  for (const t of [...r]) {
    if (v.has(t)) {
      r.delete(t);
      v.delete(t);
    }
  }
  for (const t of i) {
    r.delete(t);
    v.delete(t);
  }
  return { res: [...r], imm: [...i], vul: [...v] };
}

const union = (a, b) => {
  const out = [...asList(a)];
  for (const x of asList(b)) if (!out.some((y) => lower(nameOf(y)) === lower(nameOf(x)))) out.push(x);
  return out;
};

const nsId = (t, id) => `${t.id}/${id}`;
const speedNum = (v) => (isNumber(v) ? v : isNumber(v?.number) ? v.number : null);

// Higher wins; numbers only.
function mergeHigher(base, grant) {
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(grant || {})) {
    if (typeof v === "boolean") {
      if (v) out[k] = true;
      continue;
    }
    const n = toInt(v, 0);
    if (n > 0 && n > (speedNum(out[k]) ?? toInt(out[k], 0))) out[k] = n;
  }
  return out;
}

// Speeds the creature has go up or down; modes it doesn't have are left alone.
function adjustSpeeds(speed, adjust) {
  const out = { ...(speed || {}) };
  for (const [k, d] of Object.entries(adjust || {})) {
    const cur = speedNum(out[k]);
    if (cur == null || !toInt(d, 0)) continue;
    const next = Math.max(0, cur + toInt(d, 0));
    out[k] = typeof out[k] === "object" ? { ...out[k], number: next } : next;
  }
  return out;
}

const affixed = (name, t) => {
  const pre = String(t.affix?.prefix || "").trim();
  const suf = String(t.affix?.suffix || "").trim();
  return [pre, name, suf].filter(Boolean).join(" ");
};

const hpDelta = (max, adjust) => toInt(adjust?.hp, 0) + Math.round((max * toInt(adjust?.hp_percent, 0)) / 100);

// Saves and skills are totals: they move with the score or proficiency under them.
const shift = (obj, delta, keep = () => true) =>
  Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, isNumber(v) && keep(k) ? v + delta : v]));

/* ─── monsters ───────────────────────────────────────────────────── */

// To-hit, damage and save DCs on every feature that has them. A number
// still in words (a summon's "3 + spell level") is left as it is.
function adjustFeatures(features, a, extra) {
  const toHit = toInt(a.to_hit, 0);
  const dmg = toInt(a.damage, 0);
  const dc = toInt(a.save_dc, 0);
  const addPart = extra?.dice ? { dice: extra.dice, type: extra.type || undefined } : null;
  if (!toHit && !dmg && !dc && !addPart) return features;
  return asList(features).map((f) => {
    const act = f?.action;
    if (!act) return f;
    let next = act;
    if (act.attack && (toHit || dmg || addPart)) {
      const damage = asList(act.attack.damage).map((p, i) =>
        i === 0 && dmg && (p.bonus == null || isNumber(p.bonus)) ? { ...p, bonus: (p.bonus ?? 0) + dmg } : p
      );
      if (addPart) damage.push(addPart);
      next = { ...next, attack: { ...act.attack, bonus: isNumber(act.attack.bonus) ? act.attack.bonus + toHit : act.attack.bonus, damage } };
    }
    if (act.save && dc && isNumber(act.save.dc)) next = { ...next, save: { ...act.save, dc: act.save.dc + dc } };
    return next === act ? f : { ...f, action: next };
  });
}

// The template's own features, ready to sit next to the creature's.
function grantedFeatures(t, uses) {
  return asList(t.features)
    .filter((f) => f && f.active !== false)
    .map((f) => {
      const id = nsId(t, f.id);
      const row = { ...f, id, from_template: t.name || "template", active: true };
      if (isNumber(uses[id])) row.uses_left = uses[id];
      else delete row.uses_left;
      return row;
    });
}

function grantedSpells(t, uses) {
  const left = (id) => (isNumber(uses[id]) ? uses[id] : undefined);
  return asList(t.spellcasting).map((b) => ({
    ...b,
    id: nsId(t, b.id),
    from_template: t.name,
    name: `${b.name || "Spellcasting"} (${t.name})`,
    groups: asList(b.groups).map((g) => ({
      ...g,
      id: nsId(t, g.id),
      from_template: t.name,
      uses_left: left(nsId(t, g.id)),
      spells: asList(g.spells).map((s) => ({ ...s, id: nsId(t, s.id), from_template: t.name, uses_left: left(nsId(t, s.id)) })),
    })),
  }));
}

function applyOneToMonster(m, t, uses) {
  const a = t.adjust || {};
  let out = { ...m, name: affixed(m.name, t) };

  // set
  const set = t.set || {};
  if (set.type) out.creature_type = { ...(out.creature_type || {}), type: lower(set.type) };
  if (set.size) out.size = [set.size];
  if (set.alignment) out.alignment = [lower(set.alignment)];
  const oldPb = pbOf(out);
  if (set.cr) {
    const stats = crStats(set.cr);
    out.cr = { cr: set.cr, xp: stats?.xp ?? null, pb: stats?.pb ?? oldPb };
  }
  const pbDelta = pbOf(out) - oldPb;
  let saves = shift(out.saves, pbDelta);
  let skills = shift(out.skills, pbDelta);

  // ability scores, and the saves, skills and initiative that hang on them
  const abilities = { ...(out.abilities || {}) };
  let initiative = out.initiative;
  for (const ab of ABILITIES) {
    const d = toInt(a.abilities?.[ab], 0);
    if (!d) continue;
    const score = toInt(abilities[ab], 10);
    const delta = abilityMod(score + d) - abilityMod(score);
    abilities[ab] = score + d;
    saves = shift(saves, delta, (k) => k === ab);
    skills = shift(skills, delta, (k) => SKILLS[k] === ab);
    if (ab === "dex" && isNumber(initiative?.bonus)) initiative = { ...initiative, bonus: initiative.bonus + delta };
  }
  out = { ...out, abilities, saves, skills, initiative };
  for (const ab of asList(t.saves)) if (!isNumber(saves[ab])) saves[ab] = modOf(out, ab) + pbOf(out);

  // skills: listed ones move; unlisted ones start from the ability modifier
  for (const [key, d] of Object.entries(a.skills || {})) {
    if (!toInt(d, 0)) continue;
    skills[key] = (skillBonus(out, key) ?? modOf(out, SKILLS[key] || "wis")) + toInt(d, 0);
  }

  // AC, HP, initiative, speeds, senses
  if (toInt(a.ac, 0)) {
    const [first, ...rest] = asList(out.ac);
    out.ac = [{ ...(first || {}), value: toInt(first?.value, 10) + toInt(a.ac, 0) }, ...rest];
  }
  const max = Math.max(0, toInt(out.hp?.average, 0));
  const delta = hpDelta(max, a);
  if (delta) {
    const { formula, ...hp } = out.hp || {};
    out.hp = { ...hp, average: Math.max(1, max + delta) };
    out.hp_current = toInt(out.hp_current, max) + delta;
    out._hp_delta = toInt(out._hp_delta, 0) + delta;
  }
  if (toInt(a.initiative, 0)) out.initiative = { ...(out.initiative || {}), bonus: initiativeOf(out) + toInt(a.initiative, 0) };
  out.speed = mergeHigher(adjustSpeeds(out.speed, a.speed), t.speed);
  out.senses = mergeHigher(out.senses, t.senses);
  out.languages = union(out.languages, t.languages);
  const defenses = { ...(out.defenses || {}) };
  for (const key of DEFENSE_KEYS) {
    const types = union(defenses[key]?.types, t.defenses?.[key]?.types).map(lower);
    if (types.length) defenses[key] = { ...(defenses[key] || {}), types };
  }
  out.defenses = defenses;

  // attacks and save DCs, then the template's own rows on top
  out.features = [...adjustFeatures(out.features, a, t.extra_damage), ...grantedFeatures(t, uses)];
  const spellDc = toInt(a.spell_dc, 0);
  const spellAtk = toInt(a.spell_attack, 0);
  if (spellDc || spellAtk) {
    out.spellcasting = asList(out.spellcasting).map((b) => ({
      ...b,
      dc: isNumber(b.dc) ? b.dc + spellDc : b.dc,
      attack: isNumber(b.attack) ? b.attack + spellAtk : b.attack,
    }));
  }
  const spells = grantedSpells(t, uses);
  if (spells.length) out.spellcasting = [...asList(out.spellcasting), ...spells];
  if (asList(t.items).length) out.items = [...asList(out.items), ...t.items.map((it) => ({ ...it, id: nsId(t, it.id), from_template: t.name }))];

  // Passive Perception follows Perception (or Wisdom).
  out.passive_perception = 10 + (skillBonus(out, "perception") ?? modOf(out, "wis"));
  return out;
}

export function applyToMonster(base, templates) {
  if (!base || !templates.length) return base;
  const uses = base.template_uses || {};
  let m = structuredClone(base);
  for (const t of templates) m = applyOneToMonster(m, t, uses);
  const d = m.defenses || {};
  const settled = settleDamage(asList(d.resist?.types), asList(d.immune?.types), asList(d.vulnerable?.types));
  m.defenses = {
    ...d,
    resist: { ...(d.resist || {}), types: settled.res },
    immune: { ...(d.immune || {}), types: settled.imm },
    vulnerable: { ...(d.vulnerable || {}), types: settled.vul },
  };
  m.applied_templates = templates.map((t) => t.name);
  return m;
}

/* ─── characters (party, NPCs) ───────────────────────────────────── */
// Characters work out their attacks, DCs and spells from their own sheet,
// so a template gives them: name, AC, HP, initiative, ability scores,
// save proficiencies, speeds, senses, languages and defenses — as one
// extra layer per template (from: "template:<id>"), which utils/derive.js
// counts like any other. The layer is only on the card, never saved.
// Its traits and actions are shown next to theirs (templateSections).

const langId = (x) => lower(nameOf(x)).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function templateLayer(c, t) {
  const a = t.adjust || {};
  const mods = [];
  if (toInt(a.ac, 0)) mods.push({ target: "ac", add: toInt(a.ac, 0) });
  if (toInt(a.initiative, 0)) mods.push({ target: "initiative", add: toInt(a.initiative, 0) });
  for (const [k, v] of Object.entries(a.speed || {})) if (toInt(v, 0)) mods.push({ target: `speed.${k}`, add: toInt(v, 0) });
  const delta = hpDelta(derivedOf(c)?.hp_max ?? 0, a);
  if (delta) mods.push({ target: "hp_max", add: delta });
  const ability = {};
  for (const ab of ABILITIES) if (toInt(a.abilities?.[ab], 0)) ability[ab] = toInt(a.abilities[ab], 0);
  const defenses = {};
  for (const key of DEFENSE_KEYS) {
    const types = asList(t.defenses?.[key]?.types).map((x) => lower(nameOf(x)));
    if (types.length) defenses[key] = types;
  }
  const speed = {};
  for (const [k, v] of Object.entries(t.speed || {})) {
    const n = speedNum(v);
    if (n != null) speed[k] = n;
    else if (v === true) speed[k] = true;
  }
  return {
    layer: {
      from: `template:${t.id}`,
      label: t.name,
      grants: { ability, saves: asList(t.saves), speed, senses: { ...(t.senses || {}) }, languages: asList(t.languages).map(langId).filter(Boolean), defenses },
      modifiers: mods,
    },
    delta,
  };
}

export function applyToCharacter(base, templates) {
  if (!base || !templates.length) return base;
  let c = { ...base, layers: [...asList(base.layers)] };
  let delta = 0;
  for (const t of templates) {
    const made = templateLayer(c, t);
    c = { ...c, name: affixed(c.name, t), layers: [...c.layers, made.layer] };
    delta += made.delta;
  }
  // Extra hit points from a template are there now, not only at full health.
  const cur = base.state?.hp_current;
  if (delta && cur != null) c.state = { ...(base.state || {}), hp_current: Math.max(0, cur + delta) };
  c._hp_delta = delta;
  c.applied_templates = templates.map((t) => t.name);
  return c;
}

// The template's traits and actions as statblock entries, for a
// character's card (monsters get them inside their data instead).
export function templateSections(templates, uses = {}) {
  const out = [];
  for (const t of templates) {
    for (const f of grantedFeatures(t, uses)) {
      const key = f.category || "traits";
      const title = MONSTER_SECTIONS.find((s) => s.key === key)?.title || key;
      let section = out.find((s) => s.title === title);
      if (!section) out.push((section = { key, title, entries: [] }));
      section.entries.push(entryFrom(key, f));
    }
  }
  return out;
}

// Add template sections into a character view's own (same titles merge).
export function withTemplateSections(view, templates, uses) {
  const extra = templateSections(templates, uses);
  if (!extra.length) return view;
  const sections = view.sections.map((s) => ({ ...s, entries: [...s.entries] }));
  for (const s of extra) {
    const same = sections.find((x) => x.title === s.title);
    if (same) same.entries.push(...s.entries);
    else sections.push(s);
  }
  return { ...view, sections };
}

/* ─── a template in a few words ──────────────────────────────────── */

// "+2 AC · +10 HP · STR +2 · resists cold · 2 actions" for lists.
export function templateSummary(t) {
  const a = t?.adjust || {};
  const n = (v) => toInt(v, 0);
  const sg = (v) => `${v > 0 ? "+" : "−"}${Math.abs(v)}`;
  const parts = [];
  if (n(a.ac)) parts.push(`${sg(n(a.ac))} AC`);
  if (n(a.hp)) parts.push(`${sg(n(a.hp))} HP`);
  if (n(a.hp_percent)) parts.push(`${sg(n(a.hp_percent))}% HP`);
  for (const ab of ABILITIES) if (n(a.abilities?.[ab])) parts.push(`${ab.toUpperCase()} ${sg(n(a.abilities[ab]))}`);
  if (n(a.to_hit)) parts.push(`${sg(n(a.to_hit))} to hit`);
  if (n(a.damage)) parts.push(`${sg(n(a.damage))} damage`);
  const res = asList(t?.defenses?.resist?.types);
  if (res.length) parts.push(`resists ${res.join(", ")}`);
  const vul = asList(t?.defenses?.vulnerable?.types);
  if (vul.length) parts.push(`vulnerable to ${vul.join(", ")}`);
  const rows = asList(t?.features).length;
  if (rows) parts.push(`${rows} ${rows === 1 ? "trait or action" : "traits & actions"}`);
  if (t?.set?.type) parts.push(`becomes ${t.set.type}`);
  return parts.join(" · ") || "nothing yet";
}

/* ─── one call for either kind ───────────────────────────────────── */

export const isMonsterKind = (kind) => kind === "monster" || kind === "encounter";

export const applyTemplates = (kind, base, templates) => (isMonsterKind(kind) ? applyToMonster(base, templates) : applyToCharacter(base, templates));