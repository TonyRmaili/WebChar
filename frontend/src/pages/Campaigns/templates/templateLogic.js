import { ABILITY_ORDER, EFFECT_SECTIONS, abilityMod, crStats } from "../../Catalogues/Monsters/monsterHelpers";
import { SKILL_OPTIONS } from "../../../utils/Constants";
import { effectiveMaxHp, healthOf } from "../../Characters/sheet/play/playHelpers";
import { SKILL_KEY, entryFrom, initiativeOf, pbOf, skillBonus, speedNum, squash, withPassive } from "../statblock/monsterStatblock";

/* ═══════════════════════════════════════════════════════════════════
   templateLogic.js — laying templates on a creature (layered, live).

   A creature keeps its own statblock plus a list of templates:
       templates: [{ id, on }]          on: false = switched off for now
   The statblock you see is worked out every time from the creature and
   the *current* version of each template (a live link), in the order
   they were added. Nothing of the template is written into the
   creature, so a template can be switched off or removed at any time.

   What a template does (shape: claude/templates-contract.md):
     adjust   numbers up or down: AC, HP (flat and %), initiative, ability
              scores, speeds, skills, to-hit, damage, save DCs, spell DC
              and attack
     grant    save proficiencies, defenses, senses (higher wins), speeds
              (higher wins), languages, extra damage on attacks, traits /
              actions / …, spellcasting, gear
     set      name prefix / suffix, type, size, alignment, challenge
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

const DEFENSES = ["resistances", "immunities", "vulnerabilities", "condition_immunities"];

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

/* ─── monsters ───────────────────────────────────────────────────── */

function adjustAttacks(m, a, extra) {
  const toHit = toInt(a.to_hit, 0);
  const dmg = toInt(a.damage, 0);
  const dc = toInt(a.save_dc, 0);
  const addDice = extra && toInt(extra.dice_count, 0) > 0 && extra.dice_size ? extra : null;
  if (!toHit && !dmg && !dc && !addDice) return m;
  const effects = {};
  for (const [key, block] of Object.entries(m.effects || {})) {
    effects[key] = {
      ...block,
      items: asList(block?.items).map((it) => {
        let row = it;
        if (row.attack && (toHit || dmg || addDice)) {
          const damages = asList(row.attack.damages).map((d, i) => (i === 0 && dmg ? { ...d, mod: toInt(d.mod, 0) + dmg } : d));
          if (addDice) damages.push({ dice_count: toInt(addDice.dice_count, 1), dice_size: addDice.dice_size, mod: 0, damage_type: addDice.damage_type || null });
          row = { ...row, attack: { ...row.attack, hit_bonus: toInt(row.attack.hit_bonus, 0) + toHit, damages } };
        }
        if (row.save && dc) row = { ...row, save: { ...row.save, dc_bonus: toInt(row.save.dc_bonus, 0) + dc } };
        return row;
      }),
    };
  }
  return { ...m, effects };
}

// The template's own rows, ready to sit next to the creature's.
function grantedRows(t, uses) {
  const effects = {};
  for (const { key } of EFFECT_SECTIONS) {
    const items = asList(t.effects?.[key]?.items).filter((it) => it && it.active !== false);
    if (!items.length) continue;
    effects[key] = items.map((it) => {
      const id = nsId(t, it.id);
      const row = { ...it, id, from_template: t.name || "template", active: true };
      if (it.charges) {
        const max = toInt(it.charges.max_charges ?? it.charges.per_rest_count, 0);
        row.charges = { ...it.charges, current_charges: toInt(uses[id], max) };
      }
      return row;
    });
  }
  return effects;
}

function grantedSpells(t, uses) {
  return asList(t.spellcasting).map((b) => ({
    ...b,
    id: nsId(t, b.id),
    from_template: t.name,
    name: `${b.name || "Spellcasting"} (${t.name})`,
    groups: asList(b.groups).map((g) => {
      const gid = nsId(t, g.id);
      return {
        ...g,
        id: gid,
        from_template: t.name,
        current: uses[gid],
        spells: asList(g.spells).map((s) => ({ ...s, id: nsId(t, s.id), from_template: t.name, current: uses[nsId(t, s.id)] })),
      };
    }),
  }));
}

