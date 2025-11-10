import React, {
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";
import useCharStore from "../store/CharStore";

const ACTION_TYPES = [
  { value: "action", label: "Action" },
  { value: "bonus_action", label: "Bonus Action" },
  { value: "reaction", label: "Reaction" },
  { value: "passive", label: "Passive" },
];

const EFFECT_TYPES = [
  { value: "attack",          label: "Attack" },
  { value: "save",            label: "Save" },
  { value: "attack_and_save", label: "Attack + Save" },
  { value: "none",            label: "None" },
];

const ATTACK_TYPES = [
  { value: "melee", label: "Melee attack" },
  { value: "ranged", label: "Ranged attack" },
  { value: "spell", label: "Spell attack" },
];

const TRAIT_TYPES = [
  { value: "standard",   label: "Standard" },
  { value: "class",      label: "Class" },
  { value: "race",       label: "Race" },
  { value: "feat",       label: "Feat" },
  { value: "martial",    label: "Martial" },
  { value: "background", label: "Background" },
  { value: "spell",      label: "Spell" },
  { value: "other",      label: "Other" },
];

const SAVES = ["str", "dex", "con", "int", "wis", "cha"];

const DAMAGE_TYPES = [
  "slashing",
  "piercing",
  "bludgeoning",
  "fire",
  "cold",
  "acid",
  "lightning",
  "thunder",
  "poison",
  "necrotic",
  "radiant",
  "psychic",
  "force",
];

const DAMAGE_DICE_SIZES = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];

const idGen = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/* ---------- Helpers ---------- */

