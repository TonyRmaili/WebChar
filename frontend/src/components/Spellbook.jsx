import React, { useMemo, useRef, useState, useCallback} from "react";
import useCharStore from "../store/CharStore";

/* ---------------- Defaults ---------------- */
const DEFAULT_SPELLBOOK = {
  spellslots: { slots: [] }, // previously spellcasting.slots
  pactslots: { slots: [] },  // previously pactmagic.slots
  spells: [],                // unified list (slot-based + innate)
  metamagic: [],
  sorcery_points: { max_charges: "", current_charges: "", recharge_short_amount: 0 },
};

const CAST_TIME_UNITS = ["rounds", "minutes", "hours"];
const DURATION_UNITS = ["rounds", "minutes", "hours", "days"];

/* ---------------- UI Bits ---------------- */
const Chip = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900 text-slate-200 text-xs">
    {children}
  </span>
);

/* ---------------- Small helpers ---------------- */
const idGen = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function normalizeSpellRow(r) {
  const base = {
    id: r.id || idGen(),
    name: r.name ?? "",
    level: r.level ?? "",
    school: r.school ?? "",
    notes: r.notes ?? "",
    concentration: !!r.concentration,
    ritual: !!r.ritual,
    // cast time
    cast_time_kind: r.cast_time_kind || "choice", // "choice" | "timed"
    cast_time_choice: r.cast_time_choice || "action",
    cast_time_value: r.cast_time_value ?? "",
    cast_time_unit: r.cast_time_unit || "rounds",
    // duration
    duration_value: r.duration_value ?? "",
    duration_unit: r.duration_unit || "rounds",
    // range
    range_ft: r.range_ft ?? "",
    // components
    components: {
      v: !!(r.components?.v),
      s: !!(r.components?.s),
      m: !!(r.components?.m),
      material_desc: r.components?.material_desc ?? "",
      material_cost: r.components?.material_cost ?? "",
    },
    // unified flags
    prepared: !!r.prepared,   // ignored by pact users in gameplay, still editable here
    innate: !!r.innate,       // if true show charges fields
  };

  if (!base.innate) return base;

  const max = r.max_charges ?? "";
  const cur = r.current_charges ?? max;
  const recharge = Math.max(0, Math.min(Number(r.recharge_short_amount ?? 0), Number(max || 0)));
  return {
    ...base,
    max_charges: max,
    current_charges: cur,
    recharge_short_amount: recharge,
  };
}

/* ---------------- Reusable editors ---------------- */
function CastTimeEditor({ row, onChange, hideChoice = false }) {
  const usingChoice = !hideChoice && row.cast_time_kind === "choice";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {!hideChoice && (
        <div className="flex items-center gap-2">
          <label className="w-28 text-slate-300 text-sm">Cast Time</label>
          <select
            value={usingChoice ? row.cast_time_choice : "timed"}
            onChange={(e) => {
              if (e.target.value === "timed") onChange({ cast_time_kind: "timed" });
              else onChange({ cast_time_kind: "choice", cast_time_choice: e.target.value });
            }}
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
          >
            <option value="action">Action</option>
            <option value="bonus">Bonus Action</option>
            <option value="reaction">Reaction</option>
            <option value="timed">Custom (time)</option>
          </select>
        </div>
      )}
      {(!usingChoice || hideChoice) && (
        <div className="flex items-center gap-2">
          <label className="w-28 text-slate-300 text-sm">{hideChoice ? "Cast Time" : "Time"}</label>
          <input
            type="number"
            min={0}
            value={row.cast_time_value ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0);
              onChange({ cast_time_kind: "timed", cast_time_value: v });
            }}
            className="w-28 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
          />
          <select
            value={row.cast_time_unit || "rounds"}
            onChange={(e) => onChange({ cast_time_unit: e.target.value, cast_time_kind: "timed" })}
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
          >
            {CAST_TIME_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function DurationEditor({ row, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-28 text-slate-300 text-sm">Duration</label>
      <input
        type="number"
        min={0}
        value={row.duration_value ?? ""}
        onChange={(e) => {
          const v = e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0);
          onChange({ duration_value: v });
        }}
        className="w-28 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
      />
      <select
        value={row.duration_unit || "rounds"}
        onChange={(e) => onChange({ duration_unit: e.target.value })}
        className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
      >
        {DURATION_UNITS.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>
    </div>
  );
}

function ComponentsEditor({ row, onChange }) {
  const c = row.components || {};
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="flex items-center gap-4">
        <label className="w-28 text-slate-300 text-sm">Components</label>
        {["v","s","m"].map((k) => (
          <label key={k} className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-orange-500"
              checked={!!c[k]}
              onChange={(e) => onChange({ components: { ...c, [k]: e.target.checked } })}
            />
            <span className="text-slate-200 text-sm">{k.toUpperCase()}</span>
          </label>
        ))}
      </div>

      {c.m && (
        <div className="flex items-center gap-2">
          <label className="w-28 text-slate-300 text-sm">Material</label>
          <input
            type="text"
            value={c.material_desc ?? ""}
            onChange={(e) => onChange({ components: { ...c, material_desc: e.target.value } })}
            placeholder="e.g., diamond dust"
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
          />
          <input
            type="number"
            min={0}
            value={c.material_cost ?? ""}
            onChange={(e) => onChange({ components: { ...c, material_cost: e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0) } })}
            placeholder="gp"
            className="w-24 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
          />
          <span className="text-slate-300 text-sm">gp</span>
        </div>
      )}
    </div>
  );
}

