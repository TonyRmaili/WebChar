import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { CreateModal, PartPopup, labelCls } from "../catalogueStyle";
import { ChipToggles, EDITION_OPTIONS, EntryPicker, Segmented, VISIBILITY_OPTIONS } from "../catalogueParts";
import { CREATURE_TYPES, SIZES, buildNameIndex, describeChoice, describeGrants, formatSize, labelFromId, namedBlocks, titleCase, toggleIn } from "../catalogueHelpers";
import { formToGrants } from "../catalogueForms";
import { AddRow, CardFeatures, CardText, GivesBlock, lineBtn, plural, sectionHead } from "../cardParts";
import { REPLACEABLE, emptyRaceForm, emptySubrace, formToRace, raceSubtitle, raceToForm } from "./raceHelpers";

/* ═══════════════════════════════════════════════════════════════════
   RaceCardForm — the race form (2026-11-24): a race is made on its own
   card, drawn the way the catalogue shows it (RacePopup), like the item,
   feat, optional feature and spell cards (the pieces are ../cardParts).

     header       the name, typed on the card · "Small or Medium
                  Humanoid" opens size and creature type
     text         the description, typed on the card
     features     "Name. text" + small words → the feature window
     gives        speed, senses, defenses · ability scores · a feat ·
                  proficiencies · spells
     subraces     "Choose one": each line opens its own small card (name,
                  size, what of the race it replaces, text, features, what
                  it gives); "+ subrace"
     footer       edition · visibility

   It edits the same form shape as before (raceHelpers.raceToForm /
   formToRace), so the record saved is the one the pipeline makes.
   Catalogue only (on a sheet the race is swapped on the Biography tab).
   ═══════════════════════════════════════════════════════════════════ */

const PARTS = ["traits", "ability", "feats", "proficiencies", "spells"];

const WINDOWS = {
  type: { title: "Size & creature type", hint: "More than one size: the player picks (Small or Medium). Most races are Humanoid." },
  more: { title: "Edition & visibility", hint: "Which rules it's for, and who can see it." },
};

const START_POINTS = [
  { id: "medium", label: "A Medium race", hint: "walks 30 feet: Human, Dwarf, Orc" },
  { id: "small", label: "A Small race", hint: "Halfling, Gnome" },
  { id: "lineages", label: "A race with lineages", hint: "the player picks one: Elf, Tiefling, Dragonborn" },
  { id: "blank", label: "An empty card", hint: "start from nothing" },
];
const startForm = (id) => {
  const f = emptyRaceForm();
  if (id === "small") return { ...f, size: ["small"] };
  if (id === "lineages") return { ...f, subraces: [emptySubrace()] };
  if (id === "blank") return { ...f, size: [], creatureTypes: [], grants: { ...f.grants, speed: {} } };
  return f;
};

// "Speed: walk 35 ft. · Skills: choose 1 …": what a subrace gives, in a line.
function givesWords(grantsForm, index) {
  const { grants, choices } = formToGrants(grantsForm);
  return [
    ...describeGrants(grants, index).map((r) => `${r.label}: ${r.value}`),
    ...(choices || []).map((c) => describeChoice(c, index)).filter(Boolean).map((d) => `${d.label}: ${d.value}`),
  ];
}

// "Medium · replaces the race's Ability · 2 features": a subrace's small words.
function subraceWords(sr, index) {
  return [
    sr.size?.length ? formatSize(sr.size) : "",
    sr.replaces?.length || sr.replacesText?.length ? `replaces the race's ${[...sr.replaces.map(labelFromId), ...sr.replacesText].join(", ")}` : "",
    ...givesWords(sr.grants, index),
    sr.features?.length ? plural(sr.features.length, "feature") : "",
  ].filter(Boolean).join(" · ");
}

/* One subrace, as a small card in its window. The line under its name
   (its size, what it replaces) opens a window over it. */
