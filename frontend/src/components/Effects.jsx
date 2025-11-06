import React, { useMemo, useRef, useState, useCallback } from "react";
import useCharStore from "../store/CharStore";

const DEFAULT_EFFECTS = { actions: [], bonus_actions: [], reactions: [] };
const SAVE_ABILITIES = ["Strength","Dexterity","Constitution","Intelligence","Wisdom","Charisma"];

const ATTACK_TYPES = ["melee", "ranged", "spell"];
const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100];
const DAMAGE_TYPES = [
  "acid","bludgeoning","cold","fire","force","lightning","necrotic",
  "piercing","poison","psychic","radiant","slashing","thunder"
];


/* ---------- Small chip ---------- */
const Chip = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900 text-slate-200 text-xs">
    {children}
  </span>
);

/* ---------- Helpers ---------- */
const newDamagePart = () => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
  dice_count: 1,
  dice_sides: 6,
  dtype: "slashing",
});


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
  const summaryDamage = (row.damages || [])
    .map((d,i) => `${i>0?"+ ":""}${d.dice_count}d${d.dice_sides} ${d.dtype}`)
    .join(", ");
  const saveText = row.save?.has ? `${row.save.ability || ""}`.trim() : "";
  const chargesText = row.charges?.has
    ? `${row.charges.max_charges ?? 0} max`
    : null;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60">
      {/* Header */}
      <button
        type="button"
        onClick={() => onToggleOpen(row.id)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/60"
        aria-expanded={open}
      >
        <div className="flex-1 flex items-center gap-2">
          <span className="text-slate-400 text-xs">Name</span>
          <input
            type="text"
            value={row.name ?? ""}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder='e.g., "Shadow Strike"'
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900 max-w-[18rem]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <div className="hidden md:flex items-center gap-2 px-2">
          {summaryDamage ? <Chip>{summaryDamage}</Chip> : null}
          {saveText ? <Chip>{saveText}</Chip> : null}
          {chargesText ? <Chip>{chargesText}</Chip> : null}
        </div>

        <svg className={`ml-3 h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/>
        </svg>
      </button>

      {/* Body */}
      {open && (
        <div className="p-3 space-y-3 border-t border-slate-700">
          {/* First row: atk type, charges, save, add damage */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-400">Attack Type</label>
              <select
                value={row.atk_kind || "melee"}
                onChange={(e) => onChange({ atk_kind: e.target.value })}
                className="px-2 py-1 rounded border border-slate-700 bg-white text-slate-900 w-24"
              >
                {ATTACK_TYPES.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!row.charges?.has}
                onChange={(e) => {
                  const has = e.target.checked;
                  onChange({
                    charges: has
                      ? { has: true, max_charges: row.charges?.max_charges ?? "", resetAmount: row.charges?.resetAmount ?? "full" }
                      : { has: false }
                  });
                }}
                className="h-4 w-4 accent-orange-500"
              />
              <span className="text-xs text-slate-200">Has charges</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!row.save?.has}
                onChange={(e) => onChange({ save: { ...(row.save||{}), has: e.target.checked } })}
                className="h-4 w-4 accent-orange-500"
              />
              <span className="text-xs text-slate-200">Requires save</span>
            </label>

            <button
              type="button"
              onClick={onAddDamage}
              className="ml-auto px-3 py-1 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 text-sm"
            >
              Add damage
            </button>
          </div>

          {/* Save details */}
          {row.save?.has && (
            <div className="flex flex-wrap gap-3">                       
              <div className="flex flex-col">
                <label className="text-[10px] text-slate-400">Save Ability</label>
                <select
                  value={row.save.ability || ""}
                  onChange={(e) => onChange({ save: { ...(row.save||{}), ability: e.target.value, has: true } })}
                  className="w-30 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                >
                  <option value="">Select</option>
                  {SAVE_ABILITIES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Damage parts */}
          <div className="space-y-2">
            {(row.damages || []).map((d) => (
              <div key={d.id} className="flex flex-wrap items-end gap-2 rounded border border-slate-700 bg-slate-900/60 p-2">
                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">Dice</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={d.dice_count ?? 1}
                      onChange={(e) => onChangeDamage(d.id, { dice_count: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-16 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                    />
                    <span className="text-xs text-slate-300">d</span>
                    <select
                      value={d.dice_sides ?? 6}
                      onChange={(e) => onChangeDamage(d.id, { dice_sides: Number(e.target.value) })}
                      className="w-20 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                    >
                      {DICE_SIDES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">Damage Type</label>
                  <select
                    value={d.dtype ?? "slashing"}
                    onChange={(e) => onChangeDamage(d.id, { dtype: e.target.value })}
                    className="w-36 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                  >
                    {DAMAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="ml-auto">
                  <button
                    type="button"
                    onClick={() => onRemoveDamage(d.id)}
                    className="px-2 py-1 rounded border border-red-700 bg-red-900/40 hover:bg-red-900/60 text-red-100 text-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Charges */}
          {row.charges?.has && (
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col">
                <label className="text-[10px] text-slate-400">Max Charges</label>
                <input
                  type="number"
                  min={0}
                  value={row.charges.max_charges ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value === "" ? "" : Number(e.target.value);
                    if (raw !== "" && Number.isNaN(raw)) return;
                    const nextMax = raw === "" ? "" : Math.max(0, raw);
                    onChange({ charges: { ...(row.charges||{}), has: true, max_charges: nextMax } });
                  }}
                  className="w-24 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] text-slate-400">Short Rest Reset</label>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={row.charges?.resetAmount === "full"}
                      onChange={(e) => {
                        const isFull = e.target.checked;
                        const prevNum = typeof row.charges?.resetAmount === "number" && row.charges.resetAmount >= 1
                          ? row.charges.resetAmount : 1;
                        onChange({ charges: { ...(row.charges||{}), resetAmount: isFull ? "full" : prevNum, has: true } });
                      }}
                      className="h-4 w-4 accent-orange-500"
                    />
                    Full
                  </label>
                  {row.charges?.resetAmount !== "full" && (
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={typeof row.charges?.resetAmount === "number" && row.charges.resetAmount >= 1
                        ? row.charges.resetAmount : 1}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        if (Number.isFinite(raw)) {
                          onChange({ charges: { ...(row.charges||{}), resetAmount: Math.max(1, Math.trunc(raw)), has: true } });
                        }
                      }}
                      className="w-20 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="flex flex-col">
            <label className="text-[10px] text-slate-400">Description</label>
            <textarea
              value={row.description ?? ""}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Notes, riders, conditions"
              className="min-h-[80px] rounded border border-slate-700 bg-white text-slate-900 p-2 max-w-[40rem]"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onRemove}
              className="px-3 py-1 rounded border border-red-700 bg-red-900/40 hover:bg-red-900/60 text-red-100 text-sm"
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
  categoryKey,
  rows,
  openById,
  onToggleOpen,
  onAdd,
  onRemove,
  onChangeRow,
  onAddDamage,
  onChangeDamage,
  onRemoveDamage,
}) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-orange-300">
          {title} {rows.length > 0 ? <span className="text-slate-400 text-sm">({rows.length})</span> : null}
        </h3>
        <button
          type="button"
          onClick={() => onAdd(categoryKey)}
          className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
        >
          Add
        </button>
      </header>

      {rows.length === 0 && (
        <p className="text-slate-400 text-sm">No {title.toLowerCase()} yet. Click “Add”.</p>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <ActionRow
            key={row.id}
            row={row}
            open={!!openById[row.id]}
            onToggleOpen={() => onToggleOpen(row.id)}
            onChange={(patch) => onChangeRow(categoryKey, row.id, patch)}
            onRemove={() => onRemove(categoryKey, row.id)}
            onAddDamage={() => onAddDamage(categoryKey, row.id)}
            onChangeDamage={(dmgId, patch) => onChangeDamage(categoryKey, row.id, dmgId, patch)}
            onRemoveDamage={(dmgId) => onRemoveDamage(categoryKey, row.id, dmgId)}
          />
        ))}
      </div>
    </section>
  );
});

/* ================== MAIN PAGE ================== */
export default function Effects() {
  const { charData, updateCharField, postCharData } = useCharStore();
  if (!charData) return null;

  // Expect the new shape already
  const model = useMemo(
    () => ({ ...DEFAULT_EFFECTS, ...(charData.effects || {}) }),
    [charData?.effects]
  );

  const [openById, setOpenById] = useState({});
  const toggleOpen = useCallback((id) => {
    setOpenById((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Debounced post
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

  // Add / Remove
  const addRow = useCallback((categoryKey) => {
    const row = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: "",
      atk_kind: "melee",                 // new
      damages: [],                       // [{ dice_count, dice_sides, dtype }]
      save: { has: false, ability: "" },
      charges: { has: false, max_charges: "", resetAmount: "full" },
      description: "",
    };
    const next = { ...model, [categoryKey]: [...(model[categoryKey] || []), row] };
    persist(next, { immediate: true });
    setOpenById((prev) => ({ ...prev, [row.id]: true }));
  }, [model, persist]);


  const removeRow = useCallback((categoryKey, id) => {
    const next = { ...model, [categoryKey]: (model[categoryKey] || []).filter((r) => r.id !== id) };
    persist(next, { immediate: true });
    setOpenById((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, [model, persist]);

  const changeRow = useCallback((categoryKey, id, patch) => {
    const next = {
      ...model,
      [categoryKey]: (model[categoryKey] || []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
    };
    persist(next); // debounced
  }, [model, persist]);

  // Damage parts mutations
  const addDamagePartTo = useCallback((categoryKey, actionId) => {
    const next = {
      ...model,
      [categoryKey]: (model[categoryKey] || []).map((a) =>
        a.id === actionId ? { ...a, damages: [...(a.damages || []), newDamagePart()] } : a
      ),
    };
    persist(next, { immediate: true });
  }, [model, persist]);

  const changeDamagePart = useCallback((categoryKey, actionId, dmgId, patch) => {
    const next = {
      ...model,
      [categoryKey]: (model[categoryKey] || []).map((a) =>
        a.id === actionId
          ? { ...a, damages: (a.damages || []).map((d) => (d.id === dmgId ? { ...d, ...patch } : d)) }
          : a
      ),
    };
    persist(next); // debounced
  }, [model, persist]);

  const removeDamagePart = useCallback((categoryKey, actionId, dmgId) => {
    const next = {
      ...model,
      [categoryKey]: (model[categoryKey] || []).map((a) =>
        a.id === actionId ? { ...a, damages: (a.damages || []).filter((d) => d.id !== dmgId) } : a
      ),
    };
    persist(next, { immediate: true });
  }, [model, persist]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <CategoryCard
        title="Actions"
        categoryKey="actions"
        rows={model.actions}
        openById={openById}
        onToggleOpen={toggleOpen}
        onAdd={addRow}
        onRemove={removeRow}
        onChangeRow={changeRow}
        onAddDamage={addDamagePartTo}
        onChangeDamage={changeDamagePart}
        onRemoveDamage={removeDamagePart}
      />
      <CategoryCard
        title="Bonus Actions"
        categoryKey="bonus_actions"
        rows={model.bonus_actions}
        openById={openById}
        onToggleOpen={toggleOpen}
        onAdd={addRow}
        onRemove={removeRow}
        onChangeRow={changeRow}
        onAddDamage={addDamagePartTo}
        onChangeDamage={changeDamagePart}
        onRemoveDamage={removeDamagePart}
      />
      <CategoryCard
        title="Reactions"
        categoryKey="reactions"
        rows={model.reactions}
        openById={openById}
        onToggleOpen={toggleOpen}
        onAdd={addRow}
        onRemove={removeRow}
        onChangeRow={changeRow}
        onAddDamage={addDamagePartTo}
        onChangeDamage={changeDamagePart}
        onRemoveDamage={removeDamagePart}
      />
    </div>
  );
}
