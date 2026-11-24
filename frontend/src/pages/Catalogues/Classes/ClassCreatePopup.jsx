import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import { CreateModal, FormTabs, fieldCls, hintCls, labelCls, addRowCls, removeRowCls } from "../catalogueStyle";
import { BasicsSection, BundleOptionsEditor, ChipToggles, GrantsEditor, KeptSection, Segmented, grantsCounts } from "../catalogueParts";
import { ABILITIES, ABILITY_SHORT, buildNameIndex, labelFromId, toggleIn, titleCase } from "../catalogueHelpers";
import { ARMOR, HIT_DICE, WEAPONS, classToForm, emptyClassForm, featureRef, formToClass, removeFeature } from "./classHelpers";
import { AbilityGroupsEditor, FeatureAside, ResourcesEditor, SpellcastingEditor } from "./classFormParts";
import ClassTableEditor from "./ClassTableEditor";

const DIE_OPTIONS = HIT_DICE.map((d) => ({ value: d, label: d }));

/* Create, edit or copy a class. One tab per part:
     Basics         name, hit points, primary ability, starting
                    equipment, multiclassing
     Proficiencies  armor, weapons, saving throws, skills, tools…
     Spells         spellcasting and the spells it always has
     Class Table    the table itself, filled in where it stands: each
                    level's features (opened beside the form), picks,
                    numbers, where the subclass starts and the levels
                    it gives features (a subclass's own form only
                    offers those) (ClassTableEditor)
   Hit points aren't asked: the hit die's maximum at level 1, its
   average after (hpFor). No edition pick: a class made or copied here is
   saved as a 2024 ("one") class.
   The form writes the same record the pipeline makes (data-model §4g);
   what it has no field for is kept. Subclasses are made in their own
   form (SubclassCreatePopup). */
