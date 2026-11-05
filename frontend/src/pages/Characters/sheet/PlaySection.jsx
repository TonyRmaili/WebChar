import React from "react";
import { usePersistedOpen, Chevron } from "../../../utils/SectionCard";

/* One collapsible block in the Play panel (Health, Charges, Minions).

   The header is a slim divider line: chevron + title + rule. Clicking it
   folds the body away. The body is hidden rather than removed, so typed
   amounts and open minion popups survive a collapse.

   `boxed` wraps the body in a card. Health leaves it off because
   HealthPlay already draws its own card. `empty` shows a short hint
   instead of the body when there is nothing to play with. */
export default function PlaySection({
  title,
  storageKey,
  boxed = true,
  empty = null,
  children,
}) {
  const [open, setOpen] = usePersistedOpen(storageKey, true);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group mb-2 flex w-full items-center gap-2 text-left"
      >
        <Chevron open={open} className="group-hover:text-amber-300" />
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90 group-hover:text-amber-300">
          {title}
        </h3>
        <span className="h-px flex-1 bg-slate-700" />
      </button>

      <div className={open ? "" : "hidden"}>
        {empty ? (
          <p className="rounded-xl border border-dashed border-slate-700 px-4 py-3 text-sm text-slate-500">
            {empty}
          </p>
        ) : boxed ? (
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}