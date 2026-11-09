import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { addBtn, chipBtn, ghostBtn, inputBase } from "../../styles/parchmentForm";

/* ═══════════════════════════════════════════════════════════════════
   catalogueStyle — the look every catalogue page shares, in the
   parchment style (it sits on the parchment sheet CataloguesMain draws).

     chip(active)       a filter word in the filter popup (rubric when on)
     searchCls          the search blank (dotted line, no box)
     <SortControl>      "sort by level  ↑ ↓"
     <Toolbar>          filters · search · sort, in one row
     rowCls             a list row: no box, a dotted line under it, a faint
                        wash on hover
     <RowTag>           small capitals next to a name (level, source, …)
     <ErrorLine>        a problem, written in the bad ink
     <LoadingLine>      "Fetching spells…"

   The create / edit forms (Items, Feats, Races, …) share:
     <CreateModal>      the window: a parchment card over a darkened page,
                        title, ×, a scrolling body, and Cancel / Save with
                        the save error
     fieldCls           an input or select: a dotted blank, full width
     textareaCls        a text area: lined paper
     labelCls           a field's label in small capitals
     checkCls / checkLabelCls   a checkbox and its words
     addRowCls / removeRowCls   "+ add …" and the ✕ on a row
     boxCls             a group of fields: a hairline down the left
     hintCls            a quiet italic note ("None yet. Add one below.")
     <ChipsHeading>     the fold-out heading of a long list of choices

   Colours are theme slots only (see themes.css).
   ═══════════════════════════════════════════════════════════════════ */

export const chip = (active) => `${chipBtn(active)} text-left`;

export const searchCls = `${inputBase} w-full`;

export function SortControl({ label = "sort", value, onChange }) {
  const arrow = (dir, sign, title) => (
    <button
      type="button"
      onClick={() => onChange(value === dir ? null : dir)}
      title={title}
      aria-label={title}
      aria-pressed={value === dir}
      className={`px-1 text-sm leading-none transition ${value === dir ? "font-semibold text-rubric" : "text-ink-faded hover:text-ink"}`}
    >
      {sign}
    </button>
  );
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="mr-1 text-xs italic text-ink-faded">{label}</span>
      {arrow("asc", "↑", "Sort ascending")}
      {arrow("desc", "↓", "Sort descending")}
    </span>
  );
}

export function Toolbar({ filters, search, sort, right }) {
  return (
    <div className="mb-5 flex flex-wrap items-baseline gap-x-5 gap-y-2">
      {filters}
      {search && <div className="min-w-[12rem] max-w-sm flex-1">{search}</div>}
      <div className="ml-auto flex flex-wrap items-baseline gap-x-5 gap-y-1">
        {sort}
        {right}
      </div>
    </div>
  );
}

export const rowCls =
  "group flex w-full items-baseline gap-3 border-b border-dotted border-rule/30 px-1.5 py-1.5 text-left transition-colors hover:bg-ink/[0.05]";

// Name inside a row: ink, rubric when the row is hovered.
export const rowNameCls = "min-w-0 flex-1 truncate text-[15px] text-ink group-hover:text-rubric";

export const RowTag = ({ children, title, className = "" }) => (
  <span title={title} className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider text-ink-faded ${className}`}>
    {children}
  </span>
);

export const ErrorLine = ({ children }) => <p className="mb-3 text-sm italic text-bad">{children}</p>;

export const LoadingLine = ({ children }) => <p className="py-6 text-sm italic text-ink-faded">{children}</p>;

/* ─── create / edit forms ────────────────────────────────────────── */

export const fieldCls = `${inputBase} w-full`;
export const textareaCls =
  "wc-lined w-full resize-y border-0 bg-transparent px-0 font-body text-[15px] leading-7 text-ink placeholder:text-ink-faint focus:outline-none focus:ring-0";
export const labelCls = "mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faded";
export const checkCls = "h-3.5 w-3.5 accent-rubric";
export const checkLabelCls = "flex cursor-pointer items-center gap-2 text-[15px] text-ink";
export const addRowCls = addBtn;
export const removeRowCls = "px-1 text-xs text-ink-faded transition hover:text-rubric";
export const boxCls = "space-y-2 border-l border-rule/30 pl-3";
export const hintCls = "text-xs italic text-ink-faded";

// The fold-out heading over a long list of choices ("▶ Resistances (2)").
export function ChipsHeading({ open, onToggle, label, count }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="mb-1 flex select-none items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faded transition hover:text-rubric"
    >
      <span className={`inline-block text-[9px] transition-transform duration-150 ${open ? "rotate-90" : ""}`}>▶</span>
      <span>{label}</span>
      {count > 0 && <span className="ml-1 normal-case tracking-normal text-rubric">({count})</span>}
    </button>
  );
}

const CARD_EDGE = "0 0 0 1px rgb(var(--c-desk) / 0.6), 0 20px 48px rgba(0,0,0,0.6)";

/* The create / edit window. Escape or a click outside closes it; the page
   behind doesn't scroll while it's open. saveDisabled greys the save button
   out until the form is ready (e.g. no folder picked yet). Campaign modals
   (new campaign, move to, save to) use it too. */
export function CreateModal({ open, title, onClose, onSave, saving = false, saveDisabled = false, saveLabel = "Save", error, width = "max-w-3xl", children }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className={`wc-page flex max-h-[90vh] w-full ${width} flex-col overflow-hidden`}
        style={{ boxShadow: CARD_EDGE }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between px-6 pb-2 pt-4">
          <h2 className="text-xl tracking-wide">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="px-1 text-lg text-ink-faded transition hover:text-rubric">
            ×
          </button>
        </div>
        <div className="mx-6 h-px bg-rule/30" />

        <div className="flex-1 space-y-1 overflow-y-auto px-6 py-4">{children}</div>

        <div className="mx-6 h-px bg-rule/30" />
        <div className="flex items-baseline justify-between gap-4 px-6 py-3">
          {error ? <span className="min-w-0 flex-1 truncate text-xs italic text-bad">{error}</span> : <span className="flex-1" />}
          <button type="button" onClick={onClose} className={ghostBtn}>
            cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || saveDisabled}
            className="rounded-md border border-rubric/60 px-4 py-1 text-sm text-rubric transition hover:bg-rubric hover:text-page-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : saveLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}