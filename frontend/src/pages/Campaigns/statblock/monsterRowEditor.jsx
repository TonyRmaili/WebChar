import React from "react";
import { Field, Fieldset, Hint, NumberInput, Segmented, Switch, TextBlock, addBtn, dangerBtn, inputBase, inputCls } from "../../../styles/parchmentForm";
import { ActionEditor } from "../../Catalogues/catalogueParts";
import { RESETS } from "../../../utils/featureRuntime";
import { MONSTER_SECTIONS } from "./monsterStatblock";

/* The editor that opens under a monster's (or a template's) trait or
   action on the statblock card. It edits the shared feature layout, the
   same one the Catalogue's monster form writes:

     { name, category, text, uses { max, reset, recharge }, cost,
       action { range, area, attack {…}, save {…}, damage[] } }

   Numbers are written out in full (a monster's +7 to hit is just 7).
   A number the book gives as a formula (a summon's "3 + spell level")
   stays words until you write a real number here. */

export default function MonsterRowEditor({ entry, row, onPatch, onRemove, onDone, onMove }) {
  const uses = row.uses || null;
  const reset = uses?.reset || "long";

  // The dots start full whenever the uses change.
  const setUses = (p) => {
    const next = { ...(uses || {}), ...p };
    if (next.reset !== "recharge") delete next.recharge;
    onPatch({ uses: next, uses_left: Number(next.max) || 1 });
  };

  return (
    <div className="@container mb-4 ml-[26px] mt-2 space-y-4 border-l-2 border-rubric/40 pl-4">
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field label="Name">
          <input
            type="text"
            value={row.name ?? ""}
            autoFocus={!row.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            placeholder="e.g. Fire Breath"
            className={`${inputCls} text-[17px]`}
          />
        </Field>
        <Field label="Section">
          <select value={entry.ref.list} onChange={(e) => onMove(e.target.value)} className={`${inputCls} cursor-pointer`}>
            {MONSTER_SECTIONS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Text">
        <TextBlock value={row.text ?? ""} onChange={(e) => onPatch({ text: e.target.value })} placeholder="What it does, as the statblock reads…" minRows={2} />
      </Field>

      <Fieldset title="Rolls">
        <ActionEditor value={row.action} onChange={(action) => onPatch({ action })} />
      </Fieldset>

      <Fieldset
        title="Limited uses"
        right={
          <Switch
            checked={!!uses}
            label="Has limited uses"
            onChange={(v) => onPatch(v ? { uses: { max: 1, reset: "long" }, uses_left: 1 } : { uses: undefined, uses_left: undefined })}
          />
        }
      >
        {uses ? (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <Field label="Uses">
              <NumberInput value={uses.max ?? null} min={1} max={20} fallback={1} onChange={(v) => setUses({ max: v })} className="w-12" />
            </Field>
            <Field label="Comes back">
              <Segmented size="sm" options={RESETS} value={reset} onChange={(v) => setUses({ reset: v, recharge: v === "recharge" ? uses.recharge || 5 : undefined })} />
            </Field>
            {reset === "recharge" && (
              <Field label="On a d6 of">
                <select value={String(uses.recharge || 5)} onChange={(e) => setUses({ recharge: Number(e.target.value) })} className={`${inputBase} w-20 cursor-pointer`}>
                  {[4, 5, 6].map((d) => (
                    <option key={d} value={d}>
                      {d === 6 ? "6" : `${d}–6`}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        ) : (
          <Hint>Unlimited. Switch it on for things like 3/Day or Recharge 5–6.</Hint>
        )}
      </Fieldset>

      {entry.ref.list === "legendary_actions" && (
        <Field label="Costs (legendary actions)">
          <NumberInput value={row.cost ?? null} min={1} max={5} placeholder="1" onChange={(v) => onPatch({ cost: v > 1 ? v : undefined })} className="w-12" />
        </Field>
      )}

      <div className="flex flex-wrap items-baseline justify-end gap-x-4">
        <button type="button" onClick={onRemove} className={dangerBtn}>
          delete
        </button>
        <button type="button" onClick={onDone} className={addBtn}>
          done
        </button>
      </div>
    </div>
  );
}
