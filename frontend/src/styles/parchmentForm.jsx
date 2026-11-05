import React from "react";
import { usePersistedOpen } from "../utils/SectionCard";
import NumberBlank from "./NumberBlank";
import { INK } from "./parchment";

/* Form pieces in the parchment style.

   Same names and props as the slate DefineParts, so a page moves to the
   parchment by changing its import. Everything is ink on paper:
   - sections are a small-caps heading with a hairline, no box
   - inputs are dotted-underline blanks
   - a pick-one row is a line of words (Action · Bonus · Reaction)
   - a switch is the diamond mark
   - buttons are italic margin notes
   Use inside a <ParchmentSheet>. */


/* ─── Sections ───────────────────────────────────────────────────── */

// Collapsible section. `actions` may be a function receiving setOpen, so
// an "add" button can also open the section. Open/closed is remembered.
export function DefineSection({ title, count, actions, storageKey, defaultOpen = true, children }) {
  const [open, setOpen] = usePersistedOpen(storageKey, defaultOpen);
  const rendered = typeof actions === "function" ? actions(setOpen) : actions;
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="group flex shrink-0 items-center gap-1.5 text-left">
          <Chevron open={open} />
          <h4 className={`text-[11px] font-semibold uppercase tracking-[0.25em] ${INK.faded} group-hover:text-[#3a2716]`}>{title}</h4>
          {count != null && <span className={`text-[11px] tabular-nums ${INK.faint}`}>{count}</span>}
        </button>
        <span className="h-px min-w-[2rem] flex-1 bg-[#7b6346]/30" />
        {rendered && <div className="flex flex-wrap items-center gap-x-4 gap-y-1">{rendered}</div>}
      </div>
      {open && <div className="space-y-3">{children}</div>}
    </section>
  );
}

