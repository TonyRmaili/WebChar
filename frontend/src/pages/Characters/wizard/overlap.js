/* ═══════════════════════════════════════════════════════════════════
   overlap.js — "you already have that" detection.

   Two distinct problems, deliberately kept apart:

   COLLISION (hard, already happened)
     Two sources committed the same thing. Half Elf grants Stealth and
     Criminal grants Stealth → one of them is wasted. Nothing in the UI
     can undo it except changing race or background, so it surfaces as
     a warning in the Summary.

   SHADOWED (soft, still avoidable)
     An option inside an UNRESOLVED choice is already committed
     somewhere else. Picking it would waste the pick, so the chip is
     flagged in the picker while the player can still choose otherwise.

   Both work off the same commitment map, keyed "family:normalizedValue"
   so "sleight of hand" from a background and "sleightOfHand" from
   SKILL_OPTIONS collapse to one key. That normalization happens in
   wizardHelpers — without it this module silently finds nothing.

   Feats and equipment are included: two sources can hand out the same
   origin feat, and the same item can arrive from a race kit and an
   equipment branch.
   ═══════════════════════════════════════════════════════════════════ */

import { selectedValues } from "./choiceEngine";
import { labelFor } from "./wizardHelpers";

const TRACKED_FAMILIES = [
  "skills", "tools", "languages", "weapons", "armor", "feats", "equipment",
];

const keyOf = (family, value) => `${family}:${value}`;

/**
 * @param {object}   grants     output of collectGrants()
 * @param {Choice[]} choices    every choice currently in play
 * @param {object}   choiceSel  current selections
 *
 * @returns {{
 *   commitments: Map<string, Array<{owner,scope,viaChoice,family,value}>>,
 *   collisions:  Array<{family,value,label,owners:string[],resolvable:boolean}>,
 *   shadowed:    { [choiceId]: { [value]: {owners:string[], label:string} } },
 *   shadowCount: number,
 *   hasAny:      boolean,
 * }}
 */
export function computeOverlap({ grants, choices = [], choiceSel = {} }) {
  const commitments = new Map();

  for (const family of TRACKED_FAMILIES) {
    for (const entry of grants?.[family] || []) {
      const k = keyOf(family, entry.value);
      if (!commitments.has(k)) commitments.set(k, []);
      commitments.get(k).push({ ...entry, family });
    }
  }

  /* ── hard collisions ── */
  const collisions = [];
  for (const [k, entries] of commitments) {
    if (entries.length < 2) continue;

    // Same owner granting the same thing twice is a data quirk, not a
    // player-visible clash — only flag when the owners actually differ.
    const owners = [...new Set(entries.map((e) => e.owner).filter(Boolean))];
    if (owners.length < 2) continue;

    const [family, ...rest] = k.split(":");
    const value = rest.join(":");
    collisions.push({
      family,
      value,
      label: labelFor(value, family),
      owners,
      // If at least one side came from a choice the player can still
      // re-pick, the clash is fixable without changing race/background.
      resolvable: entries.some((e) => !!e.viaChoice),
      entries,
    });
  }

  /* ── soft shadows ── */
  const shadowed = {};
  let shadowCount = 0;

  for (const choice of choices) {
    if (choice.kind === "subrace" || choice.kind === "asi" || choice.kind === "ability") continue;
    if (choice.kind === "equipment") continue; // branches are compared as wholes, not per item

    const picked = new Set(selectedValues(choice, choiceSel[choice.id]));

    for (const option of choice.options || []) {
      const entries = commitments.get(keyOf(option.family, option.value));
      if (!entries || !entries.length) continue;

      // Ignore the player's own pick in THIS choice — that is not a
      // conflict, that is just the selected chip.
      const others = entries.filter((e) => e.viaChoice !== choice.id);
      if (!others.length) continue;

      // If this option is currently selected here AND held elsewhere it
      // is a real waste; if merely offered, it is a warning.
      const owners = [...new Set(others.map((e) => e.owner).filter(Boolean))];
      if (!owners.length) continue;

      if (!shadowed[choice.id]) shadowed[choice.id] = {};
      shadowed[choice.id][option.value] = {
        owners,
        label: option.label,
        selected: picked.has(option.value),
      };
      shadowCount += 1;
    }
  }

  return {
    commitments,
    collisions,
    shadowed,
    shadowCount,
    hasAny: collisions.length > 0 || shadowCount > 0,
  };
}

/** Convenience for the picker: is this one option shadowed? */
export const isShadowed = (overlap, choiceId, value) =>
  !!overlap?.shadowed?.[choiceId]?.[value];

export const shadowInfo = (overlap, choiceId, value) =>
  overlap?.shadowed?.[choiceId]?.[value] || null;

/** Collisions that involve a given choice, for inline messaging. */
export const collisionsForChoice = (overlap, choiceId) =>
  (overlap?.collisions || []).filter((c) =>
    (c.entries || []).some((e) => e.viaChoice === choiceId)
  );