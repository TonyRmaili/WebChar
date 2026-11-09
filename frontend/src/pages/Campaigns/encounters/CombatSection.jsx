import React, { useState } from "react";
import { INK } from "../../../styles/parchment";
import { Chevron } from "../../../styles/parchmentForm";

/* A section of the Combat page (Party, NPCs, Monster shelf, Templates,
   Groups, Encounters) that folds shut. Looks like InkHeading with an
   arrow; folded, it shows `summary` instead of its content. Whether it is
   open is remembered per section in this browser. */

function useStoredOpen(key) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== "0";
    } catch {
      return true;
    }
  });
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(key, o ? "0" : "1");
      } catch {
        /* not remembered — fine */
      }
      return !o;
    });
  return [open, toggle];
}

export default function CombatSection({ id, title, summary, right, children }) {
  const [open, toggle] = useStoredOpen(`combat.fold.${id}`);
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-baseline gap-3">
        <button type="button" onClick={toggle} aria-expanded={open} className="group flex shrink-0 items-center gap-2 self-center">
          <Chevron open={open} />
          <h4 className={`text-[11px] font-semibold uppercase tracking-[0.25em] ${INK.faded} group-hover:text-ink`}>{title}</h4>
        </button>
        {!open && summary && <span className={`shrink-0 text-xs italic ${INK.faint}`}>{summary}</span>}
        <span className="h-px flex-1 translate-y-[-3px] bg-rule/30" />
        {open && right && <div className="shrink-0">{right}</div>}
      </div>
      {open && children}
    </section>
  );
}