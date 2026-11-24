import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { CreateModal, PartPopup, labelCls } from "../catalogueStyle";
import { BundleOptionsEditor, EDITION_OPTIONS, EntryPicker, Segmented, VISIBILITY_OPTIONS } from "../catalogueParts";
import { buildNameIndex, describeChoice } from "../catalogueHelpers";
import { formToBundle } from "../catalogueForms";
import { CardFeatures, CardText, GivesBlock } from "../cardParts";
import { backgroundToForm, emptyBackgroundForm, formToBackground } from "./backgroundHelpers";

/* ═══════════════════════════════════════════════════════════════════
   BackgroundCardForm — the background form (2026-11-24): a background is
   made on its own card, drawn the way the catalogue shows it
   (BackgroundPopup), like the other cards (the pieces are ../cardParts).

     header       the name, typed on the card
     text         the description, typed on the card
     features     "Name. text" + small words → the feature window
     gives        ability scores · a feat · proficiencies · equipment
                  (what it always gives, and the "choose one" A / B pick:
                  "Starting Equipment: A: … · B: 50 GP") · spells · traits
     footer       edition · visibility

   It edits the same form shape as before (backgroundHelpers), so the
   record saved is the one the pipeline makes. Catalogue only (on a sheet
   the background is swapped on the Biography tab).
   ═══════════════════════════════════════════════════════════════════ */

const PARTS = ["ability", "feats", "proficiencies", "equipment", "spells", "traits"];

const START_POINTS = [
  { id: "one", label: "A 2024 background", hint: "three ability scores, an origin feat, two skills, a tool, equipment or 50 GP" },
  { id: "classic", label: "A 2014 background", hint: "two skills, tools or languages, equipment and a feature" },
  { id: "blank", label: "An empty card", hint: "start from nothing" },
];
const startForm = (id) => {
  const f = emptyBackgroundForm();
  if (id === "classic") return { ...f, edition: "classic", grants: { ...f.grants, ability: { from: [], sets: [] } } };
  if (id === "blank") return { ...f, grants: { ...f.grants, ability: { from: [], sets: [] } } };
  return f;
};

// "A: Calligrapher's Supplies, Book, 8 GP · B: 50 GP": the equipment pick in a line.
function bundleLine(form, index) {
  const bundle = formToBundle(form.equipment, { id: form.equipmentId, label: form.equipmentLabel });
  const d = bundle && describeChoice(bundle, index);
  if (!d) return null;
  const value = (d.options || [])
    // the book's option names repeat their contents: A, B… instead
    .map((o, i) => `${String.fromCharCode(65 + i)}: ${[...o.rows.map((r) => r.value), ...o.choices.map((c) => c.value)].join(", ") || "nothing"}`)
    .join(" · ");
  return { label: d.label, value: value || "choose one", part: "equipment" };
}

