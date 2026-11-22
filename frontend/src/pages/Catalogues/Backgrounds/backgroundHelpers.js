import { pruneEmpty, nameFromId, titleCase, FEAT_CATEGORIES, describeChoice } from "../catalogueHelpers";
import {
  emptyHeaderForm, headerToForm, formToHeader, emptyGrantsForm, grantsToForm, formToGrants,
  bundleToForm, formToBundle,
} from "../catalogueForms";

/* ═══════════════════════════════════════════════════════════════════
   backgroundHelpers — what only backgrounds need. The shared words are
   in ../catalogueHelpers, the shared form conversion in ../catalogueForms.

   A background record (final/backgrounds.json):
     header · text · grants · choices · features
   Its one choice of its own is the starting-equipment bundle (A: items
   and gold / B: gold); the rest is the shared grants form.
   ═══════════════════════════════════════════════════════════════════ */

const EQUIPMENT_ID = "starting_equipment";
const isEquipment = (c) => c?.type === "bundle" && (c.id === EQUIPMENT_ID || /equipment/i.test(c.label || ""));

export const emptyBackgroundForm = () => ({
  ...emptyHeaderForm(),
  grants: { ...emptyGrantsForm(), ability: { from: [], sets: ["2/1", "1/1/1"] } },
  equipment: [],          // the options of the "choose one" equipment pick
  equipmentId: EQUIPMENT_ID,
  equipmentLabel: "Starting Equipment",
  features: [],           // kept as they are
});

export function backgroundToForm(bg, { copy = false } = {}) {
  const choices = bg.choices || [];
  const equipment = choices.find(isEquipment);
  return {
    ...headerToForm(bg, { copy }),
    grants: grantsToForm(bg.grants, choices.filter((c) => c !== equipment)),
    equipment: bundleToForm(equipment),
    equipmentId: equipment?.id || EQUIPMENT_ID,
    equipmentLabel: equipment?.label || "Starting Equipment",
    features: bg.features || [],
  };
}

export function formToBackground(form, original) {
  const { grants, choices } = formToGrants(form.grants);
  const bundle = formToBundle(form.equipment, { id: form.equipmentId, label: form.equipmentLabel });
  return {
    ...pruneEmpty({ ...formToHeader(form, "background", original), features: form.features }),
    grants,
    choices: bundle ? [...choices, bundle] : choices,
  };
}

// The feat a background gives, for its row: "Magic Initiate (Cleric)",
// or "any Dark Gift feat" when it is a pick.
export const backgroundFeatLabel = (bg, index) => {
  const fixed = bg?.grants?.feats?.[0];
  if (fixed) return `${nameFromId(fixed.feat, index)}${fixed.option ? ` (${titleCase(fixed.option)})` : ""}`;
  const pool = (bg?.choices || []).find((c) => c.type === "pool" && c.grant === "feats");
  if (!pool) return null;
  const cats = pool.from?.category;
  return cats?.length ? `any ${cats.map((k) => FEAT_CATEGORIES[k] || titleCase(k)).join(" or ")} feat` : describeChoice(pool, index)?.value;
};
