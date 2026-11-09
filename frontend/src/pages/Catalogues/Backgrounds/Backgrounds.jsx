import React, { useEffect, useState, useMemo } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import RowContextMenu from "../RowContextMenu";
import BackgroundRow from "./BackgroundRow";
import BackgroundCreatePopup from "./BackgroundCreatePopup";
import { ErrorLine, LoadingLine, Toolbar, chip, searchCls } from "../catalogueStyle";
import { addBtn } from "../../../styles/parchmentForm";
import {
  formatSource, formatFeatTag, ABILITY, ABILITY_ORDER,
  collectUnique, getBackgroundAbilities,
} from "./backgroundHelpers";

export default function Backgrounds() {
  const backgroundsData = useCatalogueStore((s) => s.backgroundsData);
  const loading = useCatalogueStore((s) => s.loadingBackgrounds);
  const error = useCatalogueStore((s) => s.error);
  const loadBackgrounds = useCatalogueStore((s) => s.loadBackgrounds);
  const deleteBackgroundAction = useCatalogueStore((s) => s.deleteBackground);

  const backgrounds = backgroundsData?.backgrounds || [];

  const [selectedSources, setSelectedSources] = useState(["XPHB"]);
  const [selectedFeats, setSelectedFeats] = useState([]);
  const [selectedAbilities, setSelectedAbilities] = useState([]);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingBackground, setEditingBackground] = useState(null);
  const [copyFromBackground, setCopyFromBackground] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  const openPopup = usePopupStore((s) => s.open);
  const currentUser = useAuthStore((s) => s.userData?.name);

  useEffect(() => { loadBackgrounds(); }, []);

  const baseSources = useMemo(() => collectUnique(backgrounds, "source"), [backgrounds]);
  const sources = useMemo(
    () => (baseSources.includes("HOMEBREW") ? baseSources : ["HOMEBREW", ...baseSources]),
    [baseSources]
  );
  const featTags = useMemo(() => collectUnique(backgrounds, "feats"), [backgrounds]);

  const toggle = (setter) => (val) =>
    setter((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));
  const toggleSource = toggle(setSelectedSources);
  const toggleFeat = toggle(setSelectedFeats);
  const toggleAbility = toggle(setSelectedAbilities);

  const handleRowContextMenu = (e, bg) => {
    const isHomebrew = bg.source === "HOMEBREW";
    const isOwner = isHomebrew && bg.created_by === currentUser;
    const items = [{
      label: "Copy",
      onClick: () => { setCopyFromBackground(bg); setCreateOpen(true); },
    }];
    if (isOwner) {
      items.push({
        label: "Edit",
        onClick: () => { setEditingBackground(bg); setCreateOpen(true); },
      });
      items.push({
        label: "Delete",
        danger: true,
        onClick: async () => {
          if (!window.confirm(`Delete "${bg.name}"? This cannot be undone.`)) return;
          try { await deleteBackgroundAction(bg.id); }
          catch (err) { alert(`Delete failed: ${err.message}`); }
        },
      });
    }
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  const handleCreateClose = () => {
    setCreateOpen(false);
    setEditingBackground(null);
    setCopyFromBackground(null);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return backgrounds.filter((bg) => {
      if (selectedSources.length > 0 && !selectedSources.includes(bg.source)) return false;
      if (selectedFeats.length > 0) {
        const bgFeats = bg.feats || [];
        if (!selectedFeats.some((f) => bgFeats.includes(f))) return false;
      }
      if (selectedAbilities.length > 0) {
        const abil = getBackgroundAbilities(bg.ability_score_increase);
        if (!selectedAbilities.some((a) => abil.includes(a))) return false;
      }
      if (q && !bg.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [backgrounds, query, selectedSources, selectedFeats, selectedAbilities]);

  const clearAll = () => {
    setSelectedSources([]); setSelectedFeats([]); setSelectedAbilities([]); setQuery("");
  };
  const activeCount = selectedSources.length + selectedFeats.length + selectedAbilities.length;

  return (
    <div className="min-h-[640px] w-full">
      {error && <ErrorLine>{error}</ErrorLine>}

      {loading ? (
        <LoadingLine>Fetching backgrounds…</LoadingLine>
      ) : (
        <>
          <Toolbar
            filters={<FilterButton activeCount={activeCount} onClick={() => setFiltersOpen(true)} />}
            search={<input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search backgrounds…" className={searchCls} />}
            right={
              <>
                <span className="text-xs italic text-ink-faded">
                  {filtered.length} of {backgrounds.length}
                </span>
                <button onClick={() => setCreateOpen(true)} className={`${addBtn} !text-sm`}>
                  + create
                </button>
              </>
            }
          />

          <FilterPopup open={filtersOpen} onClose={() => setFiltersOpen(false)} activeCount={activeCount} onClear={clearAll}>
            <FilterSection title="Sources">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                {sources.map((source) => (
                  <button key={source} onClick={() => toggleSource(source)} title={formatSource(source)}
                          className={`${chip(selectedSources.includes(source))} truncate`}>
                    {formatSource(source)}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Feats">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {featTags.map((f) => (
                  <button key={f} onClick={() => toggleFeat(f)} className={chip(selectedFeats.includes(f))}>
                    {formatFeatTag(f)}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Ability">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {ABILITY_ORDER.map((a) => (
                  <button key={a} onClick={() => toggleAbility(a)} className={chip(selectedAbilities.includes(a))}>
                    {ABILITY[a]}
                  </button>
                ))}
              </div>
            </FilterSection>
          </FilterPopup>

          {filtered.length === 0 ? (
            <LoadingLine>No backgrounds match your filters.</LoadingLine>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((bg, idx) => (
                <BackgroundRow
                  key={`${bg.id || bg.name}-${bg.source}-${idx}`}
                  background={bg}
                  onOpen={(b) => openPopup("background", b)}
                  onContextMenu={handleRowContextMenu}
                />
              ))}
            </div>
          )}

          {contextMenu && (
            <RowContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items}
                            onClose={() => setContextMenu(null)} />
          )}

          <BackgroundCreatePopup
            open={createOpen}
            onClose={handleCreateClose}
            editingBackground={editingBackground}
            copyFromBackground={copyFromBackground}
          />
        </>
      )}
    </div>
  );
}