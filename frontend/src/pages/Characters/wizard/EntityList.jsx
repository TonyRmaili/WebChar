import React from "react";
import { entityKey, sameEntity } from "./wizardHelpers";

/* ═══════════════════════════════════════════════════════════════════
   EntityList — the search box + selectable grid shared by the race,
   background and class-feat pickers. Presentation only; every caller
   supplies its own subtitle renderer and preview handler.

   `selected` accepts either a single entity (race/background — exactly
   one or none picked) or an array of entities (class feat slots — zero
   or more picked). Single-entity callers are unaffected by this.
   ═══════════════════════════════════════════════════════════════════ */

const EyeIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const isPicked = (selected, item) =>
  Array.isArray(selected) ? selected.some((s) => sameEntity(s, item)) : sameEntity(selected, item);

export default function EntityList({
  items = [],
  selected,
  onSelect,
  onPreview,
  loading,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  loadingText = "Loading…",
  emptyText = "Nothing matches.",
  renderSubtitle,
  sourceTitle,
  isDisabled,
}) {
  return (
    <>
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="w-full mb-2 px-3 py-2 rounded-md bg-slate-900 border border-slate-600 text-slate-100 text-sm
                   placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
      />

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-500">{loadingText}</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">{emptyText}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1">
          {items.map((item) => {
            const isSel = isPicked(selected, item);
            const disabled = !isSel && !!isDisabled?.(item);
            const subtitle = renderSubtitle?.(item);

            return (
              <div
                key={entityKey(item)}
                onClick={() => !disabled && onSelect(item)}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors
                  ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                  ${isSel
                    ? "border-amber-500/60 bg-amber-500/10"
                    : "border-slate-700 bg-slate-800/40 hover:bg-slate-800/80 hover:border-amber-500/40"}`}
              >
                <div className="flex-1 min-w-0">
                  <div className={`truncate text-sm font-medium ${isSel ? "text-amber-200" : "text-slate-100"}`}>
                    {item.name}
                  </div>
                  {subtitle && (
                    <div className="truncate text-[11px] text-slate-400">{subtitle}</div>
                  )}
                </div>

                <span
                  className="shrink-0 text-[10px] uppercase tracking-wider text-slate-400 border border-slate-600/40 rounded px-1.5 py-0.5"
                  title={sourceTitle?.(item.source) || item.source}
                >
                  {item.source}
                </span>

                {onPreview && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onPreview(item); }}
                    title="View details"
                    className="shrink-0 p-1.5 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-700/60 transition-colors"
                  >
                    <EyeIcon />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}