/* ---------------- Slot Row ---------------- */
const SlotRow = React.memo(function SlotRow({ categoryKey, row, onChangeField, onRemove }) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 items-center rounded-lg border border-slate-700 bg-slate-900/60 p-2">
      <div className="flex items-center gap-2 w-full sm:w-1/3">
        <label className="w-20 text-slate-300 text-sm">Level</label>
        <input
          type="number"
          min={0}
          max={9}
          value={row.level ?? ""}
          onChange={(e) => {
            const v = e.target.value === "" ? "" : Number(e.target.value);
            if (v !== "" && Number.isNaN(v)) return;
            onChangeField(categoryKey, row.id, { level: v });
          }}
          className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
        />
      </div>

      <div className="flex items-center gap-2 w-full sm:w-1/3">
        <label className="w-20 text-slate-300 text-sm">Max</label>
        <input
          type="number"
          min={0}
          value={row.slots_max ?? ""}
          onChange={(e) => {
            const v = e.target.value === "" ? "" : Number(e.target.value);
            if (v !== "" && Number.isNaN(v)) return;
            onChangeField(categoryKey, row.id, { slots_max: v });
          }}
          className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
        />
      </div>

      <div className="flex items-center gap-2 w-full sm:w-1/3">
        <label className="w-20 text-slate-300 text-sm">Current</label>
        <input
          type="number"
          min={0}
          value={row.slots_current ?? ""}
          onChange={(e) => {
            const v = e.target.value === "" ? "" : Number(e.target.value);
            if (v !== "" && Number.isNaN(v)) return;
            onChangeField(categoryKey, row.id, { slots_current: v });
          }}
          className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
        />
      </div>

      <div className="w-full sm:w-auto flex justify-end">
        <button
          type="button"
          onClick={() => onRemove(categoryKey, row.id)}
          className="px-3 py-1.5 rounded-lg border border-red-700 bg-red-900/40 hover:bg-red-900/60 text-red-100 transition"
        >
          Remove
        </button>
      </div>
    </div>
  );
});

/* ---------------- Slots Cards (only slots) ---------------- */
const SlotsOnlyCard = React.memo(function SlotsOnlyCard({
  title,
  categoryKey, // "spellslots" | "pactslots"
  model,
  onAddSlot,
  onRemoveRow,
  onChangeSlot,
}) {
  const slots = model.slots || [];
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-orange-300">
          {title} <span className="text-slate-400 text-sm">({slots.length} slot row{slots.length === 1 ? "" : "s"})</span>
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onAddSlot(categoryKey)}
            className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
          >
            Add slots
          </button>
        </div>
      </header>

      <div className="space-y-2">
        <div className="text-slate-300 text-sm font-medium">Spell Slots</div>
        {slots.length === 0 && <p className="text-slate-400 text-sm">No slot rows. Click “Add slots”.</p>}
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
    </section>
  );
});

