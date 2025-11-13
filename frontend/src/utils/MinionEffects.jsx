import React, { useMemo, useState, useCallback } from "react";

/* ---------- Constants ---------- */
const SAVES = ["str", "dex", "con", "int", "wis", "cha"];
const DAMAGE_TYPES = [
  "slashing","piercing","bludgeoning","fire","cold","acid",
  "lightning","thunder","poison","necrotic","radiant","psychic","force",
];
const DAMAGE_DICE_SIZES = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];
const ATTACK_TYPES = [
  { value: "melee",  label: "Melee attack" },
  { value: "ranged", label: "Ranged attack" },
  { value: "spell",  label: "Spell attack" },
];
const EFFECT_TYPES = [
  { value: "attack",          label: "Attack" },
  { value: "save",            label: "Save" },
  { value: "attack_and_save", label: "Attack + Save" },
  { value: "none",            label: "None" },
];

const CATEGORY_KEYS = [
  "traits",
  "actions",
  "bonus_actions",
  "reactions",
  "legendary_actions",
  "mythic_actions",
  "regional_effects",
];

const CATEGORY_LABELS = {
  traits: "Traits",
  actions: "Actions",
  bonus_actions: "Bonus Actions",
  reactions: "Reactions",
  legendary_actions: "Legendary Actions",
  mythic_actions: "Mythic Actions",
  regional_effects: "Regional Effects",
};

