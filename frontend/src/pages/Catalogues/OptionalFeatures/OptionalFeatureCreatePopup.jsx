import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import { CreateModal, fieldCls, labelCls } from "../catalogueStyle";
import {
  BasicsSection, ChipToggles, DescriptionSection, GrantsEditor, KeptSection, PrerequisitesEditor, Segmented,
} from "../catalogueParts";
import {
  buildNameIndex, collectUnique, toggleIn, labelFromId, numOrNull, FEATURE_TYPES, formatFeatureType,
} from "../catalogueHelpers";
import {
  emptyOptionalFeatureForm, formToOptionalFeature, optionalFeatureToForm,
} from "./optionalFeatureHelpers";

// Classes a shared type (fighting styles) can be listed for.
const LIST_CLASSES = ["bard", "fighter", "paladin", "ranger"];
const COST_MODES = [
  { value: "amount", label: "a set amount" },
  { value: "range", label: "the player chooses how much" },
];
const SECTIONS = ["traits", "proficiencies", "spells"];

/* Create, edit or copy an optional feature. The form writes the same
   record shape the pipeline makes (text · feature types · classes ·
   cost · prerequisites · grants · choices · features). */
export default function OptionalFeatureCreatePopup({ open, onClose, editingFeature, copyFromFeature }) {
  const createOptionalFeature = useCatalogueStore((s) => s.createOptionalFeature);
  const updateOptionalFeature = useCatalogueStore((s) => s.updateOptionalFeature);
  const saving = useCatalogueStore((s) => s.savingOptionalFeature);
  const saveError = useCatalogueStore((s) => s.optionalFeaturesError);

  const optionalFeatures = useCatalogueStore((s) => s.optionalFeatures);
  const feats = useCatalogueStore((s) => s.feats);
  const spells = useCatalogueStore((s) => s.spells);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);

  const [form, setForm] = useState(emptyOptionalFeatureForm);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (open && !spells?.length) loadSpells();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    setNameError(false);
    const src = editingFeature || copyFromFeature;
    setForm(src ? optionalFeatureToForm(src, { copy: !editingFeature }) : emptyOptionalFeatureForm());
  }, [open, editingFeature, copyFromFeature]);

  const index = useMemo(() => buildNameIndex(optionalFeatures, feats, spells), [optionalFeatures, feats, spells]);
  // The resources the catalogue already spends, offered while typing.
  const knownResources = useMemo(() => collectUnique(optionalFeatures, (f) => f.consumes?.resource), [optionalFeatures]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setCost = (p) => set("consumes", { ...form.consumes, ...p });

  const isEditing = !!editingFeature;
  const title = isEditing ? "Edit Optional Feature" : copyFromFeature ? "Copy Optional Feature" : "Create Optional Feature";

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    const record = formToOptionalFeature(form, isEditing ? editingFeature : null);
    try {
      if (isEditing) await updateOptionalFeature(editingFeature.id, record);
      else await createOptionalFeature(record);
      onClose();
    } catch {
      /* the error is shown in the footer */
    }
  };

  const c = form.consumes;

  return (
    <CreateModal open={open} title={title} onClose={onClose} onSave={handleSave} saving={saving}
                 saveLabel={isEditing ? "Save Changes" : "Save"} error={saveError}>
      <BasicsSection form={form} set={set} nameError={nameError} namePlaceholder="e.g. Agonizing Blast">
        <div>
          <div className={labelCls}>Type</div>
          <ChipToggles options={Object.keys(FEATURE_TYPES)} selected={form.featureTypes} labelOf={formatFeatureType}
                       onToggle={(t) => set("featureTypes", toggleIn(form.featureTypes, t))} />
        </div>
        <div>
          <div className={labelCls}>On these classes' lists (for a shared type, like fighting styles)</div>
          <ChipToggles options={[...new Set([...LIST_CLASSES, ...form.classes])]} selected={form.classes} labelOf={labelFromId}
                       onToggle={(x) => set("classes", toggleIn(form.classes, x))} />
        </div>
        <label className="flex items-baseline gap-2 text-sm">
          <input type="checkbox" checked={form.repeatable} onChange={(e) => set("repeatable", e.target.checked)} className="accent-rubric" />
          Repeatable
        </label>
      </BasicsSection>

      <FilterSection title="Cost">
        <div className="space-y-2">
          <label className="flex items-baseline gap-2 text-sm">
            <input type="checkbox" checked={c.on} onChange={(e) => setCost({ on: e.target.checked })} className="accent-rubric" />
            Using it spends a class resource
          </label>
          {c.on && (
            <div className="space-y-2 border-l border-rule/30 pl-3">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className={`${labelCls} !mb-0`}>Resource</span>
                <input type="text" list="optional-feature-resources" value={c.resource} onChange={(e) => setCost({ resource: e.target.value })}
                       placeholder="e.g. superiority_dice" className={`${fieldCls} !w-56`} />
                <datalist id="optional-feature-resources">
                  {knownResources.map((r) => <option key={r} value={r}>{labelFromId(r)}</option>)}
                </datalist>
              </div>
              <Segmented size="sm" options={COST_MODES} value={c.mode} onChange={(mode) => setCost({ mode })} />
              {c.mode === "amount" ? (
                <label className="flex items-baseline gap-2">
                  <span className="text-xs italic text-ink-faded">spends</span>
                  <input type="number" min={1} value={c.amount ?? ""} onChange={(e) => setCost({ amount: numOrNull(e.target.value) })}
                         className={`${fieldCls} !w-14`} />
                </label>
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-xs italic text-ink-faded">from</span>
                  <input type="number" min={0} value={c.min ?? ""} onChange={(e) => setCost({ min: numOrNull(e.target.value) })}
                         className={`${fieldCls} !w-14`} />
                  <span className="text-xs italic text-ink-faded">to</span>
                  <input type="number" min={0} value={c.max ?? ""} onChange={(e) => setCost({ max: numOrNull(e.target.value) })}
                         className={`${fieldCls} !w-14`} />
                </div>
              )}
            </div>
          )}
        </div>
      </FilterSection>

      <FilterSection title="Prerequisites">
        <PrerequisitesEditor groups={form.prerequisites} onChange={(v) => set("prerequisites", v)} feats={feats} index={index} showPacts />
      </FilterSection>

      <DescriptionSection value={form.text} onChange={(v) => set("text", v)}
                          placeholder={"When you cast Eldritch Blast, add your Charisma modifier to the damage…"} />

      <GrantsEditor value={form.grants} onChange={(v) => set("grants", v)} catalogues={{ feats, spells }} index={index} show={SECTIONS} />

      <KeptSection features={form.features} onFeatures={(v) => set("features", v)}
                   choices={form.grants.extraChoices} onChoices={(v) => set("grants", { ...form.grants, extraChoices: v })}
                   grants={form.grants.extraGrants} index={index} />
    </CreateModal>
  );
}
