import { HOMEBREW, pruneEmpty, formatSize, titleCase, withFeatureTexts } from "../catalogueHelpers";
import {
  emptyHeaderForm, headerToForm, formToHeader, emptyGrantsForm, grantsToForm, formToGrants,
} from "../catalogueForms";

/* ═══════════════════════════════════════════════════════════════════
   raceHelpers — what only races need. The shared words are in
   ../catalogueHelpers, the shared form conversion in ../catalogueForms.

   A race record (final/races.json):
     header · text · size · creature_types · grants · choices
     · subraces · features
   A race with subraces needs one picked. A subrace only holds what it
   adds or changes:
     size           its own size, when it differs
     replaces       race grants it replaces instead of adding to
                    (["ability"]: use the subrace's bonuses, not the race's)
     replaces_text  the race's named text blocks its text replaces
   ═══════════════════════════════════════════════════════════════════ */

// The race grants a subrace can replace.
export const REPLACEABLE = ["ability", "skills", "tools", "languages", "speed", "senses", "defenses", "spells", "weapons", "feats"];

// "Small or Medium Humanoid"
export const raceSubtitle = (race) =>
  [formatSize(race.size), (race.creature_types || []).map(titleCase).join(" or ")].filter(Boolean).join(" ");

// The short note on a race's row: "4 subraces", else its size.
export const raceRowMeta = (race) => {
  const n = race.subraces?.length || 0;
  return n ? `${n} ${n === 1 ? "subrace" : "subraces"}` : formatSize(race.size);
};

/* ─── subraces ───────────────────────────────────────────────────── */

export const emptySubrace = () => ({
  name: "", text: "", size: [], grants: emptyGrantsForm(), replaces: [], replacesText: [], features: [], rest: {},
});

const subraceToForm = (sr, copy) => {
  const { id, kind, name, source, edition, text, size, grants, choices, replaces, replaces_text, srd, reprinted_as, features, ...rest } = sr;
  return {
    id: copy ? undefined : id,
    name: name || "",
    text: text || "",
    size: size || [],
    grants: grantsToForm(grants, choices),
    replaces: replaces || [],
    replacesText: replaces_text || [],
    features: features || [],
    rest,
  };
};

const formToSubrace = (sr, form) => {
  const { grants, choices } = formToGrants(sr.grants);
  return {
    ...pruneEmpty({
      ...sr.rest,
      ...(sr.id ? { id: sr.id } : {}),
      kind: "subrace",
      name: sr.name.trim(),
      source: HOMEBREW,
      edition: form.edition,
      text: sr.text,
      size: sr.size,
      replaces: sr.replaces,
      replaces_text: sr.replacesText,
      features: withFeatureTexts(sr.features, sr.text, sr.name),
    }),
    grants,
    choices,
  };
};

/* ─── race ↔ form ────────────────────────────────────────────────── */

export const emptyRaceForm = () => ({
  ...emptyHeaderForm(),
  size: ["medium"],
  creatureTypes: ["humanoid"],
  grants: { ...emptyGrantsForm(), speed: { walk: 30 } },
  subraces: [],
  features: [],
});

export function raceToForm(race, { copy = false } = {}) {
  return {
    ...headerToForm(race, { copy }),
    size: race.size || [],
    creatureTypes: race.creature_types || ["humanoid"],
    grants: grantsToForm(race.grants, race.choices),
    subraces: (race.subraces || []).map((sr) => subraceToForm(sr, copy)),
    features: race.features || [],
  };
}

export function formToRace(form, original) {
  const { grants, choices } = formToGrants(form.grants);
  return {
    ...pruneEmpty({
      ...formToHeader(form, "race", original),
      subraces: form.subraces.filter((sr) => sr.name.trim()).map((sr) => formToSubrace(sr, form)),
      features: withFeatureTexts(form.features, form.text, form.name),
    }),
    size: form.size.length ? form.size : ["medium"],
    creature_types: form.creatureTypes.length ? form.creatureTypes : ["humanoid"],
    grants,
    choices,
  };
}
