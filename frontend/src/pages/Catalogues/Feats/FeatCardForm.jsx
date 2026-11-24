import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import SheetSaveChoice from "../SheetSaveChoice";
import { CreateModal, PartPopup, labelCls } from "../catalogueStyle";
import { EDITION_OPTIONS, EntryPicker, PrerequisitesEditor, Segmented, VISIBILITY_OPTIONS } from "../catalogueParts";
import { buildNameIndex, describeChoice, describeGrants, describePrerequisites, FEAT_CATEGORIES } from "../catalogueHelpers";
import { formToGrants } from "../catalogueForms";
import { AddRow, CardFeatures, CardText, GivesBlock, StatLine, lineBtn, plural, sectionHead } from "../cardParts";
import { emptyFeatForm, emptyFeatOption, featSubtitle, featToForm, formToFeat } from "./featsHelpers";

/* ═══════════════════════════════════════════════════════════════════
   FeatCardForm — the feat form (2026-11-24): a feat is made on its own
   card, drawn the way the catalogue shows it (FeatPopup), like the item
   card (Items/ItemCardForm; the pieces are ../cardParts).

     header         the name, typed on the card · the line under it
                    (category, repeatable) opens a window
     prerequisite   "Prerequisite: Level 4+; Str 13 or Dex 13" → window
     text           the description, typed on the card
     options        Magic Initiate → Cleric · Druid · Wizard: each opens
                    its own small card (name, text, features, what it gives)
     features       "Name. text" + small words → the feature window
     gives          ability scores, traits, proficiencies, spells, a feat
     footer         edition · visibility

   It edits the same form shape as before (featsHelpers.featToForm /
   formToFeat), so the record saved is the one the pipeline makes.

   `sheet` (optional): it edits a character's feat (Feats & Options):
   { onSubmit(record, { catalogue, asNew }), homebrew } — "this sheet only"
   or "my catalogue too" (SheetSaveChoice).
   ═══════════════════════════════════════════════════════════════════ */

const CATEGORY_OPTIONS = [
  { value: "", label: "none" },
  ...Object.entries(FEAT_CATEGORIES).map(([value, label]) => ({ value, label })),
];
// What "+ …" offers under "What it gives": a feat's, and an option's (no feat in a feat's option).
const FEAT_PARTS = ["ability", "traits", "proficiencies", "spells", "feats"];
const OPTION_PARTS = ["ability", "traits", "proficiencies", "spells"];

const WINDOWS = {
  type: { title: "Category", hint: "What kind of feat it is (origin feats come with a background; general ones at 4th level…), and whether it can be taken more than once." },
  prereqs: { title: "Prerequisite", hint: "What a character needs to take it. Any one group is enough; everything inside a group is needed. The sheet warns, it never blocks." },
  more: { title: "Edition & visibility", hint: "Which rules it's for, and who can see it." },
};

const START_POINTS = [
  { id: "origin", label: "An origin feat", hint: "taken with a background: Alert, Lucky, Magic Initiate" },
  { id: "general", label: "A general feat", hint: "from 4th level: Great Weapon Master, War Caster" },
  { id: "fighting_style", label: "A fighting style", hint: "Archery, Defense, Dueling" },
  { id: "epic_boon", label: "An epic boon", hint: "at 19th level: Boon of Fate" },
  { id: "blank", label: "An empty card", hint: "start from nothing" },
];
const startForm = (id) => ({ ...emptyFeatForm(), category: id === "blank" ? "" : id });

// "+1 to Str or Dex · choose 2 cantrips…": an option's line on the card.
function optionWords(o, index) {
  const { grants, choices } = formToGrants(o.grants);
  const bits = [...describeGrants(grants, index).map((r) => `${r.label}: ${r.value}`), ...(choices || []).map((c) => describeChoice(c, index)).filter(Boolean).map((d) => `${d.label}: ${d.value}`)];
  if ((o.features || []).length) bits.push(plural(o.features.length, "feature"));
  return bits.join(" · ");
}

/* One option of the feat (Magic Initiate · Cleric), as a small card in
   its window: its name, its text, its features, what it gives. */
