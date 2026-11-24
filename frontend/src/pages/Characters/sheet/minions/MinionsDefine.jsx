import React, { useState } from "react";
import useMinionStore from "../../../../store/MinionStore";
import useAuthStore from "../../../../store/AuthStore";
import { useCatalogueStore } from "../../../../store/CatalogueStore";
import { usePopupStore } from "../../../../store/PopupStore";
import { INK, InkButton, InkRemove, ParchmentSheet, Title } from "../../../../styles/parchment";
import { Field, Hint, NumberInput, addBtn } from "../../../../styles/parchmentForm";
import CatalogueMonsterPicker from "../../../Catalogues/Monsters/CatalogueMonsterPicker";
import MonsterCardForm from "../../../Catalogues/Monsters/MonsterCardForm";
import { buildMinion, displayName, hpMaxOf, monsterAc, monsterSubtitle, resizeUnits, setHpMax, withMonster } from "./minionHelpers";

/* Define tab: which minions this character controls, on parchment.
   "+ from the bestiary": a row's "add" adds one straight away (more with
   the "How many" stepper). Each group: how many, max HP, and "edit": the
   monster card (MonsterCardForm, sheet mode) for this group's own
   statblock, its nickname, and whether the catalogue gets it too. */

// −  n  +  for the number of units. The number can be typed; it's applied
// on Enter or when leaving the field, so typing "12" doesn't first shrink
// the group to 1.
function Count({ value, onChange, label }) {
  const btn = `w-6 text-center text-lg leading-none ${INK.faded} hover:text-ink disabled:opacity-30`;
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

function MinionEntry({ minion, onEdit }) {
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
        <span className="ml-auto flex shrink-0 items-baseline gap-3">
          <InkButton onClick={onEdit} title="Its statblock, nickname, and saving it to your catalogue">
            edit
          </InkButton>
          <span className="opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <InkRemove onClick={onRemove} label="Remove minion" />
          </span>
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
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
  const saveMinion = useMinionStore((s) => s.saveMinion);
  const catalogueMonsters = useCatalogueStore((s) => s.monsters);
  const createMonster = useCatalogueStore((s) => s.createMonster);
  const updateMonster = useCatalogueStore((s) => s.updateMonster);
  const userName = useAuthStore((s) => s.userData?.name);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // the group the monster card edits

  const onAdd = async (monster) => {
    const created = await addMinion(buildMinion(monster, 1));
    return !!created;
  };

  // The player's own catalogue entry a group's statblock comes from (saving to the catalogue updates it).
  const homebrewOf = (minion) => {
    const id = minion?.monster?.id;
    const entry = id ? (catalogueMonsters || []).find((c) => c.id === id) : null;
    return entry && entry.visibility && entry.created_by === userName ? { id: entry.id, name: entry.name, visibility: entry.visibility } : null;
  };
  const startEdit = (minion) => {
    // The catalogue tells whether the statblock is the player's own entry.
    const store = useCatalogueStore.getState();
    if (!store.monsters?.length && !store.loadingMonsters) store.loadMonsters();
    setEditingId(minion.id);
  };
  const editing = minions.find((m) => m.id === editingId) || null;

  // The card's save: this group's statblock and nickname, and the catalogue too if asked.
  const submit = async (record, { catalogue, asNew, nickname }) => {
    let rec = record;
    if (catalogue) {
      const target = homebrewOf(editing);
      const entry = { ...record, visibility: record.visibility || "private" };
      delete entry.id;
      rec = target && !asNew ? await updateMonster(target.id, { ...entry, id: target.id }) : await createMonster(entry);
    }
    const latest = useMinionStore.getState().minions.find((m) => m.id === editing.id) || editing;
    saveMinion(withMonster(latest, rec, nickname));
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
          <CatalogueMonsterPicker title="Add minions" oneAtATime onAdd={onAdd} onClose={() => setPickerOpen(false)}
                                  has={(mon) => minions.some((g) => g.monster?.id === mon.id && g.monster?.name === mon.name)} />
        </div>
      )}

      {minions.length === 0 ? (
        <Hint className="py-6 text-center">{loading ? "Gathering your minions…" : "No minions yet. Add one from the monster catalogue."}</Hint>
      ) : (
        <div className="grid grid-cols-1 gap-x-12 gap-y-8 @4xl:grid-cols-2">
          {minions.map((m) => (
            <MinionEntry key={m.id} minion={m} onEdit={() => startEdit(m)} />
          ))}
        </div>
      )}

      <MonsterCardForm
        open={!!editing}
        onClose={() => setEditingId(null)}
        editingMonster={editing ? { ...editing.monster, visibility: homebrewOf(editing)?.visibility } : null}
        sheet={editing ? { onSubmit: submit, homebrew: homebrewOf(editing), nickname: editing.nickname || "" } : null}
      />
    </ParchmentSheet>
  );
}