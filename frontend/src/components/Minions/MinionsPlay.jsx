import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import useMonsterStore from "../../store/MonsterStore";
import useCharStore from "../../store/CharStore";
import MinionPopup from "./MinionPopup";
import MinionDiceTower from "./MinionDiceTower";

import { toInt2 } from "../../utils/HelperFunctions";
import { CATEGORY_KEYS, CATEGORY_LABELS } from "../../utils/Constants";

/* ---------- DiceTower popup ---------- */

function DiceTowerPopup({ component, onClose }) {
  const [position, setPosition] = useState({ x: 200, y: 120 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

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
    [position.x, position.y, handleMouseMove, handleMouseUp]
  );

  return (
    <div
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 200,
      }}
      className="w-[600px] max-w-[120vw] max-h-[90vh] overflow-auto rounded-lg border border-slate-700 bg-slate-950 shadow-xl"
    >
      <div
        className="flex items-center justify-between px-3 py-1 border-b border-slate-700 bg-slate-900 cursor-move"
        onMouseDown={handleMouseDown}
      >
        <span className="text-xs text-slate-300">DiceTower</span>

        <button
          className="text-xs px-2 py-0.5 rounded border border-slate-600 hover:bg-slate-800 text-slate-200"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div>{component}</div>
    </div>
  );
}

/* ---------- Minion popup ---------- */

