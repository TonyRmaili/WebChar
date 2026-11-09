import React, { useState } from "react";
import FilterSection from "../FilterSection";
import {
  ChipsHeading,
  addRowCls,
  boxCls,
  checkCls,
  checkLabelCls,
  chip,
  fieldCls,
  labelCls,
  removeRowCls,
  textareaCls,
} from "../catalogueStyle";
import { EFFECT_SECTIONS, ABILITY, ABILITY_ORDER, titleCase } from "./monsterHelpers";
import { DAMAGE_TYPES, CONDITION_OPTIONS } from "../../../utils/Constants";

const DICE_SIZES = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];
const ATTACK_TYPES = [
  ["mw", "Melee Weapon"],
  ["rw", "Ranged Weapon"],
  ["ms", "Melee Spell"],
  ["rs", "Ranged Spell"],
];
const RESET_TYPES = [
  ["long_rest", "Per Day (long rest)"],
  ["short_rest", "Per Short Rest"],
  ["recharge_dice", "Recharge (dice)"],
  ["special", "Special"],
];
const RECHARGE_DICE = ["4", "5", "6"];
const SAVE_CONDITION_OPTIONS = [...new Set([...(CONDITION_OPTIONS || []), "other"])];

const cap = (s) => (typeof s === "string" && s ? s[0].toUpperCase() + s.slice(1) : s);
const toNum = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* ─── form ⇄ payload shape ─────────────────────────────────────────── */

export const emptyEffects = () =>
  EFFECT_SECTIONS.reduce((acc, { key }) => { acc[key] = []; return acc; }, {});

const emptyItem = () => ({
  name: "",
  effect_type: "utility",       // utility | attack | save
  range: "",
  attack_type: "mw",
  hit_bonus: "",
  attack_damages: [],
  save_target: "dex",
  save_dc_bonus: "",
  save_damages: [],
  save_half: false,
  save_conditions: [],
  notes: "",
  has_charges: false,
  charge_max: "",
  charge_current: "",
  charge_reset: "long_rest",
  charge_recharge_dice: "",
  charge_per_rest: "",
});

const emptyDmg = () => ({ dice_count: "1", dice_size: "d6", mod: "0", damage_type: "" });

const dmgToForm = (d) => ({
  dice_count: d?.dice_count != null ? String(d.dice_count) : "",
  dice_size: d?.dice_size || "d6",
  mod: d?.mod != null ? String(d.mod) : "0",
  damage_type: d?.damage_type || "",
});

const itemToForm = (it) => {
  const f = emptyItem();
  f.name = it?.name || "";
  f.effect_type = it?.effect_type || "utility";
  f.range = it?.range != null ? String(it.range) : "";
  f.notes = it?.notes || "";
  if (it?.attack) {
    f.attack_type = it.attack.attack_type || "mw";
    f.hit_bonus = it.attack.hit_bonus != null ? String(it.attack.hit_bonus) : "";
    f.attack_damages = Array.isArray(it.attack.damages) ? it.attack.damages.map(dmgToForm) : [];
  }
  if (it?.save) {
    f.save_target = it.save.target || "dex";
    f.save_dc_bonus = it.save.dc_bonus != null ? String(it.save.dc_bonus) : "";
    f.save_damages = Array.isArray(it.save.damages) ? it.save.damages.map(dmgToForm) : [];
    f.save_half = !!it.save.half_damage;
    f.save_conditions = Array.isArray(it.save.conditions) ? it.save.conditions : [];
  }
  if (it?.charges) {
    f.has_charges = true;
    f.charge_max = it.charges.max_charges != null ? String(it.charges.max_charges) : "";
    f.charge_current = it.charges.current_charges != null ? String(it.charges.current_charges) : "";
    f.charge_reset = it.charges.reset_type || "long_rest";
    f.charge_recharge_dice = it.charges.recharge_dice != null ? String(it.charges.recharge_dice) : "";
    f.charge_per_rest = it.charges.per_rest_count != null ? String(it.charges.per_rest_count) : "";
  }
  return f;
};

