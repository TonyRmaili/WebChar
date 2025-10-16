import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import useCharStore from "../store/CharStore";

/* ---------- Default shape ---------- */
const DEFAULT_LORE = { notes: [] };

/* ---------- Small chip ---------- */
const Chip = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900 text-slate-200 text-xs">
    {children}
  </span>
);

/* ---------- A single lore note row (collapsible) ---------- */
const LoreNoteRow = React.memo(function LoreNoteRow({
  row,
  open,
  onToggleOpen,
  onChangeField,
  onRemove,
}) {
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
          <span className="text-slate-400 text-sm">Title:</span>
          <input
            type="text"
            value={row.title ?? ""}
            onChange={(e) => onChangeField(row.id, { title: e.target.value })}
            placeholder='e.g., "Quest from the tavern"'
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <div className="hidden md:flex items-center gap-2 px-2">
          <Chip>Session {row.session_id ?? "-"}</Chip>
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

      {/* Body */}
      {open && (
        <div className="p-3 space-y-3 border-t border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <label className="w-28 text-slate-300 text-sm">Session ID</label>
              <input
                type="text"
                value={row.session_id ?? ""}
                onChange={(e) => onChangeField(row.id, { session_id: e.target.value })}
                placeholder="e.g., 5"
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="w-28 text-slate-300 text-sm">Date (optional)</label>
              <input
                type="date"
                value={row.date ?? ""}
                onChange={(e) => onChangeField(row.id, { date: e.target.value })}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-2">
            <label className="w-full md:w-28 text-slate-300 text-sm md:text-right">
              Notes
            </label>
            <textarea
              value={row.body ?? ""}
              onChange={(e) => onChangeField(row.id, { body: e.target.value })}
              placeholder="Write your session notes, NPCs, hooks, locations, etc."
              className="flex-1 min-h-[160px] rounded border border-slate-700 bg-white text-slate-900 p-2"
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

/* =================== MAIN PAGE =================== */
export default function Lore() {
  const { charData, updateCharField, postCharData } = useCharStore();

  // Guard
  if (!charData) return null;

  // Ensure `charData.lore` exists once (so we always have a stable object to edit)
  useEffect(() => {
    if (!charData.lore) {
      updateCharField("lore", DEFAULT_LORE);
      postCharData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!charData.lore]);

  // Stable default view from charData
  const lore = useMemo(
    () => ({ ...DEFAULT_LORE, ...(charData.lore || {}) }),
    [charData?.lore]
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
      updateCharField("lore", next);
      if (immediate) postCharData();
      else debouncedPost();
    },
    [updateCharField, postCharData, debouncedPost]
  );

  // Add / Remove / Update
  const addNote = useCallback(() => {
    const row = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: "",
      session_id: "",
      date: "",
      body: "",
    };
    const next = { ...lore, notes: [...(lore.notes || []), row] };
    persist(next, { immediate: true });
    setOpenById((prev) => ({ ...prev, [row.id]: true }));
  }, [lore, persist]);

  const removeNote = useCallback(
    (id) => {
      const next = { ...lore, notes: (lore.notes || []).filter((n) => n.id !== id) };
      persist(next, { immediate: true });
      setOpenById((prev) => {
        const c = { ...prev };
        delete c[id];
        return c;
      });
    },
    [lore, persist]
  );

  const changeNoteField = useCallback(
    (id, patch) => {
      const next = {
        ...lore,
        notes: (lore.notes || []).map((n) => (n.id === id ? { ...n, ...patch } : n)),
      };
      persist(next); // debounced while typing
    },
    [lore, persist]
  );

  const notes = lore.notes || [];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-3">
        <header className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-orange-300">
            Lore Notes {notes.length > 0 ? <span className="text-slate-400 text-sm">({notes.length})</span> : null}
          </h3>
          <button
            type="button"
            onClick={addNote}
            className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
          >
            Add note
          </button>
        </header>

        {notes.length === 0 && (
          <p className="text-slate-400 text-sm">No notes yet. Click “Add note”.</p>
        )}

        <div className="space-y-3">
          {notes.map((row) => (
            <LoreNoteRow
              key={row.id}
              row={row}
              open={!!openById[row.id]}
              onToggleOpen={toggleOpen}
              onChangeField={changeNoteField}
              onRemove={removeNote}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
