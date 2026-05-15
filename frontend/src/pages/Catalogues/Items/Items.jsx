import React, { useEffect, useMemo, useState } from "react";
import { useDnDStore } from "../../../store/DndStore";
import ItemRow from "./ItemRow";
import ItemPopupLayer, { useItemPopups } from "./ItemPopupManager";
import { collectUnique } from "./itemHelpers";

const ATTUNE_OPTIONS = ["any", "yes", "no"];

export default function Items() {
  const items = useDnDStore((s) => s.items);
  const loading = useDnDStore((s) => s.loadingItems);
  const error = useDnDStore((s) => s.error);
  const loadItems = useDnDStore((s) => s.loadItems);

  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [rarity, setRarity] = useState("");
  const [type, setType] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [attune, setAttune] = useState("any");

  const popups = useItemPopups();

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Option lists derived from data
  const sources = useMemo(() => collectUnique(items, "source"), [items]);
  const rarities = useMemo(() => collectUnique(items, "rarity"), [items]);
  const types = useMemo(() => collectUnique(items, "type"), [items]);
  const tags = useMemo(() => collectUnique(items, "tags"), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (q) {
        const hay = [it?.name, it?.type, it?.rarity, it?.source]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (source && it.source !== source) return false;
      if (rarity && it.rarity !== rarity) return false;
      if (type && it.type !== type) return false;
      if (selectedTags.length > 0) {
        const itemTags = it.tags || [];
        if (!selectedTags.every((t) => itemTags.includes(t))) return false;
      }
      if (attune === "yes" && !it.reqAttune) return false;
      if (attune === "no" && it.reqAttune) return false;
      return true;
    });
  }, [items, query, source, rarity, type, selectedTags, attune]);

  const toggleTag = (t) =>
    setSelectedTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );

  const clearFilters = () => {
    setQuery("");
    setSource("");
    setRarity("");
    setType("");
    setSelectedTags([]);
    setAttune("any");
  };

  return (
    <div className="w-full bg-slate-900/40 border border-slate-700 rounded-lg p-4 min-h-[640px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div>
          <h3 className="text-amber-400 text-xl font-semibold">Items</h3>
          <p className="text-xs text-slate-400">
            {loading ? "Loading…" : `${filtered.length} of ${items.length} item${items.length === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="relative w-full sm:max-w-sm">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items…"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm
                       focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <Select label="Source" value={source} onChange={setSource} options={sources} />
        <Select label="Rarity" value={rarity} onChange={setRarity} options={rarities} />
        <Select label="Type" value={type} onChange={setType} options={types} />
        <Select
          label="Attunement"
          value={attune}
          onChange={setAttune}
          options={ATTUNE_OPTIONS}
          allowAny={false}
        />
      </div>

      {/* Tag chips */}
      {tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {tags.map((t) => {
            const active = selectedTags.includes(t);
            return (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className={`text-[11px] px-2 py-0.5 rounded border transition
                  ${active
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                    : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500"}`}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}

      {(query || source || rarity || type || selectedTags.length > 0 || attune !== "any") && (
        <button
          onClick={clearFilters}
          className="mb-3 text-xs text-amber-400 hover:text-amber-300 underline"
        >
          Clear filters
        </button>
      )}

      {error && (
        <div className="mb-3 p-2 rounded border border-red-700 bg-red-900/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Rows */}
      {!loading && filtered.length === 0 && !error ? (
        <div className="px-3 py-8 text-center text-sm text-slate-500">
          No items match your filters.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {filtered.map((it, idx) => (
            <ItemRow
              key={`${it?.name}-${it?.source}-${idx}`}
              item={it}
              onOpen={popups.openItem}
            />
          ))}
        </div>
      )}

      {/* Popups */}
      <ItemPopupLayer
        popups={popups.openPopups}
        minimized={popups.minimized}
        onClose={popups.close}
        onMinimize={popups.minimize}
        onRestore={popups.restore}
        onFocus={popups.focus}
        onMove={popups.move}
        onResize={popups.resize}
      />
    </div>
  );
}

function Select({ label, value, onChange, options, allowAny = true }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-slate-100 text-sm
                   focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition"
      >
        {allowAny && <option value="">Any</option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}