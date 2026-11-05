import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import { SKILL_OPTIONS, TOOL_OPTIONS, LANGUAGE_OPTIONS } from "../../../utils/Constants";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const skillKeys = Object.keys(SKILL_OPTIONS);
const LANGUAGE_TOKENS = ["standard", "any", ...LANGUAGE_OPTIONS];
const SPELL_LEVELS = [
  ["s0", "Cantrips"], ["s1", "1st"], ["s2", "2nd"], ["s3", "3rd"], ["s4", "4th"],
  ["s5", "5th"], ["s6", "6th"], ["s7", "7th"], ["s8", "8th"], ["s9", "9th"],
];
const cap = (s) => (typeof s === "string" && s ? s[0].toUpperCase() + s.slice(1) : s);
const numOrNull = (v) => { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

const emptySpells = () => SPELL_LEVELS.reduce((o, [k]) => ((o[k] = []), o), {});

const DEFAULT_STATE = {
  name: "", visibility: "private",
  entries: "",
  feats: [],
  asi: [],            // lowercased ability strings
  skill_fixed: [], skill_from: [], skill_count: "1",
  tool_fixed: [], tool_from: [], tool_count: "1",
  lang_fixed: [], lang_from: [], lang_count: "1",
  equipment_items: [], equipment_gold: "",
  spells: emptySpells(),
};

export default function BackgroundCreatePopup({ open, onClose, editingBackground, copyFromBackground }) {
  const createBackground = useCatalogueStore((s) => s.createBackground);
  const updateBackground = useCatalogueStore((s) => s.updateBackground);
  const creating = useCatalogueStore((s) => s.creatingBackground);
  const createError = useCatalogueStore((s) => s.createBackgroundError);

  const featsData = useCatalogueStore((s) => s.featsData);
  const items = useCatalogueStore((s) => s.items);
  const loadItems = useCatalogueStore((s) => s.loadItems);
  const loadFeats = useCatalogueStore((s) => s.loadFeats);
  const spellsData = useCatalogueStore((s) => s.spellsData);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);

  const [form, setForm] = useState(DEFAULT_STATE);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!Array.isArray(items) || items.length === 0) loadItems();
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
    const src = editingBackground || copyFromBackground;
    if (!src) { setForm(DEFAULT_STATE); return; }

    const entryText = typeof src.entries === "string" ? src.entries : (src.cleaned_entries?.entries || "");
    const prof = (o) => ({
      fixed: o?.fixed || [],
      from: o?.choose?.from || [],
      count: o?.choose?.count != null ? String(o.choose.count) : "1",
    });
    const sk = prof(src.skill_proficiencies), tl = prof(src.tool_proficiencies), lg = prof(src.language_proficiencies);

    // equipment
    const eqItems = []; let gold = "";
    const group = Array.isArray(src.starting_equipment) ? src.starting_equipment[0]?.["_"] : null;
    if (Array.isArray(group)) {
      for (const el of group) {
        if (typeof el === "string") eqItems.push(el);
        else if (el?.item === "pouch" && el.containsValue != null) gold = String(el.containsValue / 100);
        else if (el?.item) eqItems.push(el.item);
      }
    }

    // spells
    const spells = emptySpells();
    const expanded = Array.isArray(src.additional_spells) ? src.additional_spells[0]?.expanded : null;
    if (expanded && typeof expanded === "object") {
      for (const [lvl, names] of Object.entries(expanded)) {
        if (spells[lvl]) spells[lvl] = (names || []).map((n) => String(n).split("#")[0]);
      }
    }

    setForm({
      ...DEFAULT_STATE,
      name: copyFromBackground ? `${src.name} (copy)` : src.name || "",
      visibility: copyFromBackground ? "private" : (src.visibility || "private"),
      entries: entryText,
      feats: Array.isArray(src.feats) ? src.feats : [],
      asi: Array.isArray(src.ability_score_increase) ? src.ability_score_increase.map((a) => String(a).toLowerCase()) : [],
      skill_fixed: sk.fixed, skill_from: sk.from, skill_count: sk.count,
      tool_fixed: tl.fixed, tool_from: tl.from, tool_count: tl.count,
      lang_fixed: lg.fixed, lang_from: lg.from, lang_count: lg.count,
      equipment_items: eqItems, equipment_gold: gold,
      spells,
    });
  }, [open, editingBackground, copyFromBackground]);

  const xphbSpellNames = useMemo(() => {
    const list = spellsData?.spells;
    if (!Array.isArray(list)) return [];
    return [...new Set(list.filter((s) => s?.source === "XPHB" && s?.name).map((s) => s.name))]
      .sort((a, b) => a.localeCompare(b));
  }, [spellsData]);

  const itemNames = useMemo(() => {
    const names = (items || []).map((it) => it?.name).filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const featNames = useMemo(() => {
    const names = (featsData?.feats || []).map((f) => f?.name).filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [featsData]);

  if (!open) return null;

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const toggleListItem = (key, val) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val] }));
  const toggleSpell = (lvl, name) =>
    setForm((f) => {
      const cur = f.spells[lvl] || [];
      const next = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name];
      return { ...f, spells: { ...f.spells, [lvl]: next } };
    });

  const buildProf = (fixed, from, count, lower = true) => {
    const fx = lower ? fixed.map((x) => x.toLowerCase()) : fixed;
    const fr = lower ? from.map((x) => x.toLowerCase()) : from;
    return { fixed: fx, choose: fr.length ? { from: fr, count: Number(count) || 1 } : null };
  };

  const buildPayload = () => {
    const eq = form.equipment_items.map((n) => ({ item: n.toLowerCase() }));
    const gold = numOrNull(form.equipment_gold);
    if (gold != null && gold > 0) eq.push({ item: "pouch", containsValue: gold * 100 });

    const expanded = {};
    for (const [lvl] of SPELL_LEVELS) {
      const names = (form.spells[lvl] || []).map((n) => n.trim().toLowerCase()).filter(Boolean);
      if (names.length) expanded[lvl] = names;
    }

    return {
      name: form.name.trim(),
      source: "HOMEBREW",
      visibility: form.visibility,
      entries: form.entries,
      feats: form.feats.map((f) => f.toLowerCase()),
      ability_score_increase: [...new Set(form.asi)],
      skill_proficiencies: buildProf(form.skill_fixed, form.skill_from, form.skill_count, false),
      tool_proficiencies: buildProf(form.tool_fixed, form.tool_from, form.tool_count),
      language_proficiencies: buildProf(form.lang_fixed, form.lang_from, form.lang_count),
      starting_equipment: eq.length ? [{ "_": eq }] : [],
      additional_spells: Object.keys(expanded).length ? [{ expanded }] : [],
    };
  };

  const isEditing = !!editingBackground;
  const titleText = isEditing ? "Edit Background" : copyFromBackground ? "Copy Background" : "Create Background";

  const handleSubmit = async () => {
    if (!form.name.trim()) { setNameError(true); return; }
    setNameError(false);
    try {
      const payload = buildPayload();
      if (isEditing) await updateBackground(editingBackground.id, payload);
      else await createBackground(payload);
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
                       placeholder="e.g. Far Traveler"
                       className={`${fieldCls} ${nameError ? "border-red-500 ring-1 ring-red-500/40" : ""}`} />
                {nameError && <p className="text-xs text-red-400 mt-1">Name is required.</p>}
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
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Ability Scores</label>
                <div className="flex flex-wrap gap-2">
                  {ABILITIES.map((a) => (
                    <button key={a} type="button" onClick={() => toggleListItem("asi", a)} className={chip(form.asi.includes(a))}>
                      {a.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Origin Feat(s)</label>
                <MultiNamePicker options={featNames} selected={form.feats}
                                 onToggle={(n) => toggleListItem("feats", n)} placeholder="Search feats…" />
              </div>
            </div>
          </FilterSection>

          {/* Description */}
          <FilterSection title="Description" defaultOpen>
            <textarea value={form.entries} onChange={(e) => update("entries", e.target.value)} rows={8}
                      className={fieldCls} placeholder={"Use ## for headings.\n\n## Feature: Wanderer\nYou have an excellent memory..."} />
            <p className="text-[10px] text-slate-500 mt-1">
              Markdown-lite: <code>## Heading</code>, <code>- **Label** value</code> lists, blank line between paragraphs, pipe tables.
            </p>
          </FilterSection>

          {/* Proficiencies */}
          <FilterSection title="Proficiencies">
            <div className="space-y-3">
              <ProfBuilder label="Skills" options={skillKeys} renderOption={(k) => SKILL_OPTIONS[k]?.label || k}
                fixed={form.skill_fixed} from={form.skill_from} count={form.skill_count}
                onToggleFixed={(v) => toggleListItem("skill_fixed", v)}
                onToggleFrom={(v) => toggleListItem("skill_from", v)}
                onCount={(v) => update("skill_count", v)} chip={chip} fieldCls={fieldCls} />
              <ProfBuilder label="Tools" options={TOOL_OPTIONS}
                fixed={form.tool_fixed} from={form.tool_from} count={form.tool_count}
                onToggleFixed={(v) => toggleListItem("tool_fixed", v)}
                onToggleFrom={(v) => toggleListItem("tool_from", v)}
                onCount={(v) => update("tool_count", v)} chip={chip} fieldCls={fieldCls} />
              <ProfBuilder label="Languages" options={LANGUAGE_TOKENS}
                fixed={form.lang_fixed} from={form.lang_from} count={form.lang_count}
                onToggleFixed={(v) => toggleListItem("lang_fixed", v)}
                onToggleFrom={(v) => toggleListItem("lang_from", v)}
                onCount={(v) => update("lang_count", v)} chip={chip} fieldCls={fieldCls} />
            </div>
          </FilterSection>

          {/* Equipment */}
          <FilterSection title="Starting Equipment">
            <div className="space-y-3">
              <MultiNamePicker options={itemNames} selected={form.equipment_items}
                               onToggle={(n) => toggleListItem("equipment_items", n)} placeholder="Search items…" />
              <div className="max-w-[140px]">
                <label className="block text-[10px] uppercase tracking-wider text-amber-400 mb-1">Gold (gp)</label>
                <input type="number" min={0} value={form.equipment_gold}
                       onChange={(e) => update("equipment_gold", e.target.value)} className={fieldCls} placeholder="—" />
              </div>
            </div>
          </FilterSection>

          {/* Additional Spells */}
          <FilterSection title="Additional Spells (Expanded List)">
            <div className="space-y-2">
              {SPELL_LEVELS.map(([lvl, label]) => (
                <SpellLevelPickerRow key={lvl} label={label} options={xphbSpellNames}
                  selected={form.spells[lvl] || []} onToggle={(n) => toggleSpell(lvl, n)} />
              ))}
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

/* ─── fixed + choose builder ─── */
function ProfBuilder({ label, options, renderOption, fixed, from, count, onToggleFixed, onToggleFrom, onCount, chip, fieldCls }) {
  const display = renderOption || ((x) => cap(String(x)));
  return (
    <div className="border border-slate-700 rounded p-2 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-amber-400">{label}</div>
      <CollapsibleChips label="Always Granted" options={options} selected={fixed} onToggle={onToggleFixed} renderOption={display} chip={chip} />
      <CollapsibleChips label="Choose From" options={options} selected={from} onToggle={onToggleFrom} renderOption={display} chip={chip} />
      {from.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase text-slate-400">Choose count</span>
          <input type="number" min={1} value={count} onChange={(e) => onCount(e.target.value)} className={`${fieldCls} max-w-[80px]`} />
        </div>
      )}
    </div>
  );
}

/* ─── collapsible finite-option multi-select ─── */
function CollapsibleChips({ label, options, selected, onToggle, renderOption, chip }) {
  const [open, setOpen] = useState(false);
  const display = renderOption || ((x) => cap(String(x)));
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1.5 uppercase tracking-wider text-slate-400 text-[10px] mb-1 hover:text-amber-300 transition select-none">
        <span className={`text-[10px] inline-block transition-transform duration-150 ${open ? "rotate-90" : ""}`}>▶</span>
        <span>{label}</span>
        {selected.length > 0 && <span className="ml-1 text-amber-300 normal-case">({selected.length})</span>}
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 pl-3 mb-1">
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

/* ─── searchable multi-select for large lists (feats, items, spells) ─── */
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

/* ─── one spell-level row ─── */
function SpellLevelPickerRow({ label, options, selected, onToggle }) {
  return (
    <div className="border border-slate-700 rounded p-2">
      <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">{label}</div>
      <MultiNamePicker options={options} selected={selected} onToggle={onToggle} placeholder="Search XPHB spells…" />
    </div>
  );
}