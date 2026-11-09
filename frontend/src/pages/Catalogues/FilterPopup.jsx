import React, { useEffect } from "react";

/* The catalogues' filter window: a parchment card with a thin leather
   edge over a darkened page. Escape or a click outside closes it. */

const CARD_EDGE = "0 0 0 1px rgb(var(--c-desk) / 0.6), 0 20px 48px rgba(0,0,0,0.6)";
const note = "text-xs italic underline decoration-dotted underline-offset-4 transition";

export default function FilterPopup({ open, onClose, activeCount, onClear, children }) {
  // Lock body scroll + Escape to close.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Filters"
        className="wc-page flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden"
        style={{ boxShadow: CARD_EDGE }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-baseline justify-between gap-3 px-6 pb-2 pt-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl tracking-wide">Filters</h2>
            {activeCount > 0 && <span className="text-sm italic text-rubric">{activeCount} active</span>}
          </div>
          <button onClick={onClose} className="px-1 text-lg text-ink-faded transition hover:text-rubric" aria-label="Close filters">
            ×
          </button>
        </div>
        <div className="mx-6 h-px bg-rule/30" />

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {/* Footer */}
        <div className="mx-6 h-px bg-rule/30" />
        <div className="flex items-baseline justify-between px-6 py-3">
          <button onClick={onClear} disabled={!activeCount} className={`${note} text-ink-faded hover:text-rubric disabled:no-underline disabled:opacity-40`}>
            clear all
          </button>
          <button onClick={onClose} className="rounded-md border border-rubric/60 px-4 py-1 text-sm text-rubric transition hover:bg-rubric hover:text-page-light">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// The trigger, the same on every catalogue: "filters" as a margin note,
// with the number of active filters in rubric.
export function FilterButton({ activeCount, onClick }) {
  return (
    <button onClick={onClick} className={`inline-flex items-baseline gap-1.5 ${note} !text-sm ${activeCount ? "text-rubric" : "text-ink-faded"} hover:text-rubric`}>
      filters
      {activeCount > 0 && <span className="text-xs font-semibold not-italic tabular-nums">({activeCount})</span>}
    </button>
  );
}