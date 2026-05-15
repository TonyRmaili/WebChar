import React, { useMemo, useState } from "react";
import { ordinal, humanizeKey, formatExtra } from "./classHelpers";

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

  return (
    <div>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center gap-2 text-lg text-lime-400 mb-2 hover:text-lime-300 transition-colors"
      >
        <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        Class Progression
        <span className="text-xs text-slate-500 font-normal">
          ({open ? "hide" : "show"})
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-amber-400 border-b border-slate-700">
                <th className="px-2 py-1 text-left font-semibold">Level</th>
                <th className="px-2 py-1 text-center font-semibold whitespace-nowrap">
                  Prof. Bonus
                </th>
                <th className="px-2 py-1 text-left font-semibold">Features</th>

                {progression.extraKeys.map((key) => (
                  <th key={key} className="px-2 py-1 text-center font-semibold whitespace-nowrap">
                    {humanizeKey(key)}
                  </th>
                ))}

                {progression.slotCount > 0 && (
                  <th
                    className="px-2 py-1 text-center font-semibold border-l border-slate-700"
                    colSpan={progression.slotCount}
                  >
                    Spell Slots per Spell Level
                  </th>
                )}
              </tr>

              {progression.slotCount > 0 && (
                <tr className="text-amber-400 border-b border-slate-700">
                  <th colSpan={3 + progression.extraKeys.length} />
                  {Array.from({ length: progression.slotCount }).map((_, i) => (
                    <th
                      key={i}
                      className={`px-2 py-0.5 text-center text-xs font-semibold ${
                        i === 0 ? "border-l border-slate-700" : ""
                      }`}
                    >
                      {ordinal(i + 1)}
                    </th>
                  ))}
                </tr>
              )}
            </thead>

            <tbody>
              {progression.levels.map((lvl, rowIdx) => (
                <tr
                  key={lvl.level}
                  className={rowIdx % 2 === 0 ? "bg-slate-900" : "bg-slate-800"}
                >
                  <td className="px-2 py-1 font-semibold text-slate-100">
                    {ordinal(lvl.level)}
                  </td>
                  <td className="px-2 py-1 text-center">+{lvl.proficiency_bonus}</td>
                  <td className="px-2 py-1 text-cyan-300">
                    {lvl.feature_names?.length ? lvl.feature_names.join(", ") : "—"}
                  </td>

                  {progression.extraKeys.map((key) => (
                    <td key={key} className="px-2 py-1 text-center">
                      {formatExtra(lvl.extras?.[key])}
                    </td>
                  ))}

                  {progression.slotCount > 0 &&
                    Array.from({ length: progression.slotCount }).map((_, i) => (
                      <td
                        key={i}
                        className={`px-2 py-1 text-center ${
                          i === 0 ? "border-l border-slate-700" : ""
                        }`}
                      >
                        {formatExtra(lvl.spell_slots?.[i])}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}