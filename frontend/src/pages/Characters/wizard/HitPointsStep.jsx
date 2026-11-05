import React, { useMemo } from "react";
import { chip } from "./wizardHelpers";
import {
  computeHp, hpLevels, hitDieMax, hitDieAverage, classDisplayName,
} from "./classEngine";

/* ═══════════════════════════════════════════════════════════════════
   HitPointsStep — three ways to set max HP.

     average   level 1 of the first class takes the die maximum, every
               later level takes the 5e average (d6→4, d8→5, d10→6,
               d12→7), plus CON per level.
     roll      same, but each later level rolls its own die. Rolls are
               stored so the number doesn't change on re-render.
     manual    type a number and nothing is computed.

   The max-on-first-level rule applies to the FIRST class only — a level
   taken by multiclassing into something else is a normal level.
   ═══════════════════════════════════════════════════════════════════ */

const MODES = [
  { id: "average", label: "Average" },
  { id: "roll", label: "Roll" },
  { id: "manual", label: "Manual" },
];

export default function HitPointsStep({
  classes,
  entries = [],
  conMod = 0,
  hp,                 // { mode, manual, rolls }
  onChangeMode,
  onChangeManual,
  onRoll,
}) {
  const result = useMemo(
    () => computeHp({ entries, classes, conMod, ...hp }),
    [entries, classes, conMod, hp]
  );

  const levels = useMemo(() => hpLevels(entries, classes), [entries, classes]);
  const hasClasses = levels.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex gap-1 rounded-lg border border-slate-700 bg-slate-900/50 p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChangeMode(m.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                hp.mode === m.id
                  ? "bg-amber-500/20 text-amber-200 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.4)]"
                  : "text-slate-400 hover:text-amber-300"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {hp.mode === "roll" && hasClasses && (
          <button
            type="button"
            onClick={onRoll}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-900
                       bg-gradient-to-r from-amber-900 to-amber-700 px-3 py-1.5 text-xs
                       font-semibold text-amber-100 shadow-[0_0_8px_rgba(245,158,11,0.25)]
                       transition hover:from-amber-800 hover:to-amber-600"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8" cy="8" r="1.2" /><circle cx="16" cy="8" r="1.2" />
              <circle cx="12" cy="12" r="1.2" />
              <circle cx="8" cy="16" r="1.2" /><circle cx="16" cy="16" r="1.2" />
            </svg>
            {Object.keys(hp.rolls || {}).length ? "Reroll" : "Roll hit dice"}
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-slate-400">Max HP</span>
          {hp.mode === "manual" ? (
            <input
              type="number"
              min={0}
              value={hp.manual ?? 0}
              onChange={(e) => onChangeManual(Number(e.target.value) || 0)}
              className="w-24 rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-center
                         text-lg font-bold tabular-nums text-amber-100 outline-none
                         focus:border-amber-500/60
                         [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
          ) : (
            <span className="text-2xl font-bold tabular-nums text-amber-100">{result.total}</span>
          )}
        </div>
      </div>

      {!hasClasses && hp.mode !== "manual" && (
        <p className="text-xs text-slate-500 italic">
          Pick a class first — hit dice come from the class you choose.
        </p>
      )}

      {hp.mode === "manual" && (
        <p className="text-xs text-slate-500 italic">
          Nothing is calculated in manual mode. Whatever you type is sent as-is.
        </p>
      )}

      {/* per-level breakdown */}
      {hp.mode !== "manual" && hasClasses && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-[10px] uppercase tracking-wider text-amber-400">Breakdown</span>
            <span className="text-[10px] text-slate-500">
              CON {conMod >= 0 ? `+${conMod}` : conMod} per level
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3 lg:grid-cols-4">
            {result.rows.map((row, i) => (
              <div key={i} className="flex items-baseline gap-1.5 text-[11px]">
                <span className="w-5 shrink-0 tabular-nums text-slate-500">{i + 1}</span>
                <span className="truncate text-slate-400">
                  {classDisplayName(classes, row.classKey, entryEditionFor(entries, row.classKey))}
                </span>
                <span className="ml-auto shrink-0 tabular-nums">
                  <span className={row.first ? "text-amber-300 font-semibold" : "text-slate-300"}>
                    {row.base}
                  </span>
                  <span className="text-slate-600">
                    {row.con >= 0 ? "+" : ""}{row.con}
                  </span>
                  <span className="text-slate-500"> = </span>
                  <span className="text-amber-100 font-semibold">{row.gain}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-2 border-t border-slate-700/60 pt-2 text-[10px] text-slate-500">
            <span className="text-amber-300">■</span>
            <span>
              Level 1 of your first class takes the die maximum
              {levels[0]?.die ? ` (${hitDieMax(levels[0].die)} on a ${levels[0].die})` : ""}.
              {hp.mode === "average" && levels[0]?.die
                ? ` Later levels use the average${
                    levels[0].die ? ` — ${hitDieAverage(levels[0].die)} on a ${levels[0].die}` : ""
                  }.`
                : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* The breakdown rows only carry a class key; look the edition back up so
   the label matches what the Class step shows. */
function entryEditionFor(entries, key) {
  return entries.find((e) => e.key === key)?.edition;
}