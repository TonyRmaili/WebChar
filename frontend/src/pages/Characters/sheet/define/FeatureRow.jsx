import React from "react";
import { INK } from "../../../../styles/parchment";
import { Field, Segmented, Switch, TextBlock, dangerBtn, ghostBtn, inputCls } from "../../../../styles/parchmentForm";
import { ActionEditor, RichText } from "../../../Catalogues/catalogueParts";
import { textFromValue, valueFromText } from "../../../Catalogues/catalogueHelpers";
import { actionWords, regainWords } from "../../../../utils/featureRuntime";
import { CATEGORIES } from "../featureHelpers";

/* One feature on the Features or Feats tab: a ledger line with the
   numbers Play shows (worked out for this character), and an editor that
   opens under it. The editor changes the character's own copy, in the
   shared feature shape (data-model §2): numbers can be plain or formulas
   ("dex_mod + pb", "martial_arts"), the line shows them worked out.

   `row` comes from featureHelpers.featureRows. */

const USE_MODES = [
  { value: "none", label: "no limit" },
  { value: "own", label: "its own" },
  { value: "pool", label: "from a pool" },
];
const RESETS = [
  { value: "long", label: "per long rest" },
  { value: "short", label: "per short rest" },
];

/* `onView` (optional): the name opens the feature's card and a small
   "edit" opens the editor (`onToggle`); without it the name opens the
   editor. `hideOwner`: leave out where it came from ("Wizard 1"), for a
   list that already says so. */
export function FeatureLine({ row, open, onToggle, onActive, onView, hideOwner = false }) {
  const f = row.feature;
  const words = actionWords(row.action);
  return (
    <div className={`group flex items-baseline gap-1.5 py-[3px] ${row.active ? "" : "opacity-60"}`}>
      <span className="self-center">
        <Switch checked={row.active} onChange={onActive} label={row.active ? "Shown in Play" : "Hidden in Play"} />
      </span>
      <button
        type="button"
        onClick={onView || onToggle}
        aria-expanded={onView ? undefined : open}
        title={onView ? "Open its card" : undefined}
        className={`truncate text-left text-[15px] hover:underline hover:decoration-dotted hover:underline-offset-4 ${f.name ? "" : `italic ${INK.faint}`} ${open ? "underline decoration-dotted underline-offset-4" : ""}`}
      >
        {f.name || "unnamed"}
      </button>
      {f.edited && <span className={`shrink-0 text-[10px] italic ${INK.faint}`} title="You changed this copy">edited</span>}
      {f.own && <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`} title="You added this one">yours</span>}
      {!hideOwner && <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`}>{row.owner}</span>}
      <span aria-hidden="true" className="mx-1 min-w-[0.75rem] flex-1 translate-y-[-4px] border-b-2 border-dotted border-rule/35" />
      <span className="flex min-w-0 shrink flex-wrap items-baseline justify-end gap-x-2 text-xs">
        {row.isToggle && <span className={row.on ? INK.rubric : INK.faded}>{row.on ? "on" : "toggle"}</span>}
        {words && <span className={`truncate ${INK.rubric}`}>{words}</span>}
        {row.uses && (
          <span className={`italic ${INK.faded}`}>
            {row.uses.max} {regainWords(f.uses) || (row.uses.max === 1 ? "use" : "uses")}
          </span>
        )}
        {row.consumes && <span className={`italic ${INK.faded}`}>{row.consumes.amount} {row.consumes.name}</span>}
      </span>
      {onView && (
        <button type="button" onClick={onToggle} aria-expanded={open} className={`shrink-0 text-xs italic ${open ? INK.rubric : INK.faded} hover:text-ink`} title="Change your copy">
          edit
        </button>
      )}
    </div>
  );
}

/* `pools`: the character's pools (featureHelpers.resourceRows), to pick
   one this feature spends from. `onTurnIntoPool`: make its own uses a
   pool (Resources tab), so other features can share them. */
