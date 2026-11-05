import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import { SIZE_LABELS, SIZE_ORDER, cap } from "./raceHelpers";
import {
  DAMAGE_TYPES,
  CONDITION_OPTIONS,
  LANGUAGE_OPTIONS,
  SKILL_OPTIONS,
  TOOL_OPTIONS,
  WEAPON_OPTIONS,
  ARMOR_OPTIONS,
} from "../../../utils/Constants";

const CREATURE_TYPES = [
  "humanoid", "fey", "dragon", "elemental", "fiend",
  "celestial", "construct", "undead", "giant", "monstrosity",
  "beast", "plant", "ooze", "aberration",
];

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

const DEFAULT_STATE = {
  name: "",
  visibility: "private",
  creature_type: "humanoid",
  sizes: ["medium"],
  walk: 30,
  fly: "",
  swim: "",
  climb: "",
  burrow: "",
  hover: false,
  darkvision: "",
  tremorsense: "",
  blindsight: "",
  truesight: "",
  asi: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  resistances: [],
  immunities: [],
  vulnerabilities: [],
  condition_advantages: [],
  languages_fixed: [],
  skills_fixed: [],
  tools_fixed: [],
  weapons_fixed: [],
  armor_fixed: [],
  spell_ability: "",
  traits: [],
  spells: [],
};

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

const clampAbility = (v) => {
  const n = numOrNull(v);
  if (n == null) return 10;
  return Math.max(0, Math.floor(n));
};

const skillKeys = Object.keys(SKILL_OPTIONS);

