import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { CreateModal } from "../catalogueStyle";
import { BasicsSection, BundleOptionsEditor, DescriptionSection, GrantsEditor, KeptSection } from "../catalogueParts";
import { buildNameIndex } from "../catalogueHelpers";
import { backgroundToForm, emptyBackgroundForm, formToBackground } from "./backgroundHelpers";

/* Create, edit or copy a background. The form writes the same record
   shape the pipeline makes (text · grants · choices · features). */
export default function BackgroundCreatePopup({ open, onClose, editingBackground, copyFromBackground }) {
  const createBackground = useCatalogueStore((s) => s.createBackground);
  const updateBackground = useCatalogueStore((s) => s.updateBackground);
  const saving = useCatalogueStore((s) => s.savingBackground);
  const saveError = useCatalogueStore((s) => s.backgroundsError);

  const feats = useCatalogueStore((s) => s.feats);
  const loadFeats = useCatalogueStore((s) => s.loadFeats);
  const items = useCatalogueStore((s) => s.items);
  const loadItems = useCatalogueStore((s) => s.loadItems);
  const spells = useCatalogueStore((s) => s.spells);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);

  const [form, setForm] = useState(emptyBackgroundForm);
  const [nameError, setNameError] = useState(false);

  // The pickers need the other catalogues.
  useEffect(() => {
    if (!open) return;
    if (!feats?.length) loadFeats();
    if (!items?.length) loadItems();
    if (!spells?.length) loadSpells();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    setNameError(false);
    const src = editingBackground || copyFromBackground;
    setForm(src ? backgroundToForm(src, { copy: !editingBackground }) : emptyBackgroundForm());
  }, [open, editingBackground, copyFromBackground]);

  const index = useMemo(() => buildNameIndex(feats, items, spells), [feats, items, spells]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const isEditing = !!editingBackground;
  const title = isEditing ? "Edit Background" : copyFromBackground ? "Copy Background" : "Create Background";

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    const record = formToBackground(form, isEditing ? editingBackground : null);
    try {
      if (isEditing) await updateBackground(editingBackground.id, record);
      else await createBackground(record);
      onClose();
    } catch {
      /* the error is shown in the footer */
    }
  };

  // The A / B pick under the equipment section.
  const equipmentOptions = (
    <BundleOptionsEditor options={form.equipment} onChange={(v) => set("equipment", v)} entries={items} index={index}
                         emptyHint="No pick. (2024 backgrounds: A = items and gold, B = 50 GP.)" />
  );

  return (
    <CreateModal open={open} title={title} onClose={onClose} onSave={handleSave} saving={saving}
                 saveLabel={isEditing ? "Save Changes" : "Save"} error={saveError}>
      <BasicsSection form={form} set={set} nameError={nameError} namePlaceholder="e.g. Far Traveler" />
      <DescriptionSection value={form.text} onChange={(v) => set("text", v)}
                          placeholder={"You devoted yourself to service in a temple…\n\n**Shelter of the Faithful.** As an acolyte, you…"} />
      <GrantsEditor value={form.grants} onChange={(v) => set("grants", v)} catalogues={{ feats, items, spells }} index={index}
                    equipmentExtra={equipmentOptions} />
      <KeptSection features={form.features} onFeatures={(v) => set("features", v)}
                   choices={form.grants.extraChoices} onChoices={(v) => set("grants", { ...form.grants, extraChoices: v })}
                   grants={form.grants.extraGrants} index={index} />
    </CreateModal>
  );
}
