import React from "react";
import { INK, InkRemove } from "../../../styles/parchment";
import { Field, Fieldset, Hint, NumberInput, Segmented, Switch, TextBlock, addBtn, dangerBtn, inputBase, inputCls } from "../../../styles/parchmentForm";
import { EFFECT_SECTIONS } from "../../Catalogues/Monsters/monsterHelpers";
import { idGen } from "../../Characters/sheet/define/effectEditor";
import { CONDITION_OPTIONS, DAMAGE_TYPES } from "../../../utils/Constants";

/* The editor that opens under a monster's trait or action on the
   statblock card. It edits the catalogue's own item shape (the same
   fields as the monster form in the Catalogue):

     { name, effect_type: utility | attack | save, range,
       attack: { attack_type, hit_bonus, damages[] },
       save:   { target, dc_bonus, half_damage, damages[], conditions[] },
       charges: { max_charges, current_charges, reset_type,
                  recharge_dice, per_rest_count },
       notes }

   Numbers here are written out in full (a monster's +7 to hit is just 7),
   unlike a character's, which are worked out from its scores. */

const ROLLS = [
  { value: "utility", label: "None", hint: "No roll — a trait, buff or rider" },
  { value: "attack", label: "Attack", hint: "It rolls to hit" },
  { value: "save", label: "Save", hint: "The target rolls a saving throw" },
];
const ATTACK_TYPES = [
  { value: "mw", label: "Melee weapon" },
  { value: "rw", label: "Ranged weapon" },
  { value: "ms", label: "Melee spell" },
  { value: "rs", label: "Ranged spell" },
];
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const DICE = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];
const RESETS = [
  { value: "long_rest", label: "per day" },
  { value: "short_rest", label: "per short rest" },
  { value: "recharge_dice", label: "recharge" },
  { value: "special", label: "special" },
];
const CONDITIONS = [...CONDITION_OPTIONS.map((c) => c.toLowerCase()), "other"];

const newDamage = () => ({ id: idGen(), dice_count: 1, dice_size: "d6", mod: 0, damage_type: "" });

