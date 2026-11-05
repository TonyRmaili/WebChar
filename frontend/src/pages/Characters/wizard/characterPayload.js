import { editionOf } from "./wizardHelpers";

/* ═══════════════════════════════════════════════════════════════════
   characterPayload.js — what the player SELECTED, nothing else.

   This file used to build a finished character sheet: it resolved
   choices into grants, turned grants into skills, proficiencies,
   inventory rows and effects, then computed HP, proficiency bonus, XP
   and hit dice on top. The backend then had to redo all of it for
   anything the player left blank or asked to be randomized, which
   meant the 5e rules lived in two codebases at once.

   They now live in one. This file sends the player's raw choices and
   the backend builds the sheet from the same catalogue data the
   pickers were drawn from.

   ── What is deliberately NOT here ──────────────────────────────────
   No ability_scores, skills, proficiencies, inventory, effects,
   health, pb, exp, hit_dice, speed, senses, offense or spellbook.
   Every one of those is derivable from `selections` plus the
   catalogues, so sending them only creates two versions to reconcile.

   No `pending.unresolved` either, and that is the important one. The
   backend reads the same background and class files the wizard does,
   so it can see for itself that `bg.equipment.0` has no entry in
   `choices` and is therefore still open. Unresolved is DERIVED, never
   transmitted, so it can't drift out of sync.

   No origin feats from the background. The background data already
   names them, so the backend reads them there.

   No `editions` either. The "Ruleset" chips in BuildWizard filter
   which content the PICKERS show; they are not a property of the
   character, whose editions are per-entity and deliberately mixable —
   a Classic race with a 2024 background and one class of each. The
   backend rolls from edition "one", as randomize_race and
   randomize_bg already do.

   ── choices ────────────────────────────────────────────────────────
   `choiceSel` passed through as-is, keyed by the ids choiceEngine and
   classEngine already generate ("bg.equipment.0", "race.prof.skills",
   "class.fighter.prof.skills.0"). Values are an array of option
   values, except kind:"asi" which is { mode, picks } — see
   choiceEngine's Selection notes. The ids are the shared vocabulary
   between the two sides, so keep them stable.

   Everything choiceEngine still computes — grants, overlap warnings,
   the summary panel, the HP preview — is for drawing the screen only
   and is thrown away on submit.
   ═══════════════════════════════════════════════════════════════════ */

/* Name alone is not unique — there are two Acolytes (PHB and XPHB) and
   two Archaeologists with different mechanics, so source always rides
   along. Edition is not derivable from source either: Carouser is
   source "ABH" but edition "one". */
const entityRef = (entity) =>
  entity
    ? { name: entity.name, source: entity.source, edition: editionOf(entity) }
    : null;

export function buildCharacterPayload({
  name,
  random = false,
  targetLevel = null,
  abilityMethod,
  abilityScores,
  selectedRace,
  subrace,
  selectedBackground,
  classEntries = [],
  choices = [],
  choiceSel = {},
  hp = { mode: "average", manual: 0, rolls: {} },
}) {
  /* Only the choices the wizard is currently offering. choiceSel can
     still hold keys from a race or background that was swapped out —
     dropKeys clears most of them, but this is the backstop so stale
     picks never reach the backend. */
  const liveIds = new Set((choices || []).map((c) => c.id));
  const picked = {};
  for (const [id, value] of Object.entries(choiceSel || {})) {
    if (liveIds.has(id)) picked[id] = value;
  }

  return {
    name: String(name || "").trim(),

    /* ── randomizer ──
       `random` turns backend auto-completion on at all. `target_level`
       is "random" for no cap, or a number the backend fills up to, and
       is null whenever the randomizer is off. */
    random,
    target_level: random ? targetLevel : null,

    /* ── ability scores ──
       The METHOD and the raw rolled/assigned numbers only. Racial and
       background bonuses are applied by the backend, so the base
       numbers stay recoverable instead of being fused into a total. */
    ability_method: abilityMethod,
    base_scores: abilityScores,

    /* Stored rolls travel so HP doesn't change on every recalculation.
       Levels the backend adds have no roll and take the average. */
    hp: {
      mode: hp?.mode || "average",
      manual: hp?.manual ?? 0,
      rolls: hp?.rolls || {},
    },

    selections: {
      /* Subrace is sent as { name, source }. Two subraces can share a name
         (Elf/PHB has two Eladrin), so the source is what picks the right one.
         Null when there is no subrace. */
      race: selectedRace
        ? {
            ...entityRef(selectedRace),
            subrace: subrace
              ? { name: subrace.name, source: subrace.source ?? selectedRace.source }
              : null,
          }
        : null,
      background: entityRef(selectedBackground),

      /* Ordered: index 0 is the primary class, the only one granting
         full starting proficiencies and equipment. `primary` is
         redundant with the order but kept explicit so the backend
         never depends on array order surviving a round trip. */
      classes: (classEntries || []).map((entry, index) => ({
        name: entry.key,
        edition: entry.edition,
        level: entry.level,
        subclass: entry.subclass,
        feats: (entry.feats || []).map((f) => ({
          name: f.name,
          source: f.source,
        })),
        primary: index === 0,
      })),

      choices: picked,
    },
  };
}

export default buildCharacterPayload;