function applyOneToMonster(m, t, uses) {
  const a = t.adjust || {};
  let out = { ...m, name: affixed(m.name, t) };

  // set
  const set = t.set || {};
  if (set.type) out.type = typeof out.type === "object" && out.type ? { ...out.type, type: set.type } : set.type;
  if (set.size) out.size = [set.size];
  if (set.alignment) out.alignment = [set.alignment];
  const oldPb = pbOf(out);
  if (set.cr) {
    const stats = crStats(set.cr);
    out.cr = { base: set.cr, xp: stats?.xp ?? null, pb: stats?.pb ?? oldPb };
  }
  const pbDelta = pbOf(out) - oldPb;

  // ability scores (and the saves that hang on them), save proficiencies
  const scores = { ...(out.ability_scores || {}) };
  let touched = false;
  for (const ab of ABILITY_ORDER) {
    const row = { ...(scores[ab] || { score: 10 }) };
    const d = toInt(a.abilities?.[ab], 0);
    const hadSave = Number.isFinite(Number(row.save));
    if (d) {
      const before = abilityMod(row.score);
      row.score = toInt(row.score, 10) + d;
      row.mod = abilityMod(row.score);
      if (hadSave) row.save = Number(row.save) + row.mod - before;
      touched = true;
    }
    if (row.proficient && pbDelta && Number.isFinite(Number(row.save))) row.save = Number(row.save) + pbDelta;
    if (asList(t.saves).includes(ab) && !row.proficient) {
      row.save = (Number.isFinite(Number(row.save)) ? Number(row.save) : abilityMod(row.score)) + pbOf(out);
      row.proficient = true;
      touched = true;
    }
    scores[ab] = row;
  }
  out.ability_scores = scores;

  // skills: listed ones move; unlisted ones start from the ability modifier
  const skill = { ...(out.skill || {}) };
  for (const [key, d] of Object.entries(a.skills || {})) {
    if (!toInt(d, 0)) continue;
    const have = Object.keys(skill).find((k) => squash(k) === squash(key));
    const ability = SKILL_OPTIONS[SKILL_KEY[squash(key)]]?.ability;
    const start = skillBonus(out, key) ?? abilityMod(scores[ability]?.score ?? 10);
    skill[have || key] = signed(start + toInt(d, 0));
    touched = true;
  }
  out.skill = skill;

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
  if (toInt(a.initiative, 0)) out.initiative = { ...(out.initiative || {}), total: initiativeOf(out) + toInt(a.initiative, 0) };
  out.speed = mergeHigher(adjustSpeeds(out.speed, a.speed), t.speed);
  out.senses = mergeHigher(out.senses, t.senses);
  out.languages = union(out.languages, t.languages);
  for (const key of DEFENSES) out[key] = { ...(out[key] || {}), types: union(out[key]?.types, t[key]?.types).map(lower) };

  // attacks and save DCs, then the template's own rows on top
  out = adjustAttacks(out, a, t.extra_damage);
  const spellDc = toInt(a.spell_dc, 0);
  const spellAtk = toInt(a.spell_attack, 0);
  if (spellDc || spellAtk) {
    out.spellcasting = asList(out.spellcasting).map((b) => ({
      ...b,
      save_dc: b.save_dc != null ? toInt(b.save_dc, 0) + spellDc : b.save_dc,
      spell_attack_bonus: b.spell_attack_bonus != null ? toInt(b.spell_attack_bonus, 0) + spellAtk : b.spell_attack_bonus,
    }));
  }
  const rows = grantedRows(t, uses);
  if (Object.keys(rows).length) {
    const effects = { ...(out.effects || {}) };
    for (const [key, items] of Object.entries(rows)) effects[key] = { ...(effects[key] || {}), items: [...asList(effects[key]?.items), ...items] };
    out.effects = effects;
  }
  const spells = grantedSpells(t, uses);
  if (spells.length) out.spellcasting = [...asList(out.spellcasting), ...spells];
  if (asList(t.gear).length) out.gear = [...asList(out.gear), ...asList(t.gear).map((g) => ({ ...g, id: nsId(t, g.id), from_template: t.name }))];

  return touched ? withPassive(out) : out;
}

export function applyToMonster(base, templates) {
  if (!base || !templates.length) return base;
  const uses = base.template_uses || {};
  let m = structuredClone(base);
  for (const t of templates) m = applyOneToMonster(m, t, uses);
  const settled = settleDamage(asList(m.resistances?.types), asList(m.immunities?.types), asList(m.vulnerabilities?.types));
  m.resistances = { ...(m.resistances || {}), types: settled.res };
  m.immunities = { ...(m.immunities || {}), types: settled.imm };
  m.vulnerabilities = { ...(m.vulnerabilities || {}), types: settled.vul };
  m.applied_templates = templates.map((t) => t.name);
  return m;
}

