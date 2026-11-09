import React from "react";
import { usePersistedOpen, Chevron } from "../../../../utils/SectionCard";

/* Shared building blocks for the Play sections, written on the Play
   sheet (parchment): no boxes — headings with hairlines, cards marked by
   a coloured rule down their left edge, ink dots for uses.

   Tones: spell (rubric), pact (magic), item (warn), passive (faded). */

/* ─── Buttons ─────────────────────────────────────────────────────── */

// Inked outline buttons for things you press often at the table:
// damage (bad-red), healing (good-green), plain. They fill on hover.
// `soft`: a quieter outline (the quick ±1/5/10 buttons).
const STAMP = {
  bad: "border-bad/60 text-bad hover:bg-bad hover:text-page-light",
  good: "border-good/60 text-good hover:bg-good hover:text-page-light",
  plain: "border-rule/60 text-ink hover:border-rubric hover:text-rubric",
};
const STAMP_SOFT = {
  bad: "border-bad/30 text-bad hover:bg-bad hover:text-page-light",
  good: "border-good/30 text-good hover:bg-good hover:text-page-light",
  plain: "border-rule/30 text-ink hover:border-rubric hover:text-rubric",
};
export const stamp = (tone, soft = false) =>
  `rounded-md border font-body transition disabled:cursor-not-allowed disabled:opacity-40 ${(soft ? STAMP_SOFT : STAMP)[tone]}`;

// A margin note: small italic text with a dotted underline (add a colour).
export const note = "text-xs italic underline decoration-dotted underline-offset-4 transition disabled:no-underline disabled:opacity-40";

// A number blank: a dotted line to write on.
export const blankNumber =
  "rounded-none border-0 border-b border-dotted border-rule/70 bg-transparent text-center font-body text-[15px] text-ink placeholder:text-ink-faint focus:border-solid focus:border-ink focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/* ─── Collapsible sub-section ─────────────────────────────────────── */

const TONE_TITLE = {
  default: "text-ink",
  spell: "text-rubric",
  item: "text-warn",
  passive: "text-ink-faded",
};

export function SubSection({ title, count, tone = "default", storageKey, children, className = "" }) {
  const [open, setOpen] = usePersistedOpen(storageKey, true);
  return (
    <section className={className}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="group flex w-full items-center gap-2 py-1 text-left">
        <Chevron open={open} className="h-3.5 w-3.5 text-ink-faded group-hover:text-rubric" />
        <h4 className={`text-[15px] font-semibold group-hover:underline group-hover:decoration-dotted group-hover:underline-offset-4 ${TONE_TITLE[tone] || TONE_TITLE.default}`}>{title}</h4>
        {count != null && <span className="text-xs tabular-nums text-ink-faded">{count}</span>}
        <span className="h-px flex-1 bg-rule/20" />
      </button>
      {open && <div className="pb-1 pt-1.5">{children}</div>}
    </section>
  );
}

// Cards inside a sub-section: as many ~13rem columns as fit.
export function CardGrid({ children }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-x-4 gap-y-2">{children}</div>;
}

/* ─── Small pieces ───────────────────────────────────────────────── */

// A small inked tag: "+7 to hit", "DEX DC 14", "V S M", "Attuned".
const CHIP_TONE = {
  plain: "text-ink-faded",
  hit: "text-info",
  save: "text-magic",
  comp: "text-warn",
  good: "text-good",
};

export function Chip({ tone = "plain", children }) {
  return <span className={`text-[10px] font-semibold uppercase leading-4 tracking-wider ${CHIP_TONE[tone] || CHIP_TONE.plain}`}>{children}</span>;
}

// Inked dots: filled = a use left, an empty ring = a use spent.
const PIP_TONE = {
  default: { on: "bg-ink border-ink", off: "border-rule/60" },
  spell: { on: "bg-rubric border-rubric", off: "border-rubric/40" },
  pact: { on: "bg-magic border-magic", off: "border-magic/40" },
  item: { on: "bg-warn border-warn", off: "border-warn/40" },
};

