import React, { useEffect, useState, useMemo } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import {
  formatSource,
  titleCase,
  crToNumber,
  CR_OPTIONS,
  getMonsterType,
  getMonsterSenses,
  getMonsterMovements,
  getMonsterDifficulty,
  getMonsterConditionInflict,
  getMonsterForcedSaves,
  formatSaveLabel,
  monsterUsesLevel,
} from "./monsterHelpers";
import MonsterRow from "./MonsterRow";
import MonsterCreatePopup from "./MonsterCreatePopup";
import RowContextMenu from "../RowContextMenu";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import { ErrorLine, LoadingLine, SortControl, Toolbar, chip, fieldCls, searchCls } from "../catalogueStyle";
import { addBtn } from "../../../styles/parchmentForm";

// The CR min / max pickers in the filter popup: short dotted blanks.
const challengeCls = `${fieldCls} !w-20 disabled:cursor-not-allowed disabled:opacity-40`;

export default function Monsters() {
  const monstersData = useCatalogueStore((s) => s.monstersData);
  const loading = useCatalogueStore((s) => s.loadingMonsters);
  const error = useCatalogueStore((s) => s.error);
  const loadMonsters = useCatalogueStore((s) => s.loadMonsters);
  const deleteMonsterAction = useCatalogueStore((s) => s.deleteMonster);

  const monsters = useMemo(() => {
    const root = monstersData?.monsters;
    if (!root || typeof root !== "object") return [];
    const out = [];
    for (const list of Object.values(root)) {
      if (Array.isArray(list)) out.push(...list);
    }
    return out;
  }, [monstersData]);

  const sources = useMemo(() => {
    const base = Object.keys(monstersData?.monsters || {}).sort();
    return base.includes("HOMEBREW") ? base : ["HOMEBREW", ...base];
  }, [monstersData]);

  const sizes = monstersData?.sizes || [];
  const envs = monstersData?.environments || [];
  const traits = monstersData?.traits || [];
  const senses = monstersData?.senses || [];
  const typesData = monstersData?.types || {};
  const typePrefixes = useMemo(
    () => [...(typesData.prefix || [])].sort(),
    [typesData]
  );

  // Derive movement, conditions, forced saves from data.
  const movements = useMemo(() => {
    const set = new Set();
    for (const m of monsters) {
      for (const mv of getMonsterMovements(m)) set.add(mv);
    }
    return [...set].sort();
  }, [monsters]);

  const conditionInflictOptions = useMemo(() => {
    const set = new Set();
    for (const m of monsters) {
      for (const c of getMonsterConditionInflict(m)) set.add(c);
    }
    return [...set].sort();
  }, [monsters]);

  const forcedSaveOptions = useMemo(() => {
    const set = new Set();
    for (const m of monsters) {
      for (const s of getMonsterForcedSaves(m)) set.add(s);
    }
    return [...set].sort();
  }, [monsters]);

  const [selectedSources, setSelectedSources] = useState(["XMM"]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedMovements, setSelectedMovements] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedEnvs, setSelectedEnvs] = useState([]);
  const [selectedSenses, setSelectedSenses] = useState([]);
  const [selectedTraits, setSelectedTraits] = useState([]);
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [selectedForcedSaves, setSelectedForcedSaves] = useState([]);
  const [crMin, setCrMin] = useState("");
  const [crMax, setCrMax] = useState("");
  const [levelOnly, setLevelOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [sortDir, setSortDir] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingMonster, setEditingMonster] = useState(null);
  const [copyFromMonster, setCopyFromMonster] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  const openPopup = usePopupStore((s) => s.open);
  const currentUser = useAuthStore((s) => s.userData?.name);

  useEffect(() => { loadMonsters(); }, [loadMonsters]);

  const handleRowContextMenu = (e, monster) => {
    const isHomebrew = monster.source === "HOMEBREW";
    const isOwner = isHomebrew && monster.created_by === currentUser;

    const items = [
      {
        label: "Copy",
        onClick: () => { setCopyFromMonster(monster); setCreateOpen(true); },
      },
    ];

    if (isOwner) {
      items.push({
        label: "Edit",
        onClick: () => { setEditingMonster(monster); setCreateOpen(true); },
      });
      items.push({
        label: "Delete",
        danger: true,
        onClick: async () => {
          if (!window.confirm(`Delete "${monster.name}"? This cannot be undone.`)) return;
          try {
            await deleteMonsterAction(monster.id);
          } catch (err) {
            alert(`Delete failed: ${err.message}`);
          }
        },
      });
    }

    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  const handleCreateClose = () => {
    setCreateOpen(false);
    setEditingMonster(null);
    setCopyFromMonster(null);
  };

  const toggle = (setter) => (val) =>
    setter((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );

  const toggleSource = toggle(setSelectedSources);
  const toggleSize = toggle(setSelectedSizes);
  const toggleMovement = toggle(setSelectedMovements);
  const toggleType = toggle(setSelectedTypes);
  const toggleEnv = toggle(setSelectedEnvs);
  const toggleSense = toggle(setSelectedSenses);
  const toggleTrait = toggle(setSelectedTraits);
  const toggleCondition = toggle(setSelectedConditions);
  const toggleForcedSave = toggle(setSelectedForcedSaves);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minN = crMin ? crToNumber(crMin) : null;
    const maxN = crMax ? crToNumber(crMax) : null;

    return monsters.filter((m) => {
      if (selectedSources.length && !selectedSources.includes(m.source)) return false;
      if (selectedSizes.length) {
        const ms = m.size || [];
        if (!selectedSizes.some((s) => ms.includes(s))) return false;
      }
      if (selectedMovements.length) {
        const mm = getMonsterMovements(m);
        if (!selectedMovements.some((mv) => mm.includes(mv))) return false;
      }
      if (selectedTypes.length) {
        const t = getMonsterType(m);
        if (!selectedTypes.includes(t)) return false;
      }
      if (selectedEnvs.length) {
        const me = m.environment || [];
        if (!selectedEnvs.some((e) => me.includes(e))) return false;
      }
      if (selectedSenses.length) {
        const ms = getMonsterSenses(m);
        if (!selectedSenses.some((s) => ms.includes(s))) return false;
      }
      if (selectedTraits.length) {
        const mt = m.traitTags || [];
        if (!selectedTraits.some((t) => mt.includes(t))) return false;
      }
      if (selectedConditions.length) {
        const mc = getMonsterConditionInflict(m);
        if (!selectedConditions.some((c) => mc.includes(c))) return false;
      }
      if (selectedForcedSaves.length) {
        const mf = getMonsterForcedSaves(m);
        if (!selectedForcedSaves.some((s) => mf.includes(s))) return false;
      }
      if (levelOnly) {
        if (!monsterUsesLevel(m)) return false;
      } else if (minN != null || maxN != null) {
        const n = crToNumber(m.cr?.base);
        if (n == null) return false;
        if (minN != null && n < minN) return false;
        if (maxN != null && n > maxN) return false;
      }
      if (q && !m.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [
    monsters, query,
    selectedSources, selectedSizes, selectedMovements,
    selectedTypes, selectedEnvs, selectedSenses, selectedTraits,
    selectedConditions, selectedForcedSaves,
    crMin, crMax, levelOnly,
  ]);

  const sorted = useMemo(() => {
    if (!sortDir) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = getMonsterDifficulty(a);
      const bv = getMonsterDifficulty(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }, [filtered, sortDir]);

  const clearAll = () => {
    setSelectedSources([]);
    setSelectedSizes([]);
    setSelectedMovements([]);
    setSelectedTypes([]);
    setSelectedEnvs([]);
    setSelectedSenses([]);
    setSelectedTraits([]);
    setSelectedConditions([]);
    setSelectedForcedSaves([]);
    setCrMin("");
    setCrMax("");
    setLevelOnly(false);
    setQuery("");
  };

  const activeCount =
    selectedSources.length +
    selectedSizes.length +
    selectedMovements.length +
    selectedTypes.length +
    selectedEnvs.length +
    selectedSenses.length +
    selectedTraits.length +
    selectedConditions.length +
    selectedForcedSaves.length +
    (crMin ? 1 : 0) +
    (crMax ? 1 : 0) +
    (levelOnly ? 1 : 0);

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
                  {sorted.length} of {monsters.length}
                </span>
                <button onClick={() => setCreateOpen(true)} className={`${addBtn} !text-sm`}>
                  + create
                </button>
              </>
            }
          />

          <FilterPopup
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            activeCount={activeCount}
            onClear={clearAll}
          >
            <FilterSection title="Sources">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                {sources.map((src) => (
                  <button
                    key={src}
                    onClick={() => toggleSource(src)}
                    title={formatSource(src)}
                    className={`${chip(selectedSources.includes(src))} truncate`}
                  >
                    {formatSource(src)}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Size">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {sizes.map((s) => (
                  <button key={s} onClick={() => toggleSize(s)} className={chip(selectedSizes.includes(s))}>
                    {s}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Movement">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {movements.map((mv) => (
                  <button key={mv} onClick={() => toggleMovement(mv)} className={chip(selectedMovements.includes(mv))}>
                    {titleCase(mv)}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Senses">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {senses.map((s) => (
                  <button key={s} onClick={() => toggleSense(s)} className={chip(selectedSenses.includes(s))}>
                    {titleCase(s)}
                  </button>
                ))}
              </div>
            </FilterSection>

            {conditionInflictOptions.length > 0 && (
              <FilterSection title="Conditions Inflicted">
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {conditionInflictOptions.map((c) => (
                    <button key={c} onClick={() => toggleCondition(c)} className={chip(selectedConditions.includes(c))}>
                      {titleCase(c)}
                    </button>
                  ))}
                </div>
              </FilterSection>
            )}

            {forcedSaveOptions.length > 0 && (
              <FilterSection title="Forced Saves">
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {forcedSaveOptions.map((s) => (
                    <button key={s} onClick={() => toggleForcedSave(s)} className={chip(selectedForcedSaves.includes(s))}>
                      {formatSaveLabel(s)}
                    </button>
                  ))}
                </div>
              </FilterSection>
            )}

            <FilterSection title="Type">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {typePrefixes.map((t) => (
                  <button key={t} onClick={() => toggleType(t)} className={chip(selectedTypes.includes(t))}>
                    {titleCase(t)}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Environment">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {envs.map((e) => (
                  <button key={e} onClick={() => toggleEnv(e)} className={chip(selectedEnvs.includes(e))}>
                    {titleCase(e)}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Traits">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {traits.map((t) => (
                  <button key={t} onClick={() => toggleTrait(t)} className={chip(selectedTraits.includes(t))}>
                    {t}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Challenge">
              <div className="flex items-baseline gap-3">
                <select value={crMin} onChange={(e) => setCrMin(e.target.value)} className={challengeCls} disabled={levelOnly}>
                  <option value="">min</option>
                  {CR_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="text-sm text-ink-faded">–</span>
                <select value={crMax} onChange={(e) => setCrMax(e.target.value)} className={challengeCls} disabled={levelOnly}>
                  <option value="">max</option>
                  {CR_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button
                  onClick={() => setLevelOnly((v) => !v)}
                  title="Show only monsters that use the level system instead of CR"
                  className={`${chip(levelOnly)} ml-2`}
                >
                  Level
                </button>
              </div>
            </FilterSection>
          </FilterPopup>

          {sorted.length === 0 && <LoadingLine>No monsters match your filters.</LoadingLine>}
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((m, idx) => (
              <MonsterRow
                key={`${m.id || m.name}-${m.source}-${idx}`}
                monster={m}
                onOpen={(monster) => openPopup("monster", monster)}
                onContextMenu={handleRowContextMenu}
              />
            ))}
          </div>

          {contextMenu && (
            <RowContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              items={contextMenu.items}
              onClose={() => setContextMenu(null)}
            />
          )}

          <MonsterCreatePopup
            open={createOpen}
            onClose={handleCreateClose}
            editingMonster={editingMonster}
            copyFromMonster={copyFromMonster}
          />
        </>
      )}
    </div>
  );
}