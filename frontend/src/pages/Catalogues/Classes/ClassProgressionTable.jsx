import React, { useMemo, useState } from "react";
import { Chevron } from "../../../styles/parchmentForm";
import { LEVELS, byId, formatCell, levelWords, ordinal, proficiencyBonus, tableColumns } from "./classHelpers";

/* The class table: level, proficiency bonus, what each level gives, the
   class's own columns and its spell slots. With subclasses picked, their
   features join the Features cell (in italics, named) and their own
   columns (an Eldritch Knight's spell slots) are added on the right.
   The heading folds the table away. */
export default function ClassProgressionTable({ cls, subclasses = [] }) {
  const [open, setOpen] = useState(true);
  const features = useMemo(() => byId(cls), [cls]);
  const columns = useMemo(
    () => [...tableColumns(cls), ...subclasses.flatMap((sc) => tableColumns(sc, sc.short_name || sc.name))],
    [cls, subclasses]
  );
  const subFeatures = useMemo(() => subclasses.map((sc) => ({ sc, features: byId(sc) })), [subclasses]);
  if (!cls) return null;

  // Column groups ("Spell Slots per Spell Level") get a header row of their own.
  const groups = [];
  for (const c of columns) {
    const last = groups[groups.length - 1];
    if (c.group && last?.group === c.group) last.span += 1;
    else groups.push({ group: c.group || null, span: 1 });
  }
  const hasGroups = groups.some((g) => g.group);
  const th = "px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faded";

  return (
    <section>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="group mb-3 flex w-full items-baseline gap-2 text-left">
        <span className="self-center">
          <Chevron open={open} />
        </span>
        <h4 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-faded transition group-hover:text-rubric">
          {cls.name} Features
        </h4>
        <span className="h-px flex-1 translate-y-[-3px] bg-rule/30" />
        <span className="shrink-0 text-xs italic text-ink-faded">{open ? "hide" : "show"}</span>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              {hasGroups && (
                <tr>
                  <th colSpan={3} />
                  {groups.map((g, i) => (
                    <th key={i} colSpan={g.span} className={`${th} text-center ${g.group ? "border-b border-l border-rule/40" : ""}`}>
                      {g.group || ""}
                    </th>
                  ))}
                </tr>
              )}
              <tr className="border-b border-rule/40">
                <th className={`${th} text-left`}>Level</th>
                <th className={`${th} whitespace-nowrap text-center`}>PB</th>
                <th className={`${th} text-left`}>Features</th>
                {columns.map((c) => (
                  <th key={c.key} className={`${th} whitespace-nowrap text-center`}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((level) => {
                const words = levelWords(cls, level, features).filter((w) => w.kind !== "subclass" || !subclasses.length);
                const subs = subFeatures.flatMap(({ sc, features: f }) =>
                  levelWords(sc, level, f).filter((w) => w.kind === "feature").map((w) => ({ ...w, sc: sc.short_name || sc.name }))
                );
                return (
                  <tr key={level} className="border-b border-dotted border-rule/25 even:bg-ink/[0.03]">
                    <td className="px-2 py-1 font-semibold text-ink">{ordinal(level)}</td>
                    <td className="px-2 py-1 text-center">+{proficiencyBonus(level)}</td>
                    <td className="px-2 py-1 text-ink">
                      {words.length === 0 && subs.length === 0 && <span className="text-ink-faint">—</span>}
                      {words.map((w, i) => (
                        <React.Fragment key={`c${i}`}>
                          {i > 0 && ", "}
                          <span className={w.kind === "upgrade" ? "text-ink-faded" : w.kind === "subclass" ? "italic text-ink-faded" : ""}>{w.name}</span>
                        </React.Fragment>
                      ))}
                      {subs.map((w, i) => (
                        <React.Fragment key={`s${i}`}>
                          {(words.length > 0 || i > 0) && ", "}
                          <span className="italic text-rubric" title={w.sc}>{w.name}</span>
                        </React.Fragment>
                      ))}
                    </td>
                    {columns.map((c) => (
                      <td key={c.key} className="px-2 py-1 text-center">{formatCell(c.cell(level))}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
