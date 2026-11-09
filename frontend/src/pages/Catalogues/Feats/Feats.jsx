import React, { useEffect, useState, useMemo } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import RowContextMenu from "../RowContextMenu";
import FeatRow from "./FeatRow";
import FeatCreatePopup from "./FeatCreatePopup";
import { ErrorLine, LoadingLine, Toolbar, chip, searchCls } from "../catalogueStyle";
import { addBtn } from "../../../styles/parchmentForm";
import {
  formatSource,
  formatCategory,
  ABILITY,
  ABILITY_ORDER,
  getFeatAbilities,
} from "./featsHelpers";

export default function Feats() {
  const featsData = useCatalogueStore((s) => s.featsData);
  const loading = useCatalogueStore((s) => s.loadingFeats);
  const error = useCatalogueStore((s) => s.error);
  const loadFeats = useCatalogueStore((s) => s.loadFeats);
  const deleteFeatAction = useCatalogueStore((s) => s.deleteFeat);

  const feats = featsData.feats || [];
  const categories = featsData.categories || [];

  const [selectedSources, setSelectedSources] = useState(["XPHB"]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedAbilities, setSelectedAbilities] = useState([]);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingFeat, setEditingFeat] = useState(null);
  const [copyFromFeat, setCopyFromFeat] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  const openPopup = usePopupStore((s) => s.open);
  const currentUser = useAuthStore((s) => s.userData?.name);

  useEffect(() => { loadFeats(); }, []);

  // Ensure HOMEBREW is selectable even before any homebrew feat exists.
  const sources = useMemo(() => {
    const base = featsData.sources || [];
    return base.includes("HOMEBREW") ? base : ["HOMEBREW", ...base];
  }, [featsData]);

  const toggle = (setter) => (val) =>
    setter((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );

  const toggleSource = toggle(setSelectedSources);
  const toggleCategory = toggle(setSelectedCategories);
  const toggleAbility = toggle(setSelectedAbilities);

  const handleRowContextMenu = (e, feat) => {
    const isHomebrew = feat.source === "HOMEBREW";
    const isOwner = isHomebrew && feat.created_by === currentUser;

    const items = [];
    items.push({
      label: "Copy",
      onClick: () => {
        setCopyFromFeat(feat);
        setCreateOpen(true);
      },
    });

    if (isOwner) {
      items.push({
        label: "Edit",
        onClick: () => {
          setEditingFeat(feat);
          setCreateOpen(true);
        },
      });
      items.push({
        label: "Delete",
        danger: true,
        onClick: async () => {
          if (!window.confirm(`Delete "${feat.name}"? This cannot be undone.`)) return;
          try {
            await deleteFeatAction(feat.id);
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
    setEditingFeat(null);
    setCopyFromFeat(null);
  };

  const filteredFeats = useMemo(() => {
    const q = query.trim().toLowerCase();
    return feats.filter((feat) => {
      if (!feat) return false;
      if (selectedSources.length > 0 && !selectedSources.includes(feat.source)) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(feat.category)) return false;
      if (selectedAbilities.length > 0) {
        const abil = getFeatAbilities(feat.ability_score_increase);
        if (!selectedAbilities.some((a) => abil.includes(a))) return false;
      }
      if (q && !feat.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [feats, query, selectedSources, selectedCategories, selectedAbilities]);

  const clearAll = () => {
    setSelectedSources([]);
    setSelectedCategories([]);
    setSelectedAbilities([]);
    setQuery("");
  };

  const activeCount =
    selectedSources.length + selectedCategories.length + selectedAbilities.length;

  return (
    <div className="min-h-[640px] w-full">
      {error && <ErrorLine>{error}</ErrorLine>}

      {loading ? (
        <LoadingLine>Fetching feats…</LoadingLine>
      ) : (
        <>
          <Toolbar
            filters={<FilterButton activeCount={activeCount} onClick={() => setFiltersOpen(true)} />}
            search={<input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search feats…" className={searchCls} />}
            right={
              <>
                <span className="text-xs italic text-ink-faded">
                  {filteredFeats.length} of {feats.length}
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
                {sources.map((source) => (
                  <button
                    key={source}
                    onClick={() => toggleSource(source)}
                    title={formatSource(source)}
                    className={`${chip(selectedSources.includes(source))} truncate`}
                  >
                    {formatSource(source)}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Categories">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {categories.map((cate) => (
                  <button key={cate} onClick={() => toggleCategory(cate)} className={chip(selectedCategories.includes(cate))}>
                    {formatCategory(cate)}
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

          {filteredFeats.length === 0 ? (
            <LoadingLine>No feats match your filters.</LoadingLine>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2 xl:grid-cols-3">
              {filteredFeats.map((feat, idx) => (
                <FeatRow
                  key={`${feat.id || feat.name}-${feat.source}-${idx}`}
                  feat={feat}
                  onOpen={(f) => openPopup("feat", f)}
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

          <FeatCreatePopup
            open={createOpen}
            onClose={handleCreateClose}
            editingFeat={editingFeat}
            copyFromFeat={copyFromFeat}
          />
        </>
      )}
    </div>
  );
}