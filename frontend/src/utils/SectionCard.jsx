import React, { useCallback, useState } from "react";

/* Open/closed state, remembered per section in the browser.
   Storage can be blocked or empty, so every access is guarded and the
   default is used whenever nothing is stored. */
const readOpen = (key, fallback) => {
  if (!key) return fallback;
  try {
    const value = localStorage.getItem(key);
    return value == null ? fallback : value === "1";
  } catch {
    return fallback;
  }
};

export function usePersistedOpen(storageKey, defaultOpen = true) {
  const [open, setOpenState] = useState(() => readOpen(storageKey, defaultOpen));

  const setOpen = useCallback(
    (next) => {
      setOpenState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, value ? "1" : "0");
          } catch {
            /* storage blocked: the state still works for this visit */
          }
        }
        return value;
      });
    },
    [storageKey]
  );

  return [open, setOpen];
}

export function Chevron({ open, className = "" }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
        open ? "rotate-90" : ""
      } ${className}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01-.02-1.06L10.94 10 7.2 6.29a.75.75 0 111.06-1.06l4.24 4.24a.75.75 0 010 1.06l-4.24 4.24a.75.75 0 01-1.06 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* A section card whose body can be collapsed by clicking its title.
   `actions` stays visible while collapsed. It can be a node, or a
   function receiving setOpen, so a button like "Add" can also open
   the section. */
export function CollapsibleCard({
  title,
  count,
  actions,
  storageKey,
  defaultOpen = true,
  children,
}) {
  const [open, setOpen] = usePersistedOpen(storageKey, defaultOpen);
  const renderedActions = typeof actions === "function" ? actions(setOpen) : actions;

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/40">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-2 min-w-0 text-left"
        >
          <Chevron open={open} />
          <h3 className="text-lg font-semibold text-orange-300">{title}</h3>
          {count != null && <span className="text-slate-400 text-sm">({count})</span>}
        </button>
        {renderedActions && (
          <div className="ml-auto flex flex-wrap items-center gap-2">{renderedActions}</div>
        )}
      </header>

      {open && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </section>
  );
}