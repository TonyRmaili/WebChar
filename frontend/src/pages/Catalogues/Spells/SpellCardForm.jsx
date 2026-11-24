import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import SheetSaveChoice from "../SheetSaveChoice";
import { CreateModal, PartPopup, labelCls } from "../catalogueStyle";
import { EDITION_OPTIONS, EntryPicker, FoldChips, Segmented, VISIBILITY_OPTIONS } from "../catalogueParts";
import { buildNameIndex, collectUnique, nameFromId, titleCase, toggleIn } from "../catalogueHelpers";
import { AddRow, CardFeatures, CardText, StatLine, plural } from "../cardParts";
import {
  emptySpellForm, formToSpell, formatComponents, formatDuration, formatRange, formatTime, spellClasses, spellSubtitle, spellToForm,
} from "./spellHelpers";
import { ComponentsFields, DurationFields, LevelFields, RangeFields, TimeFields } from "./spellFormParts";

/* ═══════════════════════════════════════════════════════════════════
   SpellCardForm — the spell form (2026-11-24): a spell is made on its own
   card, drawn the way the catalogue shows it (SpellPopup), like the item,
   feat and optional feature cards (the pieces are ../cardParts).

     header       the name, typed on the card · "Level 3 Evocation
                  (Ritual)" opens level, school, ritual
     lines        Casting Time · Range · Components · Duration · Classes:
                  each opens its window (spellFormParts)
     text         the description, typed on the card (with "Using a
                  Higher-Level Spell Slot." as a paragraph)
     what it does the numbers the sheet uses (attack, save, damage, heal,
                  rider…) as features → the feature window (`spell`)
     footer       edition · visibility · things kept from the book

   It edits the same form shape as before (spellHelpers.spellToForm /
   formToSpell), so the record saved is the one the pipeline makes.

   `sheet` (optional): it edits a character's own spell (the Spellbook
   tab): { onSubmit(record, { catalogue, asNew }), homebrew: { id, name } | null }.
   ═══════════════════════════════════════════════════════════════════ */

// "wizard-xphb" → "Wizard · XPHB", so both books' classes can be told apart.
const classLabel = (id) => `${nameFromId(id)} · ${String(id).split("-").pop().toUpperCase()}`;

const WINDOWS = {
  level: { title: "Level & school", hint: "A cantrip is level 0. A ritual can be cast without a slot by taking 10 minutes longer." },
  time: { title: "Casting time", hint: "An action, a bonus action, a reaction (and when you take it), or minutes and hours. Some spells have more than one." },
  range: { title: "Range", hint: "How far it reaches. “Self” with an area is a cone, line or emanation starting from you." },
  components: { title: "Components", hint: "Verbal, somatic, and the material: what it is, what it's worth, and whether casting uses it up." },
  duration: { title: "Duration", hint: "How long it lasts, and whether it needs concentration." },
  classes: { title: "Classes", hint: "The spell lists it's on: those classes can learn or prepare it." },
  more: { title: "Edition & visibility", hint: "Which rules it's for, and who can see it." },
};

const START_POINTS = [
  { id: "cantrip", label: "A cantrip", hint: "level 0, cast at will: Fire Bolt, Guidance" },
  { id: "spell", label: "A levelled spell", hint: "uses a spell slot: Magic Missile, Fireball" },
  { id: "concentration", label: "A concentration spell", hint: "lasts while you concentrate: Bless, Hold Person" },
  { id: "ritual", label: "A ritual", hint: "can be cast without a slot: Detect Magic" },
  { id: "blank", label: "An empty card", hint: "start from nothing" },
];
const startForm = (id) => {
  const f = emptySpellForm();
  if (id === "cantrip") return { ...f, level: 0 };
  if (id === "concentration") return { ...f, duration: [{ type: "timed", amount: 1, unit: "minute", concentration: true }] };
  if (id === "ritual") return { ...f, ritual: true, time: [{ number: 1, unit: "minute" }], duration: [{ type: "timed", amount: 1, unit: "hour", concentration: false }] };
  return f;
};

