import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import {
  formatFeatureType, FEATURE_TYPES, RESOURCE_OPTIONS,
} from "./optionalFeatureHelpers";
import {
  DAMAGE_TYPES, CONDITION_OPTIONS, SKILL_OPTIONS,
} from "../../../utils/Constants";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const skillKeys = Object.keys(SKILL_OPTIONS);
const SENSES = ["darkvision", "tremorsense", "blindsight", "truesight"];
const SPEED_KEYS = ["walk", "fly", "swim", "climb", "burrow"];
const BONUS_KEYS = [
  ["spell_attack", "Spell Atk"], ["spell_save_dc", "Spell Save DC"], ["spell_damage", "Spell Dmg"],
  ["weapon_attack", "Weapon Atk"], ["weapon_damage", "Weapon Dmg"],
  ["ranged_attack", "Ranged Atk"], ["ranged_damage", "Ranged Dmg"],
  ["melee_attack", "Melee Atk"], ["melee_damage", "Melee Dmg"],
  ["max_hp", "Max HP"], ["ac", "AC"], ["initiative", "Initiative"],
  ["proficiency", "Proficiency"], ["saving_throws", "Saving Throws"], ["ability_checks", "Ability Checks"],
];

const cap = (s) => (typeof s === "string" && s ? s[0].toUpperCase() + s.slice(1) : s);
const numOrNull = (v) => { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const clampStep5 = (v) => { const n = numOrNull(v); if (n == null) return ""; return String(Math.max(0, Math.round(n / 5) * 5)); };

const fromObj = (obj, keys) => {
  const out = {}; for (const k of keys) out[k] = obj?.[k] != null ? String(obj[k]) : "";
  return out;
};
const emptyMap = (keys) => keys.reduce((o, k) => ((o[k] = ""), o), {});

const DEFAULT_STATE = {
  name: "", visibility: "private",
  feature_type: FEATURE_TYPES[0],
  consumes: "",
  entries: "",

  skill_proficiencies: [],
  immune: [], resist: [], vulnerable: [], conditionImmune: [],

  asi: emptyMap(ABILITIES),
  speeds: emptyMap(SPEED_KEYS), hover: false,
  senses: emptyMap(SENSES),
  bonuses: BONUS_KEYS.reduce((o, [k]) => ((o[k] = ""), o), {}),

  feat_progression: [],          // [feat names]
  opt_feature_progression: [],   // [optional feature names]

  spell_ability_fixed: "",
  resource_name: "",
  at_will: [],                   // [spell names]
  daily: [],                     // [{uses, spells: []}]
  granted: [],                   // [{count, from: []}]
};

export default function OptionalFeatureCreatePopup({ open, onClose, editingFeature, copyFromFeature }) {
  const createOptionalFeature = useCatalogueStore((s) => s.createOptionalFeature);
  const updateOptionalFeature = useCatalogueStore((s) => s.updateOptionalFeature);
  const creating = useCatalogueStore((s) => s.creatingOptionalFeature);
  const createError = useCatalogueStore((s) => s.createOptionalFeatureError);

  const featsData = useCatalogueStore((s) => s.featsData);
  const loadFeats = useCatalogueStore((s) => s.loadFeats);
  const spellsData = useCatalogueStore((s) => s.spellsData);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);
  const optionalFeaturesData = useCatalogueStore((s) => s.optionalFeaturesData);

  const [form, setForm] = useState(DEFAULT_STATE);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!Array.isArray(featsData?.feats) || featsData.feats.length === 0) loadFeats();
    if (!Array.isArray(spellsData?.spells) || spellsData.spells.length === 0) loadSpells();
  }, [open]); // eslint-disable-line

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setNameError(false);
    const src = editingFeature || copyFromFeature;
    if (!src) { setForm(DEFAULT_STATE); return; }

    const sp = src.additional_spells || {};
    const daily = Array.isArray(sp.daily)
      ? sp.daily.map((d) => ({ uses: d.uses != null ? String(d.uses) : "1", spells: d.spells || [] }))
      : [];
    const granted = Array.isArray(sp.granted)
      ? sp.granted
          .filter((g) => Array.isArray(g.from) && g.from.length)  // skip filter-only entries
          .map((g) => ({ count: g.count != null ? String(g.count) : "1", from: g.from || [] }))
      : [];

    setForm({
      ...DEFAULT_STATE,
      name: copyFromFeature ? `${src.name} (copy)` : src.name || "",
      visibility: copyFromFeature ? "private" : (src.visibility || "private"),
      feature_type: src.feature_type || FEATURE_TYPES[0],
      consumes: src.consumes || "",
      entries: src.entries || "",

      skill_proficiencies: src.skill_proficiencies || [],
      immune: src.immune || [],
      resist: src.resist || [],
      vulnerable: src.vulnerable || [],
      conditionImmune: src.conditionImmune || [],

      asi: fromObj(src.ability_score_increase, ABILITIES),
      speeds: fromObj(src.speeds, SPEED_KEYS),
      hover: !!src.hover,
      senses: fromObj(src.senses, SENSES),
      bonuses: fromObj(src.bonuses, BONUS_KEYS.map(([k]) => k)),

      feat_progression: Array.isArray(src.featProgression)
        ? src.featProgression.map((p) => p.name).filter(Boolean)
        : [],
      opt_feature_progression: Array.isArray(src.optionalfeatureProgression)
        ? src.optionalfeatureProgression.map((p) => p.name).filter(Boolean)
        : [],

      spell_ability_fixed: sp.ability?.fixed || "",
      resource_name: sp.resource_name || "",
      at_will: sp.at_will || [],
      daily,
      granted,
    });
  }, [open, editingFeature, copyFromFeature]);

  const xphbSpellNames = useMemo(() => {
    const list = spellsData?.spells;
    if (!Array.isArray(list)) return [];
    return [...new Set(list.filter((s) => s?.source === "XPHB" && s?.name).map((s) => s.name))]
      .sort((a, b) => a.localeCompare(b));
  }, [spellsData]);

  const featNames = useMemo(() => {
    const names = (featsData?.feats || []).map((f) => f?.name).filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [featsData]);

  const optFeatureNames = useMemo(() => {
    const names = (optionalFeaturesData?.features || [])
      .map((f) => f?.name).filter((n) => n && n !== editingFeature?.name);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [optionalFeaturesData, editingFeature]);

  if (!open) return null;

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const updateMap = (mapKey, k, v) =>
    setForm((f) => ({ ...f, [mapKey]: { ...f[mapKey], [k]: v } }));
  const toggleListItem = (key, val) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val] }));

  // daily rows
  const addDaily = () => setForm((f) => ({ ...f, daily: [...f.daily, { uses: "1", spells: [] }] }));
  const updateDaily = (idx, key, val) =>
    setForm((f) => ({ ...f, daily: f.daily.map((r, i) => (i === idx ? { ...r, [key]: val } : r)) }));
  const toggleDailySpell = (idx, name) =>
    setForm((f) => ({
      ...f, daily: f.daily.map((r, i) => i === idx
        ? { ...r, spells: r.spells.includes(name) ? r.spells.filter((x) => x !== name) : [...r.spells, name] }
        : r),
    }));
  const removeDaily = (idx) => setForm((f) => ({ ...f, daily: f.daily.filter((_, i) => i !== idx) }));

  // granted rows
  const addGranted = () => setForm((f) => ({ ...f, granted: [...f.granted, { count: "1", from: [] }] }));
  const updateGranted = (idx, key, val) =>
    setForm((f) => ({ ...f, granted: f.granted.map((r, i) => (i === idx ? { ...r, [key]: val } : r)) }));
  const toggleGrantedSpell = (idx, name) =>
    setForm((f) => ({
      ...f, granted: f.granted.map((r, i) => i === idx
        ? { ...r, from: r.from.includes(name) ? r.from.filter((x) => x !== name) : [...r.from, name] }
        : r),
    }));
  const removeGranted = (idx) => setForm((f) => ({ ...f, granted: f.granted.filter((_, i) => i !== idx) }));

  // sparse object helper
  const sparseNum = (map) => {
    const out = {};
    for (const [k, v] of Object.entries(map)) {
      const n = numOrNull(v);
      if (n != null && n !== 0) out[k] = n;
    }
    return out;
  };

  const buildPayload = () => {
    // progressions
    const featProgression = form.feat_progression.map((nm) => {
      const feat = (featsData?.feats || []).find((f) => f?.name === nm);
      return { name: nm, category: feat?.category ? [feat.category] : [], progression: { "*": 1 } };
    });
    const optionalfeatureProgression = form.opt_feature_progression.map((nm) => {
      const fe = (optionalFeaturesData?.features || []).find((f) => f?.name === nm);
      return { name: nm, featureType: fe?.feature_type ? [fe.feature_type] : [], progression: { "*": 1 } };
    });

    // additional spells
    const additional_spells = {
      ability: { fixed: form.spell_ability_fixed || null, choose_from: [] },
      resource_name: form.resource_name || null,
      at_will: form.at_will.map((n) => n.toLowerCase()),
      daily: form.daily
        .map((r) => ({ uses: numOrNull(r.uses) || 1, spells: (r.spells || []).map((n) => n.toLowerCase()) }))
        .filter((r) => r.spells.length),
      ritual_named: [], ritual_choice: [], resource_cost: [],
      granted: form.granted
        .map((r) => ({ count: numOrNull(r.count) || 1, from: (r.from || []).map((n) => n.toLowerCase()), filter: null }))
        .filter((r) => r.from.length),
    };

    // senses (full object with nulls, like feats)
    const senses = {};
    for (const k of SENSES) senses[k] = numOrNull(form.senses[k]);

    // speeds sparse + hover
    const speeds = sparseNum(form.speeds);
    if (form.hover) speeds.hover = true;

    return {
      name: form.name.trim(),
      source: "HOMEBREW",
      visibility: form.visibility,
      feature_type: form.feature_type,
      consumes: form.consumes || null,
      entries: form.entries,

      skill_proficiencies: form.skill_proficiencies,
      immune: form.immune.map((s) => s.toLowerCase()),
      resist: form.resist.map((s) => s.toLowerCase()),
      vulnerable: form.vulnerable.map((s) => s.toLowerCase()),
      conditionImmune: form.conditionImmune.map((s) => s.toLowerCase()),

      ability_score_increase: sparseNum(form.asi),
      speeds,
      senses,
      bonuses: sparseNum(form.bonuses),

      featProgression,
      optionalfeatureProgression,

      additional_spells,
    };
  };

  const isEditing = !!editingFeature;
  const titleText = isEditing ? "Edit Optional Feature" : copyFromFeature ? "Copy Optional Feature" : "Create Optional Feature";

  const handleSubmit = async () => {
    if (!form.name.trim()) { setNameError(true); return; }
    setNameError(false);
    try {
      const payload = buildPayload();
      if (isEditing) await updateOptionalFeature(editingFeature.id, payload);
      else await createOptionalFeature(payload);
      setTimeout(onClose, 0);
    } catch { /* createError set */ }
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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden"
           onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
          <h2 className="text-amber-400 font-semibold uppercase tracking-wider text-sm">{titleText}</h2>
          <button onClick={onClose} className="px-2 text-slate-400 hover:text-slate-100 text-lg">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {/* Basics */}
          <FilterSection title="Basics" defaultOpen>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)}
                       placeholder="e.g. Devil's Sight"
                       className={`${fieldCls} ${nameError ? "border-red-500 ring-1 ring-red-500/40" : ""}`} />
                {nameError && <p className="text-xs text-red-400 mt-1">Name is required.</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Feature Type</label>
                  <select value={form.feature_type} onChange={(e) => update("feature_type", e.target.value)} className={fieldCls}>
                    {FEATURE_TYPES.map((t) => <option key={t} value={t}>{formatFeatureType(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Visibility</label>
                  <div className="flex gap-2">
                    {["private", "public"].map((v) => (
                      <button key={v} type="button" onClick={() => update("visibility", v)} className={chip(form.visibility === v)}>
                        {cap(v)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="max-w-[220px]">
                <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Consumes</label>
                <select value={form.consumes} onChange={(e) => update("consumes", e.target.value)} className={fieldCls}>
                  <option value="">—</option>
                  {RESOURCE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </FilterSection>

          {/* Description */}
          <FilterSection title="Description" defaultOpen>
            <textarea value={form.entries} onChange={(e) => update("entries", e.target.value)} rows={8}
                      className={fieldCls} placeholder={"Use ## for headings.\n\n## Effect\nYou gain..."} />
          </FilterSection>

          {/* Skill Proficiencies */}
          <FilterSection title="Skill Proficiencies">
            <CollapsibleChips label="Skills" options={skillKeys} selected={form.skill_proficiencies}
              onToggle={(v) => toggleListItem("skill_proficiencies", v)}
              renderOption={(k) => SKILL_OPTIONS[k]?.label || k} chip={chip} />
          </FilterSection>

          {/* Senses */}
          <FilterSection title="Senses">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {SENSES.map((s) => (
                <div key={s}>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">{cap(s)}</label>
                  <input type="number" min={0} step={5} value={form.senses[s]}
                         onChange={(e) => updateMap("senses", s, e.target.value)}
                         onBlur={(e) => updateMap("senses", s, clampStep5(e.target.value))}
                         className={fieldCls} />
                </div>
              ))}
            </div>
          </FilterSection>

          {/* Ability Score Increase */}
          <FilterSection title="Ability Score Increase">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {ABILITIES.map((a) => (
                <div key={a}>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1 text-center">{a.toUpperCase()}</label>
                  <input type="number" value={form.asi[a]} onChange={(e) => updateMap("asi", a, e.target.value)}
                         className={`${fieldCls} text-center`} placeholder="—" />
                </div>
              ))}
            </div>
          </FilterSection>

          {/* Speeds */}
          <FilterSection title="Speeds">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {SPEED_KEYS.map((k) => (
                <div key={k}>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">{cap(k)}</label>
                  <input type="number" min={0} step={5} value={form.speeds[k]}
                         onChange={(e) => updateMap("speeds", k, e.target.value)}
                         onBlur={(e) => updateMap("speeds", k, clampStep5(e.target.value))}
                         className={fieldCls} />
                </div>
              ))}
              <label className="flex items-end gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={form.hover}
                       onChange={(e) => update("hover", e.target.checked)}
                       className="accent-amber-500" />
                Hover
              </label>
            </div>
          </FilterSection>

          {/* Defenses */}
          <FilterSection title="Defenses">
            <div className="space-y-2">
              <CollapsibleChips label="Damage Immunities" options={DAMAGE_TYPES}
                selected={form.immune} onToggle={(v) => toggleListItem("immune", v)} chip={chip} />
              <CollapsibleChips label="Damage Resistances" options={DAMAGE_TYPES}
                selected={form.resist} onToggle={(v) => toggleListItem("resist", v)} chip={chip} />
              <CollapsibleChips label="Damage Vulnerabilities" options={DAMAGE_TYPES}
                selected={form.vulnerable} onToggle={(v) => toggleListItem("vulnerable", v)} chip={chip} />
              <CollapsibleChips label="Condition Immunities" options={CONDITION_OPTIONS}
                selected={form.conditionImmune} onToggle={(v) => toggleListItem("conditionImmune", v)} chip={chip} />
            </div>
          </FilterSection>

          {/* Bonuses */}
          <FilterSection title="Bonuses">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {BONUS_KEYS.map(([k, label]) => (
                <div key={k}>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">{label}</label>
                  <input type="number" value={form.bonuses[k]} onChange={(e) => updateMap("bonuses", k, e.target.value)}
                         className={fieldCls} placeholder="—" />
                </div>
              ))}
            </div>
          </FilterSection>

          {/* Feat Progression */}
          <FilterSection title="Feat Progression">
            <MultiNamePicker options={featNames} selected={form.feat_progression}
              onToggle={(n) => toggleListItem("feat_progression", n)} placeholder="Search feats…" />
          </FilterSection>

          {/* Optional Feature Progression */}
          <FilterSection title="Optional Feature Progression">
            <MultiNamePicker options={optFeatureNames} selected={form.opt_feature_progression}
              onToggle={(n) => toggleListItem("opt_feature_progression", n)} placeholder="Search optional features…" />
          </FilterSection>

          {/* Additional Spells */}
          <FilterSection title="Additional Spells">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Spellcasting Ability</label>
                  <select value={form.spell_ability_fixed} onChange={(e) => update("spell_ability_fixed", e.target.value)} className={fieldCls}>
                    <option value="">—</option>
                    {ABILITIES.map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Resource Used</label>
                  <select value={form.resource_name} onChange={(e) => update("resource_name", e.target.value)} className={fieldCls}>
                    <option value="">—</option>
                    {RESOURCE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* At Will */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">At Will</div>
                <MultiNamePicker options={xphbSpellNames} selected={form.at_will}
                  onToggle={(n) => toggleListItem("at_will", n)} placeholder="Search spells…" />
              </div>

              {/* Daily */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">Daily (Long Rest)</div>
                <div className="space-y-2">
                  {form.daily.map((r, idx) => (
                    <div key={idx} className="border border-slate-700 rounded p-2 space-y-2">
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase text-slate-400">Uses</span>
                          <input type="number" min={1} value={r.uses}
                                 onChange={(e) => updateDaily(idx, "uses", e.target.value)}
                                 className={`${fieldCls} max-w-[70px]`} />
                          <span className="text-[10px] uppercase text-slate-400">per long rest</span>
                        </div>
                        <button onClick={() => removeDaily(idx)}
                                className="text-[11px] px-2 py-1 rounded border border-red-700/50 text-red-300 hover:bg-red-900/40">✕</button>
                      </div>
                      <MultiNamePicker options={xphbSpellNames} selected={r.spells}
                        onToggle={(n) => toggleDailySpell(idx, n)} placeholder="Search spells…" />
                    </div>
                  ))}
                  <button onClick={addDaily}
                          className="text-[11px] px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:border-amber-500/40 hover:text-amber-300">
                    + Add Daily Group
                  </button>
                </div>
              </div>

              {/* Granted */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">Granted (Known Spells)</div>
                <div className="space-y-2">
                  {form.granted.map((r, idx) => (
                    <div key={idx} className="border border-slate-700 rounded p-2 space-y-2">
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase text-slate-400">Choose</span>
                          <input type="number" min={1} value={r.count}
                                 onChange={(e) => updateGranted(idx, "count", e.target.value)}
                                 className={`${fieldCls} max-w-[70px]`} />
                          <span className="text-[10px] uppercase text-slate-400">from</span>
                        </div>
                        <button onClick={() => removeGranted(idx)}
                                className="text-[11px] px-2 py-1 rounded border border-red-700/50 text-red-300 hover:bg-red-900/40">✕</button>
                      </div>
                      <MultiNamePicker options={xphbSpellNames} selected={r.from}
                        onToggle={(n) => toggleGrantedSpell(idx, n)} placeholder="Search spells…" />
                    </div>
                  ))}
                  <button onClick={addGranted}
                          className="text-[11px] px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:border-amber-500/40 hover:text-amber-300">
                    + Add Granted Group
                  </button>
                </div>
              </div>
            </div>
          </FilterSection>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-700">
          {createError ? <span className="text-xs text-red-400 truncate flex-1">{createError}</span> : <span className="flex-1" />}
          <button onClick={onClose}
                  className="text-[11px] px-3 py-1.5 rounded border border-slate-600 text-slate-400 hover:border-red-500/40 hover:text-red-300">
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
function CollapsibleChips({ label, options, selected, onToggle, renderOption, chip }) {
  const [open, setOpen] = useState(false);
  const display = renderOption || ((x) => cap(String(x)));
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1.5 uppercase tracking-wider text-amber-400 text-[10px] mb-1 hover:text-amber-300 transition select-none">
        <span className={`text-[10px] inline-block transition-transform duration-150 ${open ? "rotate-90" : ""}`}>▶</span>
        <span>{label}</span>
        {selected.length > 0 && <span className="ml-1 text-amber-300 normal-case">({selected.length})</span>}
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 pl-3 mb-2">
          {options.map((opt) => (
            <button key={opt} type="button" onClick={() => onToggle(opt)} className={chip(selected.includes(opt))}>
              {display(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Searchable multi-select for large lists ─── */
function MultiNamePicker({ options, selected, onToggle, placeholder }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options.filter((n) => n.toLowerCase().includes(q)).slice(0, 40);
  }, [query, options]);
  const chip = (active) =>
    `text-[11px] px-2 py-1 rounded border transition
     ${active
       ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
       : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-300"}`;
  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((n) => (
            <button key={n} type="button" onClick={() => onToggle(n)} className={chip(true)}>{cap(n)} ✕</button>
          ))}
        </div>
      )}
      <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
             placeholder={options.length ? placeholder : "Loading…"}
             className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-100 text-sm w-full mb-2
                        focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30" />
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
        {filtered.map((n) => (
          <button key={n} type="button" onClick={() => onToggle(n)} className={chip(selected.includes(n))}>{cap(n)}</button>
        ))}
        {query && filtered.length === 0 && <span className="text-[11px] text-slate-500">No matches.</span>}
      </div>
    </div>
  );
}