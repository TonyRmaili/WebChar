import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import SheetSaveChoice from "../SheetSaveChoice";
import { CreateModal, PartPopup, fieldCls, labelCls } from "../catalogueStyle";
import { EDITION_OPTIONS, EntryPicker, Segmented, VISIBILITY_OPTIONS } from "../catalogueParts";
import { ABILITIES, ABILITY_SHORT, buildNameIndex, collectUnique, describeFeature, numOrNull, plural, titleCase } from "../catalogueHelpers";
import { AddRow, CardText, StatLine, lineBtn } from "../cardParts";
import {
  CATEGORY_OPTIONS, CR_OPTIONS, SECTIONS, SECTION_TITLES, abilityMod, crTargets, emptyFeature, emptyMonsterForm, emptySpellBlock, featureUsesWords,
  formForCR, formToMonster, formatAC, formatHP, formatInitiative, formatSpeed, monsterSubtitle, monsterToForm, signed, spellGroupLabel, statRows,
} from "./monsterHelpers";
import {
  AcFields, ChallengeFields, DefensesFields, GearFields, HpFields, InitiativeFields, LabelsFields, LanguagesFields, LegendaryUsesFields,
  MonsterFeatureFields, SavesFields, SensesFields, SkillsFields, SpeedFields, SpellBlockFields, TypeFields,
} from "./monsterFormParts";

/* ═══════════════════════════════════════════════════════════════════
   MonsterCardForm — the monster form (2026-11-24): the statblock drawn
   the way the catalogue shows it (MonsterPopup), every part a click away,
   like the other cards (../cardParts). Nothing is asked up front.

     header      the name, typed on the card · "Large Dragon, Chaotic
                 Evil" → size, type, tags, swarm, alignment
     vitals      AC · HP · Speed · Initiative → their windows
     abilities   the scores typed in the table; the save row → saves
     stat lines  Skills · Resistances… · Senses · Languages · CR · Gear
                 → their windows ("+ …" for the missing ones); under the
                 CR, what a monster of that CR usually has (the DMG table)
     sections    Traits, Actions, Bonus Actions, Reactions, Legendary…:
                 each trait or action and spellcasting block is a line
                 → its window; "+ trait  + action …"
     variants    each a line → its window: name, text, and abilities that
                 are off until switched on in the tracker. A book variant
                 that is a whole other statblock (a version) links to it.
     footer      edition · visibility · labels (NPC, named, habitat)

   It edits the same form shape as before (monsterHelpers.monsterToForm /
   formToMonster); variants are the form's `rest.variants`.

   `sheet` (optional): it edits a character's minion (Minions tab):
   { onSubmit(record, { catalogue, asNew, nickname }), homebrew, nickname }.
   "this sheet only" or "my catalogue too" (SheetSaveChoice; private or
   public is the card's visibility), and the nickname the group is shown by.
   ═══════════════════════════════════════════════════════════════════ */

const WINDOWS = {
  type: { title: "Size, type & alignment", hint: "Several sizes or types: the statblock says “or”. Tags go in brackets (Dragon (Chromatic))." },
  ac: { title: "Armor Class", hint: "More than one: “10 in humanoid form, 11 (natural armor) in bear form”." },
  hp: { title: "Hit Points", hint: "The average, and the dice it comes from." },
  speed: { title: "Speed", hint: "Feet per round for each way it moves." },
  initiative: { title: "Initiative", hint: "Usually its Dexterity modifier; 2024 statblocks may add its PB." },
  saves: { title: "Saving throws", hint: "The bonus on each saving throw." },
  skills: { title: "Skills", hint: "The skills it's good at, with their whole bonus." },
  defenses: { title: "Resistances & immunities", hint: "Damage it resists, ignores or takes double from, and conditions it can't have." },
  senses: { title: "Senses", hint: "Special senses with their range, and its passive Perception." },
  languages: { title: "Languages", hint: "One per line. Telepathy goes here too." },
  challenge: { title: "Challenge", hint: "Its CR (XP and PB follow it), or a level for sidekicks and NPCs built like characters." },
  legendary: { title: "Legendary actions", hint: "How many legendary actions it can take each round." },
  gear: { title: "Gear", hint: "Items it carries, from the item catalogue." },
  labels: { title: "Edition, visibility & labels", hint: "Which rules it's for, who can see it, and the labels the Monsters page filters by." },
};
// A stat line's label → the window it opens.
const ROW_WINDOW = { Skills: "skills", Vulnerabilities: "defenses", Resistances: "defenses", Immunities: "defenses", Senses: "senses", Languages: "languages", CR: "challenge", Level: "challenge", Gear: "gear" };