export default function SpellCardForm({ open, onClose, editingSpell = null, copyFromSpell = null, sheet = null }) {
  const createSpell = useCatalogueStore((s) => s.createSpell);
  const updateSpell = useCatalogueStore((s) => s.updateSpell);
  const saving = useCatalogueStore((s) => s.savingSpell);
  const saveError = useCatalogueStore((s) => s.spellsError);
  const spells = useCatalogueStore((s) => s.spells);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);

  const [form, setForm] = useState(emptySpellForm);
  const [started, setStarted] = useState(false);
  const [win, setWin] = useState(null);
  const [nameError, setNameError] = useState(false);
  const [saveTo, setSaveTo] = useState("sheet"); // sheet mode: "sheet" | "catalogue"
  const [asNew, setAsNew] = useState(false);
  const [sheetSaving, setSheetSaving] = useState(false);
  const [sheetError, setSheetError] = useState(null);

  useEffect(() => {
    if (open && !spells?.length) loadSpells?.();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const src = editingSpell || copyFromSpell;
    setForm(src ? spellToForm(src, { copy: !editingSpell }) : emptySpellForm());
    setStarted(!!src);
    setWin(null);
    setNameError(false);
    setSaveTo("sheet");
    setAsNew(false);
    setSheetError(null);
  }, [open, editingSpell, copyFromSpell]);

  const index = useMemo(() => buildNameIndex(spells), [spells]);
  // The class ids the catalogue's spells use (wizard-xphb, wizard-phb, …).
  const classIds = useMemo(() => collectUnique(spells, "classes"), [spells]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const isEditing = !!editingSpell;
  const record = formToSpell(form, isEditing ? editingSpell : null);
  const restKeys = Object.keys(form.rest || {});

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
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

  const title = sheet ? (isEditing ? `Edit your ${editingSpell.name || "spell"}` : "Your own spell") : `${isEditing ? "Edit" : copyFromSpell ? "Copy" : "New"} spell`;
  const winInfo = win ? WINDOWS[win] : null;
  const classes = spellClasses(record);
  const lines = [
    ["Casting Time", formatTime(record), "time"],
    ["Range", formatRange(record.range), "range"],
    ["Components", formatComponents(record.components) || "none", "components"],
    ["Duration", formatDuration(record), "duration"],
    ...(classes.length ? [["Classes", classes.join(", "), "classes"]] : []),
  ];

  return (
    <CreateModal open={open} title={title} onClose={onClose} onSave={handleSave} saving={sheet ? sheetSaving : saving}
                 saveLabel={isEditing ? "Save Changes" : "Save"} saveDisabled={!started} error={sheet ? sheetError : saveError} width="max-w-2xl">
      {sheet && started && <SheetSaveChoice saveTo={saveTo} setSaveTo={setSaveTo} asNew={asNew} setAsNew={setAsNew} homebrew={sheet.homebrew} />}
      {!started ? (
        <div className="space-y-4">
          <p className="text-sm italic text-ink-faded">Start from…</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {START_POINTS.map((p) => (
              <button key={p.id} type="button" onClick={() => { setForm(startForm(p.id)); setStarted(true); }}
                      className="rounded-sm border border-rule/40 px-3 py-2 text-left transition hover:border-rubric/60 hover:bg-rubric/5">
                <div className="text-[15px] text-ink">{p.label}</div>
                <div className="text-xs italic text-ink-faded">{p.hint}</div>
              </button>
            ))}
          </div>
          <div>
            <div className={labelCls}>…or a copy of a spell from the book</div>
            <EntryPicker entries={spells || []} index={index} selected={[]} placeholder="search spells…"
                         onToggle={(id) => {
                           const sp = (spells || []).find((x) => x.id === id);
                           if (!sp) return;
                           setForm(spellToForm(sp, { copy: true }));
                           setStarted(true);
                         }} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* header: the name, and the line under it */}
          <div className="border-b border-rule/40 pb-1">
            <input type="text" value={form.name} onChange={(e) => { set("name", e.target.value); setNameError(false); }} placeholder="Spell name"
                   aria-label="Name" autoFocus={!form.name}
                   className={`w-full bg-transparent text-xl font-bold tracking-wide text-ink outline-none placeholder:font-normal placeholder:italic placeholder:text-ink-faint ${nameError ? "border-b border-bad" : ""}`} />
            {nameError && <p className="text-xs italic text-bad">It needs a name.</p>}
            <button type="button" onClick={() => setWin("level")} className="text-left text-sm italic text-ink-faded hover:text-rubric" title="Level, school, ritual">
              {spellSubtitle(record)}
            </button>
          </div>

          {/* casting time, range, components, duration, classes */}
          <div className="space-y-0.5 border-b border-rule/30 pb-2">
            {lines.map(([label, value, key]) => (
              <StatLine key={key} label={label} value={value || "—"} onClick={() => setWin(key)} />
            ))}
          </div>
          {!classes.length && (
            <AddRow items={[{ label: "classes", hint: "The spell lists it's on (Wizard, Cleric…)", onClick: () => setWin("classes") }]} />
          )}

          {/* the text */}
          <CardText value={form.text} onChange={(v) => set("text", v)}
                    placeholder={"A bright streak flashes from you…\n\n**Using a Higher-Level Spell Slot.** The damage increases by 1d6 for each spell slot level above 3."} />

          {/* what it does: the numbers the sheet uses */}
          <CardFeatures features={form.features || []} onChange={(v) => set("features", v)} text={form.text} index={index} fieldProps={{ spell: true }} />

          {/* footer */}
          <div className="flex flex-wrap items-baseline gap-x-3 border-t border-rule/25 pt-1.5 text-xs italic text-ink-faded">
            <button type="button" onClick={() => setWin("more")} className="text-left hover:text-rubric" title="Edition, who can see it">
              {[form.edition === "classic" ? "Classic (2014)" : "One (2024)", form.visibility === "public" ? "public" : "private"].join(" · ")}
            </button>
            {restKeys.length > 0 && (
              <span title={`Saved as they are: ${restKeys.map((k) => titleCase(k.replace(/_/g, " "))).join(", ")}`}>· {plural(restKeys.length, "thing")} kept from the book</span>
            )}
          </div>
        </div>
      )}

      {winInfo && (
        <PartPopup title={winInfo.title} hint={winInfo.hint} onClose={() => setWin(null)}>
          {win === "level" && <LevelFields form={form} set={set} />}
          {win === "time" && <TimeFields form={form} set={set} />}
          {win === "range" && <RangeFields form={form} set={set} />}
          {win === "components" && <ComponentsFields form={form} set={set} />}
          {win === "duration" && <DurationFields form={form} set={set} />}
          {win === "classes" && (
            <FoldChips label="On the spell lists of" options={[...new Set([...classIds, ...form.classes])]} selected={form.classes}
                       labelOf={classLabel} onToggle={(id) => set("classes", toggleIn(form.classes, id))} defaultOpen />
          )}
          {win === "more" && (
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              <div>
                <div className={labelCls}>Edition</div>
                <Segmented size="sm" options={EDITION_OPTIONS} value={form.edition} onChange={(v) => set("edition", v)} />
              </div>
              <div>
                <div className={labelCls}>Visibility</div>
                <Segmented size="sm" options={VISIBILITY_OPTIONS} value={form.visibility} onChange={(v) => set("visibility", v)} />
              </div>
            </div>
          )}
        </PartPopup>
      )}
    </CreateModal>
  );
}
