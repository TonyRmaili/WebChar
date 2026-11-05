import React from "react";
import NumberBlank from "./NumberBlank";

/* Alternative style, currently unused (the parchment style won).

   "Grimoire" look: an old, darkened page laid on dried
   reptile hide. A darker, more menacing sibling of parchment.jsx (which
   is left untouched). Same rules as the parchment style:
   - No boxes inside the page. Structure comes from spacing, small-caps
     headings with ornaments, hairlines and dotted leaders.
   - Inputs are blanks to fill in: a dotted underline, no box.
   - Ink colours only; a dried-blood crimson for emphasis.
   Everything is drawn with CSS gradients and inline SVG noise — no images. */

/* ─── Palette ────────────────────────────────────────────────────── */

export const INK = {
  ink: "text-[#24160c]", // main writing
  faded: "text-[#4e3824]", // labels
  faint: "text-[#6f5538]", // placeholders, quiet marks
  blood: "text-[#7a1712]", // emphasis
};
export const BLOOD = "#7a1712";

// SVG noise; `scale` makes it coarse (cracks) or fine (grain).
const noise = (alpha, freq, octaves = 3, seed = 3) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${alpha} 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`
  )}")`;

// Thin dark cracks: high-contrast turbulence thresholded into veins.
const cracks = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='c'><feTurbulence type='turbulence' baseFrequency='0.018' numOctaves='2' seed='11'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -9 1.2'/></filter><rect width='100%' height='100%' filter='url(#c)' opacity='0.5'/></svg>`
)}")`;

/* Dried lizard hide: rows of overlapping scales (offset half a scale),
   each with a dark rim and a faint ridge highlight, under coarse grain,
   thin cracks and a heavy vignette. */
const SCALE = "26px 18px";
const HIDE_STYLE = {
  backgroundColor: "#241510",
  backgroundImage: [
    "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.6) 100%)", // vignette
    cracks,
    noise(0.45, 0.8, 3, 7),
    // scale ridges (two offset rows)
    "radial-gradient(ellipse 50% 70% at 50% 0%, rgba(170,95,60,0.24), transparent 70%)",
    "radial-gradient(ellipse 50% 70% at 50% 0%, rgba(170,95,60,0.24), transparent 70%)",
    // scale rims
    "radial-gradient(ellipse 52% 75% at 50% 0%, transparent 80%, rgba(0,0,0,0.7) 91%, transparent 100%)",
    "radial-gradient(ellipse 52% 75% at 50% 0%, transparent 80%, rgba(0,0,0,0.7) 91%, transparent 100%)",
    "linear-gradient(160deg, #3d2219, #23130e 55%, #33170f)",
  ].join(","),
  backgroundSize: ["100% 100%", "300px 300px", "220px 220px", SCALE, SCALE, SCALE, SCALE, "100% 100%"].join(","),
  backgroundPosition: ["0 0", "0 0", "0 0", "0 0", "13px 9px", "0 0", "13px 9px", "0 0"].join(","),
  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.7), inset 0 0 36px rgba(0,0,0,0.65)",
};

// Aged page: darker, browner than the parchment, scorched at the edges,
// with a couple of faint stains.
const PAGE_STYLE = {
  backgroundColor: "#c7b086",
  backgroundImage: [
    noise(0.16, 0.85, 3, 2),
    "radial-gradient(ellipse at 18% 22%, rgba(95,60,25,0.16), transparent 22%)",
    "radial-gradient(ellipse at 82% 70%, rgba(95,60,25,0.14), transparent 26%)",
    "radial-gradient(ellipse at 50% 35%, rgba(240,225,190,0.35), transparent 65%)",
    "radial-gradient(ellipse at 50% 50%, transparent 58%, rgba(70,38,12,0.42) 100%)",
  ].join(","),
  boxShadow: "0 2px 0 rgba(0,0,0,0.4), 0 14px 40px rgba(0,0,0,0.75), inset 0 0 70px rgba(60,30,8,0.45)",
};

/* ─── Surfaces ───────────────────────────────────────────────────── */

// Hide backdrop with the page on it. The page is the container-query root.
export function GrimoireSheet({ children }) {
  return (
    <div className="relative rounded-2xl p-6 @md:p-7" style={HIDE_STYLE}>
      <div className={`@container relative rounded-[3px] px-4 py-5 font-serif @md:px-8 @md:py-7 ${INK.ink}`} style={PAGE_STYLE}>
        {children}
      </div>
    </div>
  );
}

/* ─── Writing ────────────────────────────────────────────────────── */

// Title with a crimson initial, like an illuminated manuscript.
export function Title({ children, after }) {
  const text = String(children);
  return (
    <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h3 className="text-[26px] leading-none tracking-wide">
        <span className={`mr-[1px] text-[34px] ${INK.blood}`}>{text.charAt(0)}</span>
        {text.slice(1)}
      </h3>
      {after}
    </div>
  );
}

// Small-caps heading between ornamented hairlines: ❖ HEADING ─────
export function Heading({ children, right }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span aria-hidden="true" className={`text-[10px] ${INK.blood}`}>
        ❖
      </span>
      <h4 className={`shrink-0 text-[11px] font-semibold uppercase tracking-[0.28em] ${INK.faded}`}>{children}</h4>
      <span className="h-px flex-1 bg-gradient-to-r from-[#5f4630]/50 to-transparent" />
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

// The dotted line between a name and its value.
export const Leader = () => (
  <span aria-hidden="true" className="mx-1.5 min-w-[1rem] flex-1 translate-y-[-4px] border-b-2 border-dotted border-[#5f4630]/40" />
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
      className={`text-xs italic underline decoration-dotted underline-offset-4 transition hover:text-[#24160c] disabled:no-underline disabled:opacity-40 ${
        active ? INK.blood : INK.faded
      } ${className}`}
    >
      {children}
    </button>
  );
}

// Two or more words where one is chosen: One · Classic
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
            className={o.value === value ? `font-semibold ${INK.blood}` : `${INK.faint} hover:text-[#24160c]`}
          >
            {o.label}
          </button>
        </React.Fragment>
      ))}
    </span>
  );
}

/* ─── Blanks to fill in ──────────────────────────────────────────── */

const blank =
  "bg-transparent border-0 border-b border-dotted border-[#5f4630]/75 rounded-none px-0 " +
  "focus:border-solid focus:border-[#24160c] focus:outline-none focus:ring-0 " +
  "placeholder:text-[#6f5538] text-[#24160c] font-serif";

export function InkNumber({ className = "", ...props }) {
  return <NumberBlank {...props} className={`${blank} ${className}`} />;
}

export function InkText({ className = "", ...props }) {
  return <input type="text" {...props} className={`${blank} text-left ${className}`} />;
}

export function InkSelect({ className = "", children, ...props }) {
  return (
    <select {...props} className={`${blank} cursor-pointer pr-1 ${className}`}>
      {children}
    </select>
  );
}

// Round mark that is on or off (save DC shown in Play, hover, devil's sight…).
export function Mark({ on, onClick, label, title }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-label={label}
      title={title || label}
      onClick={onClick}
      className="group inline-flex h-5 w-5 shrink-0 items-center justify-center"
    >
      <span
        className={`h-2.5 w-2.5 rotate-45 border-[1.5px] transition ${
          on ? "border-[#7a1712] bg-[#7a1712]" : "border-[#5f4630]/70 group-hover:border-[#24160c]"
        }`}
      />
    </button>
  );
}