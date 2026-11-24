import React from "react";
import { fieldCls, hintCls, labelCls, addRowCls, removeRowCls } from "../catalogueStyle";
import { ChipToggles, CurrencyEditor, DiceField, EntryPicker, FoldChips, Segmented } from "../catalogueParts";
import { toggleIn, labelFromId, numOrNull, nameFromId, formatRarity, RARITY_ORDER, DAMAGE_TYPES, CLASS_IDS } from "../catalogueHelpers";
import { MODIFIER_TARGETS, formatModifierTarget } from "./itemHelpers";

/* ═══════════════════════════════════════════════════════════════════
   itemFormParts — the item form's pieces: the windows of the item card
   (ItemCardForm).
   Each piece edits one part of the form (itemHelpers.emptyItemForm):
     TypeFields       item types, tags
     RarityFields     rarity, tier
     AttunementField  requires attunement (+ by whom)
     BaseFields       a base item / built on one (item), or made from
                      base items (variant)
     WeaponFields     the weapon: kind, damage (+ more damage on every
                      hit), two-handed, range, +1, properties, mastery
     ArmorFields      armor or a shield
     ChargesEditor    how many charges and how they come back
     BonusesFields    numbers while equipped (+1 AC)
     MagicFlags       cursed, sentient, spellcasting focus
     ItemSpellsFields spells cast from it, and what each costs
     WeightValueFields
   `known`: words the catalogue already uses (types, tags, properties,
   masteries, base items), offered as chips.
   ═══════════════════════════════════════════════════════════════════ */

export const union = (a, b) => [...new Set([...(a || []), ...(b || [])])];

export const TIERS = [
  { value: "", label: "none" },
  { value: "minor", label: "minor" },
  { value: "major", label: "major" },
];
const WEAPON_CATEGORY = [
  { value: "simple", label: "simple" },
  { value: "martial", label: "martial" },
];
const WEAPON_KIND = [
  { value: "melee", label: "melee" },
  { value: "ranged", label: "ranged" },
];
export const ARMOR_CATEGORY = ["light", "medium", "heavy", "shield"].map((v) => ({ value: v, label: v }));
const MOD_OPS = [
  { value: "add", label: "+" },
  { value: "set", label: "becomes" },
  { value: "min", label: "at least" },
];
// Charges come back on a long or a short rest (the book's "at dawn" / "dusk"
// is a long rest: play.py), all of them or an amount ("1d6 + 1").
const CHARGE_RESETS = [
  { value: "long", label: "on a long rest" },
  { value: "short", label: "on a short rest" },
];
const chargeRest = (reset) => (reset === "short" ? "short" : reset === "special" ? "special" : "long");
const REGAIN_RE = /^\s*(\d+d\d+)\s*(?:\+\s*(\d+))?\s*$/;
const SPELL_USES = [
  { value: "charges", label: "item's charges" },
  { value: "daily", label: "per long rest" },
  { value: "short", label: "per short rest" },
  { value: "once", label: "once" },
  { value: "at_will", label: "at will" },
];

// A spell grant's `uses` ↔ the form's words.
export const usesMode = (u) =>
  u === "at_will" ? "at_will" : u?.resource ? "charges" : u?.reset === "never" ? "once" : u?.reset === "short" ? "short" : "daily";
export const usesFor = (mode, n) =>
  mode === "at_will" ? "at_will"
  : mode === "charges" ? { resource: "charges", cost: n || 1 }
  : mode === "once" ? { max: n || 1, reset: "never" }
  : { max: n || 1, reset: mode === "short" ? "short" : "long" };
export const usesNumber = (u) => (u?.resource ? u.cost : u?.max) ?? 1;

const typeSelect = (value, onChange, label) => (
  <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={`${fieldCls} !w-32`} aria-label={label}>
    <option value="">—</option>
    {DAMAGE_TYPES.map((d) => <option key={d} value={d}>{labelFromId(d)}</option>)}
  </select>
);

