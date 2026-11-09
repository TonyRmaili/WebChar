import React, { useState } from "react";

/* The bar above both panels: which character is shown, plus the
   controls that act on the whole party rather than one sheet.

   A leather strip on the desk (wc-desk): the chosen character is a
   parchment tab, everything else is desk ink that turns gold
   (desk-accent) on hover. Every control is the same height (h-9) so
   they line up in one row, and the row wraps cleanly on narrow screens. */

const CTRL_H = "h-9";

// Rests: outlined in stitch on the leather, gold on hover.
const restBtn = `${CTRL_H} inline-flex items-center gap-1.5 rounded-md border border-stitch/40 px-3 text-sm text-desk-ink transition hover:border-desk-accent hover:text-desk-accent`;

// The XP stepper's − and +.
const stepBtn =
  "w-9 text-lg leading-none text-desk-ink transition hover:bg-desk-deep/60 hover:text-desk-accent disabled:cursor-not-allowed disabled:text-desk-ink-faded/40 disabled:hover:bg-transparent";

const charId = (c) => c.id || c._id || c.name;

function MoonIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  );
}

function HourglassIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12M6 21h12M7 3c0 5 10 6 10 9s-10 4-10 9M17 3c0 5-10 6-10 9s10 4 10 9" />
    </svg>
  );
}

function Divider() {
  return <span className="hidden h-7 w-px bg-stitch/30 sm:block" aria-hidden="true" />;
}

export default function PartyBar({
  characters,
  activeId,
  onSelect,
  onRest,
  onExperience,
  busy = false,
}) {
  const [xp, setXp] = useState("");
  const xpNum = Number(xp);
  const xpValid = Number.isFinite(xpNum) && xpNum > 0;
  const disabled = busy || !activeId;

  const applyXp = async (sign) => {
    if (!xpValid || disabled) return;
    const ok = await onExperience(sign === "+" ? xpNum : -xpNum);
    if (ok) setXp("");
  };

  return (
    <div className="wc-desk flex flex-wrap items-center gap-3 rounded-2xl border border-stitch/25 p-2 font-body">
      {/* Character switcher */}
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Active characters">
        {characters.map((c) => {
          const id = charId(c);
          const active = id === activeId;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(id)}
              className={`${CTRL_H} rounded-md border px-4 text-[15px] transition ${
                active
                  ? "border-transparent bg-page font-semibold text-ink shadow"
                  : "border-transparent text-desk-ink-faded hover:border-stitch/40 hover:text-desk-accent"
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-3">
        {/* Party rests: these rest every active character at once.
            Single-character rests live on each sheet's Health card. */}
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.2em] text-desk-ink-faded"
            title="Rests apply to every active character"
          >
            Party
          </span>
          <button
            type="button"
            onClick={() => onRest("short")}
            disabled={disabled}
            title="Short rest for every active character"
            className={`${restBtn} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <HourglassIcon />
            Short Rest
          </button>
          <button
            type="button"
            onClick={() => onRest("long")}
            disabled={disabled}
            title="Long rest for every active character"
            className={`${restBtn} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <MoonIcon />
            Long Rest
          </button>
        </div>

        <Divider />

        {/* Experience stepper: one joined control, everything on one line */}
        <div
          className={`${CTRL_H} flex items-stretch overflow-hidden rounded-md border border-stitch/40 bg-desk-deep/60 focus-within:border-desk-accent`}
        >
          <span className="flex items-center border-r border-stitch/30 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-desk-ink-faded">
            XP
          </span>
          <button
            type="button"
            onClick={() => applyXp("-")}
            disabled={disabled || !xpValid}
            aria-label="Remove experience"
            className={stepBtn}
          >
            −
          </button>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="0"
            value={xp}
            onChange={(e) => setXp(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyXp("+");
            }}
            aria-label="Experience amount"
            className="w-20 border-x border-stitch/30 bg-transparent text-center text-sm text-desk-ink placeholder:text-desk-ink-faded/70 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => applyXp("+")}
            disabled={disabled || !xpValid}
            aria-label="Add experience"
            className={stepBtn}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}