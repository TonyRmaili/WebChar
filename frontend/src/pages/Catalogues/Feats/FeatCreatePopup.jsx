import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import { CreateModal, fieldCls, hintCls, labelCls, addRowCls, removeRowCls } from "../catalogueStyle";
import {
  BasicsSection, DescriptionSection, GrantsEditor, KeptSection, PrerequisitesEditor, Segmented, TextField,
} from "../catalogueParts";
import { buildNameIndex, FEAT_CATEGORIES } from "../catalogueHelpers";
import { emptyFeatForm, emptyFeatOption, featToForm, formToFeat } from "./featsHelpers";

const CATEGORY_OPTIONS = [
  { value: "", label: "None" },
  ...Object.entries(FEAT_CATEGORIES).map(([value, label]) => ({ value, label })),
];

// What a feat's (or an option's) grants editor shows; feats give no gear.
const FEAT_SECTIONS = ["ability", "traits", "proficiencies", "spells", "feats"];
const OPTION_SECTIONS = ["ability", "traits", "proficiencies", "spells"];

/* Create, edit or copy a feat. The form writes the same record shape the
   pipeline makes (text · category · prerequisites · grants · choices ·
   options · features). */
export default function FeatCreatePopup({ open, onClose, editingFeat, copyFromFeat }) {
  const createFeat = useCatalogueStore((s) => s.createFeat);
  const updateFeat = useCatalogueStore((s) => s.updateFeat);
  const saving = useCatalogueStore((s) => s.savingFeat);
  const saveError = useCatalogueStore((s) => s.featsError);

  const feats = useCatalogueStore((s) => s.feats);
  const spells = useCatalogueStore((s) => s.spells);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);

  const [form, setForm] = useState(emptyFeatForm);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (open && !spells?.length) loadSpells();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    setNameError(false);
    const src = editingFeat || copyFromFeat;
    setForm(src ? featToForm(src, { copy: !editingFeat }) : emptyFeatForm());
  }, [open, editingFeat, copyFromFeat]);

  const index = useMemo(() => buildNameIndex(feats, spells), [feats, spells]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setOption = (i, p) => set("options", form.options.map((o, j) => (j === i ? { ...o, ...p } : o)));

  const isEditing = !!editingFeat;
  const title = isEditing ? "Edit Feat" : copyFromFeat ? "Copy Feat" : "Create Feat";

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    const record = formToFeat(form, isEditing ? editingFeat : null);
    try {
      if (isEditing) await updateFeat(editingFeat.id, record);
      else await createFeat(record);
      onClose();
    } catch {
      /* the error is shown in the footer */
    }
  };

  return (
    <CreateModal open={open} title={title} onClose={onClose} onSave={handleSave} saving={saving}
                 saveLabel={isEditing ? "Save Changes" : "Save"} error={saveError}>
      <BasicsSection form={form} set={set} nameError={nameError} namePlaceholder="e.g. Alert">
        <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
          <div>
            <div className={labelCls}>Category</div>
            <Segmented options={CATEGORY_OPTIONS} value={form.category} onChange={(v) => set("category", v)} />
          </div>
          <label className="flex items-baseline gap-2 text-sm">
            <input type="checkbox" checked={form.repeatable} onChange={(e) => set("repeatable", e.target.checked)} className="accent-rubric" />
            Repeatable
          </label>
        </div>
      </BasicsSection>

      <FilterSection title="Prerequisites">
        <PrerequisitesEditor groups={form.prerequisites} onChange={(v) => set("prerequisites", v)} feats={feats} index={index} />
      </FilterSection>

      <DescriptionSection value={form.text} onChange={(v) => set("text", v)}
                          placeholder={"You gain the following benefits.\n\n**Initiative Proficiency.** When you roll Initiative, you…"} />

      <GrantsEditor value={form.grants} onChange={(v) => set("grants", v)} catalogues={{ feats, spells }} index={index} show={FEAT_SECTIONS} />

      <FilterSection title="Options">
        <div className="space-y-4">
          <p className={hintCls}>
            For a feat taken in one of several versions (Magic Initiate: Cleric / Druid / Wizard). Each option has its own text and
            picks; the feat's own ones apply to all of them.
          </p>
          {form.options.map((o, i) => (
            <div key={o.id || i} className="space-y-2 border-l border-rule/30 pl-3">
              <div className="flex items-baseline gap-3">
                <input type="text" value={o.name} onChange={(e) => setOption(i, { name: e.target.value })} placeholder="option name (e.g. Cleric)"
                       className={`${fieldCls} flex-1`} />
                <button type="button" onClick={() => set("options", form.options.filter((_, j) => j !== i))} className={removeRowCls}
                        aria-label="Remove option">
                  ✕
                </button>
              </div>
              <TextField value={o.text} onChange={(v) => setOption(i, { text: v })} rows={4} placeholder="What this option gives…" />
              <GrantsEditor value={o.grants} onChange={(v) => setOption(i, { grants: v })} catalogues={{ feats, spells }} index={index}
                            show={OPTION_SECTIONS} />
              <KeptSection choices={o.grants.extraChoices} onChoices={(v) => setOption(i, { grants: { ...o.grants, extraChoices: v } })}
                           grants={o.grants.extraGrants} index={index} />
            </div>
          ))}
          <button type="button" onClick={() => set("options", [...form.options, emptyFeatOption()])} className={addRowCls}>
            + add option
          </button>
        </div>
      </FilterSection>

      <KeptSection features={form.features} onFeatures={(v) => set("features", v)}
                   choices={form.grants.extraChoices} onChoices={(v) => set("grants", { ...form.grants, extraChoices: v })}
                   grants={form.grants.extraGrants} index={index} />
    </CreateModal>
  );
}
