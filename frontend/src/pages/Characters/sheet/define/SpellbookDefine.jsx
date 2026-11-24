import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../../store/CatalogueStore";
import { usePopupStore } from "../../../../store/PopupStore";
import useAuthStore from "../../../../store/AuthStore";
import useCharStore from "../../../../store/CharStore";
import { INK, InkButton, InkNumber, InkText, Leader, ParchmentSheet, Title } from "../../../../styles/parchment";
import { Chevron, DefineSection, Field, Hint, PickerRow, PickerShell, Segmented, Switch, Tag, TextBlock, addBtn, chipBtn, dangerBtn, ghostBtn, inputCls } from "../../../../styles/parchmentForm";
import { RichText } from "../../../Catalogues/catalogueParts";
import SpellCardForm from "../../../Catalogues/Spells/SpellCardForm";
import { formatComponents, formatDuration, formatRange, formatTime } from "../../../Catalogues/Spells/spellHelpers";
import { actionWords } from "../../../../utils/featureRuntime";
import { asList, labelOf, manualOf, signed, useSheet } from "../sheetHelpers";
import { SPELL_OPTION_TYPES, addOwnFeature, featureRows, isSpellOption, optionalFeatureCopy, sourceKind } from "../featureHelpers";
import {
  CAST_MODES,
  ORDINAL,
  addOwnSpell,
  addSpell,
  castingClasses,
  classFor,
  componentMarks,
  playsSpell,
  setSpellInPlay,
  setSpellClass,
  setSpellOn,
  setSpellRemoved,
  editedSpell,
  patchSpell,
  preparedLimits,
  removeSpell,
  replaceSpell,
  restoredSpell,
  savedSpell,
  setCastMode,
  setOwnSpellAbility,
  setPreparedOverride,
  setSpellAbility,
  spellLevelTitle,
  spellRecord,
  spellRows,
} from "../spellbookHelpers";
import { ABILITIES as ABILITY_KEYS } from "../../../../utils/derive";
import FeatureList from "./FeatureList";
import OptionPicker from "./OptionPicker";

/* Define tab: Spellbook, on parchment.

   1. Spellcasting: per casting class its ability, attack and DC, and its
      cantrips and prepared spells against the class's numbers (the book's,
      or yours: write over them; a note, never a limit). "Your own" is the
      ability for spells without a class, for any character.
   2. Spells, by level (each level folds; cantrips too). The diamond
      prepares a spell, cantrips included, up to the class's number (raise
      the number to prepare more). Innate and at-will spells are always
      prepared and never counted (a spell with no class to count toward,
      a subclass's, a feat's, a race's, is innate). The name opens its card (your
      copy); ⋯ opens how it's ready (prepared, innate with optional free
      casts per rest, at will; with two casting classes, which one a
      prepared spell counts toward), its ability, your note, and "edit the spell"
      (the catalogue's spell form on your copy: this sheet only, or your
      catalogue too) / "back to the book's". Filters: state, properties,
      components, level, school, where it's from (each class by name).
   3. Invocations & Metamagic (and pact boons): the optional features the
      class levels picked, plus any added from the catalogue.

   Slots, pact slots and pools are on the Resources tab. */

const MAX_PICKER_ROWS = 80;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const EDITIONS = [
  { id: "one", label: "One D&D" },
  { id: "classic", label: "Classic" },
];

// Each school its own ink (a dot of colour on the line).
const SCHOOL_INK = {
  abjuration: "text-sky-800 border-sky-800/40",
  conjuration: "text-amber-800 border-amber-800/40",
  divination: "text-slate-600 border-slate-600/40",
  enchantment: "text-pink-800 border-pink-800/40",
  evocation: "text-red-800 border-red-800/40",
  illusion: "text-violet-800 border-violet-800/40",
  necromancy: "text-emerald-900 border-emerald-900/40",
  transmutation: "text-orange-800 border-orange-800/40",
};
const SCHOOL_SHORT = { abjuration: "abj", conjuration: "conj", divination: "div", enchantment: "ench", evocation: "evoc", illusion: "illus", necromancy: "necro", transmutation: "trans" };

function Chip({ children, className = "", title }) {
  return (
    <span title={title} className={`inline-flex h-[17px] min-w-[17px] shrink-0 items-center justify-center rounded border px-1 text-[10px] font-semibold uppercase leading-none tracking-wider ${className}`}>
      {children}
    </span>
  );
}

