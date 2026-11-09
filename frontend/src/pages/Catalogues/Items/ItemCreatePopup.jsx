import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import {
  ChipsHeading,
  CreateModal,
  addRowCls,
  boxCls,
  checkCls,
  checkLabelCls,
  chip,
  fieldCls,
  hintCls,
  labelCls,
  removeRowCls,
  textareaCls,
} from "../catalogueStyle";
import {
  ITEM_TYPES, ITEM_RARITIES, ITEM_TIERS,
  WEAPON_BASE_ITEMS, WEAPON_CATEGORIES, WEAPON_PROPERTIES, WEAPON_MASTERIES,
  RECHARGE_OPTIONS, ITEM_AGES, STANDARD_CLASSES,
  SPEED_TYPES, SPEED_MODES,
  isValidDiceNotation, itemKindFromType,
  propertyDescription, masteryDescription,
} from "./itemHelpers";
import { DAMAGE_TYPES, CONDITION_OPTIONS } from "../../../utils/Constants";


const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const DICE_OPTIONS = ["d3", "d4", "d6", "d8", "d10", "d12", "d20"];

// Default charge value state (used for both rechargeAmount and maxCharges)
const DEFAULT_CHARGE = {
  mode: "fixed",       // "fixed" | "roll"
  fixed: "",
  diceAmount: 1,
  dieType: "d6",
  mod: 0,
};

const DEFAULT_STATE = {
  name: "",
  visibility: "private",
  types: ["Other"],
  rarity: "common",
  tier: "none",
  weight: "",
  value: "",
  entries: "",

  // Attunement
  attuneMode: "none",
  attuneText: "",

  // Bonuses
  bonusAc: "",
  bonusWeapon: "",
  bonusWeaponAttack: "",
  bonusWeaponDamage: "",
  bonusSpellAttack: "",
  bonusSpellSaveDc: "",
  bonusSpellDamage: "",
  bonusProficiency: "",
  bonusSavingThrow: "",
  bonusAbilityCheck: "",

  // Speed modifications: list of { speed, mode, value }
  speedMods: [],

  // Ability score modifications
  abilities: [],

  // Defenses
  resist: [],
  immune: [],
  vulnerable: [],
  conditionImmune: [],

  // Weapon
  baseItem: "",
  weaponCategory: "",
  damageType: "",
  damageDice: "",
  damageAmount: "",
  damageMod: "",
  properties: [],
  mastery: "",
  crit_at: "",
  rangeMin: "",
  rangeMax: "",

  // Armor / Shield
  armorBaseAc: "",
  armorStrengthReq: "",
  armorStealthDisadvantage: false,
  shieldAcBonus: "",

  // Vehicle
  vehCrew: "",
  vehAc: "",
  vehHp: "",
  vehSpeed: "",
  capPassenger: "",
  capCargo: "",

  // Mount
  mountCarryingCapacity: "",
  mountSpeed: "",

  // Special
  curse: false,
  sentient: false,
  lightBright: "",
  lightDim: "",
  age: "",

  // Charges
  rechargesAt: "",
  rechargeAmount: { ...DEFAULT_CHARGE },
  maxCharges: { ...DEFAULT_CHARGE },

  // Spells & focus
  focus: [],
  attachedSpells: [],
};

const numOrNull = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Parse a charged value (legacy number OR new {fixed, roll}) into form shape.
const parseChargeValue = (val) => {
  if (val == null) return { ...DEFAULT_CHARGE };
  if (typeof val === "number") {
    return { ...DEFAULT_CHARGE, mode: "fixed", fixed: val };
  }
  if (typeof val === "object") {
    if (val.fixed != null) {
      return { ...DEFAULT_CHARGE, mode: "fixed", fixed: val.fixed };
    }
    if (val.roll) {
      return {
        mode: "roll",
        fixed: "",
        diceAmount: val.roll.dice_amount ?? 1,
        dieType: val.roll.die_type || "d6",
        mod: val.roll.mod ?? 0,
      };
    }
  }
  return { ...DEFAULT_CHARGE };
};

// Build a charged value payload object from form state.
const buildChargeValue = (charge) => {
  if (!charge) return null;
  if (charge.mode === "roll") {
    return {
      fixed: null,
      roll: {
        die_type: charge.dieType || "d6",
        dice_amount: numOrNull(charge.diceAmount) ?? 1,
        mod: numOrNull(charge.mod) ?? 0,
      },
    };
  }
  const fixed = numOrNull(charge.fixed);
  if (fixed == null) return null;
  return { fixed, roll: null };
};

