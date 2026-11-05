import React, { useEffect } from "react";

export default function FilterPopup({ open, onClose, activeCount, onClear, children }) {
  // Lock body scroll + Escape to close.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[85vh] flex flex-col
                   bg-slate-900 border border-slate-700 rounded-lg shadow-2xl
                   overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <h2 className="text-amber-400 font-semibold uppercase tracking-wider text-sm">
              Filters
            </h2>
            {activeCount > 0 && (
              <span className="text-[10px] uppercase tracking-wider text-amber-300
                               border border-amber-500/40 rounded px-1.5 py-0.5">
                {activeCount} active
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-2 text-slate-400 hover:text-slate-100 transition text-lg"
            aria-label="Close filters"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-700">
          <button
            onClick={onClear}
            className="text-[11px] px-3 py-1.5 rounded border transition
                       bg-slate-800/60 border-slate-600 text-slate-400
                       hover:border-red-500/40 hover:text-red-300"
          >
            Clear all
          </button>
          <button
            onClick={onClose}
            className="text-[11px] px-3 py-1.5 rounded border transition
                       bg-amber-500/20 border-amber-500/50 text-amber-300
                       hover:bg-amber-500/30"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Small trigger button to keep usage consistent across catalogues.
export function FilterButton({ activeCount, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border transition
                 bg-slate-800/60 border-slate-700 text-slate-200
                 hover:border-amber-500/40 hover:text-amber-300"
    >
      <span className="text-[11px] uppercase tracking-wider">Filters</span>
      {activeCount > 0 && (
        <span className="text-[10px] uppercase tracking-wider text-amber-300
                         border border-amber-500/40 rounded px-1.5 py-0.5">
          {activeCount}
        </span>
      )}
    </button>
  );
}