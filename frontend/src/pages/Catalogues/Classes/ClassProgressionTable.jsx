import React, { useMemo, useState } from "react";
import { ordinal, humanizeKey, formatExtra } from "./classHelpers";
import { Chevron } from "../../../styles/parchmentForm";

/* The level-by-level table: level, proficiency bonus, features, the class's
   own columns (extras) and spell slots. Written on hairlines with a faint
   wash on every other row; the heading folds it away. */
export default function ClassProgressionTable({ selectedClassData }) {
  const [open, setOpen] = useState(true);

  const progression = useMemo(() => {
    const levels = selectedClassData?.class?.level_progression;
    if (!levels?.length) return null;

    // Union of extras keys, first-seen order preserved.
    const extraKeys = [];
    for (const lvl of levels) {
      if (lvl.extras) {
        for (const k of Object.keys(lvl.extras)) {
          if (!extraKeys.includes(k)) extraKeys.push(k);
        }
      }
    }

    // Spell slot column count = longest spell_slots array. Skip the block entirely
    // if every value across every level is zero/null (non-casters).
    let slotCount = 0;
    let hasSpells = false;
    for (const lvl of levels) {
      if (Array.isArray(lvl.spell_slots)) {
        slotCount = Math.max(slotCount, lvl.spell_slots.length);
        if (lvl.spell_slots.some((n) => n > 0)) hasSpells = true;
      }
    }

    return { levels, extraKeys, slotCount: hasSpells ? slotCount : 0 };
  }, [selectedClassData]);

  if (!progression) return null;

  const th = "px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faded";

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="group mb-3 flex w-full items-baseline gap-2 text-left"
      >
        <span className="self-center">
          <Chevron open={open} />
        </span>
        <h4 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-faded transition group-hover:text-rubric">Class Progression</h4>
        <span className="h-px flex-1 translate-y-[-3px] bg-rule/30" />
        <span className="shrink-0 text-xs italic text-ink-faded">{open ? "hide" : "show"}</span>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule/40">
                <th className={`${th} text-left`}>Level</th>
                <th className={`${th} whitespace-nowrap text-center`}>Prof. Bonus</th>
                <th className={`${th} text-left`}>Features</th>

                {progression.extraKeys.map((key) => (
                  <th key={key} className={`${th} whitespace-nowrap text-center`}>
                    {humanizeKey(key)}
                  </th>
                ))}

                {progression.slotCount > 0 && (
                  <th className={`${th} border-l border-rule/40 text-center`} colSpan={progression.slotCount}>
                    Spell Slots per Spell Level
                  </th>
                )}
              </tr>

              {progression.slotCount > 0 && (
                <tr className="border-b border-rule/40">
                  <th colSpan={3 + progression.extraKeys.length} />
                  {Array.from({ length: progression.slotCount }).map((_, i) => (
                    <th key={i} className={`px-2 py-0.5 text-center text-xs font-semibold text-ink-faded ${i === 0 ? "border-l border-rule/40" : ""}`}>
                      {ordinal(i + 1)}
                    </th>
                  ))}
                </tr>
              )}
            </thead>

            <tbody>
              {progression.levels.map((lvl) => (
                <tr key={lvl.level} className="border-b border-dotted border-rule/25 even:bg-ink/[0.03]">
                  <td className="px-2 py-1 font-semibold text-ink">{ordinal(lvl.level)}</td>
                  <td className="px-2 py-1 text-center">+{lvl.proficiency_bonus}</td>
                  <td className="px-2 py-1 text-ink">
                    {lvl.feature_names?.length ? lvl.feature_names.join(", ") : <span className="text-ink-faint">—</span>}
                  </td>

                  {progression.extraKeys.map((key) => (
                    <td key={key} className="px-2 py-1 text-center">
                      {formatExtra(lvl.extras?.[key])}
                    </td>
                  ))}

                  {progression.slotCount > 0 &&
                    Array.from({ length: progression.slotCount }).map((_, i) => (
                      <td key={i} className={`px-2 py-1 text-center ${i === 0 ? "border-l border-rule/40" : ""}`}>
                        {formatExtra(lvl.spell_slots?.[i])}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}