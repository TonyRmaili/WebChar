import React from "react";
import { addRowCls, fieldCls, labelCls, removeRowCls } from "../catalogueStyle";
import { CurrencyEditor, Segmented } from "../catalogueParts";
import { SPELL_SCHOOLS, labelFromId, numOrNull, titleCase, toggleIn } from "../catalogueHelpers";
import { AREA_SHAPES, CONSUMED_OPTIONS, DURATION_TYPES, DURATION_UNITS, LEVELS, RANGE_TYPES, TIME_UNITS, formatLevel } from "./spellHelpers";

/* ═══════════════════════════════════════════════════════════════════
   spellFormParts — the windows of the spell card (SpellCardForm): level
   and school, casting time, range, components, duration. Each edits one
   part of the spell form (spellHelpers.spellToForm / formToSpell);
   `form` is the whole form, `set(key, value)` changes one key.
   ═══════════════════════════════════════════════════════════════════ */

const DURATION_LABELS = { instant: "instantaneous", timed: "timed", permanent: "until ended", special: "special" };
const ENDS = ["dispel", "trigger"];

const rowsOf = (form, set, key) => ({
  setRow: (i, p) => set(key, form[key].map((x, j) => (j === i ? { ...x, ...p } : x))),
  removeRow: (i) => set(key, form[key].filter((_, j) => j !== i)),
});

export function LevelFields({ form, set }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
      <label className="flex items-baseline gap-2">
        <span className={`${labelCls} !mb-0`}>Level</span>
        <select value={form.level} onChange={(e) => set("level", Number(e.target.value))} className={`${fieldCls} !w-28`}>
          {LEVELS.map((l) => <option key={l} value={l}>{formatLevel(l)}</option>)}
        </select>
      </label>
      <label className="flex items-baseline gap-2">
        <span className={`${labelCls} !mb-0`}>School</span>
        <select value={form.school} onChange={(e) => set("school", e.target.value)} className={`${fieldCls} !w-40`}>
          {[...new Set([...SPELL_SCHOOLS, form.school].filter(Boolean))].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
      </label>
      <label className="flex items-baseline gap-2 text-sm">
        <input type="checkbox" checked={form.ritual} onChange={(e) => set("ritual", e.target.checked)} className="accent-rubric" />
        Ritual
      </label>
    </div>
  );
}

