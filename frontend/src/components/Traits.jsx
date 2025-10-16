import React, { useMemo, useRef, useState, useCallback } from "react";
import useCharStore from "../store/CharStore";

const DEFAULT_TRAITS = {
  feats: [],
  class: [],
  race: [],
  background: [],
  others: [],
};

const RESET_OPTIONS = [
  { value: "none",  label: "Passive / None" },
  { value: "short", label: "On Short Rest" },
  { value: "long",  label: "On Long Rest" },
];

/* ---------- Small presentational chip ---------- */
function SummaryChip({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900 text-slate-200 text-xs">
      <span className="text-slate-400">{label}:</span> {value}
    </span>
  );
}

/* ---------- A single trait row (collapsible) ---------- */
const TraitRow = React.memo(function TraitRow({
  categoryKey,
  row,
  open,
  onToggleOpen,
  onChangeField,
  onRemove,
}) {
  const resetLabel =
    RESET_OPTIONS.find((o) => o.value === (row.reset || "none"))?.label || "Passive / None";

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
            onChange={(e) => onChangeField(categoryKey, row.id, { name: e.target.value })}
            placeholder="e.g., Great Weapon Master"
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
            onClick={(e) => e.stopPropagation()} // don't toggle when editing
          />
        </div>

        {/* Compact summary chips */}
        <div className="hidden md:flex items-center gap-2 px-2">
          <SummaryChip label="Reset" value={resetLabel} />
          {row.uses_max ? <SummaryChip label="Uses" value={`${row.uses_max}`} /> : null}
        </div>

        <svg
          className={`ml-3 h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Body */}
      {open && (
        <div className="p-3 space-y-3 border-t border-slate-700">
          {/* Uses + Reset line */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <label className="w-28 text-slate-300 text-sm">Uses (max)</label>
              <input
                type="number"
                min={0}
                value={row.uses_max ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Number(e.target.value);
                  if (v !== "" && Number.isNaN(v)) return;
                  onChangeField(categoryKey, row.id, { uses_max: v });
                }}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="w-28 text-slate-300 text-sm">Resets</label>
              <select
                value={row.reset || "none"}
                onChange={(e) => onChangeField(categoryKey, row.id, { reset: e.target.value })}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                {RESET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col md:flex-row gap-2">
            <label className="w-full md:w-28 text-slate-300 text-sm md:text-right">
              Description
            </label>
            <textarea
              value={row.description ?? ""}
              onChange={(e) =>
                onChangeField(categoryKey, row.id, { description: e.target.value })
              }
              placeholder="Rules text, benefits, usage notes, etc."
              className="flex-1 min-h-[130px] rounded border border-slate-700 bg-white text-slate-900 p-2"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onRemove(categoryKey, row.id)}
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

/* ---------- Category card ---------- */
const CategoryCard = React.memo(function CategoryCard({
  title,
  categoryKey,
  rows,
  openById,
  onToggleOpen,
  onAdd,
  onRemove,
  onChangeField,
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
          <TraitRow
            key={row.id}
            categoryKey={categoryKey}
            row={row}
            open={!!openById[row.id]}
            onToggleOpen={onToggleOpen}
            onChangeField={onChangeField}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  );
});

/* =================== MAIN PAGE =================== */
function Traits() {
  const { charData, updateCharField, postCharData } = useCharStore();
  if (!charData) return null;

  // Ensure a stable shape even if backend hasn't set it yet
  const traits = useMemo(
    () => ({ ...DEFAULT_TRAITS, ...(charData.traits || {}) }),
    [charData?.traits]
  );

  // Keep open/closed state per row ID (survives re-renders)
  const [openById, setOpenById] = useState({});

  const toggleOpen = useCallback((id) => {
    setOpenById((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Debounced posting so typing doesn't steal focus
  const debounceRef = useRef(null);
  const debouncedPost = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => postCharData(), 400);
  }, [postCharData]);

  const persist = useCallback(
    (nextTraits, { immediate = false } = {}) => {
      updateCharField("traits", nextTraits);
      if (immediate) postCharData();
      else debouncedPost();
    },
    [updateCharField, postCharData, debouncedPost]
  );

  const addTrait = useCallback(
    (category) => {
      const row = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: "",
        description: "",
        uses_max: "",
        reset: "none",
      };
      const next = {
        ...traits,
        [category]: [...(traits[category] || []), row],
      };
      persist(next, { immediate: true });
      // auto-open the new row
      setOpenById((prev) => ({ ...prev, [row.id]: true }));
    },
    [traits, persist]
  );

  const removeTrait = useCallback(
    (category, id) => {
      const next = {
        ...traits,
        [category]: (traits[category] || []).filter((t) => t.id !== id),
      };
      persist(next, { immediate: true });
      setOpenById((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    },
    [traits, persist]
  );

  const updateTrait = useCallback(
    (category, id, patch) => {
      const next = {
        ...traits,
        [category]: (traits[category] || []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
      };
      persist(next); // debounced while typing
    },
    [traits, persist]
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <CategoryCard
        title="Feats"
        categoryKey="feats"
        rows={traits.feats || []}
        openById={openById}
        onToggleOpen={toggleOpen}
        onAdd={addTrait}
        onRemove={removeTrait}
        onChangeField={updateTrait}
      />
      <CategoryCard
        title="Class Traits"
        categoryKey="class"
        rows={traits.class || []}
        openById={openById}
        onToggleOpen={toggleOpen}
        onAdd={addTrait}
        onRemove={removeTrait}
        onChangeField={updateTrait}
      />
      <CategoryCard
        title="Racial Traits"
        categoryKey="race"
        rows={traits.race || []}
        openById={openById}
        onToggleOpen={toggleOpen}
        onAdd={addTrait}
        onRemove={removeTrait}
        onChangeField={updateTrait}
      />
      <CategoryCard
        title="Background Traits"
        categoryKey="background"
        rows={traits.background || []}
        openById={openById}
        onToggleOpen={toggleOpen}
        onAdd={addTrait}
        onRemove={removeTrait}
        onChangeField={updateTrait}
      />
      <CategoryCard
        title="Other Traits"
        categoryKey="others"
        rows={traits.others || []}
        openById={openById}
        onToggleOpen={toggleOpen}
        onAdd={addTrait}
        onRemove={removeTrait}
        onChangeField={updateTrait}
      />
    </div>
  );
}

export default Traits;