function MinionCard({ item, onClose }) {
  const [position, setPosition] = useState({ x: 200, y: 120 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

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
    [position.x, position.y, handleMouseMove, handleMouseUp]
  );

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

/* ---------- Damage formatting helpers (attack/save/neutral) ---------- */

function summarizeDamageList(damages) {
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

// effect-aware summarizer: combines neutral + attack + save damages
function summarizeEffectDamage(effect) {
  const all = [
    ...(effect.damages || []),
    ...(effect.attack?.damages || []),
    ...(effect.save?.damages || []),
  ];
  return summarizeDamageList(all);
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

  return `${typeLabel} atk ${bonusText}`;
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

/* ---------- Effect UI rows ---------- */

function EffectRow({ effect, units, onSpendUnitCharge }) {
  const attackText = formatAttack(effect);
  const saveText = formatSave(effect);
  const damageText = summarizeEffectDamage(effect);

  const hasCharges = effect.charges?.has;
  const maxCh = toInt2(effect.charges?.max_charges);
  const curCh = toInt2(effect.charges?.current_charges);

  const baseClasses =
    "w-full border border-slate-700 rounded-md bg-slate-900/70 px-2 py-1.5 text-xs space-y-1";

  return (
    <div className={baseClasses}>
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

      {/* Per-unit charge buttons */}
      {hasCharges && Array.isArray(units) && units.length > 0 && (
        <div className="grid grid-cols-3 gap-1">
          {units.map((u, idx) => {
            const unitCharges = (u.charged_effects || []).find(
              (ce) => ce.effect_id === effect.id
            );
            if (!unitCharges) return null;

            const disabled = unitCharges.current_charges <= 0;

            return (
              <button
                key={u.id || idx}
                type="button"
                className="text-[9px] border border-slate-600 bg-slate-800 rounded px-1 py-0.5 truncate disabled:opacity-40"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!disabled && typeof onSpendUnitCharge === "function") {
                    onSpendUnitCharge(effect.id, idx);
                  }
                }}
              >
                U{idx + 1}: {unitCharges.current_charges}/
                {unitCharges.max_charges}
              </button>
            );
          })}
        </div>
      )}

      {/* Attack / Save / Damage line */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-200">
        {attackText && <span>{attackText}</span>}
        {saveText && <span>{saveText}</span>}
        {damageText && <span className="text-rose-300">{damageText}</span>}
      </div>

      {/* Base charges summary */}
      {hasCharges && (
        <div className="text-[10px] text-slate-400">
          Base charges:{" "}
          <span className="text-amber-400">
            {curCh}/{maxCh}
          </span>
        </div>
      )}
    </div>
  );
}

function EffectCategory({ label, effects, units, onSpendUnitCharge }) {
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
            units={units}
            onSpendUnitCharge={onSpendUnitCharge}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Effects block for a minion (uses item.effects) ---------- */

function MinionEffectsBlock({ item, onUpdate }) {
  // Build effects object dynamically from CATEGORY_KEYS with fallback to old top-level arrays
  const effects = useMemo(() => {
    const e = item.effects || {};
    const result = {};
    CATEGORY_KEYS.forEach((key) => {
      result[key] = e[key] || item[key] || [];
    });
    return result;
  }, [item]);

  const collectChargedEffects = useCallback(
    (minion) => {
      const out = [];
      const e = minion.effects || {};

      CATEGORY_KEYS.forEach((key) => {
        const arr = e[key] || minion[key] || [];
        (arr || []).forEach((eff) => {
          if (eff?.charges?.has) {
            out.push({
              effect_id: eff.id,
              name: eff.name,
              max: toInt2(eff.charges.max_charges),
            });
          }
        });
      });

      return out;
    },
    []
  );

  // Initialize charged_effects per unit
  useEffect(() => {
    const chargedEffects = collectChargedEffects(item);
    if (!chargedEffects.length || !Array.isArray(item.units)) return;

    let changed = false;

    const newUnits = item.units.map((u) => {
      const existing = Array.isArray(u.charged_effects)
        ? [...u.charged_effects]
        : [];

      const existingIds = new Set(existing.map((ce) => ce.effect_id));
      const additions = [];

      chargedEffects.forEach((ce) => {
        if (ce.max <= 0) return;
        if (!existingIds.has(ce.effect_id)) {
          changed = true;
          additions.push({
            effect_id: ce.effect_id,
            name: ce.name,
            max_charges: ce.max,
            current_charges: ce.max,
          });
        }
      });

      if (!additions.length) return u;
      return {
        ...u,
        charged_effects: [...existing, ...additions],
      };
    });

    if (changed) {
      const updatedItem = { ...item, units: newUnits };
      onUpdate(updatedItem);
    }
  }, [item, collectChargedEffects, onUpdate]);

  // Per-unit charge spend
  const spendUnitCharge = (effectId, unitIndex) => {
    if (!Array.isArray(item.units)) return;

    let srcEffect = null;

    // Look through all categories in effects (with fallback to old top-level arrays)
    for (const key of CATEGORY_KEYS) {
      const arr =
        (item.effects && item.effects[key]) ||
        item[key] ||
        [];
      const found = arr.find((eff) => eff.id === effectId);
      if (found) {
        srcEffect = found;
        break;
      }
    }

    if (!srcEffect || !srcEffect.charges?.has) return;

    const maxCh = toInt2(srcEffect.charges.max_charges);

    const newUnits = item.units.map((u, idx) => {
      if (idx !== unitIndex) return u;

      const existing = Array.isArray(u.charged_effects)
        ? [...u.charged_effects]
        : [];

      const idxCe = existing.findIndex((ce) => ce.effect_id === effectId);

      // If missing for some reason, initialize and spend 1
      if (idxCe === -1) {
        if (maxCh <= 0) return u;
        return {
          ...u,
          charged_effects: [
            ...existing,
            {
              effect_id: effectId,
              name: srcEffect.name,
              max_charges: maxCh,
              current_charges: Math.max(0, maxCh - 1),
            },
          ],
        };
      }

      const ce = existing[idxCe];
      if (ce.current_charges <= 0) return u;

      const updatedCe = {
        ...ce,
        current_charges: ce.current_charges - 1,
      };
      const nextCharged = [...existing];
      nextCharged[idxCe] = updatedCe;

      return {
        ...u,
        charged_effects: nextCharged,
      };
    });

    const updatedItem = { ...item, units: newUnits };
    onUpdate(updatedItem);
  };

  return (
    <div className="mt-3 text-xs">
      {CATEGORY_KEYS.map((key) => (
        <EffectCategory
          key={key}
          label={CATEGORY_LABELS[key] || key}
          effects={effects[key]}
          units={item.units}
          onSpendUnitCharge={spendUnitCharge}
        />
      ))}
    </div>
  );
}

/* ---------- Global HP controls ---------- */

function GlobalHpControls({
  amount,
  setAmount,
  hasSelection,
  onDamage,
  onHeal,
  onSelectAll,
  onClearAll,
  setDiceOpen,
}) {
  return (
    <div className="flex gap-4 items-start">
      <input
        type="number"
        min={0}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="amount"
        className="border border-slate-600 bg-slate-800 text-slate-100 rounded text-sm w-16 h-12"
      />

      <div className="flex flex-col gap-2">
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

      <div className="flex flex-col gap-2">
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

      <button
        onClick={() => setDiceOpen(true)}
        className="px-2 py-1 rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 text-[11px]"
      >
        Dice Tower
      </button>
    </div>
  );
}

/* ---------- Main component ---------- */

export function MinionsPlay() {
  const minionsData = useMonsterStore((s) => s.minionsData);
  const updateMinion = useMonsterStore((s) => s.updateMinion);
  const fetchMinions = useMonsterStore((s) => s.fetchMinions);
  const charData = useCharStore((s) => s.charData);

  const [diceOpen, setDiceOpen] = useState(false);
  const [openItems, setOpenItems] = useState([]);
  const [amount, setAmount] = useState("");

  const getKey = (item, index) => item.id ?? index;

  const open = (index) => {
    const popupId = crypto.randomUUID();
    setOpenItems((prev) => [...prev, { popupId, index }]);
  };

  const close = (popupId) => {
    setOpenItems((prev) => prev.filter((p) => p.popupId !== popupId));
  };

  const hasSelection = useMemo(
    () =>
      Array.isArray(minionsData) &&
      minionsData.some(
        (m) => Array.isArray(m.units) && m.units.some((u) => u.selected)
      ),
    [minionsData]
  );

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

        let nextHp = toInt2(u.current_hp ?? 0) + delta;
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

  if (!minionsData || minionsData.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Global HP / selection controls at top */}
      <GlobalHpControls
        amount={amount}
        setAmount={setAmount}
        hasSelection={hasSelection}
        onDamage={() => applyChange("damage")}
        onHeal={() => applyChange("heal")}
        onSelectAll={selectAll}
        onClearAll={clearAll}
        setDiceOpen={setDiceOpen}
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
                      MAX-HP:{" "}
                      <span className="text-amber-400">{item.max_hp}</span>
                    </p>
                    <p>
                      AC: <span className="text-amber-400">{item.ac}</span>
                    </p>
                    <p>
                      PP:{" "}
                      <span className="text-amber-400">
                        {item.skills?.includes("perception")
                          ? toInt2(item.ability_scores?.wis?.score) +
                            toInt2(item.pb?.total ?? item.pb ?? 0)
                          : toInt2(item.ability_scores?.wis?.score)}
                      </span>
                    </p>

                    <p className="text-amber-400">{item.size}</p>
                  </div>
                </div>
              </button>

              {/* Per-unit selection toggles + label */}
              <div className="flex flex-col mt-2">
                <label className="text-sm text-amber-400 border-b flex justify-center">
                  Unit HP
                </label>
                {Array.isArray(item.units) && item.units.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {item.units.map((unit, unitIndex) => {
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
                            U{unitIndex + 1}:{" "}
                            <span className="text-amber-400">{hp}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Effects block */}
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
          <MinionCard
            key={popupId}
            item={item}
            onClose={() => close(popupId)}
          />
        );
      })}

      {diceOpen && (
        <DiceTowerPopup
          component={<MinionDiceTower minions={minionsData} />}
          onClose={() => setDiceOpen(false)}
        />
      )}
    </div>
  );
}

export default MinionsPlay;
