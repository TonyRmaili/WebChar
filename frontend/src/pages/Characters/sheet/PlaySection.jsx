import React from "react";
import { usePersistedOpen, Chevron } from "../../../utils/SectionCard";

/* One collapsible block in the Play panel (Health, Charges, Minions),
   written on the Play sheet (parchment).

   The header is a small-caps heading with a hairline: chevron + title +
   rule. Clicking it folds the body away. The body is hidden rather than
   removed, so typed amounts and open minion popups survive a collapse.

   No boxes on the parchment. `empty` shows a quiet hint instead of the
   body when there is nothing to play with. */
export default function PlaySection({ title, storageKey, empty = null, children }) {
  const [open, setOpen] = usePersistedOpen(storageKey, true);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group mb-2 flex w-full items-center gap-2 text-left"
      >
        <Chevron open={open} className="text-ink-faded group-hover:text-rubric" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-faded group-hover:text-rubric">
          {title}
        </h3>
        <span className="h-px flex-1 bg-rule/30" />
      </button>

      <div className={open ? "" : "hidden"}>
        {empty ? <p className="text-sm italic text-ink-faded">{empty}</p> : children}
      </div>
    </section>
  );
}