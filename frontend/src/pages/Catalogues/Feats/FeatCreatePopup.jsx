import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import { formatCategory } from "./featsHelpers";
import {
  DAMAGE_TYPES,
  CONDITION_OPTIONS,
  LANGUAGE_OPTIONS,
  SKILL_OPTIONS,
  TOOL_OPTIONS,
  WEAPON_OPTIONS,
  ARMOR_OPTIONS,
} from "../../../utils/Constants";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const RECHARGE = ["long_rest", "short_rest"];
const skillKeys = Object.keys(SKILL_OPTIONS);

const WEAPON_CATEGORIES = ["simple", "martial"];
const ARMOR_CATEGORIES = ["light", "medium", "heavy", "shield"];

const cap = (s) => (typeof s === "string" && s ? s[0].toUpperCase() + s.slice(1) : s);
const featureTypeLabel = (s) =>
  String(s || "").split(/[_\s]+/).filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");

const numOrNull = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const clampStep5 = (v) => {
  const n = numOrNull(v);
  if (n == null) return "";
  return String(Math.max(0, Math.round(n / 5) * 5));
};

const DEFAULT_STATE = {
  name: "",
  visibility: "private",
  category: "",
  repeatable: false,

  // prerequisite (single clause)
  prereq_level: "",
  prereq_abilities: [],   // [{ ability, min }]
  prereq_race: "",
  prereq_feat: "",
  prereq_spellcasting: false,

  entries: "",

  // ability score increase rows
  asi: [],                // [{ mode:"fixed"|"choose", ability, amount, from:[], count, max }]

  // senses
  darkvision: "",
  tremorsense: "",
  blindsight: "",
  truesight: "",

  // proficiencies & defenses
  immune: [],
  resist: [],
  conditionImmune: [],
  skillProficiencies: [],
  expertise: [],
  languageProficiencies: [],
  toolProficiencies: [],
  weaponProficiencies: [],
  armorProficiencies: [],
  savingThrowProficiencies: [],

  // additional features (optional features)
  additional_features: [], // [{ name, feature_type, source }]

  // additional spells
  spell_ability_fixed: "",
  granted_spells: [],      // [{ name, free_cast_amount, free_cast_recharge, level_requirement }]
  extended_spells: [],     // [{ name, spell_level }]
};

