import React from "react";
import { RAIL_CLS } from "./sheet/SplitPanels";

/* The Characters page's Sheets / Create switch. It used to be a tab strip
   across the top; now it lives in the left rail, under the Play panel's
   open/close button (Sheets), or in a rail of its own beside the roster
   (Create) — the same spot either way, and no room taken at the top. */

export const VIEWS = [
  {
    id: "sheets",
    label: "Sheets",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[18px] w-[18px]" aria-hidden="true">
        <path d="M5 2.75h7l3 3v11.5H5z" strokeLinejoin="round" />
        <path d="M7.5 9h5M7.5 12h5M7.5 15h3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "create",
    label: "Create",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[18px] w-[18px]" aria-hidden="true">
        <circle cx="10" cy="10" r="7.25" />
        <path d="M10 6.5v7M6.5 10h7" strokeLinecap="round" />
      </svg>
    ),
  },
];

// The two buttons, stacked — goes inside a rail. `divider`: a line above
// them, when they sit under other rail controls.
export function ViewSwitch({ view, onView, divider = true }) {
  return (
    <div className={`flex flex-col items-center gap-1 ${divider ? "mt-1 border-t border-slate-700 pt-2" : ""}`}>
      {VIEWS.map((v) => {
        const active = v.id === view;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onView(v.id)}
            aria-pressed={active}
            title={v.label}
            className={`flex w-9 flex-col items-center gap-0.5 rounded-lg py-1 transition ${
              active ? "bg-amber-500/15 text-amber-300" : "text-slate-400 hover:bg-slate-900 hover:text-amber-300"
            }`}
          >
            {v.icon}
            <span className="text-[9px] font-semibold uppercase tracking-wider">{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// A rail of its own on the left, for pages without the Play / Define panels.
export function WithViewRail({ view, onView, children }) {
  return (
    <div className="flex w-full items-start gap-4">
      <aside className={RAIL_CLS}>
        <ViewSwitch view={view} onView={onView} divider={false} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}