export function FeatureEditor({ row, pools = [], onPatch, onRemove, onDone, onTurnIntoPool, onRestore }) {
  const f = row.feature;
  const uses = f.uses && typeof f.uses === "object" ? f.uses : null;
  const mode = f.consumes?.resource ? "pool" : uses?.reset ? "own" : "none";
  return (
    <div className="@container mb-4 ml-[26px] mt-2 space-y-4 border-l-2 border-rubric/40 pl-4">
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field label="Name">
          <input type="text" value={f.name ?? ""} autoFocus={!f.name} onChange={(e) => onPatch({ name: e.target.value })} placeholder="e.g. Second Wind" className={`${inputCls} text-[17px]`} />
        </Field>
        <Field label="Used as">
          <Segmented size="sm" options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} value={row.category} onChange={(category) => onPatch({ category })} />
        </Field>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <Field label="Uses">
          <span className="flex flex-wrap items-baseline gap-2">
            <Segmented
              size="sm"
              options={USE_MODES}
              value={mode}
              onChange={(m) =>
                onPatch(
                  m === "none"
                    ? { uses: null, consumes: null }
                    : m === "own"
                      ? { uses: { max: uses?.max ?? 1, reset: uses?.reset || "long" }, consumes: null }
                      : { uses: null, consumes: { resource: f.consumes?.resource || pools[0]?.id || "", amount: f.consumes?.amount ?? 1 } }
                )
              }
            />
            {mode === "own" && (
              <>
                <input
                  type="text"
                  value={textFromValue(uses.max)}
                  onChange={(e) => onPatch({ uses: { ...uses, max: valueFromText(e.target.value) } })}
                  placeholder="1, pb, wis_mod…"
                  aria-label="How many uses"
                  className={`${inputCls} !w-28`}
                />
                {row.uses && <span className={`text-xs italic ${INK.faded}`}>= {row.uses.max}</span>}
                <Segmented size="sm" options={RESETS} value={uses.reset || "long"} onChange={(reset) => onPatch({ uses: { ...uses, reset } })} />
                {onTurnIntoPool && (
                  <button type="button" onClick={onTurnIntoPool} className={ghostBtn} title="Make these uses a pool in Resources, so other features can spend them too">
                    turn into a pool
                  </button>
                )}
              </>
            )}
            {mode === "pool" && (
              <>
                <select value={f.consumes?.resource || ""} onChange={(e) => onPatch({ consumes: { ...(f.consumes || {}), resource: e.target.value } })} aria-label="Pool" className={`${inputCls} !w-44 cursor-pointer`}>
                  {!pools.some((p) => p.id === f.consumes?.resource) && <option value={f.consumes?.resource || ""}>{f.consumes?.resource || "— pick a pool —"}</option>}
                  {pools.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-ink-faded">×</span>
                <input
                  type="number"
                  min={1}
                  value={f.consumes?.amount ?? 1}
                  onChange={(e) => onPatch({ consumes: { ...(f.consumes || {}), amount: Math.max(1, Number(e.target.value) || 1) } })}
                  aria-label="How many it spends"
                  className={`${inputCls} !w-14`}
                />
                {row.consumes && !row.consumes.missing && (
                  <span className={`text-xs italic ${INK.faded}`}>
                    {row.consumes.cur} of {row.consumes.max} left
                  </span>
                )}
                {row.consumes?.missing && <span className={`text-xs italic ${INK.rubric}`}>no such pool: add it in Resources</span>}
              </>
            )}
          </span>
        </Field>
        <label className="flex items-center gap-1 text-sm">
          <Switch checked={!!f.toggle} onChange={(v) => onPatch({ toggle: v ? f.toggle || true : null, on: v ? f.on : false })} label="Can be switched on and off" />
          switched on and off
        </label>
      </div>

      <Field label="What it does">
        <ActionEditor value={f.action} onChange={(action) => onPatch({ action: action && Object.keys(action).length ? action : null })} spell={false} />
      </Field>

      <Field label="Text">
        {row.kind === "manual" || f.own || f.edited_text ? (
          <TextBlock value={typeof f.text === "string" ? f.text : ""} onChange={(e) => onPatch({ text: e.target.value, edited_text: row.kind !== "manual" && !f.own })} placeholder="What it does, in words" minRows={3} />
        ) : f.text ? (
          <div>
            <RichText text={f.text} className="text-[14px]" />
            <button type="button" onClick={() => onPatch({ edited_text: true })} className={`mt-1 ${ghostBtn}`}>
              edit the text
            </button>
          </div>
        ) : (
          <TextBlock value="" onChange={(e) => onPatch({ text: e.target.value, edited_text: true })} placeholder="What it does, in words" minRows={2} />
        )}
      </Field>

      {(f.modifiers?.length > 0 || (f.toggle && typeof f.toggle === "object")) && (
        <p className={`text-xs italic ${INK.faint}`}>
          Its numbers on the sheet ({[...(f.modifiers || []), ...(f.toggle?.modifiers || [])].map((m) => m.target).join(", ") || "grants"}) are kept and counted
          {f.toggle ? " while it's switched on" : ""}.
        </p>
      )}

      <div className="flex flex-wrap items-baseline gap-x-5">
        <button type="button" onClick={onDone} className={ghostBtn}>
          done
        </button>
        {onRestore && f.edited && f.book && (
          <button type="button" onClick={onRestore} className={ghostBtn} title="Undo every change you made to this feature">
            back to the book's
          </button>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} className={`ml-auto ${dangerBtn}`}>
            remove
          </button>
        )}
      </div>
    </div>
  );
}