export function TypeFields({ form, set, known }) {
  return (
    <div className="space-y-2">
      <ChipToggles options={union(known.types, form.itemTypes)} selected={form.itemTypes} labelOf={labelFromId}
                   onToggle={(t) => set("itemTypes", toggleIn(form.itemTypes, t))} />
      <FoldChips label="Tags" options={union(known.tags, form.itemTags)} selected={form.itemTags}
                 onToggle={(t) => set("itemTags", toggleIn(form.itemTags, t))} />
    </div>
  );
}

export function RarityFields({ form, set, tier = true }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
      <label className="flex items-baseline gap-2">
        <span className={`${labelCls} !mb-0`}>Rarity</span>
        <select value={form.rarity} onChange={(e) => set("rarity", e.target.value)} className={`${fieldCls} !w-40`}>
          {RARITY_ORDER.map((r) => <option key={r} value={r}>{formatRarity(r)}</option>)}
        </select>
      </label>
      {tier && (
        <div className="flex items-baseline gap-2">
          <span className={`${labelCls} !mb-0`}>Tier</span>
          <Segmented size="sm" options={TIERS} value={form.tier} onChange={(v) => set("tier", v)} />
        </div>
      )}
    </div>
  );
}

export function AttunementField({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <label className="flex items-baseline gap-2 text-sm">
        <input type="checkbox" checked={value.required} onChange={(e) => onChange({ required: e.target.checked })} className="accent-rubric" />
        Requires attunement
      </label>
      {value.required && (
        <input type="text" value={value.note} onChange={(e) => onChange({ note: e.target.value })} placeholder="e.g. by a wizard" className={`${fieldCls} !w-56`} />
      )}
    </div>
  );
}

