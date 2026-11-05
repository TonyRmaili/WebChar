import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import ItemRow from "./ItemRow";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import ItemCreatePopup from "./ItemCreatePopup";
import RowContextMenu from "../RowContextMenu";
import {
  collectUnique,
  formatSource,
  formatRarity,
  RARITY_ORDER,
  WEAPON_PROPERTIES,
  WEAPON_MASTERIES,
} from "./itemHelpers";

const ATTUNE_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "yes", label: "Required" },
  { value: "no",  label: "None" },
];

export default function Items() {
  const items = useCatalogueStore((s) => s.items);
  const loading = useCatalogueStore((s) => s.loadingItems);
  const error = useCatalogueStore((s) => s.error);
  const loadItems = useCatalogueStore((s) => s.loadItems);
  const deleteItemAction = useCatalogueStore((s) => s.deleteItem);

  const openPopup = usePopupStore((s) => s.open);
  const currentUser = useAuthStore((s) => s.userData?.name);

  const [selectedSources, setSelectedSources] = useState(["XDMG"]);
  const [selectedRarities, setSelectedRarities] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedBaseItems, setSelectedBaseItems] = useState([]);
  const [selectedProperties, setSelectedProperties] = useState([]);
  const [selectedMasteries, setSelectedMasteries] = useState([]);
  const [attune, setAttune] = useState("any");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [copyFromItem, setCopyFromItem] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => { loadItems(); }, [loadItems]);

  const sources = useMemo(() => {
    const derived = collectUnique(items, "source");
    return derived.includes("HOMEBREW") ? derived : ["HOMEBREW", ...derived];
  }, [items]);

  const rarities = useMemo(() => {
    const present = collectUnique(items, "rarity");
    return RARITY_ORDER.filter((r) => present.includes(r));
  }, [items]);

  // types comes from the `types` list field, flattened across items.
  const types = useMemo(() => collectUnique(items, "types"), [items]);
  const baseItems = useMemo(() => collectUnique(items, "baseItem"), [items]);

  // Derive properties + masteries from data, ordered by full constant list
  // so the filter shows everything possible (not just what's loaded right now).
  const propertiesPresent = useMemo(() => {
    const set = new Set();
    for (const it of items || []) {
      for (const p of it?.properties || []) set.add(p);
    }
    return WEAPON_PROPERTIES.filter((p) => set.has(p));
  }, [items]);

  const masteriesPresent = useMemo(() => {
    const set = new Set();
    for (const it of items || []) {
      if (it?.mastery) set.add(it.mastery);
    }
    return WEAPON_MASTERIES.filter((m) => set.has(m));
  }, [items]);

  const toggle = (setter) => (val) =>
    setter((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );

  const toggleSource = toggle(setSelectedSources);
  const toggleRarity = toggle(setSelectedRarities);
  const toggleType = toggle(setSelectedTypes);
  const toggleBaseItem = toggle(setSelectedBaseItems);
  const toggleProperty = toggle(setSelectedProperties);
  const toggleMastery = toggle(setSelectedMasteries);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items || []).filter((it) => {
      if (!it) return false;
      if (selectedSources.length && !selectedSources.includes(it.source)) return false;
      if (selectedRarities.length && !selectedRarities.includes(it.rarity)) return false;
      if (selectedTypes.length) {
        const itTypes = it.types || [];
        if (!selectedTypes.some((t) => itTypes.includes(t))) return false;
      }
      if (selectedBaseItems.length && !selectedBaseItems.includes(it.baseItem)) return false;
      if (selectedProperties.length) {
        const itProps = it.properties || [];
        if (!selectedProperties.some((p) => itProps.includes(p))) return false;
      }
      if (selectedMasteries.length && !selectedMasteries.includes(it.mastery)) return false;
      if (attune === "yes" && !it.reqAttune) return false;
      if (attune === "no" && it.reqAttune) return false;
      if (q) {
        const itTypes = (it.types || []).join(" ");
        const hay = [it?.name, itTypes, it?.rarity, it?.source, it?.baseItem]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    items, query, selectedSources, selectedRarities, selectedTypes,
    selectedBaseItems, selectedProperties, selectedMasteries, attune,
  ]);

  const handleRowContextMenu = (e, item) => {
    const isHomebrew = item.source === "HOMEBREW";
    const isOwner = isHomebrew && item.created_by === currentUser;

    const menuItems = [];
    menuItems.push({
      label: "Copy",
      onClick: () => { setCopyFromItem(item); setCreateOpen(true); },
    });

    if (isOwner) {
      menuItems.push({
        label: "Edit",
        onClick: () => { setEditingItem(item); setCreateOpen(true); },
      });
      menuItems.push({
        label: "Delete",
        danger: true,
        onClick: async () => {
          if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
          try { await deleteItemAction(item.id); }
          catch (err) { alert(`Delete failed: ${err.message}`); }
        },
      });
    }
    setContextMenu({ x: e.clientX, y: e.clientY, items: menuItems });
  };

  const handleCreateClose = () => {
    setCreateOpen(false);
    setEditingItem(null);
    setCopyFromItem(null);
  };

  const clearAll = () => {
    setSelectedSources([]);
    setSelectedRarities([]);
    setSelectedTypes([]);
    setSelectedBaseItems([]);
    setSelectedProperties([]);
    setSelectedMasteries([]);
    setAttune("any");
    setQuery("");
  };

  const activeCount =
    selectedSources.length + selectedRarities.length +
    selectedTypes.length + selectedBaseItems.length +
    selectedProperties.length + selectedMasteries.length +
    (attune !== "any" ? 1 : 0);

  const chip = (active) =>
    `text-[11px] px-2 py-1 rounded border transition
     ${active
       ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
       : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-300"}`;

  return (
    <div className="w-full bg-slate-900/40 p-4 min-h-[640px]">
      {error && (
        <div className="mb-3 p-2 rounded border border-red-700 bg-red-900/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {!loading && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <FilterButton activeCount={activeCount} onClick={() => setFiltersOpen(true)} />
            <div className="flex-1 max-w-sm">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search items…"
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

          <FilterPopup open={filtersOpen} onClose={() => setFiltersOpen(false)}
                       activeCount={activeCount} onClear={clearAll}>
            <FilterSection title="Sources">
              <div className="grid grid-cols-9 gap-2">
                {sources.map((src) => (
                  <button key={src} onClick={() => toggleSource(src)} title={formatSource(src)}
                          className={`${chip(selectedSources.includes(src))} text-center truncate`}>
                    {formatSource(src)}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Rarity">
              <div className="flex flex-wrap gap-2">
                {rarities.map((r) => (
                  <button key={r} onClick={() => toggleRarity(r)} className={chip(selectedRarities.includes(r))}>
                    {formatRarity(r)}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Attunement">
              <div className="flex flex-wrap gap-2">
                {ATTUNE_OPTIONS.map((o) => (
                  <button key={o.value} onClick={() => setAttune(o.value)} className={chip(attune === o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </FilterSection>

            {types.length > 0 && (
              <FilterSection title="Type">
                <div className="flex flex-wrap gap-2">
                  {types.map((t) => (
                    <button key={t} onClick={() => toggleType(t)} className={chip(selectedTypes.includes(t))}>{t}</button>
                  ))}
                </div>
              </FilterSection>
            )}

            {baseItems.length > 0 && (
              <FilterSection title="Base Item">
                <div className="flex flex-wrap gap-2">
                  {baseItems.map((b) => (
                    <button key={b} onClick={() => toggleBaseItem(b)} className={chip(selectedBaseItems.includes(b))}>
                      {b}
                    </button>
                  ))}
                </div>
              </FilterSection>
            )}

            {propertiesPresent.length > 0 && (
              <FilterSection title="Weapon Properties">
                <div className="flex flex-wrap gap-2">
                  {propertiesPresent.map((p) => (
                    <button key={p} onClick={() => toggleProperty(p)} className={chip(selectedProperties.includes(p))}>
                      {p}
                    </button>
                  ))}
                </div>
              </FilterSection>
            )}

            {masteriesPresent.length > 0 && (
              <FilterSection title="Mastery">
                <div className="flex flex-wrap gap-2">
                  {masteriesPresent.map((m) => (
                    <button key={m} onClick={() => toggleMastery(m)} className={chip(selectedMasteries.includes(m))}>
                      {m}
                    </button>
                  ))}
                </div>
              </FilterSection>
            )}
          </FilterPopup>

          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-slate-500">
              No items match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-2 gap-y-1">
              {filtered.map((it, idx) => (
                <ItemRow
                  key={`${it?.id || it?.name}-${it?.source}-${idx}`}
                  item={it}
                  onOpen={(item) => openPopup("item", item)}
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

          <ItemCreatePopup
            open={createOpen}
            onClose={handleCreateClose}
            editingItem={editingItem}
            copyFromItem={copyFromItem}
          />
        </>
      )}
    </div>
  );
}