function OptionCard({ value: o, onChange, catalogues, index }) {
  const set = (p) => onChange({ ...o, ...p });
  return (
    <div className="space-y-3">
      <input type="text" value={o.name} onChange={(e) => set({ name: e.target.value })} placeholder="Option name (Cleric)" aria-label="Option name" autoFocus={!o.name}
             className="w-full border-b border-rule/40 bg-transparent pb-1 text-lg font-bold tracking-wide text-ink outline-none placeholder:font-normal placeholder:italic placeholder:text-ink-faint" />
      <CardText value={o.text || ""} onChange={(v) => set({ text: v })} placeholder="What this option gives…" />
      <CardFeatures features={o.features || []} onChange={(v) => set({ features: v })} text={o.text || ""} index={index} />
      <GivesBlock value={o.grants} onChange={(v) => set({ grants: v })} parts={OPTION_PARTS} catalogues={catalogues} index={index} />
    </div>
  );
}

export default function FeatCardForm({ open, onClose, editingFeat = null, copyFromFeat = null, sheet = null }) {
  const createFeat = useCatalogueStore((s) => s.createFeat);
  const updateFeat = useCatalogueStore((s) => s.updateFeat);
  const saving = useCatalogueStore((s) => s.savingFeat);
  const saveError = useCatalogueStore((s) => s.featsError);
  const feats = useCatalogueStore((s) => s.feats);
  const spells = useCatalogueStore((s) => s.spells);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);

  const [form, setForm] = useState(emptyFeatForm);
  const [started, setStarted] = useState(false);
  const [win, setWin] = useState(null); // a WINDOWS key, or { option: i }
  const [nameError, setNameError] = useState(false);
  const [saveTo, setSaveTo] = useState("sheet"); // sheet mode: "sheet" | "catalogue"
  const [asNew, setAsNew] = useState(false);
  const [sheetSaving, setSheetSaving] = useState(false);
  const [sheetError, setSheetError] = useState(null);

  useEffect(() => {
    if (open && !spells?.length) loadSpells();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const src = editingFeat || copyFromFeat;
    setForm(src ? featToForm(src, { copy: !editingFeat }) : emptyFeatForm());
    setStarted(!!src);
    setWin(null);
    setNameError(false);
    setSaveTo("sheet");
    setAsNew(false);
    setSheetError(null);
  }, [open, editingFeat, copyFromFeat]);

  const index = useMemo(() => buildNameIndex(feats, spells), [feats, spells]);
  const catalogues = { feats, spells };

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const isEditing = !!editingFeat;
  const record = formToFeat(form, isEditing ? editingFeat : null);
  const prereqs = describePrerequisites(record.prerequisites, index);
  const options = form.options || [];
  const setOption = (i, v) => set("options", options.map((o, j) => (j === i ? v : o)));
  const addOption = () => {
    set("options", [...options, emptyFeatOption()]);
    setWin({ option: options.length });
  };

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
      if (isEditing) await updateFeat(editingFeat.id, record);
      else await createFeat(record);
      onClose();
    } catch {
      /* the error is shown in the footer */
    }
  };

  const title = sheet ? `Edit your ${editingFeat?.name || "feat"}` : `${isEditing ? "Edit" : copyFromFeat ? "Copy" : "New"} feat`;
  const subtitle = featSubtitle(record);
  const winInfo = typeof win === "string" ? WINDOWS[win] : null;
  const curOption = win && typeof win === "object" ? win.option : null;

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
            <div className={labelCls}>…or a copy of a feat from the book</div>
            <EntryPicker entries={feats || []} index={index} selected={[]} placeholder="search feats…"
                         onToggle={(id) => {
                           const ft = (feats || []).find((x) => x.id === id);
                           if (!ft) return;
                           setForm(featToForm(ft, { copy: true }));
                           setStarted(true);
                         }} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* header: the name, and the line under it */}
          <div className="border-b border-rule/40 pb-1">
            <input type="text" value={form.name} onChange={(e) => { set("name", e.target.value); setNameError(false); }} placeholder="Feat name"
                   aria-label="Name" autoFocus={!form.name}
                   className={`w-full bg-transparent text-xl font-bold tracking-wide text-ink outline-none placeholder:font-normal placeholder:italic placeholder:text-ink-faint ${nameError ? "border-b border-bad" : ""}`} />
            {nameError && <p className="text-xs italic text-bad">It needs a name.</p>}
            <button type="button" onClick={() => setWin("type")} className="text-left text-sm italic text-ink-faded hover:text-rubric" title="Category, repeatable">
              {subtitle || "category · repeatable"}
            </button>
          </div>

          {/* prerequisite */}
          <div>
            {prereqs.length > 0 ? (
              <StatLine label="Prerequisite" value={prereqs.join("; or ")} onClick={() => setWin("prereqs")} />
            ) : (
              <AddRow items={[{ label: "prerequisite", hint: "A level, an ability score, a class feature, another feat…", onClick: () => setWin("prereqs") }]} />
            )}
          </div>

          {/* the text */}
          <CardText value={form.text} onChange={(v) => set("text", v)}
                    placeholder={"You gain the following benefits. (**Name.** text starts a named part.)"} />

          {/* options */}
          <div>
            {options.length > 0 && <div className={sectionHead}>Options (the player takes one)</div>}
            <div className="space-y-1">
              {options.map((o, i) => (
                <div key={o.id || `new-${i}`} className="flex items-start gap-2">
                  <button type="button" onClick={() => setWin({ option: i })} className={`${lineBtn} min-w-0 flex-1 border-l border-rule/30 pl-2`} title="Click to change">
                    <span className="text-[15px] font-semibold text-ink group-hover:text-rubric">{o.name || "New option"}</span>
                    <span className="block text-xs italic text-ink-faded">{optionWords(o, index) || (o.text || "").slice(0, 120) || "nothing yet"}</span>
                  </button>
                  <button type="button" onClick={() => set("options", options.filter((_, j) => j !== i))} className="pt-1 text-[10px] text-ink-faint hover:text-bad"
                          title="Take this option off" aria-label={`Take off ${o.name || "this option"}`}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <AddRow items={[{ label: "option", hint: "For a feat taken in one of several versions (Magic Initiate: Cleric, Druid or Wizard)", onClick: addOption }]} />
          </div>

          {/* features */}
          <CardFeatures features={form.features || []} onChange={(v) => set("features", v)} text={form.text} index={index} />

          {/* what it gives */}
          <GivesBlock value={form.grants} onChange={(v) => set("grants", v)} parts={FEAT_PARTS} catalogues={catalogues} index={index} />

          {/* footer */}
          <div className="flex flex-wrap items-baseline gap-x-3 border-t border-rule/25 pt-1.5 text-xs italic text-ink-faded">
            <button type="button" onClick={() => setWin("more")} className="text-left hover:text-rubric" title="Edition, who can see it">
              {[form.edition === "classic" ? "Classic (2014)" : "One (2024)", form.visibility === "public" ? "public" : "private"].join(" · ")}
            </button>
          </div>
        </div>
      )}

      {winInfo && (
        <PartPopup title={winInfo.title} hint={winInfo.hint} onClose={() => setWin(null)}>
          {win === "type" && (
            <>
              <div>
                <div className={labelCls}>Category</div>
                <Segmented size="sm" options={CATEGORY_OPTIONS} value={form.category} onChange={(v) => set("category", v)} />
              </div>
              <label className="flex items-baseline gap-2 text-sm">
                <input type="checkbox" checked={form.repeatable} onChange={(e) => set("repeatable", e.target.checked)} className="accent-rubric" />
                Repeatable (it can be taken more than once)
              </label>
            </>
          )}
          {win === "prereqs" && <PrerequisitesEditor groups={form.prerequisites} onChange={(v) => set("prerequisites", v)} feats={feats} index={index} />}
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

      {curOption != null && options[curOption] && (
        <PartPopup title={options[curOption].name || "New option"} onClose={() => setWin(null)}
                   hint="One version of the feat: its own text and what it gives. The feat's own text and grants apply to every option.">
          <OptionCard value={options[curOption]} onChange={(v) => setOption(curOption, v)} catalogues={catalogues} index={index} />
        </PartPopup>
      )}
    </CreateModal>
  );
}
