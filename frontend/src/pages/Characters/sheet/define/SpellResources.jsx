import React from "react";
import { InkRemove } from "../../../../styles/parchment";
import { Field, NumberInput, Segmented, addBtn } from "../../../../styles/parchmentForm";

/* Spell slots, pact slots and sorcery points for the Spellbook tab.
   Only the maximums are set here; spending and regaining happens in
   Play with the dots. Data shapes are unchanged:
     spellslots / pactslots: [{ id, level, slots_max, slots_current }]
     sorcery_points: { max_charges, current_charges, reset_amount } */

const newId = () =>
  globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const asList = (v) => (Array.isArray(v) ? v : []);
const num = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const ORD = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

// Keep "uses left" within the new max; empty stays empty (= full).
const clampCurrent = (current, max) => (current === "" || current == null ? "" : Math.min(num(current) ?? max, max));

/* ─── Spell slots: one box per level ─────────────────────────────── */

export function SlotGrid({ rows, onChange }) {
  const list = asList(rows);
  const rowAt = (level) => list.find((r) => num(r.level) === level);

  const setMax = (level, value) => {
    const existing = rowAt(level);
    // Rows without a valid level were left over from the old "add row" editor.
    const kept = list.filter((r) => num(r.level) >= 1 && num(r.level) <= 9);
    if (!value) return onChange(kept.filter((r) => r !== existing));
    if (existing) {
      return onChange(
        kept.map((r) => (r === existing ? { ...r, slots_max: value, slots_current: clampCurrent(r.slots_current, value) } : r))
      );
    }
    const next = [...kept, { id: newId(), level, slots_max: value, slots_current: value }];
    onChange(next.sort((a, b) => num(a.level) - num(b.level)));
  };

  return (
    <div className="grid grid-cols-3 gap-x-5 gap-y-3 @md:grid-cols-5 @3xl:grid-cols-9">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => {
        const row = rowAt(level);
        const max = num(row?.slots_max);
        return (
          <Field key={level} label={ORD[level]}>
            <NumberInput
              value={max || null}
              min={0}
              max={20}
              placeholder="—"
              onChange={(v) => setMax(level, v)}
              aria-label={`${ORD[level]} level slots`}
              className={max ? "text-lg font-semibold" : "text-lg"}
            />
          </Field>
        );
      })}
    </div>
  );
}

/* ─── Pact magic: all slots share one level ──────────────────────── */

export function PactSlots({ rows, onChange }) {
  const list = asList(rows);
  const patch = (id, p) => onChange(list.map((r) => (r.id === id ? { ...r, ...p } : r)));

  if (list.length === 0) {
    return (
      <button type="button" className={addBtn} onClick={() => onChange([{ id: newId(), level: 1, slots_max: 1, slots_current: 1 }])}>
        + add pact slots
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {list.map((r) => (
        <div key={r.id} className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <Field label="Slot level">
            <Segmented
              size="sm"
              options={[1, 2, 3, 4, 5].map((l) => ({ value: l, label: ORD[l] }))}
              value={num(r.level)}
              onChange={(level) => patch(r.id, { level })}
            />
          </Field>
          <Field label="Slots">
            <NumberInput
              value={num(r.slots_max)}
              min={1}
              max={10}
              fallback={1}
              onChange={(v) => patch(r.id, { slots_max: v, slots_current: clampCurrent(r.slots_current, v) })}
              className="w-14"
            />
          </Field>
          <span className="pb-1">
            <InkRemove onClick={() => onChange(list.filter((x) => x.id !== r.id))} label="Remove pact slots" />
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Sorcery points ─────────────────────────────────────────────── */

export function SorceryEditor({ value, onChange }) {
  const sp = value || {};
  const max = num(sp.max_charges) || 0;

  const setMax = (v) => {
    const m = v || 0;
    onChange({
      ...sp,
      max_charges: v ?? "",
      current_charges: clampCurrent(sp.current_charges, m),
      reset_amount: Math.min(num(sp.reset_amount) || 0, m),
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
      <Field label="Max">
        <NumberInput value={num(sp.max_charges)} min={0} max={40} placeholder="—" onChange={setMax} className="w-14" />
      </Field>
      <Field label="Left" hint="Empty means full">
        <NumberInput
          value={sp.current_charges === "" ? null : num(sp.current_charges)}
          min={0}
          max={max || undefined}
          placeholder={max ? String(max) : "—"}
          onChange={(v) => onChange({ ...sp, current_charges: v ?? "" })}
          className="w-14"
        />
      </Field>
      <Field label="Regain on short rest" hint="e.g. Sorcerous Restoration">
        <NumberInput
          value={num(sp.reset_amount) || 0}
          min={0}
          max={max || undefined}
          fallback={0}
          onChange={(v) => onChange({ ...sp, reset_amount: v ?? 0 })}
          className="w-14"
        />
      </Field>
    </div>
  );
}