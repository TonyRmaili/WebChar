import React, { useEffect, useMemo, useState } from "react";
import useStoredState from "../../../utils/useStoredState";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import MonsterCardForm from "./MonsterCardForm";
import { ErrorLine, LoadingLine, SortControl, Toolbar, fieldCls, searchCls } from "../catalogueStyle";
import { CatalogueRow, ChipToggles, FoldChips, useEntryMenu } from "../catalogueParts";
import { addBtn } from "../../../styles/parchmentForm";
import {
  HOMEBREW, EDITIONS, ABILITY_SHORT, SIZES, formatEdition, formatSource, labelFromId, titleCase,
  collectUnique, toggleIn, matchesQuery, passesAny, byName,
} from "../catalogueHelpers";
import {
  CR_OPTIONS, HAS_LABELS, crNumber, monsterConditions, monsterDamageDealt, monsterDefenses, monsterDifficulty, monsterHas,
  monsterMovement, monsterRowMeta, monsterSavesForced, monsterSenses, monsterTypes,
} from "./monsterHelpers";

const crCls = `${fieldCls} !w-20`;
const list = (m, key) => m.filters?.[key] || [];

/* The Monsters catalogue. Every filter offers only values the loaded
   monsters have; damage, conditions, saves, senses and movement are read
   from the statblocks as well as from the book's tag lists, so homebrew
   is found the same way. CR min / max also covers level-based statblocks
   (sidekicks); sort by CR or by name. */