/* ---------- Utils ---------- */
const idGen = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const toIntOrNull = (v) => {
  if (v === "" || v == null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

function ensureArrays(minion) {
  const next = { ...minion };
  for (const k of CATEGORY_KEYS) {
    if (!Array.isArray(next[k])) next[k] = [];
  }
  return next;
}

function createDefaultDamage() {
  return { id: idGen(), dice_count: null, dice_size: "", mod: null, damage_type: "" };
}


function createDefaultEffect(effect_type = "none") {
  return {
    id: idGen(),
    name: "",
    effect_type,
    attack: { attack_type: "", hit_bonus: null },
    save:   { target: "", dc_bonus: null },
    range_ft: "",
    damages: [],
    notes: "",
    active: true,
    charges: { has: false, max_charges: "", current_charges: "", reset_amount: 0 },
    open: true, // UI-only
  };
}

const Chip = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900 text-slate-200 text-[11px]">
    {children}
  </span>
);

const Arrow = ({ open }) => (
  <svg
    className={`h-4 w-4 text-slate-300 transition-transform ${open ? "rotate-180" : ""}`}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
      clipRule="evenodd"
    />
  </svg>
);

const summarizeDamage = (row) => {
  const list = (row.damages || [])
    .map((d) => {
      const dicePart =
        d.dice_count && d.dice_size
          ? `${d.dice_count}${d.dice_size}`
          : d.dice_size || "";
      const modNum = Number(d.mod);
      const hasMod = Number.isFinite(modNum) && modNum !== 0;
      const modPart = hasMod ? `${modNum > 0 ? "+" : ""}${modNum}` : "";
      const base = [dicePart, modPart].filter(Boolean).join("");
      if (!base && !d.damage_type) return "";
      if (!d.damage_type) return base;
      if (!base) return d.damage_type;
      return `${base} ${d.damage_type}`;
    })
    .filter(Boolean);
  return list.join(", ");
};

/* ---------- Effect Card ---------- */
function EffectCard({ effect, onPatch, onRemove }) {
  const [fullReset, setFullReset] = useState(false);
  const charges = effect.charges || { has: false, max_charges: "", current_charges: "", reset_amount: 0 };

  const isActive = effect.active ?? true;

  const handleEffectTypeChange = (nextType) => {
    const currentRange = effect.range_ft ?? "";

    if (nextType === "none") {
      onPatch({
        effect_type: "none",
        attack: { attack_type: "", hit_bonus: null },
        save:   { target: "", dc_bonus: null },
        range_ft: currentRange,
      });
      return;
    }

    if (nextType === "attack") {
      onPatch({
        effect_type: "attack",
        attack: {
          attack_type: ATTACK_TYPES[0].value, 
          hit_bonus: toIntOrNull(effect.attack?.hit_bonus),
        },
        save:   { target: "", dc_bonus: null }, 
        range_ft: currentRange,
      });
      return;
    }

    if (nextType === "save") {
      onPatch({
        effect_type: "save",
        attack: { attack_type: "", hit_bonus: null }, 
        save: {
          target: SAVES[0], 
          dc_bonus: toIntOrNull(effect.save?.dc_bonus),
        },
        range_ft: currentRange,
      });
      return;
    }

    if (nextType === "attack_and_save") {
      onPatch({
        effect_type: "attack_and_save",
        attack: {
          attack_type: ATTACK_TYPES[0].value,
          hit_bonus: toIntOrNull(effect.attack?.hit_bonus),
        },
        save: {
          target: SAVES[0],
          dc_bonus: toIntOrNull(effect.save?.dc_bonus),
        },
        range_ft: currentRange,
      });
    }
  };

  // charges
  const setCharges = (patch) => onPatch({ charges: { ...(effect.charges || {}), ...patch } });
  const onHasCharges = (checked) => {
    if (!checked) {
      setFullReset(false);
      onPatch({ charges: { has: false, max_charges: "", current_charges: "", reset_amount: 0 } });
    } else {
      setCharges({
        has: true,
        max_charges: charges.max_charges ?? "",
        current_charges: charges.current_charges ?? "",
        reset_amount: charges.reset_amount ?? 0,
      });
    }
  };
  const onMax = (rawMax) => {
    const maxNum = Number(rawMax);
    const curRaw = charges.current_charges ?? "";
    let newCurrent = curRaw;
    if (rawMax === "") newCurrent = "";
    else if (Number.isFinite(maxNum)) {
      const curNum = Number(curRaw);
      if (Number.isFinite(curNum)) newCurrent = Math.min(curNum, maxNum).toString();
    }
    let newReset = charges.reset_amount ?? 0;
    if (fullReset) newReset = rawMax === "" || !Number.isFinite(maxNum) ? 0 : maxNum;
    setCharges({ has: true, max_charges: rawMax, current_charges: newCurrent, reset_amount: newReset });
  };
  const onCurrent = (raw) => {
    const maxStr = charges.max_charges ?? "";
    const maxNum = Number(maxStr);
    let value = raw;
    if (raw === "") value = "";
    else if (Number.isFinite(maxNum)) {
      const n = Number(raw);
      if (Number.isFinite(n)) value = Math.min(n, maxNum);
    }
    setCharges({ has: true, current_charges: value });
  };
  const onFullReset = (checked) => {
    setFullReset(checked);
    if (checked) {
      const maxStr = charges.max_charges ?? "";
      const maxNum = Number(maxStr);
      const resetVal = maxStr === "" || !Number.isFinite(maxNum) ? 0 : maxNum;
      setCharges({ has: true, reset_amount: resetVal });
    }
  };
  const onResetAmount = (raw) => {
    if (fullReset) return;
    if (raw === "") return setCharges({ has: true, reset_amount: 0 });
    const n = Number(raw);
    setCharges({ has: true, reset_amount: !Number.isFinite(n) || n < 0 ? 0 : n });
  };

  const onActiveChange = (checked) => {
    onPatch({ active: !!checked });
  };

  // damages
  const addDamage = () => onPatch({ damages: [...(effect.damages || []), createDefaultDamage()] });
  const patchDamage = (dmgId, patch) =>
    onPatch({ damages: (effect.damages || []).map((d) => (d.id === dmgId ? { ...d, ...patch } : d)) });
  const removeDamage = (dmgId) =>
    onPatch({ damages: (effect.damages || []).filter((d) => d.id !== dmgId) });

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60">
      {/* Header */}
      <button
        type="button"
        onClick={() => onPatch({ open: !effect.open })}
        className="w-full px-3 py-2 hover:bg-slate-800/60"
        aria-expanded={!!effect.open}
        title={effect.notes || ""}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Arrow open={!!effect.open} />
          <div className="flex items-center gap-2 min-w-[220px] max-w-[520px] grow">
            <input
              type="text"
              value={effect.name ?? ""}
              onChange={(e) => onPatch({ name: e.target.value })}
              placeholder='e.g. "Tail Swipe"'
              className="w-full min-w-0 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-sm text-slate-100"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <Chip>
            {EFFECT_TYPES.find(
              (k) => k.value === (effect.effect_type ?? "none")
            )?.label || "None"}
          </Chip>

          {summarizeDamage(effect) ? <Chip>{summarizeDamage(effect)}</Chip> : null}
        </div>
      </button>

      {/* Body */}
      {effect.open && (
        <div className="p-3 space-y-3 border-t border-slate-700">
          {/* Top row: type + add dmg */}
          <div className="flex flex-wrap items-end gap-3 text-xs">
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-400">Effect Type</label>
              <select
                value={effect.effect_type ?? "none"}
                onChange={(e) => handleEffectTypeChange(e.target.value)}
                className="w-40 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
              >
                {EFFECT_TYPES.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={addDamage}
              className="ml-auto px-3 py-1 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 text-xs text-slate-100"
            >
              Add damage
            </button>
          </div>

          {/* Attack-only */}
          {(effect.effect_type === "attack" || effect.effect_type === "attack_and_save") && (
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex flex-col">
                <label className="text-[10px] text-slate-400">Attack type</label>
                <select
                  value={effect.attack?.attack_type || ATTACK_TYPES[0].value}
                  onChange={(e) =>
                    onPatch({
                      attack: { ...(effect.attack || {}), attack_type: e.target.value },
                    })
                  }
                  className="w-32 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                >
                  {ATTACK_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] text-slate-400">+ Hit</label>
                <input
                  type="number"
                  step={1}
                  value={effect.attack?.hit_bonus ?? ""}
                  onChange={(e) =>
                    onPatch({
                      attack: { ...(effect.attack || {}), hit_bonus: e.target.value },
                    })
                  }
                  className="w-24 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                />
              </div>
            </div>
          )}

          {/* Range - always visible, now top-level */}
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-400">Range / Reach (ft)</label>
              <input
                type="number"
                value={effect.range_ft ?? ""}
                min={0}
                step={5}
                onChange={(e) => onPatch({ range_ft: e.target.value })}
                placeholder="5 or 30/120"
                className="w-32 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
              />
            </div>
          </div>

          {/* Save block */}
          {(effect.effect_type === "save" || effect.effect_type === "attack_and_save") && (
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex flex-col">
                <label className="text-[10px] text-slate-400">Target save</label>
                <select
                  value={
                    effect.save?.target
                      ? String(effect.save.target).toLowerCase()
                      : SAVES[0]
                  }
                  onChange={(e) =>
                    onPatch({
                      save: {
                        ...(effect.save || {}),
                        target: e.target.value.toLowerCase(),
                      },
                    })
                  }
                  className="w-24 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                >
                  {SAVES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] text-slate-400">Save DC</label>
                <input
                  type="number"
                  step={1}
                  value={effect.save?.dc_bonus ?? ""}
                  onChange={(e) =>
                    onPatch({
                      save: {
                        ...(effect.save || {}),
                        dc_bonus: toIntOrNull(e.target.value),
                      },
                    })
                  }
                  className="w-20 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                />
              </div>
            </div>
          )}

          {/* Charges + Show Effect */}
          <div className="flex flex-col gap-2 text-xs border border-slate-800 rounded-md p-2 bg-slate-900/40">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!charges.has}
                  onChange={(e) => onHasCharges(e.target.checked)}
                  className="h-3 w-3"
                />
                <span className="text-slate-200">Has charges</span>
              </label>

              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!isActive}
                  onChange={(e) => onActiveChange(e.target.checked)}
                  className="h-3 w-3"
                />
                <span className="text-slate-200">Show Effect</span>
              </label>
            </div>

            {charges.has && (
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">Max charges</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={charges.max_charges ?? ""}
                    onChange={(e) => onMax(e.target.value)}
                    className="w-24 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">Current charges</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={charges.current_charges ?? ""}
                    onChange={(e) => onCurrent(e.target.value)}
                    className="w-24 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">Reset amount</label>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={fullReset}
                        onChange={(e) => onFullReset(e.target.checked)}
                        className="h-3 w-3"
                      />
                      <span className="text-slate-200 text-[11px]">
                        Full reset (= max)
                      </span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={charges.reset_amount ?? 0}
                      onChange={(e) => onResetAmount(e.target.value)}
                      disabled={fullReset}
                      className={`w-20 px-2 py-1 rounded-md border text-xs ${
                        fullReset
                          ? "bg-slate-900 border-slate-800 text-slate-500"
                          : "bg-slate-950 border-slate-700 text-slate-100"
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Damages */}
          <div className="space-y-2 text-xs">
            {(effect.damages || []).map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-end gap-2 rounded-md border border-slate-700 bg-slate-900/60 p-2"
              >
                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">Dice count</label>
                  <input
                    type="number"
                    step={1}
                    value={d.dice_count ?? ""}
                    onChange={(e) =>
                      patchDamage(d.id, { dice_count: toIntOrNull(e.target.value) })
                    }
                    placeholder="2"
                    className="w-16 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">Die</label>
                  <select
                    value={d.dice_size ?? ""}
                    onChange={(e) =>
                      patchDamage(d.id, { dice_size: e.target.value })
                    }
                    className="w-20 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                  >
                    <option value="">Die</option>
                    {DAMAGE_DICE_SIZES.map((sz) => (
                      <option key={sz} value={sz}>
                        {sz}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">Mod</label>
                  <input
                    type="number"
                    step={1}
                    value={d.mod ?? ""}
                    onChange={(e) =>
                      patchDamage(d.id, { mod: toIntOrNull(e.target.value) })
                    }
                    placeholder="+3"
                    className="w-16 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">Damage type</label>
                  <select
                    value={d.damage_type ?? ""}
                    onChange={(e) =>
                      patchDamage(d.id, { damage_type: e.target.value })
                    }
                    className="w-32 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                  >
                    <option value="">Select</option>
                    {DAMAGE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="ml-auto">
                  <button
                    type="button"
                    onClick={() =>
                      onPatch({
                        damages: (effect.damages || []).filter(
                          (x) => x.id !== d.id
                        ),
                      })
                    }
                    className="px-2 py-1 rounded-md border border-red-700 bg-red-900/40 hover:bg-red-900/60 text-red-100 text-[11px]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="flex flex-col text-xs">
            <label className="text-[10px] text-slate-400">Notes / Description</label>
            <textarea
              value={effect.notes ?? ""}
              onChange={(e) => onPatch({ notes: e.target.value })}
              placeholder="Riders, conditions, recharge text, etc."
              className="min-h-[60px] rounded-md border border-slate-700 bg-slate-950 text-slate-100 p-2 max-w-[40rem]"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onRemove}
              className="px-3 py-1 rounded-md border border-red-700 bg-red-900/40 hover:bg-red-900/60 text-red-100 text-xs"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Category Section (no internal Add) ---------- */
function CategorySection({ title, sectionKey, items, collapsed, onToggleSection, onPatchItem, onRemoveItem }) {
  if (!items?.length) return null; // safeguard
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => onToggleSection(sectionKey)}
        className="w-full flex items-center gap-2 px-2 py-1 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800"
      >
        <Arrow open={!collapsed} />
        <span className="text-slate-200 text-sm font-semibold">{title}</span>
        <span className="ml-auto text-slate-400 text-xs">{items.length}</span>
      </button>

      {!collapsed && (
        <div className="space-y-3">
          {items.map((row) => (
            <EffectCard
              key={row.id}
              effect={row}
              onPatch={(patch) => onPatchItem(row.id, patch)}
              onRemove={() => onRemoveItem(row.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ================== MAIN ================== */
export function MinionEffects({ buttonStyle, minion, index, onFieldChange }) {
  const safeMinion = ensureArrays(minion);

  const [collapsedSection, setCollapsedSection] = useState({
    traits: false,
    actions: false,
    bonus_actions: false,
    reactions: false,
    legendary_actions: false,
    mythic_actions: false,
    regional_effects: false,
  });

  // only show non-empty categories
  const visibleCategories = useMemo(
    () =>
      CATEGORY_KEYS.filter(
        (k) => Array.isArray(safeMinion[k]) && safeMinion[k].length > 0
      ),
    [safeMinion]
  );

  const toggleSection = (key) =>
    setCollapsedSection((prev) => ({ ...prev, [key]: !prev[key] }));

  const addToCategory = (key) => {
    const arr = Array.isArray(safeMinion[key]) ? safeMinion[key] : [];
    onFieldChange(index, key, [...arr, createDefaultEffect("none")]);
    setCollapsedSection((prev) => ({ ...prev, [key]: false }));
  };

  const patchItem = (key) => (id, patch) => {
    const arr = Array.isArray(safeMinion[key]) ? safeMinion[key] : [];
    const next = arr.map((e) => (e.id === id ? { ...e, ...patch } : e));
    onFieldChange(index, key, next);
  };

  const removeItem = (key) => (id) => {
    const arr = Array.isArray(safeMinion[key]) ? safeMinion[key] : [];
    const next = arr.filter((e) => e.id !== id);
    onFieldChange(index, key, next);
  };

  return (
    <div className="space-y-4">
      {/* Top buttons are the ONLY way to add new effects */}
      <div className="px-4 py-4 flex flex-wrap gap-2">
        <button className={buttonStyle} onClick={() => addToCategory("traits")}>
          Trait
        </button>
        <button className={buttonStyle} onClick={() => addToCategory("actions")}>
          Action
        </button>
        <button
          className={buttonStyle}
          onClick={() => addToCategory("bonus_actions")}
        >
          Bonus Action
        </button>
        <button
          className={buttonStyle}
          onClick={() => addToCategory("reactions")}
        >
          Reaction
        </button>
        <button
          className={buttonStyle}
          onClick={() => addToCategory("legendary_actions")}
        >
          Legendary Action
        </button>
        <button
          className={buttonStyle}
          onClick={() => addToCategory("mythic_actions")}
        >
          Mythic Action
        </button>
        <button
          className={buttonStyle}
          onClick={() => addToCategory("regional_effects")}
        >
          Regional Effects
        </button>
      </div>

      {/* Only non-empty categories render */}
      <div className="space-y-6 px-2">
        {visibleCategories.map((key) => (
          <CategorySection
            key={key}
            title={CATEGORY_LABELS[key]}
            sectionKey={key}
            items={safeMinion[key]}
            collapsed={!!collapsedSection[key]}
            onToggleSection={toggleSection}
            onPatchItem={patchItem(key)}
            onRemoveItem={removeItem(key)}
          />
        ))}
      </div>
    </div>
  );
}

export default MinionEffects;
