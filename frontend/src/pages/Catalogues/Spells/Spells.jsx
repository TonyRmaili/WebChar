import React, { useEffect, useMemo, useState } from "react";
import useStoredState from "../../../utils/useStoredState";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import SpellCardForm from "./SpellCardForm";
import { ErrorLine, LoadingLine, SortControl, Toolbar, searchCls } from "../catalogueStyle";
import { CatalogueRow, ChipToggles, FoldChips, useEntryMenu } from "../catalogueParts";
import { addBtn } from "../../../styles/parchmentForm";
import {
  HOMEBREW, EDITIONS, ABILITY_SHORT, SPELL_SCHOOLS, formatEdition, formatSource, labelFromId, titleCase,
  collectUnique, toggleIn, matchesQuery, passesAny, byName,
} from "../catalogueHelpers";
import {
  LEVELS, TIME_UNITS, CASTING_LABELS, COMPONENT_LABELS, GIVES_LABELS, formatLevel, spellArea, spellAttack, spellCasting,
  spellClasses, spellComponents, spellConditions, spellDamage, spellGives, spellRowMeta, spellSaves, spellTimes,
} from "./spellHelpers";

const inOrder = (order) => (found) => order.filter((x) => found.includes(x));

/* The Spells catalogue. Every filter offers only values the loaded spells
   have; damage, saves, conditions and attacks are read from the spell's
   numbers as well as from the book's tags, so homebrew is found the same
   way. Class filters by the class's name, whichever book it's from.
   Sort by level or by name. */