export default function BackgroundCardForm({ open, onClose, editingBackground = null, copyFromBackground = null }) {
  const createBackground = useCatalogueStore((s) => s.createBackground);
  const updateBackground = useCatalogueStore((s) => s.updateBackground);
  const saving = useCatalogueStore((s) => s.savingBackground);
  const saveError = useCatalogueStore((s) => s.backgroundsError);
  const backgrounds = useCatalogueStore((s) => s.backgrounds);
  const feats = useCatalogueStore((s) => s.feats);
  const loadFeats = useCatalogueStore((s) => s.loadFeats);
  const items = useCatalogueStore((s) => s.items);
  const loadItems = useCatalogueStore((s) => s.loadItems);
  const spells = useCatalogueStore((s) => s.spells);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);

  const [form, setForm] = useState(emptyBackgroundForm);
  const [started, setStarted] = useState(false);
  const [win, setWin] = useState(null);
  const [nameError, setNameError] = useState(false);

  // The pickers need the other catalogues.
  useEffect(() => {
    if (!open) return;
    if (!feats?.length) loadFeats?.();
    if (!items?.length) loadItems?.();
    if (!spells?.length) loadSpells?.();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const src = editingBackground || copyFromBackground;
    setForm(src ? backgroundToForm(src, { copy: !editingBackground }) : emptyBackgroundForm());
    setStarted(!!src);
    setWin(null);
    setNameError(false);
  }, [open, editingBackground, copyFromBackground]);

  const index = useMemo(() => buildNameIndex(feats, items, spells), [feats, items, spells]);
  const pickIndex = useMemo(() => buildNameIndex(backgrounds), [backgrounds]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const isEditing = !!editingBackground;
  const bundle = bundleLine(form, index);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    const record = formToBackground(form, isEditing ? editingBackground : null);
    try {
      if (isEditing) await updateBackground(editingBackground.id, record);
      else await createBackground(record);
      onClose();
    } catch {
      /* the error is shown in the footer */
    }
  };

  const title = `${isEditing ? "Edit" : copyFromBackground ? "Copy" : "New"} background`;
  // The A / B pick, in the equipment window under what it always gives.
  const equipmentPick = (
    <BundleOptionsEditor options={form.equipment} onChange={(v) => set("equipment", v)} entries={items} index={index}
                         emptyHint="No pick. (2024 backgrounds: A = items and gold, B = 50 GP.)" />
  );

  return (
    <CreateModal open={open} title={title} onClose={onClose} onSave={handleSave} saving={saving}
                 saveLabel={isEditing ? "Save Changes" : "Save"} saveDisabled={!started} error={saveError} width="max-w-2xl">
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
            <div className={labelCls}>…or a copy of a background from the book</div>
            <EntryPicker entries={backgrounds || []} index={pickIndex} selected={[]} placeholder="search backgrounds…"
                         onToggle={(id) => {
                           const b = (backgrounds || []).find((x) => x.id === id);
                           if (!b) return;
                           setForm(backgroundToForm(b, { copy: true }));
                           setStarted(true);
                         }} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* header: the name */}
          <div className="border-b border-rule/40 pb-1">
            <input type="text" value={form.name} onChange={(e) => { set("name", e.target.value); setNameError(false); }} placeholder="Background name"
                   aria-label="Name" autoFocus={!form.name}
                   className={`w-full bg-transparent text-xl font-bold tracking-wide text-ink outline-none placeholder:font-normal placeholder:italic placeholder:text-ink-faint ${nameError ? "border-b border-bad" : ""}`} />
            {nameError && <p className="text-xs italic text-bad">It needs a name.</p>}
          </div>

          {/* the text */}
          <CardText value={form.text} onChange={(v) => set("text", v)}
                    placeholder={"You devoted yourself to service in a temple… (**Name.** text starts a named part.)"} />

          {/* features */}
          <CardFeatures features={form.features || []} onChange={(v) => set("features", v)} text={form.text} index={index} />

          {/* what it gives, with the equipment pick */}
          <GivesBlock value={form.grants} onChange={(v) => set("grants", v)} parts={PARTS} catalogues={{ feats, items, spells }} index={index}
                      extraRows={bundle ? [bundle] : []} partExtra={{ equipment: equipmentPick }} />

          {/* footer */}
          <div className="flex flex-wrap items-baseline gap-x-3 border-t border-rule/25 pt-1.5 text-xs italic text-ink-faded">
            <button type="button" onClick={() => setWin("more")} className="text-left hover:text-rubric" title="Edition, who can see it">
              {[form.edition === "classic" ? "Classic (2014)" : "One (2024)", form.visibility === "public" ? "public" : "private"].join(" · ")}
            </button>
          </div>
        </div>
      )}

      {win === "more" && (
        <PartPopup title="Edition & visibility" hint="Which rules it's for, and who can see it." onClose={() => setWin(null)}>
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
        </PartPopup>
      )}
    </CreateModal>
  );
}
