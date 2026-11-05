import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import MonsterEffectsBuilder, { effectsToForm, formToEffects, emptyEffects } from "./MonsterEffectsBuilder";
import {
  ABILITY_ORDER, ABILITY,
  crStats, buildAbilityScores, computePassivePerception,
  abilityMod, signed, pruneEmpty,
  CR_OPTIONS, getMonsterType, getMonsterSubtypes, titleCase,
} from "./monsterHelpers";
import {
  DAMAGE_TYPES, CONDITION_OPTIONS, LANGUAGE_OPTIONS, SKILL_OPTIONS,
} from "../../../utils/Constants";

const SPEED_MODES = ["walk", "fly", "swim", "climb", "burrow"];
const SENSE_MODES = ["darkvision", "blindsight", "tremorsense", "truesight"];
const SAVE_WORDS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const SPELL_ABILITIES = ["int", "wis", "cha"];
const ALIGNMENTS = [
  "Lawful Good", "Neutral Good", "Chaotic Good",
  "Lawful Neutral", "Neutral", "Chaotic Neutral",
  "Lawful Evil", "Neutral Evil", "Chaotic Evil",
  "Unaligned", "Any Alignment",
];
const skillKeys = Object.keys(SKILL_OPTIONS);
const cap = (s) => (typeof s === "string" && s ? s[0].toUpperCase() + s.slice(1) : s);

const emptyAbilities = () =>
  ABILITY_ORDER.reduce((acc, a) => { acc[a] = { score: "10", proficient: false }; return acc; }, {});

const makeDefault = () => ({
  name: "",
  visibility: "private",
  size: "",
  type: "",
  alignment: "",
  ac: "",
  hp: "",
  speeds: { walk: "", fly: "", swim: "", climb: "", burrow: "" },
  senses: { darkvision: "", blindsight: "", tremorsense: "", truesight: "" },
  initiativeTotal: "",
  initiativeAdv: false,
  crBase: "",
  languages: [],
  environment: [],
  traitTags: [],
  immune: [],
  resist: [],
  vulnerable: [],
  conditionImmune: [],
  conditionInflict: [],
  forcedSaves: [],
  skills: [],                 // [{ skill, bonus }]
  abilities: emptyAbilities(),
  gear: [],                   // [{ name, source, quantity }]
  legendaryActions: "",
  spellAbility: "",
  spellSaveDc: "",
  spellAttackBonus: "",
  spellNotes: "",
  spellGroups: [],            // [{ label, uses, each, spells:[name] }]
  effects: emptyEffects(),
  // preserved (no dedicated editor)
  _typeTags: [],
});