export default function Spells() {
  const spells = useCatalogueStore((s) => s.spells);
  const loading = useCatalogueStore((s) => s.loadingSpells);
  const error = useCatalogueStore((s) => s.spellsError);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);
  const deleteSpell = useCatalogueStore((s) => s.deleteSpell);

  const openPopup = usePopupStore((s) => s.open);
  const currentUser = useAuthStore((s) => s.userData?.name);

  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortDir, setSortDir] = useState(null);
  const [picked, setPicked] = useStoredState("catalogue.spells.picked", {}); // filter key → selected values

  const [form, setForm] = useState(null); // null = closed · {} new · { editing } · { copyFrom }
  const [openMenu, menu] = useEntryMenu({
    user: currentUser,
    onCopy: (sp) => setForm({ copyFrom: sp }),
    onEdit: (sp) => setForm({ editing: sp }),
    onDelete: deleteSpell,
  });

  useEffect(() => {
    if (!spells?.length) loadSpells();
  }, [loadSpells]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Every chip filter: how to read its values from a spell, how to name
     them, and whether its section starts open. Edition starts on "one". */
  const FILTERS = useMemo(
    () => [
      { key: "edition", title: "Edition", read: (sp) => [sp.edition], options: () => EDITIONS, label: formatEdition, open: true },
      { key: "source", title: "Sources", read: (sp) => [sp.source], label: formatSource, grid: true },
      { key: "level", title: "Level", read: (sp) => [sp.level], options: inOrder(LEVELS), label: formatLevel, open: true },
      { key: "school", title: "School", read: (sp) => [sp.school], options: inOrder(SPELL_SCHOOLS), label: titleCase, open: true },
      { key: "class", title: "Class", read: spellClasses, label: (c) => c, open: true },
      { key: "time", title: "Casting Time", read: spellTimes, options: inOrder(TIME_UNITS), label: labelFromId },
      { key: "casting", title: "Casting", read: spellCasting, options: inOrder(Object.keys(CASTING_LABELS)), label: (k) => CASTING_LABELS[k] },
      { key: "components", title: "Components", read: spellComponents, options: inOrder(Object.keys(COMPONENT_LABELS)), label: (k) => COMPONENT_LABELS[k] },
      { key: "damage", title: "Damage", read: spellDamage, label: titleCase },
      { key: "saves", title: "Saving Throw", read: spellSaves, label: (a) => ABILITY_SHORT[a] || titleCase(a) },
      { key: "conditions", title: "Conditions", read: spellConditions, label: titleCase },
      { key: "attack", title: "Attack Roll", read: spellAttack, label: titleCase },
      { key: "area", title: "Area", read: spellArea, label: labelFromId },
      { key: "checks", title: "Ability Check", read: (sp) => sp.filters?.checks, label: (a) => ABILITY_SHORT[a] || titleCase(a) },
      { key: "creatures", title: "Creature Types", read: (sp) => sp.filters?.creature_types, label: titleCase },
      { key: "gives", title: "Gives", read: spellGives, options: inOrder(Object.keys(GIVES_LABELS)), label: (k) => GIVES_LABELS[k] },
      { key: "tags", title: "Tags", read: (sp) => sp.filters?.tags, label: labelFromId },
    ],
    []
  );

  // What each filter offers: only values some spell has.
  const options = useMemo(() => {
    const out = {};
    for (const f of FILTERS) {
      const found = collectUnique(spells, f.read);
      out[f.key] = f.options ? f.options(found) : f.key === "source" && !found.includes(HOMEBREW) ? [HOMEBREW, ...found] : found;
    }
    return out;
  }, [spells, FILTERS]);

  const selected = (key) => picked[key] ?? (key === "edition" ? ["one"] : []);
  // from the latest picks (a chip turned from "show" to "hide" changes two values at once)
  const toggle = (key) => (v) => setPicked((p) => ({ ...p, [key]: toggleIn(p[key] ?? (key === "edition" ? ["one"] : []), v) }));

  const filtered = useMemo(() => {
    const rows = (spells || []).filter((sp) => FILTERS.every((f) => passesAny(selected(f.key), f.read(sp))) && matchesQuery(sp, query));
    if (!sortDir) return rows.sort(byName);
    const dir = sortDir === "asc" ? 1 : -1;
    return rows.sort((a, b) => ((a.level ?? 0) - (b.level ?? 0)) * dir || byName(a, b));
  }, [spells, FILTERS, picked, query, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCount = FILTERS.reduce((n, f) => n + selected(f.key).length, 0);
  const clearAll = () => {
    setPicked(Object.fromEntries(FILTERS.map((f) => [f.key, []])));
    setQuery("");
  };

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
              <>
                <span className="text-xs italic text-ink-faded">
                  {filtered.length} of {spells.length}
                </span>
                <button type="button" onClick={() => setForm({})} className={`${addBtn} !text-sm`}>
                  + create
                </button>
              </>
            }
          />

          <FilterPopup open={filtersOpen} onClose={() => setFiltersOpen(false)} activeCount={activeCount} onClear={clearAll}>
            {FILTERS.map((f) =>
              options[f.key]?.length ? (
                <FilterSection key={f.key} title={f.title} defaultOpen={!!f.open}>
                  {options[f.key].length > 24 && !f.grid ? (
                    <FoldChips label={`${options[f.key].length} to choose from`} options={options[f.key]} selected={selected(f.key)}
                               labelOf={f.label} onToggle={toggle(f.key)} defaultOpen />
                  ) : (
                    <ChipToggles options={options[f.key]} selected={selected(f.key)} labelOf={f.label} onToggle={toggle(f.key)}
                                 className={f.grid ? "!grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : ""} />
                  )}
                </FilterSection>
              ) : null
            )}
          </FilterPopup>

          {filtered.length === 0 ? (
            <LoadingLine>No spells match your filters.</LoadingLine>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((sp) => (
                <CatalogueRow key={`${sp.id}-${sp.visibility || ""}`} entry={sp} meta={spellRowMeta(sp)}
                              onOpen={(x) => openPopup("spell", x)} onContextMenu={openMenu} />
              ))}
            </div>
          )}

          {menu}

          <SpellCardForm open={form !== null} onClose={() => setForm(null)}
                         editingSpell={form?.editing || null} copyFromSpell={form?.copyFrom || null} />
        </>
      )}
    </div>
  );
}