export function BaseFields({ form, set, known, index }) {
  if (form.kind === "item_variant") {
    return (
      <div className="space-y-3">
        <div>
          <div className={labelCls}>Base items it can be made from</div>
          <EntryPicker entries={known.baseItems} index={index} selected={form.appliesTo} placeholder="search base items…"
                       onToggle={(id) => set("appliesTo", toggleIn(form.appliesTo, id))} />
        </div>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <label className="flex items-baseline gap-2">
            <span className={`${labelCls} !mb-0`}>Name</span>
            <input type="text" value={form.nameFormat} onChange={(e) => set("nameFormat", e.target.value)} placeholder="Flame Tongue {base}" className={`${fieldCls} !w-56`} />
          </label>
          <label className="flex items-baseline gap-2">
            <span className={`${labelCls} !mb-0`}>Cut from the base name</span>
            <input type="text" value={form.nameRemove} onChange={(e) => set("nameRemove", e.target.value)} placeholder="e.g. “ Armor”" className={`${fieldCls} !w-32`} />
          </label>
        </div>
        <p className={hintCls}>
          <code>{"{base}"}</code> is the base item's name: “{(form.nameFormat || "{base}").replace("{base}", "Longsword")}”.
        </p>
        <FoldChips label="Weapon properties it adds" options={union(known.properties, form.propertiesAdd)} selected={form.propertiesAdd}
                   onToggle={(p) => set("propertiesAdd", toggleIn(form.propertiesAdd, p))} />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <label className="flex items-baseline gap-2 text-sm">
        <input type="checkbox" checked={form.base} onChange={(e) => set("base", e.target.checked)} className="accent-rubric" />
        A mundane base item (variants can be made from it)
      </label>
      <div>
        <div className={labelCls}>Built on (a unique item made from a base item)</div>
        <EntryPicker entries={known.baseItems} index={index} selected={form.baseItem ? [form.baseItem] : []} placeholder="search base items…"
                     onToggle={(id) => set("baseItem", form.baseItem === id ? "" : id)} />
      </div>
    </div>
  );
}

/* The weapon's numbers (no on/off box: the caller has it). Damage is the
   weapon's own dice and type, then "more damage on every hit" (2d10
   thunder): extra_damage, added to every attack with it, two-handed too.
   variant: it changes a base item's weapon; "the base's" keeps the base's
   category and kind. */
export function WeaponFields({ value: w, onChange, known, variant = false }) {
  const keep = variant ? [{ value: "", label: "the base's" }] : [];
  const extra = w.extra || [];
  const setExtra = (list) => onChange({ extra: list });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <Segmented size="sm" options={[...keep, ...WEAPON_CATEGORY]} value={w.category} onChange={(v) => onChange({ category: v })} />
        <Segmented size="sm" options={[...keep, ...WEAPON_KIND]} value={w.kind} onChange={(v) => onChange({ kind: v })} />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <span className={`${labelCls} !mb-0 w-16`}>Damage</span>
        <DiceField value={w.dice} onChange={(v) => onChange({ dice: v || "" })} label="Damage" />
        {typeSelect(w.type, (v) => onChange({ type: v }), "Damage type")}
        <span className="text-xs italic text-ink-faded">two-handed</span>
        <DiceField value={w.versatile} onChange={(v) => onChange({ versatile: v || "" })} label="Two-handed" />
      </div>
      {extra.map((p, i) => (
        <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <span className="w-16 text-right text-xs text-ink-faded">+</span>
          <DiceField value={p.dice} onChange={(v) => setExtra(extra.map((x, j) => (j === i ? { ...x, dice: v || "" } : x)))} label="More damage" />
          {typeSelect(p.type, (v) => setExtra(extra.map((x, j) => (j === i ? { ...x, type: v } : x))), "More damage type")}
          <span className="text-xs italic text-ink-faded">on every hit</span>
          <button type="button" onClick={() => setExtra(extra.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove this damage">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => setExtra([...extra, { dice: "1d6", type: "" }])} className={`${addRowCls} ml-[4.75rem]`}>
        + more damage on every hit
      </button>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        {/* a range only means something for a ranged or a thrown weapon (a melee
            weapon's reach is 5 ft., 10 with the reach property) */}
        {(w.kind === "ranged" || (w.properties || []).includes("thrown") || w.normal) && (
          <>
            <span className={`${labelCls} !mb-0 w-16`}>{w.kind === "ranged" ? "Range" : "Thrown"}</span>
            <input type="number" min={0} step={5} value={w.normal ?? ""} onChange={(e) => onChange({ normal: numOrNull(e.target.value) })} placeholder="—" className={`${fieldCls} !w-16`} aria-label="Range" />
            <span>/</span>
            <input type="number" min={0} step={5} value={w.long ?? ""} onChange={(e) => onChange({ long: numOrNull(e.target.value) })} placeholder="—" className={`${fieldCls} !w-16`} aria-label="Long range" />
            <span className="mr-6 text-xs text-ink-faded">ft.</span>
          </>
        )}
        <span className={`${labelCls} !mb-0`}>Bonus</span>
        <span className="text-xs italic text-ink-faded">attack +</span>
        <input type="number" value={w.attack || ""} onChange={(e) => onChange({ attack: numOrNull(e.target.value) || 0 })} placeholder="0" className={`${fieldCls} !w-12`} aria-label="Attack bonus" />
        <span className="text-xs italic text-ink-faded">damage +</span>
        <input type="number" value={w.damage || ""} onChange={(e) => onChange({ damage: numOrNull(e.target.value) || 0 })} placeholder="0" className={`${fieldCls} !w-12`} aria-label="Damage bonus" />
      </div>
      <FoldChips label="Properties" options={union(known.properties, w.properties)} selected={w.properties}
                 onToggle={(p) => onChange({ properties: toggleIn(w.properties, p) })} />
      <FoldChips label="Mastery" options={union(known.masteries, w.mastery)} selected={w.mastery}
                 onToggle={(p) => onChange({ mastery: toggleIn(w.mastery, p) })} />
    </div>
  );
}

export function ArmorFields({ value: a, onChange }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
      <Segmented size="sm" options={ARMOR_CATEGORY} value={a.category} onChange={(v) => onChange({ category: v })} />
      <label className="flex items-baseline gap-1.5">
        <span className="text-xs text-ink-faded">{a.category === "shield" ? "AC +" : "AC"}</span>
        <input type="number" value={a.base ?? ""} onChange={(e) => onChange({ base: numOrNull(e.target.value) })} className={`${fieldCls} !w-12`} aria-label="AC" />
      </label>
      {a.category !== "shield" && (
        <label className="flex items-baseline gap-1.5">
          <span className="text-xs text-ink-faded">Dex max (0 = none, empty = full)</span>
          <input type="number" min={0} value={a.dexCap ?? ""} onChange={(e) => onChange({ dexCap: numOrNull(e.target.value) })} className={`${fieldCls} !w-12`} aria-label="Dex max" />
        </label>
      )}
      <label className="flex items-baseline gap-1.5">
        <span className="text-xs text-ink-faded">Str needed</span>
        <input type="number" min={0} value={a.strength ?? ""} onChange={(e) => onChange({ strength: numOrNull(e.target.value) })} className={`${fieldCls} !w-12`} aria-label="Strength needed" />
      </label>
      <label className="flex items-baseline gap-2 text-sm">
        <input type="checkbox" checked={a.stealth} onChange={(e) => onChange({ stealth: e.target.checked })} className="accent-rubric" />
        Stealth disadvantage
      </label>
    </div>
  );
}

/* How many charges, and how they come back: on a long or a short rest,
   all of them or an amount (dice from the list + a number: "1d6 + 1").
   A book item's "special" (no rest brings them back) shows as it is. */
export function ChargesEditor({ value, onChange }) {
  const ch = value;
  const rest = chargeRest(ch.reset);
  const regain = ch.regain === "" || ch.regain == null || ch.regain === "all" ? null : String(ch.regain);
  const m = regain ? REGAIN_RE.exec(regain) : null;
  const flat = regain && !m && /^\d+$/.test(regain) ? Number(regain) : null;
  const dice = m ? m[1] : null;
  const plus = m ? Number(m[2] || 0) : flat || 0;
  const amount = (d, n) => (d ? (n ? `${d} + ${n}` : d) : n ? String(n) : "");
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <input type="number" min={1} value={ch.max ?? ""} onChange={(e) => onChange({ max: e.target.value })} placeholder="7" className={`${fieldCls} !w-14`} aria-label="Charges" />
        <span className="text-xs italic text-ink-faded">charges, they come back</span>
        <Segmented size="sm" options={CHARGE_RESETS} value={rest} onChange={(r) => onChange({ reset: r })} />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs italic text-ink-faded">how many</span>
        <Segmented size="sm" options={[{ value: "all", label: "all" }, { value: "some", label: "an amount" }]} value={regain ? "some" : "all"}
                   onChange={(v) => onChange({ regain: v === "all" ? "" : "1d6 + 1" })} />
        {regain && (
          <>
            <DiceField value={dice} onChange={(d) => onChange({ regain: amount(d, plus) })} label="Regain dice" />
            <span className="text-xs text-ink-faded">+</span>
            <input type="number" min={0} value={plus || ""} placeholder="0" onChange={(e) => onChange({ regain: amount(dice, numOrNull(e.target.value) || 0) })}
                   className={`${fieldCls} !w-12`} aria-label="Regain plus" />
          </>
        )}
      </div>
    </div>
  );
}

// Numbers while it's equipped: AC +1, a save +1, Str becomes 19…
export function BonusesFields({ value, onChange, addLabel = "+ add a bonus" }) {
  const list = value || [];
  return (
    <div className="space-y-1">
      {list.map((m, i) => {
        const setM = (p) => onChange(list.map((x, j) => (j === i ? { ...x, ...p } : x)));
        return (
          <div key={i} className="flex flex-wrap items-baseline gap-3">
            <select value={m.target} onChange={(e) => setM({ target: e.target.value })} className={`${fieldCls} !w-44`} aria-label="Bonus to">
              {[...new Set([...MODIFIER_TARGETS, m.target])].map((t) => <option key={t} value={t}>{formatModifierTarget(t)}</option>)}
            </select>
            <Segmented size="sm" options={MOD_OPS} value={m.op} onChange={(op) => setM({ op })} />
            <input type="number" value={m.value ?? ""} onChange={(e) => setM({ value: numOrNull(e.target.value) })} className={`${fieldCls} !w-14`} aria-label="Amount" />
            <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove">✕</button>
          </div>
        );
      })}
      <button type="button" onClick={() => onChange([...list, { target: "ac", op: "add", value: 1 }])} className={addRowCls}>
        {addLabel}
      </button>
    </div>
  );
}

export function MagicFlags({ form, set }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-6">
        <label className="flex items-baseline gap-2 text-sm">
          <input type="checkbox" checked={form.curse} onChange={(e) => set("curse", e.target.checked)} className="accent-rubric" />
          Cursed
        </label>
        <label className="flex items-baseline gap-2 text-sm">
          <input type="checkbox" checked={form.sentient} onChange={(e) => set("sentient", e.target.checked)} className="accent-rubric" />
          Sentient
        </label>
        <label className="flex items-baseline gap-2 text-sm">
          <input type="checkbox" checked={form.focusAny} onChange={(e) => set("focusAny", e.target.checked)} className="accent-rubric" />
          Spellcasting focus for any class
        </label>
      </div>
      {!form.focusAny && (
        <FoldChips label="Spellcasting focus for" options={CLASS_IDS} selected={form.focus} onToggle={(c) => set("focus", toggleIn(form.focus, c))} />
      )}
    </div>
  );
}

/* Spells cast from it: each costs the item's charges, has its own uses
   (per long / short rest, once) or is at will; "cast at level" for a
   spell the item casts higher than its own level. `hasCharges`: the
   item has charges (a new spell then costs 1 of them). */
export function ItemSpellsFields({ value, onChange, spells, index, hasCharges = true, search = true }) {
  const list = value || [];
  return (
    <div className="space-y-2">
      {search && (
        <EntryPicker entries={spells} index={index} placeholder="search spells…" selected={[]}
                     onToggle={(id) => onChange([...list, { spell: id, how: "item", uses: hasCharges ? { resource: "charges", cost: 1 } : { max: 1, reset: "long" } }])} />
      )}
      {list.length === 0 && <p className={hintCls}>None.</p>}
      {list.map((sp, i) => {
        const mode = usesMode(sp.uses);
        const setSp = (p) => onChange(list.map((x, j) => (j === i ? { ...x, ...p } : x)));
        return (
          <div key={`${sp.spell}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="min-w-[10rem] text-sm">{nameFromId(sp.spell, index)}</span>
            {mode !== "at_will" && (
              <input type="number" min={1} value={usesNumber(sp.uses)} onChange={(e) => setSp({ uses: usesFor(mode, numOrNull(e.target.value)) })}
                     className={`${fieldCls} !w-12`} aria-label="How many" />
            )}
            <Segmented size="sm" options={hasCharges || mode === "charges" ? SPELL_USES : SPELL_USES.filter((o) => o.value !== "charges")} value={mode}
                       onChange={(m) => setSp({ uses: usesFor(m, usesNumber(sp.uses)) })} />
            <span className="text-xs italic text-ink-faded">cast at level</span>
            <input type="number" min={1} max={9} value={sp.cast_at ?? ""} placeholder="—" onChange={(e) => setSp({ cast_at: numOrNull(e.target.value) ?? undefined })}
                   className={`${fieldCls} !w-12`} aria-label="Cast at level" />
            <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove spell">✕</button>
          </div>
        );
      })}
    </div>
  );
}

export function WeightValueFields({ form, set }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
      <label className="flex items-baseline gap-1.5">
        <input type="number" min={0} step="any" value={form.weight ?? ""} onChange={(e) => set("weight", numOrNull(e.target.value))} placeholder="—"
               className={`${fieldCls} !w-16`} aria-label="Weight" />
        <span className="text-xs text-ink-faded">lb.</span>
      </label>
      <CurrencyEditor value={form.value} onChange={(v) => set("value", v)} coins={["pp", "gp", "sp", "cp"]} />
    </div>
  );
}