export default function RaceCreatePopup({ open, onClose, editingRace, copyFromRace }) {
  const createRace = useCatalogueStore((s) => s.createRace);
  const creating = useCatalogueStore((s) => s.creatingRace);
  const createError = useCatalogueStore((s) => s.createError);
  const spellsData = useCatalogueStore((s) => s.spellsData);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);
  const updateRace = useCatalogueStore((s) => s.updateRace);

  const [form, setForm] = useState(DEFAULT_STATE);
  const [nameError, setNameError] = useState(false);

  // Lazily load spells when opened, only if not already loaded.
  useEffect(() => {
    if (!open) return;
    const list = spellsData?.spells;
    if (!Array.isArray(list) || list.length === 0) loadSpells();
  }, [open, spellsData, loadSpells]);

  useEffect(() => {
    if (!open) return;
    setNameError(false);

    const source = editingRace || copyFromRace;
    if (!source) {
      setForm(DEFAULT_STATE);
      return;
    }

    setForm({
      ...DEFAULT_STATE,
      name: copyFromRace ? `${source.name} (copy)` : source.name,
      visibility: copyFromRace ? "private" : (source.visibility || "private"),
      creature_type: source.creature_type || "humanoid",
      sizes: Array.isArray(source.sizes) && source.sizes.length ? source.sizes : ["medium"],
      walk: source.speed?.walk ?? 30,
      fly: source.speed?.fly ?? "",
      swim: source.speed?.swim ?? "",
      climb: source.speed?.climb ?? "",
      burrow: source.speed?.burrow ?? "",
      hover: !!source.speed?.hover,
      darkvision: source.senses?.darkvision ?? "",
      tremorsense: source.senses?.tremorsense ?? "",
      blindsight: source.senses?.blindsight ?? "",
      truesight: source.senses?.truesight ?? "",
      asi: ABILITIES.reduce((acc, a) => {
        acc[a] = source.abilities?.fixed?.[a] ?? 10;
        return acc;
      }, {}),
      resistances: source.defenses?.resistances || [],
      immunities: source.defenses?.immunities || [],
      vulnerabilities: source.defenses?.vulnerabilities || [],
      condition_advantages: source.defenses?.condition_advantages || [],
      languages_fixed: source.proficiencies?.languages?.fixed || [],
      skills_fixed: source.proficiencies?.skills?.fixed || [],
      tools_fixed: source.proficiencies?.tools?.fixed || [],
      weapons_fixed: source.proficiencies?.weapons?.fixed || [],
      armor_fixed: source.proficiencies?.armor?.fixed || [],
      spell_ability: source.spell_ability || "",
      traits: Array.isArray(source.traits)
        ? source.traits.map((t) => ({ name: t.name || "", notes: t.notes || "" }))
        : [],
      spells: Array.isArray(source.spells)
        ? source.spells.map((sp) => ({
            name: sp.name || "",
            level_available: sp.level_available || 1,
            uses_type: sp.uses?.type || "at_will",
            uses_count: sp.uses?.count ?? "",
            category: sp.category || "innate",
          }))
        : [],
    });
  }, [open, editingRace, copyFromRace]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // XPHB spell names, sorted, used by the picker.
  const xphbSpellNames = useMemo(() => {
    const list = spellsData?.spells;
    if (!Array.isArray(list)) return [];
    const names = list
      .filter((sp) => sp?.source === "XPHB" && sp?.name)
      .map((sp) => sp.name);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [spellsData]);

  if (!open) return null;

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const toggleSize = (s) =>
    setForm((f) => ({
      ...f,
      sizes: f.sizes.includes(s) ? f.sizes.filter((x) => x !== s) : [...f.sizes, s],
    }));

  const toggleListItem = (key, val) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val],
    }));

  const updateAsi = (a, raw) =>
    setForm((f) => ({ ...f, asi: { ...f.asi, [a]: clampAbility(raw) } }));

  const addTrait = () =>
    setForm((f) => ({ ...f, traits: [...f.traits, { name: "", notes: "" }] }));
  const updateTrait = (idx, key, val) =>
    setForm((f) => ({
      ...f,
      traits: f.traits.map((t, i) => (i === idx ? { ...t, [key]: val } : t)),
    }));
  const removeTrait = (idx) =>
    setForm((f) => ({ ...f, traits: f.traits.filter((_, i) => i !== idx) }));

  const addSpell = () =>
    setForm((f) => ({
      ...f,
      spells: [
        ...f.spells,
        { name: "", level_available: 1, uses_type: "at_will", uses_count: "", category: "innate" },
      ],
    }));
  const updateSpell = (idx, key, val) =>
    setForm((f) => ({
      ...f,
      spells: f.spells.map((sp, i) => (i === idx ? { ...sp, [key]: val } : sp)),
    }));
  const removeSpell = (idx) =>
    setForm((f) => ({ ...f, spells: f.spells.filter((_, i) => i !== idx) }));

  const buildPayload = () => ({
    name: form.name.trim(),
    source: "HOMEBREW",
    visibility: form.visibility,
    creature_type: form.creature_type || "humanoid",
    sizes: form.sizes.length ? form.sizes : ["medium"],
    speed: {
      walk: numOrNull(form.walk) ?? 30,
      fly: numOrNull(form.fly),
      swim: numOrNull(form.swim),
      climb: numOrNull(form.climb),
      burrow: numOrNull(form.burrow),
      hover: form.hover || null,
    },
    senses: {
      darkvision: numOrNull(form.darkvision),
      tremorsense: numOrNull(form.tremorsense),
      blindsight: numOrNull(form.blindsight),
      truesight: numOrNull(form.truesight),
    },
    abilities: {
      fixed: ABILITIES.reduce((acc, a) => {
        acc[a] = form.asi[a] === 10 ? null : form.asi[a];
        return acc;
      }, {}),
      choose: null,
    },
    defenses: {
      resistances: form.resistances.map((s) => s.toLowerCase()),
      immunities: form.immunities.map((s) => s.toLowerCase()),
      vulnerabilities: form.vulnerabilities.map((s) => s.toLowerCase()),
      condition_advantages: form.condition_advantages.map((s) => s.toLowerCase()),
    },
    proficiencies: {
      languages: { fixed: form.languages_fixed.map((s) => s.toLowerCase()), choose: null },
      skills:    { fixed: form.skills_fixed,    choose: null },
      tools:     { fixed: form.tools_fixed.map((s) => s.toLowerCase()), choose: null },
      weapons:   { fixed: form.weapons_fixed.map((s) => s.toLowerCase()), categories: [] },
      armor:     { fixed: form.armor_fixed.map((s) => s.toLowerCase()), categories: [] },
    },
    spells: form.spells
      .filter((sp) => sp.name.trim())
      .map((sp) => ({
        name: sp.name.trim().toLowerCase(),
        level_available: Number(sp.level_available) || 1,
        uses: {
          type: sp.uses_type,
          count: sp.uses_type === "at_will" ? null : numOrNull(sp.uses_count),
        },
        category: sp.category || "innate",
      })),
    spell_ability: form.spell_ability || null,
    traits: form.traits
      .filter((t) => t.name.trim())
      .map((t) => ({ name: t.name.trim(), notes: t.notes.trim() })),
    sub_races: [],
  });

   const isEditing = !!editingRace;
   const titleText = isEditing ? "Edit Race" : copyFromRace ? "Copy Race" : "Create Race";

   const handleSubmit = async () => {
     if (!form.name.trim()) {
       setNameError(true);
       return;
     }
     setNameError(false);
     try {
       const payload = buildPayload();
       if (isEditing) {
         await updateRace(editingRace.id, payload);
       } else {
         await createRace(payload);
       }
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
          <h2 className="text-amber-400 font-semibold uppercase tracking-wider text-sm">
            {titleText}
          </h2>
          <button onClick={onClose} className="px-2 text-slate-400 hover:text-slate-100 text-lg">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          <FilterSection title="Basics" defaultOpen>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Stormtouched"
                  className={`${fieldCls} ${nameError ? "border-red-500 ring-1 ring-red-500/40" : ""}`}
                />
                {nameError && <p className="text-xs text-red-400 mt-1">Name is required.</p>}
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">
                  Creature Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {CREATURE_TYPES.map((t) => (
                    <button key={t} type="button" onClick={() => update("creature_type", t)}
                            className={chip(form.creature_type === t)}>
                      {cap(t)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">
                  Size (one or more)
                </label>
                <div className="flex flex-wrap gap-2">
                  {SIZE_ORDER.map((s) => (
                    <button key={s} type="button" onClick={() => toggleSize(s)}
                            className={chip(form.sizes.includes(s))}>
                      {SIZE_LABELS[s] || cap(s)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">
                  Visibility
                </label>
                <div className="flex gap-2">
                  {["private", "public"].map((v) => (
                    <button key={v} type="button" onClick={() => update("visibility", v)}
                            className={chip(form.visibility === v)}>
                      {cap(v)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </FilterSection>

          <FilterSection title="Speed">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                ["walk", "Walk (default 30)"],
                ["fly", "Fly"],
                ["swim", "Swim"],
                ["climb", "Climb"],
                ["burrow", "Burrow"],
              ].map(([k, label]) => (
                <div key={k}>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">
                    {label}
                  </label>
                  <input
                    type="number" min={0} step={5}
                    value={form[k]}
                    onChange={(e) => update(k, e.target.value)}
                    onBlur={(e) => update(k, clampStep5(e.target.value))}
                    className={fieldCls}
                  />
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

          <FilterSection title="Senses">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {["darkvision", "tremorsense", "blindsight", "truesight"].map((s) => (
                <div key={s}>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">
                    {cap(s)}
                  </label>
                  <input
                    type="number" min={0} step={5}
                    value={form[s]}
                    onChange={(e) => update(s, e.target.value)}
                    onBlur={(e) => update(s, clampStep5(e.target.value))}
                    className={fieldCls}
                  />
                </div>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Ability Score Increase">
            <p className="text-xs text-slate-500 mb-2">
              Default is 10. Anything above 10 is a bonus, below is a penalty.
            </p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {ABILITIES.map((a) => (
                <div key={a}>
                  <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1 text-center">
                    {a.toUpperCase()}
                  </label>
                  <input
                    type="number" min={0}
                    value={form.asi[a]}
                    onChange={(e) => updateAsi(a, e.target.value)}
                    className={`${fieldCls} text-center`}
                  />
                </div>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Defenses & Proficiencies">
            <div className="space-y-2">
              <CollapsibleChips
                label="Damage Resistances" options={DAMAGE_TYPES}
                selected={form.resistances}
                onToggle={(v) => toggleListItem("resistances", v)} />
              <CollapsibleChips
                label="Damage Immunities" options={DAMAGE_TYPES}
                selected={form.immunities}
                onToggle={(v) => toggleListItem("immunities", v)} />
              <CollapsibleChips
                label="Damage Vulnerabilities" options={DAMAGE_TYPES}
                selected={form.vulnerabilities}
                onToggle={(v) => toggleListItem("vulnerabilities", v)} />
              <CollapsibleChips
                label="Condition Advantages" options={CONDITION_OPTIONS}
                selected={form.condition_advantages}
                onToggle={(v) => toggleListItem("condition_advantages", v)} />
              <CollapsibleChips
                label="Languages" options={LANGUAGE_OPTIONS}
                selected={form.languages_fixed}
                onToggle={(v) => toggleListItem("languages_fixed", v)} />
              <CollapsibleChips
                label="Skills" options={skillKeys}
                selected={form.skills_fixed}
                onToggle={(v) => toggleListItem("skills_fixed", v)}
                renderOption={(k) => SKILL_OPTIONS[k]?.label || k} />
              <CollapsibleChips
                label="Tools" options={TOOL_OPTIONS}
                selected={form.tools_fixed}
                onToggle={(v) => toggleListItem("tools_fixed", v)} />
              <CollapsibleChips
                label="Weapons" options={WEAPON_OPTIONS}
                selected={form.weapons_fixed}
                onToggle={(v) => toggleListItem("weapons_fixed", v)} />
              <CollapsibleChips
                label="Armor" options={ARMOR_OPTIONS}
                selected={form.armor_fixed}
                onToggle={(v) => toggleListItem("armor_fixed", v)} />
            </div>
          </FilterSection>

          <FilterSection title="Traits">
            <div className="space-y-2">
              {form.traits.map((t, idx) => (
                <div key={idx} className="border border-slate-700 rounded p-2 space-y-2">
                  <div className="flex gap-2 items-start">
                    <input type="text" placeholder="Trait name" value={t.name}
                           onChange={(e) => updateTrait(idx, "name", e.target.value)}
                           className={fieldCls} />
                    <button onClick={() => removeTrait(idx)}
                            className="text-[11px] px-2 py-1 rounded border border-red-700/50 text-red-300 hover:bg-red-900/40">
                      Remove
                    </button>
                  </div>
                  <textarea placeholder="Description" value={t.notes}
                            onChange={(e) => updateTrait(idx, "notes", e.target.value)}
                            rows={3} className={fieldCls} />
                </div>
              ))}
              <button onClick={addTrait}
                      className="text-[11px] px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:border-amber-500/40 hover:text-amber-300">
                + Add Trait
              </button>
            </div>
          </FilterSection>

          <FilterSection title="Spells">
            <div className="space-y-2">
              {form.spells.map((sp, idx) => (
                <div key={idx} className="border border-slate-700 rounded p-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase tracking-wider text-amber-400">
                      Spell {idx + 1}
                    </span>
                    <button onClick={() => removeSpell(idx)}
                            className="text-[11px] px-2 py-1 rounded border border-red-700/50 text-red-300 hover:bg-red-900/40">
                      ✕
                    </button>
                  </div>

                  <SpellPicker
                    options={xphbSpellNames}
                    value={sp.name}
                    onSelect={(name) => updateSpell(idx, "name", name)}
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Level Avail.</div>
                      <input type="number" min={1} value={sp.level_available}
                             onChange={(e) => updateSpell(idx, "level_available", e.target.value)}
                             className={fieldCls} />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Uses</div>
                      <select value={sp.uses_type}
                              onChange={(e) => updateSpell(idx, "uses_type", e.target.value)}
                              className={fieldCls}>
                        <option value="at_will">At Will</option>
                        <option value="per_long_rest">Per Long Rest</option>
                        <option value="per_short_rest">Per Short Rest</option>
                      </select>
                    </div>
                    {sp.uses_type !== "at_will" && (
                      <div>
                        <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Count</div>
                        <input type="number" min={1} value={sp.uses_count}
                               onChange={(e) => updateSpell(idx, "uses_count", e.target.value)}
                               className={fieldCls} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-end gap-3 mt-2">
                <button onClick={addSpell}
                        className="text-[11px] px-3 py-1.5 rounded border border-slate-600 text-slate-300 hover:border-amber-500/40 hover:text-amber-300">
                  + Add Spell
                </button>
                {form.spells.length > 0 && (
                  <div>
                    <div className="text-[10px] text-slate-400 mb-0.5 uppercase">Spellcasting Ability</div>
                    <select value={form.spell_ability}
                            onChange={(e) => update("spell_ability", e.target.value)}
                            className={fieldCls}>
                      <option value="">—</option>
                      {ABILITIES.map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </FilterSection>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-700">
          {createError ? (
            <span className="text-xs text-red-400 truncate flex-1">{createError}</span>
          ) : <span className="flex-1" />}
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

// ─── Collapsible chip multi-select (closed by default) ────────────
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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 uppercase tracking-wider text-amber-400
                   text-[10px] mb-1 hover:text-amber-300 transition select-none"
      >
        <span className={`text-[10px] inline-block transition-transform duration-150
                          ${open ? "rotate-90" : ""}`}>
          ▶
        </span>
        <span>{label}</span>
        {selected.length > 0 && (
          <span className="ml-1 text-amber-300 normal-case">({selected.length})</span>
        )}
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 pl-3 mb-2">
          {options.map((opt) => (
            <button key={opt} type="button" onClick={() => onToggle(opt)}
                    className={chip(selected.includes(opt))}>
              {display(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Spell picker — search + filtered chips, single-select ────────
function SpellPicker({ options, value, onSelect }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return []; // cap initial view for performance
    return options.filter((n) => n.toLowerCase().includes(q));
  }, [query, options]);

  const chip = (active) =>
    `text-[11px] px-2 py-1 rounded border transition
     ${active
       ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
       : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-300"}`;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-[10px] uppercase tracking-wider text-amber-400">
          Spell {value ? `· selected: ${value}` : ""}
        </label>
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={options.length ? "Search spells…" : "Loading spells…"}
        className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-100 text-sm w-full mb-2
                   focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
      />
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
        {filtered.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onSelect(name)}
            className={chip(value === name)}
          >
            {name}
          </button>
        ))}
        {filtered.length === 0 && (
          <span className="text-[11px] text-slate-500">No matches.</span>
        )}
      </div>
    </div>
  );
}