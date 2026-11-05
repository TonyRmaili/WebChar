import React, { useEffect, useState, useMemo } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import {
  formatSource,
  collectUnique,
  getSpellClasses,
  LEVEL_OPTIONS,
  formatLevelChip,
  getSpellDamageTypes,
  isSpellRitual,
  isSpellConcentration,
  getSpellActionType,
  ACTION_TYPES,
  COMPONENT_OPTIONS,
} from "./spellHelpers";
import SpellRow from "./SpellRow";
import { usePopupStore } from "../../../store/PopupStore";

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const tidy = (s) => String(s).replace(/_/g, " ");

export default function Spells() {
  const spellsData = useCatalogueStore((s) => s.spellsData);
  const loading = useCatalogueStore((s) => s.loadingSpells);
  const error = useCatalogueStore((s) => s.error);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);

  const spells = spellsData?.spells || [];
  const classList = spellsData?.class_list || {};

  const [selectedSources, setSelectedSources] = useState([]);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [selectedAreaTags, setSelectedAreaTags] = useState([]);
  const [selectedDamage, setSelectedDamage] = useState([]);
  const [selectedComponents, setSelectedComponents] = useState([]);
  const [selectedActionTypes, setSelectedActionTypes] = useState([]);
  const [ritualOnly, setRitualOnly] = useState(false);
  const [concentrationOnly, setConcentrationOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // null | "asc" | "desc"
  const [sortDir, setSortDir] = useState(null);

  const openPopup = usePopupStore((s) => s.open);

  useEffect(() => { loadSpells(); }, [loadSpells]);

  const sources = useMemo(() => collectUnique(spells, "source"), [spells]);
  const schools = useMemo(() => collectUnique(spells, "school"), [spells]);
  const areaTags = useMemo(() => collectUnique(spells, "area_tags"), [spells]);

  // Derive damage types from data so the filter reflects what's actually there.
  const damageTypes = useMemo(() => {
    const set = new Set();
    for (const sp of spells) {
      for (const d of getSpellDamageTypes(sp)) set.add(d);
    }
    return [...set].sort();
  }, [spells]);

  const classes = useMemo(() => {
    const set = new Set();
    for (const arr of Object.values(classList)) {
      for (const c of arr) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [classList]);

  const toggle = (setter) => (val) =>
    setter((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );

  const toggleSource = toggle(setSelectedSources);
  const toggleSchool = toggle(setSelectedSchools);
  const toggleLevel = toggle(setSelectedLevels);
  const toggleClass = toggle(setSelectedClasses);
  const toggleAreaTag = toggle(setSelectedAreaTags);
  const toggleDamage = toggle(setSelectedDamage);
  const toggleComponent = toggle(setSelectedComponents);
  const toggleActionType = toggle(setSelectedActionTypes);

  // Lookup for component predicates so the filter loop stays tight.
  const componentPredicates = useMemo(() => {
    const m = {};
    for (const opt of COMPONENT_OPTIONS) m[opt.value] = opt.test;
    return m;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spells.filter((sp) => {
      if (selectedSources.length > 0 && !selectedSources.includes(sp.source)) return false;
      if (selectedSchools.length > 0 && !selectedSchools.includes(sp.school)) return false;
      if (selectedLevels.length > 0 && !selectedLevels.includes(sp.level)) return false;
      if (selectedAreaTags.length > 0) {
        const tags = sp.area_tags || [];
        if (!selectedAreaTags.some((t) => tags.includes(t))) return false;
      }
      if (selectedClasses.length > 0) {
        const spClasses = getSpellClasses(sp, classList);
        if (!selectedClasses.some((c) => spClasses.includes(c))) return false;
      }
      if (selectedDamage.length > 0) {
        const dt = getSpellDamageTypes(sp);
        if (!selectedDamage.some((d) => dt.includes(d))) return false;
      }
      if (selectedComponents.length > 0) {
        const c = sp.components;
        if (!selectedComponents.some((k) => componentPredicates[k]?.(c))) return false;
      }
      if (selectedActionTypes.length > 0) {
        if (!selectedActionTypes.includes(getSpellActionType(sp))) return false;
      }
      if (ritualOnly && !isSpellRitual(sp)) return false;
      if (concentrationOnly && !isSpellConcentration(sp)) return false;
      if (q && !sp.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [
    spells, classList, componentPredicates, query,
    selectedSources, selectedSchools, selectedLevels,
    selectedClasses, selectedAreaTags, selectedDamage,
    selectedComponents, selectedActionTypes,
    ritualOnly, concentrationOnly,
  ]);

  // Sort by level (cantrips = 0). Null/undefined levels sink to end.
  const sorted = useMemo(() => {
    if (!sortDir) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = typeof a?.level === "number" ? a.level : null;
      const bv = typeof b?.level === "number" ? b.level : null;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }, [filtered, sortDir]);

  const clearAll = () => {
    setSelectedSources([]);
    setSelectedSchools([]);
    setSelectedLevels([]);
    setSelectedClasses([]);
    setSelectedAreaTags([]);
    setSelectedDamage([]);
    setSelectedComponents([]);
    setSelectedActionTypes([]);
    setRitualOnly(false);
    setConcentrationOnly(false);
    setQuery("");
  };

  const activeCount =
    selectedSources.length +
    selectedSchools.length +
    selectedLevels.length +
    selectedClasses.length +
    selectedAreaTags.length +
    selectedDamage.length +
    selectedComponents.length +
    selectedActionTypes.length +
    (ritualOnly ? 1 : 0) +
    (concentrationOnly ? 1 : 0);

  const chip = (active) =>
    `text-[11px] px-2 py-1 rounded border transition
     ${active
       ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
       : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-300"}`;

  const sortBtn = (active) =>
    `px-2 py-1 rounded border transition text-xs leading-none
     ${active
       ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
       : "bg-slate-800/60 border-slate-700 text-slate-400 hover:border-amber-500/40 hover:text-amber-300"}`;

  return (
    <div className="w-full bg-slate-900/40 p-4 min-h-[640px]">
      {error && (
        <div className="mb-3 p-2 rounded border border-red-700 bg-red-900/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {!loading && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <FilterButton activeCount={activeCount} onClick={() => setFiltersOpen(true)} />

            <div className="flex-1 max-w-sm">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search spells…"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm
                           focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition"
              />
            </div>

            {/* Sort by Level */}
            <div className="ml-auto flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-1">
                Sort by Level
              </span>
              <button
                onClick={() => setSortDir(sortDir === "asc" ? null : "asc")}
                title="Sort ascending"
                aria-label="Sort ascending"
                className={sortBtn(sortDir === "asc")}
              >
                ↑
              </button>
              <button
                onClick={() => setSortDir(sortDir === "desc" ? null : "desc")}
                title="Sort descending"
                aria-label="Sort descending"
                className={sortBtn(sortDir === "desc")}
              >
                ↓
              </button>
            </div>
          </div>

          <FilterPopup
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            activeCount={activeCount}
            onClear={clearAll}
          >
            <FilterSection title="Sources">
              <div className="grid grid-cols-9 gap-2">
                {sources.map((source) => (
                  <button
                    key={source}
                    onClick={() => toggleSource(source)}
                    title={formatSource(source)}
                    className={`${chip(selectedSources.includes(source))} text-center truncate`}
                  >
                    {formatSource(source)}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="School">
              <div className="flex flex-wrap gap-2">
                {schools.map((s) => (
                  <button key={s} onClick={() => toggleSchool(s)} className={chip(selectedSchools.includes(s))}>
                    {cap(s)}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Level">
              <div className="flex flex-wrap gap-2">
                {LEVEL_OPTIONS.map((lvl) => (
                  <button key={lvl} onClick={() => toggleLevel(lvl)} className={chip(selectedLevels.includes(lvl))}>
                    {formatLevelChip(lvl)}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Class">
              <div className="flex flex-wrap gap-2">
                {classes.map((c) => (
                  <button key={c} onClick={() => toggleClass(c)} className={chip(selectedClasses.includes(c))}>
                    {c}
                  </button>
                ))}
              </div>
            </FilterSection>

            {damageTypes.length > 0 && (
              <FilterSection title="Damage Types">
                <div className="flex flex-wrap gap-2">
                  {damageTypes.map((d) => (
                    <button key={d} onClick={() => toggleDamage(d)} className={chip(selectedDamage.includes(d))}>
                      {cap(d)}
                    </button>
                  ))}
                </div>
              </FilterSection>
            )}

            <FilterSection title="Components">
              <div className="flex flex-wrap gap-2">
                {COMPONENT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => toggleComponent(o.value)}
                    className={chip(selectedComponents.includes(o.value))}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Action Type">
              <div className="flex flex-wrap gap-2">
                {ACTION_TYPES.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => toggleActionType(o.value)}
                    className={chip(selectedActionTypes.includes(o.value))}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Casting">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setRitualOnly((v) => !v)} className={chip(ritualOnly)}>
                  Ritual only
                </button>
                <button onClick={() => setConcentrationOnly((v) => !v)} className={chip(concentrationOnly)}>
                  Concentration only
                </button>
              </div>
            </FilterSection>

            <FilterSection title="Area">
              <div className="flex flex-wrap gap-2">
                {areaTags.map((t) => (
                  <button key={t} onClick={() => toggleAreaTag(t)} className={chip(selectedAreaTags.includes(t))}>
                    {cap(tidy(t))}
                  </button>
                ))}
              </div>
            </FilterSection>
          </FilterPopup>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-2 gap-y-1">
            {sorted.map((sp, idx) => (
              <SpellRow
                key={`${sp.name}-${sp.source}-${idx}`}
                spell={sp}
                onOpen={(spell) => openPopup("spell", spell)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}