const ADD_SECTIONS = [
  ["traits", "trait"], ["actions", "action"], ["bonus_actions", "bonus action"], ["reactions", "reaction"],
  ["legendary_actions", "legendary action"], ["lair_actions", "lair action"],
];

const newVariantId = (variants) => {
  let n = variants.length + 1;
  while (variants.some((v) => v.id === `variant-${n}`)) n += 1;
  return `variant-${n}`;
};

// "**Bite (Recharge 5–6).** text…" as a card line, with its numbers in small words.
function FeatureLine({ f, onOpen, onRemove, onMove, optionOf }) {
  const uses = featureUsesWords(f);
  const numbers = describeFeature({ ...f, category: "traits", uses: null }).join(" · ");
  return (
    <div className={`group/line flex items-start gap-2 ${f.parent ? "ml-5" : ""}`}>
      <button type="button" onClick={onOpen} className={`${lineBtn} min-w-0 flex-1`} title="Click to change">
        <span className="text-sm leading-snug">
          <span className="font-semibold italic text-ink group-hover:text-rubric">{f.name || "Unnamed"}{uses ? ` ${uses}` : ""}.</span>{" "}
          <span className="text-ink">{(f.text || "").slice(0, 200) || <span className="italic text-ink-faint">no text yet</span>}</span>
        </span>
        {(numbers || optionOf) && (
          <span className="block text-xs italic text-ink-faded">{[optionOf ? `option of ${optionOf}` : "", numbers].filter(Boolean).join(" · ")}</span>
        )}
      </button>
      {onMove && (
        <span className="flex gap-1 pt-1 opacity-0 transition group-hover/line:opacity-100">
          <button type="button" onClick={() => onMove(-1)} className="text-[10px] text-ink-faint hover:text-rubric" aria-label="Move up">▲</button>
          <button type="button" onClick={() => onMove(1)} className="text-[10px] text-ink-faint hover:text-rubric" aria-label="Move down">▼</button>
        </span>
      )}
      <button type="button" onClick={onRemove} className="pt-1 text-[10px] text-ink-faint hover:text-bad" title="Take this off" aria-label={`Take off ${f.name || "this"}`}>
        ✕
      </button>
    </div>
  );
}

/* One variant in its window: its name, its text, and its abilities (off
   until switched on in the tracker). A book version links to its statblock. */
