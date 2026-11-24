import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection, { BareSections } from "../FilterSection";
import { CreateModal, FormTabs, fieldCls, hintCls, labelCls } from "../catalogueStyle";
import { BasicsSection, GrantsEditor, KeptSection, TextField, grantsCounts } from "../catalogueParts";
import { buildNameIndex, titleCase } from "../catalogueHelpers";
import { LEVELS, emptySubclassForm, featureRef, formToSubclass, removeFeature, subclassLevels, subclassToForm } from "./classHelpers";
import { FeatureAside, ResourcesEditor, SpellcastingEditor } from "./classFormParts";
import ClassTableEditor from "./ClassTableEditor";

/* Create, edit or copy a subclass. It belongs to the class picked on the
   Classes page (forClass; an edited subclass keeps its own) and takes
   that class's edition. Tabs:
     Basics          name, visibility, description
     Subclass Table  only the levels its class gives subclass features
                     (set in the class's Class Table): each one's
                     features and picks; its own columns (a Psi
                     Warrior's dice) and spell slots (Eldritch Knight)
                     when it has them
     Proficiencies · Spells (its own spellcasting, the spells it always
                     has) · Other
   Its short name is its name. */
export default function SubclassCreatePopup({ open, onClose, editingSubclass, copyFromSubclass, forClass }) {
  const createSubclass = useCatalogueStore((s) => s.createSubclass);
  const updateSubclass = useCatalogueStore((s) => s.updateSubclass);
  const saving = useCatalogueStore((s) => s.savingSubclass);
  const saveError = useCatalogueStore((s) => s.subclassesError);

  const classes = useCatalogueStore((s) => s.classes);
  const spells = useCatalogueStore((s) => s.spells);
  const feats = useCatalogueStore((s) => s.feats);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);
  const loadFeats = useCatalogueStore((s) => s.loadFeats);

  const [form, setForm] = useState(() => emptySubclassForm());
  const [nameError, setNameError] = useState(false);
  const [tab, setTab] = useState("basics");
  const [openRef, setOpenRef] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (!spells?.length) loadSpells();
    if (!feats?.length) loadFeats();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    setNameError(false);
    setTab("basics");
    setOpenRef(null);
    const src = editingSubclass || copyFromSubclass;
    setForm(src ? subclassToForm(src, { copy: !editingSubclass }) : emptySubclassForm(forClass?.id || ""));
  }, [open, editingSubclass, copyFromSubclass, forClass]);

  const index = useMemo(() => buildNameIndex(spells, feats, classes), [spells, feats, classes]);
  const parent = (classes || []).find((c) => c.id === form.classId);
  const levels = useMemo(() => subclassLevels(parent), [parent]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const isEditing = !!editingSubclass;
  const title = isEditing ? "Edit Subclass" : copyFromSubclass ? "Copy Subclass" : "Create Subclass";

  const changeTab = (t) => {
    setTab(t);
    if (t !== "table") setOpenRef(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.classId) {
      setNameError(!form.name.trim());
      changeTab("basics");
      return;
    }
    setNameError(false);
    // Its class's edition (editions never mix inside a class); one name.
    const record = formToSubclass({ ...form, edition: parent?.edition || form.edition }, isEditing ? editingSubclass : null);
    try {
      if (isEditing) await updateSubclass(editingSubclass.id, record);
      else await createSubclass(record);
      onClose();
    } catch {
      /* the error is shown in the footer */
    }
  };

  const onRemoveFeature = (ref) => {
    setForm((f) => ({ ...f, ...removeFeature(f, ref) }));
    if (ref === openRef) setOpenRef(null);
  };

  // With columns or spell slots of its own the table runs on from its
  // first level (the numbers change on other levels too); features still
  // only go on its levels.
  const ownNumbers = form.columns.length > 0 || form.spellcasting.on;
  const rowsShown = ownNumbers && levels.length ? LEVELS.filter((l) => l >= levels[0]) : levels;

  const counts = grantsCounts(form.grants, index);
  const restKeys = Object.keys(form.rest);
  const tabs = [
    { id: "basics", label: "Basics", count: 0, error: nameError || (!form.classId && tab !== "basics") },
    { id: "table", label: "Subclass Table", count: form.features.filter((f) => !f.parent).length },
    { id: "proficiencies", label: "Proficiencies", count: counts.proficiencies },
    { id: "spells", label: "Spells", count: (form.spellcasting.on ? 1 : 0) + counts.spells },
    ...(counts.other || restKeys.length ? [{ id: "other", label: "Other", count: counts.other + restKeys.length }] : []),
  ];
  const pools = [
    ...form.columns.filter((c) => c.pool).map((c) => ({ id: c.id || c.name, name: c.name || c.id })),
    ...form.resources.filter((r) => r.id).map((r) => ({ id: r.id, name: r.name || r.id })),
    // the class's own pools, which its subclass features spend too
    ...(parent?.resources || []).map((r) => ({ id: r.id, name: `${r.name || r.id} (${parent.name})` })),
  ];
  const showAside = tab === "table" && form.features.some((f) => featureRef(f) === openRef);

  return (
    <CreateModal open={open} title={title} onClose={onClose} onSave={handleSave} saving={saving} saveDisabled={!form.classId}
                 saveLabel={isEditing ? "Save Changes" : "Save"} error={saveError} width={tab === "table" ? "max-w-5xl" : "max-w-4xl"}
                 tabs={<FormTabs tabs={tabs} active={tab} onChange={changeTab} />}
                 aside={showAside && (
                   <FeatureAside features={form.features} onFeatures={(v) => set("features", v)} openRef={openRef} onOpen={setOpenRef}
                                 onClose={() => setOpenRef(null)} onRemove={onRemoveFeature} pools={pools} index={index}
                                 levelOptions={levels.length ? levels : LEVELS} />
                 )}>
      {tab === "basics" && (
        <BareSections.Provider value>
          <BasicsSection form={form} set={set} nameError={nameError} namePlaceholder="e.g. Path of the Storm Herald" edition={false}>
            <p className={hintCls}>
              {parent
                ? `A ${parent.name} (${parent.source || titleCase(parent.visibility || "")}) subclass: features at level ${levels.join(", ") || "—"}.`
                : "Pick a class on the Classes page first: a subclass is made for the class it's under."}
            </p>
            <div>
              <div className={labelCls}>Description</div>
              <TextField value={form.text} onChange={(v) => set("text", v)} rows={6} placeholder={"*Lead with a motto*\n\nWhat this subclass is about…"} />
            </div>
          </BasicsSection>
        </BareSections.Provider>
      )}

      {tab === "table" && (
        !parent ? (
          <p className={hintCls}>Pick its class first (Basics): the class decides which levels a subclass gives features.</p>
        ) : (
          <div className="space-y-6">
            <ClassTableEditor rows={form.progression} onRows={(v) => set("progression", v)} features={form.features} onFeatures={(v) => set("features", v)}
                              columns={form.columns} onColumns={(v) => set("columns", v)}
                              spellcasting={form.spellcasting} onSpellcasting={(v) => set("spellcasting", v)}
                              levels={rowsShown} addable={levels} onOpenFeature={setOpenRef} openRef={openRef} onRemoveFeature={onRemoveFeature}
                              edition={form.edition} index={index} />
            <FilterSection title="Pools That Aren't a Column" defaultOpen={form.resources.length > 0}>
              <p className={`${hintCls} mb-2`}>Pools with a die (Battle Master's superiority dice) or a formula. A column features spend from is set on the column.</p>
              <ResourcesEditor resources={form.resources} onChange={(v) => set("resources", v)} />
            </FilterSection>
          </div>
        )
      )}

      {tab === "proficiencies" && (
        <BareSections.Provider value>
          <GrantsEditor value={form.grants} onChange={(v) => set("grants", v)} catalogues={{ feats }} index={index} only={["proficiencies"]} />
        </BareSections.Provider>
      )}

      {tab === "spells" && (
        <>
          <FilterSection title="Spellcasting of Its Own">
            <p className={`${hintCls} mb-2`}>Only for a subclass that casts on its own (Eldritch Knight, Arcane Trickster).</p>
            <SpellcastingEditor value={form.spellcasting} onChange={(v) => set("spellcasting", v)} classes={classes || []} startsAt={levels[0]} />
          </FilterSection>
          <GrantsEditor value={form.grants} onChange={(v) => set("grants", v)} catalogues={{ spells }} index={index} only={["spells"]} />
        </>
      )}

      {tab === "other" && (
        <>
          <KeptSection choices={form.grants.extraChoices} onChoices={(v) => set("grants", { ...form.grants, extraChoices: v })}
                       grants={form.grants.extraGrants} index={index} />
          {restKeys.length > 0 && (
            <p className={`${hintCls} mt-2`}>Also kept as they are: {restKeys.map((k) => titleCase(k.replace(/_/g, " "))).join(", ")}.</p>
          )}
        </>
      )}
    </CreateModal>
  );
}
