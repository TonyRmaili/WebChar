import React, { useMemo, useRef, useState, useCallback } from "react";
import useCharStore from "../store/CharStore";

const DEFAULT_ACTIONS = { actions: [], bonus_actions: [], reactions: [] };
const SAVE_ABILITIES = ["Strength","Dexterity","Constitution","Intelligence","Wisdom","Charisma"];

/* ---------- Small chip ---------- */
const Chip = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900 text-slate-200 text-xs">
    {children}
  </span>
);

/* ---------- Helpers ---------- */
const newDamagePart = () => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  formula: "",
  dtype: "",
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
    .map((d,i) => `${i>0?"+ ":""}${(d.formula||"-").trim()} ${d.dtype||""}`.trim())
    .join(", ");
  const saveText = row.save?.has ? `DC ${row.save.dc || "-"} ${row.save.ability || ""}`.trim() : "";
  const chargesText = row.charges?.has
    ? `${row.charges.current_charges ?? 0}/${row.charges.max_charges ?? 0} charges`
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
          <span className="text-slate-400 text-sm">Name:</span>
          <input
            type="text"
            value={row.name ?? ""}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder='e.g., "Shadow Strike"'
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <div className="hidden md:flex items-center gap-2 px-2">
          <Chip>{row.hit_bonus !== "" && row.hit_bonus != null ? `+${row.hit_bonus} hit` : "+? hit"}</Chip>
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
        <div className="p-3 space-y-4 border-t border-slate-700">
          {/* Hit + Save + Charges toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <label className="w-24 text-slate-300 text-sm">+Hit</label>
              <input
                type="number"
                value={row.hit_bonus ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Number(e.target.value);
                  if (v !== "" && Number.isNaN(v)) return;
                  onChange({ hit_bonus: v });
                }}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!row.save?.has}
                onChange={(e) => onChange({ save: { ...(row.save||{}), has: e.target.checked } })}
                className="h-4 w-4 accent-orange-500"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-slate-200 text-sm">Requires Save</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!row.charges?.has}
                onChange={(e) => {
                  const enable = e.target.checked;
                  if (!enable) {
                    onChange({ charges: { ...(row.charges || {}), has: false } });
                  } else {
                    onChange({
                      charges: {
                        ...(row.charges || {}),
                        has: true,
                        // no current_charges input; will auto-seed when max is entered
                        max_charges: row.charges?.max_charges ?? "",
                        resetAmount: row.charges?.resetAmount ?? "full",
                        resetOn: row.charges?.resetOn ?? "short",
                      },
                    });
                  }
                }}
                className="h-4 w-4 accent-orange-500"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-slate-200 text-sm">Has Charges</span>
            </label>
          </div>

          {/* Save details */}
          {row.save?.has && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <label className="w-24 text-slate-300 text-sm">DC</label>
                <input
                  type="number"
                  value={row.save.dc ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? "" : Number(e.target.value);
                    if (v !== "" && Number.isNaN(v)) return;
                    onChange({ save: { ...(row.save||{}), dc: v, has: true } });
                  }}
                  className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="w-24 text-slate-300 text-sm">Save Type</label>
                <select
                  value={row.save.ability || ""}
                  onChange={(e) => onChange({ save: { ...(row.save||{}), ability: e.target.value, has: true } })}
                  className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900 max-w-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">Select…</option>
                  {SAVE_ABILITIES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Damage parts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-slate-300 text-sm font-medium">Damage</div>
              <button
                type="button"
                onClick={onAddDamage}
                className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
              >
                Add damage part
              </button>
            </div>

            {(row.damages || []).length === 0 && (
              <p className="text-slate-400 text-sm">No damage yet. Add parts like “2d6 + 4 slashing”.</p>
            )}

            <div className="space-y-2">
              {(row.damages || []).map((d) => (
                <div key={d.id} className="flex flex-col sm:flex-row items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 p-2">
                  <div className="flex items-center gap-2 w-full sm:w-1/2">
                    <label className="w-24 text-slate-300 text-sm">Formula</label>
                    <input
                      type="text"
                      value={d.formula ?? ""}
                      onChange={(e) => onChangeDamage(d.id, { formula: e.target.value })}
                      placeholder='e.g., "2d6 + 4"'
                      className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-1/2">
                    <label className="w-16 text-slate-300 text-sm">Type</label>
                    <input
                      type="text"
                      value={d.dtype ?? ""}
                      onChange={(e) => onChangeDamage(d.id, { dtype: e.target.value })}
                      placeholder="slashing, necrotic…"
                      className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                    />
                  </div>

                  <div className="w-full sm:w-auto flex justify-end">
                    <button
                      type="button"
                      onClick={() => onRemoveDamage(d.id)}
                      className="px-3 py-1.5 rounded-lg border border-red-700 bg-red-900/40 hover:bg-red-900/60 text-red-100 transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Charges (no Current input) */}
          {row.charges?.has && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Max */}
                <div className="flex items-center gap-2">
                  <label className="w-24 text-slate-300 text-sm">Max</label>
                  <input
                    type="number"
                    min={0}
                    value={row.charges.max_charges ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value === "" ? "" : Number(e.target.value);
                      if (raw !== "" && Number.isNaN(raw)) return;

                      const nextMax = raw === "" ? "" : Math.max(0, raw);
                      let nextCur = row.charges.current_charges;

                      // Auto-seed current when first setting max, else clamp current to max
                      if (nextMax !== "" && Number.isFinite(Number(nextMax))) {
                        const nMax = Number(nextMax);
                        if (nextCur === "" || nextCur == null) nextCur = nMax;
                        else if (Number.isFinite(Number(nextCur))) nextCur = Math.min(Number(nextCur), nMax);
                      }

                      onChange({
                        charges: {
                          ...(row.charges || {}),
                          has: true,
                          max_charges: nextMax,
                          current_charges: nextCur,
                        },
                      });
                    }}
                    className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                  />
                </div>

                {/* Reset amount */}
                <div className="flex items-center gap-2">
                  <label className="w-24 text-slate-300 text-sm">Reset Amount</label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row.charges?.resetAmount === "full"}
                      onChange={(e) => {
                        const isFull = e.target.checked;
                        const prevNum = typeof row.charges?.resetAmount === "number" && row.charges.resetAmount >= 1
                          ? row.charges.resetAmount : 1;
                        onChange({
                          charges: { ...(row.charges || {}), resetAmount: isFull ? "full" : prevNum, has: true }
                        });
                      }}
                      className="h-4 w-4 accent-orange-500"
                    />
                    <span className="text-slate-200 text-sm">Full</span>
                  </label>
                  {row.charges?.resetAmount !== "full" && (
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={
                        typeof row.charges?.resetAmount === "number" && row.charges.resetAmount >= 1
                          ? row.charges.resetAmount : 1
                      }
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        if (Number.isFinite(raw)) {
                          const val = Math.max(1, Math.trunc(raw));
                          onChange({ charges: { ...(row.charges || {}), resetAmount: val, has: true } });
                        }
                      }}
                      className="w-24 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                    />
                  )}
                </div>

                {/* Reset on */}
                <div className="flex items-center gap-2">
                  <label className="w-24 text-slate-300 text-sm">Resets On</label>
                  <select
                    value={row.charges.resetOn || "short"}
                    onChange={(e) => onChange({ charges: { ...(row.charges || {}), resetOn: e.target.value, has: true } })}
                    className="max-w-xs flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                  >
                    <option value="short">Short Rest</option>
                    <option value="long">Long Rest</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Description */}
          <div className="flex flex-col md:flex-row gap-2">
            <label className="w-full md:w-24 text-slate-300 text-sm md:text-right">Description</label>
            <textarea
              value={row.description ?? ""}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Rider effects, conditions, notes…"
              className="flex-1 min-h-[120px] rounded border border-slate-700 bg-white text-slate-900 p-2"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onRemove}
              className="px-3 py-1.5 rounded-lg border border-red-700 bg-red-900/40 hover:bg-red-900/60 text-red-100 transition"
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
export default function Actions() {
  const { charData, updateCharField, postCharData } = useCharStore();
  if (!charData) return null;

  // Expect the new shape already
  const model = useMemo(
    () => ({ ...DEFAULT_ACTIONS, ...(charData.actions || {}) }),
    [charData?.actions]
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
      updateCharField("actions", next);
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
      hit_bonus: "",
      damages: [],
      save: { has: false, dc: "", ability: "" },
      // Charges: disabled by default; when user sets Max, we'll auto-seed Current = Max.
      charges: { has: false, max_charges: "", /* current_charges auto-seeded later */ resetAmount: "full", resetOn: "short" },
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
