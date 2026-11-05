import React from "react";
import { usePersistedOpen } from "../../../utils/SectionCard";

/* Two side-by-side panels with a fixed 50/50 split.

   Each panel has a slim rail on its outer screen edge that is always
   visible. The rail holds the open/close button, the panel's label, and
   any extra controls the page passes in (the define tabs, for example).

   - Both open: each panel takes exactly half the width.
   - One closed: only its rail shows, the other panel fills the rest.
   - Both can never be closed: closing the last open panel opens the other.

   A closed panel is hidden, not unmounted, so anything typed into it
   (pickers, filters, amounts) survives a collapse. Open/closed state is
   remembered in the browser between visits. */

function Arrow({ pointsLeft }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform ${pointsLeft ? "rotate-180" : ""}`}
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

function Rail({ side, label, open, onToggle, extra }) {
  // The arrow points the way the panel will move when clicked:
  // an open left panel collapses toward the left edge, and so on.
  const pointsLeft = side === "left" ? open : !open;
  const action = open ? "Collapse" : "Expand";

  return (
    <aside className="sticky top-3 flex max-h-[calc(100vh-1.5rem)] w-11 shrink-0 flex-col items-center gap-2 self-start overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/60 py-2 shadow-md">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        title={`${action} ${label}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-600 bg-slate-900 text-slate-300 transition hover:border-amber-500/60 hover:text-amber-300"
      >
        <Arrow pointsLeft={pointsLeft} />
      </button>

      <button
        type="button"
        onClick={onToggle}
        title={`${action} ${label}`}
        className="select-none py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-400/90 transition [writing-mode:vertical-rl] hover:text-amber-300"
      >
        {label}
      </button>

      {extra}
    </aside>
  );
}

function Panel({ side, label, open, onToggle, extra, children }) {
  const rail = (
    <Rail side={side} label={label} open={open} onToggle={onToggle} extra={extra} />
  );
  const body = <div className={open ? "min-w-0 flex-1" : "hidden"}>{children}</div>;

  return (
    <div className={`flex gap-2 ${open ? "min-w-0 flex-1" : "flex-none"}`}>
      {side === "left" ? (
        <>
          {rail}
          {body}
        </>
      ) : (
        <>
          {body}
          {rail}
        </>
      )}
    </div>
  );
}

/* left / right: { label, content, rail }
   `rail` is optional: a function receiving { open, openPanel } that
   returns extra controls to show in that panel's rail. */
export default function SplitPanels({ storageKey = "split", left, right }) {
  const [leftStored, setLeftOpen] = usePersistedOpen(`${storageKey}.left`, true);
  const [rightOpen, setRightOpen] = usePersistedOpen(`${storageKey}.right`, true);

  // If both were stored closed, show the left one anyway.
  const leftOpen = leftStored || !rightOpen;

  const toggleLeft = () => {
    if (leftOpen && !rightOpen) setRightOpen(true);
    setLeftOpen(!leftOpen);
  };

  const toggleRight = () => {
    // Pin the left panel to what is on screen, and reopen it if the
    // right panel is the last one open.
    setLeftOpen(rightOpen && !leftOpen ? true : leftOpen);
    setRightOpen(!rightOpen);
  };

  const openLeft = () => setLeftOpen(true);
  const openRight = () => {
    setLeftOpen(leftOpen);
    setRightOpen(true);
  };

  return (
    <div className="flex w-full items-start gap-4">
      <Panel
        side="left"
        label={left.label}
        open={leftOpen}
        onToggle={toggleLeft}
        extra={left.rail?.({ open: leftOpen, openPanel: openLeft })}
      >
        {left.content}
      </Panel>

      <Panel
        side="right"
        label={right.label}
        open={rightOpen}
        onToggle={toggleRight}
        extra={right.rail?.({ open: rightOpen, openPanel: openRight })}
      >
        {right.content}
      </Panel>
    </div>
  );
}