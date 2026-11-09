import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import RaceRow from "./RaceRow";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import RaceCreatePopup from "./RaceCreatePopup";
import RowContextMenu from "../RowContextMenu";
import useAuthStore from "../../../store/AuthStore";
import { ErrorLine, LoadingLine, Toolbar, chip, searchCls } from "../catalogueStyle";
import { addBtn } from "../../../styles/parchmentForm";
import {
  collectUnique,
  cap,
  formatSource,
  SIZE_LABELS,
  SIZE_ORDER,
} from "./raceHelpers";

export default function Races() {
  const races = useCatalogueStore((s) => s.races);
  const loading = useCatalogueStore((s) => s.loadingRaces);
  const error = useCatalogueStore((s) => s.error);
  const loadRaces = useCatalogueStore((s) => s.loadRaces);

  const [selectedSources, setSelectedSources] = useState(["XPHB"]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRace, setEditingRace] = useState(null);   // homebrew being edited
  const [copyFromRace, setCopyFromRace] = useState(null); // race being copied as template
  const [contextMenu, setContextMenu] = useState(null);   // { x, y, race }

  const openPopup = usePopupStore((s) => s.open);
  const currentUser = useAuthStore((s) => s.userData?.name);

  const updateRaceAction = useCatalogueStore((s) => s.updateRace);
  const deleteRaceAction = useCatalogueStore((s) => s.deleteRace);

  useEffect(() => { loadRaces(); }, [loadRaces]);

  const sources = useMemo(() => {
    const derived = collectUnique(races, "source");
    return derived.includes("HOMEBREW") ? derived : ["HOMEBREW", ...derived];
  }, [races]);

  const creatureTypes = useMemo(() => collectUnique(races, "creature_type"), [races]);
  const sizes = useMemo(() => {
    const present = collectUnique(races, "sizes");
    return SIZE_ORDER.filter((s) => present.includes(s));
  }, [races]);

  const toggle = (setter) => (val) =>
    setter((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );


  const handleRowContextMenu = (e, race) => {
    const isHomebrew = race.source === "HOMEBREW";
    const isOwner = isHomebrew && race.created_by === currentUser;

    const items = [];
    items.push({
      label: "Copy",
      onClick: () => {
        setCopyFromRace(race);
        setCreateOpen(true);
      },
    });

    if (isOwner) {
      items.push({
        label: "Edit",
        onClick: () => {
          setEditingRace(race);
          setCreateOpen(true);
        },
      });
      items.push({
        label: "Delete",
        danger: true,
        onClick: async () => {
          if (!window.confirm(`Delete "${race.name}"? This cannot be undone.`)) return;
          try {
            await deleteRaceAction(race.id);
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
    setEditingRace(null);
    setCopyFromRace(null);
  };

  const toggleSource = toggle(setSelectedSources);
  const toggleType = toggle(setSelectedTypes);
  const toggleSize = toggle(setSelectedSizes);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (races || []).filter((r) => {
      if (!r) return false;   
      if (selectedSources.length && !selectedSources.includes(r.source)) return false;
      if (selectedTypes.length && !selectedTypes.includes(r.creature_type)) return false;
      if (selectedSizes.length) {
        const rs = r.sizes || [];
        if (!selectedSizes.some((s) => rs.includes(s))) return false;
      }
      if (q) {
        const subNames = (r.sub_races || [])
          .map((sr) => sr.display_name || sr.name)
          .filter(Boolean).join(" ");
        const hay = [r?.name, r?.creature_type, r?.source, subNames]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [races, query, selectedSources, selectedTypes, selectedSizes]);

  const clearAll = () => {
    setSelectedSources([]);
    setSelectedTypes([]);
    setSelectedSizes([]);
    setQuery("");
  };

  const activeCount =
    selectedSources.length + selectedTypes.length + selectedSizes.length;

  return (
    <div className="min-h-[640px] w-full">
      {error && <ErrorLine>{error}</ErrorLine>}

      {loading ? (
        <LoadingLine>Fetching races…</LoadingLine>
      ) : (
        <>
          <Toolbar
            filters={<FilterButton activeCount={activeCount} onClick={() => setFiltersOpen(true)} />}
            search={<input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search races…" className={searchCls} />}
            right={
              <>
                <span className="text-xs italic text-ink-faded">
                  {filtered.length} of {(races || []).length}
                </span>
                <button onClick={() => setCreateOpen(true)} className={`${addBtn} !text-sm`}>
                  + create
                </button>
              </>
            }
          />

          {/* Filter popup */}
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

            <FilterSection title="Creature Type">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {creatureTypes.map((t) => (
                  <button key={t} onClick={() => toggleType(t)} className={chip(selectedTypes.includes(t))}>
                    {cap(t)}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Size">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {sizes.map((s) => (
                  <button key={s} onClick={() => toggleSize(s)} className={chip(selectedSizes.includes(s))}>
                    {SIZE_LABELS[s] || cap(s)}
                  </button>
                ))}
              </div>
            </FilterSection>
          </FilterPopup>

          {/* Results */}
          {filtered.length === 0 ? (
            <LoadingLine>No races match your filters.</LoadingLine>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r, idx) => (
              <RaceRow
                key={`${r?.id || r?.name}-${r?.source}-${idx}`}
                race={r}
                onOpen={(race) => openPopup("race", race)}
                onContextMenu={handleRowContextMenu}
              />
            ))}
          </div>
          )}
          {contextMenu && (
            <RowContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              items={contextMenu.items}
              onClose={() => setContextMenu(null)}
            />
          )}

          <RaceCreatePopup
            open={createOpen}
            onClose={handleCreateClose}
            editingRace={editingRace}
            copyFromRace={copyFromRace}
          />
        </>
      )}
    </div>
  );
}