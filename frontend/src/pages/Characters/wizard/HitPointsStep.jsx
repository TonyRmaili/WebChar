import React from "react";
import { INK, InkButton, InkChoice, InkNumber } from "../../../styles/parchment";
import { Note } from "./wizardInk";

/* ═══════════════════════════════════════════════════════════════════
   HitPointsStep — three ways to set max HP. The server works the number
   out (app/builder/derive.max_hp); this step only says how.

     average   level 1 of the first class takes its `hp.first`, every
               later level its `hp.per_level` (the die's average + Con)
     roll      the same, but each later level uses a roll kept here
               (rolls["class:<id>@<level>"]), + Con
     manual    the number typed in

   A level never gives less than 1 HP. With "fill in the rest at random"
   on, levels the randomizer adds are rolled for you in roll mode.
   ═══════════════════════════════════════════════════════════════════ */

const MODES = [
  { value: "average", label: "Average" },
  { value: "roll", label: "Roll" },
  { value: "manual", label: "Manual" },
];

const faces = (die) => Number(String(die || "").replace(/\D/g, "")) || 8;
const rollDie = (die) => 1 + Math.floor(Math.random() * faces(die));

// Every level after the character's first one, with its class's die.
export function rollableLevels(entries, byId) {
  const out = [];
  entries.forEach((e, i) => {
    for (let n = i === 0 ? 2 : 1; n <= e.level; n += 1) out.push({ key: `class:${e.id}@${n}`, die: byId[e.id]?.hit_die, name: byId[e.id]?.name || e.id, n });
  });
  return out;
}

export const rollAll = (entries, byId) => Object.fromEntries(rollableLevels(entries, byId).map((l) => [l.key, rollDie(l.die)]));

export default function HitPointsStep({ entries, byId, hp, onChange, maxHp, conMod }) {
  const levels = rollableLevels(entries, byId);
  const rolls = hp.rolls || {};
  const setRoll = (key, v) => onChange({ ...hp, rolls: { ...rolls, [key]: v } });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <span className={`text-sm italic ${INK.faded}`}>Work it out by</span>
        <InkChoice
          label="Hit point method"
          value={hp.mode}
          onChange={(mode) => onChange({ ...hp, mode, rolls: mode === "roll" && !Object.keys(rolls).length ? rollAll(entries, byId) : rolls })}
          options={MODES}
        />
        {hp.mode === "roll" && levels.length > 0 && (
          <InkButton active onClick={() => onChange({ ...hp, rolls: rollAll(entries, byId) })}>
            roll again
          </InkButton>
        )}
        <span className="ml-auto flex items-baseline gap-3">
          <span className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${INK.faded}`}>Max HP</span>
          {hp.mode === "manual" ? (
            <InkNumber value={hp.manual ?? 0} onChange={(n) => onChange({ ...hp, manual: n ?? 0 })} min={0} fallback={0} aria-label="Max HP" className="h-10 w-20 text-3xl" />
          ) : (
            <span className="text-4xl tabular-nums">{maxHp ?? "—"}</span>
          )}
        </span>
      </div>

      {!entries.length ? (
        <Note>Pick a class first: hit points come from its hit die.</Note>
      ) : hp.mode === "roll" ? (
        levels.length ? (
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 @2xl:grid-cols-3">
            {levels.map((l) => (
              <label key={l.key} className="flex items-baseline gap-2 text-[15px]">
                <span className={`w-28 truncate ${INK.faded}`}>
                  {l.name} {l.n}
                </span>
                <InkNumber
                  value={rolls[l.key] ?? ""}
                  onChange={(n) => setRoll(l.key, n)}
                  min={1}
                  max={faces(l.die)}
                  aria-label={`${l.name} level ${l.n} roll`}
                  className="h-7 w-12 text-center"
                />
                <span className={`text-xs ${INK.faint}`}>
                  {l.die} {conMod ? `${conMod > 0 ? "+" : "−"} ${Math.abs(conMod)}` : ""}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <Note>A level 1 character takes its hit die's maximum; there's nothing to roll.</Note>
        )
      ) : hp.mode === "average" ? (
        <Note>The first level takes the hit die's maximum, every other level its average, each with your Constitution modifier.</Note>
      ) : (
        <Note>The number you write is the character's maximum.</Note>
      )}
    </div>
  );
}
