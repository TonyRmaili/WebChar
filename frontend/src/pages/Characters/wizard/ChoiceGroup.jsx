import React from "react";
import { INK, InkChoice } from "../../../styles/parchment";
import {
  selectedValues, remainingFor, isResolved,
  choiceTitle, emptySelection, DEFAULT_ASI_MODE,
} from "./choiceEngine";
import { shadowInfo } from "./overlap";
import { ChoiceHead, Pick, PickRow } from "./wizardInk";

/* ═══════════════════════════════════════════════════════════════════
   ChoiceGroup — renders ONE normalized choice, whatever its source.

   Deliberately dumb: it never asks whether a choice came from a race,
   a background or a class. Adding a source means writing an adapter
   in choiceEngine, not touching this file.

   Handles kinds: ability | asi | proficiency | equipment.
   `subrace` is rendered by RaceStep, because it needs the race's
   sub_races array rather than the generic option pool.
   ═══════════════════════════════════════════════════════════════════ */

function Header({ choice, sel, subrace }) {
  const done = isResolved(choice, sel, subrace);
  const what =
    choice.kind === "equipment"
      ? "pick one"
      : `choose ${choice.count}${choice.kind === "ability" && choice.amount ? ` (+${choice.amount} each)` : ""}`;

  return (
    <ChoiceHead
      title={choiceTitle(choice)}
      need={done ? `${what} · done` : `${what} · ${remainingFor(choice, sel)} left`}
      done={done}
      owner={choice.owner}
    >
      {choice.inferred && (
        <span
          title={`The source data lists "${choice.inferredFrom}" as always granted, but that is a category rather than a specific proficiency — so it is treated as a choice.`}
          className={`cursor-help text-xs italic underline decoration-dotted underline-offset-4 ${INK.faded}`}
        >
          read as a choice
        </span>
      )}
    </ChoiceHead>
  );
}

/* ───────── a pool of options ───────── */
function OptionPool({ choice, sel, overlap, onToggle }) {
  const selected = selectedValues(choice, sel);
  let shadowCount = 0;

  const picks = (choice.options || []).map((option) => {
    const info = shadowInfo(overlap, choice.id, option.value);
    if (info) shadowCount += 1;
    return (
      <Pick
        key={`${option.family}:${option.value}`}
        on={selected.includes(option.value)}
        warn={!!info}
        title={info ? `Already granted by ${info.owners.join(", ")}` : undefined}
        onClick={() => onToggle(choice.id, option.value, choice.count)}
      >
        {option.label}
      </Pick>
    );
  });

  return (
    <>
      <PickRow className="max-h-44 overflow-y-auto pr-1">{picks}</PickRow>
      {shadowCount > 0 && (
        <p className={`mt-1 text-xs italic ${INK.rubric}`}>
          ⚠ {shadowCount === 1 ? "One option is" : `${shadowCount} options are`} already yours from elsewhere (wavy underline) —
          picking {shadowCount === 1 ? "it" : "one"} would waste the choice.
        </p>
      )}
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
      next[slot] = null; // toggle off
    } else {
      // Picking a value already used in the other slot swaps the two
      // rather than silently granting the same ability twice.
      if (next[other] === value) next[other] = next[slot];
      next[slot] = value;
    }
    onAsiChange(choice.id, { mode, picks: next });
  };

  return (
    <div className="space-y-1.5">
      <InkChoice
        label="How to spread the bonus"
        value={mode}
        onChange={setMode}
        options={[
          { value: "2-1", label: "+2 and +1" },
          { value: "1-1-1", label: "+1 to all three" },
        ]}
      />
      {mode === "1-1-1" ? (
        <p className="text-[15px]">
          <span className={INK.rubric}>+1</span> each to {choice.options.map((o) => o.label).join(", ")}
        </p>
      ) : (
        [0, 1].map((slot) => (
          <div key={slot} className="flex flex-wrap items-baseline gap-x-4">
            <span className={`w-7 shrink-0 text-sm font-semibold tabular-nums ${INK.rubric}`}>{slot === 0 ? "+2" : "+1"}</span>
            <PickRow>
              {choice.options.map((o) => (
                <Pick key={o.value} round on={picks[slot] === o.value} onClick={() => setPick(slot, o.value)}>
                  {o.label}
                </Pick>
              ))}
            </PickRow>
          </div>
        ))
      )}
    </div>
  );
}

/* ───────── equipment A / B / C … ───────── */
function EquipmentPicker({ choice, sel, onToggle }) {
  const selected = selectedValues(choice, sel);
  return (
    <div className="space-y-1">
      {(choice.branches || []).map((branch) => (
        <div key={branch.key} className="flex items-start gap-3">
          <Pick round on={selected.includes(branch.key)} onClick={() => onToggle(choice.id, branch.key, 1)}>
            {branch.key.length <= 2 ? `Option ${branch.key}` : branch.key === "KIT" ? "Equipment" : "Gold"}
          </Pick>
          <span className={`pt-0.5 text-sm italic leading-snug ${INK.faded}`}>{branch.summary}</span>
        </div>
      ))}
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
        <OptionPool choice={choice} sel={sel} overlap={overlap} onToggle={onToggle} />
      )}
    </div>
  );
}