function SubraceCard({ value: sr, onChange, raceBlocks, catalogues, index }) {
  const [win, setWin] = useState(false);
  const set = (p) => onChange({ ...sr, ...p });
  const line = [sr.size?.length ? formatSize(sr.size) : "", sr.replaces.length || sr.replacesText.length ? `replaces the race's ${[...sr.replaces.map(labelFromId), ...sr.replacesText].join(", ")}` : ""]
    .filter(Boolean).join(" · ");
  return (
    <div className="space-y-3">
      <div className="border-b border-rule/40 pb-1">
        <input type="text" value={sr.name} onChange={(e) => set({ name: e.target.value })} placeholder="Subrace name (Hill Dwarf, Drow Lineage)" aria-label="Subrace name"
               autoFocus={!sr.name} className="w-full bg-transparent text-lg font-bold tracking-wide text-ink outline-none placeholder:font-normal placeholder:italic placeholder:text-ink-faint" />
        <button type="button" onClick={() => setWin(true)} className="text-left text-sm italic text-ink-faded hover:text-rubric" title="Its own size, what of the race it replaces">
          {line || "the race's size · adds to the race"}
        </button>
      </div>
      <CardText value={sr.text || ""} onChange={(v) => set({ text: v })} placeholder="What this subrace adds… (**Name.** text starts a named part.)" />
      <CardFeatures features={sr.features || []} onChange={(v) => set({ features: v })} text={sr.text || ""} index={index} />
      <GivesBlock value={sr.grants} onChange={(v) => set({ grants: v })} parts={PARTS} catalogues={catalogues} index={index} />
      {win && (
        <PartPopup title="Size & what it replaces" onClose={() => setWin(false)}
                   hint="A subrace adds to the race. Mark what of the race it replaces instead: the subrace's ability bonuses, speed… are used, not the race's.">
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
        </PartPopup>
      )}
    </div>
  );
}