/* ─── filters ────────────────────────────────────────────────────── */

const SOURCES = { race: "Race", background: "Background", class: "Class", feat: "Feat", item: "Item", manual: "Yours" };

// A class's spells: from its layers or counting toward it ("cls.<id>").
const classesOf = (r) => [...new Set([r.layerClass, r.counts].filter(Boolean))];

function filterGroups(rows, ch) {
  const levels = [...new Set(rows.map((r) => r.level))].sort((a, b) => a - b);
  const schools = [...new Set(rows.map((r) => r.spell.school).filter(Boolean))].sort();
  const classIds = [...new Set(rows.flatMap(classesOf))];
  const sources = [...new Set(rows.map((r) => sourceKind(r.from)).filter((k) => k !== "class"))];
  const from = [
    ...classIds.map((cid) => ({ value: `cls.${cid}`, label: ch?.classes?.[cid]?.name || labelOf(cid) })),
    ...sources.map((k) => ({ value: k, label: SOURCES[k] || labelOf(k) })),
  ];
  return [
    {
      label: "State",
      group: "state",
      options: [
        { value: "prepared", label: "Prepared" },
        { value: "unprepared", label: "Unprepared" },
        { value: "innate", label: "Innate" },
        { value: "at_will", label: "At will" },
        { value: "ritual", label: "Ritual only" },
      ],
    },
    {
      label: "Properties",
      group: "prop",
      options: [
        { value: "ritual", label: "Ritual" },
        { value: "concentration", label: "Concentration" },
      ],
    },
    {
      label: "Components",
      group: "comp",
      options: [
        { value: "v", label: "V" },
        { value: "s", label: "S" },
        { value: "m", label: "M" },
        { value: "m*", label: "M*" },
      ],
    },
    { label: "Level", group: "level", options: levels.map((l) => ({ value: String(l), label: l === 0 ? "Cantrip" : ORDINAL[l] })) },
    { label: "School", group: "school", options: schools.map((s) => ({ value: s, label: labelOf(s) })) },
    { label: "From", group: "from", options: from },
  ].filter((g) => g.options.length > 1 || g.group === "state" || g.group === "prop");
}

// One token: "group:value". Within a group any may match; groups all must.
function tokenMatches(r, token) {
  const [group, value] = token.split(":");
  switch (group) {
    case "state":
      if (value === "prepared") return r.prepared;
      if (value === "unprepared") return !r.prepared;
      return r.mode === value;
    case "prop":
      return value === "ritual" ? r.ritual : r.concentration;
    case "comp": {
      const marks = componentMarks(r.spell).marks.map((m) => m.toLowerCase());
      return value === "m" ? marks.some((m) => m.startsWith("m")) : marks.includes(value);
    }
    case "level":
      return String(r.level) === value;
    case "school":
      return r.spell.school === value;
    case "from":
      return value.startsWith("cls.") ? classesOf(r).includes(value.slice(4)) : sourceKind(r.from) === value;
    default:
      return true;
  }
}

function matches(r, tokens) {
  const groups = {};
  for (const t of tokens) (groups[t.split(":")[0]] ||= []).push(t);
  return Object.values(groups).every((list) => list.some((t) => tokenMatches(r, t)));
}

/* ─── One spell ──────────────────────────────────────────────────── */