export function Chevron({ open }) {
  return (
    <svg className={`h-3.5 w-3.5 shrink-0 transition-transform ${INK.faded} ${open ? "rotate-90" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01-.02-1.06L10.94 10 7.2 6.29a.75.75 0 111.06-1.06l4.24 4.24a.75.75 0 010 1.06l-4.24 4.24a.75.75 0 01-1.06 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* ─── Buttons (class strings, like DefineParts) ──────────────────── */

const note = "text-xs italic underline decoration-dotted underline-offset-4 transition disabled:no-underline disabled:opacity-40";
export const ghostBtn = `${note} ${INK.faded} hover:text-[#3a2716]`;
export const dangerBtn = `${note} ${INK.rubric} hover:text-[#7c2d12]`;
export const addBtn = `${note} ${INK.rubric} hover:text-[#3a2716]`;

// A filter word: selected ones are inked in rubric and underlined.
export const chipBtn = (active) =>
  `text-xs italic transition ${active ? `${INK.rubric} underline decoration-dotted underline-offset-4` : `${INK.faded} hover:text-[#3a2716]`}`;

/* ─── Blanks ─────────────────────────────────────────────────────── */

const inputSkin =
  "bg-transparent border-0 border-b border-dotted border-[#7b6346]/70 rounded-none px-0 " +
  `focus:border-solid focus:border-[#3a2716] focus:outline-none focus:ring-0 ` +
  `placeholder:text-[#a08a68] text-[#3a2716] font-serif`;
export const inputBase = `h-8 text-[15px] ${inputSkin}`;
export const inputSm = `h-6 text-sm ${inputSkin}`;
export const inputCls = `${inputBase} w-full`;

// Number blank; full width unless the className gives a width.
export function NumberInput({ className = "", size = "md", bare = false, ...rest }) {
  const skin = bare ? "" : size === "sm" ? inputSm : inputBase;
  const width = /(^|\s)w-/.test(className) ? "" : "w-full";
  return <NumberBlank {...rest} className={`${skin} ${width} ${className}`} />;
}

// Lined-paper text area that grows with its text.
export function TextBlock({ value, onChange, placeholder, minRows = 3, maxRows = 30, className = "", ...rest }) {
  const lines = String(value || "").split("\n").length;
  return (
    <textarea
      value={value ?? ""}
      onChange={onChange}
      placeholder={placeholder}
      rows={Math.min(maxRows, Math.max(minRows, lines + 1))}
      className={`w-full resize-y border-0 bg-transparent px-0 font-serif text-[15px] leading-7 text-[#3a2716] placeholder:text-[#a08a68] focus:outline-none focus:ring-0 ${className}`}
      style={{
        backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgba(123,99,70,0.4) 27px, rgba(123,99,70,0.4) 28px)",
        backgroundAttachment: "local",
      }}
      {...rest}
    />
  );
}

/* ─── Labels and groups ──────────────────────────────────────────── */

// A <label> passes clicks on its text to the first control inside it.
// For word rows and marks that would "click" the first option, so those
// clicks are swallowed.
const swallowButtonLabelClick = (e) => {
  if (e.target.closest("button, input, select, textarea")) return;
  const first = e.currentTarget.querySelector("button, input, select, textarea");
  if (first?.tagName === "BUTTON") e.preventDefault();
};

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`flex min-w-0 flex-col gap-0.5 ${className}`} title={hint} onClick={swallowButtonLabelClick}>
      <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${INK.faded}`}>{label}</span>
      {children}
    </label>
  );
}

// A titled group inside an editor: small italic title, a hairline down
// the left, no box.
export function Fieldset({ title, children, right, className = "" }) {
  return (
    <fieldset className={`min-w-0 border-l border-[#7b6346]/30 pl-3 ${className}`}>
      <legend className={`mb-1 flex w-full items-baseline gap-2 text-xs italic ${INK.faded}`}>
        {title}
        {right && <span className="ml-auto not-italic">{right}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

/* ─── Choices ────────────────────────────────────────────────────── */

// Pick one: a line of words, the chosen one inked in rubric.
export function Segmented({ options, value, onChange, size = "md" }) {
  const text = size === "sm" ? "text-[13px]" : "text-[15px]";
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 self-start ${text}`} role="radiogroup">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <React.Fragment key={String(o.value)}>
            {i > 0 && <span className={INK.faint}>·</span>}
            <button
              type="button"
              role="radio"
              aria-checked={on}
              aria-pressed={on}
              title={o.hint}
              onClick={() => onChange(o.value)}
              className={`whitespace-nowrap transition ${on ? `font-semibold ${INK.rubric} underline decoration-dotted underline-offset-4` : `${INK.faded} hover:text-[#3a2716]`}`}
            >
              {o.label}
            </button>
          </React.Fragment>
        );
      })}
    </span>
  );
}

// On/off: the diamond mark. `stop` keeps the click from reaching a parent.
export function Switch({ checked, onChange, label, stop = false, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        if (stop) e.stopPropagation();
        onChange(!checked);
      }}
      className="group inline-flex h-5 w-5 shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        className={`h-2.5 w-2.5 rotate-45 border-[1.5px] transition ${
          checked ? `border-[#9a3412] bg-[#9a3412]` : "border-[#7b6346]/70 group-hover:border-[#3a2716]"
        }`}
      />
    </button>
  );
}

/* ─── Limited uses / charges ─────────────────────────────────────────
   { has, max_charges, current_charges, reset_amount }. "Regain all" is
   read from the data. Effects store it as reset = max; inventory items
   store "full" — pass allValue="full" for those. Written as a sentence:
   "3 uses, 2 left · on a rest regain all · some" */

const numOr = (v, fallback) => (v === "" || v == null || !Number.isFinite(Number(v)) ? fallback : Number(v));

export function UsesEditor({ charges, onChange, allValue = "max", noun = "uses" }) {
  const c = charges || {};
  const max = numOr(c.max_charges, 0);
  const reset = c.reset_amount === "full" ? max : numOr(c.reset_amount, 0);
  const regainsAll = c.reset_amount === "full" || (max > 0 && reset >= max);
  const allFor = (n) => (allValue === "full" ? "full" : n);

  const setMax = (v) => {
    const n = numOr(v, 0);
    const cur = c.current_charges;
    const wasFull = cur === "" || cur == null || numOr(cur, 0) >= max;
    onChange({
      ...c,
      has: true,
      max_charges: v ?? "",
      current_charges: wasFull ? "" : Math.min(numOr(cur, n), n),
      reset_amount: regainsAll ? allFor(n) : Math.min(reset, n),
    });
  };

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[15px]">
      <NumberInput value={max || null} min={0} placeholder="—" onChange={setMax} aria-label={`Max ${noun}`} className="w-10" />
      <span className={INK.faded}>{noun},</span>
      <NumberInput
        value={c.current_charges === "" || c.current_charges == null ? null : numOr(c.current_charges, null)}
        min={0}
        max={max || undefined}
        placeholder={max ? String(max) : "—"}
        onChange={(v) => onChange({ ...c, has: true, current_charges: v ?? "" })}
        aria-label={`${noun} left`}
        className="w-10"
      />
      <span className={INK.faded}>left · on a rest regain</span>
      <Segmented
        size="sm"
        options={[
          { value: "all", label: "all" },
          { value: "some", label: "some" },
        ]}
        value={regainsAll ? "all" : "some"}
        onChange={(v) => onChange({ ...c, has: true, reset_amount: v === "all" ? allFor(max) : max > 1 ? 1 : 0 })}
      />
      {!regainsAll && (
        <NumberInput value={reset} min={0} max={max || undefined} fallback={0} onChange={(v) => onChange({ ...c, has: true, reset_amount: v ?? 0 })} aria-label="Regained on rest" className="w-10" />
      )}
    </div>
  );
}

/* ─── Catalogue picker ───────────────────────────────────────────────
   Shell + rows for "pick from the catalogue" lists. Each page maps its
   entries to <PickerRow>s; the name opens the entry's card.

   <PickerShell title="From the catalogue" query={q} onQuery={setQ}
                filters={…} footer="12 of 340" onClose={close}>
     <PickerRow name="Fireball" onOpen={…} meta={…} source="XPHB"
                action={{ label: "add", onClick, disabled }} />
   </PickerShell> */

export function PickerShell({ title = "From the catalogue", query, onQuery, placeholder = "search by name or source…", filters, footer, onClose, children }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className={`text-xs italic ${INK.faded}`}>{title}</span>
        <input type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} autoFocus className={`${inputBase} w-full min-w-[10rem] max-w-sm flex-1`} />
        {filters}
        {onClose && (
          <button type="button" onClick={onClose} className={ghostBtn}>
            close
          </button>
        )}
      </div>
      <div className="max-h-72 overflow-y-auto border-y border-[#7b6346]/25 py-1">{children}</div>
      {footer && <p className={`text-[11px] italic ${INK.faint}`}>{footer}</p>}
    </div>
  );
}

export function PickerRow({ name, onOpen, meta, source, extra, action, highlight = false }) {
  return (
    <div className={`flex items-baseline gap-2 px-1 py-1 hover:bg-[#3a2716]/[0.04] ${highlight ? "bg-[#9a3412]/[0.06]" : ""}`}>
      <button type="button" onClick={onOpen} className="truncate text-left text-[15px] hover:underline hover:decoration-dotted" title="Open its card">
        {name}
      </button>
      {meta}
      <span aria-hidden="true" className="mx-1 min-w-[1rem] flex-1 translate-y-[-4px] border-b-2 border-dotted border-[#7b6346]/35" />
      {source && <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`}>{source}</span>}
      {extra}
      {action && (
        <button type="button" onClick={action.onClick} disabled={action.disabled} className={`shrink-0 ${action.disabled ? ghostBtn : addBtn}`}>
          {action.label}
        </button>
      )}
    </div>
  );
}

// Small-caps tag next to a name in a list (level, school, type…).
export const Tag = ({ children, className = "" }) => (
  <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint} ${className}`}>{children}</span>
);

// Quiet italic line for empty states and hints.
export const Hint = ({ children, className = "" }) => <p className={`text-sm italic ${INK.faint} ${className}`}>{children}</p>;