import { pruneEmpty, formatFeatureType, labelFromId, entryParts, withFeatureTexts } from "../catalogueHelpers";
import {
  emptyHeaderForm, headerToForm, formToHeader, emptyGrantsForm, grantsToForm, formToGrants,
  prereqsToForm, formToPrereqs,
} from "../catalogueForms";

/* ═══════════════════════════════════════════════════════════════════
   optionalFeatureHelpers — what only optional features need (eldritch
   invocations, maneuvers, metamagic, fighting styles, infusions, …).
   The shared words are in ../catalogueHelpers, the shared form
   conversion in ../catalogueForms.

   An optional feature record (final/optionalfeatures.json):
     header · text · feature_types · classes · consumes · repeatable
     · prerequisites · grants · choices · features
   classes   whose list it is on, when the type is shared (fighting styles)
   consumes  its cost from a class resource: { resource, amount } or
             { resource, min, max } (1–9 sorcery points)
   ═══════════════════════════════════════════════════════════════════ */

// "Eldritch Invocation", "Fighting Style (Fighter, Ranger)"
export const typesLabel = (f) => {
  const types = (f.feature_types || []).map(formatFeatureType).join(", ");
  const classes = (f.classes || []).map(labelFromId).join(", ");
  return classes ? `${types} (${classes})` : types;
};

// Classes an optional feature belongs to: its list, plus classes its
// prerequisites name ("Warlock level 5").
export const featureClasses = (f) => {
  const set = new Set(f.classes || []);
  for (const g of f.prerequisites || []) (g.class_level || []).forEach((c) => set.add(c.class));
  return [...set];
};

// The short note on a row: "Warlock 5", else the type.
export const optionalFeatureRowMeta = (f) => {
  const cl = f.prerequisites?.[0]?.class_level?.[0];
  return cl ? `${labelFromId(cl.class)} ${cl.level}` : typesLabel(f);
};

// The resource an entry spends ("sorcery_points"), for the filter.
export const consumedResources = (f) => entryParts(f).map((p) => p.consumes?.resource).filter(Boolean);

/* ─── record ↔ form ──────────────────────────────────────────────── */

export const emptyConsumes = () => ({ on: false, resource: "", mode: "amount", amount: 1, min: 1, max: null });

export const emptyOptionalFeatureForm = () => ({
  ...emptyHeaderForm(),
  featureTypes: [],
  classes: [],
  consumes: emptyConsumes(),
  repeatable: false,
  prerequisites: [],
  grants: emptyGrantsForm(),
  features: [],
});

export function optionalFeatureToForm(f, { copy = false } = {}) {
  const c = f.consumes;
  return {
    ...headerToForm(f, { copy }),
    featureTypes: f.feature_types || [],
    classes: f.classes || [],
    consumes: c
      ? { on: true, resource: c.resource, mode: c.amount != null ? "amount" : "range", amount: c.amount ?? 1, min: c.min ?? 1, max: c.max ?? null }
      : emptyConsumes(),
    repeatable: !!f.repeatable,
    prerequisites: prereqsToForm(f.prerequisites),
    grants: grantsToForm(f.grants, f.choices),
    features: f.features || [],
  };
}

export function formToOptionalFeature(form, original) {
  const { grants, choices } = formToGrants(form.grants);
  const c = form.consumes;
  const consumes = c.on && c.resource.trim()
    ? c.mode === "amount"
      ? { resource: c.resource.trim(), amount: Number(c.amount) || 1 }
      : { resource: c.resource.trim(), min: c.min ?? undefined, max: c.max ?? undefined }
    : undefined;
  return {
    ...pruneEmpty({
      ...formToHeader(form, "optional_feature", original),
      classes: form.classes,
      consumes,
      prerequisites: formToPrereqs(form.prerequisites),
      features: withFeatureTexts(form.features, form.text, form.name),
    }),
    feature_types: form.featureTypes,
    repeatable: !!form.repeatable,
    grants,
    choices,
  };
}
