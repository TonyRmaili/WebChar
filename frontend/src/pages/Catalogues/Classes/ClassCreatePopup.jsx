import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import { CreateModal, fieldCls, hintCls, labelCls, addRowCls, removeRowCls, textareaCls } from "../catalogueStyle";
import { BasicsSection, BundleOptionsEditor, ChipToggles, FeaturesEditor, GrantsEditor, KeptSection, Segmented } from "../catalogueParts";
import { ABILITIES, ABILITY_SHORT, buildNameIndex, labelFromId, toggleIn, titleCase } from "../catalogueHelpers";
import { ARMOR, HIT_DICE, WEAPONS, classToForm, emptyClassForm, formToClass, hpFor } from "./classHelpers";
import { AbilityGroupsEditor, ColumnsEditor, ProgressionEditor, ResourcesEditor, SpellcastingEditor, TABLE_HINT } from "./classFormParts";

const DIE_OPTIONS = HIT_DICE.map((d) => ({ value: d, label: d }));
const FEATURE_CATEGORIES = ["traits", "actions", "bonus_actions", "reactions"];

/* Create, edit or copy a class: core traits, proficiencies and starting
   equipment, multiclassing, the subclass pick, the class table (its own
   columns, resource pools, spellcasting), what each level gives, and the
   features. The form writes the same record the pipeline makes
   (data-model §4g); what it has no field for is kept. Subclasses are a
   catalogue of their own (SubclassCreatePopup). */
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

  const [form, setForm] = useState(emptyClassForm);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!items?.length) loadItems();
    if (!spells?.length) loadSpells();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    setNameError(false);
    const src = editingClass || copyFromClass;
    setForm(src ? classToForm(src, { copy: !editingClass }) : emptyClassForm());
  }, [open, editingClass, copyFromClass]);

  const index = useMemo(() => buildNameIndex(items, spells, feats), [items, spells, feats]);
  const lists = useMemo(() => (classes || []).map((c) => c.id), [classes]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const union = (a, b) => [...new Set([...(a || []), ...(b || [])])];
  const isEditing = !!editingClass;
  const title = isEditing ? "Edit Class" : copyFromClass ? "Copy Class" : "Create Class";
  const classId = editingClass?.id || form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // A new hit die updates the hit points when they still follow the old one.
  const setDie = (die) =>
    setForm((f) => {
      const old = hpFor(f.hitDie);
      const next = hpFor(die);
      return {
        ...f,
        hitDie: die,
        hpFirst: !f.hpFirst || f.hpFirst === old.first ? next.first : f.hpFirst,
        hpPerLevel: !f.hpPerLevel || f.hpPerLevel === old.per_level ? next.per_level : f.hpPerLevel,
      };
    });

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    const record = formToClass(form, isEditing ? editingClass : null);
    try {
      if (isEditing) await updateClass(editingClass.id, record);
      else await createClass(record);
      onClose();
    } catch {
      /* the error is shown in the footer */
    }
  };

  const setBundle = (i, p) => set("equipment", form.equipment.map((b, j) => (j === i ? { ...b, ...p } : b)));
  const equipment = (
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

  const restKeys = Object.keys(form.rest);
  return (
    <CreateModal open={open} title={title} onClose={onClose} onSave={handleSave} saving={saving}
                 saveLabel={isEditing ? "Save Changes" : "Save"} error={saveError} width="max-w-4xl">
      <BasicsSection form={form} set={set} nameError={nameError} namePlaceholder="e.g. Blood Hunter">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div className="flex items-baseline gap-2">
            <span className={`${labelCls} !mb-0`}>Hit Point Die</span>
            <Segmented size="sm" options={DIE_OPTIONS} value={form.hitDie} onChange={setDie} />
          </div>
          <label className="flex items-baseline gap-2">
            <span className="text-xs text-ink-faded">HP at level 1</span>
            <input type="text" value={form.hpFirst} onChange={(e) => set("hpFirst", e.target.value)} className={`${fieldCls} !w-32`} />
          </label>
          <label className="flex items-baseline gap-2">
            <span className="text-xs text-ink-faded">per level after</span>
            <input type="text" value={form.hpPerLevel} onChange={(e) => set("hpPerLevel", e.target.value)} className={`${fieldCls} !w-32`} />
          </label>
        </div>
        <div>
          <div className={labelCls}>Primary ability</div>
          <AbilityGroupsEditor groups={form.primary} onChange={(v) => set("primary", v)} />
        </div>
        <div>
          <div className={labelCls}>Saving throws</div>
          <ChipToggles options={ABILITIES} selected={form.saves} labelOf={(a) => ABILITY_SHORT[a]} onToggle={(a) => set("saves", toggleIn(form.saves, a))} />
        </div>
      </BasicsSection>

      <FilterSection title="Armor & Weapons">
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className={`${labelCls} !mb-0 w-20`}>Armor</span>
            <ChipToggles options={union(ARMOR, form.armor)} selected={form.armor} labelOf={titleCase} onToggle={(a) => set("armor", toggleIn(form.armor, a))} />
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className={`${labelCls} !mb-0 w-20`}>Weapons</span>
            <ChipToggles options={union(WEAPONS, form.weapons)} selected={form.weapons} labelOf={labelFromId} onToggle={(w) => set("weapons", toggleIn(form.weapons, w))} />
          </div>
        </div>
      </FilterSection>

      <GrantsEditor value={form.grants} onChange={(v) => set("grants", v)} catalogues={{ feats, items, spells }} index={index}
                    show={["proficiencies", "equipment", "spells"]} equipmentExtra={equipment} />

      <FilterSection title="Multiclassing" defaultOpen={false}>
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

      <FilterSection title="Subclass">
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <input type="text" value={form.subclassTitle} onChange={(e) => set("subclassTitle", e.target.value)} placeholder={`${form.name || "Class"} Subclass`}
                   className={`${fieldCls} !w-56`} aria-label="What a subclass is called" />
            <span className="text-xs text-ink-faded">picked at level</span>
            <select value={form.subclassLevel} onChange={(e) => set("subclassLevel", Number(e.target.value))} className={`${fieldCls} !w-16`}>
              {[1, 2, 3].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <textarea value={form.subclassText} onChange={(e) => set("subclassText", e.target.value)} rows={2} className={textareaCls}
                    placeholder="You gain a subclass of your choice…" />
          <p className={hintCls}>Add the pick itself, and the levels a subclass gives features, under “By Level”.</p>
        </div>
      </FilterSection>

      <FilterSection title="Class Table" defaultOpen={false}>
        <div className="space-y-4">
          <p className={hintCls}>{TABLE_HINT}</p>
          <div>
            <div className={labelCls}>Columns</div>
            <ColumnsEditor columns={form.columns} onChange={(v) => set("columns", v)} />
          </div>
          <div>
            <div className={labelCls}>Pools features spend</div>
            <ResourcesEditor resources={form.resources} onChange={(v) => set("resources", v)} />
          </div>
        </div>
      </FilterSection>

      <FilterSection title="Spellcasting" defaultOpen={form.spellcasting.on}>
        <SpellcastingEditor value={form.spellcasting} onChange={(v) => set("spellcasting", v)} lists={lists} />
      </FilterSection>

      <FilterSection title="By Level">
        <ProgressionEditor rows={form.progression} onChange={(v) => set("progression", v)} features={form.features}
                           edition={form.edition} classId={classId} subclassTitle={form.subclassTitle || `${form.name} Subclass`} index={index} />
      </FilterSection>

      <FilterSection title="Features">
        <FeaturesEditor features={form.features} onChange={(v) => set("features", v)} categories={FEATURE_CATEGORIES} levels withText
                        hint="Each feature with its level and text; the numbers are optional (an attack, a save, healing). Formulas may use class_level and the table's column ids." />
      </FilterSection>

      <KeptSection choices={form.grants.extraChoices} onChoices={(v) => set("grants", { ...form.grants, extraChoices: v })}
                   grants={form.grants.extraGrants} index={index} />
      {restKeys.length > 0 && (
        <p className={`${hintCls} mt-2`}>Also kept as they are: {restKeys.map((k) => titleCase(k.replace(/_/g, " "))).join(", ")}.</p>
      )}
    </CreateModal>
  );
}
