import React, { useMemo, useRef, useState, useCallback } from "react";
import useCharStore from "../store/CharStore";

/* ---------------- Defaults ---------------- */
const DEFAULT_SPELLBOOK = {
  spellcasting: { spells: [], slots: [] },
  pactmagic: { spells: [], slots: [] },
  innate: { spells: [] }, // no slots here
  metamagic: [],          // [{id, name, description}]
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

function normalizeSpellRow(r, { slotBased = true } = {}) {
  // Shared fields for both slot-based and innate
  const base = {
    id: r.id || idGen(),
    name: r.name ?? "",
    level: r.level ?? "",
    school: r.school ?? "",
    notes: r.notes ?? "",
    concentration: !!r.concentration,
    ritual: !!r.ritual,
    // cast time: choice or numeric+unit
    cast_time_kind: r.cast_time_kind || "choice", // "choice" | "timed"
    cast_time_choice: r.cast_time_choice || "action", // "action" | "bonus" | "reaction"
    cast_time_value: r.cast_time_value ?? "",
    cast_time_unit: r.cast_time_unit || "rounds",
    // duration: numeric + unit
    duration_value: r.duration_value ?? "",
    duration_unit: r.duration_unit || "rounds",
    // range in ft
    range_ft: r.range_ft ?? "",
    // components
    components: {
      v: !!(r.components?.v),
      s: !!(r.components?.s),
      m: !!(r.components?.m),
      material_desc: r.components?.material_desc ?? "",
      material_cost: r.components?.material_cost ?? "",
    },
  };

  if (slotBased) {
    return {
      ...base,
      prepared: !!r.prepared, // ignored for pactmagic in UI
    };
  }

  // Innate adds charges-like fields
  return {
    ...base,
    max_charges: r.max_charges ?? "",
    current_charges: r.current_charges ?? (r.max_charges ?? ""),
    recharge_short_amount: Math.max(
      0,
      Math.min(Number(r.recharge_short_amount ?? 0), Number(r.max_charges ?? 0) || 0)
    ),
  };
}

/* ---------------- Reusable fields: Cast time, Duration, Components ---------------- */
function CastTimeEditor({ row, onChange, hideChoice = false }) {
  // hideChoice=true if you ever need to force numeric; otherwise let the user choose
  const usingChoice = !hideChoice && row.cast_time_kind === "choice";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {!hideChoice && (
        <div className="flex items-center gap-2">
          <label className="w-28 text-slate-300 text-sm">Cast Time</label>
          <select
            value={usingChoice ? row.cast_time_choice : "timed"}
            onChange={(e) => {
              if (e.target.value === "timed") {
                onChange({ cast_time_kind: "timed" });
              } else {
                onChange({ cast_time_kind: "choice", cast_time_choice: e.target.value });
              }
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
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-orange-500"
            checked={!!c.v}
            onChange={(e) => onChange({ components: { ...c, v: e.target.checked } })}
          />
          <span className="text-slate-200 text-sm">V</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-orange-500"
            checked={!!c.s}
            onChange={(e) => onChange({ components: { ...c, s: e.target.checked } })}
          />
          <span className="text-slate-200 text-sm">S</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-orange-500"
            checked={!!c.m}
            onChange={(e) => onChange({ components: { ...c, m: e.target.checked } })}
          />
          <span className="text-slate-200 text-sm">M</span>
        </label>
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

/* ---------------- Slot-based Spell Row ---------------- */
const SpellRowSlotBased = React.memo(function SpellRowSlotBased({
  categoryKey, // "spellcasting" | "pactmagic"
  row,
  open,
  onToggleOpen,
  onChangeField,
  onRemove,
}) {
  const isPact = categoryKey === "pactmagic";

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
          {!isPact && <Chip>{row.prepared ? "Prepared" : "Unprepared"}</Chip>}
          {row.concentration && <Chip>Concentration</Chip>}
          {row.ritual && <Chip>Ritual</Chip>}
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

      {open && (
        <div className="p-3 space-y-4 border-t border-slate-700">
          {/* Top line: Level / Prepared (hidden for pact) / School */}
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
                  onChangeField(categoryKey, row.id, { level: v });
                }}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {!isPact && (
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
            )}

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

          {/* Concentration / Ritual / Range */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!row.concentration}
                onChange={(e) => onChangeField(categoryKey, row.id, { concentration: e.target.checked })}
                className="h-4 w-4 accent-orange-500"
              />
              <span className="text-slate-200 text-sm">Concentration</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!row.ritual}
                onChange={(e) => onChangeField(categoryKey, row.id, { ritual: e.target.checked })}
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
                  onChangeField(categoryKey, row.id, { range_ft: v });
                }}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Cast time */}
          <CastTimeEditor
            row={row}
            onChange={(patch) => onChangeField(categoryKey, row.id, patch)}
          />

          {/* Duration */}
          <DurationEditor
            row={row}
            onChange={(patch) => onChangeField(categoryKey, row.id, patch)}
          />

          {/* Components */}
          <ComponentsEditor
            row={row}
            onChange={(patch) => onChangeField(categoryKey, row.id, patch)}
          />

          {/* Notes */}
          <div className="flex flex-col md:flex-row gap-2">
            <label className="w-full md:w-24 text-slate-300 text-sm md:text-right">Notes</label>
            <textarea
              value={row.notes ?? ""}
              onChange={(e) => onChangeField(categoryKey, row.id, { notes: e.target.value })}
              placeholder="Extra rules text, riders, upcasting notes…"
              className="flex-1 min-h-[110px] rounded border border-slate-700 bg-white text-slate-900 p-2"
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

/* ---------------- Innate Spell Row ---------------- */
const SpellRowInnate = React.memo(function SpellRowInnate({
  categoryKey,
  row,
  open,
  onToggleOpen,
  onChangeField,
  onRemove,
}) {
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
        <div className="flex-1 flex items-center gap-2">
          <span className="text-slate-400 text-sm">Name:</span>
          <input
            type="text"
            value={row.name ?? ""}
            onChange={(e) => onChangeField(categoryKey, row.id, { name: e.target.value })}
            placeholder="e.g., Mage Armor"
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <div className="hidden md:flex items-center gap-2 px-2">
          <Chip>Lvl {row.level ?? "-"}</Chip>
          <Chip>Innate</Chip>
          {row.concentration && <Chip>Concentration</Chip>}
          {row.ritual && <Chip>Ritual</Chip>}
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

      {open && (
        <div className="p-3 space-y-4 border-t border-slate-700">
          {/* Level / charges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <label className="w-28 text-slate-300 text-sm">Level</label>
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

            <div className="flex items-center gap-2">
              <label className="w-28 text-slate-300 text-sm">Max charges</label>
              <input
                type="number"
                min={0}
                value={row.max_charges ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Number(e.target.value);
                  if (v !== "" && Number.isNaN(v)) return;
                  const clampedRecharge = clampRecharge(
                    Number(row.recharge_short_amount ?? 0),
                    Number(v || 0)
                  );
                  const clampedCurrent = Math.max(
                    0,
                    Math.min(Number(row.current_charges ?? 0), Number(v || 0))
                  );
                  onChangeField(categoryKey, row.id, {
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
                  onChangeField(categoryKey, row.id, {
                    current_charges: v === "" ? "" : Math.max(0, Math.min(v, max)),
                  });
                }}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Short rest recharge amount */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <label className="w-28 text-slate-300 text-sm">Short rest +</label>
              <input
                type="number"
                min={0}
                value={row.recharge_short_amount ?? 0}
                onChange={(e) => {
                  const raw = e.target.value === "" ? 0 : Number(e.target.value);
                  if (Number.isNaN(raw)) return;
                  onChangeField(categoryKey, row.id, {
                    recharge_short_amount: clampRecharge(raw, max),
                  });
                }}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="w-28 text-slate-300 text-sm">School</label>
              <input
                type="text"
                value={row.school ?? ""}
                onChange={(e) => onChangeField(categoryKey, row.id, { school: e.target.value })}
                placeholder="e.g., Abjuration"
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
                onChange={(e) => onChangeField(categoryKey, row.id, { concentration: e.target.checked })}
                className="h-4 w-4 accent-orange-500"
              />
              <span className="text-slate-200 text-sm">Concentration</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!row.ritual}
                onChange={(e) => onChangeField(categoryKey, row.id, { ritual: e.target.checked })}
                className="h-4 w-4 accent-orange-500"
              />
              <span className="text-slate-200 text-sm">Ritual</span>
            </label>
            <div className="flex items-center gap-2">
              <label className="w-28 text-slate-300 text-sm">Range (ft)</label>
              <input
                type="number"
                min={0}
                value={row.range_ft ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0);
                  onChangeField(categoryKey, row.id, { range_ft: v });
                }}
                className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Cast time */}
          <CastTimeEditor
            row={row}
            onChange={(patch) => onChangeField(categoryKey, row.id, patch)}
          />

          {/* Duration */}
          <DurationEditor
            row={row}
            onChange={(patch) => onChangeField(categoryKey, row.id, patch)}
          />

          {/* Components */}
          <ComponentsEditor
            row={row}
            onChange={(patch) => onChangeField(categoryKey, row.id, patch)}
          />

          {/* Notes */}
          <div className="flex flex-col md:flex-row gap-2">
            <label className="w-full md:w-24 text-slate-300 text-sm md:text-right">Notes</label>
            <textarea
              value={row.notes ?? ""}
              onChange={(e) => onChangeField(categoryKey, row.id, { notes: e.target.value })}
              placeholder="Recharge rules, materials, etc."
              className="flex-1 min-h-[110px] rounded border border-slate-700 bg-white text-slate-900 p-2"
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
            onChangeField(categoryKey, row.id, { level: v }, "slots");
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
            onChangeField(categoryKey, row.id, { slots_max: v }, "slots");
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
            onChangeField(categoryKey, row.id, { slots_current: v }, "slots");
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

/* ---------------- Category Cards ---------------- */
const SlotsCategoryCard = React.memo(function SlotsCategoryCard({
  title,
  categoryKey, // "spellcasting" | "pactmagic"
  model,
  openById,
  onToggleOpen,
  onAddSpell,
  onAddSlot,
  onRemoveRow,
  onChangeSpell,
  onChangeSlot,
  onPrepareAll,    // only for spellcasting
  onUnprepareAll,  // only for spellcasting
}) {
  const spells = model.spells || [];
  const slots = model.slots || [];
  const isSpellcasting = categoryKey === "spellcasting";

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
          {isSpellcasting && (
            <>
              <button
                type="button"
                onClick={() => onPrepareAll(true)}
                className="px-3 py-1.5 rounded-lg border border-emerald-700 bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-100 transition"
              >
                Prepare all
              </button>
              <button
                type="button"
                onClick={() => onPrepareAll(false)}
                className="px-3 py-1.5 rounded-lg border border-amber-700 bg-amber-900/40 hover:bg-amber-900/60 text-amber-100 transition"
              >
                Unprepare all
              </button>
            </>
          )}
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

      {/* Spells */}
      <div className="space-y-2">
        <div className="text-slate-300 text-sm font-medium">Spells</div>
        {spells.length === 0 && <p className="text-slate-400 text-sm">No spells yet. Click “Add spell”.</p>}
        <div className="space-y-3">
          {spells.map((raw) => {
            const row = normalizeSpellRow(raw, { slotBased: true });
            return (
              <SpellRowSlotBased
                key={row.id}
                categoryKey={categoryKey}
                row={row}
                open={!!openById[row.id]}
                onToggleOpen={onToggleOpen}
                onChangeField={onChangeSpell}
                onRemove={onRemoveRow}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
});

const InnateCategoryCard = React.memo(function InnateCategoryCard({
  title,
  categoryKey,
  model,
  openById,
  onToggleOpen,
  onAddSpell,
  onRemoveRow,
  onChangeSpell,
}) {
  const spells = model.spells || [];

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-orange-300">
          {title}{" "}
          <span className="text-slate-400 text-sm">({spells.length} innate spell{spells.length === 1 ? "" : "s"})</span>
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onAddSpell(categoryKey)}
            className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
          >
            Add innate spell
          </button>
        </div>
      </header>

      <div className="space-y-2">
        <div className="text-slate-300 text-sm font-medium">Innate Spells</div>
        {spells.length === 0 && <p className="text-slate-400 text-sm">No innate spells yet. Click “Add innate spell”.</p>}
        <div className="space-y-3">
          {spells.map((raw) => {
            const row = normalizeSpellRow(raw, { slotBased: false });
            return (
              <SpellRowInnate
                key={row.id}
                categoryKey={categoryKey}
                row={row}
                open={!!openById[row.id]}
                onToggleOpen={onToggleOpen}
                onChangeField={onChangeSpell}
                onRemove={onRemoveRow}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
});

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

  // Normalize existing data to the extended shape
  const book = useMemo(() => {
    const raw = charData.spellbook || {};
    const mapped = { ...DEFAULT_SPELLBOOK, ...(raw || {}) };

    const normSlots = (arr) =>
      (arr || []).map((r) => ({
        id: r.id || idGen(),
        level: r.level ?? "",
        slots_max: r.slots_max ?? "",
        slots_current: r.slots_current ?? r.slots_max ?? "",
      }));

    // spellcasting/pactmagic
    mapped.spellcasting = {
      spells: (mapped.spellcasting?.spells || []).map((r) => normalizeSpellRow(r, { slotBased: true })),
      slots: normSlots(mapped.spellcasting?.slots || []),
    };
    mapped.pactmagic = {
      spells: (mapped.pactmagic?.spells || []).map((r) => normalizeSpellRow(r, { slotBased: true })),
      slots: normSlots(mapped.pactmagic?.slots || []),
    };

    // innate
    mapped.innate = {
      spells: (mapped.innate?.spells || []).map((r) => normalizeSpellRow(r, { slotBased: false })),
    };

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

  /* ----- Add/Remove ----- */
  const addSpell = useCallback(
    (categoryKey) => {
      const base = normalizeSpellRow(
        { name: "", level: "", school: "", notes: "" },
        { slotBased: categoryKey !== "innate" }
      );
      let row =
        categoryKey === "innate"
          ? { ...base, max_charges: "", current_charges: "", recharge_short_amount: 0 }
          : { ...base, prepared: false };

      const next = {
        ...book,
        [categoryKey]: {
          ...book[categoryKey],
          spells: [...(book[categoryKey].spells || []), row],
          ...(categoryKey === "innate" ? {} : { slots: [...(book[categoryKey].slots || [])] }),
        },
      };
      persist(next, { immediate: true });
      setOpenById((prev) => ({ ...prev, [row.id]: true }));
    },
    [book, persist]
  );

  const addSlot = useCallback(
    (categoryKey) => {
      if (categoryKey === "innate") return;
      const row = { id: idGen(), level: "", slots_max: "", slots_current: "" };
      const next = {
        ...book,
        [categoryKey]: {
          ...book[categoryKey],
          spells: [...(book[categoryKey].spells || [])],
          slots: [...(book[categoryKey].slots || []), row],
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
          ...(categoryKey === "innate"
            ? {}
            : { slots: (book[categoryKey].slots || []).filter((r) => !(which === "slots" && r.id === id)) }),
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

  /* ----- Update fields ----- */
  const changeSpellField = useCallback(
    (categoryKey, id, patch) => {
      const next = {
        ...book,
        [categoryKey]: {
          ...book[categoryKey],
          spells: (book[categoryKey].spells || []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
          ...(categoryKey === "innate" ? {} : { slots: [...(book[categoryKey].slots || [])] }),
        },
      };
      persist(next);
    },
    [book, persist]
  );

  const changeSlotField = useCallback(
    (categoryKey, id, patch) => {
      if (categoryKey === "innate") return;
      const next = {
        ...book,
        [categoryKey]: {
          ...book[categoryKey],
          spells: [...(book[categoryKey].spells || [])],
          slots: (book[categoryKey].slots || []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
        },
      };
      persist(next);
    },
    [book, persist]
  );

  /* ----- Prepare all / Unprepare all (spellcasting only) ----- */
  const prepareAll = useCallback(
    (flag) => {
      const next = {
        ...book,
        spellcasting: {
          ...book.spellcasting,
          spells: (book.spellcasting.spells || []).map((s) => ({ ...s, prepared: !!flag })),
          slots: [...(book.spellcasting.slots || [])],
        },
      };
      persist(next, { immediate: true });
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
      <SlotsCategoryCard
        title="Spellcasting"
        categoryKey="spellcasting"
        model={book.spellcasting}
        openById={openById}
        onToggleOpen={toggleOpen}
        onAddSpell={addSpell}
        onAddSlot={addSlot}
        onRemoveRow={removeRow}
        onChangeSpell={changeSpellField}
        onChangeSlot={changeSlotField}
        onPrepareAll={(flag) => prepareAll(flag)}
      />

      <SlotsCategoryCard
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
        onPrepareAll={undefined}
      />

      <InnateCategoryCard
        title="Innate Spells"
        categoryKey="innate"
        model={book.innate}
        openById={openById}
        onToggleOpen={toggleOpen}
        onAddSpell={addSpell}
        onRemoveRow={removeRow}
        onChangeSpell={changeSpellField}
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
