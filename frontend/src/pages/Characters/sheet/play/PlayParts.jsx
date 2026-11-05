import React from "react";
import { usePersistedOpen, Chevron } from "../../../../utils/SectionCard";

/* Shared building blocks for the Play sections. */

/* ─── Collapsible sub-section ─────────────────────────────────────── */

const TONE_TITLE = {
  default: "text-slate-200",
  spell: "text-amber-300",
  item: "text-teal-300",
  passive: "text-slate-400",
};

export function SubSection({ title, count, tone = "default", storageKey, children, className = "" }) {
  const [open, setOpen] = usePersistedOpen(storageKey, true);
  return (
    <section className={`rounded-xl border border-slate-700/70 bg-slate-900/50 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Chevron open={open} className="group-hover:text-amber-300" />
        <h4 className={`text-sm font-semibold ${TONE_TITLE[tone]}`}>{title}</h4>
        {count != null && (
          <span className="rounded-full bg-slate-800 px-1.5 text-[11px] tabular-nums text-slate-400">{count}</span>
        )}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
}

// Cards inside a sub-section: as many ~13rem columns as fit.
export function CardGrid({ children }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2">{children}</div>;
}

/* ─── Small pieces ───────────────────────────────────────────────── */

const CHIP_TONE = {
  plain: "border-slate-600 text-slate-300",
  hit: "border-sky-700/70 text-sky-200",
  save: "border-violet-700/70 text-violet-200",
  comp: "border-amber-600/50 text-amber-200",
  good: "border-emerald-700/70 text-emerald-200",
};

export function Chip({ tone = "plain", children }) {
  return (
    <span className={`rounded-full border px-1.5 py-px text-[10px] leading-4 ${CHIP_TONE[tone] || CHIP_TONE.plain}`}>
      {children}
    </span>
  );
}

const PIP_TONE = {
  default: { on: "bg-slate-200 border-slate-200", off: "border-slate-600" },
  spell: { on: "bg-amber-400 border-amber-400 shadow-[0_0_6px] shadow-amber-500/50", off: "border-amber-800" },
  pact: { on: "bg-violet-400 border-violet-400 shadow-[0_0_6px] shadow-violet-500/50", off: "border-violet-800" },
  item: { on: "bg-teal-400 border-teal-400", off: "border-teal-800" },
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
        const cls = `${dim} rounded-full border transition ${filled ? t.on : `${t.off} bg-transparent`}`;
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
    return <span className="text-sm font-semibold tabular-nums text-slate-100">×{uses.cur}</span>;
  }
  if (uses.max <= 8) return <Pips cur={uses.cur} max={uses.max} tone={tone} />;
  return (
    <span className="text-sm font-semibold tabular-nums text-slate-100">
      {uses.cur}
      <span className="text-slate-500"> / {uses.max}</span>
    </span>
  );
}

/* ─── The card used for every trackable thing ─────────────────────
   With uses: click the card to spend one, right-click to regain one.
   Without uses it is an information card. */

const CARD_TONE = {
  default: "hover:border-slate-500",
  spell: "hover:border-amber-500/60",
  item: "hover:border-teal-500/60",
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
          <div className={`truncate text-sm font-semibold ${empty ? "text-slate-500" : "text-slate-100"}`}>{title}</div>
          {meta && <div className="truncate text-[11px] text-slate-400">{meta}</div>}
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
        <div className="mt-1.5 flex flex-wrap gap-1">
          {chips.map((c, i) => (
            <Chip key={i} tone={c.tone}>
              {c.text}
            </Chip>
          ))}
        </div>
      )}
      {detail && <div className="mt-1 text-[11px] text-rose-200/90">{detail}</div>}
    </>
  );

  const base = "block w-full rounded-lg border px-2.5 py-2 text-left transition";

  if (!trackable) {
    return (
      <div className={`${base} border-slate-800 bg-slate-950/40`} title={tooltip}>
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
        empty
          ? "cursor-default border-slate-800 bg-slate-950/30"
          : `border-slate-700 bg-slate-950/70 ${CARD_TONE[tone] || CARD_TONE.default}`
      }`}
    >
      {body}
    </button>
  );
}