function VariantCard({ variant: v, onChange, features, setFeatures, version, onOpenVersion }) {
  const [open, setOpen] = useState(null); // index into `features`
  const mine = features.map((f, i) => ({ f, i })).filter(({ f }) => f.variant === v.id);
  const patchFeature = (i, key, val) =>
    setFeatures(features.map((f, j) => {
      if (j !== i) return f;
      const next = { ...f, [key]: val };
      if (val === undefined) delete next[key];
      return next;
    }));
  const add = () => {
    setFeatures([...features, { ...emptyFeature("traits"), variant: v.id }]);
    setOpen(features.length);
  };
  const cur = open != null ? features[open] : null;
  return (
    <div className="space-y-3">
      <input type="text" value={v.name || ""} onChange={(e) => onChange({ ...v, name: e.target.value })} placeholder="Variant name (Coven Spellcasting)"
             aria-label="Variant name" autoFocus={!v.name}
             className="w-full border-b border-rule/40 bg-transparent pb-1 text-lg font-bold tracking-wide text-ink outline-none placeholder:font-normal placeholder:italic placeholder:text-ink-faint" />
      <CardText value={v.text || ""} onChange={(t) => onChange({ ...v, text: t })} placeholder="What changes in this variant, or the story behind it…" />
      {version && (
        <button type="button" onClick={onOpenVersion} className="text-xs italic text-ink-faded underline decoration-dotted underline-offset-2 hover:text-rubric">
          Its own statblock: {version.name}
        </button>
      )}
      <div>
        {mine.length > 0 && <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-faded">Abilities it adds (off until switched on)</div>}
        <div className="space-y-1">
          {mine.map(({ f, i }) => (
            <FeatureLine key={f.id || `new-${i}`} f={f} onOpen={() => setOpen(i)} onRemove={() => setFeatures(features.filter((_, j) => j !== i))} />
          ))}
        </div>
        <AddRow items={[{ label: "ability", hint: "A trait or action the variant adds; the tracker switches it on", onClick: add }]} />
      </div>
      {cur && (
        <PartPopup title={cur.name || "New ability"} onClose={() => setOpen(null)} hint="An ability of this variant: off until it's switched on in the initiative tracker.">
          <MonsterFeatureFields f={cur} onPatch={(key, val) => patchFeature(open, key, val)} />
        </PartPopup>
      )}
    </div>
  );
}

export default function MonsterCardForm({ open, onClose, editingMonster = null, copyFromMonster = null, sheet = null }) {
  const createMonster = useCatalogueStore((s) => s.createMonster);
  const updateMonster = useCatalogueStore((s) => s.updateMonster);
  const saving = useCatalogueStore((s) => s.savingMonster);
  const saveError = useCatalogueStore((s) => s.monstersError);
  const monsters = useCatalogueStore((s) => s.monsters);
  const spells = useCatalogueStore((s) => s.spells);
  const items = useCatalogueStore((s) => s.items);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);
  const loadItems = useCatalogueStore((s) => s.loadItems);
  const openPopup = usePopupStore((s) => s.open);

  const [form, setForm] = useState(emptyMonsterForm);
  const [started, setStarted] = useState(false);
  const [startCR, setStartCR] = useState("1");
  const [win, setWin] = useState(null); // a WINDOWS key, { feature: i }, { block: i } or { variant: i }
  const [nameError, setNameError] = useState(false);
  const [saveTo, setSaveTo] = useState("sheet"); // sheet mode: "sheet" | "catalogue"
  const [asNew, setAsNew] = useState(false);
  const [nickname, setNickname] = useState("");
  const [sheetSaving, setSheetSaving] = useState(false);
  const [sheetError, setSheetError] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (!spells?.length) loadSpells?.();
    if (!items?.length) loadItems?.();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const src = editingMonster || copyFromMonster;
    setForm(src ? monsterToForm(src, { copy: !editingMonster }) : emptyMonsterForm());
    setStarted(!!src);
    setWin(null);
    setNameError(false);
    setSaveTo("sheet");
    setAsNew(false);
    setNickname(sheet?.nickname || "");
    setSheetError(null);
    // Only when it opens or another monster is given: a caller may pass a new object each render.
  }, [open, editingMonster?.id ?? editingMonster?.name, copyFromMonster?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const index = useMemo(() => buildNameIndex(spells, items), [spells, items]);
  const pickIndex = useMemo(() => buildNameIndex(monsters), [monsters]);
  const byId = useMemo(() => Object.fromEntries((monsters || []).map((m) => [m.id, m])), [monsters]);
  const habitats = useMemo(() => collectUnique(monsters, (m) => m.filters?.environment), [monsters]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const isEditing = !!editingMonster;
  const record = formToMonster(form, isEditing ? editingMonster : null);
  const features = form.features || [];
  const setFeatures = (v) => set("features", v);
  const blocks = form.spellcasting || [];
  const variants = form.rest?.variants || [];
  const setVariants = (v) => set("rest", { ...form.rest, variants: v.length ? v : undefined });
  const nameOf = Object.fromEntries(features.filter((f) => f.id).map((f) => [f.id, f.name]));

  const patchFeature = (i, key, val) =>
    setFeatures(features.map((f, j) => {
      if (j !== i) return f;
      const next = { ...f, [key]: val };
      if (val === undefined) delete next[key];
      return next;
    }));
  const addFeature = (category) => {
    setFeatures([...features, emptyFeature(category)]);
    setWin({ feature: features.length });
  };
  // Up / down within its own section.
  const moveFeature = (i, dir) => {
    const cat = features[i].category || "traits";
    let j = i + dir;
    while (j >= 0 && j < features.length && ((features[j].category || "traits") !== cat || features[j].variant)) j += dir;
    if (j < 0 || j >= features.length) return;
    const next = [...features];
    [next[i], next[j]] = [next[j], next[i]];
    setFeatures(next);
  };
  const addBlock = () => {
    set("spellcasting", [...blocks, emptySpellBlock()]);
    setWin({ block: blocks.length });
  };
  const addVariant = () => {
    setVariants([...variants, { id: newVariantId(variants), name: "", text: "" }]);
    setWin({ variant: variants.length });
  };
  const removeVariant = (i) => {
    const id = variants[i].id;
    setForm((f) => ({
      ...f,
      features: (f.features || []).filter((x) => x.variant !== id),
      rest: { ...f.rest, variants: variants.filter((_, j) => j !== i).length ? variants.filter((_, j) => j !== i) : undefined },
    }));
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
        await sheet.onSubmit(record, { catalogue: saveTo === "catalogue", asNew, nickname });
        onClose();
      } catch (e) {
        setSheetError(e?.message || "Couldn't save");
      } finally {
        setSheetSaving(false);
      }
      return;
    }
    try {
      if (isEditing) await updateMonster(editingMonster.id, record);
      else await createMonster(record);
      onClose();
    } catch {
      /* the error is shown in the footer */
    }
  };

  const title = sheet ? `Edit your ${sheet.nickname || editingMonster?.name || "minion"}` : `${isEditing ? "Edit" : copyFromMonster ? "Copy" : "New"} monster`;
  const winInfo = typeof win === "string" ? WINDOWS[win] : null;
  const curFeature = win?.feature != null ? features[win.feature] : null;
  const curBlock = win?.block != null ? blocks[win.block] : null;
  const curVariant = win?.variant != null ? variants[win.variant] : null;

  // The statblock's lines, worked out from the record as it would be saved.
  const dexInit = abilityMod(form.abilities.dex);
  const vitals = [
    ["AC", formatAC(record.ac), "ac"],
    ["HP", formatHP(record.hp), "hp"],
    ["Speed", formatSpeed(record.speed), "speed"],
    ["Initiative", formatInitiative(record.initiative, record) || (dexInit != null ? signed(dexInit) : ""), "initiative"],
  ];
  const rows = statRows(record, index);
  const has = new Set(rows.map((r) => r.label));
  const missingRows = [
    !has.has("Skills") && { label: "skills", onClick: () => setWin("skills") },
    !has.has("Resistances") && !has.has("Immunities") && !has.has("Vulnerabilities") && { label: "resistances & immunities", onClick: () => setWin("defenses") },
    !has.has("Senses") && { label: "senses", onClick: () => setWin("senses") },
    !has.has("Gear") && { label: "gear", onClick: () => setWin("gear") },
  ].filter(Boolean);
  const targets = form.challenge === "cr" ? crTargets(form.cr) : null;
  const labelWords = [
    form.flags.npc ? "NPC" : "", form.flags.named ? "named" : "", form.flags.familiar ? "familiar" : "",
    form.environment.length ? form.environment.map(titleCase).join(", ") : "",
  ].filter(Boolean);
  const restKeys = Object.keys(form.rest || {}).filter((k) => k !== "variants" && form.rest[k] !== undefined);

  // Sections in statblock order, with what's in them (variant abilities live in their variant).
  const sections = SECTIONS.map((key) => ({
    key,
    features: features.map((f, i) => ({ f, i })).filter(({ f }) => (f.category || "traits") === key && !f.variant),
    blocks: blocks.map((b, i) => ({ b, i })).filter(({ b }) => (b.display_as || "traits") === key),
  })).filter((s) => s.features.length || s.blocks.length || (s.key === "legendary_actions" && form.legendaryUses));

  return (
    <CreateModal open={open} title={title} onClose={onClose} onSave={handleSave} saving={sheet ? sheetSaving : saving}
                 saveLabel={isEditing ? "Save Changes" : "Save"} saveDisabled={!started} error={sheet ? sheetError : saveError} width="max-w-3xl">
      {sheet && started && (
        <>
          <SheetSaveChoice saveTo={saveTo} setSaveTo={setSaveTo} asNew={asNew} setAsNew={setAsNew} homebrew={sheet.homebrew} />
          <label className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={`${labelCls} !mb-0`}>Nickname</span>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={form.name || "none"}
                   aria-label="Nickname" className={`${fieldCls} !w-56`} />
            <span className="text-xs italic text-ink-faded">shown on the sheet instead of its name (this sheet only)</span>
          </label>
        </>
      )}
      {!started ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm italic text-ink-faded">Start from…</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-sm border border-rule/40 px-3 py-2">
                <div className="text-[15px] text-ink">A monster of a challenge rating</div>
                <div className="text-xs italic text-ink-faded">AC, hit points, an attack and its damage as the DMG suggests for that CR</div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-xs text-ink-faded">CR</span>
                  <select value={startCR} onChange={(e) => setStartCR(e.target.value)} className={`${fieldCls} !w-20`} aria-label="Challenge rating to start from">
                    {CR_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button type="button" onClick={() => { setForm(formForCR(startCR)); setStarted(true); }}
                          className="rounded-sm border border-rubric/60 px-2 py-0.5 text-sm italic text-rubric hover:bg-rubric/10">
                    start
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => { setForm(emptyMonsterForm()); setStarted(true); }}
                      className="rounded-sm border border-rule/40 px-3 py-2 text-left transition hover:border-rubric/60 hover:bg-rubric/5">
                <div className="text-[15px] text-ink">An empty statblock</div>
                <div className="text-xs italic text-ink-faded">a Medium humanoid, all scores 10</div>
              </button>
            </div>
          </div>
          <div>
            <div className={labelCls}>…or a copy of a monster from the book</div>
            <EntryPicker entries={monsters || []} index={pickIndex} selected={[]} placeholder="search monsters…"
                         onToggle={(id) => {
                           const m = byId[id];
                           if (!m) return;
                           setForm(monsterToForm(m, { copy: true }));
                           setStarted(true);
                         }} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* header */}
          <div className="border-b border-rule/40 pb-1">
            <input type="text" value={form.name} onChange={(e) => { set("name", e.target.value); setNameError(false); }} placeholder="Monster name"
                   aria-label="Name" autoFocus={!form.name}
                   className={`w-full bg-transparent text-xl font-bold tracking-wide text-ink outline-none placeholder:font-normal placeholder:italic placeholder:text-ink-faint ${nameError ? "border-b border-bad" : ""}`} />
            {nameError && <p className="text-xs italic text-bad">It needs a name.</p>}
            <button type="button" onClick={() => setWin("type")} className="text-left text-sm italic text-ink-faded hover:text-rubric" title="Size, type, alignment">
              {monsterSubtitle(record) || "size · type · alignment"}
            </button>
            {record.version_of && (
              <p className="text-xs italic text-ink-faded">A version of {byId[record.version_of]?.name || record.version_of}.</p>
            )}
          </div>

          {/* AC, HP, speed, initiative */}
          <div className="space-y-0.5">
            {vitals.map(([label, value, key]) => <StatLine key={key} label={label} value={value || "—"} onClick={() => setWin(key)} />)}
          </div>

          {/* the ability table: scores typed in place, saves in a window */}
          <table className="w-full border-y border-rule/40 text-center text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-faded">
                {ABILITIES.map((a) => <th key={a} className="pt-1 font-semibold">{ABILITY_SHORT[a]}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                {ABILITIES.map((a) => {
                  const mod = abilityMod(form.abilities[a]);
                  const save = record.saves?.[a];
                  return (
                    <td key={a} className="pb-1 align-top">
                      <input type="number" min={0} value={form.abilities[a] ?? ""} onChange={(e) => set("abilities", { ...form.abilities, [a]: numOrNull(e.target.value) })}
                             aria-label={`${a} score`} className="w-12 border-b border-dotted border-rule/60 bg-transparent text-center font-semibold text-ink outline-none focus:border-solid focus:border-ink" />
                      <div className="text-xs text-ink-faded">{mod == null ? "—" : signed(mod)}</div>
                      <button type="button" onClick={() => setWin("saves")} title="Saving throws"
                              className={`text-[11px] hover:text-rubric ${save != null ? "font-semibold text-ink" : "text-ink-faint"}`}>
                        {save != null ? `save ${signed(save)}` : mod == null ? "save" : `save ${signed(mod)}`}
                      </button>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>

          {/* skills, defenses, senses, languages, CR, gear */}
          <div className="space-y-0.5 border-b border-rule/40 pb-2">
            {rows.map((r) => (
              ROW_WINDOW[r.label]
                ? <StatLine key={r.label} label={r.label} value={r.value} onClick={() => setWin(ROW_WINDOW[r.label])} />
                : <div key={r.label} className="text-sm"><span className="text-[11px] font-bold uppercase tracking-wider text-ink-faded">{r.label}: </span>{r.value}</div>
            ))}
            {!has.has("CR") && !has.has("Level") && <StatLine label="CR" value="none" onClick={() => setWin("challenge")} />}
            {targets && (
              <p className="pl-2 text-xs italic text-ink-faint" title="The DMG's Monster Statistics by Challenge Rating: the middle of each range">
                For CR {form.cr} the DMG suggests: AC {targets.ac} · HP {targets.hp} · attack +{targets.attack} · {targets.damage} damage a round · save DC {targets.dc}
              </p>
            )}
            {missingRows.length > 0 && <AddRow items={missingRows} />}
          </div>

          {/* traits, actions, … */}
          {sections.map((s) => (
            <section key={s.key}>
              <h3 className="mb-1 border-b border-rubric/40 pb-0.5 text-sm font-bold uppercase tracking-wider text-rubric">{SECTION_TITLES[s.key]}</h3>
              {s.key === "legendary_actions" && (
                <StatLine label="Uses" value={form.legendaryUses ? `${form.legendaryUses} a round${form.legendaryLair ? ` (${form.legendaryLair} in its lair)` : ""}` : "how many a round?"}
                          onClick={() => setWin("legendary")} />
              )}
              <div className="space-y-1">
                {s.blocks.map(({ b, i }) => (
                  <div key={`b-${i}`} className="flex items-start gap-2">
                    <button type="button" onClick={() => setWin({ block: i })} className={`${lineBtn} min-w-0 flex-1`} title="Click to change">
                      <span className="text-sm"><span className="font-semibold italic text-ink group-hover:text-rubric">{b.name || "Spellcasting"}.</span>{" "}
                        <span className="text-ink-faded">{(b.groups || []).map((g) => `${spellGroupLabel(g)}: ${plural((g.spells || []).length, "spell")}`).join(" · ") || "no spells yet"}</span>
                      </span>
                    </button>
                    <button type="button" onClick={() => set("spellcasting", blocks.filter((_, j) => j !== i))} className="pt-1 text-[10px] text-ink-faint hover:text-bad"
                            aria-label="Take off this spellcasting">✕</button>
                  </div>
                ))}
                {s.features.map(({ f, i }) => (
                  <FeatureLine key={f.id || `new-${i}`} f={f} onOpen={() => setWin({ feature: i })} onRemove={() => setFeatures(features.filter((_, j) => j !== i))}
                               onMove={(dir) => moveFeature(i, dir)} optionOf={f.parent ? nameOf[f.parent] || f.parent : null} />
                ))}
              </div>
            </section>
          ))}
          <AddRow items={[
            ...ADD_SECTIONS.map(([cat, word]) => ({ label: word, onClick: () => addFeature(cat) })),
            { label: "spellcasting", hint: "Spells it casts: at will, per day, or with slots", onClick: addBlock },
          ]} />

          {/* variants */}
          <div>
            {variants.length > 0 && <h3 className="mb-1 border-b border-rule/40 pb-0.5 text-sm font-bold uppercase tracking-wider text-ink-faded">Variants</h3>}
            <div className="space-y-1">
              {variants.map((v, i) => {
                const n = features.filter((f) => f.variant === v.id).length;
                return (
                  <div key={v.id || i} className="flex items-start gap-2">
                    <button type="button" onClick={() => setWin({ variant: i })} className={`${lineBtn} min-w-0 flex-1 border-l border-rule/30 pl-2`} title="Click to change">
                      <span className="text-[15px] font-semibold text-ink group-hover:text-rubric">{v.name || "New variant"}</span>
                      <span className="block text-xs italic text-ink-faded">
                        {[v.version ? `its own statblock: ${byId[v.version]?.name || v.version}` : "", n ? `${plural(n, "ability", "abilities")} off until switched on` : "", (v.text || "").slice(0, 100)]
                          .filter(Boolean).join(" · ") || "nothing yet"}
                      </span>
                    </button>
                    <button type="button" onClick={() => removeVariant(i)} className="pt-1 text-[10px] text-ink-faint hover:text-bad" aria-label={`Take off ${v.name || "this variant"}`}>✕</button>
                  </div>
                );
              })}
            </div>
            <AddRow items={[{ label: "variant", hint: "Another way it can appear: a text, and abilities the tracker can switch on (in a lair, a coven…)", onClick: addVariant }]} />
          </div>

          {/* footer */}
          <div className="flex flex-wrap items-baseline gap-x-3 border-t border-rule/25 pt-1.5 text-xs italic text-ink-faded">
            <button type="button" onClick={() => setWin("labels")} className="text-left hover:text-rubric" title="Edition, visibility, labels">
              {[form.edition === "classic" ? "Classic (2014)" : "One (2024)", form.visibility === "public" ? "public" : "private", ...labelWords].join(" · ")}
            </button>
            {restKeys.length > 0 && (
              <span title={`Saved as they are: ${restKeys.map((k) => titleCase(k.replace(/_/g, " "))).join(", ")}`}>· {plural(restKeys.length, "thing")} kept from the book</span>
            )}
          </div>
        </div>
      )}

      {winInfo && (
        <PartPopup title={winInfo.title} hint={winInfo.hint} onClose={() => setWin(null)}>
          {win === "type" && <TypeFields form={form} set={set} />}
          {win === "ac" && <AcFields form={form} set={set} />}
          {win === "hp" && <HpFields form={form} set={set} />}
          {win === "speed" && <SpeedFields form={form} set={set} />}
          {win === "initiative" && <InitiativeFields form={form} set={set} />}
          {win === "saves" && <SavesFields form={form} set={set} />}
          {win === "skills" && <SkillsFields form={form} set={set} />}
          {win === "defenses" && <DefensesFields form={form} set={set} />}
          {win === "senses" && <SensesFields form={form} set={set} />}
          {win === "languages" && <LanguagesFields form={form} set={set} />}
          {win === "challenge" && <ChallengeFields form={form} set={set} setForm={setForm} />}
          {win === "legendary" && <LegendaryUsesFields form={form} set={set} />}
          {win === "gear" && <GearFields form={form} set={set} items={items} index={index} />}
          {win === "labels" && (
            <>
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
              <LabelsFields form={form} set={set} habitats={habitats} />
            </>
          )}
        </PartPopup>
      )}

      {curFeature && (
        <PartPopup title={curFeature.name || `New ${(CATEGORY_OPTIONS.find((o) => o.value === curFeature.category)?.label || "feature").toLowerCase()}`}
                   onClose={() => setWin(null)} hint="Its name, section, uses, the statblock text, and the numbers the tracker and dice tower roll.">
          <MonsterFeatureFields f={curFeature} onPatch={(key, val) => patchFeature(win.feature, key, val)} />
        </PartPopup>
      )}
      {curBlock && (
        <PartPopup title={curBlock.name || "Spellcasting"} onClose={() => setWin(null)} hint="The spellcasting line (ability, save DC, attack) and its spells by how often it can cast them.">
          <SpellBlockFields block={curBlock} spells={spells} index={index}
                            onPatch={(p) => set("spellcasting", blocks.map((b, j) => (j === win.block ? { ...b, ...p } : b)))} />
        </PartPopup>
      )}
      {curVariant && (
        <PartPopup title={curVariant.name || "New variant"} onClose={() => setWin(null)}
                   hint="Another way it can appear. Its abilities are off until switched on in the initiative tracker. A whole different statblock is a copy of this monster instead.">
          <VariantCard variant={curVariant} onChange={(v) => setVariants(variants.map((x, j) => (j === win.variant ? v : x)))}
                       features={features} setFeatures={setFeatures}
                       version={curVariant.version ? byId[curVariant.version] : null} onOpenVersion={() => byId[curVariant.version] && openPopup("monster", byId[curVariant.version])} />
        </PartPopup>
      )}
    </CreateModal>
  );
}
