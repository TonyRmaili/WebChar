import React, { useEffect, useState, useMemo } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import { ErrorLine, LoadingLine, SortControl, Toolbar, chip, searchCls } from "../catalogueStyle";
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

// A line of filter words in the filter popup.
const Words = ({ children }) => <div className="flex flex-wrap gap-x-4 gap-y-1.5">{children}</div>;

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

  useEffect(() => {
    loadSpells();
  }, [loadSpells]);

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

  const toggle = (setter) => (val) => setter((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));

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
    spells,
    classList,
    componentPredicates,
    query,
    selectedSources,
    selectedSchools,
    selectedLevels,
    selectedClasses,
    selectedAreaTags,
    selectedDamage,
    selectedComponents,
    selectedActionTypes,
    ritualOnly,
    concentrationOnly,
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

  return (
    <div className="min-h-[640px] w-full">
      {error && <ErrorLine>{error}</ErrorLine>}

      {loading ? (
        <LoadingLine>Fetching spells…</LoadingLine>
      ) : (
        <>
          <Toolbar
            filters={<FilterButton activeCount={activeCount} onClick={() => setFiltersOpen(true)} />}
            search={<input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search spells…" className={searchCls} />}
            sort={<SortControl label="sort by level" value={sortDir} onChange={setSortDir} />}
            right={
              <span className="text-xs italic text-ink-faded">
                {sorted.length} of {spells.length}
              </span>
            }
          />

          <FilterPopup open={filtersOpen} onClose={() => setFiltersOpen(false)} activeCount={activeCount} onClear={clearAll}>
            <FilterSection title="Sources">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                {sources.map((source) => (
                  <button key={source} onClick={() => toggleSource(source)} title={formatSource(source)} className={`${chip(selectedSources.includes(source))} truncate`}>
                    {formatSource(source)}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="School">
              <Words>
                {schools.map((s) => (
                  <button key={s} onClick={() => toggleSchool(s)} className={chip(selectedSchools.includes(s))}>
                    {cap(s)}
                  </button>
                ))}
              </Words>
            </FilterSection>

            <FilterSection title="Level">
              <Words>
                {LEVEL_OPTIONS.map((lvl) => (
                  <button key={lvl} onClick={() => toggleLevel(lvl)} className={chip(selectedLevels.includes(lvl))}>
                    {formatLevelChip(lvl)}
                  </button>
                ))}
              </Words>
            </FilterSection>

            <FilterSection title="Class">
              <Words>
                {classes.map((c) => (
                  <button key={c} onClick={() => toggleClass(c)} className={chip(selectedClasses.includes(c))}>
                    {c}
                  </button>
                ))}
              </Words>
            </FilterSection>

            {damageTypes.length > 0 && (
              <FilterSection title="Damage Types">
                <Words>
                  {damageTypes.map((d) => (
                    <button key={d} onClick={() => toggleDamage(d)} className={chip(selectedDamage.includes(d))}>
                      {cap(d)}
                    </button>
                  ))}
                </Words>
              </FilterSection>
            )}

            <FilterSection title="Components">
              <Words>
                {COMPONENT_OPTIONS.map((o) => (
                  <button key={o.value} onClick={() => toggleComponent(o.value)} className={chip(selectedComponents.includes(o.value))}>
                    {o.label}
                  </button>
                ))}
              </Words>
            </FilterSection>

            <FilterSection title="Action Type">
              <Words>
                {ACTION_TYPES.map((o) => (
                  <button key={o.value} onClick={() => toggleActionType(o.value)} className={chip(selectedActionTypes.includes(o.value))}>
                    {o.label}
                  </button>
                ))}
              </Words>
            </FilterSection>

            <FilterSection title="Casting">
              <Words>
                <button onClick={() => setRitualOnly((v) => !v)} className={chip(ritualOnly)}>
                  Ritual only
                </button>
                <button onClick={() => setConcentrationOnly((v) => !v)} className={chip(concentrationOnly)}>
                  Concentration only
                </button>
              </Words>
            </FilterSection>

            <FilterSection title="Area">
              <Words>
                {areaTags.map((t) => (
                  <button key={t} onClick={() => toggleAreaTag(t)} className={chip(selectedAreaTags.includes(t))}>
                    {cap(tidy(t))}
                  </button>
                ))}
              </Words>
            </FilterSection>
          </FilterPopup>

          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((sp, idx) => (
              <SpellRow key={`${sp.name}-${sp.source}-${idx}`} spell={sp} onOpen={(spell) => openPopup("spell", spell)} />
            ))}
          </div>
          {sorted.length === 0 && <LoadingLine>No spells match.</LoadingLine>}
        </>
      )}
    </div>
  );
}