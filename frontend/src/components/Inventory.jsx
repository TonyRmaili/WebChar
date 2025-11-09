import React, {
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";
import useCharStore from "../store/CharStore";

const DEFAULT_INVENTORY = {
  magic: [],
  mundane: [],
  currency: { gp: 0, sp: 0, cp: 0, ep: 0, pp: 0 },
  max_attunment: 0,
};

const Chip = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900 text-slate-200 text-xs">
    {children}
  </span>
);

/* ---------------- Magic Item Row ---------------- */
const MagicItemRow = React.memo(function MagicItemRow({
  row,
  open,
  onToggleOpen,
  onChange,
  onRemove,
}) {
  const charges = row.charges ?? {
    has: false,
    max_charges: 0,
    reset_amount: "full",
    current_charges: 0,
  };
  const hasCharges = !!charges.has;
  const disable = !hasCharges;
  const resetAmountMode =
    typeof charges.reset_amount === "string" ? "full" : "number";
  const resetAmountNumber =
    typeof charges.reset_amount === "number" ? charges.reset_amount : 0;

  const patch = (patchObj) => onChange(row.id, patchObj);
  const patchCharges = (patchObj) =>
    onChange(row.id, { charges: { ...charges, ...patchObj } });

  const handleToggleHas = (checked) => {
    if (!checked) {
      patch({
        charges: {
          has: false,
          max_charges: 0,
          reset_amount: "full",
          current_charges: 0,
        },
      });
    } else {
      const max = Number(charges.max_charges) || 1;
      patch({
        charges: {
          has: true,
          max_charges: max,
          reset_amount: charges.reset_amount ?? "full",
          current_charges: max,
        },
      });
    }
  };

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
            <input
              type="text"
              value={row.name ?? ""}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Wand of Magic Missiles"
              className="w-full min-w-0 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink min-w-[220px]">
            <Chip>Amt {row.amount ?? 1}</Chip>
            <Chip>{row.attuned ? "Attuned" : "Not attuned"}</Chip>
            {hasCharges ? (
              <Chip>
                {charges.current_charges}/{charges.max_charges}
              </Chip>
            ) : null}
          </div>

          <svg
            className={`ml-auto h-5 w-5 transition-transform ${
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
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="p-3 space-y-3 border-t border-slate-700">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-400">Amount</label>
              <input
                type="number"
                min={0}
                value={row.amount ?? 1}
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Number(e.target.value);
                  if (v !== "" && Number.isNaN(v)) return;
                  patch({ amount: v });
                }}
                className="w-24 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!row.attuned}
                onChange={(e) => patch({ attuned: e.target.checked })}
                className="h-4 w-4 accent-orange-500"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-xs text-slate-200">Attunement</span>
            </label>

            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={hasCharges}
                onChange={(e) => handleToggleHas(e.target.checked)}
                className="h-4 w-4 accent-orange-400"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-xs text-slate-200">Has charges</span>
            </label>

            {hasCharges ? (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    patchCharges({ current_charges: charges.max_charges });
                  }}
                  className="px-2 py-1 rounded border border-slate-600 bg-slate-900 hover:bg-slate-800 text-xs"
                >
                  Refill
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    patchCharges({
                      current_charges: Math.max(
                        0,
                        Math.min(
                          charges.max_charges,
                          (charges.current_charges ?? 0) - 1
                        )
                      ),
                    });
                  }}
                  className="px-2 py-1 rounded border border-slate-600 bg-slate-900 hover:bg-slate-800 text-xs"
                >
                  Spend 1
                </button>
              </div>
            ) : null}
          </div>

          {hasCharges && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col">
                <label className="text-[10px] text-slate-400">Max</label>
                <input
                  type="number"
                  min={0}
                  value={charges.max_charges ?? 0}
                  onChange={(e) => {
                    const v = e.target.value === "" ? 0 : Number(e.target.value);
                    if (Number.isNaN(v)) return;
                    const max = Math.max(0, v);
                    patchCharges({
                      max_charges: max,
                      current_charges: max,
                    });
                  }}
                  className="w-24 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">
                    Recharge mode
                  </label>
                  <select
                    value={resetAmountMode}
                    disabled={disable}
                    onChange={(e) =>
                      patchCharges({
                        reset_amount:
                          e.target.value === "full" ? "full" : 0,
                      })
                    }
                    className="w-24 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="full">Full</option>
                    <option value="number">Number</option>
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-slate-400">
                    Recharge number
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={resetAmountNumber}
                    disabled={resetAmountMode !== "number"}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v))
                        patchCharges({
                          reset_amount: Math.max(0, Math.trunc(v)),
                        });
                    }}
                    className={`w-32 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900 ${
                      resetAmountMode !== "number"
                        ? "opacity-60 cursor-not-allowed"
                        : ""
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col">
            <label className="text-[10px] text-slate-400">Notes</label>
            <textarea
              value={row.notes ?? ""}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="Special properties, activation, etc."
              className="min-h-[80px] rounded border border-slate-700 bg-white text-slate-900 p-2 max-w-[40rem]"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onRemove(row.id)}
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

/* ---------------- Mundane Item Row ---------------- */
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
        className="w-full px-3 py-2 hover:bg-slate-800/60"
        aria-expanded={open}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 min-w-[220px] max-w-[520px] grow">
            
            <input
              type="text"
              value={row.name ?? ""}
              onChange={(e) => onChange(row.id, { name: e.target.value })}
              placeholder="Arrows"
              className="w-full min-w-0 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="hidden md:flex items-center gap-2 px-2">
            <Chip>Amt {row.amount ?? 1}</Chip>
            {row.consumed ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-amber-700 bg-amber-900/30 text-amber-200 text-xs">
                Consumed
              </span>
            ) : null}
          </div>

          <svg
            className={`ml-auto h-5 w-5 transition-transform ${
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
        </div>
      </button>

      {open && (
        <div className="p-3 space-y-3 border-t border-slate-700">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <label className="text-[10px] text-slate-400">Amount</label>
              <input
                type="number"
                min={0}
                value={row.amount ?? 1}
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Number(e.target.value);
                  if (v !== "" && Number.isNaN(v)) return;
                  onChange(row.id, { amount: v });
                }}
                className="w-24 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="flex flex-col grow max-w-[28rem]">
              <label className="text-[10px] text-slate-400">Notes</label>
              <input
                type="text"
                value={row.notes ?? ""}
                onChange={(e) => onChange(row.id, { notes: e.target.value })}
                placeholder="Weight, where stored, etc."
                className="px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!row.consumed}
                onChange={(e) =>
                  onChange(row.id, { consumed: e.target.checked })
                }
                className="h-4 w-4 accent-orange-500"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-xs text-slate-200">Consumed</span>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onRemove(row.id)}
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

/* ---------------- Magic Category Card (Attuned / Not attuned) ---------------- */
const MagicCategoryCard = React.memo(function MagicCategoryCard({
  title,
  items,
  onAdd,
  onRemove,
  onChange,
  openById,
  toggleOpen,
  maxAttunement,
  onChangeMaxAttunement,
}) {
  const [collapsedGroups, setCollapsedGroups] = useState({
    attuned: false,
    notAttuned: false,
  });

  const toggleGroup = (key) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const attunedItems = items.filter((i) => i.attuned);
  const notAttunedItems = items.filter((i) => !i.attuned);
  const attunedCount = attunedItems.length;

  const Chevron = ({ collapsed }) => (
    <svg
      className={`h-3 w-3 transition-transform ${
        collapsed ? "-rotate-90" : "rotate-0"
      }`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01-.02-1.06L10.94 10 7.2 6.29a.75.75 0 111.06-1.06l4.24 4.24a.75.75 0 010 1.06l-4.24 4.24a.75.75 0 01-1.06 0z"
        clipRule="evenodd"
      />
    </svg>
  );

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-orange-300">
            {title}{" "}
            {items.length > 0 ? (
              <span className="text-slate-400 text-sm">({items.length})</span>
            ) : null}
          </h3>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>Attuned:</span>
            <span className="text-amber-300 font-semibold">
              {attunedCount}
              {maxAttunement ? ` / ${maxAttunement}` : ""}
            </span>
            <input
              type="number"
              min={0}
              value={maxAttunement ?? ""}
              onChange={(e) => onChangeMaxAttunement(e.target.value)}
              className="w-16 px-2 py-1 rounded border border-slate-600 bg-slate-900 text-slate-100 text-xs"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition text-sm"
        >
          Add item
        </button>
      </header>

      {items.length === 0 && (
        <p className="text-slate-400 text-sm">
          No items yet. Click “Add item”.
        </p>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {/* Attuned */}
          {attunedItems.length > 0 && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => toggleGroup("attuned")}
                className="flex items-center gap-2 text-xs text-slate-300 hover:text-slate-100"
              >
                <span>Attuned</span>
                <span className="text-[10px] text-slate-400">
                  ({attunedItems.length})
                </span>
                <Chevron collapsed={collapsedGroups.attuned} />
              </button>

              {!collapsedGroups.attuned &&
                attunedItems.map((row) => (
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
          )}

          {/* Not attuned */}
          {notAttunedItems.length > 0 && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => toggleGroup("notAttuned")}
                className="flex items-center gap-2 text-xs text-slate-300 hover:text-slate-100"
              >
                <span>Not attuned</span>
                <span className="text-[10px] text-slate-400">
                  ({notAttunedItems.length})
                </span>
                <Chevron collapsed={collapsedGroups.notAttuned} />
              </button>

              {!collapsedGroups.notAttuned &&
                notAttunedItems.map((row) => (
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
          )}
        </div>
      )}
    </section>
  );
});

/* ---------------- Mundane Category Card (Available / Consumed) ---------------- */
const MundaneCategoryCard = React.memo(function MundaneCategoryCard({
  title,
  items,
  onAdd,
  onRemove,
  onChange,
  openById,
  toggleOpen,
}) {
  const [collapsedGroups, setCollapsedGroups] = useState({
    available: false,
    consumed: false,
  });

  const toggleGroup = (key) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const availableItems = items.filter((i) => !i.consumed);
  const consumedItems = items.filter((i) => i.consumed);

  const Chevron = ({ collapsed }) => (
    <svg
      className={`h-3 w-3 transition-transform ${
        collapsed ? "-rotate-90" : "rotate-0"
      }`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01-.02-1.06L10.94 10 7.2 6.29a.75.75 0 111.06-1.06l4.24 4.24a.75.75 0 010 1.06l-4.24 4.24a.75.75 0 01-1.06 0z"
        clipRule="evenodd"
      />
    </svg>
  );

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-orange-300">
          {title}{" "}
          {items.length > 0 ? (
            <span className="text-slate-400 text-sm">({items.length})</span>
          ) : null}
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
        >
          Add item
        </button>
      </header>

      {items.length === 0 && (
        <p className="text-slate-400 text-sm">
          No items yet. Click “Add item”.
        </p>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {/* Available */}
          {availableItems.length > 0 && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => toggleGroup("available")}
                className="flex items-center gap-2 text-xs text-slate-300 hover:text-slate-100"
              >
                <span>Available</span>
                <span className="text-[10px] text-slate-400">
                  ({availableItems.length})
                </span>
                <Chevron collapsed={collapsedGroups.available} />
              </button>

              {!collapsedGroups.available &&
                availableItems.map((row) => (
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
          )}

          {/* Consumed */}
          {consumedItems.length > 0 && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => toggleGroup("consumed")}
                className="flex items-center gap-2 text-xs text-slate-300 hover:text-slate-100"
              >
                <span>Consumed</span>
                <span className="text-[10px] text-slate-400">
                  ({consumedItems.length})
                </span>
                <Chevron collapsed={collapsedGroups.consumed} />
              </button>

              {!collapsedGroups.consumed &&
                consumedItems.map((row) => (
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
          )}
        </div>
      )}
    </section>
  );
});

/* ---------------- MAIN ---------------- */
export default function Inventory() {
  const { charData, updateCharField, postCharData } = useCharStore();
  if (!charData) return null;

  const inv = useMemo(() => {
    const raw = charData.inventory || {};
    const base = { ...DEFAULT_INVENTORY, ...raw };

    const maxAtt =
      base.max_attunment === "" || base.max_attunment == null
        ? 0
        : Number(base.max_attunment) || 0;

    return {
      ...base,
      currency: { ...DEFAULT_INVENTORY.currency, ...(base.currency || {}) },
      max_attunment: maxAtt,
    };
  }, [charData?.inventory]);

  const [openById, setOpenById] = useState({});
  const toggleOpen = useCallback(
    (id) => setOpenById((p) => ({ ...p, [id]: !p[id] })),
    []
  );

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

  // Seed missing current_charges for magic items
  useEffect(() => {
    let changed = false;
    const nextMagic = (inv.magic || []).map((m) => {
      const c = m?.charges;
      if (!c?.has) return m;
      const max = Number(c.max_charges);
      const cur = Number(c.current_charges);
      const hasMax = Number.isFinite(max) && max >= 0;
      const hasCur = Number.isFinite(cur);
      if (hasMax && !hasCur) {
        changed = true;
        return { ...m, charges: { ...c, current_charges: max } };
      }
      return m;
    });
    if (changed) {
      persist({ ...inv, magic: nextMagic }, { immediate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv.magic]);

  /* ---- max_attunment setter ---- */
  const setMaxAttunement = useCallback(
    (val) => {
      const n = val === "" ? "" : Math.max(0, Number(val) || 0);
      const next = { ...inv, max_attunment: n };
      persist(next, { immediate: true });
    },
    [inv, persist]
  );

  /* ---- Magic ---- */
  const addMagic = useCallback(() => {
    const row = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: "",
      amount: 1,
      attuned: false,
      notes: "",
      charges: {
        has: false,
        max_charges: 0,
        reset_amount: "full",
        current_charges: 0,
      },
    };
    const next = { ...inv, magic: [...inv.magic, row] };
    persist(next, { immediate: true });
    setOpenById((p) => ({ ...p, [row.id]: true }));
  }, [inv, persist]);

  const removeMagic = useCallback(
    (id) => {
      const next = { ...inv, magic: inv.magic.filter((i) => i.id !== id) };
      persist(next, { immediate: true });
      setOpenById((p) => {
        const c = { ...p };
        delete c[id];
        return c;
      });
    },
    [inv, persist]
  );

  const changeMagic = useCallback(
    (id, patch) => {
      const prevMagic = inv.magic || [];
      const nextMagic = prevMagic.map((i) =>
        i.id === id ? { ...i, ...patch } : i
      );

      if ("attuned" in patch) {
        const cap = Number(inv.max_attunment ?? 0) || 0;
        if (cap > 0) {
          const attunedCount = nextMagic.reduce(
            (acc, i) => acc + (i.attuned ? 1 : 0),
            0
          );
          if (attunedCount > cap) {
            return; // reject change
          }
        }
      }

      const next = { ...inv, magic: nextMagic };
      persist(next);
    },
    [inv, persist]
  );

  /* ---- Mundane ---- */
  const addMundane = useCallback(() => {
    const row = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: "",
      amount: 1,
      notes: "",
      consumed: false,
    };
    const next = { ...inv, mundane: [...inv.mundane, row] };
    persist(next, { immediate: true });
    setOpenById((p) => ({ ...p, [row.id]: true }));
  }, [inv, persist]);

  const removeMundane = useCallback(
    (id) => {
      const next = { ...inv, mundane: inv.mundane.filter((i) => i.id !== id) };
      persist(next, { immediate: true });
      setOpenById((p) => {
        const c = { ...p };
        delete c[id];
        return c;
      });
    },
    [inv, persist]
  );

  const changeMundane = useCallback(
    (id, patch) => {
      const next = {
        ...inv,
        mundane: inv.mundane.map((i) =>
          i.id === id ? { ...i, ...patch } : i
        ),
      };
      persist(next);
    },
    [inv, persist]
  );

  /* ---- Currency ---- */
  const currency = inv.currency || DEFAULT_INVENTORY.currency;
  const changeCurrency = (key, raw) => {
    const value = raw === "" ? "" : Number(raw);
    if (value !== "" && Number.isNaN(value)) return;
    const next = { ...inv, currency: { ...currency, [key]: value } };
    persist(next);
  };

  const [currencyKey, setCurrencyKey] = useState("gp");
  const [currencyDelta, setCurrencyDelta] = useState("");

  const applyCurrencyChange = (sign) => {
    const amt =
      currencyDelta === "" ? NaN : Number(currencyDelta);
    if (!Number.isFinite(amt) || amt <= 0) return;
    const current = Number(currency[currencyKey] ?? 0) || 0;
    const nextAmount =
      sign > 0 ? current + amt : Math.max(0, current - amt);
    const next = {
      ...inv,
      currency: { ...currency, [currencyKey]: nextAmount },
    };
    persist(next, { immediate: true });
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <MagicCategoryCard
        title="Magic Items"
        items={inv.magic}
        onAdd={addMagic}
        onRemove={removeMagic}
        onChange={changeMagic}
        openById={openById}
        toggleOpen={toggleOpen}
        maxAttunement={inv.max_attunment}
        onChangeMaxAttunement={setMaxAttunement}
      />

      <MundaneCategoryCard
        title="Mundane Items"
        items={inv.mundane}
        onAdd={addMundane}
        onRemove={removeMundane}
        onChange={changeMundane}
        openById={openById}
        toggleOpen={toggleOpen}
      />

      <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-3">
        <header>
          <h3 className="text-lg font-semibold text-orange-300">Currency</h3>
        </header>

        {/* Current totals (direct editable as before) */}
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
                className="w-full min-w-0 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
              />
            </div>
          ))}
        </div>

        {/* Transaction controls: Add / Spend */}
        <div className="mt-3 border-t border-slate-700 pt-3 space-y-2">
          <p className="text-xs text-slate-300">Adjust currency</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={currencyKey}
              onChange={(e) => setCurrencyKey(e.target.value)}
              className="px-2 py-1 rounded border border-slate-700 bg-slate-900 text-slate-100 text-sm"
            >
              <option value="gp">Gold (gp)</option>
              <option value="sp">Silver (sp)</option>
              <option value="cp">Copper (cp)</option>
              <option value="ep">Electrum (ep)</option>
              <option value="pp">Platinum (pp)</option>
            </select>

            <input
              type="number"
              min={0}
              value={currencyDelta}
              onChange={(e) => setCurrencyDelta(e.target.value)}
              placeholder="Amount"
              className="w-24 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900 text-sm"
            />

            <button
              type="button"
              onClick={() => applyCurrencyChange(1)}
              className="px-3 py-1 rounded-lg border border-emerald-700 bg-emerald-900/50 hover:bg-emerald-900 text-emerald-100 text-sm"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => applyCurrencyChange(-1)}
              className="px-3 py-1 rounded-lg border border-red-700 bg-red-900/40 hover:bg-red-900/60 text-red-100 text-sm"
            >
              Spend
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
