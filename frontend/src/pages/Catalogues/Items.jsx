import React, { useEffect, useMemo, useState } from "react";
import { useDnDStore } from "../../store/DndStore";

export default function Items() {
  const items = useDnDStore((s) => s.items);
  const loading = useDnDStore((s) => s.loadingItems);
  const error = useDnDStore((s) => s.error);
  const loadItems = useDnDStore((s) => s.loadItems);

  const [query, setQuery] = useState("");

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay = [
        it?.name,
        it?.type,
        it?.category,
        it?.rarity,
        it?.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  return (
    <div className="w-full bg-slate-900/40 border border-slate-700 rounded-lg p-4 min-h-[640px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-amber-400 text-xl font-semibold">Items</h3>
          <p className="text-xs text-slate-400">
            {loading
              ? "Loading…"
              : `${filtered.length} of ${items.length} item${
                  items.length === 1 ? "" : "s"
                }`}
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
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded
                         text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2 rounded border border-red-700 bg-red-900/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="px-3 py-8 text-center text-sm text-slate-500">
          {items.length === 0
            ? "No items found."
            : "No items match your search."}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
        {filtered.map((it, idx) => (
          <ItemCard key={it?.id ?? it?.name ?? idx} item={it} />
        ))}
      </div>
    </div>
  );
}

function ItemCard({ item }) {
  const { name, type, category, rarity, cost, weight, description } = item || {};
  const badges = [type, category].filter(Boolean);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3 hover:bg-slate-800/80 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-slate-100 font-semibold text-sm">
          {name || "Unnamed item"}
        </h4>
        {rarity && (
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-amber-300 border border-amber-500/30 rounded px-1.5 py-0.5">
            {rarity}
          </span>
        )}
      </div>

      {badges.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {badges.map((b, i) => (
            <span
              key={i}
              className="text-[11px] text-slate-300 bg-slate-900/60 border border-slate-700 rounded px-1.5 py-0.5"
            >
              {b}
            </span>
          ))}
        </div>
      )}

      {description && (
        <p className="mt-2 text-xs text-slate-300 whitespace-pre-line line-clamp-3">
          {description}
        </p>
      )}

      {(cost || weight) && (
        <div className="mt-2 flex gap-4 text-[11px] text-slate-400">
          {cost && <span>Cost: <span className="text-slate-200">{cost}</span></span>}
          {weight && <span>Weight: <span className="text-slate-200">{weight}</span></span>}
        </div>
      )}
    </div>
  );
}