// Parse an existing modifySpeed object into a flat list for the form.
const parseModifySpeed = (modifySpeed) => {
  if (!modifySpeed || typeof modifySpeed !== "object") return [];
  const out = [];
  for (const mode of ["static", "bonus", "multiply"]) {
    const block = modifySpeed[mode];
    if (!block) continue;
    for (const [speed, value] of Object.entries(block)) {
      out.push({ speed, mode, value: String(value) });
    }
  }
  return out;
};

export default function ItemCreatePopup({ open, onClose, editingItem, copyFromItem }) {
  const createItem = useCatalogueStore((s) => s.createItem);
  const updateItem = useCatalogueStore((s) => s.updateItem);
  const creating = useCatalogueStore((s) => s.creatingItem);
  const createError = useCatalogueStore((s) => s.createItemError);
  const spellsData = useCatalogueStore((s) => s.spellsData);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);

  const [form, setForm] = useState(DEFAULT_STATE);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const list = spellsData?.spells;
    if (!Array.isArray(list) || list.length === 0) loadSpells();
  }, [open, spellsData, loadSpells]);

  useEffect(() => {
    if (!open) return;
    setNameError(false);

    const source = editingItem || copyFromItem;
    if (!source) {
      setForm(DEFAULT_STATE);
      return;
    }

    const reqAttune = source.reqAttune;
    const attuneMode =
      reqAttune === true ? "any"
      : typeof reqAttune === "string" ? "restricted"
      : "none";

    setForm({
      ...DEFAULT_STATE,
      name: copyFromItem ? `${source.name} (copy)` : source.name,
      visibility: copyFromItem ? "private" : (source.visibility || "private"),
      types: Array.isArray(source.types) && source.types.length ? source.types : ["Other"],
      rarity: source.rarity || "common",
      tier: source.tier || "none",
      weight: source.weight ?? "",
      value: source.value ?? "",
      entries: Array.isArray(source.entries)
        ? source.entries.map((e) => (e?.name ? `${e.name}\n${e.text || ""}` : (e?.text || ""))).join("\n\n")
        : "",
      attuneMode,
      attuneText: attuneMode === "restricted" ? reqAttune : "",
      bonusAc: source.bonuses?.ac ?? "",
      bonusWeapon: source.bonuses?.weapon ?? "",
      bonusWeaponAttack: source.bonuses?.weaponAttack ?? "",
      bonusWeaponDamage: source.bonuses?.weaponDamage ?? "",
      bonusSpellAttack: source.bonuses?.spellAttack ?? "",
      bonusSpellSaveDc: source.bonuses?.spellSaveDc ?? "",
      bonusSpellDamage: source.bonuses?.spellDamage ?? "",
      bonusProficiency: source.bonuses?.proficiencyBonus ?? "",
      bonusSavingThrow: source.bonuses?.savingThrow ?? "",
      bonusAbilityCheck: source.bonuses?.abilityCheck ?? "",

      speedMods: parseModifySpeed(source.modifySpeed),

      abilities: source.ability
        ? [
            ...Object.entries(source.ability.set || {}).map(([k, v]) => ({ ability: k, mode: "set", value: v })),
            ...Object.entries(source.ability.increase || {}).map(([k, v]) => ({ ability: k, mode: "increase", value: v })),
          ]
        : [],

      resist: source.resist || [],
      immune: source.immune || [],
      vulnerable: source.vulnerable || [],
      conditionImmune: source.conditionImmune || [],
      baseItem: source.baseItem || "",
      weaponCategory: source.weaponCategory || "",
      damageType: source.damage?.type || "",
      damageDice: source.damage?.dice || "",
      damageAmount: source.damage?.amount ?? "",
      damageMod: source.damage?.mod ?? "",
      properties: source.properties || [],
      mastery: source.mastery || "",
      crit_at: source.crit_at ?? "",
      rangeMin: source.range?.min ?? "",
      rangeMax: source.range?.max ?? "",
      armorBaseAc: source.special?.base_ac ?? "",
      armorStrengthReq: source.special?.strength_requirement ?? "",
      armorStealthDisadvantage: !!source.special?.stealth_disadvantage,
      shieldAcBonus: source.special?.ac_bonus ?? "",
      vehCrew: source.special?.crew ?? "",
      vehAc: source.special?.vehAc ?? "",
      vehHp: source.special?.vehHp ?? "",
      vehSpeed: source.special?.vehSpeed ?? "",
      capPassenger: source.special?.capPassenger ?? "",
      capCargo: source.special?.capCargo ?? "",
      mountCarryingCapacity: source.special?.carryingCapacity ?? "",
      mountSpeed: source.special?.speed ?? "",
      curse: !!source.curse,
      sentient: !!source.sentient,
      lightBright: source.light?.bright ?? "",
      lightDim: source.light?.dim ?? "",
      age: source.age || "",
      rechargesAt: source.charged?.recharges_at || "",
      rechargeAmount: parseChargeValue(source.charged?.amount),
      maxCharges: parseChargeValue(source.charged?.max_charges),
      focus: source.focus || [],
      attachedSpells: source.attachedSpells || [],
    });
  }, [open, editingItem, copyFromItem]);

  const xphbSpellNames = useMemo(() => {
    const list = spellsData?.spells;
    if (!Array.isArray(list)) return [];
    const names = list.filter((sp) => sp?.source === "XPHB" && sp?.name).map((sp) => sp.name);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [spellsData]);

  if (!open) return null;

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const toggleListItem = (key, val) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val],
    }));

  // ─── Ability handlers ────────────────────────────────────────────
  const addAbility = () =>
    setForm((f) => ({
      ...f,
      abilities: [...f.abilities, { ability: "str", mode: "set", value: "" }],
    }));
  const updateAbility = (idx, key, val) =>
    setForm((f) => ({
      ...f,
      abilities: f.abilities.map((a, i) => (i === idx ? { ...a, [key]: val } : a)),
    }));
  const removeAbility = (idx) =>
    setForm((f) => ({
      ...f,
      abilities: f.abilities.filter((_, i) => i !== idx),
    }));

  // ─── Speed mod handlers ──────────────────────────────────────────
  const addSpeedMod = () =>
    setForm((f) => ({
      ...f,
      speedMods: [...f.speedMods, { speed: "walk", mode: "static", value: "" }],
    }));
  const updateSpeedMod = (idx, key, val) =>
    setForm((f) => ({
      ...f,
      speedMods: f.speedMods.map((m, i) => (i === idx ? { ...m, [key]: val } : m)),
    }));
  const removeSpeedMod = (idx) =>
    setForm((f) => ({
      ...f,
      speedMods: f.speedMods.filter((_, i) => i !== idx),
    }));

  // ─── Charge handlers ─────────────────────────────────────────────
  const updateCharge = (which, key, val) =>
    setForm((f) => ({ ...f, [which]: { ...f[which], [key]: val } }));

  const kind = itemKindFromType(form.types);

  const buildPayload = () => {
    const payload = {
      name: form.name.trim(),
      source: "HOMEBREW",
      visibility: form.visibility,
      types: form.types.length ? form.types : ["Other"],
      rarity: form.rarity,
      tier: form.tier === "none" ? null : form.tier,
      weight: numOrNull(form.weight),
      value: numOrNull(form.value),
      curse: form.curse || null,
      sentient: form.sentient || null,
      age: form.age || null,
    };

    if (form.entries.trim()) {
      payload.entries = [{ text: form.entries.trim() }];
    }

    if (form.attuneMode === "any") payload.reqAttune = true;
    else if (form.attuneMode === "restricted" && form.attuneText.trim()) {
      payload.reqAttune = form.attuneText.trim();
    }

    const bonuses = {};
    if (numOrNull(form.bonusAc) != null) bonuses.ac = numOrNull(form.bonusAc);
    if (numOrNull(form.bonusWeapon) != null) bonuses.weapon = numOrNull(form.bonusWeapon);
    if (numOrNull(form.bonusWeaponAttack) != null) bonuses.weaponAttack = numOrNull(form.bonusWeaponAttack);
    if (numOrNull(form.bonusWeaponDamage) != null) bonuses.weaponDamage = numOrNull(form.bonusWeaponDamage);
    if (numOrNull(form.bonusSpellAttack) != null) bonuses.spellAttack = numOrNull(form.bonusSpellAttack);
    if (numOrNull(form.bonusSpellSaveDc) != null) bonuses.spellSaveDc = numOrNull(form.bonusSpellSaveDc);
    if (numOrNull(form.bonusSpellDamage) != null) bonuses.spellDamage = numOrNull(form.bonusSpellDamage);
    if (numOrNull(form.bonusProficiency) != null) bonuses.proficiencyBonus = numOrNull(form.bonusProficiency);
    if (numOrNull(form.bonusSavingThrow) != null) bonuses.savingThrow = numOrNull(form.bonusSavingThrow);
    if (numOrNull(form.bonusAbilityCheck) != null) bonuses.abilityCheck = numOrNull(form.bonusAbilityCheck);

    if (Object.keys(bonuses).length) payload.bonuses = bonuses;

    // Speed modifications - group by mode
    const modifySpeed = {};
    for (const m of form.speedMods) {
      if (!m.speed || !m.mode || numOrNull(m.value) == null) continue;
      if (!modifySpeed[m.mode]) modifySpeed[m.mode] = {};
      modifySpeed[m.mode][m.speed] = numOrNull(m.value);
    }
    if (Object.keys(modifySpeed).length) payload.modifySpeed = modifySpeed;

    const ability = {};
    for (const a of form.abilities) {
      if (!a.ability || numOrNull(a.value) == null) continue;
      if (!ability[a.mode]) ability[a.mode] = {};
      ability[a.mode][a.ability] = numOrNull(a.value);
    }
    if (Object.keys(ability).length) payload.ability = ability;

    if (form.resist.length) payload.resist = form.resist;
    if (form.immune.length) payload.immune = form.immune;
    if (form.vulnerable.length) payload.vulnerable = form.vulnerable;
    if (form.conditionImmune.length) payload.conditionImmune = form.conditionImmune;

    if (kind === "weapon") {
      if (form.baseItem) payload.baseItem = form.baseItem;
      if (form.weaponCategory) payload.weaponCategory = form.weaponCategory;
      const damage = {};
      if (form.damageType) damage.type = form.damageType;
      if (form.damageDice) damage.dice = form.damageDice;
      if (numOrNull(form.damageAmount) != null) damage.amount = numOrNull(form.damageAmount);
      if (numOrNull(form.damageMod) != null) damage.mod = numOrNull(form.damageMod);
      if (Object.keys(damage).length) payload.damage = damage;
      if (form.properties.length) payload.properties = form.properties;
      if (form.mastery) payload.mastery = form.mastery;
      if (numOrNull(form.crit_at) != null) payload.crit_at = numOrNull(form.crit_at);
      if (numOrNull(form.rangeMin) != null || numOrNull(form.rangeMax) != null) {
        payload.range = { min: numOrNull(form.rangeMin), max: numOrNull(form.rangeMax) };
      }
    }

    const special = {};
    if (kind === "armor") {
      if (form.types.includes("Shield")) {
        if (numOrNull(form.shieldAcBonus) != null) special.ac_bonus = numOrNull(form.shieldAcBonus);
      } else {
        if (numOrNull(form.armorBaseAc) != null) special.base_ac = numOrNull(form.armorBaseAc);
        if (form.armorStrengthReq !== "") special.strength_requirement = form.armorStrengthReq;
        if (form.armorStealthDisadvantage) special.stealth_disadvantage = true;
      }
    } else if (kind === "vehicle") {
      if (numOrNull(form.vehCrew) != null) special.crew = numOrNull(form.vehCrew);
      if (numOrNull(form.vehAc) != null) special.vehAc = numOrNull(form.vehAc);
      if (numOrNull(form.vehHp) != null) special.vehHp = numOrNull(form.vehHp);
      if (numOrNull(form.vehSpeed) != null) special.vehSpeed = numOrNull(form.vehSpeed);
      if (numOrNull(form.capPassenger) != null) special.capPassenger = numOrNull(form.capPassenger);
      if (numOrNull(form.capCargo) != null) special.capCargo = numOrNull(form.capCargo);
    } else if (kind === "mount") {
      if (numOrNull(form.mountCarryingCapacity) != null) special.carryingCapacity = numOrNull(form.mountCarryingCapacity);
      if (numOrNull(form.mountSpeed) != null) special.speed = numOrNull(form.mountSpeed);
    }
    if (Object.keys(special).length) payload.special = special;

    if (numOrNull(form.lightBright) != null || numOrNull(form.lightDim) != null) {
      payload.light = {
        bright: numOrNull(form.lightBright),
        dim: numOrNull(form.lightDim),
      };
    }

    // Charged: new {fixed,roll} structure for both amount and max_charges
    if (form.rechargesAt) {
      payload.charged = {
        recharges_at: form.rechargesAt,
        amount: buildChargeValue(form.rechargeAmount),
        max_charges: buildChargeValue(form.maxCharges),
      };
    }

    if (form.focus.length) payload.focus = form.focus;
    if (form.attachedSpells.length) payload.attachedSpells = form.attachedSpells;

    return payload;
  };

  const isEditing = !!editingItem;
  const titleText = isEditing ? "Edit Item" : copyFromItem ? "Copy Item" : "Create Item";

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    try {
      const payload = buildPayload();
      if (isEditing) await updateItem(editingItem.id, payload);
      else await createItem(payload);
      setTimeout(onClose, 0);
    } catch {
      // createError set
    }
  };

  return (
    <CreateModal
      open={open}
      title={titleText}
      onClose={onClose}
      onSave={handleSubmit}
      saving={creating}
      saveLabel={isEditing ? "Save Changes" : "Save"}
      error={createError}
    >
          {/* Basics */}
          <FilterSection title="Basics" defaultOpen>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>
                  Name <span className="text-rubric">*</span>
                </label>
                <input type="text" value={form.name}
                       onChange={(e) => update("name", e.target.value)}
                       placeholder="e.g. Cloak of Restless Shadows"
                       className={`${fieldCls} ${nameError ? "!border-solid !border-bad" : ""}`} />
                {nameError && <p className="mt-1 text-xs italic text-bad">Name is required.</p>}
              </div>

              <div>
                <label className={labelCls}>
                  Types (one or more)
                </label>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {ITEM_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        const has = form.types.includes(t);
                        update("types", has ? form.types.filter((x) => x !== t) : [...form.types, t]);
                      }}
                      className={chip(form.types.includes(t))}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <label className={labelCls}>Rarity</label>
                  <select value={form.rarity} onChange={(e) => update("rarity", e.target.value)} className={fieldCls}>
                    {ITEM_RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Tier</label>
                  <select value={form.tier} onChange={(e) => update("tier", e.target.value)} className={fieldCls}>
                    {ITEM_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Weight (lb)</label>
                  <input type="number" min={0} value={form.weight}
                         onChange={(e) => update("weight", e.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label className={labelCls}>Value (cp)</label>
                  <input type="number" min={0} value={form.value}
                         onChange={(e) => update("value", e.target.value)} className={fieldCls} />
                </div>
              </div>

              <div className="flex gap-4">
                <label className={checkLabelCls}>
                  <input type="checkbox" checked={form.curse}
                         onChange={(e) => update("curse", e.target.checked)} className={checkCls} />
                  Cursed
                </label>
                <label className={checkLabelCls}>
                  <input type="checkbox" checked={form.sentient}
                         onChange={(e) => update("sentient", e.target.checked)} className={checkCls} />
                  Sentient
                </label>
              </div>

              <div>
                <label className={labelCls}>Visibility</label>
                <div className="flex gap-x-4">
                  {["private", "public"].map((v) => (
                    <button key={v} type="button" onClick={() => update("visibility", v)}
                            className={chip(form.visibility === v)}>
                      {v[0].toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <textarea value={form.entries} onChange={(e) => update("entries", e.target.value)}
                          rows={5} placeholder="Free-form description…" className={textareaCls} />
              </div>
            </div>
          </FilterSection>

          {/* Attunement */}
          <FilterSection title="Attunement">
            <div className="space-y-2">
              <div className="flex gap-x-4">
                {[["none", "None"], ["any", "Any"], ["restricted", "Restricted"]].map(([v, label]) => (
                  <button key={v} type="button" onClick={() => update("attuneMode", v)}
                          className={chip(form.attuneMode === v)}>{label}</button>
                ))}
              </div>
              {form.attuneMode === "restricted" && (
                <input type="text" value={form.attuneText}
                       onChange={(e) => update("attuneText", e.target.value)}
                       placeholder='e.g. "by a wizard" or "by a creature of evil alignment"'
                       className={fieldCls} />
              )}
            </div>
          </FilterSection>

          {/* Bonuses */}
          <FilterSection title="Bonuses">
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                {[
                  ["bonusAc", "AC"],
                  ["bonusWeapon", "Weapon (atk+dmg)"],
                  ["bonusWeaponAttack", "Weapon Attack"],
                  ["bonusWeaponDamage", "Weapon Damage"],
                  ["bonusSpellAttack", "Spell Attack"],
                  ["bonusSpellSaveDc", "Spell Save DC"],
                  ["bonusSpellDamage", "Spell Damage"],
                  ["bonusProficiency", "Proficiency"],
                  ["bonusSavingThrow", "Saving Throw"],
                  ["bonusAbilityCheck", "Ability Check"],
                ].map(([k, label]) => (
                  <div key={k}>
                    <label className={labelCls}>{label}</label>
                    <input type="number" value={form[k]} onChange={(e) => update(k, e.target.value)}
                           placeholder="0" className={fieldCls} />
                  </div>
                ))}
              </div>
            </div>
          </FilterSection>

          {/* Speed modifications */}
          <FilterSection title="Speed Modifications">
            <div className="space-y-2">
              {form.speedMods.length === 0 && (
                <p className={hintCls}>No speed modifications. Add one below.</p>
              )}
              {form.speedMods.map((m, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1.2fr_1fr_auto] gap-x-4 items-baseline">
                  <select value={m.speed}
                          onChange={(e) => updateSpeedMod(idx, "speed", e.target.value)}
                          className={fieldCls}>
                    {SPEED_TYPES.map((s) => (
                      <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                  <select value={m.mode}
                          onChange={(e) => updateSpeedMod(idx, "mode", e.target.value)}
                          className={fieldCls}>
                    {SPEED_MODES.map((sm) => (
                      <option key={sm.value} value={sm.value}>{sm.label}</option>
                    ))}
                  </select>
                  <input type="number"
                         step={m.mode === "multiply" ? 0.5 : 5}
                         value={m.value}
                         onChange={(e) => updateSpeedMod(idx, "value", e.target.value)}
                         placeholder="value" className={fieldCls} />
                  <button type="button" onClick={() => removeSpeedMod(idx)}
                          aria-label="Remove" className={removeRowCls}>
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" onClick={addSpeedMod}
                      className={addRowCls}>
                + add speed modifier
              </button>
            </div>
          </FilterSection>

          {/* Ability Scores */}
          <FilterSection title="Ability Scores">
            <div className="space-y-2">
              {form.abilities.length === 0 && (
                <p className={hintCls}>No ability modifications. Add one below.</p>
              )}
              {form.abilities.map((a, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-x-4 items-baseline">
                  <select value={a.ability}
                          onChange={(e) => updateAbility(idx, "ability", e.target.value)}
                          className={fieldCls}>
                    {ABILITIES.map((ab) => (
                      <option key={ab} value={ab}>{ab.toUpperCase()}</option>
                    ))}
                  </select>
                  <select value={a.mode}
                          onChange={(e) => updateAbility(idx, "mode", e.target.value)}
                          className={fieldCls}>
                    <option value="set">Set to</option>
                    <option value="increase">Increase by</option>
                  </select>
                  <input type="number" value={a.value}
                         onChange={(e) => updateAbility(idx, "value", e.target.value)}
                         placeholder="value" className={fieldCls} />
                  <button type="button" onClick={() => removeAbility(idx)}
                          aria-label="Remove" className={removeRowCls}>
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" onClick={addAbility}
                      className={addRowCls}>
                + add ability
              </button>
            </div>
          </FilterSection>

          {/* Defenses */}
          <FilterSection title="Defenses">
            <div className="space-y-2">
              <CollapsibleChips label="Resistances" options={DAMAGE_TYPES}
                                selected={form.resist} onToggle={(v) => toggleListItem("resist", v)} />
              <CollapsibleChips label="Immunities" options={DAMAGE_TYPES}
                                selected={form.immune} onToggle={(v) => toggleListItem("immune", v)} />
              <CollapsibleChips label="Vulnerabilities" options={DAMAGE_TYPES}
                                selected={form.vulnerable} onToggle={(v) => toggleListItem("vulnerable", v)} />
              <CollapsibleChips label="Condition Immunities" options={CONDITION_OPTIONS}
                                selected={form.conditionImmune} onToggle={(v) => toggleListItem("conditionImmune", v)} />
            </div>
          </FilterSection>

          {/* Weapon */}
          {kind === "weapon" && (
            <FilterSection title="Weapon">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <label className={labelCls}>Base Item</label>
                    <select value={form.baseItem} onChange={(e) => update("baseItem", e.target.value)} className={fieldCls}>
                      <option value="">—</option>
                      {WEAPON_BASE_ITEMS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Category</label>
                    <select value={form.weaponCategory}
                            onChange={(e) => update("weaponCategory", e.target.value)} className={fieldCls}>
                      <option value="">—</option>
                      {WEAPON_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Damage Amount</label>
                    <input type="number" min={0} value={form.damageAmount}
                           onChange={(e) => update("damageAmount", e.target.value)}
                           placeholder="e.g. 1" className={fieldCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Damage Dice</label>
                    <select value={form.damageDice} onChange={(e) => update("damageDice", e.target.value)} className={fieldCls}>
                      <option value="">—</option>
                      {DICE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Flat Modifier</label>
                    <input type="number" value={form.damageMod}
                           onChange={(e) => update("damageMod", e.target.value)}
                           placeholder="e.g. 1" className={fieldCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Damage Type</label>
                    <select value={form.damageType} onChange={(e) => update("damageType", e.target.value)} className={fieldCls}>
                      <option value="">—</option>
                      {DAMAGE_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Mastery</label>
                    <select value={form.mastery} onChange={(e) => update("mastery", e.target.value)} className={fieldCls}>
                      <option value="">—</option>
                      {WEAPON_MASTERIES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Crit at</label>
                    <input type="number" min={2} max={20} value={form.crit_at}
                           onChange={(e) => update("crit_at", e.target.value)}
                           placeholder="20" className={fieldCls} />
                  </div>
                </div>
                <CollapsibleChips
                  label="Properties"
                  options={WEAPON_PROPERTIES}
                  selected={form.properties}
                  onToggle={(v) => toggleListItem("properties", v)}
                  getTooltip={propertyDescription}
                />
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <label className={labelCls}>Range Min (ft)</label>
                    <input type="number" min={0} step={5} value={form.rangeMin}
                           onChange={(e) => update("rangeMin", e.target.value)} className={fieldCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Range Max (ft)</label>
                    <input type="number" min={0} step={5} value={form.rangeMax}
                           onChange={(e) => update("rangeMax", e.target.value)} className={fieldCls} />
                  </div>
                </div>
              </div>
            </FilterSection>
          )}

          {kind === "armor" && (
            <FilterSection title={form.types.includes("Shield") ? "Shield" : "Armor"}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {form.types.includes("Shield") ? (
                  <div>
                    <label className={labelCls}>AC Bonus</label>
                    <input type="number" min={0} value={form.shieldAcBonus}
                           onChange={(e) => update("shieldAcBonus", e.target.value)} className={fieldCls} />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className={labelCls}>Base AC</label>
                      <input type="number" min={0} value={form.armorBaseAc}
                             onChange={(e) => update("armorBaseAc", e.target.value)} className={fieldCls} />
                    </div>
                    <div>
                      <label className={labelCls}>
                        Strength Requirement
                      </label>
                      <input type="text" value={form.armorStrengthReq}
                             onChange={(e) => update("armorStrengthReq", e.target.value)}
                             placeholder="e.g. 15" className={fieldCls} />
                    </div>
                    <label className={`${checkLabelCls} col-span-2`}>
                      <input type="checkbox" checked={form.armorStealthDisadvantage}
                             onChange={(e) => update("armorStealthDisadvantage", e.target.checked)}
                             className={checkCls} />
                      Stealth Disadvantage
                    </label>
                  </>
                )}
              </div>
            </FilterSection>
          )}

          {kind === "vehicle" && (
            <FilterSection title="Vehicle">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                {[
                  ["vehCrew", "Crew"],
                  ["vehAc", "AC"],
                  ["vehHp", "HP"],
                  ["vehSpeed", "Speed (mph)"],
                  ["capPassenger", "Passengers"],
                  ["capCargo", "Cargo"],
                ].map(([k, label]) => (
                  <div key={k}>
                    <label className={labelCls}>{label}</label>
                    <input type="number" min={0} value={form[k]}
                           onChange={(e) => update(k, e.target.value)} className={fieldCls} />
                  </div>
                ))}
              </div>
            </FilterSection>
          )}

          {kind === "mount" && (
            <FilterSection title="Mount">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <label className={labelCls}>Carrying Capacity</label>
                  <input type="number" min={0} value={form.mountCarryingCapacity}
                         onChange={(e) => update("mountCarryingCapacity", e.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label className={labelCls}>Speed</label>
                  <input type="number" min={0} step={5} value={form.mountSpeed}
                         onChange={(e) => update("mountSpeed", e.target.value)} className={fieldCls} />
                </div>
              </div>
            </FilterSection>
          )}

          {/* Focus & Spells */}
          <FilterSection title="Spells & Focus">
            <div className="space-y-3">
              <CollapsibleChips label="Spellcasting Focus (classes)" options={STANDARD_CLASSES}
                                selected={form.focus} onToggle={(v) => toggleListItem("focus", v)} />
              <div>
                <label className={labelCls}>Attached Spells</label>
                <SpellPicker options={xphbSpellNames}
                             selected={form.attachedSpells}
                             onToggle={(name) => toggleListItem("attachedSpells", name)} />
              </div>
            </div>
          </FilterSection>

          {/* Other Properties */}
          <FilterSection title="Other Properties">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
              <div>
                <label className={labelCls}>Light Bright (ft)</label>
                <input type="number" min={0} step={5} value={form.lightBright}
                       onChange={(e) => update("lightBright", e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Light Dim (ft)</label>
                <input type="number" min={0} step={5} value={form.lightDim}
                       onChange={(e) => update("lightDim", e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Age</label>
                <select value={form.age} onChange={(e) => update("age", e.target.value)} className={fieldCls}>
                  <option value="">—</option>
                  {ITEM_AGES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          </FilterSection>

          {/* Charges */}
          <FilterSection title="Charges">
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Recharges at</label>
                <select value={form.rechargesAt}
                        onChange={(e) => update("rechargesAt", e.target.value)} className={fieldCls}>
                  <option value="">—</option>
                  {RECHARGE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {form.rechargesAt && (
                <div className="space-y-3">
                  <ChargeValueInput
                    title="Max Charges"
                    charge={form.maxCharges}
                    onChange={(key, val) => updateCharge("maxCharges", key, val)}
                    fieldCls={fieldCls}
                    chip={chip}
                  />
                  <ChargeValueInput
                    title="Recharge Amount"
                    charge={form.rechargeAmount}
                    onChange={(key, val) => updateCharge("rechargeAmount", key, val)}
                    fieldCls={fieldCls}
                    chip={chip}
                  />
                </div>
              )}
            </div>
          </FilterSection>
    </CreateModal>
  );
}

// ─── Charge value sub-component (fixed | roll toggle) ──────────────
function ChargeValueInput({ title, charge, onChange, fieldCls, chip }) {
  return (
    <div className={boxCls}>
      <div className="flex items-baseline justify-between">
        <div className={labelCls}>{title}</div>
        <div className="flex gap-x-3">
          {[
            ["fixed", "Fixed"],
            ["roll", "Roll"],
          ].map(([v, label]) => (
            <button key={v} type="button"
                    onClick={() => onChange("mode", v)}
                    className={chip(charge.mode === v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {charge.mode === "fixed" ? (
        <input type="number" min={0} value={charge.fixed}
               onChange={(e) => onChange("fixed", e.target.value)}
               placeholder="e.g. 3" className={fieldCls} />
      ) : (
        <div className="grid grid-cols-3 gap-x-4">
          <div>
            <label className={labelCls}>Dice Amount</label>
            <input type="number" min={1} value={charge.diceAmount}
                   onChange={(e) => onChange("diceAmount", e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Die Type</label>
            <select value={charge.dieType}
                    onChange={(e) => onChange("dieType", e.target.value)} className={fieldCls}>
              {DICE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Modifier</label>
            <input type="number" value={charge.mod}
                   onChange={(e) => onChange("mod", e.target.value)} className={fieldCls} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers (local) ──────────────────────────────────────────────
function CollapsibleChips({ label, options, selected, onToggle, renderOption, getTooltip }) {
  const [open, setOpen] = useState(false);
  const display = renderOption || ((x) => String(x));
  return (
    <div>
      <ChipsHeading open={open} onToggle={() => setOpen((o) => !o)} label={label} count={selected.length} />
      {open && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1.5 border-l border-rule/30 pl-3">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              title={getTooltip ? getTooltip(opt) : undefined}
              className={chip(selected.includes(opt))}
            >
              {display(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SpellPicker({ options, selected, onToggle }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options.filter((n) => n.toLowerCase().includes(q));
  }, [query, options]);
  return (
    <div>
      <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
             placeholder={options.length ? "Search spells…" : "Loading spells…"}
             className={`${fieldCls} mb-2`} />
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          {selected.map((name) => (
            <button key={name} type="button" onClick={() => onToggle(name)} className={chip(true)}>{name} ✕</button>
          ))}
        </div>
      )}
      <div className="flex max-h-32 flex-wrap gap-x-4 gap-y-1 overflow-y-auto pr-1">
        {filtered.map((name) => (
          <button key={name} type="button" onClick={() => onToggle(name)}
                  className={chip(selected.includes(name))}>{name}</button>
        ))}
      </div>
    </div>
  );
}