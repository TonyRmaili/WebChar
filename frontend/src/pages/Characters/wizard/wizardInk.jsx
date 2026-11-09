import React from "react";
import { INK } from "../../../styles/parchment";

/* Small pieces the builder steps share, in the parchment style.
   (Page-wide pieces — headings, blanks, marks — live in styles/parchment.) */

// The diamond (or dot, for pick-one rows) in front of an option.
function Bullet({ on, round }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 shrink-0 border-[1.5px] transition ${round ? "rounded-full" : "rotate-45"} ${
        on ? "border-rubric bg-rubric" : "border-rule/70 group-hover:border-ink"
      }`}
    />
  );
}

/* One option you can pick: ◇ Stealth. Picked ones are inked in rubric.
   `warn` marks an option something else already gives you (picking it
   would waste the choice); `title` explains why. */
export function Pick({ on, onClick, children, warn = false, round = false, disabled = false, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={!!on}
      className={`group inline-flex items-center gap-2 py-0.5 text-left text-[15px] leading-snug transition disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? `font-semibold ${INK.rubric}` : warn ? INK.faded : "hover:text-black"
      }`}
    >
      <Bullet on={on} round={round} />
      <span className={warn ? "underline decoration-rubric/60 decoration-wavy underline-offset-4" : ""}>{children}</span>
      {warn && <span className={`text-[11px] ${INK.rubric}`}>⚠</span>}
    </button>
  );
}

// A row of picks that wraps.
export const PickRow = ({ children, className = "" }) => (
  <div className={`flex flex-wrap gap-x-5 gap-y-1 ${className}`}>{children}</div>
);

/* The line above a choice: SKILLS  choose 2 · 1 left   …   from Fighter */
export function ChoiceHead({ title, need, done = false, owner, children }) {
  return (
    <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <span className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${INK.faded}`}>{title}</span>
      {need && <span className={`text-xs italic ${done ? INK.faint : INK.rubric}`}>{need}</span>}
      {children}
      {owner && <span className={`ml-auto text-xs italic ${INK.faint}`}>from {owner}</span>}
    </div>
  );
}

/* − 4 +  written inline. */
export function Stepper({ value, min = 1, max, onChange, label }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  const btn = `w-6 text-lg leading-none transition ${INK.faded} hover:text-ink disabled:opacity-30`;
  return (
    <span className="inline-flex items-baseline" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => set(value - 1)} disabled={value <= min} aria-label={`Lower ${label}`}>
        −
      </button>
      <span className="min-w-[1.75rem] text-center text-xl tabular-nums">{value}</span>
      <button type="button" className={btn} onClick={() => set(value + 1)} disabled={value >= max} aria-label={`Raise ${label}`}>
        +
      </button>
    </span>
  );
}

// A quiet italic line (hints, "nothing to choose", notes).
export const Note = ({ children, tone = "faint", className = "" }) => (
  <p className={`text-sm italic ${tone === "rubric" ? INK.rubric : tone === "faded" ? INK.faded : INK.faint} ${className}`}>{children}</p>
);

// The hairline that separates a picker from the choices it creates.
export const Rule = () => <div className="my-5 h-px bg-rule/25" />;