// A row of dots, filled for each use left. With onSpend/onRestore the
// dots themselves are buttons: a filled one spends, an empty one restores.
export function Pips({ cur, max, tone = "default", size = "sm", onSpend, onRestore, label = "use" }) {
  const t = PIP_TONE[tone] || PIP_TONE.default;
  const dim = size === "lg" ? "h-3.5 w-3.5" : "h-2.5 w-2.5";
  const interactive = !!(onSpend || onRestore);

  return (
    <span className="flex flex-wrap items-center gap-1">
      {Array.from({ length: max }, (_, i) => {
        const filled = i < cur;
        const cls = `${dim} rounded-full border-[1.5px] transition ${filled ? t.on : `${t.off} bg-transparent`}`;
        if (!interactive) return <span key={i} className={cls} />;
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              filled ? onSpend?.() : onRestore?.();
            }}
            title={filled ? `Spend a ${label}` : `Regain a ${label}`}
            aria-label={filled ? `Spend a ${label}` : `Regain a ${label}`}
            className={`${cls} hover:scale-125`}
          />
        );
      })}
    </span>
  );
}

// Uses as dots when there are few, as "3 / 12" when there are many.
function UsesBadge({ uses, tone }) {
  if (!uses) return null;
  if (uses.max == null) {
    return <span className="text-sm font-semibold tabular-nums text-ink">×{uses.cur}</span>;
  }
  if (uses.max <= 8) return <Pips cur={uses.cur} max={uses.max} tone={tone} />;
  return (
    <span className="text-sm font-semibold tabular-nums text-ink">
      {uses.cur}
      <span className="font-normal text-ink-faded"> / {uses.max}</span>
    </span>
  );
}

/* ─── The card used for every trackable thing ─────────────────────
   No box: a coloured rule down the left edge, and a faint wash on hover.
   With uses: click the card to spend one, right-click to regain one.
   Without uses it is an information card (a quieter rule, no hover). */

const CARD_TONE = {
  default: "border-rule/45 hover:border-ink",
  spell: "border-rubric/45 hover:border-rubric",
  item: "border-warn/45 hover:border-warn",
};

export function UseCard({ title, meta, chips = [], detail, uses, note, tone = "default", onSpend, onRestore }) {
  const trackable = !!uses;
  const empty = trackable && uses.cur <= 0;
  const canRestore = trackable && (uses.max == null || uses.cur < uses.max);

  // Up to 4 dots sit next to the name; longer dot rows get their own line
  // so they don't squeeze the name. Plain numbers always fit inline.
  const badgeInline = trackable && (uses.max == null || uses.max <= 4 || uses.max > 8);
  const pipTone = tone === "spell" ? "spell" : tone === "item" ? "item" : "default";

  const tooltip = [note, trackable ? "Click to use · right-click to regain one" : ""].filter(Boolean).join("\n\n");

  const body = (
    <>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className={`truncate text-[15px] font-semibold ${empty ? "text-ink-faded" : "text-ink"}`}>{title}</div>
          {meta && <div className="truncate text-xs italic text-ink-faded">{meta}</div>}
        </div>
        {trackable && badgeInline && (
          <div className={`shrink-0 pt-0.5 ${empty ? "opacity-60" : ""}`}>
            <UsesBadge uses={uses} tone={pipTone} />
          </div>
        )}
      </div>
      {trackable && !badgeInline && (
        <div className={`mt-1.5 ${empty ? "opacity-60" : ""}`}>
          <UsesBadge uses={uses} tone={pipTone} />
        </div>
      )}
      {chips.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5">
          {chips.map((c, i) => (
            <Chip key={i} tone={c.tone}>
              {c.text}
            </Chip>
          ))}
        </div>
      )}
      {detail && <div className="mt-1 text-xs italic text-bad">{detail}</div>}
    </>
  );

  const base = "block w-full rounded-r-sm border-l-2 py-1.5 pl-2.5 pr-1.5 text-left transition";

  if (!trackable) {
    return (
      <div className={`${base} border-rule/25`} title={tooltip}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      title={tooltip}
      onClick={() => !empty && onSpend?.()}
      onContextMenu={(e) => {
        e.preventDefault();
        if (canRestore) onRestore?.();
      }}
      className={`${base} ${
        empty ? "cursor-default border-rule/20 opacity-60" : `hover:bg-ink/[0.05] ${CARD_TONE[tone] || CARD_TONE.default}`
      }`}
    >
      {body}
    </button>
  );
}