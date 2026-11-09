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

// ▸ that turns ▾ when open. It takes the colour of the text around it
// (pass a text-… class to change it).
export function Chevron({ open, className = "" }) {
  return (
    <svg className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""} ${className}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01-.02-1.06L10.94 10 7.2 6.29a.75.75 0 111.06-1.06l4.24 4.24a.75.75 0 010 1.06l-4.24 4.24a.75.75 0 01-1.06 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* A section whose body can be collapsed by clicking its title, in the
   parchment style: a heading with a hairline, no box (use it on a
   ParchmentSheet). `actions` stays visible while collapsed. It can be a
   node, or a function receiving setOpen, so a button like "Add" can also
   open the section. */
export function CollapsibleCard({ title, count, actions, storageKey, defaultOpen = true, children }) {
  const [open, setOpen] = usePersistedOpen(storageKey, defaultOpen);
  const renderedActions = typeof actions === "function" ? actions(setOpen) : actions;

  return (
    <section>
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="group flex min-w-0 items-center gap-2 text-left text-ink-faded">
          <Chevron open={open} />
          <h3 className="text-lg tracking-wide text-ink group-hover:text-rubric">{title}</h3>
          {count != null && <span className="text-sm tabular-nums text-ink-faded">{count}</span>}
        </button>
        <span className="h-px min-w-[2rem] flex-1 bg-rule/30" />
        {renderedActions && <div className="flex flex-wrap items-center gap-x-4 gap-y-1">{renderedActions}</div>}
      </header>

      {open && <div className="space-y-4">{children}</div>}
    </section>
  );
}