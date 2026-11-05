import React, { useEffect, useRef, useState } from "react";
import useCharStore from "../../../../store/CharStore";
import { useCatalogueStore } from "../../../../store/CatalogueStore";
import { usePopupStore } from "../../../../store/PopupStore";
import { INK, ParchmentSheet, Title } from "../../../../styles/parchment";
import { Chevron, DefineSection, Hint, NumberInput, addBtn, chipBtn, ghostBtn } from "../../../../styles/parchmentForm";
import { SlotGrid, PactSlots, SorceryEditor } from "./SpellResources";
import { normalizeSpell, spellFromCatalogue, spellKey, SpellCard, SpellPicker, matchesFilters } from "./SpellCards";
import { FeatureListCard, featureKey } from "./FeatureCards";

/* Define tab: Spellbook, on parchment.

   1. Slots & resources: max slots per level, pact slots, sorcery points.
   2. Spells: add from the catalogue, filter, grouped by level.
   3. Metamagic and Eldritch Invocations from the optional-feature catalogue.

   The stored spellbook shape is unchanged. */

const newId = () =>
  globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const asList = (v) => (Array.isArray(v) ? v : []);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

// Which spell levels are collapsed, remembered in the browser.
const CLOSED_LEVELS_KEY = "spellbook.closedLevels";
const readClosedLevels = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CLOSED_LEVELS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Optional-feature types shown in the spellbook, and where each is stored.
const FEATURE_LISTS = [
  { key: "metamagic", type: "metamagic", title: "Metamagic", label: "metamagic" },
  { key: "invocations", type: "eldritch_invocation", title: "Eldritch Invocations", label: "invocations" },
];

const STATE_FILTERS = [
  { value: "prepared", label: "Prepared" },
  { value: "unprepared", label: "Unprepared" },
  { value: "innate", label: "Innate" },
  { value: "at_will", label: "At will" },
];
const PROP_FILTERS = [
  { value: "ritual", label: "Ritual" },
  { value: "concentration", label: "Concentration" },
];
const COMP_FILTERS = [
  { value: "v", label: "V" },
  { value: "s", label: "S" },
  { value: "m", label: "M" },
];

const normalizeSlots = (arr) =>
  asList(arr).map((r) => ({
    id: r.id ?? newId(),
    level: r.level ?? "",
    slots_max: r.slots_max ?? "",
    slots_current: r.slots_current ?? r.slots_max ?? "",
  }));

// Stored optional features are just a reference into the catalogue.
const normalizeFeatures = (arr) =>
  asList(arr)
    .filter((r) => r?.name)
    .map((r) => ({ id: r.id ?? newId(), name: r.name, source: r.source ?? "" }));

