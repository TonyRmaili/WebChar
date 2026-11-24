import { HOMEBREW, pruneEmpty, FEAT_CATEGORIES, titleCase, describePrerequisites, withFeatureTexts } from "../catalogueHelpers";
import {
  emptyHeaderForm, headerToForm, formToHeader, emptyGrantsForm, grantsToForm, formToGrants,
  prereqsToForm, formToPrereqs,
} from "../catalogueForms";

/* ═══════════════════════════════════════════════════════════════════
   featsHelpers — what only feats need. The shared words are in
   ../catalogueHelpers, the shared form conversion in ../catalogueForms.

   A feat record (final/feats.json):
     header · text · category · repeatable · prerequisites
     · grants · choices · options · features
   `options` are like a race's subraces: Magic Initiate → Cleric / Druid /
   Wizard, each with its own text, grants and choices.
   ═══════════════════════════════════════════════════════════════════ */

export const categoryLabel = (c) => (c ? FEAT_CATEGORIES[c] || titleCase(c) : "");

// "Origin Feat · Repeatable"
export const featSubtitle = (feat) =>
  [feat.category ? `${categoryLabel(feat.category)} Feat` : null, feat.repeatable ? "Repeatable" : null].filter(Boolean).join(" · ");

// The short note on a feat's row: its category, else its prerequisite.
export const featRowMeta = (feat, index) => categoryLabel(feat.category) || describePrerequisites(feat.prerequisites, index)[0] || null;

/* ─── options ────────────────────────────────────────────────────── */

export const emptyFeatOption = () => ({ name: "", text: "", grants: emptyGrantsForm(), features: [], rest: {} });

const optionToForm = (o) => {
  const { id, kind, name, source, edition, text, grants, choices, srd, features, ...rest } = o;
  return { id, name: name || "", text: text || "", grants: grantsToForm(grants, choices), features: features || [], rest };
};

const formToOption = (o, form) => {
  const { grants, choices } = formToGrants(o.grants);
  return {
    ...o.rest,
    ...(o.id ? { id: o.id } : {}),
    kind: "feat_option",
    name: o.name.trim(),
    source: HOMEBREW,
    edition: form.edition,
    text: o.text || undefined,
    features: (o.features || []).length ? withFeatureTexts(o.features, o.text, o.name) : undefined,
    grants,
    choices,
  };
};

/* ─── feat ↔ form ────────────────────────────────────────────────── */

export const emptyFeatForm = () => ({
  ...emptyHeaderForm(),
  category: "general",
  repeatable: false,
  prerequisites: [],
  grants: emptyGrantsForm(),
  options: [],
  features: [],
});

export function featToForm(feat, { copy = false } = {}) {
  return {
    ...headerToForm(feat, { copy }),
    category: feat.category || "",
    repeatable: !!feat.repeatable,
    prerequisites: prereqsToForm(feat.prerequisites),
    grants: grantsToForm(feat.grants, feat.choices),
    // a copy's options get new ids from the backend, like the feat
    options: (feat.options || []).map((o) => ({ ...optionToForm(o), id: copy ? undefined : o.id })),
    features: feat.features || [],
  };
}

export function formToFeat(form, original) {
  const { grants, choices } = formToGrants(form.grants);
  return {
    ...pruneEmpty({
      ...formToHeader(form, "feat", original),
      category: form.category || undefined,
      prerequisites: formToPrereqs(form.prerequisites),
      options: form.options.filter((o) => o.name.trim()).map((o) => formToOption(o, form)),
      features: withFeatureTexts(form.features, form.text, form.name),
    }),
    repeatable: !!form.repeatable,
    grants,
    choices,
  };
}
