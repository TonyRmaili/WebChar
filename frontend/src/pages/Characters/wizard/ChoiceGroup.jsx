import React from "react";
import {
  selectedValues, remainingFor, isResolved,
  choiceTitle, emptySelection, DEFAULT_ASI_MODE,
} from "./choiceEngine";
import { shadowInfo } from "./overlap";
import { chip, overlapChip } from "./wizardHelpers";

/* ═══════════════════════════════════════════════════════════════════
   ChoiceGroup — renders ONE normalized choice, whatever its source.

   Deliberately dumb: it never asks whether a choice came from a race,
   a background or (later) a class. Adding classes means writing an
   adapter in choiceEngine, not touching this file.

   Handles kinds: ability | asi | proficiency | equipment.
   `subrace` is rendered by RaceStep, because it needs the race's
   sub_races array rather than the generic option pool.
   ═══════════════════════════════════════════════════════════════════ */

function Header({ choice, sel, subrace }) {
  const remaining = remainingFor(choice, sel);
  const done = isResolved(choice, sel, subrace);

  return (
    <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
      <span className="text-[11px] uppercase tracking-wider text-amber-400">
        {choiceTitle(choice)}
      </span>

      <span className="text-[11px] text-slate-500">
        {choice.kind === "equipment"
          ? "pick one"
          : `choose ${choice.count}${choice.kind === "ability" && choice.amount ? ` (+${choice.amount} each)` : ""}`}
        {done ? " · ✓" : ` · ${remaining} left`}
      </span>

      {choice.inferred && (
        <span
          title={`The source data lists "${choice.inferredFrom}" as always granted, but that is a category rather than a specific proficiency — so it is treated as a choice.`}
          className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded
                     border border-sky-500/40 text-sky-300/90 bg-sky-500/10"
        >
          inferred
        </span>
      )}

      {choice.owner && (
        <span className="text-[10px] text-slate-500 italic ml-auto">
          from {choice.owner}
        </span>
      )}
    </div>
  );
}

/* ───────── warning shown under a pool containing shadowed options ───────── */
function ShadowNote({ count }) {
  if (!count) return null;
  return (
    <div className="mt-1.5 flex items-start gap-1.5 text-[10px] text-rose-300/90">
      <span className="mt-[1px]">⚠</span>
      <span>
        {count === 1 ? "1 option is" : `${count} options are`} already granted
        elsewhere — outlined in red. Picking {count === 1 ? "it" : "one"} would
        waste the choice.
      </span>
    </div>
  );
}

/* ───────── a pool of selectable chips ───────── */
function ChipPool({ choice, sel, overlap, onToggle }) {
  const selected = selectedValues(choice, sel);
  let shadowCount = 0;

  const chips = (choice.options || []).map((option) => {
    const info = shadowInfo(overlap, choice.id, option.value);
    const isSel = selected.includes(option.value);
    if (info) shadowCount += 1;

    return (
      <button
        key={`${option.family}:${option.value}`}
        type="button"
        onClick={() => onToggle(choice.id, option.value, choice.count)}
        title={info ? `Already granted by ${info.owners.join(", ")}` : undefined}
        className={info ? overlapChip(isSel) : chip(isSel)}
      >
        {option.label}
        {info && <span className="ml-1 opacity-70">⚠</span>}
      </button>
    );
  });

  return (
    <>
      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
        {chips}
      </div>
      <ShadowNote count={shadowCount} />
    </>
  );
}

/* ───────── 2024 background ability score increase ─────────
   Either +2 to one listed ability and +1 to another, or +1 to all
   three. Order matters in `picks`: picks[0] takes the +2. */
function AsiPicker({ choice, sel, onAsiChange }) {
  const state = sel || emptySelection(choice);
  const mode = state.mode || DEFAULT_ASI_MODE;
  const picks = state.picks || [];

  const setMode = (next) =>
    onAsiChange(choice.id, { mode: next, picks: next === "1-1-1" ? [] : picks.slice(0, 2) });

  // picks is positional and fixed-length: [ +2 ability, +1 ability ].
  // Empty slots stay null so slot 1 can be filled before slot 0.
  const setPick = (slot, value) => {
    const next = [picks[0] ?? null, picks[1] ?? null];
    const other = slot === 0 ? 1 : 0;

    if (next[slot] === value) {
      next[slot] = null;                       // toggle off
    } else {
      // Picking a value already used in the other slot swaps the two
      // rather than silently granting the same ability twice.
      if (next[other] === value) next[other] = next[slot];
      next[slot] = value;
    }
    onAsiChange(choice.id, { mode, picks: next });
  };

  const Row = ({ slot, label }) => (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] font-semibold tabular-nums text-amber-300 w-7">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {choice.options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setPick(slot, o.value)}
            className={chip(picks[slot] === o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="inline-flex gap-1 rounded-lg border border-slate-700 bg-slate-900/50 p-1">
        {[
          { id: "2-1", label: "+2 / +1" },
          { id: "1-1-1", label: "+1 / +1 / +1" },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
              mode === m.id
                ? "bg-amber-500/20 text-amber-200 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.4)]"
                : "text-slate-400 hover:text-amber-300"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "1-1-1" ? (
        <div className="flex flex-wrap gap-1.5">
          {choice.options.map((o) => (
            <span key={o.value} className={chip(true)}>{o.label} +1</span>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Row slot={0} label="+2" />
          <Row slot={1} label="+1" />
        </div>
      )}
    </div>
  );
}

/* ───────── equipment A / B / C … ───────── */
function EquipmentPicker({ choice, sel, onToggle }) {
  const selected = selectedValues(choice, sel);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {(choice.branches || []).map((branch) => {
        const isSel = selected.includes(branch.key);
        return (
          <button
            key={branch.key}
            type="button"
            onClick={() => onToggle(choice.id, branch.key, 1)}
            className={`text-left px-3 py-2 rounded-lg border transition-colors
              ${isSel
                ? "border-amber-500/60 bg-amber-500/10"
                : "border-slate-700 bg-slate-800/40 hover:border-amber-500/40"}`}
          >
            <div className={`text-[10px] uppercase tracking-wider mb-0.5 ${isSel ? "text-amber-300" : "text-slate-400"}`}>
              Option {branch.key}
            </div>
            <div className={`text-xs leading-snug ${isSel ? "text-amber-100" : "text-slate-300"}`}>
              {branch.summary}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ───────── entry point ───────── */
export default function ChoiceGroup({ choice, sel, overlap, onToggle, onAsiChange, subrace }) {
  if (!choice) return null;

  return (
    <div>
      <Header choice={choice} sel={sel} subrace={subrace} />

      {choice.kind === "asi" ? (
        <AsiPicker choice={choice} sel={sel} onAsiChange={onAsiChange} />
      ) : choice.kind === "equipment" ? (
        <EquipmentPicker choice={choice} sel={sel} onToggle={onToggle} />
      ) : (
        <ChipPool choice={choice} sel={sel} overlap={overlap} onToggle={onToggle} />
      )}
    </div>
  );
}