/* ─── characters (party, NPCs) ───────────────────────────────────── */
// Characters work out their attacks, DCs and spells from their own sheet,
// so a template gives them: name, AC, HP, initiative, ability scores,
// save proficiencies, speeds, senses, languages and defenses. Its traits
// and actions are shown next to theirs (templateSections).

function applyOneToCharacter(c, t) {
  const a = t.adjust || {};
  const out = { ...c, name: affixed(c.name, t) };
  if (toInt(a.ac, 0)) out.ac = toInt(out.ac, 10) + toInt(a.ac, 0);
  const health = healthOf(out);
  const delta = hpDelta(effectiveMaxHp(health), a);
  if (delta) {
    out.health = { ...health, max_hp_mod: toInt(health.max_hp_mod, 0) + delta, current_hp: toInt(health.current_hp, 0) + delta };
    out._hp_delta = toInt(out._hp_delta, 0) + delta;
  }
  if (toInt(a.initiative, 0)) out.initiative = { ...(out.initiative || {}), mod: toInt(out.initiative?.mod, 0) + toInt(a.initiative, 0) };
  const scores = { ...(out.ability_scores || {}) };
  for (const ab of ABILITY_ORDER) {
    const d = toInt(a.abilities?.[ab], 0);
    const grant = asList(t.saves).includes(ab);
    if (!d && !grant) continue;
    const row = { ...(scores[ab] || {}) };
    if (d && row.score != null) {
      row.score = toInt(row.score, 10) + d;
      row.mod = abilityMod(row.score);
    }
    if (grant) row.proficient = true;
    scores[ab] = row;
  }
  out.ability_scores = scores;
  out.speed = mergeHigher(adjustSpeeds(out.speed, a.speed), t.speed);
  out.senses = mergeHigher(out.senses, t.senses);
  out.language_proficiencies = union(out.language_proficiencies, t.languages);
  const def = { ...(out.defenses || {}) };
  for (const key of DEFENSES) def[key] = union(def[key], t[key]?.types);
  out.defenses = def;
  return out;
}

export function applyToCharacter(base, templates) {
  if (!base || !templates.length) return base;
  let c = structuredClone(base);
  for (const t of templates) c = applyOneToCharacter(c, t);
  const d = c.defenses || {};
  const settled = settleDamage(asList(d.resistances).map(nameOf), asList(d.immunities).map(nameOf), asList(d.vulnerabilities).map(nameOf));
  c.defenses = { ...d, resistances: settled.res, immunities: settled.imm, vulnerabilities: settled.vul };
  c.applied_templates = templates.map((t) => t.name);
  return c;
}

// The template's traits and actions as statblock entries, for a
// character's card (monsters get them inside their data instead).
export function templateSections(templates, uses = {}) {
  const out = [];
  for (const t of templates) {
    for (const [key, items] of Object.entries(grantedRows(t, uses))) {
      const title = EFFECT_SECTIONS.find((s) => s.key === key)?.title || key;
      let section = out.find((s) => s.title === title);
      if (!section) out.push((section = { key, title, entries: [] }));
      section.entries.push(...items.map((it) => entryFrom(key, it)));
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
  for (const ab of ABILITY_ORDER) if (n(a.abilities?.[ab])) parts.push(`${ab.toUpperCase()} ${sg(n(a.abilities[ab]))}`);
  if (n(a.to_hit)) parts.push(`${sg(n(a.to_hit))} to hit`);
  if (n(a.damage)) parts.push(`${sg(n(a.damage))} damage`);
  const res = asList(t?.resistances?.types);
  if (res.length) parts.push(`resists ${res.join(", ")}`);
  const vul = asList(t?.vulnerabilities?.types);
  if (vul.length) parts.push(`vulnerable to ${vul.join(", ")}`);
  const rows = EFFECT_SECTIONS.reduce((sum, s) => sum + asList(t?.effects?.[s.key]?.items).length, 0);
  if (rows) parts.push(`${rows} ${rows === 1 ? "trait or action" : "traits & actions"}`);
  if (t?.set?.type) parts.push(`becomes ${t.set.type}`);
  return parts.join(" · ") || "nothing yet";
}

/* ─── one call for either kind ───────────────────────────────────── */

export const isMonsterKind = (kind) => kind === "monster" || kind === "encounter";

export const applyTemplates = (kind, base, templates) => (isMonsterKind(kind) ? applyToMonster(base, templates) : applyToCharacter(base, templates));