export function TimeFields({ form, set }) {
  const { setRow, removeRow } = rowsOf(form, set, "time");
  return (
    <div className="space-y-1">
      {form.time.map((t, i) => (
        <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {i > 0 && <span className="text-xs italic text-ink-faded">or</span>}
          <input type="number" min={1} value={t.number ?? 1} onChange={(e) => setRow(i, { number: numOrNull(e.target.value) ?? 1 })}
                 className={`${fieldCls} !w-12`} aria-label="How many" />
          <select value={t.unit} onChange={(e) => setRow(i, { unit: e.target.value })} className={`${fieldCls} !w-36`} aria-label="Unit">
            {[...new Set([...TIME_UNITS, t.unit])].map((u) => <option key={u} value={u}>{labelFromId(u)}</option>)}
          </select>
          {t.unit === "reaction" && (
            <input type="text" value={t.trigger || ""} onChange={(e) => setRow(i, { trigger: e.target.value || undefined })}
                   placeholder="which you take when…" className={`${fieldCls} min-w-[12rem] flex-1`} />
          )}
          {t.note != null && (
            <input type="text" value={t.note} onChange={(e) => setRow(i, { note: e.target.value })} placeholder="for which option" className={`${fieldCls} !w-32`} />
          )}
          {form.time.length > 1 && (
            <button type="button" onClick={() => removeRow(i)} className={removeRowCls} aria-label="Remove">✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => set("time", [...form.time, { number: 1, unit: "action" }])} className={addRowCls}>
        + another casting time
      </button>
    </div>
  );
}

export function RangeFields({ form, set }) {
  const r = form.range;
  const patch = (p) => set("range", { ...r, ...p });
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <select value={r.type} onChange={(e) => patch({ type: e.target.value })} className={`${fieldCls} !w-32`} aria-label="Range">
        {RANGE_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
      </select>
      {(r.type === "feet" || r.type === "miles") && (
        <input type="number" min={0} value={r.amount ?? ""} onChange={(e) => patch({ amount: numOrNull(e.target.value) })}
               className={`${fieldCls} !w-16`} aria-label="Distance" />
      )}
      {r.type === "self" && (
        <>
          <span className="text-xs text-ink-faded">area</span>
          <select value={r.area?.shape || ""} className={`${fieldCls} !w-32`} aria-label="Area"
                  onChange={(e) => patch({ area: e.target.value ? { size: 15, unit: "feet", ...r.area, shape: e.target.value } : undefined })}>
            <option value="">— just you —</option>
            {AREA_SHAPES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
          {r.area?.shape && (
            <>
              <input type="number" min={0} value={r.area.size ?? ""} onChange={(e) => patch({ area: { ...r.area, size: numOrNull(e.target.value) } })}
                     className={`${fieldCls} !w-14`} aria-label="Area size" />
              <span className="text-xs text-ink-faded">{r.area.unit === "miles" ? "miles" : "feet"}</span>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function ComponentsFields({ form, set }) {
  const c = form.components;
  const patch = (p) => set("components", { ...c, ...p });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        {[["v", "Verbal"], ["s", "Somatic"], ["r", "Royalty"]].map(([k, label]) =>
          k === "r" && !c.r ? null : (
            <label key={k} className="flex items-baseline gap-2 text-sm">
              <input type="checkbox" checked={c[k]} onChange={(e) => patch({ [k]: e.target.checked })} className="accent-rubric" />
              {label}
            </label>
          ),
        )}
      </div>
      <div className="space-y-1">
        <input type="text" value={c.mText} onChange={(e) => patch({ mText: e.target.value })} aria-label="Material"
               placeholder="Material (empty = none), e.g. a ball of bat guano and sulfur" className={fieldCls} />
        {c.mText.trim() && (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-xs text-ink-faded">worth at least</span>
            <CurrencyEditor value={c.mCost} onChange={(v) => patch({ mCost: v })} />
            <Segmented size="sm" options={CONSUMED_OPTIONS} value={c.mConsumed} onChange={(v) => patch({ mConsumed: v })} />
          </div>
        )}
      </div>
    </div>
  );
}

export function DurationFields({ form, set }) {
  const { setRow, removeRow } = rowsOf(form, set, "duration");
  return (
    <div className="space-y-1">
      {form.duration.map((d, i) => (
        <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {i > 0 && <span className="text-xs italic text-ink-faded">or</span>}
          <select value={d.type} aria-label="Duration"
                  onChange={(e) => setRow(i, { type: e.target.value, ...(e.target.value === "timed" ? { amount: d.amount ?? 1, unit: d.unit || "minute" } : {}) })}
                  className={`${fieldCls} !w-36`}>
            {DURATION_TYPES.map((t) => <option key={t} value={t}>{DURATION_LABELS[t]}</option>)}
          </select>
          {d.type === "timed" && (
            <>
              <input type="number" min={1} value={d.amount ?? 1} onChange={(e) => setRow(i, { amount: numOrNull(e.target.value) ?? 1 })}
                     className={`${fieldCls} !w-14`} aria-label="How long" />
              <select value={d.unit || "minute"} onChange={(e) => setRow(i, { unit: e.target.value })} className={`${fieldCls} !w-24`} aria-label="Unit">
                {[...new Set([...DURATION_UNITS, d.unit].filter(Boolean))].map((u) => <option key={u} value={u}>{u}s</option>)}
              </select>
              <label className="flex items-baseline gap-2 text-sm">
                <input type="checkbox" checked={!!d.concentration} onChange={(e) => setRow(i, { concentration: e.target.checked })} className="accent-rubric" />
                Concentration
              </label>
            </>
          )}
          {d.type === "permanent" && (
            <span className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-xs text-ink-faded">ends when</span>
              {ENDS.map((e) => (
                <label key={e} className="flex items-baseline gap-1.5 text-sm">
                  <input type="checkbox" checked={(d.ends || []).includes(e)} className="accent-rubric"
                         onChange={() => setRow(i, { ends: toggleIn(d.ends || [], e) })} />
                  {e === "dispel" ? "dispelled" : "triggered"}
                </label>
              ))}
            </span>
          )}
          {form.duration.length > 1 && (
            <button type="button" onClick={() => removeRow(i)} className={removeRowCls} aria-label="Remove">✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => set("duration", [...form.duration, { type: "timed", amount: 1, unit: "minute", concentration: false }])}
              className={addRowCls}>
        + another duration
      </button>
    </div>
  );
}
