import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import { CreateModal, fieldCls, hintCls, labelCls } from "../catalogueStyle";
import { BasicsSection, DescriptionSection, FeaturesEditor, GrantsEditor, KeptSection } from "../catalogueParts";
import { buildNameIndex, byName, titleCase } from "../catalogueHelpers";
import { emptySubclassForm, formToSubclass, subclassToForm } from "./classHelpers";
import { ColumnsEditor, ProgressionEditor, ResourcesEditor, SpellcastingEditor, TABLE_HINT } from "./classFormParts";

const FEATURE_CATEGORIES = ["traits", "actions", "bonus_actions", "reactions"];

/* Create, edit or copy a subclass. It belongs to one class (of the same
   edition) and never changes that class: its own description, the
   spells it always has, its features by level, picks (maneuvers…), and
   its own table columns, pools and spellcasting when it has them
   (Eldritch Knight). forClass: the class picked on the page, used for a
   new subclass. */
export default function SubclassCreatePopup({ open, onClose, editingSubclass, copyFromSubclass, forClass }) {
  const createSubclass = useCatalogueStore((s) => s.createSubclass);
  const updateSubclass = useCatalogueStore((s) => s.updateSubclass);
  const saving = useCatalogueStore((s) => s.savingSubclass);
  const saveError = useCatalogueStore((s) => s.subclassesError);

  const classes = useCatalogueStore((s) => s.classes);
  const spells = useCatalogueStore((s) => s.spells);
  const feats = useCatalogueStore((s) => s.feats);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);

  const [form, setForm] = useState(() => emptySubclassForm());
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (open && !spells?.length) loadSpells();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    setNameError(false);
    const src = editingSubclass || copyFromSubclass;
    setForm(
      src
        ? subclassToForm(src, { copy: !editingSubclass })
        : { ...emptySubclassForm(forClass?.id || ""), edition: forClass?.edition || "one" }
    );
  }, [open, editingSubclass, copyFromSubclass, forClass]);

  const index = useMemo(() => buildNameIndex(spells, feats, classes), [spells, feats, classes]);
  // A subclass belongs to a class of its own edition.
  const classOptions = useMemo(
    () => (classes || []).filter((c) => (c.edition || "one") === form.edition || c.id === form.classId).sort(byName),
    [classes, form.edition, form.classId]
  );
  const parent = (classes || []).find((c) => c.id === form.classId);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const isEditing = !!editingSubclass;
  const title = isEditing ? "Edit Subclass" : copyFromSubclass ? "Copy Subclass" : "Create Subclass";

  const handleSave = async () => {
    if (!form.name.trim() || !form.classId) {
      setNameError(!form.name.trim());
      return;
    }
    setNameError(false);
    const record = formToSubclass(form, isEditing ? editingSubclass : null);
    try {
      if (isEditing) await updateSubclass(editingSubclass.id, record);
      else await createSubclass(record);
      onClose();
    } catch {
      /* the error is shown in the footer */
    }
  };

  const restKeys = Object.keys(form.rest);
  return (
    <CreateModal open={open} title={title} onClose={onClose} onSave={handleSave} saving={saving} saveDisabled={!form.classId}
                 saveLabel={isEditing ? "Save Changes" : "Save"} error={saveError} width="max-w-4xl">
      <BasicsSection form={form} set={set} nameError={nameError} namePlaceholder="e.g. Path of the Storm Herald">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <label className="flex items-baseline gap-2">
            <span className={`${labelCls} !mb-0`}>Class</span>
            <select value={form.classId} onChange={(e) => set("classId", e.target.value)} className={`${fieldCls} !w-48`}>
              <option value="">— pick a class —</option>
              {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.source})</option>)}
            </select>
          </label>
          <label className="flex items-baseline gap-2">
            <span className={`${labelCls} !mb-0`}>Short name</span>
            <input type="text" value={form.shortName} onChange={(e) => set("shortName", e.target.value)} placeholder={form.name || "Storm Herald"}
                   className={`${fieldCls} !w-44`} />
          </label>
        </div>
        {!form.classId && <p className={hintCls}>Pick the class it belongs to.</p>}
      </BasicsSection>

      <DescriptionSection value={form.text} onChange={(v) => set("text", v)} placeholder="*Lead with a motto*\n\nWhat this subclass is about…" />

      <GrantsEditor value={form.grants} onChange={(v) => set("grants", v)} catalogues={{ feats, spells }} index={index} show={["spells", "proficiencies"]} />

      <FilterSection title="By Level">
        <ProgressionEditor rows={form.progression} onChange={(v) => set("progression", v)} features={form.features} edition={form.edition}
                           classId={form.classId} isSubclass index={index} />
      </FilterSection>

      <FilterSection title="Features">
        <FeaturesEditor features={form.features} onChange={(v) => set("features", v)} categories={FEATURE_CATEGORIES} levels withText
                        newLevel={parent?.subclass?.level || 3}
                        hint="Each feature with its level and text; the numbers are optional. A subclass gives features at the levels its class marks as “subclass feature”." />
      </FilterSection>

      <FilterSection title="Table, Pools & Spellcasting" defaultOpen={false}>
        <div className="space-y-4">
          <p className={hintCls}>Only for a subclass with its own (an Eldritch Knight's spell slots, a Psi Warrior's dice). {TABLE_HINT}</p>
          <ColumnsEditor columns={form.columns} onChange={(v) => set("columns", v)} />
          <ResourcesEditor resources={form.resources} onChange={(v) => set("resources", v)} />
          <SpellcastingEditor value={form.spellcasting} onChange={(v) => set("spellcasting", v)} lists={(classes || []).map((c) => c.id)} />
        </div>
      </FilterSection>

      <KeptSection choices={form.grants.extraChoices} onChoices={(v) => set("grants", { ...form.grants, extraChoices: v })}
                   grants={form.grants.extraGrants} index={index} />
      {restKeys.length > 0 && (
        <p className={`${hintCls} mt-2`}>Also kept as they are: {restKeys.map((k) => titleCase(k.replace(/_/g, " "))).join(", ")}.</p>
      )}
    </CreateModal>
  );
}
