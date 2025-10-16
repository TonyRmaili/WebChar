import React, { useMemo, useRef, useState, useCallback } from "react";
import useCharStore from "../store/CharStore";

const DEFAULT_ACTIONS = { actions: [] };

const SAVE_ABILITIES = [
  "Strength","Dexterity","Constitution","Intelligence","Wisdom","Charisma"
];

// ---------- Small helpers ----------
const Chip = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900 text-slate-200 text-xs">
    {children}
  </span>
);

const newDamagePart = () => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  formula: "", // e.g., "2d6 + 4"
  dtype: "",   // e.g., "slashing"
});

// ---------- A single Action row (collapsible) ----------
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

  const saveText = row.save?.has
    ? `DC ${row.save.dc || "-"} ${row.save.ability || ""}`.trim()
    : "";

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
            onChange={(e) => onChange(row.id, { name: e.target.value })}
            placeholder='e.g., "Shadow Strike"'
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <div className="hidden md:flex items-center gap-2 px-2">
          <Chip>{row.hit_bonus !== "" && row.hit_bonus != null ? `+${row.hit_bonus} hit` : "+? hit"}</Chip>
          {summaryDamage ? <Chip>{summaryDamage}</Chip> : null}
          {saveText ? <Chip>{saveText}</Chip> : null}
        </div>

        <svg
          className={`ml-3 h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/>
        </svg>
      </button>

      {/* Body */}
      {open && (
        <div className="p-3 space-y-4 border-t border-slate-700">
          {/* Hit + Save */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <label className="w-24 text-slate-300 text-sm">+Hit</label>
              <input
                type="number"
                value={row.hit_bonus ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Number(e.target.value);
                  if (v !== "" && Number.isNaN(v)) return;
                  onChange(row.id, { hit_bonus: v });
                }}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!row.save?.has}
                onChange={(e) =>
                  onChange(row.id, { save: { ...(row.save||{}), has: e.target.checked } })
                }
                className="h-4 w-4 accent-orange-500"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-slate-200 text-sm">Requires Save</span>
            </label>

            {row.save?.has && (
              <div className="flex items-center gap-2">
                <label className="w-24 text-slate-300 text-sm">DC</label>
                <input
                  type="number"
                  value={row.save.dc ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? "" : Number(e.target.value);
                    if (v !== "" && Number.isNaN(v)) return;
                    onChange(row.id, { save: { ...(row.save||{}), dc: v, has: true } });
                  }}
                  className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>

          {row.save?.has && (
            <div className="flex items-center gap-2">
              <label className="w-24 text-slate-300 text-sm">Save Type</label>
              <select
                value={row.save.ability || ""}
                onChange={(e) =>
                  onChange(row.id, { save: { ...(row.save||{}), ability: e.target.value, has: true } })
                }
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900 max-w-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">Select…</option>
                {SAVE_ABILITIES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          )}

          {/* Damage parts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-slate-300 text-sm font-medium">Damage</div>
              <button
                type="button"
                onClick={() => onAddDamage(row.id)}
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
                <div
                  key={d.id}
                  className="flex flex-col sm:flex-row items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 p-2"
                >
                  <div className="flex items-center gap-2 w-full sm:w-1/2">
                    <label className="w-24 text-slate-300 text-sm">Formula</label>
                    <input
                      type="text"
                      value={d.formula ?? ""}
                      onChange={(e) => onChangeDamage(row.id, d.id, { formula: e.target.value })}
                      placeholder='e.g., "2d6 + 4"'
                      className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-1/2">
                    <label className="w-16 text-slate-300 text-sm">Type</label>
                    <input
                      type="text"
                      value={d.dtype ?? ""}
                      onChange={(e) => onChangeDamage(row.id, d.id, { dtype: e.target.value })}
                      placeholder="slashing, necrotic…"
                      className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                    />
                  </div>

                  <div className="w-full sm:w-auto flex justify-end">
                    <button
                      type="button"
                      onClick={() => onRemoveDamage(row.id, d.id)}
                      className="px-3 py-1.5 rounded-lg border border-red-700 bg-red-900/40 hover:bg-red-900/60 text-red-100 transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col md:flex-row gap-2">
            <label className="w-full md:w-24 text-slate-300 text-sm md:text-right">
              Description
            </label>
            <textarea
              value={row.description ?? ""}
              onChange={(e) => onChange(row.id, { description: e.target.value })}
              placeholder="Rider effects, conditions, notes…"
              className="flex-1 min-h-[120px] rounded border border-slate-700 bg-white text-slate-900 p-2"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onRemove(row.id)}
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

// =================== MAIN PAGE ===================
export default function Actions() {
  const { charData, updateCharField, postCharData } = useCharStore();
  if (!charData) return null;

  // Stable default shape
  const model = useMemo(
    () => ({ ...DEFAULT_ACTIONS, ...(charData.actions || {}) }),
    [charData?.actions]
  );

  // Keep rows open while editing
  const [openById, setOpenById] = useState({}); // { [rowId]: boolean }
  const toggleOpen = useCallback((id) => {
    setOpenById((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Debounce post to avoid focus loss while typing
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
  const addAction = useCallback(() => {
    const row = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: "",
      hit_bonus: "",
      damages: [],
      save: { has: false, dc: "", ability: "" },
      description: "",
    };
    const next = { ...model, actions: [...(model.actions || []), row] };
    persist(next, { immediate: true });
    setOpenById((prev) => ({ ...prev, [row.id]: true }));
  }, [model, persist]);

  const removeAction = useCallback((id) => {
    const next = { ...model, actions: (model.actions || []).filter((a) => a.id !== id) };
    persist(next, { immediate: true });
    setOpenById((prev) => {
      const c = { ...prev };
      delete c[id];
      return c;
    });
  }, [model, persist]);

  // Update fields on an action
  const changeAction = useCallback((id, patch) => {
    const next = {
      ...model,
      actions: (model.actions || []).map((a) => (a.id === id ? { ...a, ...patch } : a)),
    };
    persist(next); // debounced
  }, [model, persist]);

  // Damage parts
  const addDamagePartTo = useCallback((actionId) => {
    const next = {
      ...model,
      actions: (model.actions || []).map((a) =>
        a.id === actionId ? { ...a, damages: [...(a.damages || []), newDamagePart()] } : a
      ),
    };
    persist(next, { immediate: true });
  }, [model, persist]);

  const changeDamagePart = useCallback((actionId, dmgId, patch) => {
    const next = {
      ...model,
      actions: (model.actions || []).map((a) =>
        a.id === actionId
          ? { ...a, damages: (a.damages || []).map((d) => (d.id === dmgId ? { ...d, ...patch } : d)) }
          : a
      ),
    };
    persist(next); // debounced
  }, [model, persist]);

  const removeDamagePart = useCallback((actionId, dmgId) => {
    const next = {
      ...model,
      actions: (model.actions || []).map((a) =>
        a.id === actionId ? { ...a, damages: (a.damages || []).filter((d) => d.id !== dmgId) } : a
      ),
    };
    persist(next, { immediate: true });
  }, [model, persist]);

  const actions = model.actions || [];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-3">
        <header className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-orange-300">
            Actions {actions.length > 0 ? <span className="text-slate-400 text-sm">({actions.length})</span> : null}
          </h3>
          <button
            type="button"
            onClick={addAction}
            className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
          >
            Add action
          </button>
        </header>

        {actions.length === 0 && (
          <p className="text-slate-400 text-sm">No actions yet. Click “Add action”.</p>
        )}

        <div className="space-y-3">
          {actions.map((row) => (
            <ActionRow
              key={row.id}
              row={row}
              open={!!openById[row.id]}
              onToggleOpen={toggleOpen}
              onChange={changeAction}
              onRemove={removeAction}
              onAddDamage={addDamagePartTo}
              onChangeDamage={changeDamagePart}
              onRemoveDamage={removeDamagePart}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
