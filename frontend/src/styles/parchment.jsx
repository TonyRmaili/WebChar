import React from "react";
import NumberBlank from "./NumberBlank";

/* The parchment style: ink on a parchment sheet, laid on brown leather.
   The house style for new and revisited pages.

   Rules of the style:
   - No boxes inside the sheet. Structure comes from spacing, small-caps
     headings, thin rules and dotted leader lines (Name ........ +5).
   - Inputs are blanks to fill in: a dotted underline, no box.
   - Ink colours only; one rust-red "rubric" colour for emphasis.
   - Serif text, no novelty fonts.
   - Contrast: ink-faint is only for placeholders, separators and
     decoration; anything to be read is ink or ink-faded.
   Everything the style needs is in this file (plus NumberBlank), and
   every colour is a theme slot (themes.css), so Settings can recolour it. */

/* ─── Palette ────────────────────────────────────────────────────── */

/* Colours are theme slots (src/styles/themes.css, tailwind.config.js):
   never write a hex colour in a component. */
export const INK = {
  ink: "text-ink", // main writing
  faded: "text-ink-faded", // labels, hints, small text
  faint: "text-ink-faint", // placeholders, separators, decoration only — not for anything you need to read
  rubric: "text-rubric", // emphasis (proficiency, totals worth noticing)
};

// The leather and the parchment are the surface classes wc-desk and
// wc-page (themes.css), so a theme can change their texture too.

/* ─── Surfaces ───────────────────────────────────────────────────── */

// Leather backdrop with a parchment sheet on it. The sheet is the
// container-query root, so @md/@xl/@4xl inside react to its width.
export function ParchmentSheet({ children }) {
  return (
    <div className="wc-desk relative rounded-2xl p-5">
      {/* Stitched edge, like a leather cover */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-xl border border-dashed border-stitch/30" />
      <div className="wc-page @container relative px-4 py-5 @md:px-7 @md:py-6">
        {children}
      </div>
    </div>
  );
}

/* ─── Writing ────────────────────────────────────────────────────── */

// Page title with an optional line of context after it.
export function Title({ children, after, right }) {
  return (
    <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-2">
      <h3 className="text-2xl tracking-wide">{children}</h3>
      {after}
      {right && <div className="ml-auto flex flex-wrap items-baseline gap-x-4 gap-y-2">{right}</div>}
    </div>
  );
}

// Small-caps heading with a hairline running to the right edge.
export function InkHeading({ children, right }) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      <h4 className={`shrink-0 text-[11px] font-semibold uppercase tracking-[0.25em] ${INK.faded}`}>{children}</h4>
      <span className="h-px flex-1 translate-y-[-3px] bg-rule/30" />
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

// Smaller heading inside a section (e.g. "Consumables" under "Gear").
export const SubHeading = ({ children, count }) => (
  <div className={`mb-1 mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] ${INK.faded}`}>
    {children}
    {count != null && <span className={`ml-1.5 ${INK.faint}`}>{count}</span>}
  </div>
);

// The dotted line between a name and its value.
export const Leader = () => (
  <span aria-hidden="true" className="mx-1.5 min-w-[1rem] flex-1 translate-y-[-4px] border-b-2 border-dotted border-rule/35" />
);

// A labelled line: Label ........ value
export function Line({ label, hint, children, className = "" }) {
  return (
    <div className={`flex items-baseline py-1 ${className}`} title={hint}>
      <span className="shrink-0 text-[15px]">{label}</span>
      <Leader />
      <span className="flex shrink-0 items-baseline gap-1.5">{children}</span>
    </div>
  );
}

// Text-only button, like a note in the margin.
export function InkButton({ children, onClick, active = false, title, className = "", disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`text-xs italic underline decoration-dotted underline-offset-4 transition hover:text-ink disabled:no-underline disabled:opacity-40 ${
        active ? INK.rubric : INK.faded
      } ${className}`}
    >
      {children}
    </button>
  );
}

// A few words where one is chosen: all · some
export function InkChoice({ options, value, onChange, label }) {
  return (
    <span className="inline-flex items-baseline gap-1 text-xs" role="radiogroup" aria-label={label}>
      {options.map((o, i) => (
        <React.Fragment key={o.value}>
          {i > 0 && <span className={INK.faint}>·</span>}
          <button
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={o.value === value ? `font-semibold ${INK.rubric}` : `${INK.faded} hover:text-ink`}
          >
            {o.label}
          </button>
        </React.Fragment>
      ))}
    </span>
  );
}

// ✕ written small in the margin.
export const InkRemove = ({ onClick, label }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label} className={`px-1 text-xs ${INK.faint} hover:text-rubric`}>
    ✕
  </button>
);

/* ─── Blanks to fill in ──────────────────────────────────────────── */

const blank =
  "bg-transparent border-0 border-b border-dotted border-rule/70 rounded-none px-0 " +
  "focus:border-solid focus:border-ink focus:outline-none focus:ring-0 " +
  "placeholder:text-ink-faint text-ink font-body";

export function InkNumber({ className = "", ...props }) {
  return <NumberBlank {...props} className={`${blank} ${className}`} />;
}

export function InkText({ className = "", ...props }) {
  return <input type="text" {...props} className={`${blank} text-left ${className}`} />;
}

// Lined-paper textarea: the dotted rules sit under each line of text.
export function InkTextArea({ className = "", rows = 2, ...props }) {
  return (
    <textarea
      rows={rows}
      {...props}
      className={`wc-lined w-full resize-y border-0 bg-transparent px-0 font-body text-[15px] leading-7 text-ink placeholder:text-ink-faint focus:outline-none focus:ring-0 ${className}`}
    />
  );
}

export function InkSelect({ className = "", children, ...props }) {
  return (
    <select {...props} className={`${blank} cursor-pointer pr-1 ${className}`}>
      {children}
    </select>
  );
}

/* ─── Marks ──────────────────────────────────────────────────────── */

/* Proficiency bubble, like on a paper sheet. Click cycles:
   empty (none) → filled (proficient) → filled with a ring (expertise). */

export const PROF_LEVELS = ["none", "proficient", "expertise"];
const PROF_TITLES = {
  none: "Not proficient — click to make proficient",
  proficient: "Proficient — click for expertise",
  expertise: "Expertise — click to clear",
};

export function Bubble({ level = "none", onClick, label }) {
  const filled = level !== "none";
  return (
    <button
      type="button"
      onClick={onClick}
      title={PROF_TITLES[level]}
      aria-label={`${label}: ${level}`}
      className="group relative inline-flex h-5 w-5 shrink-0 items-center justify-center"
    >
      {level === "expertise" && <span className="absolute inset-0 rounded-full border border-rubric/80" />}
      <span
        className={`h-2.5 w-2.5 rounded-full border-[1.5px] transition ${
          filled ? "border-rubric bg-rubric" : "border-rule/70 group-hover:border-ink"
        }`}
      />
    </button>
  );
}

// On/off diamond (attuned, consumable, hover, save DC shown in Play…).
export function Mark({ on, onClick, label, title, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-label={label}
      title={title || label}
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}
      className={`group inline-flex h-5 w-5 shrink-0 items-center justify-center ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <span
        className={`h-2.5 w-2.5 rotate-45 border-[1.5px] transition ${
          on ? "border-rubric bg-rubric" : "border-rule/70 group-hover:border-ink"
        }`}
      />
    </button>
  );
}