const toIntOrNull = (v) => {
  if (v === "" || v == null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

function createDefaultAction(actionType = "action") {
  return {
    id: idGen(),
    name: "",
    action_type: actionType,
    kind: "none",          // start as "none"
    trait: "standard",
    active: true,
    attack: {
      attack_type: "",
      hit_bonus: null,
      range_ft: null,      // always shown, starts null
    },
    save: {
      target: "",
      ability: "",
      dc_bonus: null,
    },
    damages: [],
    notes: "",
    charges: {
      has: false,
      max_charges: "",
      reset_amount: 0,
      current_charges: "",
    },
    linked_effect_ids: [],
  };
}

function createDefaultDamage() {
  return {
    id: idGen(),
    dice_count: null,
    dice_size: "",
    mod: null,
    damage_type: "",
  };
}

const Chip = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900 text-slate-200 text-[11px]">
    {children}
  </span>
);

/* ---------- Summary helpers ---------- */

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

/* ================== Action Row ================== */

const ActionRow = React.memo(function ActionRow({
  row,
  open,
  onToggleOpen,
  onChange,
  onRemove,
  onAddDamage,
  onChangeDamage,
  onRemoveDamage,
}) {
  const dmgSummary = summarizeDamage(row);
  const kind = row.kind || "none";

  const charges = row.charges || {
    has: false,
    max_charges: "",
    reset_amount: 0,
    current_charges: "",
  };

  const [fullReset, setFullReset] = useState(false);

  useEffect(() => {
    if (!charges.has) setFullReset(false);
  }, [charges.has]);

  const getSaveTarget = (save) => {
    const rawTarget = save?.target;
    if (rawTarget) return String(rawTarget).toLowerCase();
    const fromAbility = save?.ability
      ? String(save.ability).toLowerCase()
      : "";
    if (SAVES.includes(fromAbility)) return fromAbility;
    return ""; // no default STR anymore
  };

  const handleKindChange = (e) => {
    const nextKind = e.target.value;

    // always preserve range_ft when switching kind
    const currentRange = row.attack?.range_ft ?? "";

    if (nextKind === "none") {
      onChange({
        kind: "none",
        attack: {
          attack_type: "",
          hit_bonus: null,
          range_ft: currentRange,
        },
        save: {
          target: "",
          ability: "",
          dc_bonus: null,
        },
      });
      return;
    }

    if (nextKind === "attack") {
      onChange({
        kind: "attack",
        attack: {
          attack_type: row.attack?.attack_type ?? "",
          hit_bonus: toIntOrNull(row.attack?.hit_bonus),
          range_ft: currentRange,
        },
        save: {
          // clear all save data so it does not render in EffectsPlay
          target: "",
          ability: "",
          dc_bonus: null,
        },
      });
      return;
    }

    if (nextKind === "save") {
      onChange({
        kind: "save",
        attack: {
          // clear attack-only data
          attack_type: "",
          hit_bonus: null,
          range_ft: currentRange,
        },
        save: {
          target: getSaveTarget(row.save),
          ability: row.save?.ability ?? "",
          dc_bonus: toIntOrNull(row.save?.dc_bonus),
        },
      });
      return;
    }

    if (nextKind === "attack_and_save") {
      onChange({
        kind: "attack_and_save",
        attack: {
          attack_type: row.attack?.attack_type ?? "",
          hit_bonus: toIntOrNull(row.attack?.hit_bonus),
          range_ft: currentRange,
        },
        save: {
          target: getSaveTarget(row.save),
          ability: row.save?.ability ?? "",
          dc_bonus: toIntOrNull(row.save?.dc_bonus),
        },
      });
    }
  };

  const handleHasChargesChange = (e) => {
    const checked = e.target.checked;
    if (!checked) {
      setFullReset(false);
      onChange({
        charges: {
          has: false,
          max_charges: "",
          reset_amount: 0,
          current_charges: "",
        },
      });
      return;
    }

    onChange({
      charges: {
        has: true,
        max_charges: charges.max_charges ?? "",
        current_charges: charges.current_charges ?? "",
        reset_amount: charges.reset_amount ?? 0,
      },
    });
  };

  const handleMaxChange = (e) => {
    const rawMax = e.target.value;
    const maxNum = Number(rawMax);
    const curRaw = charges.current_charges ?? "";
    let newCurrent = curRaw;

    if (rawMax === "") {
      newCurrent = "";
    } else if (Number.isFinite(maxNum)) {
      const curNum = Number(curRaw);
      if (Number.isFinite(curNum)) {
        newCurrent = Math.min(curNum, maxNum).toString();
      }
    }

    let newReset = charges.reset_amount ?? 0;
    if (fullReset) {
      if (rawMax === "" || !Number.isFinite(maxNum)) {
        newReset = 0;
      } else {
        newReset = maxNum;
      }
    }

    onChange({
      charges: {
        has: true,
        max_charges: rawMax,
        current_charges: newCurrent,
        reset_amount: newReset,
      },
    });
  };

  const handleCurrentChange = (e) => {
    const raw = e.target.value;
    const maxStr = charges.max_charges ?? "";
    const maxNum = Number(maxStr);
    let value = raw;

    if (raw === "") {
      value = "";
    } else if (Number.isFinite(maxNum)) {
      const n = Number(raw);
      if (Number.isFinite(n)) {
        value = Math.min(n, maxNum);
      }
    }

    onChange({
      charges: {
        ...charges,
        has: true,
        current_charges: value,
      },
    });
  };

  const handleFullResetChange = (e) => {
    const checked = e.target.checked;
    setFullReset(checked);

    if (checked) {
      const maxStr = charges.max_charges ?? "";
      const maxNum = Number(maxStr);
      const resetVal =
        maxStr === "" || !Number.isFinite(maxNum) ? 0 : maxNum;
      onChange({
        charges: {
          ...charges,
          has: true,
          reset_amount: resetVal,
        },
      });
    }
  };

  const handleResetAmountChange = (e) => {
    if (fullReset) return;

    const raw = e.target.value;
    if (raw === "") {
      onChange({
        charges: {
          ...charges,
          has: true,
          reset_amount: 0,
        },
      });
      return;
    }
    const n = Number(raw);
    const value = !Number.isFinite(n) || n < 0 ? 0 : n;
    onChange({
      charges: {
        ...charges,
        has: true,
        reset_amount: value,
      },
    });
  };

  const currentSave = row.save || {};
  const currentTarget = getSaveTarget(currentSave);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60">
      {/* Header */}
      <button
        type="button"
        onClick={onToggleOpen}
        className="w-full px-3 py-2 hover:bg-slate-800/60"
        aria-expanded={open}
        title={row.notes || ""}
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Arrow */}
          <svg
            className={`h-4 w-4 text-slate-300 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>

          {/* Name */}
          <div className="flex items-center gap-2 min-w-[220px] max-w-[520px] grow">
            <input
              type="text"
              value={row.name ?? ""}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder='e.g. "Shadow Strike"'
              className="w-full min-w-0 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-sm text-slate-100"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Effect type chip */}
          <Chip>
            {EFFECT_TYPES.find((k) => k.value === kind)?.label || "None"}
          </Chip>

          {/* Trait chip */}
          <Chip>
            {(
              TRAIT_TYPES.find((t) => t.value === (row.trait || "standard")) ||
              TRAIT_TYPES[0]
            ).label}
          </Chip>

          {/* Compact summaries */}
          <div className="hidden md:flex flex-wrap items-center gap-2 px-2">
            {dmgSummary ? <Chip>{dmgSummary}</Chip> : null}
          </div>
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="p-3 space-y-3 border-t border-slate-700">
          {/* Top row: action type + effect type + trait + active + add dmg */}
          <div className="flex flex-wrap items-end gap-3 text-xs">
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-400">Action Type</label>
              <select
                value={row.action_type || "action"}
                onChange={(e) => onChange({ action_type: e.target.value })}
                className="w-32 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
              >
                {ACTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] text-slate-400">Effect Type</label>
              <select
                value={kind}
                onChange={handleKindChange}
                className="w-40 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
              >
                {EFFECT_TYPES.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] text-slate-400">Trait Type</label>
              <select
                value={row.trait || "standard"}
                onChange={(e) =>
                  onChange({
                    trait: e.target.value,
                  })
                }
                className="w-40 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
              >
                {TRAIT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Active Checkbox */}
            <div className="flex flex-col">
              <label className="flex items-center gap-2 text-[11px] text-slate-200">
                Active
              </label>
              <input
                type="checkbox"
                checked={!!row.active}
                onChange={(e) => onChange({ active: e.target.checked })}
                className="h-3 w-3"
              />
            </div>

            <button
              type="button"
              onClick={onAddDamage}
              className="ml-auto px-3 py-1 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 text-xs text-slate-100"
            >
              Add damage
            </button>
          </div>

          {/* Attack-only block: type + hit bonus */}
          {(kind === "attack" || kind === "attack_and_save") && (
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex flex-col">
                <label className="text-[10px] text-slate-400">
                  Attack type
                </label>
                <select
                  value={row.attack?.attack_type ?? ""}
                  onChange={(e) =>
                    onChange({
                      attack: {
                        ...(row.attack || {}),
                        attack_type: e.target.value,
                      },
                    })
                  }
                  className="w-32 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                >
                  <option value="">None</option>
                  {ATTACK_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] text-slate-400">Hit bonus</label>
                <input
                  type="number"
                  step={1}
                  value={row.attack?.hit_bonus ?? ""}
                  onChange={(e) =>
                    onChange({
                      attack: {
                        ...(row.attack || {}),
                        hit_bonus: e.target.value,
                      },
                    })
                  }
                  placeholder="+7"
                  className="w-24 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                />
              </div>
            </div>
          )}

          {/* Range: always visible, regardless of effect type */}
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-400">
                Range / Reach (ft)
              </label>
              <input
                type="number"
                value={row.attack?.range_ft ?? ""}
                min={0}
                step={5}
                onChange={(e) =>
                  onChange({
                    attack: {
                      ...(row.attack || {}),
                      range_ft: e.target.value,
                    },
                  })
                }
                placeholder="5 or 30/120"
                className="w-32 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
              />
            </div>
          </div>

          {/* Save block */}
          {(kind === "save" || kind === "attack_and_save") && (
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex flex-col">
                <label className="text-[10px] text-slate-400">
                  Target save
                </label>
                <select
                  value={currentTarget}
                  onChange={(e) =>
                    onChange({
                      save: {
                        ...(row.save || {}),
                        target: e.target.value.toLowerCase(),
                      },
                    })
                  }
                  className="w-24 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                >
                  <option value="">None</option>
                  {SAVES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] text-slate-400">
                  Save ability
                </label>
                <select
                  value={row.save?.ability ?? ""}
                  onChange={(e) =>
                    onChange({
                      save: {
                        ...(row.save || {}),
                        ability: e.target.value,
                      },
                    })
                  }
                  className="w-24 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                >
                  <option value="">None</option>
                  {SAVES.map((ab) => (
                    <option key={ab} value={ab}>
                      {ab}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] text-slate-400">
                  Save DC Bonus
                </label>
                <input
                  type="number"
                  step={1}
                  value={row.save?.dc_bonus ?? ""}
                  onChange={(e) =>
                    onChange({
                      save: {
                        ...(row.save || {}),
                        dc_bonus: toIntOrNull(e.target.value),
                      },
                    })
                  }
                  className="w-20 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                />
              </div>
            </div>
          )}

          {/* Charges block */}
          <div className="flex flex-col gap-2 text-xs border border-slate-800 rounded-md p-2 bg-slate-900/40">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!charges.has}
                onChange={handleHasChargesChange}
                className="h-3 w-3"
              />
              <span className="text-slate-200">Has charges</span>
            </label>

            {charges.has && (
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">
                    Max charges
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={charges.max_charges ?? ""}
                    onChange={handleMaxChange}
                    className="w-24 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">
                    Current charges
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={charges.current_charges ?? ""}
                    onChange={handleCurrentChange}
                    className="w-24 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">
                    Reset amount
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={fullReset}
                        onChange={handleFullResetChange}
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
                      onChange={handleResetAmountChange}
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

          {/* Damage parts */}
          <div className="space-y-2 text-xs">
            {(row.damages || []).map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-end gap-2 rounded-md border border-slate-700 bg-slate-900/60 p-2"
              >
                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">
                    Dice count
                  </label>
                  <input
                    type="number"
                    step={1}
                    value={d.dice_count ?? ""}
                    onChange={(e) =>
                      onChangeDamage(d.id, {
                        dice_count: toIntOrNull(e.target.value),
                      })
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
                      onChangeDamage(d.id, { dice_size: e.target.value })
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
                  <label className="text-[10px] text-slate-400">
                    Extra mod
                  </label>
                  <input
                    type="number"
                    step={1}
                    value={d.mod ?? ""}
                    onChange={(e) =>
                      onChangeDamage(d.id, {
                        mod: toIntOrNull(e.target.value),
                      })
                    }
                    placeholder="+3"
                    className="w-16 px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-100"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">
                    Damage type
                  </label>
                  <select
                    value={d.damage_type ?? ""}
                    onChange={(e) =>
                      onChangeDamage(d.id, { damage_type: e.target.value })
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
                    onClick={() => onRemoveDamage(d.id)}
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
            <label className="text-[10px] text-slate-400">
              Notes / Description
            </label>
            <textarea
              value={row.notes ?? ""}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder="Extra riders, conditions, effects"
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
});

/* ================== Category Card ================== */

const CategoryCard = React.memo(function CategoryCard({
  title,
  rows,
  openById,
  onToggleOpen,
  onChangeRow,
  onRemoveRow,
  onAddDamage,
  onChangeDamage,
  onRemoveDamage,
}) {
  if (!rows.length) return null;

  return (
    <section className="space-y-2">
      <h4 className="text-slate-300 text-sm font-semibold">{title}</h4>

      <div className="space-y-3">
        {rows.map((row) => (
          <ActionRow
            key={row.id}
            row={row}
            open={!!openById[row.id]}
            onToggleOpen={() => onToggleOpen(row.id)}
            onChange={(patch) => onChangeRow(row.id, patch)}
            onRemove={() => onRemoveRow(row.id)}
            onAddDamage={() => onAddDamage(row.id)}
            onChangeDamage={(dmgId, patch) =>
              onChangeDamage(row.id, dmgId, patch)
            }
            onRemoveDamage={(dmgId) => onRemoveDamage(row.id, dmgId)}
          />
        ))}
      </div>
    </section>
  );
});

/* ================== MAIN ================== */

export default function Effects() {
  const charData = useCharStore((s) => s.charData);
  const updateCharField = useCharStore((s) => s.updateCharField);
  const postCharData = useCharStore((s) => s.postCharData);

  if (!charData) return null;

  const actions = useMemo(() => {
    const src = charData.effects;
    return Array.isArray(src) ? src : [];
  }, [charData?.effects]);

  const [openById, setOpenById] = useState({});
  const toggleOpen = useCallback((id) => {
    setOpenById((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const debounceRef = useRef(null);
  const debouncedPost = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => postCharData(), 400);
  }, [postCharData]);

  const persist = useCallback(
    (next, { immediate = false } = {}) => {
      updateCharField("effects", next);
      if (immediate) postCharData();
      else debouncedPost();
    },
    [updateCharField, postCharData, debouncedPost]
  );

  const addEffect = useCallback(() => {
    const row = createDefaultAction("action");
    const next = [...actions, row];
    persist(next, { immediate: true });
    setOpenById((prev) => ({ ...prev, [row.id]: true }));
  }, [actions, persist]);

  const removeRow = useCallback(
    (id) => {
      const next = actions.filter((a) => a.id !== id);
      persist(next, { immediate: true });
      setOpenById((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    },
    [actions, persist]
  );

  const changeRow = useCallback(
    (id, patch) => {
      const next = actions.map((a) =>
        a.id === id ? { ...a, ...patch } : a
      );
      persist(next);
    },
    [actions, persist]
  );

  const addDamageToRow = useCallback(
    (id) => {
      const next = actions.map((a) =>
        a.id === id
          ? { ...a, damages: [...(a.damages || []), createDefaultDamage()] }
          : a
      );
      persist(next, { immediate: true });
    },
    [actions, persist]
  );

  const changeDamage = useCallback(
    (id, dmgId, patch) => {
      const next = actions.map((a) =>
        a.id === id
          ? {
              ...a,
              damages: (a.damages || []).map((d) =>
                d.id === dmgId ? { ...d, ...patch } : d
              ),
            }
          : a
      );
      persist(next);
    },
    [actions, persist]
  );

  const removeDamageFromRow = useCallback(
    (id, dmgId) => {
      const next = actions.map((a) =>
        a.id === id
          ? {
              ...a,
              damages: (a.damages || []).filter((d) => d.id !== dmgId),
            }
          : a
      );
      persist(next, { immediate: true });
    },
    [actions, persist]
  );

  const collapseAll = useCallback(() => {
    setOpenById((_) => {
      const next = {};
      for (const a of actions) next[a.id] = false;
      return next;
    });
  }, [actions]);

  const grouped = useMemo(
    () => ({
      actions: actions.filter((a) => (a.action_type || "action") === "action"),
      bonus_actions: actions.filter((a) => a.action_type === "bonus_action"),
      reactions: actions.filter((a) => a.action_type === "reaction"),
      passives: actions.filter((a) => a.action_type === "passive"),
    }),
    [actions]
  );

  return (
    <div className="w-full space-y-4">
      {/* Global controls */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addEffect}
          className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-100"
        >
          Add effect
        </button>
        <button
          type="button"
          onClick={collapseAll}
          className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-100"
        >
          Collapse all
        </button>
      </div>

      <CategoryCard
        title="Actions"
        rows={grouped.actions}
        openById={openById}
        onToggleOpen={toggleOpen}
        onChangeRow={changeRow}
        onRemoveRow={removeRow}
        onAddDamage={addDamageToRow}
        onChangeDamage={changeDamage}
        onRemoveDamage={removeDamageFromRow}
      />
      <CategoryCard
        title="Bonus Actions"
        rows={grouped.bonus_actions}
        openById={openById}
        onToggleOpen={toggleOpen}
        onChangeRow={changeRow}
        onRemoveRow={removeRow}
        onAddDamage={addDamageToRow}
        onChangeDamage={changeDamage}
        onRemoveDamage={removeDamageFromRow}
      />
      <CategoryCard
        title="Reactions"
        rows={grouped.reactions}
        openById={openById}
        onToggleOpen={toggleOpen}
        onChangeRow={changeRow}
        onRemoveRow={removeRow}
        onAddDamage={addDamageToRow}
        onChangeDamage={changeDamage}
        onRemoveDamage={removeDamageFromRow}
      />
      <CategoryCard
        title="Passives"
        rows={grouped.passives}
        openById={openById}
        onToggleOpen={toggleOpen}
        onChangeRow={changeRow}
        onRemoveRow={removeRow}
        onAddDamage={addDamageToRow}
        onChangeDamage={changeDamage}
        onRemoveDamage={removeDamageFromRow}
      />
    </div>
  );
}
