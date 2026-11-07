import React, { useState } from "react";
import useMinionStore from "../../../../store/MinionStore";
import { usePopupStore } from "../../../../store/PopupStore";
import { INK, InkButton, InkRemove, ParchmentSheet, Title } from "../../../../styles/parchment";
import { Field, Hint, NumberInput, addBtn, inputCls } from "../../../../styles/parchmentForm";
import CatalogueMonsterPicker from "../../../Catalogues/Monsters/CatalogueMonsterPicker";
import { buildMinion, displayName, hpMaxOf, monsterAc, monsterSubtitle, resizeUnits, setHpMax } from "./minionHelpers";

/* Define tab: which minions this character controls, on parchment.
   Add from the catalogue, then set count, nickname and max HP.
   Full statblock editing stays in the monster catalogue. */

// −  n  +  for the number of units. The number can be typed; it's applied
// on Enter or when leaving the field, so typing "12" doesn't first shrink
// the group to 1.
function Count({ value, onChange, label }) {
  const btn = `w-6 text-center text-lg leading-none ${INK.faded} hover:text-[#3a2716] disabled:opacity-30`;
  return (
    <span className="inline-flex items-baseline">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label={`Fewer ${label}`}>
        −
      </button>
      <NumberInput value={value} min={1} max={99} fallback={value} onChange={(n) => n !== value && onChange(n)} aria-label={`Number of ${label}`} className="w-10 text-lg font-semibold" />
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= 99} aria-label={`More ${label}`}>
        +
      </button>
    </span>
  );
}

function MinionEntry({ minion }) {
  const saveMinion = useMinionStore((s) => s.saveMinion);
  const removeMinion = useMinionStore((s) => s.removeMinion);
  const openPopup = usePopupStore((s) => s.open);

  const m = minion.monster || {};
  const count = (minion.units || []).length;
  const ac = monsterAc(m);

  const onRemove = () => {
    if (window.confirm(`Remove ${displayName(minion)} (${count}) from this character?`)) removeMinion(minion.id);
  };

  return (
    <div className="group space-y-2">
      <div className="flex items-baseline gap-2">
        <button type="button" onClick={() => openPopup("monster", m)} title="Open the statblock" className="truncate text-left text-xl hover:underline hover:decoration-dotted hover:underline-offset-4">
          {displayName(minion)}
        </button>
        <span className={`truncate text-xs italic ${INK.faded}`}>
          {minion.nickname ? `${m.name} · ` : ""}
          {monsterSubtitle(m)}
          {ac != null ? ` · AC ${ac}` : ""}
        </span>
        <span className="ml-auto opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <InkRemove onClick={onRemove} label="Remove minion" />
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <Field label="Nickname" className="min-w-[10rem] flex-1">
          <input type="text" value={minion.nickname || ""} placeholder={m.name} onChange={(e) => saveMinion({ ...minion, nickname: e.target.value })} className={inputCls} />
        </Field>
        <Field label="How many">
          <Count value={count} onChange={(n) => saveMinion(resizeUnits(minion, n))} label="units" />
        </Field>
        <Field label="Max HP each">
          <NumberInput value={hpMaxOf(minion)} min={1} fallback={hpMaxOf(minion)} onChange={(v) => v && saveMinion(setHpMax(minion, v))} aria-label="Max HP" className="w-14 text-lg font-semibold" />
        </Field>
      </div>
    </div>
  );
}

export default function MinionsDefine() {
  const minions = useMinionStore((s) => s.minions);
  const loading = useMinionStore((s) => s.loading);
  const error = useMinionStore((s) => s.error);
  const clearError = useMinionStore((s) => s.clearError);
  const addMinion = useMinionStore((s) => s.addMinion);

  const [pickerOpen, setPickerOpen] = useState(false);

  const onAdd = async (monster, count) => {
    const created = await addMinion(buildMinion(monster, count));
    return !!created;
  };

  const unitCount = minions.reduce((n, m) => n + (m.units || []).length, 0);

  return (
    <ParchmentSheet>
      <Title
        after={
          <span className={`text-sm italic ${INK.faded}`}>
            {minions.length} {minions.length === 1 ? "group" : "groups"} · {unitCount} {unitCount === 1 ? "creature" : "creatures"}
          </span>
        }
        right={
          !pickerOpen && (
            <button type="button" onClick={() => setPickerOpen(true)} className={addBtn}>
              + from the bestiary
            </button>
          )
        }
      >
        Minions
      </Title>

      {error && (
        <p className={`mb-4 flex flex-wrap items-baseline gap-x-3 text-sm italic ${INK.rubric}`}>
          Couldn't save minions: {error}
          <InkButton onClick={clearError}>dismiss</InkButton>
        </p>
      )}

      {pickerOpen && (
        <div className="mb-8">
          <CatalogueMonsterPicker title="Add minions" addLabel="add them" onAdd={onAdd} onClose={() => setPickerOpen(false)} />
        </div>
      )}

      {minions.length === 0 ? (
        <Hint className="py-6 text-center">{loading ? "Gathering your minions…" : "No minions yet. Add one from the monster catalogue."}</Hint>
      ) : (
        <div className="grid grid-cols-1 gap-x-12 gap-y-8 @4xl:grid-cols-2">
          {minions.map((m) => (
            <MinionEntry key={m.id} minion={m} />
          ))}
        </div>
      )}
    </ParchmentSheet>
  );
}