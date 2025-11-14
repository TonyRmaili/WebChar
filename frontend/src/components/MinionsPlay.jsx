import React, { useState, useRef, useCallback, useMemo } from "react";
import useMonsterStore from "../store/MonsterStore";
import useCharStore from "../store/CharStore";
import MinionPopup from "../utils/MinionPopup";

export function MinionsPlay() {
  const minionsData = useMonsterStore((s) => s.minionsData);
  const updateMinion = useMonsterStore((s) => s.updateMinion);
  const fetchMinions = useMonsterStore((s) => s.fetchMinions);
  const charData = useCharStore((s) => s.charData);

  const toInt = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  };

  const [amount, setAmount] = useState("");

  // Any unit selected in any minion?
  const hasSelection = useMemo(
    () =>
      Array.isArray(minionsData) &&
      minionsData.some(
        (m) => Array.isArray(m.units) && m.units.some((u) => u.selected)
      ),
    [minionsData]
  );

  const getKey = (item, index) => item.id ?? index;

  // Toggle selection for a single unit on a specific minion
  const toggleUnitSelection = async (item, unitIndex) => {
    if (!charData?.name) return;

    const units = Array.isArray(item.units) ? [...item.units] : [];
    if (!units[unitIndex]) return;

    const updatedUnits = units.map((u, idx) =>
      idx === unitIndex ? { ...u, selected: !u.selected } : u
    );

    const updatedItem = { ...item, units: updatedUnits };
    await updateMinion(updatedItem, charData.name);
    await fetchMinions(charData.name);
  };

  // Select all units of all minions
  const selectAll = async () => {
    if (!charData?.name || !Array.isArray(minionsData)) return;

    const updates = minionsData
      .filter((m) => Array.isArray(m.units) && m.units.length > 0)
      .map((m) => ({
        ...m,
        units: m.units.map((u) => ({ ...u, selected: true })),
      }));

    if (updates.length === 0) return;

    await Promise.all(updates.map((m) => updateMinion(m, charData.name)));
    await fetchMinions(charData.name);
  };

  // Clear selection of all units in all minions
  const clearAll = async () => {
    if (!charData?.name || !Array.isArray(minionsData)) return;

    const updates = minionsData
      .filter((m) => Array.isArray(m.units) && m.units.length > 0)
      .map((m) => ({
        ...m,
        units: m.units.map((u) => ({ ...u, selected: false })),
      }));

    if (updates.length === 0) return;

    await Promise.all(updates.map((m) => updateMinion(m, charData.name)));
    await fetchMinions(charData.name);
  };

  const applyChange = async (mode) => {
    const n = Number(amount) || 0;
    if (!n || !Array.isArray(minionsData) || !charData?.name) return;

    const delta = mode === "damage" ? -n : n;
    const updates = [];

    minionsData.forEach((item) => {
      const units = Array.isArray(item.units) ? item.units : [];
      if (units.length === 0) return;

      let changed = false;

      const newUnits = units.map((u) => {
        if (!u.selected) return u;

        let nextHp = toInt(u.current_hp ?? 0) + delta;
        if (nextHp < 0) nextHp = 0;
        if (nextHp > item.max_hp) nextHp = item.max_hp;

        if (nextHp !== u.current_hp) {
          changed = true;
          return { ...u, current_hp: nextHp };
        }
        return u;
      });

      if (changed) {
        const updated = { ...item, units: newUnits };
        updates.push(updated);
      }
    });

    if (updates.length > 0) {
      await Promise.all(updates.map((m) => updateMinion(m, charData.name)));
      await fetchMinions(charData.name);
    }

    setAmount("");
  };

  const [openItems, setOpenItems] = useState([]);

  const open = (index) => {
    const popupId = crypto.randomUUID();
    setOpenItems((prev) => [...prev, { popupId, index }]);
  };

  const close = (popupId) => {
    setOpenItems((prev) => prev.filter((p) => p.popupId !== popupId));
  };

  // Turn damages array into "1d8 bludgeoning, 2d6+3 fire" etc.
  function summarizeDamage(damages) {
    if (!damages || damages.length === 0) return "";

    return damages
      .map((d) => {
        const parts = [];

        if (d.dice_count && d.dice_size) {
          parts.push(`${d.dice_count}${d.dice_size}`);
        } else if (d.dice_size) {
          parts.push(d.dice_size);
        }

        const modNum = d.mod != null ? Number(d.mod) : null;
        if (Number.isFinite(modNum) && modNum !== 0) {
          parts.push(`${modNum > 0 ? "+" : ""}${modNum}`);
        }

        const base = parts.join("");
        if (!base && !d.damage_type) return "";
        if (!d.damage_type) return base;
        if (!base) return d.damage_type;
        return `${base} ${d.damage_type}`;
      })
      .filter(Boolean)
      .join(", ");
  }

  function formatAttack(effect) {
    const atk = effect.attack || {};
    if (!atk.attack_type || atk.hit_bonus == null) return "";

    const typeLabel =
      atk.attack_type === "melee"
        ? "Melee"
        : atk.attack_type === "ranged"
        ? "Ranged"
        : atk.attack_type;

    const bonus = Number(atk.hit_bonus);
    const bonusText = Number.isFinite(bonus)
      ? bonus >= 0
        ? `+${bonus}`
        : `${bonus}`
      : "?";

    const range = effect.range_ft ? `, range ${effect.range_ft} ft` : "";

    return `${typeLabel} atk ${bonusText}${range}`;
  }

  function formatSave(effect) {
    const save = effect.save || {};
    if (!save.target) return "";
    const dc = save.dc_bonus;
    const ability = String(save.target).toUpperCase();
    if (dc == null) {
      return `${ability}`;
    }
    return `${ability} DC ${dc}`;
  }

  function EffectRow({ effect, onSpendCharge }) {
    const attackText = formatAttack(effect);
    const saveText = formatSave(effect);
    const damageText = summarizeDamage(effect.damages);

    const hasCharges = effect.charges?.has;
    const maxCh = toInt(effect.charges?.max_charges);
    const curCh = toInt(effect.charges?.current_charges);
    const canSpend =
      hasCharges && curCh > 0 && typeof onSpendCharge === "function";

    const handleClick = () => {
      if (!canSpend) return;
      onSpendCharge(effect);
    };

    const baseClasses =
      "w-full text-left border border-slate-700 rounded-md bg-slate-900/70 px-2 py-1.5 text-xs space-y-0.5 transition-colors";

    const clickableClasses = hasCharges
      ? canSpend
        ? "cursor-pointer hover:border-amber-400 hover:bg-slate-900"
        : "opacity-50 cursor-not-allowed"
      : "";

    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={!canSpend}
        className={`${baseClasses} ${clickableClasses}`}
      >
        {/* Title row */}
        <div className="flex justify-between items-center">
          <span className="text-amber-300 font-medium">
            {effect.name || "Unnamed effect"}
          </span>
          {effect.range_ft && (
            <span className="text-[10px] text-slate-400">
              Range {effect.range_ft} ft
            </span>
          )}
        </div>

        {/* Attack / Save / Damage line */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-200">
          {attackText && <span>{attackText}</span>}
          {saveText && <span>{saveText}</span>}
          {damageText && (
            <span className="text-rose-300">{damageText}</span>
          )}
        </div>

        {/* Charges */}
        {hasCharges && (
          <div className="text-[10px] text-slate-400">
            Charges:{" "}
            <span className="text-amber-400">
              {curCh}/{maxCh}
            </span>{" "}
            {curCh <= 0 && "(depleted)"}
          </div>
        )}
      </button>
    );
  }

  function EffectCategory({ label, effects, onSpendCharge }) {
    const activeEffects = (effects || []).filter((e) => e.active);

    if (!activeEffects.length) return null;

    return (
      <div className="mt-2">
        {/* Label + thin line */}
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-grow border-t border-slate-700" />
          <span className="text-[11px] uppercase tracking-wide text-slate-400">
            {label}
          </span>
          <div className="flex-grow border-t border-slate-700" />
        </div>

        <div className="flex flex-col gap-1">
          {activeEffects.map((effect) => (
            <EffectRow
              key={effect.id || effect.name}
              effect={effect}
              onSpendCharge={onSpendCharge}
            />
          ))}
        </div>
      </div>
    );
  }

  function MinionEffectsBlock({ item, onUpdate }) {
    const spendChargeInCategory = (categoryKey, effectId) => {
      const list = item[categoryKey] || [];
      const updatedList = list.map((e) => {
        if (e.id !== effectId) return e;

        const has = e.charges?.has;
        if (!has) return e;

        const cur = toInt(e.charges?.current_charges);
        if (cur <= 0) return e;

        const nextCur = Math.max(0, cur - 1);

        return {
          ...e,
          charges: {
            ...e.charges,
            current_charges: nextCur,
          },
        };
      });

      const updatedItem = { ...item, [categoryKey]: updatedList };
      onUpdate(updatedItem);
    };

    return (
      <div className="mt-3 text-xs">
        <EffectCategory
          label="Traits"
          effects={item.traits}
          onSpendCharge={(effect) =>
            spendChargeInCategory("traits", effect.id)
          }
        />
        <EffectCategory
          label="Actions"
          effects={item.actions}
          onSpendCharge={(effect) =>
            spendChargeInCategory("actions", effect.id)
          }
        />
        <EffectCategory
          label="Bonus Actions"
          effects={item.bonus_actions}
          onSpendCharge={(effect) =>
            spendChargeInCategory("bonus_actions", effect.id)
          }
        />
        <EffectCategory
          label="Reactions"
          effects={item.reactions}
          onSpendCharge={(effect) =>
            spendChargeInCategory("reactions", effect.id)
          }
        />
        <EffectCategory
          label="Legendary Actions"
          effects={item.legendary_actions}
          onSpendCharge={(effect) =>
            spendChargeInCategory("legendary_actions", effect.id)
          }
        />
        <EffectCategory
          label="Mythic Actions"
          effects={item.mythic_actions}
          onSpendCharge={(effect) =>
            spendChargeInCategory("mythic_actions", effect.id)
          }
        />
        <EffectCategory
          label="Regional Effects"
          effects={item.regional_effects}
          onSpendCharge={(effect) =>
            spendChargeInCategory("regional_effects", effect.id)
          }
        />
      </div>
    );
  }

  if (!minionsData || minionsData.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* ONE global Damage/Heal bar */}
      <GlobalHpControls
        amount={amount}
        setAmount={setAmount}
        hasSelection={hasSelection}
        onDamage={() => applyChange("damage")}
        onHeal={() => applyChange("heal")}
        onSelectAll={selectAll}
        onClearAll={clearAll}
      />

      {/* Minions grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {minionsData.map((item, index) => {
          const key = getKey(item, index);

          return (
            <div
              key={key}
              className="border border-slate-600 bg-slate-900 text-slate-100 px-2 py-2 rounded"
            >
              <button
                onClick={() => open(index)}
                className="w-full text-left hover:bg-slate-800 rounded px-1 py-1"
              >
                <div className="flex flex-col">
                  <div className="flex justify-center gap-1">
                    <p>{item.amount}x</p>
                    <p className="text-amber-400 font-medium">{item.name}</p>
                  </div>
                  <div className="flex justify-center gap-3 text-sm text-amber-700">
                    <p>
                      HP:{" "}
                      <span className="text-amber-400">
                        {item.max_hp}
                      </span>
                    </p>
                    <p>
                      AC:{" "}
                      <span className="text-amber-400">
                        {item.ac}
                      </span>
                    </p>
                    <p>
                      PP:{" "}
                      <span className="text-amber-400">
                        {item.skills?.includes("perception")
                          ? toInt(item.ability_scores?.wis?.score) +
                            toInt(item.pb?.total ?? item.pb ?? 0)
                          : toInt(item.ability_scores?.wis?.score)}
                      </span>
                    </p>

                    <p className="text-amber-400">{item.size}</p>
                  </div>
                </div>
              </button>

              {/* Units: HP + per-unit checkbox, driven by unit.selected */}
              <div className="mt-2 grid grid-cols-3 gap-1">
                {item.units?.map((unit, unitIndex) => {
                  const checked = !!unit.selected;
                  const hp = unit.current_hp ?? 0;

                  return (
                    <label
                      key={unit.id || unitIndex}
                      className="flex items-center gap-1 text-xs text-slate-300"
                    >
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={checked}
                        onChange={() =>
                          toggleUnitSelection(item, unitIndex)
                        }
                      />
                      <span>
                        HP {unitIndex + 1}:{" "}
                        <span className="text-amber-400">{hp}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <MinionEffectsBlock
                item={item}
                onUpdate={async (updatedItem) => {
                  if (!charData?.name) return;
                  await updateMinion(updatedItem, charData.name);
                  await fetchMinions(charData.name);
                }}
              />
            </div>
          );
        })}
      </div>

      {openItems.map(({ popupId, index }) => {
        const item = minionsData[index];
        if (!item) return null;

        return (
          <DraggableMinionPopup
            key={popupId}
            item={item}
            onClose={() => close(popupId)}
          />
        );
      })}
    </div>
  );
}