export default function FeatCreatePopup({ open, onClose, editingFeat, copyFromFeat }) {
  const createFeat = useCatalogueStore((s) => s.createFeat);
  const updateFeat = useCatalogueStore((s) => s.updateFeat);
  const creating = useCatalogueStore((s) => s.creatingFeat);
  const createError = useCatalogueStore((s) => s.createFeatError);

  const featsData = useCatalogueStore((s) => s.featsData);
  const races = useCatalogueStore((s) => s.races);
  const loadRaces = useCatalogueStore((s) => s.loadRaces);
  const spellsData = useCatalogueStore((s) => s.spellsData);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);
  const optionalFeaturesData = useCatalogueStore((s) => s.optionalFeaturesData);
  const loadOptionalFeatures = useCatalogueStore((s) => s.loadOptionalFeatures);

  const [form, setForm] = useState(DEFAULT_STATE);
  const [nameError, setNameError] = useState(false);

  const categories = featsData?.categories || [];

  // Lazy-load reference data when opened.
  useEffect(() => {
    if (!open) return;
    if (!Array.isArray(races) || races.length === 0) loadRaces();
    const sl = spellsData?.spells;
    if (!Array.isArray(sl) || sl.length === 0) loadSpells();
    const of = optionalFeaturesData;
    if (!of || Array.isArray(of) || Object.keys(of).length === 0) loadOptionalFeatures();
  }, [open]); // eslint-disable-line

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Repopulate from edit / copy source.
  useEffect(() => {
    if (!open) return;
    setNameError(false);

    const src = editingFeat || copyFromFeat;
    if (!src) { setForm(DEFAULT_STATE); return; }

    const clause = Array.isArray(src.prerequisite) ? src.prerequisite[0] || {} : {};
    const lvl =
      clause.level == null ? "" :
      typeof clause.level === "object" ? (clause.level.level ?? "") : clause.level;
    const prereqAbilities = Array.isArray(clause.ability)
      ? clause.ability.flatMap((o) =>
          Object.entries(o).map(([ability, min]) => ({ ability, min })))
      : [];
    const firstName = (arr) => {
      if (!Array.isArray(arr) || !arr.length) return "";
      const v = arr[0];
      return typeof v === "string" ? v : (v?.name || "");
    };

    const asiRows = Array.isArray(src.ability_score_increase)
      ? src.ability_score_increase.map((entry) => {
          if (entry.choose) {
            return {
              mode: "choose",
              ability: "str",
              amount: entry.choose.amount ?? 1,
              from: entry.choose.from || [],
              count: entry.choose.count ?? 1,
              max: entry.max ?? "",
            };
          }
          const [ability, amount] = Object.entries(entry)[0] || ["str", 1];
          return { mode: "fixed", ability, amount, from: [], count: 1, max: "" };
        })
      : [];

    const sp = src.additional_spells || {};
    const granted = Array.isArray(sp.spells)
      ? sp.spells
          .filter((s) => s.name)              // only named spells (no choice builder)
          .map((s) => ({
            name: s.name || "",
            free_cast_amount: s.free_cast?.amount ?? "",
            free_cast_recharge: s.free_cast?.recharge || "long_rest",
            level_requirement: s.level_requirement ?? "",
          }))
      : [];
    const extended = Array.isArray(sp.extended_spell_list)
      ? sp.extended_spell_list.map((e) => ({
          name: e.name || "",
          spell_level: e.spell_level ?? 0,
        }))
      : [];

    const feats = Array.isArray(src.additonal_feature) ? src.additonal_feature : [];
    const additional_features = feats.map((f) =>
      typeof f === "string"
        ? { name: f, feature_type: "", source: "XPHB" }
        : { name: f.name || "", feature_type: f.feature_type || "", source: f.source || "XPHB" }
    );

    setForm({
      ...DEFAULT_STATE,
      name: copyFromFeat ? `${src.name} (copy)` : src.name || "",
      visibility: copyFromFeat ? "private" : (src.visibility || "private"),
      category: src.category || "",
      repeatable: !!src.repeatable,

      prereq_level: lvl === "" ? "" : String(lvl),
      prereq_abilities: prereqAbilities,
      prereq_race: firstName(clause.race),
      prereq_feat: firstName(clause.feat),
      prereq_spellcasting: !!(clause.spellcasting || clause.spellcasting2020 || clause.spellcastingFeature),

      entries: src.entries || "",
      asi: asiRows,

      darkvision: src.senses?.darkvision ?? "",
      tremorsense: src.senses?.tremorsense ?? "",
      blindsight: src.senses?.blindsight ?? "",
      truesight: src.senses?.truesight ?? "",

      immune: src.immune || [],
      resist: src.resist || [],
      conditionImmune: src.conditionImmune || [],
      skillProficiencies: src.skillProficiencies || [],
      expertise: src.expertise || [],
      languageProficiencies: src.languageProficiencies || [],
      toolProficiencies: src.toolProficiencies || [],
      weaponProficiencies: src.weaponProficiencies || [],
      armorProficiencies: src.armorProficiencies || [],
      savingThrowProficiencies: src.savingThrowProficiencies || [],

      additional_features,

      spell_ability_fixed: sp.spellcasting_ability?.fixed || "",
      granted_spells: granted,
      extended_spells: extended,
    });
  }, [open, editingFeat, copyFromFeat]);

  // XPHB spells for the pickers.
  const xphbSpellNames = useMemo(() => {
    const list = spellsData?.spells;
    if (!Array.isArray(list)) return [];
    const names = list.filter((sp) => sp?.source === "XPHB" && sp?.name).map((sp) => sp.name);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [spellsData]);

  // Race names for the prerequisite picker.
  const raceNames = useMemo(() => {
    const names = (races || []).map((r) => r?.name).filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [races]);

  // Feat names (excluding the feat being edited).
  const featNames = useMemo(() => {
    const names = (featsData?.feats || [])
      .map((f) => f?.name)
      .filter((n) => n && n !== editingFeat?.name);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [featsData, editingFeat]);

  // XPHB optional features, grouped by type.
  const xphbFeatures = useMemo(() => {
    const data = optionalFeaturesData;
    if (!data || Array.isArray(data)) return [];
    const out = [];
    for (const [type, list] of Object.entries(data)) {
      if (!Array.isArray(list)) continue;
      for (const f of list) {
        if (f?.source === "XPHB" && f?.name)
          out.push({ name: f.name, feature_type: type, source: "XPHB" });
      }
    }
    return out.sort((a, b) =>
      a.feature_type === b.feature_type
        ? a.name.localeCompare(b.name)
        : a.feature_type.localeCompare(b.feature_type)
    );
  }, [optionalFeaturesData]);

  if (!open) return null;

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const toggleListItem = (key, val) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val],
    }));

  const usedPrereqAbilities = form.prereq_abilities.map((r) => r.ability);
  const usedFixedAsi = form.asi.filter((r) => r.mode === "fixed").map((r) => r.ability);
  const allAbilitiesUsed = usedPrereqAbilities.length >= ABILITIES.length;

  // ── prereq ability rows ──
  const addPrereqAbility = () =>
    setForm((f) => {
      const used = new Set(f.prereq_abilities.map((r) => r.ability));
      const next = ABILITIES.find((a) => !used.has(a)) || "str";
      return { ...f, prereq_abilities: [...f.prereq_abilities, { ability: next, min: 13 }] };
    });

  const updatePrereqAbility = (idx, key, val) =>
    setForm((f) => ({
      ...f,
      prereq_abilities: f.prereq_abilities.map((r, i) => (i === idx ? { ...r, [key]: val } : r)),
    }));
  const removePrereqAbility = (idx) =>
    setForm((f) => ({ ...f, prereq_abilities: f.prereq_abilities.filter((_, i) => i !== idx) }));

  // ── ASI rows ──
  const addAsi = () =>
    setForm((f) => {
      const used = new Set(f.asi.filter((r) => r.mode === "fixed").map((r) => r.ability));
      const next = ABILITIES.find((a) => !used.has(a)) || "str";
      return { ...f, asi: [...f.asi, { mode: "fixed", ability: next, amount: 1, from: [], count: 1, max: "" }] };
    });
  const updateAsi = (idx, key, val) =>
    setForm((f) => ({
      ...f,
      asi: f.asi.map((r, i) => {
        if (i !== idx) return r;
        if (key === "mode" && val === "fixed") {
          const used = new Set(f.asi.filter((x, j) => j !== idx && x.mode === "fixed").map((x) => x.ability));
          const nextAbility = used.has(r.ability) ? (ABILITIES.find((a) => !used.has(a)) || r.ability) : r.ability;
          return { ...r, mode: val, ability: nextAbility };
        }
        return { ...r, [key]: val };
      }),
    }));
  const toggleAsiFrom = (idx, a) =>
    setForm((f) => ({
      ...f,
      asi: f.asi.map((r, i) =>
        i === idx
          ? { ...r, from: r.from.includes(a) ? r.from.filter((x) => x !== a) : [...r.from, a] }
          : r
      ),
    }));
  const removeAsi = (idx) =>
    setForm((f) => ({ ...f, asi: f.asi.filter((_, i) => i !== idx) }));

  // ── granted spells ──
  const addGranted = () =>
    setForm((f) => ({
      ...f,
      granted_spells: [...f.granted_spells, { name: "", free_cast_amount: "", free_cast_recharge: "long_rest", level_requirement: "" }],
    }));
  const updateGranted = (idx, key, val) =>
    setForm((f) => ({ ...f, granted_spells: f.granted_spells.map((s, i) => (i === idx ? { ...s, [key]: val } : s)) }));
  const removeGranted = (idx) =>
    setForm((f) => ({ ...f, granted_spells: f.granted_spells.filter((_, i) => i !== idx) }));

  // ── extended spells ──
  const addExtended = () =>
    setForm((f) => ({ ...f, extended_spells: [...f.extended_spells, { name: "", spell_level: 1 }] }));
  const updateExtended = (idx, key, val) =>
    setForm((f) => ({ ...f, extended_spells: f.extended_spells.map((s, i) => (i === idx ? { ...s, [key]: val } : s)) }));
  const removeExtended = (idx) =>
    setForm((f) => ({ ...f, extended_spells: f.extended_spells.filter((_, i) => i !== idx) }));

  // ── additional features ──
  const toggleFeature = (feat) =>
    setForm((f) => {
      const exists = f.additional_features.some(
        (x) => x.name === feat.name && x.feature_type === feat.feature_type
      );
      return {
        ...f,
        additional_features: exists
          ? f.additional_features.filter((x) => !(x.name === feat.name && x.feature_type === feat.feature_type))
          : [...f.additional_features, feat],
      };
    });

  const buildPayload = () => {
    const clause = {};
    const lvl = numOrNull(form.prereq_level);
    if (lvl != null) clause.level = lvl;
    const seenPrereqAbil = new Set();
    const abil = form.prereq_abilities
      .filter((r) => r.ability && numOrNull(r.min) != null)
      .filter((r) => (seenPrereqAbil.has(r.ability) ? false : seenPrereqAbil.add(r.ability)))
      .map((r) => ({ [r.ability]: Number(r.min) }));
    
    if (abil.length) clause.ability = abil;
    if (form.prereq_race.trim()) clause.race = [form.prereq_race.trim().toLowerCase()];
    if (form.prereq_feat.trim()) clause.feat = [form.prereq_feat.trim()];
    if (form.prereq_spellcasting) clause.spellcasting = true;
    const prerequisite = Object.keys(clause).length ? [clause] : [];

    const seenFixedAsi = new Set();
    const ability_score_increase = form.asi
      .map((row) => {
        if (row.mode === "choose") {
          if (!row.from.length) return null;
          const entry = {
            choose: { from: row.from, count: Number(row.count) || 1, amount: Number(row.amount) || 1 },
          };
          const max = numOrNull(row.max);
          if (max != null) entry.max = max;
          return entry;
        }
        return { [row.ability]: Number(row.amount) || 1 };
      })
      .filter(Boolean)
      .filter((entry) => {
        if (entry.choose) return true;
        const k = Object.keys(entry)[0];
        if (seenFixedAsi.has(k)) return false;
        seenFixedAsi.add(k);
        return true;
      });

    const additional_spells = {
      spellcasting_ability: { fixed: form.spell_ability_fixed || null, choose_from: [] },
      spells: form.granted_spells
        .filter((s) => s.name.trim())
        .map((s) => ({
          name: s.name.trim().toLowerCase(),
          choice: null,
          level_requirement: numOrNull(s.level_requirement),
          free_cast: numOrNull(s.free_cast_amount) != null
            ? { amount: Number(s.free_cast_amount), recharge: s.free_cast_recharge || "long_rest" }
            : null,
        })),
      extended_spell_list: form.extended_spells
        .filter((s) => s.name.trim())
        .map((s) => ({ name: s.name.trim().toLowerCase(), spell_level: Number(s.spell_level) || 0 })),
    };

    return {
      name: form.name.trim(),
      source: "HOMEBREW",
      visibility: form.visibility,
      category: form.category || null,
      repeatable: !!form.repeatable,
      prerequisite,
      entries: form.entries,
      ability_score_increase,
      additional_spells,
      senses: {
        darkvision: numOrNull(form.darkvision),
        tremorsense: numOrNull(form.tremorsense),
        blindsight: numOrNull(form.blindsight),
        truesight: numOrNull(form.truesight),
      },
      immune: form.immune.map((s) => s.toLowerCase()),
      resist: form.resist.map((s) => s.toLowerCase()),
      conditionImmune: form.conditionImmune.map((s) => s.toLowerCase()),
      skillProficiencies: form.skillProficiencies,
      expertise: form.expertise,
      languageProficiencies: form.languageProficiencies.map((s) => s.toLowerCase()),
      toolProficiencies: form.toolProficiencies.map((s) => s.toLowerCase()),
      weaponProficiencies: form.weaponProficiencies.map((s) => s.toLowerCase()),
      armorProficiencies: form.armorProficiencies.map((s) => s.toLowerCase()),
      savingThrowProficiencies: form.savingThrowProficiencies,
      additonal_feature: form.additional_features,
    };
  };

  const isEditing = !!editingFeat;
  const titleText = isEditing ? "Edit Feat" : copyFromFeat ? "Copy Feat" : "Create Feat";

  const handleSubmit = async () => {
    if (!form.name.trim()) { setNameError(true); return; }
    setNameError(false);
    try {
      const payload = buildPayload();
      if (isEditing) await updateFeat(editingFeat.id, payload);
      else await createFeat(payload);
      setTimeout(onClose, 0);
    } catch {
      // createError already set
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
                  placeholder="e.g. Stormcaller"
                  className={`${fieldCls} ${nameError ? "border-red-500 ring-1 ring-red-500/40" : ""}`}
                />
                {nameError && <p className="text-xs text-red-400 mt-1">Name is required.</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Category</label>
                  <select value={form.category} onChange={(e) => update("category", e.target.value)} className={fieldCls}>
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{formatCategory(c)}</option>
                    ))}
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

              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={form.repeatable}
                       onChange={(e) => update("repeatable", e.target.checked)}
                       className="accent-amber-500" />
                Repeatable
              </label>
            </div>
          </FilterSection>

          {/* ── Prerequisite ── */}
          <FilterSection title="Prerequisite">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Min Level</label>
                  <input type="number" min={1} value={form.prereq_level}
                         onChange={(e) => update("prereq_level", e.target.value)} className={fieldCls} />
                </div>
                <label className="flex items-end gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={form.prereq_spellcasting}
                         onChange={(e) => update("prereq_spellcasting", e.target.checked)}
                         className="accent-amber-500" />
                  Spellcasting feature
                </label>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Required Race</label>
                <NamePicker options={raceNames} value={form.prereq_race}
                            placeholder="Search races…" allowClear
                            onSelect={(n) => update("prereq_race", n)} />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Required Feat</label>
                <NamePicker options={featNames} value={form.prereq_feat}
                            placeholder="Search feats…" allowClear
                            onSelect={(n) => update("prereq_feat", n)} />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Ability Requirements</label>
                <div className="space-y-2">
                  {form.prereq_abilities.map((r, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select value={r.ability} onChange={(e) => updatePrereqAbility(idx, "ability", e.target.value)}
                              className={`${fieldCls} max-w-[110px]`}>
                        {ABILITIES.map((a) => (
                          <option key={a} value={a}
                                  disabled={a !== r.ability && usedPrereqAbilities.includes(a)}>
                            {a.toUpperCase()}
                          </option>
                        ))}
                      </select>
                      <input type="number" min={1} value={r.min}
                             onChange={(e) => updatePrereqAbility(idx, "min", e.target.value)}
                             className={`${fieldCls} max-w-[90px]`} placeholder="Min" />
                      <button onClick={() => removePrereqAbility(idx)}
                              className="text-[11px] px-2 py-1 rounded border border-red-700/50 text-red-300 hover:bg-red-900/40">
                        ✕
                      </button>
                    </div>
                  ))}
                  <button onClick={addPrereqAbility}
                          className="text-[11px] px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:border-amber-500/40 hover:text-amber-300">
                    + Add Ability Requirement
                  </button>
                </div>
              </div>
            </div>
          </FilterSection>

          {/* ── Entries ── */}
          <FilterSection title="Description" defaultOpen>
            <textarea value={form.entries} onChange={(e) => update("entries", e.target.value)}
                      rows={8} className={fieldCls}
                      placeholder={"Use ## for headings.\n\n## Benefit\nYou gain..."} />
            <p className="text-[10px] text-slate-500 mt-1">
              Markdown-lite: <code>## Heading</code>, blank line between paragraphs, pipe tables supported.
            </p>
          </FilterSection>

          {/* ── Ability Score Increase ── */}
          <FilterSection title="Ability Score Increase">
            <div className="space-y-2">
              {form.asi.map((row, idx) => (
                <div key={idx} className="border border-slate-700 rounded p-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex gap-1">
                      {["fixed", "choose"].map((m) => (
                        <button key={m} type="button" onClick={() => updateAsi(idx, "mode", m)} className={chip(row.mode === m)}>
                          {m === "fixed" ? "Fixed" : "Choose"}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => removeAsi(idx)}
                            className="text-[11px] px-2 py-1 rounded border border-red-700/50 text-red-300 hover:bg-red-900/40">
                      ✕
                    </button>
                  </div>

                  {row.mode === "fixed" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Ability</div>
                        <select value={row.ability} onChange={(e) => updateAsi(idx, "ability", e.target.value)} className={fieldCls}>
                           {ABILITIES.map((a) => (
                            <option key={a} value={a}
                                    disabled={a !== row.ability && usedFixedAsi.includes(a)}>
                              {a.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Amount (+)</div>
                        <input type="number" value={row.amount} onChange={(e) => updateAsi(idx, "amount", e.target.value)} className={fieldCls} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Choose From</div>
                        <div className="flex flex-wrap gap-2">
                          {ABILITIES.map((a) => (
                            <button key={a} type="button" onClick={() => toggleAsiFrom(idx, a)} className={chip(row.from.includes(a))}>
                              {a.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Count</div>
                          <input type="number" min={1} value={row.count} onChange={(e) => updateAsi(idx, "count", e.target.value)} className={fieldCls} />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Amount (+)</div>
                          <input type="number" min={1} value={row.amount} onChange={(e) => updateAsi(idx, "amount", e.target.value)} className={fieldCls} />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Max (opt.)</div>
                          <input type="number" value={row.max} onChange={(e) => updateAsi(idx, "max", e.target.value)} className={fieldCls} placeholder="e.g. 20" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button onClick={addAsi}
                      className="text-[11px] px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:border-amber-500/40 hover:text-amber-300">
                + Add Increase
              </button>
            </div>
          </FilterSection>

          {/* ── Senses ── */}
          <FilterSection title="Senses">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {["darkvision", "tremorsense", "blindsight", "truesight"].map((s) => (
                <div key={s}>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">{cap(s)}</label>
                  <input type="number" min={0} step={5} value={form[s]}
                         onChange={(e) => update(s, e.target.value)}
                         onBlur={(e) => update(s, clampStep5(e.target.value))}
                         className={fieldCls} />
                </div>
              ))}
            </div>
          </FilterSection>

          {/* ── Proficiencies & Defenses ── */}
          <FilterSection title="Proficiencies & Defenses">
            <div className="space-y-2">
              <CollapsibleChips label="Damage Immunities" options={DAMAGE_TYPES}
                selected={form.immune} onToggle={(v) => toggleListItem("immune", v)} />
              <CollapsibleChips label="Damage Resistances" options={DAMAGE_TYPES}
                selected={form.resist} onToggle={(v) => toggleListItem("resist", v)} />
              <CollapsibleChips label="Condition Immunities" options={CONDITION_OPTIONS}
                selected={form.conditionImmune} onToggle={(v) => toggleListItem("conditionImmune", v)} />
              <CollapsibleChips label="Skills" options={skillKeys}
                selected={form.skillProficiencies} onToggle={(v) => toggleListItem("skillProficiencies", v)}
                renderOption={(k) => SKILL_OPTIONS[k]?.label || k} />
              <CollapsibleChips label="Expertise" options={skillKeys}
                selected={form.expertise} onToggle={(v) => toggleListItem("expertise", v)}
                renderOption={(k) => SKILL_OPTIONS[k]?.label || k} />
              <CollapsibleChips label="Languages" options={LANGUAGE_OPTIONS}
                selected={form.languageProficiencies} onToggle={(v) => toggleListItem("languageProficiencies", v)} />
              <CollapsibleChips label="Tools" options={TOOL_OPTIONS}
                selected={form.toolProficiencies} onToggle={(v) => toggleListItem("toolProficiencies", v)} />

              <div>
                <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">Weapon Categories</div>
                <div className="flex flex-wrap gap-2 pl-3 mb-1">
                  {WEAPON_CATEGORIES.map((c) => (
                    <button key={c} type="button" onClick={() => toggleListItem("weaponProficiencies", c)}
                            className={chip(form.weaponProficiencies.includes(c))}>
                      {cap(c)}
                    </button>
                  ))}
                </div>
              </div>
              <CollapsibleChips label="Specific Weapons" options={WEAPON_OPTIONS}
                selected={form.weaponProficiencies} onToggle={(v) => toggleListItem("weaponProficiencies", v)} />

              <div>
                <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">Armor Categories</div>
                <div className="flex flex-wrap gap-2 pl-3 mb-1">
                  {ARMOR_CATEGORIES.map((c) => (
                    <button key={c} type="button" onClick={() => toggleListItem("armorProficiencies", c)}
                            className={chip(form.armorProficiencies.includes(c))}>
                      {cap(c)}
                    </button>
                  ))}
                </div>
              </div>
              <CollapsibleChips label="Specific Armor" options={ARMOR_OPTIONS}
                selected={form.armorProficiencies} onToggle={(v) => toggleListItem("armorProficiencies", v)} />

              <CollapsibleChips label="Saving Throws" options={ABILITIES}
                selected={form.savingThrowProficiencies} onToggle={(v) => toggleListItem("savingThrowProficiencies", v)}
                renderOption={(a) => a.toUpperCase()} />
            </div>
          </FilterSection>

          {/* ── Additional Features ── */}
          <FilterSection title="Additional Features">
            <FeaturePicker features={xphbFeatures} selected={form.additional_features} onToggle={toggleFeature} />
          </FilterSection>

          {/* ── Additional Spells ── */}
          <FilterSection title="Additional Spells">
            <div className="space-y-3">
              <div className="max-w-[200px]">
                <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Spellcasting Ability</div>
                <select value={form.spell_ability_fixed} onChange={(e) => update("spell_ability_fixed", e.target.value)} className={fieldCls}>
                  <option value="">—</option>
                  {ABILITIES.map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
                </select>
              </div>

              {/* Granted spells */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">Granted Spells</div>
                <div className="space-y-2">
                  {form.granted_spells.map((sp, idx) => (
                    <div key={idx} className="border border-slate-700 rounded p-2 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase tracking-wider text-amber-400">Spell {idx + 1}</span>
                        <button onClick={() => removeGranted(idx)}
                                className="text-[11px] px-2 py-1 rounded border border-red-700/50 text-red-300 hover:bg-red-900/40">✕</button>
                      </div>
                      <NamePicker options={xphbSpellNames} value={sp.name}
                                  placeholder="Search spells…" onSelect={(n) => updateGranted(idx, "name", n)} />
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Free Casts</div>
                          <input type="number" min={1} value={sp.free_cast_amount}
                                 onChange={(e) => updateGranted(idx, "free_cast_amount", e.target.value)}
                                 className={fieldCls} placeholder="—" />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Recharge</div>
                          <select value={sp.free_cast_recharge}
                                  onChange={(e) => updateGranted(idx, "free_cast_recharge", e.target.value)}
                                  className={fieldCls} disabled={!sp.free_cast_amount}>
                            {RECHARGE.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                          </select>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Req. Level</div>
                          <input type="number" min={1} value={sp.level_requirement}
                                 onChange={(e) => updateGranted(idx, "level_requirement", e.target.value)}
                                 className={fieldCls} placeholder="—" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={addGranted}
                          className="text-[11px] px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:border-amber-500/40 hover:text-amber-300">
                    + Add Spell
                  </button>
                </div>
              </div>

              {/* Extended list */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">Expanded Spell List</div>
                <div className="space-y-2">
                  {form.extended_spells.map((sp, idx) => (
                    <div key={idx} className="border border-slate-700 rounded p-2 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase tracking-wider text-amber-400">Entry {idx + 1}</span>
                        <button onClick={() => removeExtended(idx)}
                                className="text-[11px] px-2 py-1 rounded border border-red-700/50 text-red-300 hover:bg-red-900/40">✕</button>
                      </div>
                      <NamePicker options={xphbSpellNames} value={sp.name}
                                  placeholder="Search spells…" onSelect={(n) => updateExtended(idx, "name", n)} />
                      <div className="max-w-[120px]">
                        <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Spell Level</div>
                        <input type="number" min={0} max={9} value={sp.spell_level}
                               onChange={(e) => updateExtended(idx, "spell_level", e.target.value)} className={fieldCls} />
                      </div>
                    </div>
                  ))}
                  <button onClick={addExtended}
                          className="text-[11px] px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:border-amber-500/40 hover:text-amber-300">
                    + Add Expanded Spell
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
function CollapsibleChips({ label, options, selected, onToggle, renderOption }) {
  const [open, setOpen] = useState(false);
  const chip = (active) =>
    `text-[11px] px-2 py-1 rounded border transition
     ${active
       ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
       : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-300"}`;
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

/* ─── Generic searchable single-select ─── */
function NamePicker({ options, value, onSelect, placeholder, allowClear }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options.filter((n) => n.toLowerCase().includes(q)).slice(0, 60);
  }, [query, options]);
  const chip = (active) =>
    `text-[11px] px-2 py-1 rounded border transition
     ${active
       ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
       : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-300"}`;
  return (
    <div>
      {value && (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] text-amber-300">Selected: {value}</span>
          {allowClear && (
            <button type="button" onClick={() => onSelect("")}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-slate-600 text-slate-400 hover:text-red-300 hover:border-red-500/40">
              clear
            </button>
          )}
        </div>
      )}
      <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
             placeholder={options.length ? placeholder : "Loading…"}
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

/* ─── Optional-feature multi-select, grouped by type ─── */
function FeaturePicker({ features, selected, onToggle }) {
  const [query, setQuery] = useState("");
  const isSel = (f) => selected.some((x) => x.name === f.name && x.feature_type === f.feature_type);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? features.filter((f) => f.name.toLowerCase().includes(q)) : features;
    const groups = {};
    for (const f of list) (groups[f.feature_type] ||= []).push(f);
    return groups;
  }, [query, features]);

  const chip = (active) =>
    `text-[11px] px-2 py-1 rounded border transition
     ${active
       ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
       : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-300"}`;

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((f) => (
            <button key={`${f.feature_type}-${f.name}`} type="button" onClick={() => onToggle(f)} className={chip(true)}>
              {f.name} ✕
            </button>
          ))}
        </div>
      )}
      <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
             placeholder={features.length ? "Search features…" : "Loading features…"}
             className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-100 text-sm w-full mb-2
                        focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30" />
      <div className="max-h-48 overflow-y-auto pr-1 space-y-2">
        {Object.keys(filtered).sort().map((type) => (
          <div key={type}>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{featureTypeLabel(type)}</div>
            <div className="flex flex-wrap gap-1.5">
              {filtered[type].map((f) => (
                <button key={`${type}-${f.name}`} type="button" onClick={() => onToggle(f)} className={chip(isSel(f))}>
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(filtered).length === 0 && <span className="text-[11px] text-slate-500">No matches.</span>}
      </div>
    </div>
  );
}