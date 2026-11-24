import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { CreateModal, PartPopup, fieldCls, labelCls } from "../catalogueStyle";
import { ChipToggles, EDITION_OPTIONS, EntryPicker, PrerequisitesEditor, Segmented, VISIBILITY_OPTIONS } from "../catalogueParts";
import {
  buildNameIndex, collectUnique, describeConsumes, describePrerequisites, FEATURE_TYPES, formatFeatureType, labelFromId, numOrNull, toggleIn,
} from "../catalogueHelpers";
import { AddRow, CardFeatures, CardText, GivesBlock, StatLine } from "../cardParts";
import { emptyConsumes, emptyOptionalFeatureForm, formToOptionalFeature, optionalFeatureToForm, typesLabel } from "./optionalFeatureHelpers";

/* ═══════════════════════════════════════════════════════════════════
   OptionalFeatureCardForm — the optional feature form (2026-11-24):
   an invocation, metamagic option, maneuver, fighting style… made on its
   own card, drawn the way the catalogue shows it (OptionalFeaturePopup),
   like the item and feat cards (the pieces are ../cardParts).

     header         the name, typed on the card · the line under it
                    (type, whose list, repeatable) opens a window
     prerequisite   "Prerequisite: Warlock level 5, Pact of the Blade" → window
     cost           "Cost: 1 Sorcery Point" → window
     text           the description, typed on the card
     features       "Name. text" + small words → the feature window
     gives          traits, proficiencies, spells
     footer         edition · visibility

   It edits the same form shape as before (optionalFeatureHelpers), so the
   record saved is the one the pipeline makes. Catalogue only: on a sheet an
   optional feature is the character's own feature (FeatureRow edits it).
   ═══════════════════════════════════════════════════════════════════ */

// Classes a shared type (fighting styles) can be listed for.
const LIST_CLASSES = ["bard", "fighter", "paladin", "ranger"];
const COST_MODES = [
  { value: "amount", label: "a set amount" },
  { value: "range", label: "the player chooses how much" },
];
const PARTS = ["traits", "proficiencies", "spells"];

const WINDOWS = {
  type: { title: "Type", hint: "What kind of option it is (the sheet offers it where the class picks that kind), whose list a shared kind is on, and whether it can be taken more than once." },
  prereqs: { title: "Prerequisite", hint: "What a character needs to take it: a class level, a pact, another option, a spell… Any one group is enough; everything inside a group is needed. The sheet warns, it never blocks." },
  cost: { title: "Cost", hint: "What using it spends from a class pool (sorcery points, superiority dice, ki). The player spends it on the sheet." },
  more: { title: "Edition & visibility", hint: "Which rules it's for, and who can see it." },
};

const START_POINTS = [
  { id: "eldritch_invocation", label: "An eldritch invocation", hint: "Agonizing Blast, Devil's Sight" },
  { id: "metamagic", label: "A metamagic option", hint: "costs sorcery points: Quickened Spell" },
  { id: "maneuver", label: "A maneuver", hint: "spends a superiority die: Trip Attack" },
  { id: "fighting_style", label: "A fighting style", hint: "on some classes' lists: Archery, Defense" },
  { id: "blank", label: "An empty card", hint: "start from nothing" },
];
const START_COST = { metamagic: "sorcery_points", maneuver: "superiority_dice" };
const startForm = (id) => ({
  ...emptyOptionalFeatureForm(),
  featureTypes: id === "blank" ? [] : [id],
  consumes: START_COST[id] ? { ...emptyConsumes(), on: true, resource: START_COST[id] } : emptyConsumes(),
});

