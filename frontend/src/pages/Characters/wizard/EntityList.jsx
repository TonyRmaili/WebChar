import React from "react";
import { INK, InkButton, InkText } from "../../../styles/parchment";
import { entityKey, sameEntity } from "./wizardHelpers";

/* ═══════════════════════════════════════════════════════════════════
   EntityList — the search line + list shared by the race, background
   and class-feat pickers. Presentation only; every caller supplies its
   own subtitle renderer and preview handler.

   Written like a ledger: one entry per line, the book it comes from in
   the margin, "view" opens the catalogue card.

   `selected` accepts either a single entity (race/background — exactly
   one or none picked) or an array of entities (class feat slots — zero
   or more picked). Entries are matched on name AND source, so the two
   "Alert"s (PHB and XPHB) are never confused.
   ═══════════════════════════════════════════════════════════════════ */

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
    <div>
      <div className="mb-2 flex items-baseline gap-3">
        <span className={`shrink-0 text-sm italic ${INK.faded}`}>Find</span>
        <InkText
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-8 w-full max-w-xs text-[15px]"
        />
        {!loading && (
          <span className={`ml-auto shrink-0 text-xs italic ${INK.faint}`}>
            {items.length} {items.length === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      {loading ? (
        <p className={`py-6 text-center italic ${INK.faint}`}>{loadingText}</p>
      ) : items.length === 0 ? (
        <p className={`py-6 text-center italic ${INK.faint}`}>{emptyText}</p>
      ) : (
        <ul className="grid max-h-[22rem] grid-cols-1 gap-x-8 overflow-y-auto pr-2 @2xl:grid-cols-2 @6xl:grid-cols-3">
          {items.map((item) => {
            const on = isPicked(selected, item);
            const disabled = !on && !!isDisabled?.(item);
            const subtitle = renderSubtitle?.(item);

            return (
              <li key={entityKey(item)} className="flex items-start gap-2 border-b border-dotted border-[#7b6346]/25 py-1.5">
                <button
                  type="button"
                  onClick={() => !disabled && onSelect(item)}
                  disabled={disabled}
                  aria-pressed={on}
                  className="group flex min-w-0 flex-1 items-start gap-2 text-left disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-[7px] inline-block h-2 w-2 shrink-0 rotate-45 border-[1.5px] transition ${
                      on ? "border-[#9a3412] bg-[#9a3412]" : "border-[#7b6346]/70 group-hover:border-[#3a2716]"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[15px] ${
                        on ? `font-semibold ${INK.rubric}` : "group-hover:underline group-hover:decoration-dotted group-hover:underline-offset-4"
                      }`}
                    >
                      {item.name}
                    </span>
                    {subtitle && <span className={`block truncate text-xs italic ${INK.faded}`}>{subtitle}</span>}
                  </span>
                </button>

                <span
                  className={`shrink-0 pt-1 text-[10px] uppercase tracking-wider ${INK.faint}`}
                  title={sourceTitle?.(item.source) || item.source}
                >
                  {item.source}
                </span>

                {onPreview && (
                  <InkButton onClick={() => onPreview(item)} title={`Read about ${item.name}`} className="shrink-0 pt-0.5">
                    view
                  </InkButton>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}