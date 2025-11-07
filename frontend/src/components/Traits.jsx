import React, { useMemo, useRef, useState, useCallback } from "react";
import useCharStore from "../store/CharStore";

const DEFAULT_TRAITS = { feats: [], class: [], race: [], background: [], others: [] };


function SummaryChip({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900 text-slate-200 text-xs">
      <span className="text-slate-400">{label}:</span> {value}
    </span>
  );
}


const TraitRow = React.memo(function TraitRow({
  categoryKey,
  row,
  open,
  onToggleOpen,
  onChangeField,
  onRemove,
}) {
  const charges = row.charges ?? { has: false, max_charges: 0, reset_amount: "full", current_charges: 0 };
  const hasCharges = !!charges.has;
  const patchCharges = (patch) => onChangeField(categoryKey, row.id, { charges: { ...charges, ...patch } });

  const resetAmountMode = typeof charges.reset_amount === "string" ? "full" : "number";
  const resetAmountNumber = typeof charges.reset_amount === "number" ? charges.reset_amount : 0;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60">
      {/* Header */}
      <button
        type="button"
        onClick={() => onToggleOpen(row.id)}
        className="w-full px-3 py-2 hover:bg-slate-800/60"
        aria-expanded={open}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 min-w-[220px] max-w-[520px] grow">
            <span className="text-slate-400 text-xs">Name</span>
            <input
              type="text"
              value={row.name ?? ""}
              onChange={(e) => onChangeField(categoryKey, row.id, { name: e.target.value })}
              placeholder="Great Weapon Master"
              className="w-full min-w-0 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {hasCharges ? (
            <div className="flex flex-wrap items-center gap-2 shrink min-w-[220px]">
              <SummaryChip label="Charges" value={`${charges.current_charges}/${charges.max_charges}`} />
              <SummaryChip label="On reset" value={typeof charges.reset_amount === "string" ? "Full" : charges.reset_amount} />
            </div>
          ) : null}

          <svg className={`ml-auto h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/>
          </svg>
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="p-3 space-y-3 border-t border-slate-700">
          {/* Charges toggle + quick actions */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-slate-200 text-xs">
              <input
                type="checkbox"
                checked={hasCharges}
                onChange={(e) => {
                  if (e.target.checked) {
                    const max = charges.max_charges || 1;
                    patchCharges({ has: true, max_charges: max, current_charges: max, reset_amount: charges.reset_amount ?? "full" });
                  } else {
                    patchCharges({ has: false, max_charges: 0, current_charges: 0, reset_amount: "full" });
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 accent-orange-400"
              />
              Trait has charges
            </label>

            {hasCharges ? (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); patchCharges({ current_charges: charges.max_charges }); }}
                  className="px-2 py-1 rounded border border-slate-600 bg-slate-900 hover:bg-slate-800 text-xs"
                >
                  Refill
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    patchCharges({ current_charges: Math.max(0, (charges.current_charges ?? 0) - 1) });
                  }}
                  className="px-2 py-1 rounded border border-slate-600 bg-slate-900 hover:bg-slate-800 text-xs"
                >
                  Spend 1
                </button>
              </div>
            ) : null}
          </div>

          {/* Charges config */}
          {hasCharges && (
            <div className="flex flex-wrap items-end gap-3">
              {/* Max charges */}
              <div className="flex flex-col">
                <label className="text-[10px] text-slate-400">Max charges</label>
                <input
                  type="number"
                  min={0}
                  value={charges.max_charges ?? 0}
                  onChange={(e) => {
                    const v = e.target.value === "" ? 0 : Number(e.target.value);
                    if (Number.isNaN(v)) return;
                    const max = Math.max(0, v);
                    // Always sync current to max when max changes
                    patchCharges({ max_charges: max, current_charges: max });
                  }}
                  className="w-24 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Reset amount */}
              <div className="flex items-end gap-2">
                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">Reset mode</label>
                  <select
                    value={resetAmountMode}
                    onChange={(e) => patchCharges({ reset_amount: e.target.value === "full" ? "full" : 0 })}
                    className="w-24 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="full">Full</option>
                    <option value="number">Number</option>
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">Reset number</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={resetAmountNumber}
                    disabled={resetAmountMode !== "number"}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) patchCharges({ reset_amount: Math.max(0, Math.trunc(n)) });
                    }}
                    // wider so numbers are readable
                    className={`w-28 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900 ${
                      resetAmountMode !== "number" ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="flex flex-col">
            <label className="text-[10px] text-slate-400">Description</label>
            <textarea
              value={row.description ?? ""}
              onChange={(e) => onChangeField(categoryKey, row.id, { description: e.target.value })}
              placeholder="Rules text, benefits, usage notes"
              className="min-h-[80px] rounded border border-slate-700 bg-white text-slate-900 p-2 max-w-[40rem]"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onRemove(categoryKey, row.id)}
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

function Traits() {
  const { charData, updateCharField, postCharData } = useCharStore();
  if (!charData) return null;

  const traits = useMemo(
    () => ({ ...DEFAULT_TRAITS, ...(charData.traits || {}) }),
    [charData?.traits]
  );

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
        charges: { has: false, max_charges: 0, reset_amount: "full", current_charges: 0 },
      };
      const next = { ...traits, [category]: [...(traits[category] || []), row] };
      persist(next, { immediate: true });
      setOpenById((prev) => ({ ...prev, [row.id]: true }));
    },
    [traits, persist]
  );

  const removeTrait = useCallback(
    (category, id) => {
      const next = { ...traits, [category]: (traits[category] || []).filter((t) => t.id !== id) };
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
      persist(next);
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