function Damages({ damages, onChange }) {
  const list = Array.isArray(damages) ? damages : [];
  const patch = (i, p) => onChange(list.map((d, j) => (j === i ? { ...d, ...p } : d)));
  return (
    <div className="space-y-1.5">
      {list.map((d, i) => (
        <div key={d.id || i} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <NumberInput value={d.dice_count ?? null} min={0} placeholder="#" onChange={(v) => patch(i, { dice_count: v })} className="w-10" aria-label="Number of dice" />
          <select value={d.dice_size || ""} onChange={(e) => patch(i, { dice_size: e.target.value })} className={`${inputBase} w-16 cursor-pointer`} aria-label="Die">
            {DICE.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span className={INK.faded}>+</span>
          <NumberInput value={d.mod ?? null} placeholder="0" onChange={(v) => patch(i, { mod: v ?? 0 })} className="w-10" aria-label="Flat damage" />
          <select
            value={String(d.damage_type || "").toLowerCase()}
            onChange={(e) => patch(i, { damage_type: e.target.value })}
            className={`${inputBase} min-w-[7rem] flex-1 cursor-pointer capitalize`}
            aria-label="Damage type"
          >
            <option value="">type…</option>
            {DAMAGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <InkRemove onClick={() => onChange(list.filter((_, j) => j !== i))} label="Remove damage" />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...list, newDamage()])} className={addBtn}>
        + damage
      </button>
    </div>
  );
}

export default function MonsterRowEditor({ entry, row, onPatch, onRemove, onDone, onMove }) {
  const type = row.effect_type || "utility";
  const attack = row.attack || {};
  const save = row.save || {};
  const charges = row.charges || null;
  const reset = charges?.reset_type || "long_rest";

  // Switching the roll keeps the other part's numbers, in case you switch back.
  const setType = (v) => {
    const p = { effect_type: v };
    if (v === "attack" && !row.attack) p.attack = { attack_type: "mw", hit_bonus: 0, damages: [] };
    if (v === "save" && !row.save) p.save = { target: "dex", dc_bonus: 10, half_damage: false, damages: [], conditions: [] };
    onPatch(p);
  };

  const setCharges = (p) => {
    const next = { ...(charges || {}), ...p };
    const max = Number(next.max_charges) || 0;
    // The dots start full whenever the maximum changes.
    if ("max_charges" in p) next.current_charges = max;
    if (next.reset_type === "long_rest" || next.reset_type === "short_rest") next.per_rest_count = max || null;
    else next.per_rest_count = null;
    if (next.reset_type !== "recharge_dice") next.recharge_dice = null;
    onPatch({ charges: next });
  };

  const toggleCondition = (c) => {
    const cur = Array.isArray(save.conditions) ? save.conditions : [];
    onPatch({ save: { ...save, conditions: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c] } });
  };

  return (
    <div className="@container mb-4 ml-[26px] mt-2 space-y-4 border-l-2 border-[#9a3412]/40 pl-4">
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
            {EFFECT_SECTIONS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap gap-x-10 gap-y-3">
        <Field label="Roll">
          <Segmented options={ROLLS} value={type} onChange={setType} />
        </Field>
        {type !== "utility" && (
          <Field label="Range / reach (ft)" className="w-36">
            <NumberInput value={row.range ?? null} min={0} placeholder="—" onChange={(v) => onPatch({ range: v })} />
          </Field>
        )}
      </div>

      {type === "attack" && (
        <Fieldset title="Attack">
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <Field label="Type">
                <Segmented size="sm" options={ATTACK_TYPES} value={attack.attack_type || "mw"} onChange={(v) => onPatch({ attack: { ...attack, attack_type: v } })} />
              </Field>
              <Field label="To hit">
                <NumberInput value={attack.hit_bonus ?? null} placeholder="0" onChange={(v) => onPatch({ attack: { ...attack, hit_bonus: v ?? 0 } })} className="w-14" />
              </Field>
            </div>
            <Field label="Damage">
              <Damages damages={attack.damages} onChange={(damages) => onPatch({ attack: { ...attack, damages } })} />
            </Field>
          </div>
        </Fieldset>
      )}

      {type === "save" && (
        <Fieldset title="Saving throw">
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <Field label="Target rolls">
                <Segmented
                  size="sm"
                  options={ABILITIES.map((a) => ({ value: a, label: a.toUpperCase() }))}
                  value={save.target || "dex"}
                  onChange={(v) => onPatch({ save: { ...save, target: v } })}
                />
              </Field>
              <Field label="DC">
                <NumberInput value={save.dc_bonus ?? null} min={0} placeholder="—" onChange={(v) => onPatch({ save: { ...save, dc_bonus: v ?? 0 } })} className="w-14" />
              </Field>
              <span className="flex items-center gap-1.5 pb-1 text-sm">
                <Switch checked={!!save.half_damage} onChange={(v) => onPatch({ save: { ...save, half_damage: v } })} label="Half damage on a success" />
                half on a success
              </span>
            </div>
            <Field label="Damage">
              <Damages damages={save.damages} onChange={(damages) => onPatch({ save: { ...save, damages } })} />
            </Field>
            <Field label="Conditions on a fail">
              <span className="flex flex-wrap gap-x-3 gap-y-1">
                {CONDITIONS.map((c) => {
                  const on = (save.conditions || []).includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleCondition(c)}
                      className={`text-sm capitalize transition ${on ? `${INK.rubric} underline decoration-dotted underline-offset-4` : `${INK.faded} hover:text-[#3a2716]`}`}
                    >
                      {c}
                    </button>
                  );
                })}
              </span>
            </Field>
          </div>
        </Fieldset>
      )}

      <Fieldset
        title="Limited uses"
        right={
          <Switch
            checked={!!charges}
            label="Has limited uses"
            onChange={(v) => onPatch({ charges: v ? { max_charges: 1, current_charges: 1, reset_type: "long_rest", per_rest_count: 1, recharge_dice: null } : null })}
          />
        }
      >
        {charges ? (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <Field label="Uses">
              <NumberInput value={charges.max_charges ?? null} min={1} max={20} fallback={1} onChange={(v) => setCharges({ max_charges: v })} className="w-12" />
            </Field>
            <Field label="Comes back">
              <Segmented size="sm" options={RESETS} value={reset} onChange={(v) => setCharges({ reset_type: v, recharge_dice: v === "recharge_dice" ? charges.recharge_dice || "5" : null })} />
            </Field>
            {reset === "recharge_dice" && (
              <Field label="On a d6 of">
                <select value={String(charges.recharge_dice || "5")} onChange={(e) => setCharges({ recharge_dice: e.target.value })} className={`${inputBase} w-20 cursor-pointer`}>
                  {["4", "5", "6"].map((d) => (
                    <option key={d} value={d}>
                      {d === "6" ? "6" : `${d}–6`}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        ) : (
          <Hint>Unlimited. Turn on the diamond for things like 3/day or Recharge 5–6.</Hint>
        )}
      </Fieldset>

      <Field label="Text">
        <TextBlock value={row.notes} onChange={(e) => onPatch({ notes: e.target.value })} placeholder="What it does, as the statblock reads…" minRows={2} />
      </Field>

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