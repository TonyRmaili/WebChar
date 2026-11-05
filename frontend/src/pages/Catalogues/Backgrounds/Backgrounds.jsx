import React, { useEffect, useState, useMemo } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import RowContextMenu from "../RowContextMenu";
import BackgroundRow from "./BackgroundRow";
import BackgroundCreatePopup from "./BackgroundCreatePopup";
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

  const chip = (active) =>
    `text-[11px] px-2 py-1 rounded border transition
     ${active
       ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
       : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-300"}`;

  return (
    <div className="w-full bg-slate-900/40 p-4 min-h-[640px]">
      {error && (
        <div className="mb-3 p-2 rounded border border-red-700 bg-red-900/30 text-red-300 text-sm">{error}</div>
      )}

      {!loading && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <FilterButton activeCount={activeCount} onClick={() => setFiltersOpen(true)} />
            <div className="flex-1 max-w-sm">
              <input
                type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search backgrounds…"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm
                           focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition"
              />
            </div>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border transition
                        bg-slate-800/60 border-slate-700 text-slate-200
                        hover:border-amber-500/40 hover:text-amber-300"
            >
              <span className="text-[11px] uppercase tracking-wider">+ Create</span>
            </button>
          </div>

          <FilterPopup open={filtersOpen} onClose={() => setFiltersOpen(false)} activeCount={activeCount} onClear={clearAll}>
            <FilterSection title="Sources">
              <div className="grid grid-cols-9 gap-2">
                {sources.map((source) => (
                  <button key={source} onClick={() => toggleSource(source)} title={formatSource(source)}
                          className={`${chip(selectedSources.includes(source))} text-center truncate`}>
                    {formatSource(source)}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Feats">
              <div className="flex flex-wrap gap-2">
                {featTags.map((f) => (
                  <button key={f} onClick={() => toggleFeat(f)} className={chip(selectedFeats.includes(f))}>
                    {formatFeatTag(f)}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Ability">
              <div className="flex flex-wrap gap-2">
                {ABILITY_ORDER.map((a) => (
                  <button key={a} onClick={() => toggleAbility(a)} className={chip(selectedAbilities.includes(a))}>
                    {ABILITY[a]}
                  </button>
                ))}
              </div>
            </FilterSection>
          </FilterPopup>

          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-slate-500">No backgrounds match your filters.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-2 gap-y-1">
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