export const effectsToForm = (effects) => {
  const out = emptyEffects();
  if (!effects || typeof effects !== "object") return out;
  for (const { key } of EFFECT_SECTIONS) {
    const items = effects[key]?.items;
    if (Array.isArray(items)) out[key] = items.map(itemToForm);
  }
  return out;
};

const dmgToPayload = (d) => ({
  dice_count: toNum(d.dice_count),
  dice_size: d.dice_size || null,
  mod: toNum(d.mod) ?? 0,           // 0 is meaningful; matches dataset
  damage_type: d.damage_type ? cap(d.damage_type) : null,
});
const validDmg = (d) => toNum(d.dice_count) != null && d.dice_size && d.damage_type;

const itemToPayload = (f) => {
  const item = {
    name: (f.name || "").trim(),
    effect_type: f.effect_type || "utility",
    range: toNum(f.range),
    attack: null,
    save: null,
    notes: (f.notes || "").trim() || null,
    charges: null,
  };

  if (f.effect_type === "attack") {
    item.attack = {
      attack_type: f.attack_type || "mw",
      hit_bonus: toNum(f.hit_bonus) ?? 0,
      damages: (f.attack_damages || []).filter(validDmg).map(dmgToPayload),
    };
  }

  if (f.effect_type === "save") {
    item.save = {
      target: f.save_target || "dex",
      dc_bonus: toNum(f.save_dc_bonus) ?? 0,
      damages: (f.save_damages || []).filter(validDmg).map(dmgToPayload),
      half_damage: !!f.save_half,
      conditions: f.save_conditions || [],
    };
  }

  if (f.has_charges) {
    const reset = f.charge_reset || "long_rest";
    const max = toNum(f.charge_max);
    const per = toNum(f.charge_per_rest);
    const dice = reset === "recharge_dice" ? (f.charge_recharge_dice || null) : null;
    const meaningful = max != null || per != null || dice != null || reset === "special";
    if (meaningful) {
      item.charges = {
        max_charges: max,
        current_charges: toNum(f.charge_current) ?? max,
        reset_type: reset,
        recharge_dice: dice,
        per_rest_count: (reset === "long_rest" || reset === "short_rest") ? per : null,
      };
    }
  }

  return item;
};

export const formToEffects = (formEffects) => {
  const out = {};
  for (const { key } of EFFECT_SECTIONS) {
    const rows = (formEffects?.[key] || []).filter((f) => (f.name || "").trim());
    if (rows.length) out[key] = { items: rows.map(itemToPayload) };
  }
  return out; // headers intentionally omitted; nulls cleaned by pruneEmpty in the popup
};

/* ─── component ─────────────────────────────────────────────────────── */


export default function MonsterEffectsBuilder({ value, onChange }) {
  const v = value || emptyEffects();
  const update = (key, items) => onChange({ ...v, [key]: items });
  const addItem = (key) => update(key, [...(v[key] || []), emptyItem()]);
  const removeItem = (key, idx) => update(key, (v[key] || []).filter((_, i) => i !== idx));
  const patchItem = (key, idx, patch) =>
    update(key, (v[key] || []).map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const addDmg = (key, idx, field) =>
    patchItem(key, idx, { [field]: [...(v[key][idx][field] || []), emptyDmg()] });
  const patchDmg = (key, idx, field, dIdx, patch) =>
    patchItem(key, idx, { [field]: v[key][idx][field].map((d, j) => (j === dIdx ? { ...d, ...patch } : d)) });
  const removeDmg = (key, idx, field, dIdx) =>
    patchItem(key, idx, { [field]: v[key][idx][field].filter((_, j) => j !== dIdx) });

  const toggleCond = (key, idx, c) => {
    const cur = v[key][idx].save_conditions || [];
    patchItem(key, idx, { save_conditions: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c] });
  };

  return (
    <>
      {EFFECT_SECTIONS.map(({ key, title }) => {
        const items = v[key] || [];
        return (
          <FilterSection key={key} title={`${title}${items.length ? ` (${items.length})` : ""}`}>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <ItemEditor
                  key={idx}
                  item={it}
                  index={idx}
                  onPatch={(patch) => patchItem(key, idx, patch)}
                  onRemove={() => removeItem(key, idx)}
                  damageHandlers={{
                    add: (field) => addDmg(key, idx, field),
                    patch: (field, dIdx, patch) => patchDmg(key, idx, field, dIdx, patch),
                    remove: (field, dIdx) => removeDmg(key, idx, field, dIdx),
                  }}
                  onToggleCond={(c) => toggleCond(key, idx, c)}
                />
              ))}
              <button onClick={() => addItem(key)}
                      className={addRowCls}>
                + Add Entry
              </button>
            </div>
          </FilterSection>
        );
      })}
    </>
  );
}

