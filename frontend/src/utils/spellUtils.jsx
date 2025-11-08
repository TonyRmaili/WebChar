import React from "react";


const CAST_TIME_UNITS = ["rounds", "minutes", "hours"];
const DURATION_UNITS = ["rounds", "minutes", "hours", "days"];


// export function normalizeSpellRow(r) {
//   const base = {
//     id: r.id || idGen(),
//     name: r.name ?? "",
//     level: r.level ?? "",
//     school: r.school ?? "",
//     notes: r.notes ?? "",
//     concentration: !!r.concentration,
//     ritual: !!r.ritual,
//     cast_time_kind: r.cast_time_kind || "choice",
//     cast_time_choice: r.cast_time_choice || "action",
//     cast_time_value: r.cast_time_value ?? "",
//     cast_time_unit: r.cast_time_unit || "rounds",
//     duration_value: r.duration_value ?? "",
//     duration_unit: r.duration_unit || "rounds",
//     range_ft: r.range_ft ?? "",
//     components: {
//       v: !!(r.components?.v),
//       s: !!(r.components?.s),
//       m: !!(r.components?.m),
//       material_desc: r.components?.material_desc ?? "",
//       material_cost: r.components?.material_cost ?? "",
//     },
//     prepared: !!r.prepared,
//     innate: !!r.innate,
//   };

//   if (!base.innate) return base;

//   const max = r.max_charges ?? "";
//   const cur = r.current_charges ?? max;
//   const recharge = Math.max(0, Math.min(Number(r.reset_amount ?? 0), Number(max || 0)));
//   return {
//     ...base,
//     max_charges: max,
//     current_charges: cur,
//     reset_amount: recharge,
//   };
// }

export function normalizeSpellRow(r) {
  const base = {
    id: r.id || idGen(),
    name: r.name ?? "",
    level: r.level ?? "",
    school: r.school ?? "",
    notes: r.notes ?? "",
    concentration: !!r.concentration,
    ritual: !!r.ritual,
    cast_time_kind: r.cast_time_kind || "choice",
    cast_time_choice: r.cast_time_choice || "action",
    cast_time_value: r.cast_time_value ?? "",
    cast_time_unit: r.cast_time_unit || "rounds",
    duration_value: r.duration_value ?? "",
    duration_unit: r.duration_unit || "rounds",
    range_ft: r.range_ft ?? "",
    components: {
      v: !!(r.components?.v),
      s: !!(r.components?.s),
      m: !!(r.components?.m),
      material_desc: r.components?.material_desc ?? "",
      material_cost: r.components?.material_cost ?? "",
    },
    innate: !!r.innate,
  };

  // prepared only matters for non-innate spells
  const prepared = !base.innate && !!r.prepared;

  if (!base.innate) {
    return { ...base, prepared };
  }

  const max = r.max_charges ?? "";
  const cur = r.current_charges ?? max;
  const recharge = Math.max(0, Math.min(Number(r.reset_amount ?? 0), Number(max || 0)));

  return {
    ...base,
    prepared, // will be false for innate
    max_charges: max,
    current_charges: cur,
    reset_amount: recharge,
  };
}