export default function Monsters() {
  const monsters = useCatalogueStore((s) => s.monsters);
  const loading = useCatalogueStore((s) => s.loadingMonsters);
  const error = useCatalogueStore((s) => s.monstersError);
  const loadMonsters = useCatalogueStore((s) => s.loadMonsters);
  const deleteMonster = useCatalogueStore((s) => s.deleteMonster);

  const openPopup = usePopupStore((s) => s.open);
  const currentUser = useAuthStore((s) => s.userData?.name);

  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortDir, setSortDir] = useState(null);
  const [crMin, setCrMin] = useStoredState("catalogue.monsters.crMin", "");
  const [crMax, setCrMax] = useStoredState("catalogue.monsters.crMax", "");
  const [picked, setPicked] = useStoredState("catalogue.monsters.picked", {}); // filter key → selected values

  const [form, setForm] = useState(null); // null = closed · {} new · { editing } · { copyFrom }
  const [openMenu, menu] = useEntryMenu({
    user: currentUser,
    onCopy: (m) => setForm({ copyFrom: m }),
    onEdit: (m) => setForm({ editing: m }),
    onDelete: deleteMonster,
  });

  useEffect(() => {
    if (!monsters?.length) loadMonsters();
  }, [loadMonsters]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Every chip filter: how to read its values from a monster, how to name
     them, and whether its section starts open. Edition starts on "one". */
  const FILTERS = useMemo(
    () => [
      { key: "edition", title: "Edition", read: (m) => [m.edition], options: () => EDITIONS, label: formatEdition, open: true },
      { key: "source", title: "Sources", read: (m) => [m.source], label: formatSource, grid: true },
      { key: "size", title: "Size", read: (m) => m.size, options: (found) => SIZES.filter((s) => found.includes(s)), label: titleCase, open: true },
      { key: "type", title: "Type", read: monsterTypes, label: titleCase, open: true },
      { key: "has", title: "Has", read: monsterHas, options: (found) => Object.keys(HAS_LABELS).filter((k) => found.includes(k)), label: (k) => HAS_LABELS[k], open: true },
      { key: "movement", title: "Movement", read: monsterMovement, label: titleCase },
      { key: "senses", title: "Senses", read: monsterSenses, label: labelFromId },
      { key: "damage", title: "Damage Dealt", read: monsterDamageDealt, label: titleCase },
      { key: "conditions", title: "Conditions Inflicted", read: monsterConditions, label: titleCase },
      { key: "saves", title: "Saves Forced", read: monsterSavesForced, label: (a) => ABILITY_SHORT[a] || titleCase(a) },
      { key: "resist", title: "Resists", read: (m) => monsterDefenses(m, "resist"), label: titleCase },
      { key: "immune", title: "Immune To", read: (m) => [...monsterDefenses(m, "immune"), ...monsterDefenses(m, "condition_immune")], label: titleCase },
      { key: "environment", title: "Habitat", read: (m) => list(m, "environment"), label: labelFromId },
      { key: "tags", title: "Type Tags", read: (m) => m.creature_type?.tags, label: titleCase },
      { key: "traits", title: "Traits", read: (m) => list(m, "traits"), label: labelFromId },
      { key: "actions", title: "Actions", read: (m) => list(m, "actions"), label: labelFromId },
      { key: "misc", title: "Attack Kinds", read: (m) => list(m, "misc"), label: labelFromId },
      { key: "spellcasting", title: "Spellcasting", read: (m) => list(m, "spellcasting"), label: labelFromId },
      { key: "groups", title: "Groups", read: (m) => list(m, "groups"), label: (g) => g },
    ],
    []
  );

  // What each filter offers: only values some monster has.
  const options = useMemo(() => {
    const out = {};
    for (const f of FILTERS) {
      const found = collectUnique(monsters, f.read);
      out[f.key] = f.options ? f.options(found) : f.key === "source" && !found.includes(HOMEBREW) ? [HOMEBREW, ...found] : found;
    }
    return out;
  }, [monsters, FILTERS]);

  const selected = (key) => picked[key] ?? (key === "edition" ? ["one"] : []);
  // from the latest picks (a chip turned from "show" to "hide" changes two values at once)
  const toggle = (key) => (v) => setPicked((p) => ({ ...p, [key]: toggleIn(p[key] ?? (key === "edition" ? ["one"] : []), v) }));

  const filtered = useMemo(() => {
    const lo = crMin ? crNumber(crMin) : null;
    const hi = crMax ? crNumber(crMax) : null;
    const rows = (monsters || []).filter((m) => {
      for (const f of FILTERS) if (!passesAny(selected(f.key), f.read(m))) return false;
      if (lo != null || hi != null) {
        const d = monsterDifficulty(m);
        if (d == null || (lo != null && d < lo) || (hi != null && d > hi)) return false;
      }
      return matchesQuery(m, query);
    });
    if (!sortDir) return rows.sort(byName);
    const dir = sortDir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      const x = monsterDifficulty(a);
      const y = monsterDifficulty(b);
      if (x == null || y == null) return x == null && y == null ? byName(a, b) : x == null ? 1 : -1;
      return (x - y) * dir || byName(a, b);
    });
  }, [monsters, FILTERS, picked, crMin, crMax, query, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCount = FILTERS.reduce((n, f) => n + selected(f.key).length, 0) + (crMin ? 1 : 0) + (crMax ? 1 : 0);
  const clearAll = () => {
    setPicked(Object.fromEntries(FILTERS.map((f) => [f.key, []])));
    setCrMin("");
    setCrMax("");
    setQuery("");
  };

  return (
    <div className="min-h-[640px] w-full">
      {error && <ErrorLine>{error}</ErrorLine>}

      {loading ? (
        <LoadingLine>Fetching monsters…</LoadingLine>
      ) : (
        <>
          <Toolbar
            filters={<FilterButton activeCount={activeCount} onClick={() => setFiltersOpen(true)} />}
            search={<input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search monsters…" className={searchCls} />}
            sort={<SortControl label="sort by CR" value={sortDir} onChange={setSortDir} />}
            right={
              <>
                <span className="text-xs italic text-ink-faded">
                  {filtered.length} of {monsters.length}
                </span>
                <button type="button" onClick={() => setForm({})} className={`${addBtn} !text-sm`}>
                  + create
                </button>
              </>
            }
          />

          <FilterPopup open={filtersOpen} onClose={() => setFiltersOpen(false)} activeCount={activeCount} onClear={clearAll}>
            <FilterSection title="Challenge">
              <div className="flex items-baseline gap-3">
                <select value={crMin} onChange={(e) => setCrMin(e.target.value)} className={crCls} aria-label="Lowest CR">
                  <option value="">min</option>
                  {CR_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="text-sm text-ink-faded">–</span>
                <select value={crMax} onChange={(e) => setCrMax(e.target.value)} className={crCls} aria-label="Highest CR">
                  <option value="">max</option>
                  {CR_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="text-xs italic text-ink-faded">a level-based statblock counts its level</span>
              </div>
            </FilterSection>
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
            <LoadingLine>No monsters match your filters.</LoadingLine>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((m) => (
                <CatalogueRow key={`${m.id}-${m.visibility || ""}`} entry={m} meta={monsterRowMeta(m)}
                              onOpen={(x) => openPopup("monster", x)} onContextMenu={openMenu} />
              ))}
            </div>
          )}

          {menu}

          <MonsterCardForm open={form !== null} onClose={() => setForm(null)}
                           editingMonster={form?.editing || null} copyFromMonster={form?.copyFrom || null} />
        </>
      )}
    </div>
  );
}