function SubHeading({ children, hint }) {
  return (
    <div className="mb-1.5 flex items-baseline gap-2">
      <span className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${INK.faded}`}>{children}</span>
      {hint && <span className={`text-[11px] italic ${INK.faint}`}>{hint}</span>}
    </div>
  );
}

export default function SpellbookDefine() {
  const charData = useCharStore((s) => s.charData);
  const updateCharField = useCharStore((s) => s.updateCharField);
  const postCharData = useCharStore((s) => s.postCharData);

  const spellsData = useCatalogueStore((s) => s.spellsData);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);
  const optionalFeatures = useCatalogueStore((s) => s.optionalFeaturesData?.features);
  const loadOptionalFeatures = useCatalogueStore((s) => s.loadOptionalFeatures);
  const openPopup = usePopupStore((s) => s.open);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState([]);
  const [notice, setNotice] = useState("");
  const [closedLevels, setClosedLevelsState] = useState(readClosedLevels);
  const noticeTimer = useRef(null);

  useEffect(() => {
    if (!asList(spellsData?.spells).length) loadSpells();
    if (!asList(optionalFeatures).length) loadOptionalFeatures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  // Guard after hooks, so hook order never changes.
  if (!charData) return null;

  /* ----- normalized view of the stored spellbook ----- */
  const raw = isObj(charData.spellbook) ? charData.spellbook : {};
  const sorcery = isObj(raw.sorcery_points) ? raw.sorcery_points : {};
  const book = {
    ...raw,
    spells: asList(raw.spells).map(normalizeSpell),
    spellslots: normalizeSlots(raw.spellslots),
    pactslots: normalizeSlots(raw.pactslots),
    metamagic: normalizeFeatures(raw.metamagic),
    invocations: normalizeFeatures(raw.invocations),
    sorcery_points: {
      max_charges: sorcery.max_charges ?? "",
      current_charges: sorcery.current_charges ?? sorcery.max_charges ?? "",
      reset_amount: Number(sorcery.reset_amount ?? 0) || 0,
    },
    max_prepared_spells: Math.max(0, Number(raw.max_prepared_spells) || 0),
  };

  /* ----- writers: every change saves straight away ----- */
  const saveBook = (next) => {
    updateCharField("spellbook", next);
    postCharData();
  };

  const flash = (message) => {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 3000);
  };

  /* ----- level groups ----- */
  const setClosedLevels = (next) => {
    setClosedLevelsState(next);
    try {
      localStorage.setItem(CLOSED_LEVELS_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked: still works for this visit */
    }
  };

  const toggleLevel = (level) =>
    setClosedLevels(closedLevels.includes(level) ? closedLevels.filter((l) => l !== level) : [...closedLevels, level]);

  /* ----- spells ----- */
  const preparedCount = book.spells.filter((s) => s.level >= 1 && s.prepared && !s.innate && !s.at_will).length;

  const knownKeys = new Set(book.spells.map(spellKey));
  const catalogueSpells = asList(spellsData?.spells);

  const updateSpell = (id, patch) =>
    saveBook({
      ...book,
      spells: book.spells.map((s) => (s.id === id ? normalizeSpell({ ...s, ...patch }) : s)),
    });

  const togglePrepared = (spell) => {
    if (spell.prepared) return updateSpell(spell.id, { prepared: false });
    const limit = book.max_prepared_spells;
    if (limit > 0 && preparedCount >= limit) {
      return flash(`Prepared limit reached (${limit}). Unprepare a spell first.`);
    }
    updateSpell(spell.id, { prepared: true });
  };

  const setMode = (spell, mode) => {
    if (mode === "innate") return updateSpell(spell.id, { innate: true, at_will: false });
    if (mode === "at_will") return updateSpell(spell.id, { innate: false, at_will: true });
    return updateSpell(spell.id, { innate: false, at_will: false, prepared: false, uses: null });
  };

  const setLimited = (spell, on) => updateSpell(spell.id, { uses: on ? { max: 1, current: 1, reset: "long" } : null });

  const changeUses = (spell, patch) => {
    const next = { ...spell.uses };
    if ("max" in patch) next.max = Number(patch.max) || 0;
    if ("current" in patch) next.current = Number(patch.current) || 0;
    if ("reset" in patch) next.reset = patch.reset;
    updateSpell(spell.id, { uses: next });
  };

  const removeSpell = (spell) => saveBook({ ...book, spells: book.spells.filter((s) => s.id !== spell.id) });

  const addSpell = (entry) => {
    if (knownKeys.has(spellKey(entry))) return;
    saveBook({ ...book, spells: [...book.spells, spellFromCatalogue(entry)] });
  };

  // The popup needs the full catalogue entry, not the trimmed stored row.
  const catalogueEntryFor = (spell) =>
    catalogueSpells.find((c) => c.name === spell.name && c.source === spell.source) ?? spell;

  /* ----- spell filters ----- */
  const levelsPresent = [...new Set(book.spells.map((s) => s.level))].sort((a, b) => a - b);
  const schoolsPresent = [...new Set(book.spells.map((s) => s.school).filter(Boolean))].sort();

  const toggleFilter = (token) => setFilters((prev) => (prev.includes(token) ? prev.filter((t) => t !== token) : [...prev, token]));

  const filterGroups = [
    { label: "State", group: "state", options: STATE_FILTERS },
    { label: "Properties", group: "prop", options: PROP_FILTERS },
    { label: "Components", group: "comp", options: COMP_FILTERS },
    {
      label: "Level",
      group: "lvl",
      options: levelsPresent.map((l) => ({ value: String(l), label: l === 0 ? "Cantrip" : `Lvl ${l}` })),
    },
    { label: "School", group: "school", options: schoolsPresent.map((s) => ({ value: s, label: cap(s) })) },
  ].filter((g) => g.options.length > 0);

  const visible = book.spells.filter((s) => matchesFilters(s, filters));
  const visibleLevels = [...new Set(visible.map((s) => s.level))].sort((a, b) => a - b);
  const spellsAt = (level) => visible.filter((s) => s.level === level).sort((a, b) => a.name.localeCompare(b.name));

  /* ----- optional features ----- */
  const featuresOfType = (type) => asList(optionalFeatures).filter((f) => f?.name && f.feature_type === type);

  const addFeature = (key, entry) => {
    if (book[key].some((r) => featureKey(r) === featureKey(entry))) return;
    saveBook({ ...book, [key]: [...book[key], { id: newId(), name: entry.name, source: entry.source ?? "" }] });
  };

  const removeFeature = (key, id) => saveBook({ ...book, [key]: book[key].filter((r) => r.id !== id) });

  /* ---------- render ---------- */
  const slotCount = book.spellslots.reduce((n, r) => n + (Number(r.slots_max) || 0), 0);
  const limit = book.max_prepared_spells;

  return (
    <ParchmentSheet>
      <Title
        after={
          <span className={`text-sm italic ${INK.faded}`}>
            {book.spells.length} spells · {preparedCount}
            {limit ? ` of ${limit}` : ""} prepared
          </span>
        }
      >
        Spellbook
      </Title>
      <div className="space-y-9">

      {/* 1. Slots & resources */}
      <DefineSection title="Slots & Resources" count={slotCount ? `${slotCount} slots` : null} storageKey="spellbook.open.resources">
        <div>
          <SubHeading hint="Max per level. Empty means none; spend them in Play.">Spell slots</SubHeading>
          <SlotGrid rows={book.spellslots} onChange={(spellslots) => saveBook({ ...book, spellslots })} />
        </div>
        <div className="grid grid-cols-1 gap-x-12 gap-y-5 pt-2 @3xl:grid-cols-2">
          <div>
            <SubHeading hint="Warlock">Pact magic</SubHeading>
            <PactSlots rows={book.pactslots} onChange={(pactslots) => saveBook({ ...book, pactslots })} />
          </div>
          <div>
            <SubHeading hint="Sorcerer">Sorcery points</SubHeading>
            <SorceryEditor value={book.sorcery_points} onChange={(sorcery_points) => saveBook({ ...book, sorcery_points })} />
          </div>
        </div>
      </DefineSection>

      {/* 2. Spells */}
      <DefineSection
        title="Spells"
        count={book.spells.length}
        storageKey="spellbook.open.spells"
        actions={(setOpen) => (
          <>
            <label className={`flex items-baseline gap-1.5 text-xs italic ${INK.faded}`} title="Empty = no limit">
              max prepared
              <NumberInput
                value={limit || null}
                min={0}
                placeholder="—"
                fallback={0}
                size="sm"
                onChange={(v) => saveBook({ ...book, max_prepared_spells: Math.max(0, v || 0) })}
                className="w-9 not-italic"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setPickerOpen((open) => !open);
              }}
              className={addBtn}
            >
              {pickerOpen ? "close the catalogue" : "+ from the catalogue"}
            </button>
          </>
        )}
      >
        {notice && (
          <p className={`text-sm italic ${INK.rubric}`}>{notice}</p>
        )}

        {pickerOpen && (
          <SpellPicker
            entries={catalogueSpells}
            knownKeys={knownKeys}
            onOpen={(entry) => openPopup("spell", entry)}
            onAdd={addSpell}
            onClose={() => setPickerOpen(false)}
          />
        )}

        {book.spells.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <button type="button" onClick={() => setFiltersOpen((o) => !o)} className={chipBtn(filtersOpen || filters.length > 0)}>
              filters{filters.length ? ` (${filters.length})` : ""}
            </button>
            {filters.length > 0 && (
              <>
                <span className={`text-[11px] italic ${INK.faint}`}>
                  showing {visible.length} of {book.spells.length}
                </span>
                <button type="button" onClick={() => setFilters([])} className={ghostBtn}>
                  clear
                </button>
              </>
            )}
            {visibleLevels.length > 1 && (
              <div className="ml-auto flex gap-4">
                <button type="button" onClick={() => setClosedLevels([])} className={ghostBtn}>
                  open all
                </button>
                <button type="button" onClick={() => setClosedLevels(levelsPresent)} className={ghostBtn}>
                  close all
                </button>
              </div>
            )}
          </div>
        )}

        {filtersOpen && book.spells.length > 0 && (
          <div className="space-y-1 border-l border-[#7b6346]/30 pl-3">
            {filterGroups.map((g) => (
              <div key={g.group} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className={`w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] ${INK.faded}`}>{g.label}</span>
                {g.options.map((o) => {
                  const token = `${g.group}:${o.value}`;
                  return (
                    <button key={token} type="button" onClick={() => toggleFilter(token)} className={chipBtn(filters.includes(token))}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {book.spells.length === 0 && <Hint>No spells yet — add them from the catalogue.</Hint>}
        {book.spells.length > 0 && visible.length === 0 && <Hint>No spells match these filters.</Hint>}

        {visibleLevels.map((level) => {
          const list = spellsAt(level);
          const open = !closedLevels.includes(level);
          return (
            <div key={level} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleLevel(level)}
                aria-expanded={open}
                className="group flex w-full items-baseline gap-2 pt-2 text-left"
              >
                <span className="self-center">
                  <Chevron open={open} />
                </span>
                <span className={`text-[15px] italic ${INK.rubric} group-hover:underline group-hover:decoration-dotted`}>
                  {level === 0 ? "Cantrips" : `Level ${level}`}
                </span>
                <span className={`text-[11px] ${INK.faint}`}>{list.length}</span>
              </button>

              {open && (
                <div className="grid grid-cols-1 items-start gap-x-10 @4xl:grid-cols-2">
                  {list.map((spell) => (
                    <SpellCard
                      key={spell.id}
                      spell={spell}
                      onOpen={() => openPopup("spell", catalogueEntryFor(spell))}
                      onSetMode={setMode}
                      onTogglePrepared={togglePrepared}
                      onChangeUses={changeUses}
                      onSetLimited={setLimited}
                      onRemove={removeSpell}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </DefineSection>

      {/* 3. Optional features */}
      {FEATURE_LISTS.map((f) => (
        <FeatureListCard
          key={f.key}
          title={f.title}
          label={f.label}
          storageKey={`spellbook.open.${f.key}`}
          catalogue={featuresOfType(f.type)}
          list={book[f.key]}
          onAdd={(entry) => addFeature(f.key, entry)}
          onRemove={(id) => removeFeature(f.key, id)}
          onOpen={(entry) => openPopup("optionalFeature", entry)}
        />
      ))}
      </div>
    </ParchmentSheet>
  );
}