export default function RaceCardForm({ open, onClose, editingRace = null, copyFromRace = null }) {
  const createRace = useCatalogueStore((s) => s.createRace);
  const updateRace = useCatalogueStore((s) => s.updateRace);
  const saving = useCatalogueStore((s) => s.savingRace);
  const saveError = useCatalogueStore((s) => s.racesError);
  const races = useCatalogueStore((s) => s.races);
  const feats = useCatalogueStore((s) => s.feats);
  const loadFeats = useCatalogueStore((s) => s.loadFeats);
  const spells = useCatalogueStore((s) => s.spells);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);

  const [form, setForm] = useState(emptyRaceForm);
  const [started, setStarted] = useState(false);
  const [win, setWin] = useState(null); // a WINDOWS key, or { sub: i }
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!feats?.length) loadFeats?.();
    if (!spells?.length) loadSpells?.();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const src = editingRace || copyFromRace;
    setForm(src ? raceToForm(src, { copy: !editingRace }) : emptyRaceForm());
    setStarted(!!src);
    setWin(null);
    setNameError(false);
  }, [open, editingRace, copyFromRace]);

  const index = useMemo(() => buildNameIndex(feats, spells), [feats, spells]);
  const pickIndex = useMemo(() => buildNameIndex(races), [races]);
  const blocks = useMemo(() => namedBlocks(form.text), [form.text]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const isEditing = !!editingRace;
  const record = formToRace(form, isEditing ? editingRace : null);
  const catalogues = { feats, spells };
  const subs = form.subraces || [];
  const setSub = (i, v) => set("subraces", subs.map((x, j) => (j === i ? v : x)));
  const addSub = () => {
    set("subraces", [...subs, emptySubrace()]);
    setWin({ sub: subs.length });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    try {
      if (isEditing) await updateRace(editingRace.id, record);
      else await createRace(record);
      onClose();
    } catch {
      /* the error is shown in the footer */
    }
  };

  const title = `${isEditing ? "Edit" : copyFromRace ? "Copy" : "New"} race`;
  const winInfo = typeof win === "string" ? WINDOWS[win] : null;
  const curSub = win && typeof win === "object" ? win.sub : null;
  // A race without size or type shows the placeholder (formToRace fills Medium Humanoid when saving).
  const subtitle = form.size.length || form.creatureTypes.length ? raceSubtitle({ size: form.size, creature_types: form.creatureTypes }) : "";

  return (
    <CreateModal open={open} title={title} onClose={onClose} onSave={handleSave} saving={saving}
                 saveLabel={isEditing ? "Save Changes" : "Save"} saveDisabled={!started} error={saveError} width="max-w-2xl">
      {!started ? (
        <div className="space-y-4">
          <p className="text-sm italic text-ink-faded">Start from…</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {START_POINTS.map((p) => (
              <button key={p.id} type="button" onClick={() => { setForm(startForm(p.id)); setStarted(true); if (p.id === "lineages") setWin({ sub: 0 }); }}
                      className="rounded-sm border border-rule/40 px-3 py-2 text-left transition hover:border-rubric/60 hover:bg-rubric/5">
                <div className="text-[15px] text-ink">{p.label}</div>
                <div className="text-xs italic text-ink-faded">{p.hint}</div>
              </button>
            ))}
          </div>
          <div>
            <div className={labelCls}>…or a copy of a race from the book</div>
            <EntryPicker entries={races || []} index={pickIndex} selected={[]} placeholder="search races…"
                         onToggle={(id) => {
                           const r = (races || []).find((x) => x.id === id);
                           if (!r) return;
                           setForm(raceToForm(r, { copy: true }));
                           setStarted(true);
                         }} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* header: the name, and the line under it */}
          <div className="border-b border-rule/40 pb-1">
            <input type="text" value={form.name} onChange={(e) => { set("name", e.target.value); setNameError(false); }} placeholder="Race name"
                   aria-label="Name" autoFocus={!form.name}
                   className={`w-full bg-transparent text-xl font-bold tracking-wide text-ink outline-none placeholder:font-normal placeholder:italic placeholder:text-ink-faint ${nameError ? "border-b border-bad" : ""}`} />
            {nameError && <p className="text-xs italic text-bad">It needs a name.</p>}
            <button type="button" onClick={() => setWin("type")} className="text-left text-sm italic text-ink-faded hover:text-rubric" title="Size, creature type">
              {subtitle || "size · creature type"}
            </button>
          </div>

          {/* the text */}
          <CardText value={form.text} onChange={(v) => set("text", v)}
                    placeholder={"**Darkvision.** You have Darkvision with a range of 60 feet.\n\n**Dwarven Resilience.** You have Resistance to Poison damage…"} />

          {/* features */}
          <CardFeatures features={form.features || []} onChange={(v) => set("features", v)} text={form.text} index={index} />

          {/* what it gives */}
          <GivesBlock value={form.grants} onChange={(v) => set("grants", v)} parts={PARTS} catalogues={catalogues} index={index} />

          {/* subraces */}
          <div>
            {subs.length > 0 && <div className={sectionHead}>Choose one · {subs.length}</div>}
            <div className="space-y-1">
              {subs.map((sr, i) => (
                <div key={sr.id || `new-${i}`} className="flex items-start gap-2">
                  <button type="button" onClick={() => setWin({ sub: i })} className={`${lineBtn} min-w-0 flex-1 border-l border-rule/30 pl-2`} title="Click to change">
                    <span className="text-[15px] font-semibold text-ink group-hover:text-rubric">{sr.name || "New subrace"}</span>
                    <span className="block text-xs italic text-ink-faded">{subraceWords(sr, index) || (sr.text || "").slice(0, 120) || "nothing yet"}</span>
                  </button>
                  <button type="button" onClick={() => set("subraces", subs.filter((_, j) => j !== i))} className="pt-1 text-[10px] text-ink-faint hover:text-bad"
                          title="Take this subrace off" aria-label={`Take off ${sr.name || "this subrace"}`}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <AddRow items={[{ label: "subrace", hint: "Lineages, legacies, ancestries: with subraces the player picks one", onClick: addSub }]} />
          </div>

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
                <div className={labelCls}>Size (more than one: the player picks)</div>
                <ChipToggles options={SIZES} selected={form.size} labelOf={titleCase} onToggle={(v) => set("size", toggleIn(form.size, v))} />
              </div>
              <div>
                <div className={labelCls}>Creature type</div>
                <ChipToggles options={CREATURE_TYPES} selected={form.creatureTypes} labelOf={titleCase}
                             onToggle={(v) => set("creatureTypes", toggleIn(form.creatureTypes, v))} />
              </div>
            </>
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

      {curSub != null && subs[curSub] && (
        <PartPopup title={subs[curSub].name || "New subrace"} onClose={() => setWin(null)}
                   hint="One version of the race the player picks: what it adds (or replaces). The race's own text and grants apply to every subrace.">
          <SubraceCard value={subs[curSub]} onChange={(v) => setSub(curSub, v)} raceBlocks={blocks} catalogues={catalogues} index={index} />
        </PartPopup>
      )}
    </CreateModal>
  );
}
