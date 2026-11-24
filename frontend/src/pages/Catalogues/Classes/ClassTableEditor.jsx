import React, { useState } from "react";
import { chip, fieldCls, hintCls, addRowCls, removeRowCls } from "../catalogueStyle";
import { Segmented } from "../catalogueParts";
import { FEATURE_TYPES, describeChoice, formatFeatureType, numOrNull } from "../catalogueHelpers";
import {
  LEVELS, PICK_KINDS, SLOT_HEADERS, SLOT_WIDTH, featureRef, makePick, newFeatureAt, ordinal, parseCell, pickWords,
  proficiencyBonus, setStep, valueAt, withSlot,
} from "./classHelpers";
import { RESET_OPTIONS } from "./classFormParts";

/* ═══════════════════════════════════════════════════════════════════
   ClassTableEditor — the class table, filled in where it stands.

   Rows are levels; the columns are Level · PB · Features · the class's
   own columns (Rages, Second Wind…) · its spell columns (cantrips,
   prepared, slots — when it casts spells; filled in by its caster kind).

   Features cell: each feature (click: open it beside the form, ✕:
   remove), the picks of that level (ASI, Fighting Style…), what it
   improves (↑), and the subclass's levels. "+" on a level adds a
   feature, a pick, an "improves", or marks a subclass level.

   Number cells: each is that level's own value; an empty cell shows the
   one above it, faded (the table is stored as "from this level on").

   Props:
     rows / onRows             the progression form ({ level: row })
     features / onFeatures     the features (new ones known by _new)
     columns / onColumns       [{ id, name, values, pool }]
     spellcasting / onSpellcasting   the spellcasting form (or null)
     subclass                  class form: { level, title, onLevel } —
                               where the subclass is picked (level null:
                               none; onLevel(level | null) moves or
                               removes it) and the "subclass feature"
                               marks; null in the subclass form
     levels                    the rows shown (default 1–20)
     addable                   levels that take new features (default all)
     onOpenFeature(ref), openRef, onRemoveFeature(ref), edition, index
   ═══════════════════════════════════════════════════════════════════ */

const PICK_OPTIONS = Object.entries(PICK_KINDS);
const th = "px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faded";
const cellInput =
  "w-11 rounded bg-transparent px-1 py-0.5 text-center text-sm text-ink outline-none placeholder:text-ink-faint hover:bg-ink/[0.05] focus:bg-ink/[0.06] focus:ring-1 focus:ring-rubric/40";
/* A pick's chip: its label, then what it picks when that adds something
   ("Maneuvers: 3 Maneuver" says no more than "Maneuvers ×3"). */
const pickLabel = (c, index) => {
  const label = c.label || describeChoice(c, index)?.label || "Pick";
  const words = pickWords(c).replace(/^\d+ /, "");
  const a = label.toLowerCase().replace(/s\b/g, "");
  const b = words.toLowerCase().replace(/s\b/g, "").replace(/ feat$/, "");
  const same = !words || a.includes(b) || b.includes(a) || /ability score/i.test(label);
  return `${label}${same ? "" : `: ${words}`}${c.count > 1 ? ` ×${c.count}` : ""}`;
};
const shown = (v) => (v == null || v === "" ? "—" : String(v));