/* ------------ Draggable wrapper ------------- */

function DraggableMinionPopup({ item, onClose }) {
  const [position, setPosition] = useState({ x: 200, y: 120 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e) => {
      dragging.current = true;
      offset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [position.x, position.y]
  );

  const handleMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    setPosition({
      x: e.clientX - offset.current.x,
      y: e.clientY - offset.current.y,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  return (
    <div
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 50,
      }}
      className="w-[520px] max-w-[95vw] max-h-[900vh] overflow-auto rounded-lg border border-slate-700 bg-slate-950 shadow-xl"
    >
      <MinionPopup item={item} onClose={onClose} onDragStart={handleMouseDown} />
    </div>
  );
}

function GlobalHpControls({
  amount,
  setAmount,
  hasSelection,
  onDamage,
  onHeal,
  onSelectAll,
  onClearAll,
}) {
  return (
    <div className="flex flex-wrap items-end gap-2 mb-3 p-2 border border-slate-700 bg-slate-900/80 rounded">
      <div className="flex flex-col">
        <label className="text-xs text-slate-400 mb-0.5">Minions</label>
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="amount"
          className="w-24 border border-slate-600 bg-slate-800 text-slate-100 px-2 py-1 rounded text-xs"
        />
      </div>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={onDamage}
          disabled={!hasSelection}
          className="px-2 py-1 rounded border border-red-700 bg-red-900/60 hover:bg-red-900 text-[11px] disabled:opacity-40"
        >
          Damage
        </button>
        <button
          type="button"
          onClick={onHeal}
          disabled={!hasSelection}
          className="px-2 py-1 rounded border border-emerald-700 bg-emerald-900/60 hover:bg-emerald-900 text-[11px] disabled:opacity-40"
        >
          Heal
        </button>
      </div>

      <div className="flex gap-1 ml-auto">
        <button
          type="button"
          onClick={onSelectAll}
          className="px-2 py-1 rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 text-[11px]"
        >
          Select All
        </button>
        <button
          type="button"
          onClick={onClearAll}
          className="px-2 py-1 rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 text-[11px]"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