export default function MonsterCreatePopup({ open, onClose, editingMonster, copyFromMonster }) {
  const createMonster = useCatalogueStore((s) => s.createMonster);
  const updateMonster = useCatalogueStore((s) => s.updateMonster);
  const creating = useCatalogueStore((s) => s.creatingMonster);
  const createError = useCatalogueStore((s) => s.createMonsterError);

  const monstersData = useCatalogueStore((s) => s.monstersData);
  const items = useCatalogueStore((s) => s.items);
  const loadItems = useCatalogueStore((s) => s.loadItems);
  const spellsData = useCatalogueStore((s) => s.spellsData);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);

  const [form, setForm] = useState(makeDefault());
  const [nameError, setNameError] = useState(false);
  const [tagDraft, setTagDraft] = useState("");

  const sizes = monstersData?.sizes || [];
  const typePrefixes = useMemo(
    () => [...(monstersData?.types?.prefix || [])].sort(),
    [monstersData]
  );
  const envs = monstersData?.environments || [];
  const traitsList = monstersData?.traits || [];

  // Lazy-load reference data.
  useEffect(() => {
    if (!open) return;
    if (!Array.isArray(items) || items.length === 0) loadItems();
    const sl = spellsData?.spells;
    if (!Array.isArray(sl) || sl.length === 0) loadSpells();
  }, [open]); // eslint-disable-line

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Repopulate from edit / copy.
  useEffect(() => {
    if (!open) return;
    setNameError(false);
    setTagDraft("");

    const src = editingMonster || copyFromMonster;
    if (!src) { setForm(makeDefault()); return; }

    const abilities = {};
    for (const a of ABILITY_ORDER) {
      const row = src.ability_scores?.[a] || {};
      abilities[a] = {
        score: row.score != null ? String(row.score) : "10",
        proficient: !!row.proficient,
      };
    }
    const speeds = { walk: "", fly: "", swim: "", climb: "", burrow: "" };
    if (src.speed) for (const m of SPEED_MODES) {
      const v = src.speed[m];
      if (typeof v === "number") speeds[m] = String(v);
      else if (v && typeof v === "object" && typeof v.number === "number") speeds[m] = String(v.number);
    }
    const senses = { darkvision: "", blindsight: "", tremorsense: "", truesight: "" };
    if (src.senses) for (const s of SENSE_MODES) {
      if (typeof src.senses[s] === "number") senses[s] = String(src.senses[s]);
    }
    const skills = src.skill && typeof src.skill === "object"
      ? Object.entries(src.skill).map(([skill, bonus]) => ({ skill, bonus: String(bonus).replace("+", "") }))
      : [];
    const traitTags = [...new Set([...(src.traitTags || []), ...(src.actionTags || [])])];
    const sc = Array.isArray(src.spellcasting) ? src.spellcasting[0] : null;
    const spellGroups = sc?.groups
      ? sc.groups.map((g) => ({
          label: g.label || "",
          uses: g.uses == null ? "" : String(g.uses),
          each: !!g.each,
          spells: (g.spells || []).map((s) => s.name).filter(Boolean),
        }))
      : [];

    setForm({
      ...makeDefault(),
      name: copyFromMonster ? `${src.name} (copy)` : (src.name || ""),
      visibility: copyFromMonster ? "private" : (src.visibility || "private"),
      size: src.size?.[0] || "",
      type: getMonsterType(src) || "",
      _typeTags: getMonsterSubtypes(src) || [],
      alignment: (src.alignment || []).join(" "),
      ac: src.ac?.[0]?.value != null ? String(src.ac[0].value) : "",
      hp: src.hp?.average != null ? String(src.hp.average) : "",
      speeds, senses,
      initiativeTotal: src.initiative?.total != null ? String(src.initiative.total) : "",
      initiativeAdv: !!src.initiative?.advantage,
      crBase: src.cr?.base != null ? String(src.cr.base) : "",
      languages: src.languages || [],
      environment: src.environment || [],
      traitTags,
      immune: src.immunities?.types || [],
      resist: src.resistances?.types || [],
      vulnerable: src.vulnerabilities?.types || [],
      conditionImmune: src.condition_immunities?.types || [],
      conditionInflict: src.condition_inflict || [],
      forcedSaves: src.forced_saving_throw || [],
      skills,
      abilities,
      gear: (src.gear || []).map((g) => ({ name: g.name, source: g.source || "XPHB", quantity: g.quantity || 1 })),
      legendaryActions: src.legendary_action_points?.legendary_actions != null
        ? String(src.legendary_action_points.legendary_actions) : "",
      spellAbility: sc?.ability || "",
      spellSaveDc: sc?.save_dc != null ? String(sc.save_dc) : "",
      spellAttackBonus: sc?.spell_attack_bonus != null ? String(sc.spell_attack_bonus) : "",
      spellNotes: sc?.notes || "",
      spellGroups,
      effects: effectsToForm(src.effects),
    });
  }, [open, editingMonster, copyFromMonster]);

  // ── reference option lists ──
  const gearItems = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    return list.filter((it) => it?.source === "XDMG" || it?.source === "XPHB");
  }, [items]);
  const itemNames = useMemo(
    () => [...new Set(gearItems.map((it) => it.name).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [gearItems]
  );
  const itemSourceByName = useMemo(() => {
    const map = {};
    for (const it of gearItems) if (it.name && !map[it.name]) map[it.name] = it.source;
    // prefer XPHB when a name exists in both
    for (const it of gearItems) if (it.source === "XPHB") map[it.name] = "XPHB";
    return map;
  }, [gearItems]);
  const xphbSpellNames = useMemo(() => {
    const list = spellsData?.spells;
    if (!Array.isArray(list)) return [];
    const names = list.filter((sp) => sp?.source === "XPHB" && sp?.name).map((sp) => sp.name);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [spellsData]);

  if (!open) return null;

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const updateNested = (key, sub, val) =>
    setForm((f) => ({ ...f, [key]: { ...f[key], [sub]: val } }));
  const toggleListItem = (key, val) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val],
    }));

  const livePb = (form.crBase && crStats(form.crBase)?.pb) || 2;
  const liveXp = form.crBase ? crStats(form.crBase)?.xp : null;

  // ── traitTags free-text add ──
  const addTag = () => {
    const t = tagDraft.trim();
    if (!t) return;
    setForm((f) => (f.traitTags.includes(t) ? f : { ...f, traitTags: [...f.traitTags, t] }));
    setTagDraft("");
  };

  // ── skill rows ──
  const addSkill = () =>
    setForm((f) => {
      const used = new Set(f.skills.map((r) => r.skill));
      const next = skillKeys.find((k) => !used.has(k)) || skillKeys[0];
      return { ...f, skills: [...f.skills, { skill: next, bonus: "0" }] };
    });
  const updateSkill = (idx, key, val) =>
    setForm((f) => ({ ...f, skills: f.skills.map((r, i) => (i === idx ? { ...r, [key]: val } : r)) }));
  const removeSkill = (idx) =>
    setForm((f) => ({ ...f, skills: f.skills.filter((_, i) => i !== idx) }));

  // ── gear rows ──
  const addGear = () =>
    setForm((f) => ({ ...f, gear: [...f.gear, { name: "", source: "XPHB", quantity: 1 }] }));
  const updateGear = (idx, name) =>
    setForm((f) => ({
      ...f,
      gear: f.gear.map((g, i) => (i === idx ? { ...g, name, source: itemSourceByName[name] || "XPHB" } : g)),
    }));
  const updateGearQty = (idx, qty) =>
    setForm((f) => ({ ...f, gear: f.gear.map((g, i) => (i === idx ? { ...g, quantity: qty } : g)) }));
  const removeGear = (idx) =>
    setForm((f) => ({ ...f, gear: f.gear.filter((_, i) => i !== idx) }));

  // ── spellcasting groups ──
  const addGroup = () =>
    setForm((f) => ({ ...f, spellGroups: [...f.spellGroups, { label: "At will", uses: "", each: false, spells: [] }] }));
  const updateGroup = (idx, key, val) =>
    setForm((f) => ({ ...f, spellGroups: f.spellGroups.map((g, i) => (i === idx ? { ...g, [key]: val } : g)) }));
  const removeGroup = (idx) =>
    setForm((f) => ({ ...f, spellGroups: f.spellGroups.filter((_, i) => i !== idx) }));
  const toggleGroupSpell = (idx, name) =>
    setForm((f) => ({
      ...f,
      spellGroups: f.spellGroups.map((g, i) =>
        i === idx
          ? { ...g, spells: g.spells.includes(name) ? g.spells.filter((x) => x !== name) : [...g.spells, name] }
          : g
      ),
    }));

  const buildPayload = () => {
    const pb = livePb;
    const ability_scores = buildAbilityScores(form.abilities, pb);

    const skill = {};
    for (const row of form.skills) {
      if (!row.skill) continue;
      skill[row.skill] = signed(row.bonus);
    }
    const passive_perception = computePassivePerception(ability_scores, skill);

    const speed = {};
    for (const m of SPEED_MODES) {
      const v = form.speeds[m];
      if (v !== "" && v != null) speed[m] = Number(v);
    }
    const senses = {};
    for (const s of SENSE_MODES) {
      const v = form.senses[s];
      if (v !== "" && v != null) senses[s] = Number(v);
    }

    const cr = form.crBase
      ? { base: form.crBase, xp: crStats(form.crBase)?.xp ?? null, pb }
      : null;
    const ac = form.ac !== "" ? [{ value: Number(form.ac) }] : null;
    const hp = form.hp !== "" ? { average: Number(form.hp) } : null;
    const initiative = form.initiativeTotal !== ""
      ? { total: Number(form.initiativeTotal), advantage: !!form.initiativeAdv } : null;
    const type = form._typeTags?.length ? { type: form.type, tags: form._typeTags } : (form.type || null);

    const gear = form.gear
      .filter((g) => g.name)
      .map((g) => ({ name: g.name, source: g.source || "XPHB", quantity: Number(g.quantity) || 1 }));

    const groups = form.spellGroups
      .map((g) => ({
        label: g.label || "",
        uses: g.uses === "" || g.uses == null ? null : Number(g.uses),
        each: !!g.each,
        spells: g.spells.filter(Boolean).map((n) => ({ name: n.toLowerCase() })),
      }))
      .filter((g) => g.spells.length);
    const spellcasting = groups.length
      ? [{
          name: "Spellcasting",
          ability: form.spellAbility || null,
          save_dc: form.spellSaveDc === "" ? null : Number(form.spellSaveDc),
          spell_attack_bonus: form.spellAttackBonus === "" ? null : Number(form.spellAttackBonus),
          notes: form.spellNotes || null,
          groups,
        }]
      : null;

    const legendary_action_points = form.legendaryActions !== ""
      ? { legendary_actions: Number(form.legendaryActions) } : null;

    const lower = (arr) => arr.map((s) => s.toLowerCase());

    const raw = {
      name: form.name.trim(),
      source: "HOMEBREW",
      visibility: form.visibility,
      size: form.size ? [form.size] : null,
      type,
      alignment: form.alignment ? [form.alignment] : null,
      ac, hp, speed, initiative, senses,
      languages: form.languages,
      cr,
      skill,
      condition_inflict: lower(form.conditionInflict),
      forced_saving_throw: lower(form.forcedSaves),
      immunities: { types: lower(form.immune) },
      resistances: { types: lower(form.resist) },
      vulnerabilities: { types: lower(form.vulnerable) },
      condition_immunities: { types: lower(form.conditionImmune) },
      environment: lower(form.environment),
      traitTags: form.traitTags,
      gear,
      legendary_action_points,
      spellcasting,
      effects: formToEffects(form.effects),
    };

    const pruned = pruneEmpty(raw) || {};
    // guarantee identity + always-present derived blocks survive pruning
    pruned.name = form.name.trim();
    pruned.source = "HOMEBREW";
    pruned.visibility = form.visibility;
    pruned.ability_scores = ability_scores;
    pruned.passive_perception = passive_perception;
    return pruned;
  };

  const isEditing = !!editingMonster;
  const titleText = isEditing ? "Edit Monster" : copyFromMonster ? "Copy Monster" : "Create Monster";

  const handleSubmit = async () => {
    if (!form.name.trim()) { setNameError(true); return; }
    setNameError(false);
    try {
      const payload = buildPayload();
      if (isEditing) await updateMonster(editingMonster.id, payload);
      else await createMonster(payload);
      setTimeout(onClose, 0);
    } catch {
      // createMonsterError already set
    }
  };

  const chip = (active) =>
    `text-[11px] px-2 py-1 rounded border transition
     ${active
       ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
       : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-300"}`;
  const fieldCls =
    "bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-100 text-sm w-full " +
    "focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30";

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col
                   bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
          <h2 className="text-amber-400 font-semibold uppercase tracking-wider text-sm">{titleText}</h2>
          <button onClick={onClose} className="px-2 text-slate-400 hover:text-slate-100 text-lg">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {/* ── Basics ── */}
          <FilterSection title="Basics" defaultOpen>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text" value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Boneweald Hierophant"
                  className={`${fieldCls} ${nameError ? "border-red-500 ring-1 ring-red-500/40" : ""}`}
                />
                {nameError && <p className="text-xs text-red-400 mt-1">Name is required.</p>}
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">Visibility</div>
                <div className="flex gap-2">
                  {["private", "public"].map((v) => (
                    <button key={v} type="button" onClick={() => update("visibility", v)} className={chip(form.visibility === v)}>
                      {cap(v)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Size</label>
                  <select value={form.size} onChange={(e) => update("size", e.target.value)} className={fieldCls}>
                    <option value="">—</option>
                    {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => update("type", e.target.value)} className={fieldCls}>
                    <option value="">—</option>
                    {typePrefixes.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Alignment</label>
                  <select value={form.alignment} onChange={(e) => update("alignment", e.target.value)} className={fieldCls}>
                    <option value="">—</option>
                    {ALIGNMENTS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Challenge</label>
                  <select value={form.crBase} onChange={(e) => update("crBase", e.target.value)} className={fieldCls}>
                    <option value="">—</option>
                    {CR_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="text-[11px] text-slate-400 col-span-2">
                  {form.crBase
                    ? <>Auto: <span className="text-amber-300">{liveXp?.toLocaleString()} XP</span>, <span className="text-amber-300">PB +{livePb}</span></>
                    : <span className="text-slate-500">XP & PB auto-fill from CR.</span>}
                </div>
              </div>
            </div>
          </FilterSection>

          {/* ── Vitals ── */}
          <FilterSection title="Vitals">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">AC</label>
                  <input type="number" value={form.ac} onChange={(e) => update("ac", e.target.value)} className={fieldCls} placeholder="—" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">HP (avg)</label>
                  <input type="number" value={form.hp} onChange={(e) => update("hp", e.target.value)} className={fieldCls} placeholder="—" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Initiative</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={form.initiativeTotal} onChange={(e) => update("initiativeTotal", e.target.value)} className={fieldCls} placeholder="±" />
                    <label className="flex items-center gap-1 text-[11px] text-slate-300 whitespace-nowrap">
                      <input type="checkbox" checked={form.initiativeAdv} onChange={(e) => update("initiativeAdv", e.target.checked)} />
                      adv
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">Speeds (ft.)</div>
                <div className="grid grid-cols-5 gap-2">
                  {SPEED_MODES.map((m) => (
                    <div key={m}>
                      <div className="text-[10px] text-slate-400 mb-0.5 capitalize">{m}</div>
                      <input type="number" value={form.speeds[m]} onChange={(e) => updateNested("speeds", m, e.target.value)} className={fieldCls} placeholder="—" />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">Senses (ft.)</div>
                <div className="grid grid-cols-4 gap-2">
                  {SENSE_MODES.map((s) => (
                    <div key={s}>
                      <div className="text-[10px] text-slate-400 mb-0.5 capitalize">{s}</div>
                      <input type="number" value={form.senses[s]} onChange={(e) => updateNested("senses", s, e.target.value)} className={fieldCls} placeholder="—" />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Passive Perception is auto-calculated.</p>
              </div>
            </div>
          </FilterSection>

          {/* ── Ability Scores ── */}
          <FilterSection title="Ability Scores">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ABILITY_ORDER.map((a) => {
                const row = form.abilities[a];
                const mod = abilityMod(row.score);
                const save = mod + (row.proficient ? livePb : 0);
                return (
                  <div key={a} className="border border-slate-700 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-amber-400">{ABILITY[a]}</span>
                      <span className="text-[10px] text-slate-400">mod {signed(mod)} · save {signed(save)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" value={row.score}
                        onChange={(e) => setForm((f) => ({ ...f, abilities: { ...f.abilities, [a]: { ...f.abilities[a], score: e.target.value } } }))}
                        className={fieldCls}
                      />
                      <label className="flex items-center gap-1 text-[11px] text-slate-300 whitespace-nowrap">
                        <input
                          type="checkbox" checked={row.proficient}
                          onChange={(e) => setForm((f) => ({ ...f, abilities: { ...f.abilities, [a]: { ...f.abilities[a], proficient: e.target.checked } } }))}
                        />
                        prof
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </FilterSection>

          {/* ── Skills ── */}
          <FilterSection title="Skills">
            <div className="space-y-2">
              {form.skills.map((row, idx) => {
                const used = new Set(form.skills.filter((_, i) => i !== idx).map((r) => r.skill));
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <select value={row.skill} onChange={(e) => updateSkill(idx, "skill", e.target.value)} className={`${fieldCls} flex-1`}>
                      {skillKeys.map((k) => (
                        <option key={k} value={k} disabled={used.has(k)}>{titleCase(k)}</option>
                      ))}
                    </select>
                    <input type="number" value={row.bonus} onChange={(e) => updateSkill(idx, "bonus", e.target.value)} className={`${fieldCls} max-w-[80px]`} placeholder="±" />
                    <button onClick={() => removeSkill(idx)} className="text-[11px] px-2 py-1 rounded border border-red-700/50 text-red-300 hover:bg-red-900/40">✕</button>
                  </div>
                );
              })}
              <button onClick={addSkill} className="text-[11px] px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:border-amber-500/40 hover:text-amber-300">
                + Add Skill
              </button>
            </div>
          </FilterSection>

          {/* ── Defenses ── */}
          <FilterSection title="Defenses">
            <div className="space-y-2">
              <CollapsibleChips label="Damage Immunities" options={DAMAGE_TYPES} selected={form.immune} onToggle={(v) => toggleListItem("immune", v)} />
              <CollapsibleChips label="Damage Resistances" options={DAMAGE_TYPES} selected={form.resist} onToggle={(v) => toggleListItem("resist", v)} />
              <CollapsibleChips label="Damage Vulnerabilities" options={DAMAGE_TYPES} selected={form.vulnerable} onToggle={(v) => toggleListItem("vulnerable", v)} />
              <CollapsibleChips label="Condition Immunities" options={CONDITION_OPTIONS} selected={form.conditionImmune} onToggle={(v) => toggleListItem("conditionImmune", v)} />
            </div>
          </FilterSection>

          {/* ── Tags ── */}
          <FilterSection title="Tags">
            <div className="space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">
                  Trait & Action Tags {form.traitTags.length > 0 && <span className="normal-case">({form.traitTags.length})</span>}
                </div>
                {form.traitTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {form.traitTags.map((t) => (
                      <button key={t} type="button" onClick={() => toggleListItem("traitTags", t)} className={chip(true)}>{t} ✕</button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text" value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder="Add custom tag…" className={fieldCls}
                  />
                  <button onClick={addTag} className="text-[11px] px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:border-amber-500/40 hover:text-amber-300 whitespace-nowrap">
                    + Add
                  </button>
                </div>
                {traitsList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    {traitsList.map((t) => (
                      <button key={t} type="button" onClick={() => toggleListItem("traitTags", t)} className={chip(form.traitTags.includes(t))}>{t}</button>
                    ))}
                  </div>
                )}
              </div>

              <CollapsibleChips label="Conditions Inflicted" options={CONDITION_OPTIONS} selected={form.conditionInflict} onToggle={(v) => toggleListItem("conditionInflict", v)} />
              <CollapsibleChips label="Forced Saving Throws" options={SAVE_WORDS} selected={form.forcedSaves} onToggle={(v) => toggleListItem("forcedSaves", v)} />
            </div>
          </FilterSection>

          {/* ── Languages & Environment ── */}
          <FilterSection title="Languages & Environment">
            <div className="space-y-2">
              <CollapsibleChips label="Languages" options={LANGUAGE_OPTIONS} selected={form.languages} onToggle={(v) => toggleListItem("languages", v)} keepCase />
              <CollapsibleChips label="Environment" options={envs} selected={form.environment} onToggle={(v) => toggleListItem("environment", v)} />
            </div>
          </FilterSection>

          {/* ── Gear ── */}
          <FilterSection title="Gear">
            <div className="space-y-2">
              {form.gear.map((g, idx) => (
                <div key={idx} className="border border-slate-700 rounded p-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase tracking-wider text-amber-400">
                      {g.name ? `${g.name} (${g.source})` : `Item ${idx + 1}`}
                    </span>
                    <button onClick={() => removeGear(idx)} className="text-[11px] px-2 py-1 rounded border border-red-700/50 text-red-300 hover:bg-red-900/40">✕</button>
                  </div>
                  <NamePicker options={itemNames} value={g.name} placeholder="Search items…" onSelect={(n) => updateGear(idx, n)} />
                  <div className="max-w-[120px]">
                    <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Quantity</div>
                    <input type="number" min={1} value={g.quantity} onChange={(e) => updateGearQty(idx, e.target.value)} className={fieldCls} />
                  </div>
                </div>
              ))}
              <button onClick={addGear} className="text-[11px] px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:border-amber-500/40 hover:text-amber-300">
                + Add Gear
              </button>
            </div>
          </FilterSection>

          {/* ── Legendary ── */}
          <FilterSection title="Legendary Actions">
            <div className="max-w-[160px]">
              <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Action Points</label>
              <input type="number" min={0} value={form.legendaryActions} onChange={(e) => update("legendaryActions", e.target.value)} className={fieldCls} placeholder="—" />
              <p className="text-[10px] text-slate-500 mt-1">Leave blank if not legendary.</p>
            </div>
          </FilterSection>

          {/* ── Spellcasting ── */}
          <FilterSection title="Spellcasting">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Ability</label>
                  <select value={form.spellAbility} onChange={(e) => update("spellAbility", e.target.value)} className={fieldCls}>
                    <option value="">—</option>
                    {SPELL_ABILITIES.map((a) => <option key={a} value={a}>{ABILITY[a]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Save DC</label>
                  <input type="number" value={form.spellSaveDc} onChange={(e) => update("spellSaveDc", e.target.value)} className={fieldCls} placeholder="—" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Atk Bonus</label>
                  <input type="number" value={form.spellAttackBonus} onChange={(e) => update("spellAttackBonus", e.target.value)} className={fieldCls} placeholder="±" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Notes</label>
                <textarea value={form.spellNotes} onChange={(e) => update("spellNotes", e.target.value)} rows={2} className={fieldCls}
                  placeholder="The creature casts one of the following spells…" />
              </div>

              <div className="space-y-2">
                {form.spellGroups.map((g, idx) => (
                  <div key={idx} className="border border-slate-700 rounded p-2 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase tracking-wider text-amber-400">Group {idx + 1}</span>
                      <button onClick={() => removeGroup(idx)} className="text-[11px] px-2 py-1 rounded border border-red-700/50 text-red-300 hover:bg-red-900/40">✕</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 items-end">
                      <div className="col-span-1">
                        <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Label</div>
                        <input type="text" value={g.label} onChange={(e) => updateGroup(idx, "label", e.target.value)} className={fieldCls} placeholder="At will" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Uses</div>
                        <input type="number" value={g.uses} onChange={(e) => updateGroup(idx, "uses", e.target.value)} className={fieldCls} placeholder="∞" />
                      </div>
                      <label className="flex items-center gap-1 text-[11px] text-slate-300 pb-1">
                        <input type="checkbox" checked={g.each} onChange={(e) => updateGroup(idx, "each", e.target.checked)} />
                        each
                      </label>
                    </div>
                    {g.spells.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {g.spells.map((n) => (
                          <button key={n} type="button" onClick={() => toggleGroupSpell(idx, n)} className={chip(true)}>{titleCase(n)} ✕</button>
                        ))}
                      </div>
                    )}
                    <NamePicker options={xphbSpellNames} value="" placeholder="Add spell…" onSelect={(n) => toggleGroupSpell(idx, n)} />
                  </div>
                ))}
                <button onClick={addGroup} className="text-[11px] px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:border-amber-500/40 hover:text-amber-300">
                  + Add Spell Group
                </button>
              </div>
            </div>
        </FilterSection>

          {/* ── Actions, Traits & Other Effects ── */}
          <MonsterEffectsBuilder
            value={form.effects}
            onChange={(next) => update("effects", next)}
          />
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-700">
          {createError ? <span className="text-xs text-red-400 truncate flex-1">{createError}</span> : <span className="flex-1" />}
          <button onClick={onClose} className="text-[11px] px-3 py-1.5 rounded border border-slate-600 text-slate-400 hover:border-red-500/40 hover:text-red-300">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={creating}
                  className="text-[11px] px-3 py-1.5 rounded border border-amber-500/50 bg-amber-500/20 text-amber-300
                             hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed">
            {creating ? "Saving…" : isEditing ? "Save Changes" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Collapsible chip multi-select ─── */
function CollapsibleChips({ label, options, selected, onToggle, keepCase }) {
  const [open, setOpen] = useState(false);
  const display = keepCase ? ((x) => x) : ((x) => (typeof x === "string" ? x[0].toUpperCase() + x.slice(1) : x));
  const chip = (active) =>
    `text-[11px] px-2 py-1 rounded border transition
     ${active
       ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
       : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-300"}`;
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1.5 uppercase tracking-wider text-amber-400 text-[10px] mb-1 hover:text-amber-300 transition select-none">
        <span className={`text-[10px] inline-block transition-transform duration-150 ${open ? "rotate-90" : ""}`}>▶</span>
        <span>{label}</span>
        {selected.length > 0 && <span className="ml-1 text-amber-300 normal-case">({selected.length})</span>}
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 pl-3 mb-2 max-h-40 overflow-y-auto pr-1">
          {(options || []).map((opt) => (
            <button key={opt} type="button" onClick={() => onToggle(opt)} className={chip(selected.includes(opt))}>
              {display(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Generic searchable single-select ─── */
function NamePicker({ options, value, onSelect, placeholder }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (options || []).filter((n) => n.toLowerCase().includes(q)).slice(0, 60);
  }, [query, options]);
  const chip = (active) =>
    `text-[11px] px-2 py-1 rounded border transition
     ${active
       ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
       : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-300"}`;
  return (
    <div>
      <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
             placeholder={(options || []).length ? placeholder : "Loading…"}
             className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-100 text-sm w-full mb-2
                        focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30" />
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
        {filtered.map((name) => (
          <button key={name} type="button" onClick={() => { onSelect(name); setQuery(""); }} className={chip(value === name)}>
            {name}
          </button>
        ))}
        {query && filtered.length === 0 && <span className="text-[11px] text-slate-500">No matches.</span>}
      </div>
    </div>
  );
}