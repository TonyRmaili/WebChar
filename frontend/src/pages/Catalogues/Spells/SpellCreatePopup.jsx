import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import SheetSaveChoice from "../SheetSaveChoice";
import { CreateModal, fieldCls, hintCls, labelCls, addRowCls, removeRowCls } from "../catalogueStyle";
import { BasicsSection, CurrencyEditor, DescriptionSection, FeaturesEditor, FoldChips, Segmented } from "../catalogueParts";
import { SPELL_SCHOOLS, collectUnique, toggleIn, numOrNull, labelFromId, nameFromId, titleCase } from "../catalogueHelpers";
import {
  AREA_SHAPES, CONSUMED_OPTIONS, DURATION_TYPES, DURATION_UNITS, LEVELS, RANGE_TYPES, TIME_UNITS,
  emptySpellForm, formToSpell, formatLevel, spellToForm,
} from "./spellHelpers";

const DURATION_LABELS = { instant: "instantaneous", timed: "timed", permanent: "until ended", special: "special" };
const ENDS = ["dispel", "trigger"];

// "wizard-xphb" → "Wizard · XPHB", so both books' classes can be told apart.
const classLabel = (id) => `${nameFromId(id)} · ${String(id).split("-").pop().toUpperCase()}`;

/* Create, edit or copy a spell. The form writes the same record the
   pipeline makes (data-model §4d): level, school, casting time, range,
   components, duration, the classes that have it, the text and its
   numbers (features). What it has no field for (5etools' tags, the SRD
   flag, reprints) is kept unchanged.

   `sheet` (optional): the form edits a character's own spell instead of
   the catalogue (the Spellbook tab), like ItemCreatePopup:
   { onSubmit(record, { catalogue, asNew }), homebrew: { id, name } | null }. */
