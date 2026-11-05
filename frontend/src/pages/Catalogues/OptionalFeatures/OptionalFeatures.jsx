import React, { useEffect, useState, useMemo } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import RowContextMenu from "../RowContextMenu";
import OptionalFeatureRow from "./OptionalFeatureRow";
import OptionalFeatureCreatePopup from "./OptionalFeatureCreatePopup";
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
                placeholder="Search optional features…"
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

            <FilterSection title="Feature Type">
              <div className="flex flex-wrap gap-2">
                {FEATURE_TYPES.map((t) => (
                  <button key={t} onClick={() => toggleType(t)} className={chip(selectedTypes.includes(t))}>
                    {formatFeatureType(t)}
                  </button>
                ))}
              </div>
            </FilterSection>
          </FilterPopup>

          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-slate-500">No optional features match your filters.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-2 gap-y-1">
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