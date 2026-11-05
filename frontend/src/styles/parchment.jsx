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
   Everything the style needs is in this file (plus NumberBlank). */

/* ─── Palette ────────────────────────────────────────────────────── */

export const INK = {
  ink: "text-[#3a2716]", // main writing
  faded: "text-[#7b6346]", // labels, hints
  faint: "text-[#a08a68]", // placeholders, quiet marks
  rubric: "text-[#9a3412]", // emphasis (proficiency, totals worth noticing)
};

// Small SVG noise used as paper / leather grain.
const grain = (alpha, freq) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${alpha} 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`
  )}")`;

const LEATHER_STYLE = {
  backgroundColor: "#3a2618",
  backgroundImage: [
    grain(0.45, 0.65),
    "radial-gradient(ellipse at 25% 0%, rgba(150,100,55,0.35), transparent 55%)",
    "radial-gradient(ellipse at 100% 100%, rgba(0,0,0,0.5), transparent 60%)",
  ].join(","),
  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 0 40px rgba(0,0,0,0.55)",
};

const PARCHMENT_STYLE = {
  backgroundColor: "#e6d7b4",
  backgroundImage: [
    grain(0.12, 0.9),
    "radial-gradient(ellipse at 50% 40%, rgba(255,250,235,0.55), transparent 70%)",
    "radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(120,80,30,0.28) 100%)",
  ].join(","),
  boxShadow: "0 2px 0 rgba(0,0,0,0.25), 0 10px 30px rgba(0,0,0,0.55), inset 0 0 50px rgba(110,70,25,0.25)",
};

/* ─── Surfaces ───────────────────────────────────────────────────── */

// Leather backdrop with a parchment sheet on it. The sheet is the
// container-query root, so @md/@xl/@4xl inside react to its width.
export function ParchmentSheet({ children }) {
  return (
    <div className="relative rounded-2xl p-5" style={LEATHER_STYLE}>
      {/* Stitched edge, like a leather cover */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-xl border border-dashed border-[#c8a26b]/30" />
      <div className={`@container relative rounded-[3px] px-4 py-5 font-serif @md:px-7 @md:py-6 ${INK.ink}`} style={PARCHMENT_STYLE}>
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
      <span className="h-px flex-1 translate-y-[-3px] bg-[#7b6346]/30" />
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
  <span aria-hidden="true" className="mx-1.5 min-w-[1rem] flex-1 translate-y-[-4px] border-b-2 border-dotted border-[#7b6346]/35" />
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
      className={`text-xs italic underline decoration-dotted underline-offset-4 transition hover:text-[#3a2716] disabled:no-underline disabled:opacity-40 ${
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
            className={o.value === value ? `font-semibold ${INK.rubric}` : `${INK.faded} hover:text-[#3a2716]`}
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
  <button type="button" onClick={onClick} aria-label={label} title={label} className={`px-1 text-xs ${INK.faint} hover:text-[#9a3412]`}>
    ✕
  </button>
);

/* ─── Blanks to fill in ──────────────────────────────────────────── */

const blank =
  "bg-transparent border-0 border-b border-dotted border-[#7b6346]/70 rounded-none px-0 " +
  "focus:border-solid focus:border-[#3a2716] focus:outline-none focus:ring-0 " +
  "placeholder:text-[#a08a68] text-[#3a2716] font-serif";

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
      className={`w-full resize-y border-0 bg-transparent px-0 font-serif text-[15px] leading-7 text-[#3a2716] placeholder:text-[#a08a68] focus:outline-none focus:ring-0 ${className}`}
      style={{
        backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgba(123,99,70,0.45) 27px, rgba(123,99,70,0.45) 28px)",
        backgroundAttachment: "local",
      }}
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
      {level === "expertise" && <span className="absolute inset-0 rounded-full border border-[#9a3412]/80" />}
      <span
        className={`h-2.5 w-2.5 rounded-full border-[1.5px] transition ${
          filled ? "border-[#9a3412] bg-[#9a3412]" : "border-[#7b6346]/70 group-hover:border-[#3a2716]"
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
          on ? "border-[#9a3412] bg-[#9a3412]" : "border-[#7b6346]/70 group-hover:border-[#3a2716]"
        }`}
      />
    </button>
  );
}