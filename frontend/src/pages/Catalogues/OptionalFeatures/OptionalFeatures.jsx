import React, { useEffect, useState, useMemo } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import RowContextMenu from "../RowContextMenu";
import OptionalFeatureRow from "./OptionalFeatureRow";
import OptionalFeatureCreatePopup from "./OptionalFeatureCreatePopup";
import { ErrorLine, LoadingLine, Toolbar, chip, searchCls } from "../catalogueStyle";
import { addBtn } from "../../../styles/parchmentForm";
import {
  formatSource, formatFeatureType, collectUnique, FEATURE_TYPES,
} from "./optionalFeatureHelpers";

export default function OptionalFeatures() {
  const optionalFeaturesData = useCatalogueStore((s) => s.optionalFeaturesData);
  const loading = useCatalogueStore((s) => s.loadingOptionalFeatures);
  const error = useCatalogueStore((s) => s.error);
  const loadOptionalFeatures = useCatalogueStore((s) => s.loadOptionalFeatures);
  const deleteOptionalFeatureAction = useCatalogueStore((s) => s.deleteOptionalFeature);

  const features = optionalFeaturesData?.features || [];

  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedSources, setSelectedSources] = useState(["XPHB"]);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [copyFromFeature, setCopyFromFeature] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  const openPopup = usePopupStore((s) => s.open);
  const currentUser = useAuthStore((s) => s.userData?.name);

  useEffect(() => { loadOptionalFeatures(); }, []);

  const baseSources = useMemo(() => collectUnique(features, "source"), [features]);
  const sources = useMemo(
    () => (baseSources.includes("HOMEBREW") ? baseSources : ["HOMEBREW", ...baseSources]),
    [baseSources]
  );

  const toggle = (setter) => (val) =>
    setter((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));
  const toggleType = toggle(setSelectedTypes);
  const toggleSource = toggle(setSelectedSources);

  const handleRowContextMenu = (e, feat) => {
    const isHomebrew = feat.source === "HOMEBREW";
    const isOwner = isHomebrew && feat.created_by === currentUser;
    const items = [{
      label: "Copy",
      onClick: () => { setCopyFromFeature(feat); setCreateOpen(true); },
    }];
    if (isOwner) {
      items.push({
        label: "Edit",
        onClick: () => { setEditingFeature(feat); setCreateOpen(true); },
      });
      items.push({
        label: "Delete",
        danger: true,
        onClick: async () => {
          if (!window.confirm(`Delete "${feat.name}"? This cannot be undone.`)) return;
          try { await deleteOptionalFeatureAction(feat.id); }
          catch (err) { alert(`Delete failed: ${err.message}`); }
        },
      });
    }
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  const handleCreateClose = () => {
    setCreateOpen(false);
    setEditingFeature(null);
    setCopyFromFeature(null);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return features.filter((f) => {
      if (selectedTypes.length > 0 && !selectedTypes.includes(f.feature_type)) return false;
      if (selectedSources.length > 0 && !selectedSources.includes(f.source)) return false;
      if (q && !f.name?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [features, query, selectedTypes, selectedSources]);

  const clearAll = () => { setSelectedTypes([]); setSelectedSources([]); setQuery(""); };
  const activeCount = selectedSources.length + selectedTypes.length;

  return (
    <div className="min-h-[640px] w-full">
      {error && <ErrorLine>{error}</ErrorLine>}

      {loading ? (
        <LoadingLine>Fetching optional features…</LoadingLine>
      ) : (
        <>
          <Toolbar
            filters={<FilterButton activeCount={activeCount} onClick={() => setFiltersOpen(true)} />}
            search={<input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search optional features…" className={searchCls} />}
            right={
              <>
                <span className="text-xs italic text-ink-faded">
                  {filtered.length} of {features.length}
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

            <FilterSection title="Feature Type">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {FEATURE_TYPES.map((t) => (
                  <button key={t} onClick={() => toggleType(t)} className={chip(selectedTypes.includes(t))}>
                    {formatFeatureType(t)}
                  </button>
                ))}
              </div>
            </FilterSection>
          </FilterPopup>

          {filtered.length === 0 ? (
            <LoadingLine>No optional features match your filters.</LoadingLine>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((f, idx) => (
                <OptionalFeatureRow
                  key={`${f.id || f.name}-${f.source}-${f.feature_type}-${idx}`}
                  feature={f}
                  onOpen={(of) => openPopup("optionalFeature", of)}
                  onContextMenu={handleRowContextMenu}
                />
              ))}
            </div>
          )}

          {contextMenu && (
            <RowContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items}
                            onClose={() => setContextMenu(null)} />
          )}

          <OptionalFeatureCreatePopup
            open={createOpen}
            onClose={handleCreateClose}
            editingFeature={editingFeature}
            copyFromFeature={copyFromFeature}
          />
        </>
      )}
    </div>
  );
}