import React, { useMemo } from "react";
import { INK, InkButton, InkChoice, InkNumber, SubHeading } from "../../../styles/parchment";
import { Note } from "./wizardInk";
import { computeHp, hpLevels, hitDieMax, hitDieAverage, classDisplayName } from "./classEngine";

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
  { value: "average", label: "Average" },
  { value: "roll", label: "Roll" },
  { value: "manual", label: "Manual" },
];

/* The breakdown rows only carry a class key; look the edition back up so
   the label matches what the Class step shows. */
const editionFor = (entries, key) => entries.find((e) => e.key === key)?.edition;

export default function HitPointsStep({
  classes,
  entries = [],
  conMod = 0,
  hp, // { mode, manual, rolls }
  onChangeMode,
  onChangeManual,
  onRoll,
}) {
  const result = useMemo(() => computeHp({ entries, classes, conMod, ...hp }), [entries, classes, conMod, hp]);
  const levels = useMemo(() => hpLevels(entries, classes), [entries, classes]);
  const hasClasses = levels.length > 0;
  const firstDie = levels[0]?.die;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <span className={`text-sm italic ${INK.faded}`}>Work it out by</span>
        <InkChoice label="Hit point method" value={hp.mode} onChange={onChangeMode} options={MODES} />
        {hp.mode === "roll" && hasClasses && (
          <InkButton active onClick={onRoll}>
            {Object.keys(hp.rolls || {}).length ? "roll again" : "roll the hit dice"}
          </InkButton>
        )}
        <span className="ml-auto flex items-baseline gap-3">
          <span className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${INK.faded}`}>Max HP</span>
          {hp.mode === "manual" ? (
            <InkNumber value={hp.manual ?? 0} onChange={(n) => onChangeManual(n ?? 0)} min={0} fallback={0} aria-label="Max HP" className="h-10 w-20 text-3xl" />
          ) : (
            <span className="text-4xl tabular-nums">{result.total}</span>
          )}
        </span>
      </div>

      {!hasClasses && hp.mode !== "manual" && <Note>Pick a class first — hit dice come from the class you choose.</Note>}
      {hp.mode === "manual" && <Note>Nothing is calculated in manual mode. Whatever you write is sent as it is.</Note>}

      {hp.mode !== "manual" && hasClasses && (
        <div>
          <SubHeading>
            Level by level <span className={`ml-2 normal-case tracking-normal italic ${INK.faint}`}>CON {conMod >= 0 ? `+${conMod}` : conMod} each level</span>
          </SubHeading>
          <ul className="grid grid-cols-1 gap-x-8 @xl:grid-cols-2 @4xl:grid-cols-3">
            {result.rows.map((row, i) => (
              <li key={i} className="flex items-baseline py-0.5 text-sm">
                <span className={`w-6 shrink-0 tabular-nums ${INK.faint}`}>{i + 1}</span>
                <span className={`truncate ${INK.faded}`}>{classDisplayName(classes, row.classKey, editionFor(entries, row.classKey))}</span>
                <span aria-hidden="true" className="mx-1.5 min-w-[1rem] flex-1 translate-y-[-4px] border-b-2 border-dotted border-[#7b6346]/30" />
                <span className="shrink-0 tabular-nums">
                  <span className={row.first ? `font-semibold ${INK.rubric}` : ""}>{row.base}</span>
                  <span className={INK.faint}>
                    {row.con >= 0 ? " + " : " − "}
                    {Math.abs(row.con)} ={" "}
                  </span>
                  <span className="font-semibold">{row.gain}</span>
                </span>
              </li>
            ))}
          </ul>
          <Note className="mt-2">
            <span className={INK.rubric}>Red</span>: level 1 of your first class takes the die's maximum
            {firstDie ? ` (${hitDieMax(firstDie)} on a ${firstDie})` : ""}.
            {hp.mode === "average" && firstDie ? ` Later levels use the average — ${hitDieAverage(firstDie)} on a ${firstDie}.` : ""}
          </Note>
        </div>
      )}
    </div>
  );
}