export default function ClassTableEditor({
  rows, onRows, features, onFeatures, columns, onColumns, spellcasting = null, onSpellcasting,
  subclass = null, levels = LEVELS, addable = null, onOpenFeature, openRef, onRemoveFeature, edition, index,
}) {
  const [adding, setAdding] = useState(null); // { level, kind, type, count }
  const [selected, setSelected] = useState(null); // index of the own column being set up

  const canAdd = (level) => !addable || addable.includes(level);
  const setRow = (level, p) => onRows({ ...rows, [level]: { ...rows[level], ...p } });
  const setColumn = (i, p) => onColumns(columns.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const top = features.filter((f) => !f.parent);
  const nameOf = Object.fromEntries(features.map((f) => [featureRef(f), f.name || "(no name)"]));

  // Every level that has something stays visible, even off the list.
  const levelsShown = [...new Set([...levels, ...top.map((f) => f.level ?? 1).filter((l) => l >= 1 && l <= 20)])].sort((a, b) => a - b);

  // ─── the number columns ───
  const sc = spellcasting?.on ? spellcasting : null;
  const setSc = (p) => onSpellcasting({ ...sc, ...p });
  const numberCols = columns.map((c, i) => ({
    key: `own${i}`, own: i, header: c.name || "New column", pool: !!c.pool, table: c.values,
    onTable: (t) => setColumn(i, { values: t }),
  }));
  if (sc) {
    numberCols.push({ key: "cantrips", header: "Cantrips", table: sc.cantrips, onTable: (t) => setSc({ cantrips: t }) });
    if (!sc.prepFormula) numberCols.push({ key: "prepared", header: "Prepared Spells", table: sc.prepared, onTable: (t) => setSc({ prepared: t }) });
    if (sc.progression === "pact") {
      numberCols.push({ key: "pact", header: "Slots", group: "Pact Magic", table: sc.pactSlots, onTable: (t) => setSc({ pactSlots: t }) });
      numberCols.push({ key: "pactlevel", header: "Slot Level", group: "Pact Magic", table: sc.pactLevel, onTable: (t) => setSc({ pactLevel: t }) });
    } else {
      const width = Math.max(SLOT_WIDTH[sc.progression] || 0, ...Object.values(sc.slots).map((r) => r?.length || 0));
      for (let i = 0; i < width; i += 1) numberCols.push({ key: `slot${i}`, header: SLOT_HEADERS[i], group: "Spell Slots per Spell Level", slot: i });
    }
  }
  const groups = [];
  for (const c of numberCols) {
    const last = groups[groups.length - 1];
    if (c.group && last?.group === c.group) last.span += 1;
    else groups.push({ group: c.group || null, span: 1 });
  }
  const hasGroups = groups.some((g) => g.group);
  const width = 3 + numberCols.length;

  const numberCell = (c, level) => {
    if (c.slot != null) {
      const explicit = String(level) in sc.slots;
      const row = valueAt(sc.slots, level) || [];
      return (
        <input type="text" inputMode="numeric" aria-label={`${c.header} slots at level ${level}`} className={cellInput}
               value={explicit && row[c.slot] ? String(row[c.slot]) : ""} placeholder={!explicit && row[c.slot] ? String(row[c.slot]) : "—"}
               onChange={(e) => setSc({ slots: { ...sc.slots, [level]: withSlot(row, c.slot, numOrNull(e.target.value)) } })} />
      );
    }
    const explicit = String(level) in (c.table || {});
    return (
      <input type="text" aria-label={`${c.header} at level ${level}`} className={cellInput}
             value={explicit ? String(c.table[level]) : ""} placeholder={shown(valueAt(c.table, level))}
             onChange={(e) => c.onTable(setStep(c.table, level, parseCell(e.target.value)))} />
    );
  };

  // ─── the features cell's add row ───
  const addFeature = (level) => {
    const f = newFeatureAt(level);
    onFeatures([...features, f]);
    onOpenFeature(featureRef(f));
    setAdding(null);
  };
  const addPick = () => {
    const pick = makePick(adding.kind, { level: adding.level, edition, featureType: adding.type, count: adding.count });
    if (pick) setRow(adding.level, { choices: [...rows[adding.level].choices, pick] });
    setAdding({ ...adding, kind: "" });
  };

  const addRow = (level) => {
    const row = rows[level];
    const earlier = top.filter((f) => (f.level ?? 1) < level && !row.upgrades.includes(featureRef(f)));
    return (
      <tr key={`add${level}`} className="border-b border-dotted border-rule/25 bg-rubric/[0.04]">
        <td colSpan={width} className="px-2 py-1.5">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 text-sm">
            <button type="button" onClick={() => addFeature(level)} className={addRowCls}>+ new feature</button>
            <span className="flex flex-wrap items-baseline gap-2">
              <select value={adding.kind} onChange={(e) => setAdding({ ...adding, kind: e.target.value })} className={`${fieldCls} !w-60`} aria-label="Add a pick">
                <option value="">— a pick —</option>
                {PICK_OPTIONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
              {adding.kind === "optional_features" && (
                <select value={adding.type} onChange={(e) => setAdding({ ...adding, type: e.target.value })} className={`${fieldCls} !w-40`}>
                  {Object.keys(FEATURE_TYPES).map((t) => <option key={t} value={t}>{formatFeatureType(t)}</option>)}
                </select>
              )}
              {["optional_features", "weapon_mastery"].includes(adding.kind) && (
                <input type="number" min={1} value={adding.count} onChange={(e) => setAdding({ ...adding, count: numOrNull(e.target.value) ?? 1 })}
                       className={`${fieldCls} !w-12`} aria-label="How many" />
              )}
              {adding.kind && <button type="button" onClick={addPick} className={addRowCls}>add</button>}
            </span>
            {subclass && level !== subclass.level && (
              <button type="button" onClick={() => { subclass.onLevel(level); setAdding(null); }} className={addRowCls}
                      title="The subclass is picked at this level (and gives its first features here)">
                {subclass.level ? "subclass starts here instead" : "+ subclass starts here"}
              </button>
            )}
            {subclass && subclass.level && level > subclass.level && (
              <label className="flex items-baseline gap-1.5 text-xs text-ink-faded">
                <input type="checkbox" checked={row.subclass_features} onChange={(e) => setRow(level, { subclass_features: e.target.checked })} className="accent-rubric" />
                a subclass feature here
              </label>
            )}
            {earlier.length > 0 && (
              <select value="" onChange={(e) => e.target.value && setRow(level, { upgrades: [...row.upgrades, e.target.value] })}
                      className={`${fieldCls} !w-56`} aria-label="Improves an earlier feature">
                <option value="">— improves an earlier feature —</option>
                {earlier.map((f) => <option key={featureRef(f)} value={featureRef(f)}>{f.name || "(no name)"} (level {f.level ?? 1})</option>)}
              </select>
            )}
            <span className="flex-1" />
            <button type="button" onClick={() => setAdding(null)} className={removeRowCls}>close</button>
          </div>
        </td>
      </tr>
    );
  };

  const col = selected != null ? columns[selected] : null;
  const setPool = (p) => setColumn(selected, { pool: { ...col.pool, ...p } });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <button type="button" onClick={() => { onColumns([...columns, { name: "", values: {}, pool: null }]); setSelected(columns.length); }} className={addRowCls}>
          + column
        </button>
        <p className={hintCls}>
          Click a feature to open it · <b className="not-italic">+</b> on a level adds a feature or a pick · type in a cell: that level's number, an empty cell keeps the one above.
        </p>
      </div>

      {col && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 border-l border-rubric/40 py-1 pl-3 text-sm">
          <input type="text" value={col.name || ""} onChange={(e) => setColumn(selected, { name: e.target.value })} placeholder="column name (Rages)"
                 className={`${fieldCls} !w-44`} autoFocus />
          <span className="text-[10px] text-ink-faint" title="Formulas and features can use this id">{col.id ? `id: ${col.id}` : "its id comes from the name"}</span>
          <label className="flex items-baseline gap-1.5" title="Features spend from it (Second Wind, Focus Points); the sheet counts it down">
            <input type="checkbox" checked={!!col.pool} onChange={(e) => setColumn(selected, { pool: e.target.checked ? { reset: "long" } : null })} className="accent-rubric" />
            features spend it
          </label>
          {col.pool && (
            <>
              <span className="text-xs text-ink-faded">back on a</span>
              <Segmented size="sm" options={RESET_OPTIONS} value={col.pool.reset || ""} onChange={(v) => setPool({ reset: v })} />
              {col.pool.reset === "long" && (
                <label className="flex items-baseline gap-1.5" title="What a short rest gives back (2024 Channel Divinity: 1)">
                  <span className="text-xs text-ink-faded">a short rest gives</span>
                  <input type="text" value={col.pool.short_rest ?? ""} placeholder="—" className={`${fieldCls} !w-12`}
                         onChange={(e) => setPool({ short_rest: parseCell(e.target.value) })} />
                </label>
              )}
            </>
          )}
          <span className="flex-1" />
          <button type="button" onClick={() => { onColumns(columns.filter((_, j) => j !== selected)); setSelected(null); }} className="text-xs italic text-ink-faded hover:text-bad">
            ✕ remove column
          </button>
          <button type="button" onClick={() => setSelected(null)} className={removeRowCls}>done</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            {hasGroups && (
              <tr>
                <th colSpan={3} />
                {groups.map((g, i) => (
                  <th key={i} colSpan={g.span} className={`${th} text-center ${g.group ? "border-b border-l border-rule/40" : ""}`}>{g.group || ""}</th>
                ))}
              </tr>
            )}
            <tr className="border-b border-rule/40">
              <th className={`${th} text-left`}>Level</th>
              <th className={`${th} text-center`}>PB</th>
              <th className={`${th} min-w-[16rem] text-left`}>Features</th>
              {numberCols.map((c) =>
                c.own != null ? (
                  <th key={c.key} className={`${th} whitespace-nowrap text-center`}>
                    <button type="button" onClick={() => setSelected(selected === c.own ? null : c.own)} title="Name, pool, remove"
                            className={`uppercase tracking-[0.14em] hover:text-rubric ${selected === c.own ? "text-rubric underline decoration-dotted underline-offset-4" : ""} ${!columns[c.own].name ? "italic" : ""}`}>
                      {c.header}
                      {c.pool && <span className="ml-1 text-rubric" title="Features spend it">◆</span>}
                    </button>
                  </th>
                ) : (
                  <th key={c.key} className={`${th} whitespace-nowrap text-center`} title="Set in the Spells tab">{c.header}</th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {levelsShown.map((level) => {
              const row = rows[level];
              const here = top.filter((f) => (f.level ?? 1) === level);
              const open = canAdd(level);
              const isPick = subclass && level === subclass.level;
              return (
                <React.Fragment key={level}>
                  <tr className={`border-b border-dotted border-rule/25 align-baseline even:bg-ink/[0.03] ${open ? "" : "opacity-60"}`}>
                    <td className="whitespace-nowrap px-2 py-1 font-semibold text-ink">{ordinal(level)}</td>
                    <td className="px-2 py-1 text-center text-ink-faded">+{proficiencyBonus(level)}</td>
                    <td className="px-2 py-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        {here.map((f) => {
                          const ref = featureRef(f);
                          return (
                            <span key={ref} className="inline-flex items-baseline gap-0.5">
                              <button type="button" onClick={() => onOpenFeature(ref)}
                                      className={`font-semibold italic hover:text-rubric ${openRef === ref ? "text-rubric underline decoration-dotted underline-offset-4" : "text-ink"} ${f.name ? "" : "text-ink-faded"}`}>
                                {f.name || "(no name)"}
                              </button>
                              <button type="button" onClick={() => onRemoveFeature(ref)} className="px-0.5 text-[10px] text-ink-faint hover:text-bad" aria-label={`Remove ${f.name}`}>✕</button>
                            </span>
                          );
                        })}
                        {row.upgrades.map((ref) => (
                          <span key={`u${ref}`} className="inline-flex items-baseline gap-0.5 text-ink-faded" title="It improves here; its text is in the earlier feature">
                            ↑ {nameOf[ref] || ref.split(":").pop()}
                            <button type="button" onClick={() => setRow(level, { upgrades: row.upgrades.filter((u) => u !== ref) })}
                                    className="px-0.5 text-[10px] text-ink-faint hover:text-bad" aria-label="Remove">✕</button>
                          </span>
                        ))}
                        {row.choices.map((c, i) => (
                          <button key={c.id || i} type="button" className={`${chip(true)} !text-xs`} title="Remove this pick"
                                  onClick={() => setRow(level, { choices: row.choices.filter((_, j) => j !== i) })}>
                            {pickLabel(c, index)}{" "}
                            <span aria-hidden className="text-ink-faded">✕</span>
                          </button>
                        ))}
                        {isPick && (
                          <span className="inline-flex items-baseline gap-0.5 italic text-rubric" title="The subclass is picked here; it gives its first features here">
                            {subclass.title}
                            <button type="button" onClick={() => subclass.onLevel(null)} className="px-0.5 text-[10px] not-italic text-ink-faint hover:text-bad"
                                    aria-label="No subclass" title="No subclasses for this class">✕</button>
                          </span>
                        )}
                        {subclass && !isPick && row.subclass_features && (
                          <span className="inline-flex items-baseline gap-0.5 italic text-ink-faded" title="Its subclass gives a feature here">
                            Subclass feature
                            <button type="button" onClick={() => setRow(level, { subclass_features: false })} className="px-0.5 text-[10px] not-italic text-ink-faint hover:text-bad" aria-label="Not a subclass level">✕</button>
                          </span>
                        )}
                        {open && adding?.level !== level && (
                          <button type="button" onClick={() => setAdding({ level, kind: "", type: "maneuver", count: 1 })}
                                  className="px-1 text-sm leading-none text-ink-faint hover:text-rubric" aria-label={`Add to level ${level}`} title="Add a feature or a pick">
                            +
                          </button>
                        )}
                      </div>
                    </td>
                    {numberCols.map((c) => (
                      <td key={c.key} className="px-1 py-0.5 text-center">{numberCell(c, level)}</td>
                    ))}
                  </tr>
                  {adding?.level === level && addRow(level)}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
