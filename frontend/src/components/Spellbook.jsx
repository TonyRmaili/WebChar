import React, { useMemo, useRef, useState, useCallback } from "react";
import useCharStore from "../store/CharStore";

const DEFAULT_SPELLBOOK = {
  spells:     { spells: [], slots: [] },
  pactmagic:  { spells: [], slots: [] },
  innate:     { spells: [], slots: [] },
};

// Small chip UI
const Chip = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900 text-slate-200 text-xs">
    {children}
  </span>
);

// Spell row (collapsible)
const SpellRow = React.memo(function SpellRow({
  categoryKey,
  row,
  open,
  onToggleOpen,
  onChangeField,
  onRemove,
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60">
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
            placeholder="e.g., Fireball"
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <div className="hidden md:flex items-center gap-2 px-2">
          <Chip>Lvl {row.level ?? "-"}</Chip>
          <Chip>{row.prepared ? "Prepared" : "Unprepared"}</Chip>
        </div>

        <svg
          className={`ml-3 h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/>
        </svg>
      </button>

      {open && (
        <div className="p-3 space-y-3 border-t border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <label className="w-24 text-slate-300 text-sm">Level</label>
              <input
                type="number" min={0} max={9}
                value={row.level ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Number(e.target.value);
                  if (v !== "" && Number.isNaN(v)) return;
                  onChangeField(categoryKey, row.id, { level: v });
                }}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!row.prepared}
                onChange={(e) => onChangeField(categoryKey, row.id, { prepared: e.target.checked })}
                className="h-4 w-4 accent-orange-500"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-slate-200 text-sm">Prepared</span>
            </label>

            <div className="flex items-center gap-2">
              <label className="w-24 text-slate-300 text-sm">School</label>
              <input
                type="text"
                value={row.school ?? ""}
                onChange={(e) => onChangeField(categoryKey, row.id, { school: e.target.value })}
                placeholder="e.g., Evocation"
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-2">
            <label className="w-full md:w-24 text-slate-300 text-sm md:text-right">Notes</label>
            <textarea
              value={row.notes ?? ""}
              onChange={(e) => onChangeField(categoryKey, row.id, { notes: e.target.value })}
              placeholder="Casting time, components, special notes…"
              className="flex-1 min-h-[110px] rounded border border-slate-700 bg-white text-slate-900 p-2"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onRemove(categoryKey, row.id, "spells")}
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

// Slot row (simple inline, non-collapsible)
const SlotRow = React.memo(function SlotRow({ categoryKey, row, onChangeField, onRemove }) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 items-center rounded-lg border border-slate-700 bg-slate-900/60 p-2">
      <div className="flex items-center gap-2 w-full sm:w-1/2">
        <label className="w-24 text-slate-300 text-sm">Level</label>
        <input
          type="number" min={0} max={9}
          value={row.level ?? ""}
          onChange={(e) => {
            const v = e.target.value === "" ? "" : Number(e.target.value);
            if (v !== "" && Number.isNaN(v)) return;
            onChangeField(categoryKey, row.id, { level: v }, "slots");
          }}
          className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
        />
      </div>

      <div className="flex items-center gap-2 w-full sm:w-1/2">
        <label className="w-24 text-slate-300 text-sm">Slots (max)</label>
        <input
          type="number" min={0}
          value={row.slots_max ?? ""}
          onChange={(e) => {
            const v = e.target.value === "" ? "" : Number(e.target.value);
            if (v !== "" && Number.isNaN(v)) return;
            onChangeField(categoryKey, row.id, { slots_max: v }, "slots");
          }}
          className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
        />
      </div>

      <div className="w-full sm:w-auto flex justify-end">
        <button
          type="button"
          onClick={() => onRemove(categoryKey, row.id, "slots")}
          className="px-3 py-1.5 rounded-lg border border-red-700 bg-red-900/40 hover:bg-red-900/60 text-red-100 transition"
        >
          Remove
        </button>
      </div>
    </div>
  );
});

// Category card
const CategoryCard = React.memo(function CategoryCard({
  title,
  categoryKey,
  model,
  openById,
  onToggleOpen,
  onAddSpell,
  onAddSlot,
  onRemoveRow,
  onChangeSpell,
  onChangeSlot,
}) {
  const spells = model.spells || [];
  const slots  = model.slots  || [];

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-orange-300">
          {title}{" "}
          <span className="text-slate-400 text-sm">
            ({spells.length} spells, {slots.length} slot row{slots.length === 1 ? "" : "s"})
          </span>
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onAddSlot(categoryKey)}
            className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
          >
            Add slots
          </button>
          <button
            type="button"
            onClick={() => onAddSpell(categoryKey)}
            className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
          >
            Add spell
          </button>
        </div>
      </header>

      {/* Slots */}
      <div className="space-y-2">
        <div className="text-slate-300 text-sm font-medium">Spell Slots</div>
        {slots.length === 0 && (
          <p className="text-slate-400 text-sm">No slot rows. Click “Add slots”.</p>
        )}
        {slots.map((row) => (
          <SlotRow
            key={row.id}
            categoryKey={categoryKey}
            row={row}
            onChangeField={onChangeSlot}
            onRemove={onRemoveRow}
          />
        ))}
      </div>

      {/* Spells */}
      <div className="space-y-2">
        <div className="text-slate-300 text-sm font-medium">Spells</div>
        {spells.length === 0 && (
          <p className="text-slate-400 text-sm">No spells yet. Click “Add spell”.</p>
        )}
        <div className="space-y-3">
          {spells.map((row) => (
            <SpellRow
              key={row.id}
              categoryKey={categoryKey}
              row={row}
              open={!!openById[row.id]}
              onToggleOpen={onToggleOpen}
              onChangeField={onChangeSpell}
              onRemove={onRemoveRow}
            />
          ))}
        </div>
      </div>
    </section>
  );
});

export default function Spellbook() {
  const { charData, updateCharField, postCharData } = useCharStore();
  if (!charData) return null;

  // Stable default shape
  const book = useMemo(
    () => ({ ...DEFAULT_SPELLBOOK, ...(charData.spellbook || {}) }),
    [charData?.spellbook]
  );

  // Keep rows open while editing
  const [openById, setOpenById] = useState({}); // { [rowId]: boolean }
  const toggleOpen = useCallback((id) => {
    setOpenById((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Debounce post to avoid focus loss
  const debounceRef = useRef(null);
  const debouncedPost = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => postCharData(), 400);
  }, [postCharData]);

  const persist = useCallback(
    (next, { immediate = false } = {}) => {
      updateCharField("spellbook", next);
      if (immediate) postCharData();
      else debouncedPost();
    },
    [updateCharField, postCharData, debouncedPost]
  );

  // ---- Add / Remove ----
  const addSpell = useCallback(
    (categoryKey) => {
      const row = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: "",
        level: "",
        prepared: false,
        school: "",
        notes: "",
      };
      const next = {
        ...book,
        [categoryKey]: {
          ...book[categoryKey],
          spells: [...(book[categoryKey].spells || []), row],
          slots:  [...(book[categoryKey].slots || [])],
        },
      };
      persist(next, { immediate: true });
      setOpenById((prev) => ({ ...prev, [row.id]: true }));
    },
    [book, persist]
  );

  const addSlot = useCallback(
    (categoryKey) => {
      const row = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        level: "",
        slots_max: "",
      };
      const next = {
        ...book,
        [categoryKey]: {
          ...book[categoryKey],
          spells: [...(book[categoryKey].spells || [])],
          slots:  [...(book[categoryKey].slots || []), row],
        },
      };
      persist(next, { immediate: true });
    },
    [book, persist]
  );

  const removeRow = useCallback(
    (categoryKey, id, which) => {
      const next = {
        ...book,
        [categoryKey]: {
          ...book[categoryKey],
          spells: (book[categoryKey].spells || []).filter((r) => !(which === "spells" && r.id === id)),
          slots:  (book[categoryKey].slots  || []).filter((r) => !(which === "slots"  && r.id === id)),
        },
      };
      persist(next, { immediate: true });
      setOpenById((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    },
    [book, persist]
  );

  // ---- Update fields ----
  const changeSpellField = useCallback(
    (categoryKey, id, patch) => {
      const next = {
        ...book,
        [categoryKey]: {
          ...book[categoryKey],
          spells: (book[categoryKey].spells || []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
          slots:  [...(book[categoryKey].slots || [])],
        },
      };
      persist(next); // debounced
    },
    [book, persist]
  );

  const changeSlotField = useCallback(
    (categoryKey, id, patch) => {
      const next = {
        ...book,
        [categoryKey]: {
          ...book[categoryKey],
          spells: [...(book[categoryKey].spells || [])],
          slots:  (book[categoryKey].slots || []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
        },
      };
      persist(next); // debounced
    },
    [book, persist]
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <CategoryCard
        title="Spells"
        categoryKey="spells"
        model={book.spells}
        openById={openById}
        onToggleOpen={toggleOpen}
        onAddSpell={addSpell}
        onAddSlot={addSlot}
        onRemoveRow={removeRow}
        onChangeSpell={changeSpellField}
        onChangeSlot={changeSlotField}
      />

      <CategoryCard
        title="Pact Magic"
        categoryKey="pactmagic"
        model={book.pactmagic}
        openById={openById}
        onToggleOpen={toggleOpen}
        onAddSpell={addSpell}
        onAddSlot={addSlot}
        onRemoveRow={removeRow}
        onChangeSpell={changeSpellField}
        onChangeSlot={changeSlotField}
      />

      <CategoryCard
        title="Innate Spells"
        categoryKey="innate"
        model={book.innate}
        openById={openById}
        onToggleOpen={toggleOpen}
        onAddSpell={addSpell}
        onAddSlot={addSlot}
        onRemoveRow={removeRow}
        onChangeSpell={changeSpellField}
        onChangeSlot={changeSlotField}
      />
    </div>
  );
}
