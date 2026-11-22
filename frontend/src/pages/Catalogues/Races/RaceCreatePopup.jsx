import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import { CreateModal, ChipsHeading, fieldCls, hintCls, labelCls, addRowCls, removeRowCls } from "../catalogueStyle";
import {
  BasicsSection, ChipToggles, DescriptionSection, GrantsEditor, KeptSection, TextField,
} from "../catalogueParts";
import { buildNameIndex, labelFromId, namedBlocks, toggleIn, titleCase, SIZES, CREATURE_TYPES } from "../catalogueHelpers";
import { REPLACEABLE, emptyRaceForm, emptySubrace, formToRace, raceToForm } from "./raceHelpers";

// What a race's (or a subrace's) grants editor shows; races give no gear.
const RACE_SECTIONS = ["traits", "ability", "proficiencies", "spells", "feats"];

/* Create, edit or copy a race. The form writes the same record shape the
   pipeline makes (text · size · creature types · grants · choices ·
   subraces · features). */
export default function RaceCreatePopup({ open, onClose, editingRace, copyFromRace }) {
  const createRace = useCatalogueStore((s) => s.createRace);
  const updateRace = useCatalogueStore((s) => s.updateRace);
  const saving = useCatalogueStore((s) => s.savingRace);
  const saveError = useCatalogueStore((s) => s.racesError);

  const feats = useCatalogueStore((s) => s.feats);
  const loadFeats = useCatalogueStore((s) => s.loadFeats);
  const spells = useCatalogueStore((s) => s.spells);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);

  const [form, setForm] = useState(emptyRaceForm);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!feats?.length) loadFeats();
    if (!spells?.length) loadSpells();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    setNameError(false);
    const src = editingRace || copyFromRace;
    setForm(src ? raceToForm(src, { copy: !editingRace }) : emptyRaceForm());
  }, [open, editingRace, copyFromRace]);

  const index = useMemo(() => buildNameIndex(feats, spells), [feats, spells]);
  const blocks = useMemo(() => namedBlocks(form.text), [form.text]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setSubrace = (i, v) => set("subraces", form.subraces.map((x, j) => (j === i ? v : x)));

  const isEditing = !!editingRace;
  const title = isEditing ? "Edit Race" : copyFromRace ? "Copy Race" : "Create Race";

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    const record = formToRace(form, isEditing ? editingRace : null);
    try {
      if (isEditing) await updateRace(editingRace.id, record);
      else await createRace(record);
      onClose();
    } catch {
      /* the error is shown in the footer */
    }
  };

  const catalogues = { feats, spells };

  return (
    <CreateModal open={open} title={title} onClose={onClose} onSave={handleSave} saving={saving}
                 saveLabel={isEditing ? "Save Changes" : "Save"} error={saveError}>
      <BasicsSection form={form} set={set} nameError={nameError} namePlaceholder="e.g. Dwarf">
        <div>
          <div className={labelCls}>Size (more than one: the player picks)</div>
          <ChipToggles options={SIZES} selected={form.size} labelOf={titleCase} onToggle={(v) => set("size", toggleIn(form.size, v))} />
        </div>
        <div>
          <div className={labelCls}>Creature type</div>
          <ChipToggles options={CREATURE_TYPES} selected={form.creatureTypes} labelOf={titleCase}
                       onToggle={(v) => set("creatureTypes", toggleIn(form.creatureTypes, v))} />
        </div>
      </BasicsSection>

      <DescriptionSection value={form.text} onChange={(v) => set("text", v)}
                          placeholder={"**Darkvision.** You have Darkvision with a range of 60 feet.\n\n**Dwarven Resilience.** You have Resistance to Poison damage…"} />

      <GrantsEditor value={form.grants} onChange={(v) => set("grants", v)} catalogues={catalogues} index={index} show={RACE_SECTIONS} />

      <FilterSection title="Subraces">
        <div className="space-y-3">
          <p className={hintCls}>
            Lineages, legacies, ancestries… With subraces, the player picks one. A subrace holds only what it adds; mark what of the
            race it replaces instead.
          </p>
          {form.subraces.map((sr, i) => (
            <SubraceEditor key={sr.id || i} value={sr} onChange={(v) => setSubrace(i, v)}
                           onRemove={() => set("subraces", form.subraces.filter((_, j) => j !== i))}
                           raceBlocks={blocks} catalogues={catalogues} index={index} startOpen={!sr.id} />
          ))}
          <button type="button" onClick={() => set("subraces", [...form.subraces, emptySubrace()])} className={addRowCls}>
            + add subrace
          </button>
        </div>
      </FilterSection>

      <KeptSection features={form.features} onFeatures={(v) => set("features", v)}
                   choices={form.grants.extraChoices} onChoices={(v) => set("grants", { ...form.grants, extraChoices: v })}
                   grants={form.grants.extraGrants} index={index} />
    </CreateModal>
  );
}

/* One subrace, folded away until opened (a race can have ten). */
function SubraceEditor({ value, onChange, onRemove, raceBlocks, catalogues, index, startOpen }) {
  const [open, setOpen] = useState(startOpen);
  const sr = value;
  const set = (p) => onChange({ ...sr, ...p });
  return (
    <div className="space-y-2 border-l border-rule/30 pl-3">
      <div className="flex items-baseline gap-3">
        <ChipsHeading open={open} onToggle={() => setOpen((o) => !o)} label={sr.name || "New subrace"} count={0} />
        <span className="flex-1" />
        <button type="button" onClick={onRemove} className={removeRowCls} aria-label="Remove subrace">✕</button>
      </div>
      {open && (
        <div className="space-y-3">
          <input type="text" value={sr.name} onChange={(e) => set({ name: e.target.value })} placeholder="subrace name (e.g. Hill Dwarf)"
                 className={fieldCls} />
          <div>
            <div className={labelCls}>Its own size (none = the race's)</div>
            <ChipToggles options={SIZES} selected={sr.size} labelOf={titleCase} onToggle={(v) => set({ size: toggleIn(sr.size, v) })} />
          </div>
          <div>
            <div className={labelCls}>Replaces the race's</div>
            <ChipToggles options={REPLACEABLE} selected={sr.replaces} labelOf={labelFromId} onToggle={(v) => set({ replaces: toggleIn(sr.replaces, v) })} />
          </div>
          {(raceBlocks.length > 0 || sr.replacesText.length > 0) && (
            <div>
              <div className={labelCls}>Replaces these parts of the race's text</div>
              <ChipToggles options={[...new Set([...raceBlocks, ...sr.replacesText])]} selected={sr.replacesText} labelOf={(b) => b}
                           onToggle={(v) => set({ replacesText: toggleIn(sr.replacesText, v) })} />
            </div>
          )}
          <TextField value={sr.text} onChange={(v) => set({ text: v })} rows={4} placeholder="What this subrace adds…" />
          <GrantsEditor value={sr.grants} onChange={(v) => set({ grants: v })} catalogues={catalogues} index={index} show={RACE_SECTIONS} />
          <KeptSection choices={sr.grants.extraChoices} onChoices={(v) => set({ grants: { ...sr.grants, extraChoices: v } })}
                       grants={sr.grants.extraGrants} index={index} />
        </div>
      )}
    </div>
  );
}