/* ---------------- Unified Spell Row ---------------- */
const SpellEditorRow = React.memo(function SpellEditorRow({ row, open, onToggleOpen, onChangeField, onRemove }) {
  const isInnate = !!row.innate;
  const clampRecharge = (val, max) => {
    const n = Number.isFinite(val) ? val : 0;
    const hi = Number.isFinite(max) ? max : 0;
    return Math.max(0, Math.min(n, hi));
  };
  const max = Number(row.max_charges ?? 0);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60">
      <button
        type="button"
        onClick={() => onToggleOpen(row.id)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/60"
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-slate-400 text-sm">Name:</span>
          <input
            type="text"
            value={row.name ?? ""}
            onChange={(e) => onChangeField(row.id, { name: e.target.value })}
            placeholder="e.g., Fireball"
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <div className="hidden md:flex items-center gap-2 px-2">
          <Chip>Lvl {row.level ?? "-"}</Chip>
          {isInnate ? <Chip>Innate</Chip> : <Chip>{row.prepared ? "Prepared" : "Unprepared"}</Chip>}
          {row.concentration && <Chip>Concentration</Chip>}
          {row.ritual && <Chip>Ritual</Chip>}
        </div>

        <svg className={`ml-3 h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="p-3 space-y-4 border-t border-slate-700">
          {/* Top line: Level / Prepared-or-Innate / School */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <label className="w-24 text-slate-300 text-sm">Level</label>
              <input
                type="number"
                min={0}
                max={9}
                value={row.level ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Number(e.target.value);
                  if (v !== "" && Number.isNaN(v)) return;
                  onChangeField(row.id, { level: v });
                }}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
              />
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!row.innate}
                onChange={(e) => onChangeField(row.id, { innate: e.target.checked })}
                className="h-4 w-4 accent-orange-500"
              />
              <span className="text-slate-200 text-sm">Innate</span>
            </label>

            {!isInnate && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!row.prepared}
                  onChange={(e) => onChangeField(row.id, { prepared: e.target.checked })}
                  className="h-4 w-4 accent-orange-500"
                />
                <span className="text-slate-200 text-sm">Prepared</span>
              </label>
            )}

            <div className="flex items-center gap-2 sm:col-span-3">
              <label className="w-24 text-slate-300 text-sm">School</label>
              <input
                type="text"
                value={row.school ?? ""}
                onChange={(e) => onChangeField(row.id, { school: e.target.value })}
                placeholder="e.g., Evocation"
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Concentration / Ritual / Range */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!row.concentration}
                onChange={(e) => onChangeField(row.id, { concentration: e.target.checked })}
                className="h-4 w-4 accent-orange-500"
              />
              <span className="text-slate-200 text-sm">Concentration</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!row.ritual}
                onChange={(e) => onChangeField(row.id, { ritual: e.target.checked })}
                className="h-4 w-4 accent-orange-500"
              />
              <span className="text-slate-200 text-sm">Ritual</span>
            </label>

            <div className="flex items-center gap-2">
              <label className="w-24 text-slate-300 text-sm">Range (ft)</label>
              <input
                type="number"
                min={0}
                value={row.range_ft ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0);
                  onChangeField(row.id, { range_ft: v });
                }}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Cast time */}
          <CastTimeEditor row={row} onChange={(patch) => onChangeField(row.id, patch)} />

          {/* Duration */}
          <DurationEditor row={row} onChange={(patch) => onChangeField(row.id, patch)} />

          {/* Components */}
          <ComponentsEditor row={row} onChange={(patch) => onChangeField(row.id, patch)} />

          {/* Innate charges */}
          {isInnate && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <label className="w-28 text-slate-300 text-sm">Max charges</label>
                <input
                  type="number"
                  min={0}
                  value={row.max_charges ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? "" : Number(e.target.value);
                    if (v !== "" && Number.isNaN(v)) return;
                    const clampedRecharge = clampRecharge(Number(row.recharge_short_amount ?? 0), Number(v || 0));
                    const clampedCurrent = Math.max(0, Math.min(Number(row.current_charges ?? 0), Number(v || 0)));
                    onChangeField(row.id, {
                      max_charges: v,
                      recharge_short_amount: clampedRecharge,
                      current_charges: clampedCurrent,
                    });
                  }}
                  className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="w-28 text-slate-300 text-sm">Current</label>
                <input
                  type="number"
                  min={0}
                  value={row.current_charges ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? "" : Number(e.target.value);
                    if (v !== "" && Number.isNaN(v)) return;
                    onChangeField(row.id, {
                      current_charges: v === "" ? "" : Math.max(0, Math.min(v, max)),
                    });
                  }}
                  className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="w-28 text-slate-300 text-sm">Short rest +</label>
                <input
                  type="number"
                  min={0}
                  value={row.recharge_short_amount ?? 0}
                  onChange={(e) => {
                    const raw = e.target.value === "" ? 0 : Number(e.target.value);
                    if (Number.isNaN(raw)) return;
                    onChangeField(row.id, {
                      recharge_short_amount: clampRecharge(raw, max),
                    });
                  }}
                  className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col md:flex-row gap-2">
            <label className="w-full md:w-24 text-slate-300 text-sm md:text-right">Notes</label>
            <textarea
              value={row.notes ?? ""}
              onChange={(e) => onChangeField(row.id, { notes: e.target.value })}
              placeholder="Extra rules text, upcasting notes…"
              className="flex-1 min-h-[110px] rounded border border-slate-700 bg-white text-slate-900 p-2"
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

/* ---------------- Spells Card (unified list) ---------------- */
function SpellsCard({ list, openById, onToggleOpen, onAdd, onChange, onRemove }) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-orange-300">
          Spells <span className="text-slate-400 text-sm">({list.length})</span>
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg border border-indigo-600 bg-indigo-900/40 text-indigo-100"
            // placeholder for future API integration
            onClick={() => {/* no-op for now */}}
          >
            Import Spells
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
          >
            Add spell
          </button>
        </div>
      </header>

      {list.length === 0 && <p className="text-slate-400 text-sm">No spells yet. Click “Add spell”.</p>}

      <div className="space-y-3">
        {list.map((raw) => {
          const row = normalizeSpellRow(raw);
          return (
            <SpellEditorRow
              key={row.id}
              row={row}
              open={!!openById[row.id]}
              onToggleOpen={onToggleOpen}
              onChangeField={(id, patch) => onChange(id, patch)}
              onRemove={onRemove}
            />
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- Metamagic ---------------- */
function MetamagicCard({ list, onAdd, onRemove, onChange }) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-orange-300">
          Metamagic <span className="text-slate-400 text-sm">({list.length})</span>
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
        >
          Add metamagic
        </button>
      </header>

      {list.length === 0 && <p className="text-slate-400 text-sm">No metamagic yet.</p>}

      <div className="space-y-3">
        {list.map((row) => (
          <div key={row.id} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <label className="w-24 text-slate-300 text-sm">Name</label>
              <input
                type="text"
                value={row.name ?? ""}
                onChange={(e) => onChange(row.id, { name: e.target.value })}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
              />
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <label className="w-full md:w-24 text-slate-300 text-sm md:text-right">Description</label>
              <textarea
                value={row.description ?? ""}
                onChange={(e) => onChange(row.id, { description: e.target.value })}
                className="flex-1 min-h-[110px] rounded border border-slate-700 bg-white text-slate-900 p-2"
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
        ))}
      </div>
    </section>
  );
}

/* ---------------- Sorcery Points ---------------- */
function SorceryPointsCard({ model, onChange }) {
  const max = Number(model.max_charges || 0);
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-4">
      <header>
        <h3 className="text-lg font-semibold text-orange-300">Sorcery Points</h3>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-2">
          <label className="w-28 text-slate-300 text-sm">Max</label>
          <input
            type="number"
            min={0}
            value={model.max_charges ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0);
              const cur = Math.min(Number(model.current_charges || 0), Number(v || 0));
              const recharge = Math.min(Number(model.recharge_short_amount || 0), Number(v || 0));
              onChange({ max_charges: v, current_charges: cur, recharge_short_amount: recharge });
            }}
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-28 text-slate-300 text-sm">Current</label>
          <input
            type="number"
            min={0}
            value={model.current_charges ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? "" : Math.max(0, Math.min(Number(e.target.value) || 0, max));
              onChange({ current_charges: v });
            }}
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-28 text-slate-300 text-sm">Short rest +</label>
          <input
            type="number"
            min={0}
            value={model.recharge_short_amount ?? 0}
            onChange={(e) => {
              const v = e.target.value === "" ? 0 : Math.max(0, Math.min(Number(e.target.value) || 0, max));
              onChange({ recharge_short_amount: v });
            }}
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
          />
        </div>
      </div>
    </section>
  );
}

/* ---------------- Main ---------------- */
export default function Spellbook() {
  const { charData, updateCharField, postCharData } = useCharStore();
  if (!charData) return null;

  
  // Normalize + migrate legacy -> new shape
  const book = useMemo(() => {
    const raw = charData.spellbook || {};
    const mapped = { ...DEFAULT_SPELLBOOK, ...(raw || {}) };

    // migrate legacy slots
    const normSlots = (arr) =>
      (arr || []).map((r) => ({
        id: r.id || idGen(),
        level: r.level ?? "",
        slots_max: r.slots_max ?? "",
        slots_current: r.slots_current ?? r.slots_max ?? "",
      }));

    // if legacy spellcasting/pactmagic exist, pull their slots
    if (raw.spellcasting?.slots && !mapped.spellslots?.slots?.length) {
      mapped.spellslots = { slots: normSlots(raw.spellcasting.slots) };
    } else {
      mapped.spellslots = { slots: normSlots(mapped.spellslots?.slots || []) };
    }
    if (raw.pactmagic?.slots && !mapped.pactslots?.slots?.length) {
      mapped.pactslots = { slots: normSlots(raw.pactmagic.slots) };
    } else {
      mapped.pactslots = { slots: normSlots(mapped.pactslots?.slots || []) };
    }

    // unify spells: gather from legacy spellcasting.spells, pactmagic.spells, innate.spells, plus any existing mapped.spells
    const legacySpellLists = [
      ...(raw.spellcasting?.spells || []).map((s) => ({ ...s, innate: false })),
      ...(raw.pactmagic?.spells || []).map((s) => ({ ...s, innate: false })),
      ...(raw.innate?.spells || []).map((s) => ({ ...s, innate: true })),
    ];
    const existingUnified = mapped.spells || [];
    const unified = [...existingUnified, ...legacySpellLists].map(normalizeSpellRow);

    // dedupe by id (keep first)
    const seen = new Set();
    const deduped = unified.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

    mapped.spells = deduped;

    // metamagic
    mapped.metamagic = (mapped.metamagic || []).map((m) => ({
      id: m.id || idGen(),
      name: m.name ?? "",
      description: m.description ?? "",
    }));

    // sorcery points
    mapped.sorcery_points = {
      max_charges: mapped.sorcery_points?.max_charges ?? "",
      current_charges: mapped.sorcery_points?.current_charges ?? (mapped.sorcery_points?.max_charges ?? ""),
      recharge_short_amount: Math.max(
        0,
        Math.min(
          Number(mapped.sorcery_points?.recharge_short_amount ?? 0),
          Number(mapped.sorcery_points?.max_charges ?? 0) || 0
        )
      ),
    };

    return mapped;
  }, [charData?.spellbook]);

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
      updateCharField("spellbook", next);
      if (immediate) postCharData();
      else debouncedPost();
    },
    [updateCharField, postCharData, debouncedPost]
  );

  /* ----- Slots add/remove/update ----- */
  const addSlot = useCallback(
    (categoryKey /* 'spellslots' | 'pactslots' */) => {
      const row = { id: idGen(), level: "", slots_max: "", slots_current: "" };
      const next = {
        ...book,
        [categoryKey]: {
          slots: [...(book[categoryKey]?.slots || []), row],
        },
      };
      persist(next, { immediate: true });
    },
    [book, persist]
  );

  const removeSlotRow = useCallback(
    (categoryKey, id) => {
      const next = {
        ...book,
        [categoryKey]: {
          slots: (book[categoryKey]?.slots || []).filter((r) => r.id !== id),
        },
      };
      persist(next, { immediate: true });
    },
    [book, persist]
  );

  const changeSlotField = useCallback(
    (categoryKey, id, patch) => {
      const next = {
        ...book,
        [categoryKey]: {
          slots: (book[categoryKey]?.slots || []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
        },
      };
      persist(next);
    },
    [book, persist]
  );

  /* ----- Spells add/remove/update ----- */
  const addSpell = useCallback(() => {
    const row = normalizeSpellRow({
      name: "",
      level: "",
      school: "",
      notes: "",
      prepared: false,
      innate: false,
    });
    const next = { ...book, spells: [...(book.spells || []), row] };
    persist(next, { immediate: true });
    setOpenById((prev) => ({ ...prev, [row.id]: true }));
  }, [book, persist]);

  const removeSpell = useCallback(
    (id) => {
      const next = { ...book, spells: (book.spells || []).filter((r) => r.id !== id) };
      persist(next, { immediate: true });
      setOpenById((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    },
    [book, persist]
  );

  const changeSpellField = useCallback(
    (id, patch) => {
      const next = {
        ...book,
        spells: (book.spells || []).map((r) => (r.id === id ? normalizeSpellRow({ ...r, ...patch }) : r)),
      };
      persist(next);
    },
    [book, persist]
  );

  /* ----- Metamagic CRUD ----- */
  const addMetamagic = useCallback(() => {
    const row = { id: idGen(), name: "", description: "" };
    const next = { ...book, metamagic: [...(book.metamagic || []), row] };
    persist(next, { immediate: true });
  }, [book, persist]);

  const removeMetamagic = useCallback((id) => {
    const next = { ...book, metamagic: (book.metamagic || []).filter((m) => m.id !== id) };
    persist(next, { immediate: true });
  }, [book, persist]);

  const changeMetamagic = useCallback((id, patch) => {
    const next = {
      ...book,
      metamagic: (book.metamagic || []).map((m) => (m.id === id ? { ...m, ...patch } : m)),
    };
    persist(next);
  }, [book, persist]);

  /* ----- Sorcery Points update ----- */
  const changeSorcery = useCallback((patch) => {
    const next = { ...book, sorcery_points: { ...book.sorcery_points, ...patch } };
    persist(next);
  }, [book, persist]);




  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Slots-only cards */}
      <SlotsOnlyCard
        title="Spellcasting"
        categoryKey="spellslots"
        model={book.spellslots}
        onAddSlot={addSlot}
        onRemoveRow={removeSlotRow}
        onChangeSlot={changeSlotField}
      />

      <SlotsOnlyCard
        title="Pact Magic"
        categoryKey="pactslots"
        model={book.pactslots}
        onAddSlot={addSlot}
        onRemoveRow={removeSlotRow}
        onChangeSlot={changeSlotField}
      />

      {/* Unified spells */}
      <SpellsCard
        list={book.spells || []}
        openById={openById}
        onToggleOpen={toggleOpen}
        onAdd={addSpell}
        onChange={changeSpellField}
        onRemove={removeSpell}
      />

      <MetamagicCard
        list={book.metamagic || []}
        onAdd={addMetamagic}
        onRemove={removeMetamagic}
        onChange={changeMetamagic}
      />

      <SorceryPointsCard
        model={book.sorcery_points || { max_charges: "", current_charges: "", recharge_short_amount: 0 }}
        onChange={changeSorcery}
      />
    </div>
  );
}