export default function ClassCreatePopup({ open, onClose, editingClass, copyFromClass }) {
  const createClass = useCatalogueStore((s) => s.createClass);
  const updateClass = useCatalogueStore((s) => s.updateClass);
  const saving = useCatalogueStore((s) => s.savingClass);
  const saveError = useCatalogueStore((s) => s.classesError);

  const classes = useCatalogueStore((s) => s.classes);
  const items = useCatalogueStore((s) => s.items);
  const spells = useCatalogueStore((s) => s.spells);
  const feats = useCatalogueStore((s) => s.feats);
  const loadItems = useCatalogueStore((s) => s.loadItems);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);
  const loadFeats = useCatalogueStore((s) => s.loadFeats);

  const [form, setForm] = useState(emptyClassForm);
  const [nameError, setNameError] = useState(false);
  const [tab, setTab] = useState("basics");
  const [openRef, setOpenRef] = useState(null); // the feature open beside the form

  useEffect(() => {
    if (!open) return;
    if (!items?.length) loadItems();
    if (!spells?.length) loadSpells();
    if (!feats?.length) loadFeats();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    setNameError(false);
    setTab("basics");
    setOpenRef(null);
    const src = editingClass || copyFromClass;
    setForm(src ? classToForm(src, { copy: !editingClass }) : emptyClassForm());
  }, [open, editingClass, copyFromClass]);

  const index = useMemo(() => buildNameIndex(items, spells, feats), [items, spells, feats]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const union = (a, b) => [...new Set([...(a || []), ...(b || [])])];
  const isEditing = !!editingClass;
  const title = isEditing ? "Edit Class" : copyFromClass ? "Copy Class" : "Create Class";
  const subclassTitle = form.subclassTitle.trim() || `${form.name.trim() || "Class"} Subclass`;

  const changeTab = (t) => {
    setTab(t);
    if (t !== "table") setOpenRef(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      changeTab("basics");
      return;
    }
    setNameError(false);
    // A class made here is always a 2024 ("one") class.
    const record = formToClass({ ...form, edition: "one" }, isEditing ? editingClass : null);
    try {
      if (isEditing) await updateClass(editingClass.id, record);
      else await createClass(record);
      onClose();
    } catch {
      /* the error is shown in the footer */
    }
  };

  const onRemoveFeature = (ref) => {
    setForm((f) => ({ ...f, ...removeFeature(f, ref) }));
    if (ref === openRef) setOpenRef(null);
  };

  const counts = grantsCounts(form.grants, index);
  const restKeys = Object.keys(form.rest);
  const tabs = [
    { id: "basics", label: "Basics", count: 0, error: nameError },
    { id: "proficiencies", label: "Proficiencies", count: form.armor.length + form.weapons.length + form.saves.length + counts.proficiencies },
    { id: "spells", label: "Spells", count: (form.spellcasting.on ? 1 : 0) + counts.spells },
    { id: "table", label: "Class Table", count: form.features.filter((f) => !f.parent).length },
    ...(counts.other || restKeys.length ? [{ id: "other", label: "Other", count: counts.other + restKeys.length }] : []),
  ];
  const pools = [
    ...form.columns.filter((c) => c.pool).map((c) => ({ id: c.id || c.name, name: c.name || c.id })),
    ...form.resources.filter((r) => r.id).map((r) => ({ id: r.id, name: r.name || r.id })),
  ];
  const showAside = tab === "table" && form.features.some((f) => featureRef(f) === openRef);

  const setBundle = (i, p) => set("equipment", form.equipment.map((b, j) => (j === i ? { ...b, ...p } : b)));
  const equipmentPicks = (
    <div className="space-y-4">
      {form.equipment.map((b, i) => (
        <div key={i} className="space-y-1">
          <BundleOptionsEditor options={b.options} onChange={(v) => setBundle(i, { options: v })} entries={items} index={index}
                               title={form.equipment.length > 1 ? `Pick ${i + 1}: choose one of` : "Choose one of"} />
          <button type="button" onClick={() => set("equipment", form.equipment.filter((_, j) => j !== i))} className={removeRowCls}>
            ✕ remove this pick
          </button>
        </div>
      ))}
      <button type="button" onClick={() => set("equipment", [...form.equipment, { options: [], rest: {} }])} className={addRowCls}>
        + equipment pick (A / B / C)
      </button>
      <label className="flex items-baseline gap-2">
        <span className={`${labelCls} !mb-0`}>Or gold instead</span>
        <input type="text" value={form.startingGold} onChange={(e) => set("startingGold", e.target.value)} placeholder="5d4 × 10" className={`${fieldCls} !w-32`} />
        <span className="text-xs text-ink-faded">GP (2014)</span>
      </label>
    </div>
  );

  return (
    <CreateModal open={open} title={title} onClose={onClose} onSave={handleSave} saving={saving}
                 saveLabel={isEditing ? "Save Changes" : "Save"} error={saveError} width={tab === "table" ? "max-w-6xl" : "max-w-4xl"}
                 tabs={<FormTabs tabs={tabs} active={tab} onChange={changeTab} />}
                 aside={showAside && (
                   <FeatureAside features={form.features} onFeatures={(v) => set("features", v)} openRef={openRef} onOpen={setOpenRef}
                                 onClose={() => setOpenRef(null)} onRemove={onRemoveFeature} pools={pools} index={index} />
                 )}>
      {tab === "basics" && (
        <>
          <BasicsSection form={form} set={set} nameError={nameError} namePlaceholder="e.g. Blood Hunter" edition={false}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className={`${labelCls} !mb-0`}>Hit Point Die</span>
              <Segmented size="sm" options={DIE_OPTIONS} value={form.hitDie} onChange={(v) => set("hitDie", v)} />
              <span className={hintCls}>hit points: the die's maximum at level 1, its average after (+ Con)</span>
            </div>
            <div>
              <div className={labelCls}>Primary ability</div>
              <AbilityGroupsEditor groups={form.primary} onChange={(v) => set("primary", v)} />
            </div>
          </BasicsSection>

          <GrantsEditor value={form.grants} onChange={(v) => set("grants", v)} catalogues={{ items }} index={index}
                        only={["equipment"]} equipmentExtra={equipmentPicks} />

          <FilterSection title="Multiclassing">
            <div className="space-y-2">
              <div className={labelCls}>To take or leave this class you need</div>
              <AbilityGroupsEditor groups={form.mcRequires} onChange={(v) => set("mcRequires", v)} withScores />
              <div className={labelCls}>Joining it later gives</div>
              <ChipToggles options={union(ARMOR, form.mcArmor)} selected={form.mcArmor} labelOf={titleCase} onToggle={(a) => set("mcArmor", toggleIn(form.mcArmor, a))} />
              <ChipToggles options={union(WEAPONS, form.mcWeapons)} selected={form.mcWeapons} labelOf={labelFromId} onToggle={(w) => set("mcWeapons", toggleIn(form.mcWeapons, w))} />
              {(form.mcRest.choices?.length > 0 || Object.keys(form.mcRest.grants || {}).length > 0) && (
                <p className={hintCls}>Its other multiclass grants and picks are kept as they are.</p>
              )}
            </div>
          </FilterSection>
        </>
      )}

      {tab === "proficiencies" && (
        <>
          <FilterSection title="Armor, Weapons & Saving Throws">
            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className={`${labelCls} !mb-0 w-28`}>Armor</span>
                <ChipToggles options={union(ARMOR, form.armor)} selected={form.armor} labelOf={titleCase} onToggle={(a) => set("armor", toggleIn(form.armor, a))} />
              </div>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className={`${labelCls} !mb-0 w-28`}>Weapons</span>
                <ChipToggles options={union(WEAPONS, form.weapons)} selected={form.weapons} labelOf={labelFromId} onToggle={(w) => set("weapons", toggleIn(form.weapons, w))} />
              </div>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className={`${labelCls} !mb-0 w-28`}>Saving throws</span>
                <ChipToggles options={ABILITIES} selected={form.saves} labelOf={(a) => ABILITY_SHORT[a]} onToggle={(a) => set("saves", toggleIn(form.saves, a))} />
              </div>
            </div>
          </FilterSection>
          <GrantsEditor value={form.grants} onChange={(v) => set("grants", v)} catalogues={{ feats }} index={index}
                        only={["proficiencies"]} training={false} saves={false} />
        </>
      )}

      {tab === "spells" && (
        <>
          <FilterSection title="Spellcasting">
            <SpellcastingEditor value={form.spellcasting} onChange={(v) => set("spellcasting", v)} classes={classes || []} />
          </FilterSection>
          <GrantsEditor value={form.grants} onChange={(v) => set("grants", v)} catalogues={{ spells }} index={index} only={["spells"]} />
        </>
      )}

      {tab === "table" && (
        <div className="space-y-6">
          <ClassTableEditor rows={form.progression} onRows={(v) => set("progression", v)} features={form.features} onFeatures={(v) => set("features", v)}
                            columns={form.columns} onColumns={(v) => set("columns", v)}
                            spellcasting={form.spellcasting} onSpellcasting={(v) => set("spellcasting", v)}
                            subclass={{ level: form.subclassLevel, title: subclassTitle, onLevel: (l) => set("subclassLevel", l) }}
                            onOpenFeature={setOpenRef} openRef={openRef} onRemoveFeature={onRemoveFeature} edition="one" index={index} />
          <FilterSection title="Pools That Aren't a Column" defaultOpen={form.resources.length > 0}>
            <p className={`${hintCls} mb-2`}>
              A column features spend from (Second Wind) is set on the column (click its name). Here: pools with a die (superiority dice) or a formula (Lay on Hands).
            </p>
            <ResourcesEditor resources={form.resources} onChange={(v) => set("resources", v)} />
          </FilterSection>
        </div>
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
