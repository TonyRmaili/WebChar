import React, { useMemo, useRef, useState, useCallback } from "react";
import useCharStore from "../store/CharStore";

const RESET_OPTIONS = [
  { value: "none",  label: "Passive / None" },
  { value: "short", label: "On Short Rest" },
  { value: "long",  label: "On Long Rest" },
];

const DEFAULT_INVENTORY = {
  magic:   [],   // Array<MagicItem>
  mundane: [],   // Array<MundaneItem>
  currency: { gp: 0, sp: 0, cp: 0, ep: 0, pp: 0 },
};

// ------- Presentational helpers -------
const Chip = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900 text-slate-200 text-xs">
    {children}
  </span>
);

// ------- Magic Item Row -------
const MagicItemRow = React.memo(function MagicItemRow({
  row,
  open,
  onToggleOpen,
  onChange,
  onRemove,
}) {
  const resetLabel =
    RESET_OPTIONS.find(o => o.value === (row.reset || "none"))?.label || "Passive / None";

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
            onChange={(e) => onChange(row.id, { name: e.target.value })}
            placeholder="e.g., Wand of Magic Missiles"
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <div className="hidden md:flex items-center gap-2 px-2">
          <Chip>Amt {row.amount ?? 1}</Chip>
          <Chip>{row.attuned ? "Attuned" : "Not attuned"}</Chip>
          {row.uses_max ? <Chip>Uses {row.uses_max}</Chip> : null}
          <Chip>{resetLabel}</Chip>
        </div>

        <svg
          className={`ml-3 h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="p-3 space-y-3 border-t border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <label className="w-24 text-slate-300 text-sm">Amount</label>
              <input
                type="number" min={0}
                value={row.amount ?? 1}
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Number(e.target.value);
                  if (v !== "" && Number.isNaN(v)) return;
                  onChange(row.id, { amount: v });
                }}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!row.attuned}
                onChange={(e) => onChange(row.id, { attuned: e.target.checked })}
                className="h-4 w-4 accent-orange-500"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-slate-200 text-sm">Attunement</span>
            </label>

            <div className="flex items-center gap-2">
              <label className="w-24 text-slate-300 text-sm">Uses (max)</label>
              <input
                type="number" min={0}
                value={row.uses_max ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Number(e.target.value);
                  if (v !== "" && Number.isNaN(v)) return;
                  onChange(row.id, { uses_max: v });
                }}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="w-24 text-slate-300 text-sm">Resets</label>
              <select
                value={row.reset || "none"}
                onChange={(e) => onChange(row.id, { reset: e.target.value })}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                {RESET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-2">
            <label className="w-full md:w-24 text-slate-300 text-sm md:text-right">
              Notes
            </label>
            <textarea
              value={row.notes ?? ""}
              onChange={(e) => onChange(row.id, { notes: e.target.value })}
              placeholder="Special properties, activation, etc."
              className="flex-1 min-h-[110px] rounded border border-slate-700 bg-white text-slate-900 p-2"
              onClick={(e) => e.stopPropagation()}
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

// ------- Mundane Item Row -------
const MundaneItemRow = React.memo(function MundaneItemRow({
  row,
  open,
  onToggleOpen,
  onChange,
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
            onChange={(e) => onChange(row.id, { name: e.target.value })}
            placeholder="e.g., Arrows"
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <div className="hidden md:flex items-center gap-2 px-2">
          <Chip>Amt {row.amount ?? 1}</Chip>
        </div>

        <svg
          className={`ml-3 h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="p-3 space-y-3 border-t border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <label className="w-24 text-slate-300 text-sm">Amount</label>
              <input
                type="number" min={0}
                value={row.amount ?? 1}
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Number(e.target.value);
                  if (v !== "" && Number.isNaN(v)) return;
                  onChange(row.id, { amount: v });
                }}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="w-24 text-slate-300 text-sm">Notes</label>
              <input
                type="text"
                value={row.notes ?? ""}
                onChange={(e) => onChange(row.id, { notes: e.target.value })}
                placeholder="Weight, where stored, etc."
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
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

// ------- Category Cards -------
const MagicCategoryCard = React.memo(function MagicCategoryCard({
  title,
  items,
  onAdd,
  onRemove,
  onChange,
  openById,
  toggleOpen,
}) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-orange-300">
          {title} {items.length > 0 ? <span className="text-slate-400 text-sm">({items.length})</span> : null}
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
        >
          Add item
        </button>
      </header>

      {items.length === 0 && <p className="text-slate-400 text-sm">No items yet. Click “Add item”.</p>}

      <div className="space-y-3">
        {items.map((row) => (
          <MagicItemRow
            key={row.id}
            row={row}
            open={!!openById[row.id]}
            onToggleOpen={toggleOpen}
            onChange={onChange}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  );
});

const MundaneCategoryCard = React.memo(function MundaneCategoryCard({
  title,
  items,
  onAdd,
  onRemove,
  onChange,
  openById,
  toggleOpen,
}) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-orange-300">
          {title} {items.length > 0 ? <span className="text-slate-400 text-sm">({items.length})</span> : null}
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
        >
          Add item
        </button>
      </header>

      {items.length === 0 && <p className="text-slate-400 text-sm">No items yet. Click “Add item”.</p>}

      <div className="space-y-3">
        {items.map((row) => (
          <MundaneItemRow
            key={row.id}
            row={row}
            open={!!openById[row.id]}
            onToggleOpen={toggleOpen}
            onChange={onChange}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  );
});

// ================= MAIN PAGE =================
export default function Inventory() {
  const { charData, updateCharField, postCharData } = useCharStore();
  if (!charData) return null;

  // Stable default shape
  const inv = useMemo(
    () => ({ ...DEFAULT_INVENTORY, ...(charData.inventory || {}) }),
    [charData?.inventory]
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
      updateCharField("inventory", next);
      if (immediate) postCharData();
      else debouncedPost();
    },
    [updateCharField, postCharData, debouncedPost]
  );

  // ----- MAGIC -----
  const addMagic = useCallback(() => {
    const row = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: "",
      amount: 1,
      attuned: false,
      uses_max: "",
      reset: "none",
      notes: "",
    };
    const next = { ...inv, magic: [...inv.magic, row] };
    persist(next, { immediate: true });
    setOpenById((prev) => ({ ...prev, [row.id]: true }));
  }, [inv, persist]);

  const removeMagic = useCallback((id) => {
    const next = { ...inv, magic: inv.magic.filter((i) => i.id !== id) };
    persist(next, { immediate: true });
    setOpenById((prev) => {
      const c = { ...prev };
      delete c[id];
      return c;
    });
  }, [inv, persist]);

  const changeMagic = useCallback((id, patch) => {
    const next = {
      ...inv,
      magic: inv.magic.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    };
    persist(next); // debounced
  }, [inv, persist]);

  // ----- MUNDANE -----
  const addMundane = useCallback(() => {
    const row = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: "",
      amount: 1,
      notes: "",
    };
    const next = { ...inv, mundane: [...inv.mundane, row] };
    persist(next, { immediate: true });
    setOpenById((prev) => ({ ...prev, [row.id]: true }));
  }, [inv, persist]);

  const removeMundane = useCallback((id) => {
    const next = { ...inv, mundane: inv.mundane.filter((i) => i.id !== id) };
    persist(next, { immediate: true });
    setOpenById((prev) => {
      const c = { ...prev };
      delete c[id];
      return c;
    });
  }, [inv, persist]);

  const changeMundane = useCallback((id, patch) => {
    const next = {
      ...inv,
      mundane: inv.mundane.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    };
    persist(next); // debounced
  }, [inv, persist]);

  // ----- CURRENCY -----
  const currency = inv.currency || DEFAULT_INVENTORY.currency;
  const changeCurrency = (key, raw) => {
    const value = raw === "" ? "" : Number(raw);
    if (value !== "" && Number.isNaN(value)) return;
    const next = { ...inv, currency: { ...currency, [key]: value } };
    persist(next); // debounced while typing
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Magic Items */}
      <MagicCategoryCard
        title="Magic Items"
        items={inv.magic}
        onAdd={addMagic}
        onRemove={removeMagic}
        onChange={changeMagic}
        openById={openById}
        toggleOpen={toggleOpen}
      />

      {/* Mundane Items */}
      <MundaneCategoryCard
        title="Mundane Items"
        items={inv.mundane}
        onAdd={addMundane}
        onRemove={removeMundane}
        onChange={changeMundane}
        openById={openById}
        toggleOpen={toggleOpen}
      />

      {/* Currency */}
      <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-3">
        <header>
          <h3 className="text-lg font-semibold text-orange-300">Currency</h3>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            ["gp", "Gold (gp)"],
            ["sp", "Silver (sp)"],
            ["cp", "Copper (cp)"],
            ["ep", "Electrum (ep)"],
            ["pp", "Platinum (pp)"],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <label className="w-24 text-slate-300 text-sm">{label}</label>
              <input
                type="number"
                min={0}
                value={currency[key] ?? 0}
                onChange={(e) => changeCurrency(key, e.target.value)}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900 w-14"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