/* ---------------- Reusable editors ---------------- */
export function CastTimeEditor({ row, onChange, hideChoice = false }) {
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

export function DurationEditor({ row, onChange }) {
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

export function ComponentsEditor({ row, onChange }) {
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
export const SlotRow = React.memo(function SlotRow({ categoryKey, row, onChangeField, onRemove }) {
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

/* ---------------- Slots Cards ---------------- */
export const SlotsOnlyCard = React.memo(function SlotsOnlyCard({
  title,
  categoryKey,
  model,
  onAddSlot,
  onRemoveRow,
  onChangeSlot,
}) {
  const slots = model || [];
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
export const SpellEditorRow = React.memo(function SpellEditorRow({ row, open, onToggleOpen, onChangeField, onRemove }) {
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

          <CastTimeEditor row={row} onChange={(patch) => onChangeField(row.id, patch)} />
          <DurationEditor row={row} onChange={(patch) => onChangeField(row.id, patch)} />
          <ComponentsEditor row={row} onChange={(patch) => onChangeField(row.id, patch)} />

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
                    const clampedRecharge = clampRecharge(Number(row.reset_amount ?? 0), Number(v || 0));
                    const clampedCurrent = Math.max(0, Math.min(Number(row.current_charges ?? 0), Number(v || 0)));
                    onChangeField(row.id, {
                      max_charges: v,
                      reset_amount: clampedRecharge,
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
                  value={row.reset_amount ?? 0}
                  onChange={(e) => {
                    const raw = e.target.value === "" ? 0 : Number(e.target.value);
                    if (Number.isNaN(raw)) return;
                    onChangeField(row.id, {
                      reset_amount: clampRecharge(raw, max),
                    });
                  }}
                  className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                />
              </div>
            </div>
          )}

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

/* ---------------- Spells Card ---------------- */
export function SpellsCard({
  list,
  openById,
  onToggleOpen,
  onAdd,
  onImport,
  onChange,
  onRemove,
  files,
  loadingFiles,
  selectedFile,
  onSelectFile,
  spellNames,
  loadingSpellNames,
  selectedSpell,
  onSelectSpell,
  maxPrepared,
  onChangeMaxPrepared,
}) {

  const pascalLabel = (s) =>
    s
      .replace(/\.\w+$/, "")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\s+/g, "");

  const spells = (list ?? []).map(normalizeSpellRow);

  const preparedCount = spells.reduce((acc, s) => {
    const lvl = Number(s.level || 0);
    const counts = !s.innate && lvl >= 1 && !!s.prepared;
    return acc + (counts ? 1 : 0);
  }, 0);

  // const pascalLabel = (s) =>
  //   s.replace(/\.\w+$/,"").replace(/_/g," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()).replace(/\s+/g,"");

  // return (
  //   <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-4">
  //     <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
  //       <h3 className="text-lg font-semibold text-orange-300">
  //         Spells <span className="text-slate-400 text-sm">({list.length})</span>
  //       </h3>

  //       <div className="flex items-center gap-2 flex-wrap">
  //         <label htmlFor="spell-file" className="text-slate-300 text-sm">Import from</label>
  //         <select
  //           id="spell-file"
  //           className="px-3 py-1.5 rounded-lg border border-indigo-600 bg-slate-900 text-indigo-100"
  //           disabled={loadingFiles || files.length === 0}
  //           value={selectedFile}
  //           onChange={(e) => onSelectFile(e.target.value)}
  //         >
  //           <option value="">{loadingFiles ? "Loading..." : "Select file..."}</option>
  //           {files.map((f) => (
  //             <option key={f} value={f}>{pascalLabel(f)}</option>
  //           ))}
  //         </select>

  //         {selectedFile && (
  //           <select
  //             className="px-3 py-1.5 rounded-lg border border-indigo-600 bg-slate-900 text-indigo-100"
  //             disabled={loadingSpellNames || (spellNames?.length ?? 0) === 0}
  //             value={selectedSpell}
  //             onChange={(e) => onSelectSpell(e.target.value)}
  //             aria-label="Spell name"
  //           >
  //             <option value="">
  //               {loadingSpellNames ? "Loading spells..." : "Select spell..."}
  //             </option>
  //             {spellNames.map((name) => (
  //               <option key={name} value={name}>{name}</option>
  //             ))}
  //           </select>
  //         )}

  //         <button
  //           type="button"
  //           onClick={onImport}
  //           className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
  //         >
  //           Import spell
  //         </button>

  //         <button
  //           type="button"
  //           onClick={onAdd}
  //           className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
  //         >
  //           Create spell
  //         </button>
  //       </div>
  //     </header>

  //     {list.length === 0 && <p className="text-slate-400 text-sm">No spells yet. Add or import.</p>}

  //     <div className="space-y-3">
  //       {list.map((raw) => {
  //         const row = normalizeSpellRow(raw);
  //         return (
  //           <SpellEditorRow
  //             key={row.id}
  //             row={row}
  //             open={!!openById[row.id]}
  //             onToggleOpen={onToggleOpen}
  //             onChangeField={(id, patch) => onChange(id, patch)}
  //             onRemove={onRemove}
  //           />
  //         );
  //       })}
  //     </div>
  //   </section>
  // );

    return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-4">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-orange-300">
            Spells <span className="text-slate-400 text-sm">({spells.length})</span>
          </h3>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>Prepared (≥1):</span>
            <span className="text-amber-300 font-semibold">
              {preparedCount}
              {maxPrepared ? ` / ${maxPrepared}` : ""}
            </span>
            <input
              type="number"
              min={0}
              value={maxPrepared ?? ""}
              onChange={(e) => onChangeMaxPrepared(e.target.value)}
              className="w-16 px-2 py-1 rounded border border-slate-600 bg-slate-900 text-slate-100 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="spell-file" className="text-slate-300 text-sm">Import from</label>
          <select
            id="spell-file"
            className="px-3 py-1.5 rounded-lg border border-indigo-600 bg-slate-900 text-indigo-100"
            disabled={loadingFiles || files.length === 0}
            value={selectedFile}
            onChange={(e) => onSelectFile(e.target.value)}
          >
            <option value="">{loadingFiles ? "Loading..." : "Select file..."}</option>
            {files.map((f) => (
              <option key={f} value={f}>{pascalLabel(f)}</option>
            ))}
          </select>

          {selectedFile && (
            <select
              className="px-3 py-1.5 rounded-lg border border-indigo-600 bg-slate-900 text-indigo-100"
              disabled={loadingSpellNames || (spellNames?.length ?? 0) === 0}
              value={selectedSpell}
              onChange={(e) => onSelectSpell(e.target.value)}
              aria-label="Spell name"
            >
              <option value="">
                {loadingSpellNames ? "Loading spells..." : "Select spell..."}
              </option>
              {spellNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={onImport}
            className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
          >
            Import spell
          </button>

          <button
            type="button"
            onClick={onAdd}
            className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
          >
            Create spell
          </button>
        </div>
      </header>
            {spells.length === 0 && (
        <p className="text-slate-400 text-sm">No spells yet. Add or import.</p>
      )}

      {spells.length > 0 && (
        <div className="space-y-4">
          {Object.entries(
            spells.reduce((acc, spell) => {
              const lvl = Number(spell.level || 0);
              const key = String(lvl);
              if (!acc[key]) acc[key] = [];
              acc[key].push(spell);
              return acc;
            }, {})
          )
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([lvlKey, levelSpells]) => {
              const lvl = Number(lvlKey);

              const innate = levelSpells.filter((s) => s.innate);
              const nonInnate = levelSpells.filter((s) => !s.innate);

              const prepared = nonInnate.filter((s) => s.prepared);
              const ritualsOnly = nonInnate.filter(
                (s) => s.ritual && !s.prepared
              );
              const other = nonInnate.filter(
                (s) => !s.prepared && !s.ritual
              );

              return (
                <div key={lvlKey} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-orange-200">
                      Level {lvl}{" "}
                      {lvl === 0 && (
                        <span className="text-xs text-slate-400">(Cantrips)</span>
                      )}
                    </h4>
                  </div>

                  {/* Prepared */}
                  {prepared.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-300">Prepared</p>
                      {prepared.map((row) => (
                        <SpellEditorRow
                          key={row.id}
                          row={row}
                          open={!!openById[row.id]}
                          onToggleOpen={onToggleOpen}
                          onChangeField={(id, patch) => onChange(id, patch)}
                          onRemove={onRemove}
                        />
                      ))}
                    </div>
                  )}

                  {/* Rituals (non-prepared) */}
                  {ritualsOnly.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-300">Rituals</p>
                      {ritualsOnly.map((row) => (
                        <SpellEditorRow
                          key={row.id}
                          row={row}
                          open={!!openById[row.id]}
                          onToggleOpen={onToggleOpen}
                          onChangeField={(id, patch) => onChange(id, patch)}
                          onRemove={onRemove}
                        />
                      ))}
                    </div>
                  )}

                  {/* Innate (includes innate+ritual) */}
                  {innate.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-300">Innate</p>
                      {innate.map((row) => (
                        <SpellEditorRow
                          key={row.id}
                          row={row}
                          open={!!openById[row.id]}
                          onToggleOpen={onToggleOpen}
                          onChangeField={(id, patch) => onChange(id, patch)}
                          onRemove={onRemove}
                        />
                      ))}
                    </div>
                  )}

                  {/* Other (unprepared, non-ritual, non-innate) */}
                  {other.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-300">Other</p>
                      {other.map((row) => (
                        <SpellEditorRow
                          key={row.id}
                          row={row}
                          open={!!openById[row.id]}
                          onToggleOpen={onToggleOpen}
                          onChangeField={(id, patch) => onChange(id, patch)}
                          onRemove={onRemove}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </section>
  );
}



/* ---------------- Metamagic ---------------- */
export function MetamagicCard({ list, onAdd, onRemove, onChange }) {
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

/* ---------------- Invocations ---------------- */
export function InvocationsCard({ list, onAdd, onRemove, onChange }) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-orange-300">
          Invocations <span className="text-slate-400 text-sm">({list.length})</span>
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
        >
          Add invocation
        </button>
      </header>

      {list.length === 0 && <p className="text-slate-400 text-sm">No invocations yet.</p>}

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
export function SorceryPointsCard({ model, onChange }) {
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
              const recharge = Math.min(Number(model.reset_amount || 0), Number(v || 0));
              onChange({ max_charges: v, current_charges: cur, reset_amount: recharge });
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
            value={model.reset_amount ?? 0}
            onChange={(e) => {
              const v = e.target.value === "" ? 0 : Math.max(0, Math.min(Number(e.target.value) || 0, max));
              onChange({ reset_amount: v });
            }}
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
          />
        </div>
      </div>
    </section>
  );
}

/* ---------------- UI Bits ---------------- */
const Chip = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900 text-slate-200 text-xs">
    {children}
  </span>
);

/* ---------------- Small helpers ---------------- */
const idGen = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;