export default function OptionalFeatureCardForm({ open, onClose, editingFeature = null, copyFromFeature = null }) {
  const createOptionalFeature = useCatalogueStore((s) => s.createOptionalFeature);
  const updateOptionalFeature = useCatalogueStore((s) => s.updateOptionalFeature);
  const saving = useCatalogueStore((s) => s.savingOptionalFeature);
  const saveError = useCatalogueStore((s) => s.optionalFeaturesError);
  const optionalFeatures = useCatalogueStore((s) => s.optionalFeatures);
  const feats = useCatalogueStore((s) => s.feats);
  const spells = useCatalogueStore((s) => s.spells);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);

  const [form, setForm] = useState(emptyOptionalFeatureForm);
  const [started, setStarted] = useState(false);
  const [win, setWin] = useState(null);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (open && !spells?.length) loadSpells();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const src = editingFeature || copyFromFeature;
    setForm(src ? optionalFeatureToForm(src, { copy: !editingFeature }) : emptyOptionalFeatureForm());
    setStarted(!!src);
    setWin(null);
    setNameError(false);
  }, [open, editingFeature, copyFromFeature]);

  const index = useMemo(() => buildNameIndex(optionalFeatures, feats, spells), [optionalFeatures, feats, spells]);
  // The pools the catalogue already spends, offered while typing.
  const knownResources = useMemo(
    () => [...new Set(["sorcery_points", "superiority_dice", "ki", "focus_points", ...collectUnique(optionalFeatures, (f) => f.consumes?.resource)])],
    [optionalFeatures],
  );

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const c = form.consumes;
  const setCost = (p) => set("consumes", { ...c, ...p });
  const isEditing = !!editingFeature;
  const record = formToOptionalFeature(form, isEditing ? editingFeature : null);
  const prereqs = describePrerequisites(record.prerequisites, index);
  const cost = describeConsumes(record.consumes);
  const subtitle = [typesLabel(record), form.repeatable ? "Repeatable" : null].filter(Boolean).join(" · ");

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    try {
      if (isEditing) await updateOptionalFeature(editingFeature.id, record);
      else await createOptionalFeature(record);
      onClose();
    } catch {
      /* the error is shown in the footer */
    }
  };

  const title = `${isEditing ? "Edit" : copyFromFeature ? "Copy" : "New"} optional feature`;
  const winInfo = win ? WINDOWS[win] : null;
  const adds = [
    prereqs.length === 0 && { label: "prerequisite", hint: "A class level, a pact, another option, a spell…", onClick: () => setWin("prereqs") },
    !cost && { label: "cost", hint: "Spends sorcery points, superiority dice, ki… when used", onClick: () => { if (!c.on) setCost({ on: true }); setWin("cost"); } },
  ].filter(Boolean);

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
            <div className={labelCls}>…or a copy of one from the book</div>
            <EntryPicker entries={optionalFeatures || []} index={index} selected={[]} placeholder="search invocations, metamagic…"
                         onToggle={(id) => {
                           const of = (optionalFeatures || []).find((x) => x.id === id);
                           if (!of) return;
                           setForm(optionalFeatureToForm(of, { copy: true }));
                           setStarted(true);
                         }} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* header: the name, and the line under it */}
          <div className="border-b border-rule/40 pb-1">
            <input type="text" value={form.name} onChange={(e) => { set("name", e.target.value); setNameError(false); }} placeholder="Name (Agonizing Blast)"
                   aria-label="Name" autoFocus={!form.name}
                   className={`w-full bg-transparent text-xl font-bold tracking-wide text-ink outline-none placeholder:font-normal placeholder:italic placeholder:text-ink-faint ${nameError ? "border-b border-bad" : ""}`} />
            {nameError && <p className="text-xs italic text-bad">It needs a name.</p>}
            <button type="button" onClick={() => setWin("type")} className="text-left text-sm italic text-ink-faded hover:text-rubric" title="Type, whose list, repeatable">
              {subtitle || "type · repeatable"}
            </button>
          </div>

          {/* prerequisite and cost */}
          {(prereqs.length > 0 || cost) && (
            <div className="space-y-0.5">
              {prereqs.length > 0 && <StatLine label="Prerequisite" value={prereqs.join("; or ")} onClick={() => setWin("prereqs")} />}
              {cost && <StatLine label="Cost" value={cost} onClick={() => setWin("cost")} />}
            </div>
          )}
          {adds.length > 0 && <AddRow items={adds} />}

          {/* the text */}
          <CardText value={form.text} onChange={(v) => set("text", v)}
                    placeholder={"When you cast Eldritch Blast, add your Charisma modifier to the damage… (**Name.** text starts a named part.)"} />

          {/* features */}
          <CardFeatures features={form.features || []} onChange={(v) => set("features", v)} text={form.text} index={index} />

          {/* what it gives */}
          <GivesBlock value={form.grants} onChange={(v) => set("grants", v)} parts={PARTS} catalogues={{ feats, spells }} index={index} />

          {/* footer */}
          <div className="flex flex-wrap items-baseline gap-x-3 border-t border-rule/25 pt-1.5 text-xs italic text-ink-faded">
            <button type="button" onClick={() => setWin("more")} className="text-left hover:text-rubric" title="Edition, who can see it">
              {[form.edition === "classic" ? "Classic (2014)" : "One (2024)", form.visibility === "public" ? "public" : "private"].join(" · ")}
            </button>
          </div>
        </div>
      )}

      {winInfo && (
        <PartPopup title={winInfo.title} hint={winInfo.hint}
                   onClose={() => {
                     // a cost opened and left without a pool doesn't stay
                     if (win === "cost" && !c.resource.trim()) setCost({ on: false });
                     setWin(null);
                   }}>
          {win === "type" && (
            <>
              <div>
                <div className={labelCls}>Type</div>
                <ChipToggles options={[...new Set([...Object.keys(FEATURE_TYPES), ...form.featureTypes])]} selected={form.featureTypes} labelOf={formatFeatureType}
                             onToggle={(t) => set("featureTypes", toggleIn(form.featureTypes, t))} />
              </div>
              <div>
                <div className={labelCls}>On these classes' lists (for a shared type, like fighting styles)</div>
                <ChipToggles options={[...new Set([...LIST_CLASSES, ...form.classes])]} selected={form.classes} labelOf={labelFromId}
                             onToggle={(x) => set("classes", toggleIn(form.classes, x))} />
              </div>
              <label className="flex items-baseline gap-2 text-sm">
                <input type="checkbox" checked={form.repeatable} onChange={(e) => set("repeatable", e.target.checked)} className="accent-rubric" />
                Repeatable (it can be taken more than once)
              </label>
            </>
          )}
          {win === "prereqs" && (
            <PrerequisitesEditor groups={form.prerequisites} onChange={(v) => set("prerequisites", v)} feats={feats} index={index} showPacts />
          )}
          {win === "cost" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className={`${labelCls} !mb-0`}>Spends</span>
                <input type="text" list="optional-feature-resources" value={c.resource} onChange={(e) => setCost({ on: true, resource: e.target.value })}
                       placeholder="sorcery_points" aria-label="Pool it spends" className={`${fieldCls} !w-56`} />
                <datalist id="optional-feature-resources">
                  {knownResources.map((r) => <option key={r} value={r}>{labelFromId(r)}</option>)}
                </datalist>
              </div>
              <Segmented size="sm" options={COST_MODES} value={c.mode} onChange={(mode) => setCost({ mode })} />
              {c.mode === "amount" ? (
                <label className="flex items-baseline gap-2">
                  <span className="text-xs italic text-ink-faded">how many</span>
                  <input type="number" min={1} value={c.amount ?? ""} onChange={(e) => setCost({ amount: numOrNull(e.target.value) })}
                         aria-label="How many" className={`${fieldCls} !w-14`} />
                </label>
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-xs italic text-ink-faded">from</span>
                  <input type="number" min={0} value={c.min ?? ""} onChange={(e) => setCost({ min: numOrNull(e.target.value) })} aria-label="From" className={`${fieldCls} !w-14`} />
                  <span className="text-xs italic text-ink-faded">to</span>
                  <input type="number" min={0} value={c.max ?? ""} onChange={(e) => setCost({ max: numOrNull(e.target.value) })} aria-label="To" className={`${fieldCls} !w-14`} />
                </div>
              )}
              {cost && (
                <button type="button" onClick={() => { set("consumes", emptyConsumes()); setWin(null); }} className="text-xs italic text-ink-faded hover:text-bad">
                  ✕ no cost
                </button>
              )}
            </div>
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