function ItemEditor({ item, index, onPatch, onRemove, damageHandlers, onToggleCond }) {
  return (
    <div className={boxCls}>
      <div className="flex justify-between items-center">
        <span className={labelCls}>
          {item.name ? item.name : `Entry ${index + 1}`}
        </span>
        <button onClick={onRemove} aria-label="Remove" className={removeRowCls}>✕</button>
      </div>

      <input type="text" value={item.name} onChange={(e) => onPatch({ name: e.target.value })}
             placeholder="Name (e.g. Acid Breath)" className={fieldCls} />

      <div className="flex gap-x-4">
        {["utility", "attack", "save"].map((t) => (
          <button key={t} type="button" onClick={() => onPatch({ effect_type: t })} className={chip(item.effect_type === t)}>
            {cap(t)}
          </button>
        ))}
      </div>

      {(item.effect_type === "attack" || item.effect_type === "save") && (
        <div className="max-w-[140px]">
          <div className={labelCls}>Range / Reach (ft.)</div>
          <input type="number" value={item.range} onChange={(e) => onPatch({ range: e.target.value })} className={fieldCls} placeholder="—" />
        </div>
      )}

      {item.effect_type === "attack" && (
        <div className="space-y-2 border-l border-rule/30 pl-3">
          <div className="grid grid-cols-2 gap-x-4">
            <div>
              <div className={labelCls}>Attack Type</div>
              <select value={item.attack_type} onChange={(e) => onPatch({ attack_type: e.target.value })} className={fieldCls}>
                {ATTACK_TYPES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>
            </div>
            <div>
              <div className={labelCls}>Hit Bonus</div>
              <input type="number" value={item.hit_bonus} onChange={(e) => onPatch({ hit_bonus: e.target.value })} className={fieldCls} placeholder="±" />
            </div>
          </div>
          <DamageRows damages={item.attack_damages} field="attack_damages" handlers={damageHandlers} />
        </div>
      )}

      {item.effect_type === "save" && (
        <div className="space-y-2 border-l border-rule/30 pl-3">
          <div className="grid grid-cols-3 gap-x-4 items-end">
            <div>
              <div className={labelCls}>Save</div>
              <select value={item.save_target} onChange={(e) => onPatch({ save_target: e.target.value })} className={fieldCls}>
                {ABILITY_ORDER.map((a) => <option key={a} value={a}>{ABILITY[a]}</option>)}
              </select>
            </div>
            <div>
              <div className={labelCls}>DC</div>
              <input type="number" value={item.save_dc_bonus} onChange={(e) => onPatch({ save_dc_bonus: e.target.value })} className={fieldCls} placeholder="—" />
            </div>
            <label className={`${checkLabelCls} self-end pb-1`}>
              <input type="checkbox" className={checkCls} checked={item.save_half} onChange={(e) => onPatch({ save_half: e.target.checked })} />
              half on save
            </label>
          </div>
          <DamageRows damages={item.save_damages} field="save_damages" handlers={damageHandlers} />
          <CondChips selected={item.save_conditions} onToggle={onToggleCond} />
        </div>
      )}

      <div>
        <div className={labelCls}>Notes (shown in the statblock)</div>
        <textarea value={item.notes} onChange={(e) => onPatch({ notes: e.target.value })} rows={3} className={textareaCls}
          placeholder="e.g. Melee Attack Roll: +15, reach 15 ft. Hit: 17 (2d8 + 8) Slashing damage." />
      </div>

      <div className="border-t border-dotted border-rule/40 pt-2">
        <label className={`${checkLabelCls} mb-1`}>
          <input type="checkbox" className={checkCls} checked={item.has_charges} onChange={(e) => onPatch({ has_charges: e.target.checked })} />
          Limited uses / recharge
        </label>
        {item.has_charges && (
          <div className="space-y-2 pl-1">
            <div className="grid grid-cols-3 gap-x-4">
              <div>
                <div className={labelCls}>Reset</div>
                <select value={item.charge_reset} onChange={(e) => onPatch({ charge_reset: e.target.value })} className={fieldCls}>
                  {RESET_TYPES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </div>
              <div>
                <div className={labelCls}>Max</div>
                <input type="number" value={item.charge_max} onChange={(e) => onPatch({ charge_max: e.target.value })} className={fieldCls} placeholder="—" />
              </div>
              {item.charge_reset === "recharge_dice" ? (
                <div>
                  <div className={labelCls}>Recharge</div>
                  <select value={item.charge_recharge_dice} onChange={(e) => onPatch({ charge_recharge_dice: e.target.value })} className={fieldCls}>
                    <option value="">—</option>
                    {RECHARGE_DICE.map((d) => <option key={d} value={d}>{d}–6</option>)}
                  </select>
                </div>
              ) : (item.charge_reset === "long_rest" || item.charge_reset === "short_rest") ? (
                <div>
                  <div className={labelCls}>Per Rest</div>
                  <input type="number" value={item.charge_per_rest} onChange={(e) => onPatch({ charge_per_rest: e.target.value })} className={fieldCls} placeholder="—" />
                </div>
              ) : <div />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DamageRows({ damages, field, handlers }) {
  return (
    <div className="space-y-1.5">
      <div className={labelCls}>Damage</div>
      {(damages || []).map((d, dIdx) => (
        <div key={dIdx} className="flex items-baseline gap-2">
          <input type="number" value={d.dice_count} onChange={(e) => handlers.patch(field, dIdx, { dice_count: e.target.value })}
                 className={`${fieldCls} max-w-[56px]`} placeholder="#" />
          <select value={d.dice_size} onChange={(e) => handlers.patch(field, dIdx, { dice_size: e.target.value })}
                  className={`${fieldCls} max-w-[80px]`}>
            {DICE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="text-sm text-ink-faded">+</span>
          <input type="number" value={d.mod} onChange={(e) => handlers.patch(field, dIdx, { mod: e.target.value })}
                 className={`${fieldCls} max-w-[60px]`} placeholder="0" />
          <select value={d.damage_type} onChange={(e) => handlers.patch(field, dIdx, { damage_type: e.target.value })}
                  className={`${fieldCls} flex-1`}>
            <option value="">type…</option>
            {(DAMAGE_TYPES || []).map((t) => <option key={t} value={t}>{cap(t)}</option>)}
          </select>
          <button onClick={() => handlers.remove(field, dIdx)}
                  aria-label="Remove" className={removeRowCls}>✕</button>
        </div>
      ))}
      <button onClick={() => handlers.add(field)}
              className={addRowCls}>
        + Damage
      </button>
    </div>
  );
}

function CondChips({ selected, onToggle }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <ChipsHeading open={open} onToggle={() => setOpen((o) => !o)} label="Conditions on fail" count={selected.length} />
      {open && (
        <div className="flex flex-wrap gap-2 pl-3 mb-1 max-h-32 overflow-y-auto pr-1">
          {SAVE_CONDITION_OPTIONS.map((c) => (
            <button key={c} type="button" onClick={() => onToggle(c)} className={chip(selected.includes(c))}>
              {titleCase(c)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}