export default function SpellCreatePopup({ open, onClose, editingSpell, copyFromSpell, sheet }) {
  const createSpell = useCatalogueStore((s) => s.createSpell);
  const updateSpell = useCatalogueStore((s) => s.updateSpell);
  const saving = useCatalogueStore((s) => s.savingSpell);
  const saveError = useCatalogueStore((s) => s.spellsError);
  const spells = useCatalogueStore((s) => s.spells);

  const [form, setForm] = useState(emptySpellForm);
  const [nameError, setNameError] = useState(false);
  const [saveTo, setSaveTo] = useState("sheet"); // sheet mode: "sheet" | "catalogue"
  const [asNew, setAsNew] = useState(false);
  const [sheetSaving, setSheetSaving] = useState(false);
  const [sheetError, setSheetError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setNameError(false);
    setSaveTo("sheet");
    setAsNew(false);
    setSheetError(null);
    const src = editingSpell || copyFromSpell;
    setForm(src ? spellToForm(src, { copy: !editingSpell }) : emptySpellForm());
  }, [open, editingSpell, copyFromSpell]);

  // The class ids the catalogue's spells use (wizard-xphb, wizard-phb, …).
  const classIds = useMemo(() => collectUnique(spells, "classes"), [spells]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const patch = (key, p) => setForm((f) => ({ ...f, [key]: { ...f[key], ...p } }));
  const setRow = (key, i, p) => set(key, form[key].map((x, j) => (j === i ? { ...x, ...p } : x)));
  const removeRow = (key, i) => set(key, form[key].filter((_, j) => j !== i));

  const isEditing = !!editingSpell;
  const title = sheet ? (isEditing ? `Edit your ${editingSpell.name || "spell"}` : "Your own spell") : isEditing ? "Edit Spell" : copyFromSpell ? "Copy Spell" : "Create Spell";

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    const record = formToSpell(form, isEditing ? editingSpell : null);
    if (sheet) {
      try {
        setSheetSaving(true);
        setSheetError(null);
        await sheet.onSubmit(record, { catalogue: saveTo === "catalogue", asNew });
        onClose();
      } catch (e) {
        setSheetError(e?.message || "Couldn't save");
      } finally {
        setSheetSaving(false);
      }
      return;
    }
    try {
      if (isEditing) await updateSpell(editingSpell.id, record);
      else await createSpell(record);
      onClose();
    } catch {
      /* the error is shown in the footer */
    }
  };

  const r = form.range;
  const c = form.components;
  const restKeys = Object.keys(form.rest);

  return (
    <CreateModal open={open} title={title} onClose={onClose} onSave={handleSave} saving={sheet ? sheetSaving : saving}
                 saveLabel={isEditing ? "Save Changes" : "Save"} error={sheet ? sheetError : saveError}>
      {sheet && <SheetSaveChoice saveTo={saveTo} setSaveTo={setSaveTo} asNew={asNew} setAsNew={setAsNew} homebrew={sheet.homebrew} />}
      <BasicsSection form={form} set={set} nameError={nameError} namePlaceholder="e.g. Ember Lance">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <label className="flex items-baseline gap-2">
            <span className={`${labelCls} !mb-0`}>Level</span>
            <select value={form.level} onChange={(e) => set("level", Number(e.target.value))} className={`${fieldCls} !w-28`}>
              {LEVELS.map((l) => <option key={l} value={l}>{formatLevel(l)}</option>)}
            </select>
          </label>
          <label className="flex items-baseline gap-2">
            <span className={`${labelCls} !mb-0`}>School</span>
            <select value={form.school} onChange={(e) => set("school", e.target.value)} className={`${fieldCls} !w-40`}>
              {[...new Set([...SPELL_SCHOOLS, form.school].filter(Boolean))].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </select>
          </label>
          <label className="flex items-baseline gap-2 text-sm">
            <input type="checkbox" checked={form.ritual} onChange={(e) => set("ritual", e.target.checked)} className="accent-rubric" />
            Ritual
          </label>
        </div>
      </BasicsSection>

      <FilterSection title="Casting Time">
        <div className="space-y-1">
          {form.time.map((t, i) => (
            <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {i > 0 && <span className="text-xs italic text-ink-faded">or</span>}
              <input type="number" min={1} value={t.number ?? 1} onChange={(e) => setRow("time", i, { number: numOrNull(e.target.value) ?? 1 })}
                     className={`${fieldCls} !w-12`} aria-label="How many" />
              <select value={t.unit} onChange={(e) => setRow("time", i, { unit: e.target.value })} className={`${fieldCls} !w-36`}>
                {[...new Set([...TIME_UNITS, t.unit])].map((u) => <option key={u} value={u}>{labelFromId(u)}</option>)}
              </select>
              {t.unit === "reaction" && (
                <input type="text" value={t.trigger || ""} onChange={(e) => setRow("time", i, { trigger: e.target.value || undefined })}
                       placeholder="which you take when…" className={`${fieldCls} min-w-[12rem] flex-1`} />
              )}
              {t.note != null && (
                <input type="text" value={t.note} onChange={(e) => setRow("time", i, { note: e.target.value })} placeholder="for which option"
                       className={`${fieldCls} !w-32`} />
              )}
              {form.time.length > 1 && (
                <button type="button" onClick={() => removeRow("time", i)} className={removeRowCls} aria-label="Remove">✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => set("time", [...form.time, { number: 1, unit: "action" }])} className={addRowCls}>
            + another casting time
          </button>
        </div>
      </FilterSection>

      <FilterSection title="Range & Components">
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={`${labelCls} !mb-0`}>Range</span>
            <select value={r.type} onChange={(e) => set("range", { ...r, type: e.target.value })} className={`${fieldCls} !w-32`}>
              {RANGE_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
            </select>
            {(r.type === "feet" || r.type === "miles") && (
              <input type="number" min={0} value={r.amount ?? ""} onChange={(e) => patch("range", { amount: numOrNull(e.target.value) })}
                     className={`${fieldCls} !w-16`} aria-label="Distance" />
            )}
            {r.type === "self" && (
              <>
                <span className="text-xs text-ink-faded">area</span>
                <select value={r.area?.shape || ""} className={`${fieldCls} !w-32`}
                        onChange={(e) => patch("range", { area: e.target.value ? { size: 15, unit: "feet", ...r.area, shape: e.target.value } : undefined })}>
                  <option value="">— just you —</option>
                  {AREA_SHAPES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                </select>
                {r.area?.shape && (
                  <>
                    <input type="number" min={0} value={r.area.size ?? ""} onChange={(e) => patch("range", { area: { ...r.area, size: numOrNull(e.target.value) } })}
                           className={`${fieldCls} !w-14`} aria-label="Area size" />
                    <span className="text-xs text-ink-faded">{r.area.unit === "miles" ? "miles" : "feet"}</span>
                  </>
                )}
              </>
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <span className={`${labelCls} !mb-0`}>Components</span>
            {[["v", "Verbal"], ["s", "Somatic"], ["r", "Royalty"]].map(([k, label]) =>
              k === "r" && !c.r ? null : (
                <label key={k} className="flex items-baseline gap-2 text-sm">
                  <input type="checkbox" checked={c[k]} onChange={(e) => patch("components", { [k]: e.target.checked })} className="accent-rubric" />
                  {label}
                </label>
              )
            )}
          </div>
          <div className="space-y-1">
            <input type="text" value={c.mText} onChange={(e) => patch("components", { mText: e.target.value })}
                   placeholder="Material (empty = none), e.g. a ball of bat guano and sulfur" className={fieldCls} />
            {c.mText.trim() && (
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="text-xs text-ink-faded">worth at least</span>
                <CurrencyEditor value={c.mCost} onChange={(v) => patch("components", { mCost: v })} />
                <Segmented size="sm" options={CONSUMED_OPTIONS} value={c.mConsumed} onChange={(v) => patch("components", { mConsumed: v })} />
              </div>
            )}
          </div>
        </div>
      </FilterSection>

      <FilterSection title="Duration">
        <div className="space-y-1">
          {form.duration.map((d, i) => (
            <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {i > 0 && <span className="text-xs italic text-ink-faded">or</span>}
              <select value={d.type} onChange={(e) => setRow("duration", i, { type: e.target.value, ...(e.target.value === "timed" ? { amount: d.amount ?? 1, unit: d.unit || "minute" } : {}) })}
                      className={`${fieldCls} !w-36`}>
                {DURATION_TYPES.map((t) => <option key={t} value={t}>{DURATION_LABELS[t]}</option>)}
              </select>
              {d.type === "timed" && (
                <>
                  <input type="number" min={1} value={d.amount ?? 1} onChange={(e) => setRow("duration", i, { amount: numOrNull(e.target.value) ?? 1 })}
                         className={`${fieldCls} !w-14`} aria-label="How long" />
                  <select value={d.unit || "minute"} onChange={(e) => setRow("duration", i, { unit: e.target.value })} className={`${fieldCls} !w-24`}>
                    {[...new Set([...DURATION_UNITS, d.unit].filter(Boolean))].map((u) => <option key={u} value={u}>{u}s</option>)}
                  </select>
                  <label className="flex items-baseline gap-2 text-sm">
                    <input type="checkbox" checked={!!d.concentration} onChange={(e) => setRow("duration", i, { concentration: e.target.checked })} className="accent-rubric" />
                    Concentration
                  </label>
                </>
              )}
              {d.type === "permanent" && (
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-xs text-ink-faded">ends when</span>
                  {ENDS.map((e) => (
                    <label key={e} className="flex items-baseline gap-1.5 text-sm">
                      <input type="checkbox" checked={(d.ends || []).includes(e)} className="accent-rubric"
                             onChange={() => setRow("duration", i, { ends: toggleIn(d.ends || [], e) })} />
                      {e === "dispel" ? "dispelled" : "triggered"}
                    </label>
                  ))}
                </span>
              )}
              {form.duration.length > 1 && (
                <button type="button" onClick={() => removeRow("duration", i)} className={removeRowCls} aria-label="Remove">✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => set("duration", [...form.duration, { type: "timed", amount: 1, unit: "minute", concentration: false }])}
                  className={addRowCls}>
            + another duration
          </button>
        </div>
      </FilterSection>

      <FilterSection title="Classes">
        <FoldChips label="On the spell lists of" options={[...new Set([...classIds, ...form.classes])]} selected={form.classes}
                   labelOf={classLabel} onToggle={(id) => set("classes", toggleIn(form.classes, id))} defaultOpen />
      </FilterSection>

      <DescriptionSection value={form.text} onChange={(v) => set("text", v)}
                          placeholder={"A bright streak flashes from you…\n\n**Using a Higher-Level Spell Slot.** The damage increases by 1d6 for each spell slot level above 3."} />

      <FilterSection title="What It Does" defaultOpen={form.features.length > 0}>
        <FeaturesEditor features={form.features} onChange={(v) => set("features", v)} spell
                        hint="The numbers the sheet and dice tower use: an attack, a save, damage, healing. A cantrip's dice can grow by character level (1: 1d10, 5: 2d10, 11: 3d10, 17: 4d10); upcast dice go in “+ per slot”. Formulas may use pb and spell_mod." />
      </FilterSection>

      {restKeys.length > 0 && (
        <p className={`${hintCls} mt-2`}>Also kept as they are: {restKeys.map((k) => titleCase(k.replace(/_/g, " "))).join(", ")}.</p>
      )}
    </CreateModal>
  );
}