function SpellLine({ r, open, onToggle, onPrepare, onView, onPlay, onRemove }) {
  const s = r.spell;
  const preparable = r.mode === "slots"; // innate and at-will spells are always ready
  const { marks, material } = componentMarks(s);
  const mode =
    r.mode === "at_will"
      ? "at will"
      : r.mode === "ritual"
        ? "ritual only"
        : r.uses
          ? `innate · ${r.uses.max}× ${r.uses.reset === "short" ? "short rest" : "long rest"}`
          : r.resource
            ? `${r.resource.cost ?? 1} ${labelOf(String(r.resource.resource))}`
            : r.mode === "innate"
              ? "innate"
              : null;
  const school = s.school ? String(s.school).toLowerCase() : null;
  return (
    <div className={`flex items-baseline gap-1.5 py-[3px] ${r.reached ? "" : "opacity-50"} ${preparable && !r.prepared ? "opacity-60" : ""}`}>
      <span className="self-center">
        {preparable ? (
          <Switch checked={r.prepared} onChange={onPrepare} label={r.prepared ? "Prepared" : "Not prepared"} />
        ) : playsSpell(r) ? (
          <Switch checked={r.inPlay} onChange={onPlay} label={r.inPlay ? "Shown in Play" : "Hidden in Play"} />
        ) : (
          <span className="inline-block w-5" />
        )}
      </span>
      <button type="button" onClick={onView} title="Open its card" className="truncate text-left text-[15px] hover:underline hover:decoration-dotted hover:underline-offset-4">
        {s.name}
      </button>
      {!r.own && <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`}>{r.owner}</span>}
      {s.edited && <span className={`shrink-0 text-[10px] italic ${INK.faint}`}>edited</span>}
      {!r.reached && <span className={`shrink-0 text-xs italic ${INK.faded}`}>from level {r.unlock}</span>}
      <Leader />
      <button type="button" onClick={onRemove} title={r.own ? "Delete it" : "Take it off the sheet"} aria-label={`Remove ${s.name}`} className={`shrink-0 px-0.5 text-xs leading-none ${INK.faint} hover:text-rubric`}>
        ✕
      </button>
      <span className="flex shrink-0 items-center gap-1 text-xs">
        {r.isToggle && r.on && <span className={`mr-1 text-[10px] font-semibold uppercase tracking-wider ${INK.rubric}`} title="Switched on: it counts on the sheet">on</span>}
        {mode && <span className={`mr-1 italic ${INK.faded}`}>{mode}</span>}
        {school && (
          <Chip className={SCHOOL_INK[school] || `${INK.faded} border-rule/40`} title={labelOf(school)}>
            {SCHOOL_SHORT[school] || school.slice(0, 4)}
          </Chip>
        )}
        {marks.length > 0 && (
          <span className={`px-0.5 text-[11px] tracking-wider ${INK.faded}`} title={material ? `Material: ${material}` : undefined}>
            {marks.join(" ")}
          </span>
        )}
        {r.ritual && (
          <Chip className="border-teal-800/50 text-teal-800" title="Ritual">
            R
          </Chip>
        )}
        {r.concentration && (
          <Chip className="border-amber-700/60 text-amber-700" title="Concentration">
            C
          </Chip>
        )}
      </span>
      <button type="button" onClick={onToggle} aria-expanded={open} title="How it's cast, its ability, your note, edit…" className={`shrink-0 px-0.5 text-sm leading-none ${open ? INK.rubric : INK.faded} hover:text-ink`}>
        ⋯
      </button>
    </div>
  );
}

function SpellDetail({ r, classes, onNote, onRemove, onCast, onAbility, onClass, onOn, onPlay, onEdit, onRestore, onDone }) {
  const s = r.spell;
  const uses = s.granted?.uses;
  const cantrip = r.level === 0;
  return (
    <div className="mb-4 ml-[26px] mt-1 space-y-2 border-l-2 border-rubric/40 pl-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        {!cantrip && (
          <Field label="Ready">
            <span className="flex flex-wrap items-baseline gap-2">
              <Segmented
                size="sm"
                options={CAST_MODES.filter((m) => (m.value !== "slots" || classes.length) && (m.value !== "ritual" || s.ritual || r.mode === "ritual"))}
                value={r.mode}
                onChange={(m) => onCast(m, isObj(uses) ? uses.max : null, (isObj(uses) && uses.reset) || "long")}
              />
              {r.mode === "innate" && (
                <span className="flex flex-wrap items-baseline gap-2 text-sm" title="Free casts are optional: leave it empty for none">
                  <InkNumber
                    value={isObj(uses) && typeof uses.max === "number" ? uses.max : null}
                    min={0}
                    placeholder="—"
                    onChange={(v) => onCast("innate", v || null, (isObj(uses) && uses.reset) || "long")}
                    aria-label="Free casts"
                    className="h-7 w-10 text-[15px]"
                  />
                  free casts
                  {isObj(uses) && uses.max > 0 && (
                    <Segmented
                      size="sm"
                      options={[
                        { value: "long", label: "per long rest" },
                        { value: "short", label: "per short rest" },
                      ]}
                      value={uses.reset || "long"}
                      onChange={(reset) => onCast("innate", uses.max, reset)}
                    />
                  )}
                </span>
              )}
            </span>
          </Field>
        )}
        {r.mode === "slots" && classes.length > 1 && (
          <Field label="Counts toward">
            <Segmented size="sm" options={classes.map((c) => ({ value: c.id, label: c.name }))} value={r.counts || ""} onChange={onClass} />
          </Field>
        )}
        {playsSpell(r) && (
          <Field label="In Play">
            <span className="flex items-center gap-1.5 text-sm">
              <Switch checked={r.inPlay} onChange={onPlay} label="Shown in Play" />
              {r.inPlay ? "shown" : "hidden"}
            </span>
          </Field>
        )}
        {r.isToggle && (
          <Field label="Switched on">
            <span className="flex items-center gap-1.5 text-sm" title="While it's on, what it does counts on the sheet (Mage Armor's AC, Bless…)">
              <Switch checked={r.on} onChange={onOn} label="Switched on" />
              {r.toggles.map((t) => t.name).join(", ")}
            </span>
          </Field>
        )}
        <Field label="Ability">
          <Segmented
            size="sm"
            options={[{ value: "", label: "—" }, ...ABILITY_KEYS.map((a) => ({ value: a, label: a.toUpperCase() }))]}
            value={typeof s.granted?.ability === "string" ? s.granted.ability : ""}
            onChange={onAbility}
          />
        </Field>
        {r.ability && (
          <span className="text-sm">
            {r.ability.toUpperCase()} · <span className="font-semibold">{signed(r.attack)}</span> · DC <span className="font-semibold">{r.dc}</span>
          </span>
        )}
      </div>
      <p className={`text-xs italic ${INK.faded}`}>
        {[r.level === 0 ? "Cantrip" : `${ORDINAL[r.level]} level`, s.school, formatTime(s), formatRange(s.range), formatComponents(s.components), formatDuration(s)].filter(Boolean).join(" · ")}
      </p>
      {r.actions.map((a) => (
        <p key={a.name} className={`text-sm ${INK.rubric}`}>
          {r.actions.length > 1 && <span className="font-semibold">{a.name}: </span>}
          {actionWords(a.action)}
        </p>
      ))}
      <TextBlock value={s.notes || ""} onChange={(e) => onNote(e.target.value)} placeholder="Your note (how you use it, what it looks like)…" minRows={1} />
      <div className="flex flex-wrap items-baseline gap-x-5">
        <button type="button" onClick={onDone} className={ghostBtn}>
          done
        </button>
        <button type="button" onClick={onEdit} className={ghostBtn} title="Change the spell itself: its text, numbers, range…">
          edit the spell
        </button>
        {s.edited && s.book && (
          <button type="button" onClick={onRestore} className={ghostBtn} title="Undo every change you made to the spell">
            back to the book's
          </button>
        )}
        <button type="button" onClick={onRemove} className={`ml-auto ${dangerBtn}`} title={r.own ? "Delete this spell" : "Take it off the sheet"}>
          remove
        </button>
      </div>
    </div>
  );
}

/* ─── Catalogue pickers ──────────────────────────────────────────── */

function SpellPicker({ have, onAdd, onView, onClose }) {
  const spells = useCatalogueStore((s) => s.spells);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState(null);
  const [editions, setEditions] = useState(["one"]);

  useEffect(() => {
    const store = useCatalogueStore.getState();
    if (!asList(store.spells).length && !store.loadingSpells) store.loadSpells();
  }, []);

  const q = query.trim().toLowerCase();
  const all = asList(spells).filter((s) => s?.name && editions.includes(s.edition === "classic" ? "classic" : "one"));
  const rows = all
    .filter((s) => (level == null || s.level === level) && (!q || s.name.toLowerCase().includes(q) || String(s.source || "").toLowerCase().includes(q)))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  const toggleEdition = (id) => {
    const next = editions.includes(id) ? editions.filter((v) => v !== id) : [...editions, id];
    if (next.length) setEditions(next);
  };

  return (
    <PickerShell
      title="Spells from the catalogue"
      query={query}
      onQuery={setQuery}
      onClose={onClose}
      filters={
        <>
          {EDITIONS.map((e) => (
            <button key={e.id} type="button" onClick={() => toggleEdition(e.id)} className={chipBtn(editions.includes(e.id))}>
              {e.label}
            </button>
          ))}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => (
            <button key={l} type="button" onClick={() => setLevel(level === l ? null : l)} className={chipBtn(level === l)}>
              {l === 0 ? "cantrip" : l}
            </button>
          ))}
        </>
      }
      footer={`${rows.length > MAX_PICKER_ROWS ? `first ${MAX_PICKER_ROWS} of ${rows.length} — type to narrow` : `${rows.length} of ${all.length}`} · click a name to view its card`}
    >
      {rows.length === 0 && <Hint className="py-2">{all.length ? "Nothing matches." : "Fetching the catalogue…"}</Hint>}
      {rows.slice(0, MAX_PICKER_ROWS).map((s) => {
        const got = have.has(s.id);
        return (
          <PickerRow
            key={`${s.id}-${s.visibility || ""}`}
            name={s.name}
            onOpen={() => onView(s)}
            meta={<Tag>{s.level === 0 ? "cantrip" : `level ${s.level}`}</Tag>}
            source={s.source}
            highlight={got}
            action={{ label: got ? "added" : "add", disabled: got, onClick: () => onAdd(s) }}
          />
        );
      })}
    </PickerShell>
  );
}

/* ─── Tab ─────────────────────────────────────────────────────────── */

const abilityOptions = [{ value: "", label: "—" }, ...ABILITY_KEYS.map((a) => ({ value: a, label: a.toUpperCase() }))];

export default function SpellbookDefine() {
  const { ch, d, patchChar } = useSheet();
  const catalogueSpells = useCatalogueStore((s) => s.spells);
  const createSpell = useCatalogueStore((s) => s.createSpell);
  const updateSpell = useCatalogueStore((s) => s.updateSpell);
  const userName = useAuthStore((s) => s.userData?.name);
  const openPopup = usePopupStore((s) => s.open);
  const [openKey, setOpenKey] = useState(null);
  const [optionKey, setOptionKey] = useState(null);
  const [picking, setPicking] = useState(false);
  const [pickingOptions, setPickingOptions] = useState(false);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState([]);
  const [closed, setClosed] = useState([]); // folded levels
  const [form, setForm] = useState(null); // { row } edit a copy · { row: null } your own
  const [notice, setNotice] = useState(null); // "Wizard has 25 of 25 prepared…"

  const rows = useMemo(() => spellRows(ch, d), [ch, d]);
  const options = useMemo(() => featureRows(ch, d).filter((r) => isSpellOption(r.feature)), [ch, d]);
  if (!ch || !d) return null;

  const limits = preparedLimits(ch, d, rows);
  const classes = castingClasses(ch);
  // Room to prepare one more of this level for a class (its number, yours or the book's).
  const room = (cid, level) => {
    const lim = limits.find((l) => l.classId === cid);
    const max = level === 0 ? lim?.cantrips : lim?.spells;
    const have = level === 0 ? lim?.cantripCount : lim?.prepared;
    return max == null || (have ?? 0) < max;
  };
  const prepare = (r, v) => {
    if (v && r.counts && !room(r.counts, r.level)) {
      const lim = limits.find((l) => l.classId === r.counts);
      const word = r.level === 0 ? "cantrips" : "spells prepared";
      setNotice(`${lim?.name || "This class"} has ${r.level === 0 ? lim?.cantripCount : lim?.prepared} of ${r.level === 0 ? lim?.cantrips : lim?.spells} ${word}. Unprepare one, or raise the number under Spellcasting.`);
      return;
    }
    setNotice(null);
    now(patchSpell(ch, r.from, r.spell.id, { prepared: v }));
  };
  /* A spell that starts counting toward a class (made prepared, or moved to
     another class) lands prepared while that class has room, else
     unprepared with a notice. */
  const placed = (r, patch, cid) => {
    if (!cid) return patch;
    const ok = room(cid, r.level);
    const lim = limits.find((l) => l.classId === cid);
    setNotice(ok ? null : `${lim?.name || "That class"} is full, so ${r.spell.name} is unprepared. Unprepare another, or raise the number under Spellcasting.`);
    return { ...patch, ...patchSpell({ ...ch, ...patch }, r.from, r.spell.id, { prepared: ok }) };
  };
  const have = new Set(rows.map((r) => r.spell.id));
  const haveOptions = new Set(options.map((r) => r.feature.id));
  const now = (patch) => patchChar(patch, { now: true });
  const latest = () => useCharStore.getState().charData || ch;

  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) => (!q || String(r.spell.name).toLowerCase().includes(q)) && (!filters.length || matches(r, filters)));
  const byLevel = {};
  for (const r of visible) (byLevel[r.level] ||= []).push(r);
  const levels = Object.keys(byLevel)
    .map(Number)
    .sort((a, b) => a - b);
  const preparedCount = rows.filter((r) => r.level > 0 && r.prepared && r.reached).length;
  const groups = filterGroups(rows, ch);
  const toggleFilter = (t) => setFilters((f) => (f.includes(t) ? f.filter((x) => x !== t) : [...f, t]));

  const cardOf = (r) => ({ ...r.spell, _sheet: true, _key: r.key, _own: r.own });

  // The player's own catalogue entry a spell copy comes from (saving updates it).
  const homebrewOf = (r) => {
    const id = r?.spell?.catalogue_id || r?.spell?.id;
    const entry = id ? asList(catalogueSpells).find((c) => c.id === id) : null;
    return entry && entry.visibility && entry.created_by === userName ? { id: entry.id, name: entry.name, visibility: entry.visibility } : null;
  };

  // A spell of your own counts toward the casting class that has it (or the first).
  const ownGranted = (rec) => {
    const cls = classFor(ch, rec);
    return cls ? { how: "known", class: cls } : { how: "known" };
  };

  // The spell form's save: the copy only, or the catalogue too.
  const submit = async (record, { catalogue: toCatalogue, asNew }) => {
    const r = form?.row;
    const current = r ? asList(latest().layers).find((l) => l?.from === r.from)?.spells?.find((s) => s?.id === r.spell.id) || r.spell : null;
    if (!toCatalogue) {
      if (r) now(replaceSpell(latest(), r.from, editedSpell(current, record)));
      else now(addOwnSpell(latest(), { ...spellRecord(record), id: `own-${Math.random().toString(36).slice(2, 10)}`, granted: ownGranted(record) }));
      return;
    }
    const target = r ? homebrewOf(r) : null;
    const entry = { ...spellRecord(record), visibility: record.visibility || "private" };
    delete entry.id;
    const saved = target && !asNew ? await updateSpell(target.id, { ...entry, id: target.id }) : await createSpell(entry);
    if (r) now(replaceSpell(latest(), r.from, savedSpell(current, saved)));
    else now(addOwnSpell(latest(), { ...spellRecord(saved), id: saved.id, catalogue_id: saved.id, granted: ownGranted(saved) }));
  };

  return (
    <ParchmentSheet>
      <Title
        after={
          <span className={`text-sm italic ${INK.faded}`}>
            {rows.length} spells · {preparedCount} prepared
          </span>
        }
        right={<InkText value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search…" aria-label="Search spells" className="h-7 w-32 text-sm" />}
      >
        Spellbook
      </Title>

      <div className="space-y-8">
        {/* 1. Spellcasting */}
        <DefineSection title="Spellcasting" storageKey="define.spellbook.casting">
          <div className="space-y-1.5">
            {limits.map((lim) => {
              const cast = d.spellcasting.find((s) => s.owner === lim.classId);
              return (
                <div key={lim.classId} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[15px] font-semibold">{lim.name}</span>
                  {cast && <span className={`text-[10px] uppercase tracking-wider ${INK.faint}`}>{cast.ability}</span>}
                  <Leader />
                  {cast && (
                    <span className="text-sm">
                      <span className="font-semibold">{signed(cast.attack)}</span> · DC <span className="font-semibold">{cast.dc}</span>
                    </span>
                  )}
                  {[
                    ["cantrips", "cantrips", lim.cantripCount, lim.cantrips, lim.book_cantrips],
                    ["spells", "prepared", lim.prepared, lim.spells, lim.book_spells],
                  ].map(([kind, word, count, max, book]) =>
                    max == null && book == null ? null : (
                      <span key={kind} className={`ml-3 inline-flex items-baseline gap-1 text-xs italic ${max != null && count > max ? INK.rubric : INK.faded}`} title={`The book says ${book ?? "—"}. Write your own number to change it.`}>
                        {word} {count} of
                        <InkNumber
                          value={max}
                          min={0}
                          placeholder={book == null ? "—" : String(book)}
                          onChange={(v) => now(setPreparedOverride(ch, lim.classId, kind, v == null || v === book ? null : v))}
                          aria-label={`${lim.name} ${word} number`}
                          className="h-6 w-8 text-xs not-italic"
                        />
                      </span>
                    )
                  )}
                </div>
              );
            })}
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[15px]" title="For spells that don't come with a class, and for any character">
                Your own
              </span>
              <Segmented size="sm" options={abilityOptions} value={manualOf(ch).spell_ability || ""} onChange={(v) => now(setOwnSpellAbility(ch, v))} />
              <Leader />
              {(() => {
                const own = d.spellcasting.find((s) => s.owner === "manual");
                return own ? (
                  <span className="text-sm">
                    <span className="font-semibold">{signed(own.attack)}</span> · DC <span className="font-semibold">{own.dc}</span>
                  </span>
                ) : (
                  <span className={`text-xs italic ${INK.faint}`}>—</span>
                );
              })()}
            </div>
          </div>
        </DefineSection>

        {/* 2. Spells */}
        <DefineSection
          title="Spells"
          count={rows.length}
          storageKey="define.spellbook.spells"
          actions={(setOpen) => (
            <span className="flex items-baseline gap-4">
              <InkButton onClick={() => setFiltersOpen((v) => !v)} active={filtersOpen || filters.length > 0}>
                filters{filters.length ? ` (${filters.length})` : ""}
              </InkButton>
              <button
                type="button"
                onClick={() => {
                  setOpen(true);
                  setPicking((v) => !v);
                }}
                className={addBtn}
              >
                + from the catalogue
              </button>
              <button type="button" onClick={() => setForm({ row: null })} className={addBtn}>
                + your own
              </button>
            </span>
          )}
        >
          {notice && (
            <p className={`mb-3 text-sm italic ${INK.rubric}`}>
              {notice}{" "}
              <button type="button" onClick={() => setNotice(null)} className={ghostBtn}>
                ok
              </button>
            </p>
          )}
          {picking && (
            <div className="mb-5">
              <SpellPicker have={have} onAdd={(s) => now(addSpell(ch, s, room))} onView={(s) => openPopup("spell", s)} onClose={() => setPicking(false)} />
            </div>
          )}

          {(filtersOpen || filters.length > 0 || levels.length > 1) && rows.length > 0 && (
            <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              {filters.length > 0 && (
                <>
                  <span className={`text-[11px] italic ${INK.faint}`}>
                    showing {visible.length} of {rows.length}
                  </span>
                  <button type="button" onClick={() => setFilters([])} className={ghostBtn}>
                    clear filters
                  </button>
                </>
              )}
              {levels.length > 1 && (
                <span className="ml-auto flex gap-4">
                  <button type="button" onClick={() => setClosed([])} className={ghostBtn}>
                    open all
                  </button>
                  <button type="button" onClick={() => setClosed(levels)} className={ghostBtn}>
                    fold all
                  </button>
                </span>
              )}
            </div>
          )}
          {filtersOpen && rows.length > 0 && (
            <div className="mb-4 space-y-1 border-l border-rule/30 pl-3">
              {groups.map((g) => (
                <div key={g.group} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className={`w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] ${INK.faded}`}>{g.label}</span>
                  {g.options.map((o) => {
                    const t = `${g.group}:${o.value}`;
                    return (
                      <button key={t} type="button" onClick={() => toggleFilter(t)} className={chipBtn(filters.includes(t))}>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {rows.length === 0 ? (
            <Hint>No spells yet: add them from the catalogue, or make your own.</Hint>
          ) : visible.length === 0 ? (
            <Hint>No spells match.</Hint>
          ) : (
            <div className="space-y-3">
              {levels.map((lvl) => {
                const open = !closed.includes(lvl);
                const list = byLevel[lvl];
                const prepared = list.filter((r) => r.prepared && r.mode === "slots").length;
                return (
                  <div key={lvl}>
                    <button
                      type="button"
                      onClick={() => setClosed((c) => (c.includes(lvl) ? c.filter((x) => x !== lvl) : [...c, lvl]))}
                      aria-expanded={open}
                      className="group mb-1 flex w-full items-baseline gap-1.5 text-left"
                    >
                      <span className="self-center">
                        <Chevron open={open} />
                      </span>
                      <span className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${INK.rubric} group-hover:underline group-hover:decoration-dotted`}>{spellLevelTitle(lvl)}</span>
                      <span className={`text-[11px] ${INK.faint}`}>
                        {list.length}
                        {prepared !== list.length ? ` · ${prepared} prepared` : ""}
                      </span>
                    </button>
                    {open && (
                      <div className="grid grid-cols-1 items-start gap-x-10 @5xl:grid-cols-2">
                        {list.map((r) => {
                          const isOpen = openKey === r.key;
                          return (
                            <div key={r.key} className={isOpen ? "col-span-full" : ""}>
                              <SpellLine
                                r={r}
                                open={isOpen}
                                onToggle={() => setOpenKey(isOpen ? null : r.key)}
                                onView={() => openPopup("spell", cardOf(r))}
                                onPrepare={(v) => prepare(r, v)}
                                onPlay={(v) => now(setSpellInPlay(ch, r.from, r.spell, v))}
                                onRemove={() => {
                                  now(r.own ? removeSpell(ch, r.spell.id) : setSpellRemoved(ch, r.from, r.spell.id, true));
                                  if (isOpen) setOpenKey(null);
                                }}
                              />
                              {isOpen && (
                                <SpellDetail
                                  r={r}
                                  classes={classes}
                                  onClass={(cid) => cid !== r.counts && now(placed(r, setSpellClass(ch, r.from, r.spell, cid), cid))}
                                  onOn={(v) => now(setSpellOn(ch, r.from, r.spell, v))}
                                  onPlay={(v) => now(setSpellInPlay(ch, r.from, r.spell, v))}
                                  onCast={(mode, max, reset) => {
                                    const patch = setCastMode(ch, r.from, r.spell, mode, max, reset);
                                    if (mode !== "slots" || r.mode === "slots") return now(patch);
                                    const g = patch.layers.find((l) => l.from === r.from)?.spells.find((x) => x?.id === r.spell.id)?.granted;
                                    now(placed(r, patch, g?.class));
                                  }}
                                  onAbility={(ab) => now(setSpellAbility(ch, r.from, r.spell, ab))}
                                  onNote={(notes) => patchChar(patchSpell(ch, r.from, r.spell.id, { notes }))}
                                  onEdit={() => setForm({ row: r })}
                                  onRestore={() => now(replaceSpell(ch, r.from, restoredSpell(r.spell)))}
                                  onDone={() => setOpenKey(null)}
                                  onRemove={() => {
                                    now(r.own ? removeSpell(ch, r.spell.id) : setSpellRemoved(ch, r.from, r.spell.id, true));
                                    setOpenKey(null);
                                  }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              <p className={`text-xs italic ${INK.faint}`}>
                ◆ = prepared (at will and free casts: shown in Play) · innate and at-will spells are always prepared · click a name for its card · ⋯ for how it's ready, its ability, your note and editing · ✕ removes it · M* = a material with a cost (hover it)
              </p>
            </div>
          )}
        </DefineSection>

        {/* 3. Invocations & metamagic */}
        <DefineSection
          title="Invocations & Metamagic"
          count={options.length}
          storageKey="define.spellbook.options"
          actions={(setOpen) => (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setPickingOptions((v) => !v);
              }}
              className={addBtn}
            >
              + from the catalogue
            </button>
          )}
        >
          {pickingOptions && (
            <div className="mb-5">
              <OptionPicker
                title="Invocations & metamagic from the catalogue"
                types={[
                  { id: "eldritch_invocation", label: "Invocations" },
                  { id: "metamagic", label: "Metamagic" },
                  { id: "pact_boon", label: "Pact boons" },
                ]}
                have={haveOptions}
                onAdd={(o) => now(addOwnFeature(ch, optionalFeatureCopy(o)))}
                onView={(o) => openPopup("optionalFeature", o)}
                onClose={() => setPickingOptions(false)}
              />
            </div>
          )}
          <FeatureList
            rows={options}
            ch={ch}
            d={d}
            patchChar={patchChar}
            openKey={optionKey}
            setOpenKey={setOptionKey}
            restorable={false}
            empty="None yet: your class levels pick them (a Warlock's invocations, a Sorcerer's metamagic), or add them from the catalogue."
          />
        </DefineSection>
      </div>

      <SpellCardForm
        open={!!form}
        onClose={() => setForm(null)}
        editingSpell={form?.row ? { ...spellRecord(form.row.spell), visibility: homebrewOf(form.row)?.visibility } : null}
        sheet={{ onSubmit: submit, homebrew: form?.row ? homebrewOf(form.row) : null }}
      />
    </ParchmentSheet>
  );
}
