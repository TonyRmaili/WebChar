import React, { useContext, useMemo, useState } from "react";
import { DefineSection, Segmented } from "../../styles/parchmentForm";
import {
  chip, fieldCls, hintCls, labelCls, textareaCls, removeRowCls, addRowCls, ChipsHeading,
  RowTag, rowCls, rowNameCls, PartPopup,
} from "./catalogueStyle";
import FilterSection from "./FilterSection";
import RowContextMenu from "./RowContextMenu";
import {
  parseText, parseInline, describeGrants, describeChoice, describeFeature,
  labelFromId, isGroup, GROUP_LABELS, nameFromId, toggleIn, formatCurrency, numOrNull,
  formatSource, isHomebrew, isOwner, ABILITIES, ABILITY_SHORT, SKILL_IDS, TOOLS, LANGUAGES,
  POOL_GROUPS, FEAT_CATEGORIES, CLASS_IDS, SPELL_SCHOOLS, DAMAGE_TYPES, CONDITIONS, SPEED_MODES, SENSES,
  valueFromText, textFromValue, CATEGORY_LABELS, plural, describeConsumes,
  SPELL_READY, FREE_CAST_RESETS, spellReady, spellReadyGrant,
  MOD_TARGET_GROUPS, MOD_TARGET_LABELS, MOD_HOW, MOD_REQUIRES, modHow, ABILITY_TARGET,
  AUTO_ABILITY, hitParts, hitFormula, damageBonusParts, damageBonusFormula, WEAPON_IDS, ARMOR_TRAINING, DAMAGE_MODS,
  dcParts, dcFormula, FORMULA_TERMS, parseFormula, buildFormula, ROLL_TARGET,
  formatModifier, usesSummary, actionSummary, grantsSummary, toggleSummary, picksSummary,
  attackWords, saveWords, auraWords, riderWords, riderOf, RIDER_ON, healWords, rangeWords, AREA_SHAPES, parseRange, buildRange, parseArea, buildArea,
  parseHeal, buildHeal,
} from "./catalogueHelpers";
import { BONUS_SETS, emptySpellPool, emptyPrereqGroup, emptyOption, optionLabel } from "./catalogueForms";

/* ═══════════════════════════════════════════════════════════════════
   catalogueParts — the pieces every catalogue page shares, now that
   every category uses the same data shapes.

   Lists:
     <CatalogueRow entry meta>   one entry: name · meta · source (or
                                 public / private for homebrew)
     useEntryMenu()              the right-click menu: copy, and for your
                                 own homebrew edit / delete

   Cards:
     <RichText text>             an entry's `text` (markdown-lite)
     <CardHeader entry>          name · source · edition
     <MechanicsRows entry>       grants, choices and features, as the
                                 builder will read them
     <MechanicsSection entry>    the same under a "What it gives" fold

   Create / edit forms (the record ↔ form conversion is catalogueForms.js):
     <BasicsSection>             name · edition · visibility
     <DescriptionSection>        the text, with the markdown-lite hint
     <GrantsEditor>              traits (ability bonuses, speed, senses,
                                 resistances), ability scores, feats,
                                 proficiencies, equipment, spells — fixed
                                 and by choice
     <PrerequisitesEditor>       alternative groups of requirements
     <KeptSection>               what the form has no field for
     <ActionEditor>              an action's numbers: attack roll, saving
                                 throw, damage; for spells also healing and
                                 per-slot upcasting
     <FeaturesEditor>            a plain list of features (spells, class
                                 features), each with an ActionEditor
     <BundleOptionsEditor>       a "choose A / B / C" pick of items and gold
     <ChipToggles> <FoldChips> <EntryPicker> <PoolEditor> <ItemsEditor>
     <CurrencyEditor>            the smaller pieces the ones above use
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Text ───────────────────────────────────────────────────────── */

export function Inline({ text }) {
  return parseInline(text).map((r, i) =>
    r.bold ? <strong key={i} className="font-semibold">{r.text}</strong>
    : r.italic ? <em key={i}>{r.text}</em>
    : <React.Fragment key={i}>{r.text}</React.Fragment>
  );
}

const Lead = ({ lead }) =>
  lead ? <strong className="font-semibold italic">{/[.:?!]$/.test(lead) ? lead : `${lead}.`} </strong> : null;

export function RichText({ text, className = "" }) {
  const blocks = useMemo(() => parseText(text), [text]);
  if (!blocks.length) return null;
  return (
    <div className={`space-y-2 text-[15px] leading-relaxed text-ink ${className}`}>
      {blocks.map((b, i) => {
        if (b.type === "heading") return <h3 key={i} className="mt-3 text-base font-semibold">{b.text}</h3>;
        if (b.type === "table") return <TextTable key={i} block={b} />;
        if (b.type === "list") {
          return (
            <ul key={i} className="space-y-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-1.5" style={{ paddingLeft: `${it.depth * 1.25}rem` }}>
                  <span className="text-ink-faint">•</span>
                  <span><Lead lead={it.lead} /><Inline text={it.text} /></span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={i}><Lead lead={b.lead} /><Inline text={b.text} /></p>;
      })}
    </div>
  );
}

function TextTable({ block }) {
  return (
    <div className="my-2">
      {block.caption && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-faded"><Inline text={block.caption} /></div>}
      <table className="w-full border-y border-rule/40 text-sm">
        {block.header && (
          <thead className="border-b border-rule/40">
            <tr>{block.header.map((c, i) => <th key={i} className="px-2 py-1 text-left font-semibold text-ink-faded"><Inline text={c} /></th>)}</tr>
          </thead>
        )}
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i} className="border-t border-rule/20 even:bg-ink/[0.03]">
              {row.map((cell, j) => <td key={j} className="px-2 py-1 align-top"><Inline text={cell} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Card pieces ────────────────────────────────────────────────── */

export function CardHeader({ entry, subtitle }) {
  const bits = [entry.source, entry.edition === "one" ? "One" : entry.edition === "classic" ? "Classic" : null].filter(Boolean);
  return (
    <div className="mb-3 border-b border-rule/40 pb-1">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold tracking-wide text-ink">{entry.name}</h2>
        <span className="shrink-0 text-xs text-ink-faded">{bits.join(" · ")}</span>
      </div>
      {subtitle && <p className="text-sm italic text-ink-faded">{subtitle}</p>}
    </div>
  );
}

const Row = ({ label, children }) => (
  <div className="text-sm leading-snug">
    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faded">{label}: </span>
    <span className="text-ink">{children}</span>
  </div>
);

function ChoiceRows({ choices, index, depth = 0 }) {
  return choices.map((c, i) => {
    const d = describeChoice(c, index);
    if (!d) return null;
    return (
      <div key={`${c.id || i}`} style={{ paddingLeft: `${depth}rem` }}>
        <Row label={d.label}>{d.value}</Row>
        {d.options?.map((o, j) => (
          <div key={j} className="border-l border-rule/30 pl-3" style={{ marginLeft: `${depth + 0.25}rem` }}>
            <div className="text-sm italic text-ink">{o.label}</div>
            {o.rows.map((r) => <Row key={r.label} label={r.label}>{r.value}</Row>)}
            {o.choices.map((oc, k) => (
              <Row key={k} label={oc.label}>{oc.value}</Row>
            ))}
          </div>
        ))}
      </div>
    );
  });
}

export const hasMechanics = (entry) =>
  !!(describeGrants(entry?.grants).length || entry?.choices?.length || entry?.features?.length);

// An entry's grants, choices and features, the way the builder reads them.
export function MechanicsRows({ entry, index }) {
  const rows = describeGrants(entry?.grants, index);
  const choices = entry?.choices || [];
  const features = entry?.features || [];
  return (
    <div className="space-y-1">
      {rows.map((r) => <Row key={r.label} label={r.label}>{r.value}</Row>)}
      <ChoiceRows choices={choices} index={index} />
      {features.length > 0 && (
        <Row label="Features">
          {features.map((f, i) => {
            const words = describeFeature(f);
            return (
              <React.Fragment key={f.id || i}>
                {i > 0 && " · "}
                <span className="italic">{f.name}</span>
                {words.length > 0 && <span className="text-ink-faded"> ({words.join(", ")})</span>}
              </React.Fragment>
            );
          })}
        </Row>
      )}
    </div>
  );
}

/* "What it gives" under a fold; the open/closed state is remembered. */
export function MechanicsSection({ entry, index, title = "What it gives", storageKey = "catalogue.mechanics" }) {
  if (!hasMechanics(entry)) return null;
  return (
    <div className="mt-5">
      <DefineSection title={title} storageKey={storageKey} defaultOpen>
        <MechanicsRows entry={entry} index={index} />
      </DefineSection>
    </div>
  );
}

/* ─── Lists ──────────────────────────────────────────────────────── */

/* One entry in a catalogue list: name · meta (a short italic note) ·
   source, or Public / Private for homebrew. Right-click for its menu. */
export function CatalogueRow({ entry, meta, onOpen, onContextMenu }) {
  if (!entry) return null;
  const handleContext = (e) => {
    if (!onContextMenu) return;
    e.preventDefault();
    onContextMenu(e, entry);
  };
  return (
    <button type="button" onClick={() => onOpen(entry)} onContextMenu={handleContext} className={rowCls}>
      <span className={rowNameCls}>{entry.name || "Unnamed"}</span>
      {meta && (
        <span className="hidden max-w-[180px] truncate text-xs italic text-ink-faded sm:inline" title={meta}>
          {meta}
        </span>
      )}
      {isHomebrew(entry) ? (
        <RowTag className={entry.visibility === "public" ? "!text-good" : "!text-info"}>
          {entry.visibility === "public" ? "Public" : "Private"}
        </RowTag>
      ) : (
        entry.source && <RowTag title={formatSource(entry.source)}>{entry.source}</RowTag>
      )}
    </button>
  );
}

/* The right-click menu of a list row: Copy for every entry; Edit and
   Delete for your own homebrew.
     const [openMenu, menu] = useEntryMenu({ user, onCopy, onEdit, onDelete });
     <CatalogueRow onContextMenu={openMenu} /> … {menu} */
export function useEntryMenu({ user, onCopy, onEdit, onDelete }) {
  const [at, setAt] = useState(null);
  const openMenu = (e, entry) => {
    const items = [{ label: "Copy", onClick: () => onCopy(entry) }];
    if (isOwner(entry, user)) {
      items.push({ label: "Edit", onClick: () => onEdit(entry) });
      items.push({
        label: "Delete",
        danger: true,
        onClick: async () => {
          if (!window.confirm(`Delete "${entry.name}"? This cannot be undone.`)) return;
          try {
            await onDelete(entry.id);
          } catch (err) {
            alert(`Delete failed: ${err.message}`);
          }
        },
      });
    }
    setAt({ x: e.clientX, y: e.clientY, items });
  };
  const menu = at ? <RowContextMenu x={at.x} y={at.y} items={at.items} onClose={() => setAt(null)} /> : null;
  return [openMenu, menu];
}

/* ─── Form pieces ────────────────────────────────────────────────── */

// A row of words to switch on and off.
/* In a filter window (FilterChips.Provider value = true) a chip has three
   states: off → picked (blue: show these) → turned away (red: hide these)
   → off. "!value" in `selected` is a turned-away one (passesAny). */
export const FilterChips = React.createContext(false);
const triChip = (state) =>
  `text-xs italic text-left transition ${
    state === "on" ? "text-blue-800 underline decoration-dotted underline-offset-4"
    : state === "not" ? "text-red-700 line-through decoration-red-700/70"
    : "text-ink-faded hover:text-ink"
  }`;
export function ChipToggles({ options, selected, onToggle, labelOf = labelFromId, className = "" }) {
  const tri = useContext(FilterChips);
  const list = selected || [];
  const stateOf = (o) => (list.includes(o) ? "on" : tri && list.includes(`!${o}`) ? "not" : "off");
  // one click at a time: picked → turned away is two changes (take it out, put "!" it in)
  const click = (o) => {
    if (!tri) return onToggle(o);
    const s = stateOf(o);
    if (s === "off") onToggle(o);
    else if (s === "on") {
      onToggle(o);
      onToggle(`!${o}`);
    } else onToggle(`!${o}`);
  };
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1.5 ${className}`}>
      {options.map((o) => {
        const s = stateOf(o);
        return (
          <button key={o} type="button" onClick={() => click(o)} className={tri ? triChip(s) : chip(s === "on")}
                  title={tri ? (s === "off" ? "Show only these" : s === "on" ? "Click again to hide these instead" : "Hidden: click to clear") : undefined}>
            {tri && s === "not" ? "not " : ""}
            {labelOf(o)}
          </button>
        );
      })}
    </div>
  );
}

// A long list of words behind a fold-out heading ("▶ Choose from (3)").
export function FoldChips({ label, options, selected, onToggle, labelOf = labelFromId, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <ChipsHeading open={open} onToggle={() => setOpen((o) => !o)} label={label} count={(selected || []).length} />
      {open && (
        <ChipToggles options={options} selected={selected} onToggle={onToggle} labelOf={labelOf}
                     className="mb-2 border-l border-rule/30 pl-3" />
      )}
    </div>
  );
}

/* Search a catalogue list and pick entries by id.
   selected: ids; onToggle(id). entries: the catalogue list. */
// clearOnPick: the search empties once an entry is picked.
/* Search a catalogue and pick. A pick clears the search (what's picked
   shows as chips above); ✕ closes the results without picking.
   clearOnPick = false keeps the results open for several picks. */
export function EntryPicker({ entries, selected, onToggle, placeholder = "search…", index, max = 40, clearOnPick = true }) {
  const [query, setQuery] = useState("");
  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (entries || []).filter((e) => e?.name?.toLowerCase().includes(q)).slice(0, max);
  }, [query, entries, max]);
  return (
    <div>
      {selected?.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          {selected.map((id, i) => (
            <button key={`${id}-${i}`} type="button" onClick={() => onToggle(id)} className={chip(true)} title="Remove">
              {nameFromId(id, index)} <span aria-hidden className="text-ink-faded">✕</span>
            </button>
          ))}
        </div>
      )}
      <div className="mb-1 flex items-baseline gap-2">
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
               placeholder={entries?.length ? placeholder : "loading…"} className={`${fieldCls} flex-1`} />
        {query && (
          <button type="button" onClick={() => setQuery("")} className={removeRowCls} aria-label="Close the search" title="Close the search">✕</button>
        )}
      </div>
      {query && (
        <div className="flex max-h-32 flex-wrap gap-x-4 gap-y-1 overflow-y-auto pr-1">
          {found.map((e) => {
            const id = e.id;
            return (
              <button key={id} type="button" onClick={() => { onToggle(id); if (clearOnPick) setQuery(""); }} className={chip(selected?.includes(id))}>
                {e.name} <span className="text-[10px] uppercase text-ink-faint">{e.source}</span>
              </button>
            );
          })}
          {found.length === 0 && <span className={hintCls}>No matches.</span>}
        </div>
      )}
    </div>
  );
}

/* Fixed ids + an optional "choose N from" pool, for skills, tools and
   languages. value: { fixed: [ids], from: [ids or group ids], count }. */
export function PoolEditor({ label, options, groups = [], value, onChange }) {
  const v = value || { fixed: [], from: [], count: 1 };
  const set = (patch) => onChange({ ...v, ...patch });
  const fromOptions = [...groups, ...options];
  const groupLabel = (id) => (isGroup(id) ? `${GROUP_LABELS[id].name} (any)` : labelFromId(id));
  return (
    <div className="space-y-1 border-l border-rule/30 pl-3">
      <div className={labelCls}>{label}</div>
      <FoldChips label="Always" options={options} selected={v.fixed} onToggle={(id) => set({ fixed: toggleIn(v.fixed, id) })} />
      <FoldChips label="Choose from" options={fromOptions} selected={v.from} labelOf={groupLabel}
                 onToggle={(id) => set({ from: toggleIn(v.from, id) })} />
      {v.from?.length > 0 && (
        <div className="flex items-baseline gap-3">
          <span className={`${labelCls} !mb-0`}>How many</span>
          <input type="number" min={1} value={v.count ?? 1} onChange={(e) => set({ count: numOrNull(e.target.value) ?? 1 })}
                 className={`${fieldCls} max-w-[70px]`} />
        </div>
      )}
    </div>
  );
}

// gp / sp / cp blanks. value: { gp, sp, cp }.
export function CurrencyEditor({ value, onChange, coins = ["gp", "sp", "cp"] }) {
  const v = value || {};
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      {coins.map((k) => (
        <label key={k} className="flex items-baseline gap-1.5">
          <input type="number" min={0} value={v[k] ?? ""} placeholder="—"
                 onChange={(e) => onChange({ ...v, [k]: numOrNull(e.target.value) })}
                 className={`${fieldCls} !w-16`} />
          <span className="text-xs uppercase text-ink-faded">{k}</span>
        </label>
      ))}
    </div>
  );
}

/* Item grants: [{ item, name, qty, contains, worth }].
   Add from the catalogue (`entries`) or as free text. */
export function ItemsEditor({ items, onChange, entries, index }) {
  const list = items || [];
  const [freeText, setFreeText] = useState("");
  const update = (i, patch) => onChange(list.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const remove = (i) => onChange(list.filter((_, j) => j !== i));
  const addFree = () => {
    const name = freeText.trim();
    if (!name) return;
    onChange([...list, { name, qty: 1 }]);
    setFreeText("");
  };
  return (
    <div className="space-y-2">
      {list.length === 0 && <p className={hintCls}>No items.</p>}
      {list.map((it, i) => (
        <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <input type="number" min={1} value={it.qty ?? 1} onChange={(e) => update(i, { qty: numOrNull(e.target.value) ?? 1 })}
                 className={`${fieldCls} !w-12`} aria-label="Quantity" />
          <input type="text" value={it.name ?? ""} placeholder={it.item ? nameFromId(it.item, index) : "item name"}
                 onChange={(e) => update(i, { name: e.target.value || null })}
                 className={`${fieldCls} min-w-[10rem] flex-1`} aria-label="Shown name" />
          <span className="text-[10px] uppercase tracking-wider text-ink-faint">{it.item ? "catalogue" : "text"}</span>
          {it.contains && <span className="text-xs italic text-ink-faded">with {formatCurrency(it.contains)}</span>}
          {it.worth && <span className="text-xs italic text-ink-faded">worth {formatCurrency(it.worth)}</span>}
          <button type="button" onClick={() => remove(i)} className={removeRowCls} aria-label="Remove">✕</button>
        </div>
      ))}
      <EntryPicker entries={entries} selected={[]} index={index} placeholder="add from the item catalogue…"
                   onToggle={(id) => onChange([...list, { item: id, qty: 1 }])} />
      <div className="flex items-baseline gap-3">
        <input type="text" value={freeText} onChange={(e) => setFreeText(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFree())}
               placeholder="…or an item that isn't in the catalogue" className={`${fieldCls} flex-1`} />
        <button type="button" onClick={addFree} className={addRowCls}>+ add</button>
      </div>
    </div>
  );
}

// A pick-one row (re-exported so forms import their pieces from one place).
export { Segmented };

// "Classic" · "One" words for a form.
export const EDITION_OPTIONS = [
  { value: "one", label: "One (2024)" },
  { value: "classic", label: "Classic (2014)" },
];

export const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private" },
  { value: "public", label: "Public" },
];

/* ─── Form sections ──────────────────────────────────────────────── */

// Name (required) · edition · visibility. form: the header form.
/* Name, edition, visibility (+ children). edition = false: no edition
   pick (a class is always "one"; a subclass takes its class's). */
export function BasicsSection({ form, set, nameError, namePlaceholder = "", edition = true, children }) {
  return (
    <FilterSection title="Basics">
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Name <span className="text-rubric">*</span></label>
          <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={namePlaceholder}
                 className={`${fieldCls} ${nameError ? "!border-solid !border-bad" : ""}`} />
          {nameError && <p className="mt-1 text-xs italic text-bad">Name is required.</p>}
        </div>
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          {edition && (
            <div>
              <div className={labelCls}>Edition</div>
              <Segmented options={EDITION_OPTIONS} value={form.edition} onChange={(v) => set("edition", v)} />
            </div>
          )}
          <div>
            <div className={labelCls}>Visibility</div>
            <Segmented options={VISIBILITY_OPTIONS} value={form.visibility} onChange={(v) => set("visibility", v)} />
          </div>
        </div>
        {children}
      </div>
    </FilterSection>
  );
}

export const TEXT_HINT = (
  <>
    A blank line between paragraphs · <code>**Name.** text</code> starts a named feature · <code>- item</code> lists ·
    tables as <code>a | b</code> rows with <code>--- | ---</code> under the header.
  </>
);

// A text box; how to format the text (paragraphs, **Name.**, lists, tables) is behind the ⓘ in its corner.
export function TextField({ value, onChange, placeholder, rows = 8 }) {
  const [help, setHelp] = useState(false);
  return (
    <div>
      <div className="relative">
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={`${textareaCls} pr-7`} placeholder={placeholder} />
        <button type="button" onClick={() => setHelp((v) => !v)} aria-expanded={help} title="How to format the text"
                className={`absolute right-2 top-1.5 text-sm leading-none ${help ? "text-rubric" : "text-ink-faint"} hover:text-rubric`}>
          ⓘ
        </button>
      </div>
      {help && <p className={`${hintCls} mt-1`}>{TEXT_HINT}</p>}
    </div>
  );
}

export function DescriptionSection({ value, onChange, placeholder }) {
  return (
    <FilterSection title="Description">
      <TextField value={value} onChange={onChange} placeholder={placeholder} />
    </FilterSection>
  );
}

/* How a granted spell is ready: innate (free casts optional) · at will ·
   ritual only · on your spell list. value: the grant or pick ({ how,
   uses, … }); onChange gets { how, uses } to merge in. */
// cantrip: always ready anyway, so only innate (no free casts) or on your spell list.
function SpellReadyEditor({ value, onChange, cantrip = false }) {
  const r = spellReady(value);
  const write = (p) => onChange(spellReadyGrant({ ...r, ...p }));
  const options = cantrip ? SPELL_READY.filter((o) => o.value === "innate" || o.value === "list") : SPELL_READY;
  return (
    <>
      <Segmented size="sm" options={options} value={r.ready} onChange={(ready) => write({ ready, max: cantrip ? null : r.max })} />
      {r.ready === "innate" && !cantrip && (
        <span className="flex flex-wrap items-baseline gap-2" title="Free casts are optional: leave it empty for none (a number or a formula, like pb)">
          <FormulaField value={r.max} onChange={(max) => write({ max })} placeholder="—" label="Free casts" />
          <span className="text-xs italic text-ink-faded">free casts</span>
          {r.max != null && <Segmented size="sm" options={FREE_CAST_RESETS} value={r.reset} onChange={(reset) => write({ reset })} />}
        </span>
      )}
    </>
  );
}

// Merges a { how, uses } change into a grant, dropping uses when there are none.
const withReady = (g, p) => {
  const out = { ...g, ...p };
  if (out.uses === undefined) delete out.uses;
  return out;
};

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// One "choose N spells of …" pick.
function SpellPoolEditor({ value, onChange, onRemove }) {
  const v = value;
  const set = (p) => onChange({ ...v, ...p });
  return (
    <div className="space-y-1.5 border-l border-rule/30 pl-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm">Choose</span>
        <input type="number" min={1} value={v.count} onChange={(e) => set({ count: numOrNull(e.target.value) ?? 1 })}
               className={`${fieldCls} !w-12`} aria-label="How many spells" />
        <span className="text-sm">spells, then they are</span>
        <SpellReadyEditor value={v} onChange={(p) => onChange(withReady(v, p))} cantrip={(v.levels || []).length > 0 && v.levels.every((l) => l === 0)} />
        <span className="flex-1" />
        <button type="button" onClick={onRemove} className={removeRowCls} aria-label="Remove this pick">✕</button>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className={`${labelCls} !mb-0`}>Level</span>
        <ChipToggles options={LEVELS} selected={v.levels} labelOf={(l) => (l === 0 ? "Cantrip" : String(l))}
                     onToggle={(l) => set({ levels: toggleIn(v.levels, l) })} />
      </div>
      <FoldChips label="From these class lists (none = any)" options={CLASS_IDS} selected={v.classes}
                 onToggle={(c) => set({ classes: toggleIn(v.classes, c) })} />
      <FoldChips label="Of these schools (none = any)" options={SPELL_SCHOOLS} selected={v.schools}
                 onToggle={(c) => set({ schools: toggleIn(v.schools, c) })} />
      <div className="flex flex-wrap gap-x-6">
        <label className="flex items-baseline gap-2 text-sm">
          <input type="checkbox" checked={v.ritual} onChange={(e) => set({ ritual: e.target.checked })} className="accent-rubric" />
          only spells with the ritual tag
        </label>
      </div>
    </div>
  );
}

const SECTIONS_ALL = ["ability", "feats", "proficiencies", "equipment", "spells"];

// A row of small number blanks: { key: number }. An empty blank removes the key.
// allowWalk: a "= walk" word per row for speeds equal to the walking speed.
/* step: speeds and senses go by 5 ft. (arrows, mouse wheel), and a typed
   number is rounded to the nearest 5 when the field is left (14 → 15). */
function NumberMap({ keys, value, onChange, labelOf = labelFromId, unit = "", allowWalk = false, signed = false, step = 1 }) {
  const v = value || {};
  const setKey = (k, n) => {
    const next = { ...v };
    if (n == null || n === 0) delete next[k];
    else next[k] = n;
    onChange(next);
  };
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
      {keys.map((k) => (
        <label key={k} className="flex items-baseline gap-1.5">
          <span className="text-xs text-ink-faded">{labelOf(k)}</span>
          {allowWalk && v[k] === "walk" ? (
            <button type="button" onClick={() => setKey(k, null)} className={chip(true)} title="Equal to the walking speed — click to clear">
              = walk
            </button>
          ) : (
            <input type="number" value={typeof v[k] === "number" ? v[k] : ""} placeholder="—" step={step}
                   onChange={(e) => setKey(k, numOrNull(e.target.value))} className={`${fieldCls} !w-14`}
                   onBlur={step > 1 ? (e) => { const n = numOrNull(e.target.value); if (n != null && n % step) setKey(k, Math.round(n / step) * step); } : undefined}
                   aria-label={labelOf(k)} min={signed ? undefined : 0} />
          )}
          {unit && v[k] != null && v[k] !== "walk" && <span className="text-xs text-ink-faded">{unit}</span>}
          {allowWalk && k !== "walk" && v[k] == null && (
            <button type="button" onClick={() => setKey(k, "walk")} className={chip(false)} title="Equal to the walking speed">
              = walk
            </button>
          )}
        </label>
      ))}
    </div>
  );
}

/* What an entry gives, fixed and by choice. value / onChange: the grants
   form (catalogueForms.emptyGrantsForm). catalogues: { feats, items,
   spells } lists for the pickers. show: which sections to draw. */
/* What each part of a grants form holds, for a form's tab labels
   ("Spells 2"): traits, ability, feats, proficiencies, spells, equipment, other. */
export function grantsCounts(f, index) {
  if (!f) return {};
  const pools = (k) => (f[k]?.fixed?.length || 0) + (f[k]?.from?.length ? 1 : 0);
  return {
    traits: Object.keys(f.speed || {}).length + Object.keys(f.senses || {}).length + Object.values(f.defenses || {}).reduce((n, l) => n + (l?.length || 0), 0),
    ability: Object.keys(f.abilityFixed || {}).length + (f.ability?.from?.length ? 1 : 0),
    feats: (f.feats?.length || 0) + (f.featPool?.on ? 1 : 0),
    proficiencies: ["skills", "expertise", "tools", "languages", "saves", "weapons", "armor"].reduce((n, k) => n + pools(k), 0),
    spells: (f.spells?.length || 0) + (f.spellPools?.length || 0) + (f.spellAbility?.on ? 1 : 0),
    equipment: (f.items?.length || 0) + Object.keys(f.currency || {}).length,
    other: (f.extraChoices?.length || 0) + describeGrants(f.extraGrants, index).length,
  };
}

// A form's tabs for parts of its grants form: [{ id, label, count }].
const GRANT_TAB_LABELS = { ability: "Ability Scores", traits: "Traits", feats: "Feat", proficiencies: "Proficiencies", equipment: "Equipment", spells: "Spells" };
export const grantTabs = (parts, counts) => parts.map((id) => ({ id, label: GRANT_TAB_LABELS[id], count: counts[id] || 0 }));
export const GRANT_PARTS = Object.keys(GRANT_TAB_LABELS);

/* only: exactly these parts (a form's tab shows one part of the grants);
   without it, `show` plus any part the entry already has. */
/* saves = false: no Saving Throws pick unless the entry has one (a class
   sets its saves of its own). */
export function GrantsEditor({ value, onChange, catalogues = {}, index, show = SECTIONS_ALL, equipmentExtra = null, training = true, only = null, saves = true }) {
  const f = value;
  const set = (key, v) => onChange({ ...f, [key]: v });
  const patch = (key, p) => onChange({ ...f, [key]: { ...f[key], ...p } });
  // Traits show whenever the entry has any, even where the form didn't ask
  // for them, so nothing a record holds is hidden.
  const hasTraits = Object.keys(f.speed).length || Object.keys(f.senses).length || Object.values(f.defenses).some((l) => l.length);
  const hasAbility = Object.keys(f.abilityFixed).length || f.ability.from.length;
  // Always true / false: a bare 0 here would be drawn on the page.
  const has = (k) => !!(only ? only.includes(k) : show.includes(k) || (k === "traits" && hasTraits) || (k === "ability" && hasAbility));
  const spellLevel = useMemo(() => new Map((catalogues.spells || []).map((sp) => [sp.id, sp.level])), [catalogues.spells]);

  return (
    <>
      {has("traits") && (
        <FilterSection title="Traits">
          <div className="space-y-3">
            <div>
              <div className={labelCls}>Speed</div>
              <NumberMap keys={SPEED_MODES} value={f.speed} onChange={(v) => set("speed", v)} unit="ft." allowWalk step={5} />
            </div>
            <div>
              <div className={labelCls}>Senses</div>
              <NumberMap keys={SENSES} value={f.senses} onChange={(v) => set("senses", v)} unit="ft." step={5} />
            </div>
            <div className="space-y-1">
              <FoldChips label="Resistances" options={DAMAGE_TYPES} selected={f.defenses.resist}
                         onToggle={(d) => patch("defenses", { resist: toggleIn(f.defenses.resist, d) })} />
              <FoldChips label="Damage immunities" options={DAMAGE_TYPES} selected={f.defenses.immune}
                         onToggle={(d) => patch("defenses", { immune: toggleIn(f.defenses.immune, d) })} />
              <FoldChips label="Vulnerabilities" options={DAMAGE_TYPES} selected={f.defenses.vulnerable}
                         onToggle={(d) => patch("defenses", { vulnerable: toggleIn(f.defenses.vulnerable, d) })} />
              <FoldChips label="Condition immunities" options={CONDITIONS} selected={f.defenses.condition_immune}
                         onToggle={(d) => patch("defenses", { condition_immune: toggleIn(f.defenses.condition_immune, d) })} />
            </div>
          </div>
        </FilterSection>
      )}

      {has("ability") && (
        <FilterSection title="Ability Scores">
          <div className="space-y-2">
            <div>
              <div className={labelCls}>Always</div>
              <NumberMap keys={ABILITIES} value={f.abilityFixed} onChange={(v) => set("abilityFixed", v)} labelOf={(a) => ABILITY_SHORT[a]} signed />
            </div>
            <div>
              <div className={labelCls}>Or the player raises one of these</div>
              <ChipToggles options={ABILITIES} selected={f.ability.from} labelOf={(a) => ABILITY_SHORT[a]}
                           onToggle={(a) => patch("ability", { from: toggleIn(f.ability.from, a) })} />
            </div>
            <div>
              <div className={labelCls}>By</div>
              <ChipToggles options={Object.keys(BONUS_SETS)} selected={f.ability.sets}
                           labelOf={(k) => k.split("/").map((n) => `+${n}`).join(" / ")}
                           onToggle={(k) => patch("ability", { sets: toggleIn(f.ability.sets, k) })} />
            </div>
            {f.ability.from.length > 0 && !f.ability.sets.length && <p className={hintCls}>Pick at least one bonus, or nothing is raised.</p>}
          </div>
        </FilterSection>
      )}

      {has("feats") && (
        <FilterSection title="Feat">
          <div className="space-y-3">
            <div>
              <EntryPicker entries={catalogues.feats} index={index} placeholder="search feats…"
                           selected={f.feats.map((g) => g.feat)}
                           onToggle={(id) =>
                             set("feats", f.feats.some((g) => g.feat === id) ? f.feats.filter((g) => g.feat !== id) : [...f.feats, { feat: id }])
                           } />
              {f.feats.map((g, i) => (
                <div key={`${g.feat}-${i}`} className="mt-1 flex items-baseline gap-3">
                  <span className="text-sm">{nameFromId(g.feat, index)}</span>
                  <input type="text" value={g.option || ""} placeholder="option (e.g. cleric)"
                         onChange={(e) => set("feats", f.feats.map((x, j) => (j === i ? { ...x, option: e.target.value } : x)))}
                         className={`${fieldCls} max-w-[12rem]`} />
                </div>
              ))}
            </div>
            <div>
              <label className="flex items-baseline gap-2 text-sm">
                <input type="checkbox" checked={f.featPool.on} onChange={(e) => patch("featPool", { on: e.target.checked })} className="accent-rubric" />
                Or the player picks a feat
              </label>
              {f.featPool.on && (
                <div className="mt-1 space-y-1 border-l border-rule/30 pl-3">
                  <div className={labelCls}>Of these categories (none = any feat)</div>
                  <ChipToggles options={Object.keys(FEAT_CATEGORIES)} selected={f.featPool.categories} labelOf={(k) => FEAT_CATEGORIES[k]}
                               onToggle={(k) => patch("featPool", { categories: toggleIn(f.featPool.categories, k) })} />
                </div>
              )}
            </div>
          </div>
        </FilterSection>
      )}

      {has("proficiencies") && (
        <FilterSection title="Proficiencies">
          <div className="space-y-3">
            <PoolEditor label="Skills" options={SKILL_IDS} groups={POOL_GROUPS.skills} value={f.skills} onChange={(v) => set("skills", v)} />
            <PoolEditor label="Expertise" options={SKILL_IDS} groups={POOL_GROUPS.expertise} value={f.expertise} onChange={(v) => set("expertise", v)} />
            <PoolEditor label="Tools" options={TOOLS} groups={POOL_GROUPS.tools} value={f.tools} onChange={(v) => set("tools", v)} />
            <PoolEditor label="Languages" options={LANGUAGES} groups={POOL_GROUPS.languages} value={f.languages} onChange={(v) => set("languages", v)} />
            {(saves || f.saves?.fixed?.length > 0 || f.saves?.from?.length > 0) && (
              <PoolEditor label="Saving Throws" options={ABILITIES} groups={POOL_GROUPS.saves} value={f.saves} onChange={(v) => set("saves", v)} />
            )}
            {training && <PoolEditor label="Weapons" options={[...new Set(["simple_weapons", "martial_weapons", ...WEAPON_IDS, ...(f.weapons?.fixed || [])])]} groups={POOL_GROUPS.weapons}
                        value={f.weapons} onChange={(v) => set("weapons", v)} />}
            {training && <PoolEditor label="Armor" options={[...new Set([...ARMOR_TRAINING, ...(f.armor?.fixed || [])])]} groups={POOL_GROUPS.armor}
                        value={f.armor} onChange={(v) => set("armor", v)} />}
          </div>
        </FilterSection>
      )}

      {has("equipment") && (
        <FilterSection title="Equipment">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className={labelCls}>Always</div>
              <ItemsEditor items={f.items} onChange={(v) => set("items", v)} entries={catalogues.items} index={index} />
              <CurrencyEditor value={f.currency} onChange={(v) => set("currency", v)} />
            </div>
            {equipmentExtra}
          </div>
        </FilterSection>
      )}

      {has("spells") && (
        <FilterSection title="Spells">
          <div className="space-y-3">
            <div className="space-y-2">
              <div className={labelCls}>These spells</div>
              <EntryPicker entries={catalogues.spells} index={index} placeholder="search spells…"
                           selected={f.spells.map((sp) => sp.spell)}
                           onToggle={(id) =>
                             set("spells", f.spells.some((sp) => sp.spell === id) ? f.spells.filter((sp) => sp.spell !== id) : [...f.spells, { spell: id, how: "prepared", at: 1 }])
                           } />
              {f.spells.map((sp, i) => (
                <div key={`${sp.spell}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="min-w-[10rem] text-sm">{nameFromId(sp.spell, index)}</span>
                  <SpellReadyEditor value={sp} onChange={(p) => set("spells", f.spells.map((x, j) => (j === i ? withReady(x, p) : x)))}
                                    cantrip={spellLevel.get(sp.spell) === 0} />
                  <span className="text-xs italic text-ink-faded">from level</span>
                  <input type="number" min={1} max={20} value={sp.at ?? 1}
                         onChange={(e) => set("spells", f.spells.map((x, j) => (j === i ? { ...x, at: numOrNull(e.target.value) ?? 1 } : x)))}
                         className={`${fieldCls} !w-12`} />
                  <button type="button" onClick={() => set("spells", f.spells.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove spell">
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline gap-3">
                <span className={`${labelCls} !mb-0`}>The player picks</span>
                <button type="button" onClick={() => set("spellPools", [...f.spellPools, emptySpellPool()])} className={addRowCls}>
                  + add a pick
                </button>
              </div>
              {f.spellPools.map((sp, i) => (
                <SpellPoolEditor key={i} value={sp}
                                 onChange={(v) => set("spellPools", f.spellPools.map((x, j) => (j === i ? v : x)))}
                                 onRemove={() => set("spellPools", f.spellPools.filter((_, j) => j !== i))} />
              ))}
            </div>

            <div>
              <label className="flex items-baseline gap-2 text-sm">
                <input type="checkbox" checked={f.spellAbility.on} onChange={(e) => patch("spellAbility", { on: e.target.checked })} className="accent-rubric" />
                The player picks the spellcasting ability for these spells
              </label>
              {f.spellAbility.on && (
                <ChipToggles options={ABILITIES} selected={f.spellAbility.from} labelOf={(a) => ABILITY_SHORT[a]}
                             onToggle={(a) => patch("spellAbility", { from: toggleIn(f.spellAbility.from, a) })}
                             className="mt-1 border-l border-rule/30 pl-3" />
              )}
            </div>
          </div>
        </FilterSection>
      )}
    </>
  );
}

// Every class a "class level" prerequisite can name (spellcasters and martials).
const ALL_CLASSES = ["artificer", "barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"];
const PACTS = ["blade", "chain", "tome", "talisman"];
const titleCaseWord = (w) => (w ? w[0].toUpperCase() + w.slice(1) : w);

/* Alternative groups of requirements: any one group is enough; inside a
   group all of it is needed. groups / onChange: catalogueForms.prereqsToForm. */
export function PrerequisitesEditor({ groups, onChange, feats, index, showPacts = false }) {
  const set = (i, p) => onChange(groups.map((g, j) => (j === i ? { ...g, ...p } : g)));
  return (
    <div className="space-y-3">
      {groups.length === 0 && <p className={hintCls}>None.</p>}
      {groups.map((g, i) => (
        <div key={i} className="space-y-2 border-l border-rule/30 pl-3">
          <div className="flex items-baseline gap-3">
            <span className="text-sm italic">{i === 0 ? "Needs" : "Or needs"}</span>
            <span className="flex-1" />
            <button type="button" onClick={() => onChange(groups.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove">✕</button>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <label className="flex items-baseline gap-2">
              <span className={`${labelCls} !mb-0`}>Level</span>
              <input type="number" min={1} max={20} value={g.level ?? ""} placeholder="—"
                     onChange={(e) => set(i, { level: numOrNull(e.target.value) })} className={`${fieldCls} !w-14`} />
            </label>
            <label className="flex items-baseline gap-2 text-sm">
              <input type="checkbox" checked={g.spellcasting} onChange={(e) => set(i, { spellcasting: e.target.checked })} className="accent-rubric" />
              can cast a spell
            </label>
          </div>
          <div>
            <div className="flex items-baseline gap-3">
              <span className={`${labelCls} !mb-0`}>Class level (any one)</span>
              <button type="button" onClick={() => set(i, { classLevels: [...g.classLevels, { class: "warlock", level: 2, subclass: "" }] })} className={addRowCls}>
                + add
              </button>
            </div>
            {g.classLevels.map((c, k) => {
              const setRow = (p) => set(i, { classLevels: g.classLevels.map((x, j) => (j === k ? { ...x, ...p } : x)) });
              return (
                <div key={k} className="mt-1 flex flex-wrap items-baseline gap-3">
                  <select value={c.class} onChange={(e) => setRow({ class: e.target.value })} className={`${fieldCls} !w-32`}>
                    {[...new Set([...ALL_CLASSES, c.class])].map((x) => <option key={x} value={x}>{labelFromId(x)}</option>)}
                  </select>
                  <span className="text-xs italic text-ink-faded">level</span>
                  <input type="number" min={1} max={20} value={c.level ?? ""} onChange={(e) => setRow({ level: numOrNull(e.target.value) })}
                         className={`${fieldCls} !w-14`} />
                  <input type="text" value={c.subclass} onChange={(e) => setRow({ subclass: e.target.value })} placeholder="subclass (optional)"
                         className={`${fieldCls} !w-40`} />
                  <button type="button" onClick={() => set(i, { classLevels: g.classLevels.filter((_, j) => j !== k) })} className={removeRowCls} aria-label="Remove">✕</button>
                </div>
              );
            })}
          </div>
          {(showPacts || g.pacts.length > 0) && <div>
            <div className={labelCls}>Pact boon (any one)</div>
            <ChipToggles options={PACTS} selected={g.pacts} labelOf={(p) => `Pact of the ${titleCaseWord(p)}`} onToggle={(p) => set(i, { pacts: toggleIn(g.pacts, p) })} />
          </div>}
          <div>
            <div className="flex items-baseline gap-3">
              <span className={`${labelCls} !mb-0`}>Ability score (any one)</span>
              <button type="button" onClick={() => set(i, { abilities: [...g.abilities, { ability: "str", score: 13 }] })} className={addRowCls}>
                + add
              </button>
            </div>
            {g.abilities.map((r, k) => (
              <div key={k} className="mt-1 flex items-baseline gap-3">
                <select value={r.ability} onChange={(e) => set(i, { abilities: g.abilities.map((x, j) => (j === k ? { ...x, ability: e.target.value } : x)) })}
                        className={`${fieldCls} !w-20`}>
                  {ABILITIES.map((a) => <option key={a} value={a}>{ABILITY_SHORT[a]}</option>)}
                </select>
                <input type="number" min={1} max={30} value={r.score ?? ""}
                       onChange={(e) => set(i, { abilities: g.abilities.map((x, j) => (j === k ? { ...x, score: numOrNull(e.target.value) } : x)) })}
                       className={`${fieldCls} !w-14`} />
                <span className="text-xs italic text-ink-faded">or higher</span>
                <button type="button" onClick={() => set(i, { abilities: g.abilities.filter((_, j) => j !== k) })} className={removeRowCls} aria-label="Remove">✕</button>
              </div>
            ))}
          </div>
          <div>
            <div className={labelCls}>Armor training</div>
            <ChipToggles options={["light", "medium", "heavy", "shield"]} selected={g.armor} onToggle={(a) => set(i, { armor: toggleIn(g.armor, a) })} />
          </div>
          <div>
            <div className={labelCls}>A feat (any one)</div>
            <EntryPicker entries={feats} index={index} selected={g.feats} placeholder="search feats…"
                         onToggle={(id) => set(i, { feats: toggleIn(g.feats, id) })} />
          </div>
          <div>
            <div className={labelCls}>Other (text)</div>
            <input type="text" value={g.note} onChange={(e) => set(i, { note: e.target.value })} placeholder="e.g. Elf or Half-Elf"
                   className={fieldCls} />
          </div>
          {Object.keys(g.rest).length > 0 && (
            <p className={hintCls}>Also kept: {Object.keys(g.rest).map(labelFromId).join(", ")}.</p>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...groups, emptyPrereqGroup()])} className={addRowCls}>
        {groups.length ? "+ or another set" : "+ add a prerequisite"}
      </button>
    </div>
  );
}

/* What the form has no field for: features (from the LLM step), other
   choices and other grants. They are saved unchanged; ✕ drops one. */
export function KeptSection({ features = [], onFeatures, choices = [], onChoices, grants, index }) {
  const grantRows = describeGrants(grants, index);
  if (!features.length && !choices.length && !grantRows.length) return null;
  return (
    <FilterSection title="Kept as they are" defaultOpen={false}>
      <p className={`${hintCls} mb-2`}>The form has no fields for these; they are saved unchanged. ✕ drops one.</p>
      <div className="space-y-1 text-sm">
        {features.map((f, i) => (
          <KeptRow key={`f${i}`} label="Feature" value={f.name} onRemove={onFeatures && (() => onFeatures(features.filter((_, j) => j !== i)))} />
        ))}
        {choices.map((c, i) => {
          const d = describeChoice(c, index);
          return (
            <KeptRow key={`c${i}`} label={d?.label || "Choice"} value={d?.value}
                     onRemove={onChoices && (() => onChoices(choices.filter((_, j) => j !== i)))} />
          );
        })}
        {grantRows.map((r) => <KeptRow key={r.label} label={r.label} value={r.value} />)}
      </div>
    </FilterSection>
  );
}

function KeptRow({ label, value, onRemove }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faded">{label}:</span>
      <span className="flex-1">{value}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} className={removeRowCls} aria-label={`Remove ${label}`}>
          ✕
        </button>
      )}
    </div>
  );
}

/* ─── Actions ────────────────────────────────────────────────────── */
// The shared action shape (data-model §2): { range, area, attack {kind,
// bonus, damage[]}, save {ability, dc, on_success, conditions[],
// damage[]}, damage[] }. A damage part is { dice, bonus, type, condition }.
// Numbers may be formulas ("pb + str_mod"); keys the editor doesn't show
// (bonus_from, dc_from, type_options, …) are kept as they are.

const ATTACK_KINDS = [
  { value: "melee", label: "melee" },
  { value: "ranged", label: "ranged" },
  { value: "melee_or_ranged", label: "melee or ranged" },
  { value: "spell", label: "spell" },
  { value: "any", label: "on an attack you make" },
];
const ON_SUCCESS = [
  { value: "none", label: "no effect" },
  { value: "half", label: "half damage" },
];
const DAMAGE_TYPE_OPTIONS = [...DAMAGE_TYPES, "weapon", "chosen"];
const damageTypeLabel = (t) => (t === "weapon" ? "the weapon's type" : t === "chosen" ? "a chosen type" : labelFromId(t));

// A text blank that holds a number or a formula.
function ValueField({ value, onChange, placeholder = "—", className = "!w-16", label }) {
  return (
    <input type="text" value={textFromValue(value)} placeholder={placeholder} aria-label={label}
           onChange={(e) => onChange(valueFromText(e.target.value))} className={`${fieldCls} ${className}`} />
  );
}

/* A number or a formula picked from a list: [proficiency bonus ▾] [+ ▾]
   [2] [☐ at least 1] → "pb + 2" (catalogueHelpers.parseFormula /
   buildFormula). "other…" turns it into a plain blank for anything the
   list can't say (a level table "1: 2, 5: 3", two words); a value like
   that opens as the blank, with ↺ back to the list. */
export function FormulaField({ value, onChange, label = "How much", placeholder = "—", terms = FORMULA_TERMS }) {
  const parsed = parseFormula(value);
  const [raw, setRaw] = useState(parsed == null);
  const [opLocal, setOpLocal] = useState(parsed?.op || "+");
  if (raw || parsed == null) {
    return (
      <span className="inline-flex items-baseline gap-1">
        <input type="text" value={textFromValue(value)} onChange={(e) => onChange(valueFromText(e.target.value))} placeholder="1: 2, 5: 3 or pb + int_mod"
               aria-label={label} className={`${fieldCls} !w-40`} />
        <button type="button" onClick={() => { if (parseFormula(value) == null) onChange(undefined); setRaw(false); }} className={removeRowCls}
                title="Pick from the list instead" aria-label="Pick from the list">↺</button>
      </span>
    );
  }
  const f = parsed;
  // + or × is remembered before there's a number to go with it
  // (a formula with no number has no operator to keep it in).
  const op = f.n != null ? f.op : opLocal;
  const write = (p) => {
    if (p.op) setOpLocal(p.op);
    onChange(buildFormula({ ...f, op, ...p }));
  };
  const isMod = /_mod$/.test(f.term);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1">
      <select value={f.term} aria-label={`${label}: what it counts`} className={`${fieldCls} !w-auto`}
              onChange={(e) => (e.target.value === "__other" ? setRaw(true) : write({ term: e.target.value, n: e.target.value ? null : f.n, min1: /_mod$/.test(e.target.value) && f.min1 }))}>
        {terms.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        <option value="__other">other…</option>
      </select>
      {f.term && (
        <select value={op} onChange={(e) => write({ op: e.target.value })} aria-label={`${label}: plus or times`} className={`${fieldCls} !w-12`}>
          <option value="+">+</option>
          <option value="*">×</option>
        </select>
      )}
      <input type="number" value={f.n ?? ""} onChange={(e) => write({ n: numOrNull(e.target.value) })} aria-label={`${label}: number`}
             placeholder={f.term ? (op === "*" ? "1" : "0") : placeholder} className={`${fieldCls} !w-14`} />
      {isMod && (
        <label className="flex items-baseline gap-1 text-xs text-ink-faded" title="A modifier can be 0 or less: this keeps it at 1 or more">
          <input type="checkbox" checked={f.min1} onChange={(e) => write({ min1: e.target.checked })} className="accent-rubric" />
          at least 1
        </label>
      )}
    </span>
  );
}

/* Dice picked, not typed: a count and a die from a list (1 · d6 → "1d6").
   "other…" turns it into a plain blank for anything else (a level table
   "1: 1d10, 5: 2d10", a number); a value that isn't plain dice opens as
   that blank, with ↺ back to the dice. */
export const DIE_SIZES = [4, 6, 8, 10, 12, 20, 100];
const DICE_RE = /^(\d+)d(\d+)$/;
export function DiceField({ value, onChange, label = "Dice", placeholder = "—" }) {
  const text = value == null ? "" : String(value).replace(/\s+/g, "");
  const m = DICE_RE.exec(text);
  const [raw, setRaw] = useState(!!text && !m);
  if (raw) {
    return (
      <span className="inline-flex items-baseline gap-1">
        <input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)} placeholder="1: 1d10, 5: 2d10"
               aria-label={label} className={`${fieldCls} !w-32`} />
        <button type="button" onClick={() => { setRaw(false); if (!DICE_RE.test(text)) onChange(undefined); }} title="Pick dice from the list"
                className="text-xs text-ink-faded hover:text-rubric">↺</button>
      </span>
    );
  }
  const count = m ? Number(m[1]) : 1;
  const die = m ? Number(m[2]) : "";
  const write = (n, d) => onChange(d ? `${Math.max(1, n || 1)}d${d}` : undefined);
  return (
    <span className="inline-flex items-baseline gap-1">
      <input type="number" min={1} value={m ? count : ""} placeholder="1" onChange={(e) => write(numOrNull(e.target.value), die || 6)}
             aria-label={`${label}: how many`} className={`${fieldCls} !w-12`} />
      <select value={die} onChange={(e) => (e.target.value === "other" ? setRaw(true) : write(count, Number(e.target.value) || null))}
              aria-label={`${label}: die`} className={`${fieldCls} !w-20`}>
        <option value="">{placeholder}</option>
        {[...new Set([...DIE_SIZES, ...(die ? [die] : [])])].map((n) => <option key={n} value={n}>d{n}</option>)}
        <option value="other">other…</option>
      </select>
    </span>
  );
}

// Drops the keys a blank was emptied in.
const withKey = (obj, key, v) => {
  const out = { ...obj, [key]: v };
  if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) delete out[key];
  return out;
};

/* mods: each part's bonus is a modifier picked from a list (Str mod, Dex
   mod… spellcasting mod, proficiency) plus a blank for anything extra;
   stored as one formula ("str_mod + 2"). A new part takes `newMod` (an
   attack's ability). By the rules a spell attack adds no modifier to its
   damage unless a feature says so (Agonizing Blast). */
// diceOnly (the create forms): dice and type only; a bonus the part has stays as it is.
export function DamageEditor({ parts, onChange, label = "Damage", perSlot = false, mods = false, newMod = null, diceOnly = false }) {
  const list = parts || [];
  const update = (i, key, v) => onChange(list.map((d, j) => (j === i ? withKey(d, key, v) : d)));
  return (
    <div className="space-y-1">
      {list.map((d, i) => {
        const bp = mods ? damageBonusParts(d.bonus) : null;
        return (
        <div key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <DiceField value={d.dice} onChange={(v) => update(i, "dice", v)} label="Dice" />
          {!diceOnly && <span className="text-xs text-ink-faded">+</span>}
          {bp && !diceOnly && (
            <select value={bp.mod || ""} onChange={(e) => update(i, "bonus", damageBonusFormula(e.target.value || null, bp.extra))}
                    className={`${fieldCls} !w-36`} aria-label="Modifier added">
              {DAMAGE_MODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          )}
          {bp && !diceOnly && <span className="text-xs text-ink-faded">+</span>}
          {!diceOnly && (bp ? (
            <ExtraField value={bp.extra} onChange={(v) => update(i, "bonus", damageBonusFormula(bp.mod, v))} label="Extra damage" />
          ) : (
            <ValueField value={d.bonus} onChange={(v) => update(i, "bonus", v)} placeholder="0" className="!w-20" label="Bonus" />
          ))}
          <select value={d.type || ""} onChange={(e) => update(i, "type", e.target.value || undefined)} className={`${fieldCls} !w-36`}>
            <option value="">— type —</option>
            {[...new Set([...DAMAGE_TYPE_OPTIONS, d.type].filter(Boolean))].map((t) => <option key={t} value={t}>{damageTypeLabel(t)}</option>)}
          </select>
          {perSlot && (
            <label className="flex items-baseline gap-1" title="Dice added for each spell slot level above the spell's level">
              <span className="text-xs text-ink-faded">+ per slot</span>
              <DiceField value={d.per_slot} onChange={(v) => update(i, "per_slot", v)} label="Per slot" />
            </label>
          )}
          <input type="text" value={d.condition || ""} onChange={(e) => update(i, "condition", e.target.value || undefined)}
                 placeholder="only if… (optional)" className={`${fieldCls} min-w-[8rem] flex-1`} />
          <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove damage">✕</button>
        </div>
        );
      })}
      <button type="button" onClick={() => onChange([...list, { dice: "", type: "", ...(mods && newMod && !list.length ? { bonus: damageBonusFormula(newMod) } : {}) }])} className={addRowCls}>
        + {label.toLowerCase()}
      </button>
    </div>
  );
}

/* A save DC: auto (8 + the proficiency bonus, on by default and can be
   switched off, + an ability's or the spellcasting modifier) or fixed (an
   item's "DC 13"). Stored as
   "8 + pb + con_mod" or 13 (catalogueHelpers.dcParts). pb: the
   character's proficiency bonus, shown as PB(3) on the sheet. */
const DC_ABILITIES = [...ABILITIES.map((ab) => ({ value: ab, label: ABILITY_SHORT[ab] })), { value: "spell", label: "spellcasting" }];
const pbWord = (pb) => (pb != null ? `PB(${pb})` : "PB");
// The six abilities (no "spellcasting"), for "Melee attacks use [Int]".
const ABILITY_PICKS = ABILITIES.map((ab) => ({ value: ab, label: ABILITY_SHORT[ab] }));
/* Which ability a roll uses: one dropdown (Str, Dex… spellcasting)
   instead of a line of every choice. */
function AbilitySelect({ value, onChange, options = DC_ABILITIES, label = "Ability" }) {
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)} aria-label={label} className={`${fieldCls} !w-32`}>
      {!value && <option value="">—</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function DcEditor({ value, onChange, pb = null }) {
  const p = dcParts(value);
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-xs text-ink-faded">DC</span>
      <Segmented size="sm" options={[{ value: "auto", label: "auto" }, { value: "set", label: "fixed" }]} value={p.mode}
                 onChange={(m) => onChange(m === "auto" ? dcFormula(true, "con") : 13)} />
      {p.mode === "auto" ? (
        <>
          <span className="text-sm">8 +</span>
          <button type="button" onClick={() => onChange(dcFormula(!p.pb, p.ability))} className={chip(p.pb)} title="The proficiency bonus: on by default, click to leave it out">
            {pbWord(pb)}
          </button>
          <span className="text-sm">+</span>
          <AbilitySelect value={p.ability} onChange={(ab) => onChange(dcFormula(p.pb, ab))} label="DC ability" />
          <span className="text-xs text-ink-faded">mod</span>
        </>
      ) : (
        <input type="number" value={typeof p.value === "number" ? p.value : ""} onChange={(e) => onChange(numOrNull(e.target.value) ?? 13)} placeholder="13"
               className={`${fieldCls} !w-16`} aria-label="DC" />
      )}
    </div>
  );
}

/* A small number added on top (to hit, damage), labelled "extra". A
   value that isn't a plain number (a formula from the book) stays text. */
function ExtraField({ value, onChange, label }) {
  const plain = value == null || value === "" || typeof value === "number" || /^-?\d+$/.test(String(value));
  return (
    <label className="flex items-baseline gap-1" title={`${label}: a number added on top`}>
      <span className="text-[10px] italic text-ink-faded">extra</span>
      {plain ? (
        <input type="number" value={value ?? ""} placeholder="0" onChange={(e) => onChange(numOrNull(e.target.value) ?? undefined)}
               className={`${fieldCls} !w-14`} aria-label={label} />
      ) : (
        <ValueField value={value} onChange={onChange} placeholder="0" className="!w-20" label={label} />
      )}
    </label>
  );
}

/* Range and area, picked: [— · reach · range] [10] ft. (a range may
   have a long range: 80/320 ft.), and an area: [shape] [20] ft.
   Distances step by 5 (the mouse wheel too). Words the picker can't show
   ("self", "sight") open as text, with ↺ back to the picker. */
const DISTANCE_KINDS = [
  { value: "", label: "—" },
  { value: "reach", label: "reach" },
  { value: "range", label: "range" },
];
function FeetField({ value, onChange, label, placeholder = "—" }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <input type="number" min={0} step={5} value={value ?? ""} placeholder={placeholder} aria-label={label} className={`${fieldCls} !w-16`}
             onChange={(e) => onChange(numOrNull(e.target.value))}
             onBlur={(e) => { const n = numOrNull(e.target.value); if (n != null && n % 5) onChange(Math.round(n / 5) * 5); }} />
      <span className="text-xs text-ink-faded">ft.</span>
    </span>
  );
}
export function RangeAreaEditor({ range, area, onChange }) {
  const r = parseRange(range);
  const ar = parseArea(area);
  const [rawRange, setRawRange] = useState(r == null);
  const [rawArea, setRawArea] = useState(ar == null);
  const setR = (p) => onChange({ range: buildRange({ ...r, ...p }) });
  const setA = (p) => onChange({ area: buildArea({ ...ar, ...p }) });
  const raw = (val, key, back) => (
    <span className="inline-flex items-baseline gap-1">
      <input type="text" value={val || ""} onChange={(e) => onChange({ [key]: e.target.value || undefined })} className={`${fieldCls} !w-44`} aria-label={key} />
      <button type="button" onClick={() => { onChange({ [key]: undefined }); back(); }} className={removeRowCls} title="Pick instead" aria-label="Pick instead">↺</button>
    </span>
  );
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="w-12 text-xs text-ink-faded">Distance</span>
        {rawRange || r == null ? raw(range, "range", () => setRawRange(false)) : (
          <>
            <Segmented size="sm" options={DISTANCE_KINDS} value={r.kind}
                       onChange={(kind) => setR({ kind, n: kind ? r.n ?? (kind === "reach" ? 5 : 30) : null, long: kind === "range" ? r.long : null })} />
            {r.kind && <FeetField value={r.n} onChange={(n) => setR({ n })} label={r.kind === "reach" ? "Reach" : "Range"} />}
            {r.kind === "range" && (
              <>
                <span className="text-xs text-ink-faded">long range</span>
                <FeetField value={r.long} onChange={(long) => setR({ long })} label="Long range" />
              </>
            )}
            <button type="button" onClick={() => setRawRange(true)} className="text-[10px] italic text-ink-faint hover:text-rubric">other…</button>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="w-12 text-xs text-ink-faded">Area</span>
        {rawArea || ar == null ? raw(area, "area", () => setRawArea(false)) : (
          <>
            <select value={ar.shape} onChange={(e) => setA({ shape: e.target.value, n: e.target.value ? ar.n ?? 15 : null })} className={`${fieldCls} !w-32`} aria-label="Area shape">
              <option value="">— none —</option>
              {AREA_SHAPES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            {ar.shape && <FeetField value={ar.n} onChange={(n) => setA({ n })} label="Area size" />}
            <button type="button" onClick={() => setRawArea(true)} className="text-[10px] italic text-ink-faint hover:text-rubric">other…</button>
          </>
        )}
      </div>
    </div>
  );
}

// A new attack / save as the editors start them (auto: worked-out numbers).
export const newAttackFor = (auto = true) =>
  auto ? { kind: "melee", bonus: hitFormula("str"), damage: [{ dice: "", type: "", bonus: "str_mod" }] } : { kind: "melee", damage: [] };
export const newSaveFor = (auto = true, spell = false) => ({ ability: "dex", ...(auto ? { dc: dcFormula(true, spell ? "spell" : "con") } : {}), on_success: "none" });

/* Healing, temporary HP or a barrier: [2] [d8] + [modifier ▾] [+ / ×] [n]
   [PB]. The modifier is a list (an ability's, spellcasting, level, class
   level, or fixed), added or multiplied (Lay on Hands: 5 × level); PB is
   off until clicked. Stored as one formula (catalogueHelpers.parseHeal /
   buildHeal); what the picker can't show stays text ("other…"). */
const HEAL_TERMS = FORMULA_TERMS.filter((t) => t.value !== "pb");
function HealField({ value, onChange, label, pb = null }) {
  const p = parseHeal(value);
  const [raw, setRaw] = useState(p == null);
  if (raw || p == null) {
    return (
      <span className="inline-flex items-baseline gap-1">
        <input type="text" value={textFromValue(value)} onChange={(e) => onChange(valueFromText(e.target.value))} placeholder="2d8 + wis_mod"
               aria-label={label} className={`${fieldCls} !w-44`} />
        <button type="button" onClick={() => { if (parseHeal(value) == null) onChange(undefined); setRaw(false); }} className={removeRowCls}
                title="Pick from the lists" aria-label="Pick from the lists">↺</button>
      </span>
    );
  }
  const write = (x) => onChange(buildHeal({ ...p, ...x }));
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1.5">
      <DiceField value={p.dice} onChange={(d) => write({ dice: d })} label={`${label} dice`} />
      <span className="text-xs text-ink-faded">+</span>
      <FormulaField value={p.mod} onChange={(m) => write({ mod: m })} label={`${label}: modifier`} terms={HEAL_TERMS} />
      <button type="button" onClick={() => write({ pb: !p.pb })} className={chip(p.pb)} title="Add the proficiency bonus">
        + {pbWord(pb)}
      </button>
      <button type="button" onClick={() => setRaw(true)} className="text-[10px] italic text-ink-faint hover:text-rubric">other…</button>
    </span>
  );
}
// Dice added for each spell slot level above the spell's (a spell's healing).
function PerSlotField({ value, onChange }) {
  return (
    <label className="flex items-baseline gap-1" title="Dice added for each spell slot level above the spell's level">
      <span className="text-xs text-ink-faded">+ per slot</span>
      <DiceField value={value} onChange={onChange} label="Per slot" />
    </label>
  );
}

const HIT_MODES = [
  { value: "auto", label: "auto" },
  { value: "set", label: "fixed" },
  { value: "none", label: "the weapon's" },
];

/* spell: also healing and temporary HP, and dice added per slot level
   (upcasting). A cantrip's dice can be a level table: "1: 1d10, 5: 2d10".
   auto: to hit can be "automatic" (pb + an ability's modifier, + extra)
   and the damage can add that modifier (catalogueHelpers.hitParts); the
   character's features and catalogue entries use it, monsters (fixed
   numbers) don't. */
/* simple (the catalogue's create forms): to hit isn't typed, it's worked
   out (pb + the kind's ability: Str melee, Dex ranged, spellcasting for a
   spell attack) and damage is dice and type; the sheet is where the player
   fine-tunes those. A save's DC is worked out too: 8 + proficiency (on or
   off) + an ability's modifier, or a set number (items: "DC 13"). */
/* only: show just these sections, without their on/off boxes (the
   feature editor opens each in its own window): "range" · "attack" ·
   "save" · "damage" (an aura: no roll) · "heal". pb: the character's
   proficiency bonus, shown as PB(3). */
export function ActionEditor({ value, onChange, spell = false, auto = false, simple = false, only = null, pb = null }) {
  auto = auto || simple;
  const show = (k) => !only || only.includes(k);
  const a = value || {};
  const set = (key, v) => onChange(withKey(a, key, v));
  const attack = a.attack;
  const save = a.save;
  const setAttack = (key, v) => set("attack", withKey(attack, key, v));
  const hp = attack ? hitParts(attack.bonus) : null;
  const rider = attack?.kind === "any";
  // The ability the automatic numbers use (the kind's usual one when not automatic).
  const ability = hp?.mode === "auto" ? hp.ability : AUTO_ABILITY[attack?.kind] || "str";
  // A new ability (or kind) for the automatic numbers: to hit, and the damage's modifier when it has one.
  const withAbility = (atk, ab) => {
    const h = hitParts(atk.bonus);
    const out = { ...atk, bonus: h.mode === "auto" ? hitFormula(ab, h.extra, h.pb) : atk.bonus };
    const first = (atk.damage || [])[0];
    if (first) {
      const bp = damageBonusParts(first.bonus);
      // the damage follows the attack's ability when it added that one (not proficiency, not a
      // spell's: a spell attack adds no modifier to its damage unless it already did)
      const keepMod = ab !== "spell" && (bp.mod ? bp.mod !== "pb" : h.mode === "auto" && atk.kind !== "spell");
      out.damage = [withKey(first, "bonus", bp.mod === "pb" ? first.bonus : damageBonusFormula(keepMod ? ab : null, bp.extra)), ...atk.damage.slice(1)];
    }
    return out;
  };
  const setKind = (kind) => {
    if (!auto) return setAttack("kind", kind);
    if (kind === "any") return set("attack", withKey({ ...attack, kind }, "bonus", undefined));
    const next = { ...attack, kind };
    if (rider && next.bonus == null) next.bonus = hitFormula(AUTO_ABILITY[kind] || "str");
    set("attack", hitParts(next.bonus).mode === "auto" ? withAbility(next, AUTO_ABILITY[kind] || "str") : next);
  };
  const setHitMode = (mode) =>
    setAttack("bonus", mode === "auto" ? hitFormula(ability) : mode === "set" ? (hp.mode === "set" ? attack.bonus : 0) : undefined);
  const newAttack = newAttackFor(auto);
  const setSave = (key, v) => set("save", withKey(save, key, v));
  return (
    <div className="space-y-2">
      {show("range") && (
        <RangeAreaEditor range={a.range} area={a.area} onChange={(p) => onChange(Object.entries(p).reduce((acc, [k, v]) => withKey(acc, k, v), a))} />
      )}

      {show("attack") && (
      <div className="space-y-1">
        {!only && (
          <label className="flex items-baseline gap-2 text-sm">
            <input type="checkbox" checked={!!attack} className="accent-rubric"
                   onChange={(e) => set("attack", e.target.checked ? newAttack : undefined)} />
            Attack roll
          </label>
        )}
        {only && only.includes("save") && <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faded">The attack</div>}
        {attack && (
          <div className="space-y-1 border-l border-rule/30 pl-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Segmented size="sm" options={only && attack.kind !== "any" ? ATTACK_KINDS.filter((k) => k.value !== "any") : ATTACK_KINDS} value={attack.kind} onChange={setKind} />
              {!auto && !simple && (
                <>
                  <span className="text-xs text-ink-faded">to hit +</span>
                  <ValueField value={attack.bonus} onChange={(v) => setAttack("bonus", v)} placeholder="5" className="!w-20" label="To hit" />
                </>
              )}
            </div>
            {auto && rider && (
              <p className={hintCls}>
                Extra damage on an attack you already make (Divine Smite, Sneak Attack): no roll of its own, it uses that attack's.
              </p>
            )}
            {simple && !rider && hp.mode === "auto" && (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-xs text-ink-faded">to hit</span>
                <button type="button" onClick={() => setAttack("bonus", hitFormula(hp.ability, hp.extra, !hp.pb))} className={chip(hp.pb)}
                        title="The proficiency bonus: on by default, click to leave it out">
                  {pbWord(pb)}
                </button>
                <span className="text-xs text-ink-faded">+</span>
                <AbilitySelect value={hp.ability} onChange={(ab) => set("attack", withAbility(attack, ab))} label="To hit ability" />
                <span className="text-xs text-ink-faded">mod</span>
              </div>
            )}
            {simple && !rider && (
              <p className={hintCls}>
                {hp.mode === "auto"
                  ? `To hit is worked out: ${hp.pb ? "PB + " : ""}${hp.ability === "spell" ? "spellcasting" : ABILITY_SHORT[hp.ability]} mod${
                      hp.extra != null ? ` + ${hp.extra}` : ""
                    }${damageBonusParts(attack.damage?.[0]?.bonus).mod ? ", and the damage adds its modifier" : ""}.`
                  : hp.mode === "set"
                    ? `To hit is set: +${attack.bonus}.`
                    : "It uses your weapon's roll."}{" "}
                {hp.mode !== "auto" && (
                  <button type="button" onClick={() => set("attack", withAbility({ ...attack, bonus: hitFormula(AUTO_ABILITY[attack.kind] || "str") }, AUTO_ABILITY[attack.kind] || "str"))}
                          className="not-italic underline decoration-dotted hover:text-rubric">
                    work it out instead
                  </button>
                )}{" "}
                Fine-tune it on the sheet.
              </p>
            )}
            {auto && !simple && !rider && (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-xs text-ink-faded">To hit</span>
                <Segmented size="sm" options={attack.kind === "melee" || attack.kind === "ranged" ? HIT_MODES : HIT_MODES.filter((m) => m.value !== "none")} value={hp.mode} onChange={setHitMode} />
                {hp.mode === "auto" && (
                  <>
                    <button type="button" onClick={() => setAttack("bonus", hitFormula(hp.ability, hp.extra, !hp.pb))} className={chip(hp.pb)}
                            title="The proficiency bonus: on by default, click to leave it out">
                      {pbWord(pb)}
                    </button>
                    <span className="text-sm">+</span>
                    <AbilitySelect value={hp.ability} onChange={(ab) => set("attack", withAbility(attack, ab))} label="To hit ability" />
                    <span className="text-xs text-ink-faded">mod +</span>
                    <ExtraField value={hp.extra} onChange={(v) => setAttack("bonus", hitFormula(hp.ability, v, hp.pb))} label="Extra to hit" />
                  </>
                )}
                {hp.mode === "set" && (
                  <input type="number" value={typeof attack.bonus === "number" ? attack.bonus : numOrNull(attack.bonus) ?? ""} placeholder="5"
                         onChange={(e) => setAttack("bonus", numOrNull(e.target.value) ?? 0)} className={`${fieldCls} !w-16`} aria-label="To hit" />
                )}
                {hp.mode === "none" && (
                  <span className={hintCls}>
                    {attack.kind === "melee" || attack.kind === "ranged" ? "it rides on your weapon attack and uses its roll" : "no to-hit yet: pick auto or fixed"}
                  </span>
                )}
              </div>
            )}
            <DamageEditor parts={attack.damage} onChange={(v) => setAttack("damage", v)} label="Damage on a hit" perSlot={spell}
                          mods={auto && !simple} diceOnly={simple} newMod={auto && !rider && ability !== "spell" && attack.kind !== "spell" ? ability : null} />
          </div>
        )}
      </div>
      )}

      {show("save") && (
      <div className="space-y-1">
        {!only ? (
          <label className="flex items-baseline gap-2 text-sm">
            <input type="checkbox" checked={!!save} className="accent-rubric"
                   onChange={(e) => set("save", e.target.checked ? newSaveFor(auto, spell) : undefined)} />
            Saving throw{attack ? " (on a hit)" : ""}
          </label>
        ) : only.includes("attack") && <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faded">Then a saving throw, on a hit</div>}
        {save && (
          <div className="space-y-1 border-l border-rule/30 pl-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <select value={save.ability} onChange={(e) => setSave("ability", e.target.value)} className={`${fieldCls} !w-20`}>
                {ABILITIES.map((ab) => <option key={ab} value={ab}>{ABILITY_SHORT[ab]}</option>)}
              </select>
              <span className="text-xs text-ink-faded">save</span>
            </div>
            <DcEditor value={save.dc} onChange={(v) => setSave("dc", v)} pb={pb} />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs text-ink-faded">on a success</span>
              <Segmented size="sm" options={ON_SUCCESS} value={save.on_success || "none"} onChange={(v) => setSave("on_success", v)} />
            </div>
            <DamageEditor parts={save.damage} onChange={(v) => setSave("damage", v)} label="Damage on a failure" perSlot={spell} mods={auto && !simple} diceOnly={simple} />
            <FoldChips label="Conditions on a failure" options={CONDITIONS} selected={save.conditions || []}
                       onToggle={(c) => setSave("conditions", toggleIn(save.conditions || [], c))} />
          </div>
        )}
      </div>
      )}

      {show("damage") && (
      <div className="space-y-1">
        {!only && (
          <label className="flex items-baseline gap-2 text-sm">
            <input type="checkbox" checked={!!a.damage} className="accent-rubric"
                   onChange={(e) => set("damage", e.target.checked ? [{ dice: "", type: "" }] : undefined)} />
            Damage with no roll (an aura, a sure hit)
          </label>
        )}
        {(a.damage || only) && (
          <div className={only ? "" : "border-l border-rule/30 pl-3"}>
            <DamageEditor parts={a.damage} onChange={(v) => set("damage", v.length ? v : undefined)} perSlot={spell} mods={auto && !simple} />
          </div>
        )}
      </div>
      )}

      {(only ? only.includes("heal") : spell) && (
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2">
          <span className="text-xs text-ink-faded">Healing</span>
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <HealField value={a.heal} onChange={(v) => set("heal", v)} label="Healing" pb={pb} />
            {spell && <PerSlotField value={a.heal_per_slot} onChange={(v) => set("heal_per_slot", v)} />}
          </span>
          <span className="text-xs text-ink-faded">Temporary HP</span>
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <HealField value={a.temp_hp} onChange={(v) => set("temp_hp", v)} label="Temporary HP" pb={pb} />
            {spell && <PerSlotField value={a.temp_hp_per_slot} onChange={(v) => set("temp_hp_per_slot", v)} />}
          </span>
          <span className="text-xs text-ink-faded" title="Hit points a ward or shield absorbs before yours (Arcane Ward)">Barrier</span>
          <HealField value={a.barrier} onChange={(v) => set("barrier", v)} label="Barrier" pb={pb} />
        </div>
      )}
    </div>
  );
}

/* ─── Features ───────────────────────────────────────────────────── */
// A plain list of features in the shared shape (data-model §2): name,
// where it's used (category), uses, and its numbers (ActionEditor).
// With `levels` each feature also has a level (the list is shown in level
// order) and an "optional" switch; with `withText` its own text (class
// features carry their text; a spell's features read the spell's).
// Toggles, modifiers and costs aren't edited here; they're kept and
// named. Each feature folds open; ▲ ▼ reorder. Monsters have their own
// editor (sections, legendary costs).

// Uses come back on a long or a short rest; the book's "at dawn" / "dusk"
// / "per day" is a long rest (play.py treats it so), and shows as one here.
const restOf = (reset) => (reset === "short" ? "short" : reset ? "long" : "");
const USE_MODES = [
  { value: "none", label: "no limit" },
  { value: "long", label: "per long rest" },
  { value: "short", label: "per short rest" },
  { value: "pool", label: "from a pool" },
];
// On an item with charges: a feature can spend the item's own charges
// (consumes { resource: "charges", amount }), like its spells do.
const ITEM_CHARGES_MODE = { value: "charges", label: "item's charges", hint: "Spends the item's charges (the Magic part of the item)" };

/* ─── Effects: numbers on the sheet ─────────────────────────────────
   A list of modifiers { target, add | min | set | base, requires? }
   (catalogueHelpers.MOD_*): on an item, in a feature (always), or in a
   feature's switch (while it's on). Values can be formulas ("pb",
   "pb + int_mod", "13 + dex_mod"). */
const makeMod = (target, how, value, requires) => {
  const m = { target, [how]: how === "adv" || how === "dis" ? true : value ?? (how === "base" ? "13 + dex_mod" : 1) };
  if (target === "ac" && requires?.length) m.requires = requires;
  return m;
};
export function ModifiersEditor({ value, onChange, addLabel = "+ a number on the sheet" }) {
  const list = value || [];
  const update = (i, m) => onChange(list.map((x, j) => (j === i ? m : x)));
  return (
    <div className="space-y-1.5">
      {list.map((m, i) => {
        const how = modHow(m);
        const ac = m.target === "ac";
        const roll = how === "adv" || how === "dis";
        // "Melee attacks use [Int]": an ability, not a number
        const pick = ABILITY_TARGET(m.target);
        const hows = MOD_HOW.filter((h) => (h.value === "base" ? ac : h.value === "adv" || h.value === "dis" ? ROLL_TARGET(m.target) : true));
        return (
          <div key={i} className="flex items-start gap-2 rounded-sm border border-rule/35 px-2.5 py-1.5">
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
            <select value={m.target || ""}
                    onChange={(e) => {
                      const t = e.target.value;
                      if (ABILITY_TARGET(t)) return update(i, { target: t, set: pick ? m.set : "int" });
                      const keep = (how === "base" && t !== "ac") || (roll && !ROLL_TARGET(t)) || pick ? "add" : how;
                      update(i, makeMod(t, keep, keep === how ? m[how] : undefined, m.requires));
                    }}
                    className={`${fieldCls} !w-56`} aria-label="What it changes">
              {!MOD_TARGET_LABELS[m.target] && <option value={m.target || ""}>{m.target || "—"}</option>}
              {MOD_TARGET_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </optgroup>
              ))}
            </select>
            {pick ? (
              <AbilitySelect value={m.set} onChange={(ab) => update(i, { target: m.target, set: ab })} options={ABILITY_PICKS} label="Ability" />
            ) : (
              <>
                <Segmented size="sm" options={hows} value={how}
                           onChange={(h) => update(i, makeMod(m.target, h, roll || h === "adv" || h === "dis" ? undefined : m[how], m.requires))} />
                {!roll && <FormulaField value={m[how]} onChange={(v) => update(i, makeMod(m.target, how, v ?? "", m.requires))} label="How much" />}
              </>
            )}
            {ac && (
              <div className="basis-full">
                <span className="mr-2 text-xs italic text-ink-faded">only with</span>
                <ChipToggles options={MOD_REQUIRES.map((r) => r.value)} selected={m.requires || []} labelOf={(r) => MOD_REQUIRES.find((x) => x.value === r)?.label || r}
                             onToggle={(r) => update(i, makeMod(m.target, how, m[how], toggleIn(m.requires || [], r)))} />
              </div>
            )}
            </div>
            <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className={`${removeRowCls} pt-1`} aria-label="Remove">✕</button>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-x-4">
        <button type="button" onClick={() => onChange([...list, { target: "ac", add: 1 }])} className={addRowCls}>
          {addLabel}
        </button>
        {/* Bladework, Pact of the Blade, Shillelagh: attacks use Int (or another ability) when it's better */}
        <button type="button" onClick={() => onChange([...list, { target: "attack_ability", set: "int" }])} className={addRowCls}
                title="Attacks (melee, ranged, spell or all) may use this ability for to hit and damage">
          + attacks use another ability
        </button>
      </div>
    </div>
  );
}

/* Speeds, senses and defenses a switch gives while it's on (or a
   feature always gives): raw grants { speed, senses, defenses }. Other
   grant keys are kept as they are. */
export function TraitGrantsEditor({ value, onChange }) {
  const g = value || {};
  const d = g.defenses || {};
  const has = Object.keys(g.speed || {}).length || Object.keys(g.senses || {}).length || Object.values(d).some((l) => (l || []).length);
  const [open, setOpen] = useState(!!has);
  const set = (k, v) => {
    const out = { ...g, [k]: v };
    if (!v || (typeof v === "object" && !Object.keys(v).length)) delete out[k];
    onChange(Object.keys(out).length ? out : undefined);
  };
  const setDef = (k, list) => {
    const nd = { ...d, [k]: list };
    if (!list.length) delete nd[k];
    set("defenses", nd);
  };
  const other = Object.keys(g).filter((k) => !["speed", "senses", "defenses"].includes(k));
  return (
    <div>
      <ChipsHeading open={open} onToggle={() => setOpen((o) => !o)} label="Speed, senses, resistances" count={has ? 1 : 0} />
      {open && (
        <div className="mb-2 space-y-2 border-l border-rule/30 pl-3">
          <NumberMap keys={SPEED_MODES} value={g.speed} onChange={(v) => set("speed", v)} unit="ft." allowWalk step={5} />
          <NumberMap keys={SENSES} value={g.senses} onChange={(v) => set("senses", v)} unit="ft." step={5} />
          <FoldChips label="Resistances" options={DAMAGE_TYPES} selected={d.resist || []} onToggle={(t) => setDef("resist", toggleIn(d.resist || [], t))} />
          <FoldChips label="Damage immunities" options={DAMAGE_TYPES} selected={d.immune || []} onToggle={(t) => setDef("immune", toggleIn(d.immune || [], t))} />
          <FoldChips label="Condition immunities" options={CONDITIONS} selected={d.condition_immune || []}
                     onToggle={(t) => setDef("condition_immune", toggleIn(d.condition_immune || [], t))} />
        </div>
      )}
      {other.length > 0 && <p className={hintCls}>Also kept as they are: {other.map(labelFromId).join(", ")}.</p>}
    </div>
  );
}

/* What using a feature costs from a pool its class (or an optional
   feature) has: { resource, amount }. pools: [{ id, name }] the form knows
   (a class's resources); any id can be typed. */
/* The pool a feature spends from, and how much: { resource, amount }
   (or { resource, min, max } when the player picks the amount).
   pools [{ id, name }]: the pools to pick by name (the sheet: the
   character's; the class forms: the class's). With none known, or "other…",
   the pool's id is typed (superiority_dice). An id that isn't one of
   `pools` stays picked, shown as it is. */
/* With no pools to show (a create form: it doesn't know the character),
   the pool is picked later on the sheet ("from a pool" + how many); a
   book's pool id stays as it is. */
export function ConsumesEditor({ value, onChange, pools = [] }) {
  const c = value || { resource: "", amount: 1 };
  const known = pools.some((p) => p.id === c.resource);
  const [typed, setTyped] = useState(false);
  const write = (p) => onChange({ ...c, ...p });
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
      {!pools.length ? (
        <span className="text-xs italic text-ink-faded">{c.resource ? labelFromId(c.resource) : "the pool is picked on the character's sheet"}</span>
      ) : typed ? (
        <>
          <input type="text" value={c.resource || ""} onChange={(e) => write({ resource: e.target.value.trim().replace(/\s+/g, "_").toLowerCase() })}
                 placeholder="superiority_dice" className={`${fieldCls} !w-44`} aria-label="Pool" />
          <button type="button" onClick={() => setTyped(false)} className={removeRowCls} title="Pick from the pools" aria-label="Pick from the pools">↺</button>
        </>
      ) : (
        <select value={c.resource || ""} aria-label="Pool" className={`${fieldCls} !w-48`}
                onChange={(e) => (e.target.value === "__other" ? setTyped(true) : write({ resource: e.target.value }))}>
          {!c.resource && <option value="">— pick a pool —</option>}
          {c.resource && !known && <option value={c.resource}>{labelFromId(c.resource)} (not on this list)</option>}
          {pools.map((p) => <option key={p.id} value={p.id}>{p.name || labelFromId(p.id)}</option>)}
          <option value="__other">other…</option>
        </select>
      )}
      {c.min != null ? (
        <>
          <span className="text-xs text-ink-faded">from</span>
          <input type="number" min={1} value={c.min ?? 1} onChange={(e) => write({ min: Math.max(1, numOrNull(e.target.value) ?? 1) })}
                 className={`${fieldCls} !w-14`} aria-label="At least" />
          <span className="text-xs text-ink-faded">to</span>
          <input type="number" min={1} value={c.max ?? ""} onChange={(e) => write({ max: numOrNull(e.target.value) ?? undefined })}
                 className={`${fieldCls} !w-14`} aria-label="At most" />
        </>
      ) : (
        <>
          <span className="text-xs text-ink-faded">×</span>
          <input type="number" min={1} value={c.amount ?? 1} onChange={(e) => write({ amount: Math.max(1, numOrNull(e.target.value) ?? 1) })}
                 className={`${fieldCls} !w-14`} aria-label="How many" />
        </>
      )}
    </span>
  );
}

/* What a feature lets the player pick (class features: "two skills from
   this list", "one language"): pool choices { type: "pool", id, label,
   grant, count, from, at }. Other kinds of choice are shown and kept. */
const PICK_OPTIONS = { skills: SKILL_IDS, expertise: SKILL_IDS, tools: TOOLS, languages: LANGUAGES, saves: ABILITIES };
const PICK_KINDS = Object.keys(PICK_OPTIONS).map((k) => ({ value: k, label: labelFromId(k) }));
const pickFrom = (c) => (Array.isArray(c.from) ? c.from : typeof c.from === "string" ? [c.from] : []);
export function PicksEditor({ value, onChange, index }) {
  const list = value || [];
  const update = (i, p) => onChange(list.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const editable = (c) => c?.type === "pool" && typeof c.grant === "string" && PICK_OPTIONS[c.grant] && !(c.from && typeof c.from === "object" && !Array.isArray(c.from));
  return (
    <div className="space-y-1">
      {list.map((c, i) => {
        if (!editable(c)) {
          const d = describeChoice(c, index);
          return <KeptRow key={i} label={d?.label || "Pick"} value={d?.value} onRemove={() => onChange(list.filter((_, j) => j !== i))} />;
        }
        const from = pickFrom(c);
        const setFrom = (next) => update(i, { from: next.length === 1 && isGroup(next[0]) ? next[0] : next });
        return (
          <div key={i} className="space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-sm">Choose</span>
              <input type="number" min={1} value={c.count ?? 1} onChange={(e) => update(i, { count: Math.max(1, numOrNull(e.target.value) ?? 1) })}
                     className={`${fieldCls} !w-12`} aria-label="How many" />
              <select value={c.grant} onChange={(e) => update(i, { grant: e.target.value, from: [], label: labelFromId(e.target.value) })} className={`${fieldCls} !w-32`}>
                {PICK_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
              <span className="text-xs text-ink-faded">at level</span>
              <input type="number" min={1} max={20} value={c.at ?? ""} placeholder="—" onChange={(e) => update(i, { at: numOrNull(e.target.value) ?? undefined })}
                     className={`${fieldCls} !w-12`} aria-label="At level" />
              <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove pick">✕</button>
            </div>
            <FoldChips label="From" options={[...(POOL_GROUPS[c.grant] || []), ...PICK_OPTIONS[c.grant]]} selected={from}
                       labelOf={(id) => (isGroup(id) ? `any ${GROUP_LABELS[id].one}` : c.grant === "saves" ? ABILITY_SHORT[id] : labelFromId(id))}
                       onToggle={(id) => setFrom(toggleIn(from, id))} />
          </div>
        );
      })}
      <button type="button"
              onClick={() => onChange([...list, { type: "pool", id: `skills_${list.length + 1}`, label: "Skills", grant: "skills", count: 1, from: [] }])}
              className={addRowCls}>
        + a pick
      </button>
    </div>
  );
}

/* One feature's fields: level, name, kind and text, then its parts
   (FeatureParts: uses, when used, always, while switched on, picks).
   patch(key, value) or patch({ key: value, … }): undefined removes a key.
   levels: the level pick (levelOptions), "optional" and the picks part. */
export function FeatureFields({ f, patch, categories = ["actions", "bonus_actions", "reactions", "traits", "riders"], spell = false, levels = false,
                                levelOptions = LEVEL_OPTIONS, withText = false, pools = [], itemCharges = false, index }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {levels && (
          <select value={f.level ?? 1} onChange={(e) => patch("level", Number(e.target.value))} className={`${fieldCls} !w-20`} aria-label="Level">
            {levelOptions.map((l) => <option key={l} value={l}>Lv {l}</option>)}
          </select>
        )}
        <input type="text" value={f.name || ""} onChange={(e) => patch("name", e.target.value)} placeholder="name"
               className={`${fieldCls} min-w-[10rem] flex-1`} />
        <select value={f.category || categories[0]}
                onChange={(e) => {
                  const c = e.target.value;
                  // a rider starts with its extra damage
                  patch(c === "riders" && !riderOf(f) ? { category: c, rider: { damage: [{ dice: "1d6", type: "" }], on: "attacks" } } : { category: c });
                }}
                className={`${fieldCls} !w-40`}>
          {[...new Set([...categories, f.category].filter(Boolean))].map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c] || labelFromId(c)}</option>
          ))}
        </select>
        {levels && (
          <label className="flex items-baseline gap-1.5 text-sm" title="An optional class feature (Tasha's): the player may take it">
            <input type="checkbox" checked={!!f.optional} onChange={(e) => patch("optional", e.target.checked || undefined)} className="accent-rubric" />
            optional
          </label>
        )}
      </div>
      {withText && <TextField value={f.text || ""} onChange={(v) => patch("text", v)} rows={4} placeholder="What it does…" />}
      <FeatureParts f={f} onPatch={patch} pools={pools} spell={spell} picks={levels} itemCharges={itemCharges} index={index} />
    </>
  );
}

/* ─── A feature's parts (option A, 2026-11-23) ──────────────────────
   Uses are always shown, as fields (its own uses per long / short rest,
   and/or what it spends from a pool). Everything else is one line per
   part the feature has, in words, the way its card reads:
     Range / area       reach 10 ft. · 20-foot sphere
     Attack             melee attack (Int), 1d8 slashing
     Save               Dex save, 2d6 fire (half on a success)
     Attack & save      … then, on a hit, Con save, 2d6 poison
     Aura               2d6 fire, no roll
     Heal               heals 1d10 + class level
     Always             AC +1 · Speed: fly 30 ft.
     While switched on  AC +Int mod (at least 1) · Advantage on acrobatics
     Player picks       Skills: 2 of …
   "edit" (or the words) opens that part alone in a small window
   (PartPopup); ✕ takes it off. "+ add" lists the parts it doesn't have.
   The catalogue's forms and the sheet's feature editor use it.
     onPatch({ key: value })   undefined removes a key
     pools          [{ id, name }]: pools it can spend from
     actionMode     "simple" (create forms) | "auto" (the sheet)
     pb             the character's proficiency bonus (the sheet): PB(3)
     picks          offer "Player picks" (a class feature)
     traitGrants    speed / senses / defenses under Always (forms only)
     usesExtra      more under Uses (the sheet's "for this character: 3",
                    "turn into a pool")
     action         { words, editor } for the whole action instead (a
                    weapon-linked attack on the sheet) */
const PART_HINTS = {
  range: "How far it reaches and the area it covers, in feet (steps of 5; the mouse wheel works on a clicked field).",
  attack: "An attack roll: what it adds to hit and the damage on a hit.",
  save: "A saving throw the target makes: its DC, what a success does, the damage and conditions on a failure.",
  attacksave: "An attack roll, then a saving throw on a hit (an Imp's sting: piercing on the hit, then a Con save against poison).",
  aura: "Damage with no attack roll and no save: an aura, retaliation when you're hit (a fire shield), a sure hit (Magic Missile). The text says when it happens.",
  rider: "Extra damage on an attack you make: Flame Tongue's fire while it's lit, Sneak Attack, Divine Smite, Hex. In Play you add it to the attacks it fits. Damage a weapon always deals goes in the weapon's own damage instead.",
  heal: "Hit points it gives back (Second Wind, Lay on Hands), temporary hit points, and/or a barrier that takes damage before you do (Arcane Ward).",
  action: "What happens when it's used.",
  always: "Numbers it changes for as long as the character has it: AC, speed, a skill, advantage on a roll…",
  toggle: "For something switched on and off (Rage, Bladesong, Mage Armor): what changes while it's on. Switching it on can spend one of its uses.",
  picks: "What the player chooses when they get it: skills, tools, a fighting style…",
};

// The action without its attack (an old "on an attack you make" rider moved out of it).
const withoutAttack = (a) => {
  const { attack, ...rest } = a || {};
  return Object.keys(rest).length ? rest : undefined;
};

/* A rider's window: the extra damage, conditions it adds, and what it
   rides on (attacks, saves you force, or both). */
export function RiderEditor({ value, onChange, spell = false, actionMode = "simple" }) {
  const r = value || {};
  const write = (p) => onChange({ ...r, ...p });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className={`${labelCls} !mb-0`}>Adds to</span>
        <Segmented size="sm" options={RIDER_ON} value={r.on || "attacks"} onChange={(on) => write({ on })} />
      </div>
      <DamageEditor parts={r.damage || []} onChange={(v) => write({ damage: v })} label="Extra damage" perSlot={spell}
                    mods={actionMode === "auto"} diceOnly={actionMode === "simple"} />
      <FoldChips label="Conditions it adds" options={CONDITIONS} selected={r.conditions || []}
                 onToggle={(c) => {
                   const list = toggleIn(r.conditions || [], c);
                   write({ conditions: list.length ? list : undefined });
                 }} />
    </div>
  );
}

/* itemCharges: the feature is on an item that has charges ("item's
   charges" is offered as its uses). */
export function FeatureParts({ f, onPatch, pools = [], spell = false, actionMode = "simple", pb = null, picks = false, traitGrants = true,
                               usesExtra = null, action = null, itemCharges = false, index }) {
  const [edit, setEdit] = useState(null);
  // Uses: no limit · the item's charges · its own per long / short rest ·
  // spends from a pool (one or the other: picking one clears the other).
  const onCharges = itemCharges && f.consumes?.resource === "charges";
  const useMode = onCharges ? "charges" : f.consumes?.resource != null ? "pool" : f.uses ? restOf(f.uses.reset) : "none";
  const useModes = itemCharges || onCharges ? [USE_MODES[0], ITEM_CHARGES_MODE, ...USE_MODES.slice(1)] : USE_MODES;
  const setUseMode = (m) =>
    onPatch(
      m === "none"
        ? { uses: undefined, consumes: undefined }
        : m === "charges"
          ? { uses: undefined, consumes: { resource: "charges", amount: f.consumes?.amount ?? 1 } }
          : m === "pool"
            ? { uses: undefined, consumes: f.consumes && f.consumes.resource !== "charges" ? f.consumes : { resource: pools[0]?.id || "", amount: 1 } }
            : { consumes: undefined, uses: { ...(f.uses || {}), max: f.uses?.max ?? 1, reset: m } }
    );
  const a = f.action && typeof f.action === "object" ? f.action : {};
  // Part of the action changed; an action left with nothing is taken off.
  const setAction = (p) => {
    let next = { ...a };
    for (const [k, v] of Object.entries(p)) next = withKey(next, k, v);
    onPatch({ action: Object.keys(next).length ? next : undefined });
  };
  const auto = true;
  const hasAlways = (f.modifiers || []).length > 0 || (traitGrants && f.grants && Object.keys(f.grants).length > 0);
  const actionParts = action
    ? [{ id: "action", label: "When used", has: true, words: action.words }]
    : [
        { id: "range", label: "Range / area", has: !!(a.range || a.area), words: rangeWords(a), act: { off: { range: undefined, area: undefined } }, add: "range / area" },
        { id: "attack", label: "Attack", has: !!a.attack && a.attack.kind !== "any" && !a.save, words: attackWords(a), act: { off: { attack: undefined }, start: { attack: newAttackFor(auto) } },
          add: "attack", offer: !a.attack },
        { id: "save", label: "Save", has: !!a.save && !a.attack, words: saveWords(a), act: { off: { save: undefined }, start: { save: newSaveFor(auto, spell) } },
          add: "save", offer: !a.save },
        { id: "attacksave", label: "Attack & save", has: !!a.attack && !!a.save, words: `${attackWords(a)} · then, on a hit, ${saveWords(a)}`,
          act: { off: { attack: undefined, save: undefined }, start: { attack: a.attack || newAttackFor(auto), save: a.save || newSaveFor(auto, spell) } },
          add: "attack & save", offer: !a.attack && !a.save },
        { id: "aura", label: "Damage, no roll", has: (a.damage || []).length > 0, words: auraWords(a), act: { off: { damage: undefined }, start: { damage: [{ dice: "", type: "" }] } },
          add: "damage, no roll (aura, retaliation)" },
        { id: "heal", label: "Heal", has: !!healWords(a), words: healWords(a),
          act: { off: { heal: undefined, heal_per_slot: undefined, temp_hp: undefined, temp_hp_per_slot: undefined, barrier: undefined } }, add: "heal" },
      ];
  /* The rider part: f.rider (an old "on an attack you make" attack is moved
     into it when it's opened). A feature of the kind "riders" is only that. */
  const rider = riderOf(f);
  const oldRider = !f.rider && a.attack?.kind === "any";
  const riderPart = {
    id: "rider", label: "Rider", has: !!rider || f.category === "riders", words: riderWords(f), add: "rider",
    off: { rider: undefined, ...(oldRider ? { action: withoutAttack(a) } : {}) },
    start: { rider: { damage: [{ dice: "1d6", type: "" }], on: "attacks" } },
  };
  const parts = f.category === "riders" ? [riderPart] : [
    ...actionParts,
    riderPart,
    { id: "always", label: "Always", has: hasAlways,
      words: [...(f.modifiers || []).map(formatModifier), traitGrants ? grantsSummary(f.grants, index) : ""].filter(Boolean).join(" · "),
      off: { modifiers: undefined, ...(traitGrants ? { grants: undefined } : {}) }, add: "always on" },
    { id: "toggle", label: "While switched on", has: !!f.toggle, words: toggleSummary(f.toggle, index), off: { toggle: undefined, on: undefined },
      add: "switched on and off", start: { toggle: true } },
    ...(picks || (f.choices || []).length
      ? [{ id: "picks", label: "Player picks", has: (f.choices || []).length > 0, words: picksSummary(f.choices, index), off: { choices: undefined }, add: "a pick" }]
      : []),
  ];
  const shown = parts.filter((p) => p.has || edit === p.id);
  const missing = parts.filter((p) => !p.has && edit !== p.id && p.offer !== false && p.add);
  const takeOff = (p) => (p.act ? setAction(p.act.off) : onPatch(p.off));
  const open = (p) => {
    if (p.id === "rider" && oldRider) onPatch({ rider: { damage: a.attack.damage || [], on: "attacks" }, action: withoutAttack(a) });
    else if (p.id === "rider" && !f.rider) onPatch(p.start);
    else if (!p.has) {
      if (p.act?.start) setAction(p.act.start);
      else if (p.start) onPatch(p.start);
    }
    setEdit(p.id);
  };
  const cur = parts.find((p) => p.id === edit);
  const ONLY = { range: ["range"], attack: ["attack"], save: ["save"], attacksave: ["attack", "save"], aura: ["damage"], heal: ["heal"] };

  return (
    <div className="space-y-2">
      {f.category !== "riders" && (
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="w-12 text-xs text-ink-faded">Uses</span>
          <Segmented size="sm" options={useModes} value={useMode} onChange={setUseMode} />
          {useMode === "charges" && (
            <span className="inline-flex items-baseline gap-1.5">
              <span className="text-xs text-ink-faded">costs</span>
              <input type="number" min={1} value={f.consumes.amount ?? 1} onChange={(e) => onPatch({ consumes: { ...f.consumes, amount: numOrNull(e.target.value) ?? 1 } })}
                     className={`${fieldCls} !w-14`} aria-label="Charges it costs" />
              <span className="text-xs text-ink-faded">{(f.consumes.amount ?? 1) === 1 ? "charge" : "charges"}</span>
            </span>
          )}
          {useMode === "pool" && <ConsumesEditor value={f.consumes} onChange={(c) => onPatch({ consumes: c })} pools={pools} />}
          {(useMode === "long" || useMode === "short") && (
            <FormulaField value={f.uses.max} onChange={(v) => onPatch({ uses: { ...f.uses, max: v ?? 1 } })} placeholder="1" label="How many" />
          )}
        </div>
        {usesExtra && useMode !== "none" && <div className="pl-[3.75rem]">{usesExtra}</div>}
      </div>
      )}

      {shown.length > 0 && (
        <div>
          {shown.map((p) => (
            <div key={p.id} className="grid grid-cols-[8.5rem_minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-dotted border-rule/25 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faded">{p.label}</span>
              <button type="button" onClick={() => open(p)} className="min-w-0 text-left text-sm hover:text-rubric">
                {p.words || <span className="italic text-ink-faint">nothing set yet</span>}
              </button>
              <span className="flex items-baseline gap-2 whitespace-nowrap">
                <button type="button" onClick={() => open(p)} className="text-xs italic text-ink-faded hover:text-rubric">edit</button>
                {(p.off || p.act) && (
                  <button type="button" onClick={() => takeOff(p)} className="text-[10px] text-ink-faint hover:text-bad" aria-label={`Take off: ${p.label}`}
                          title={`Take off ${p.label.toLowerCase()}`}>✕</button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {missing.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
          <span className="text-ink-faded">+ add:</span>
          {missing.map((p) => (
            <button key={p.id} type="button" onClick={() => open(p)} className="italic text-ink-faded underline decoration-dotted underline-offset-2 hover:text-rubric">
              {p.add}
            </button>
          ))}
        </div>
      )}

      {cur && (
        <PartPopup title={`${f.name || "This feature"}: ${cur.label.toLowerCase()}`} hint={PART_HINTS[cur.id]} onClose={() => setEdit(null)}>
          {cur.id === "action" && action.editor}
          {cur.id === "rider" && f.rider && (
            <RiderEditor value={f.rider} onChange={(r) => onPatch({ rider: r })} spell={spell} actionMode={actionMode} />
          )}
          {ONLY[cur.id] && (
            <ActionEditor value={a} onChange={(next) => onPatch({ action: next && Object.keys(next).length ? next : undefined })} spell={spell}
                          simple={actionMode === "simple"} auto={actionMode === "auto"} only={ONLY[cur.id]} pb={pb} />
          )}
          {cur.id === "always" && (
            <>
              <ModifiersEditor value={f.modifiers} onChange={(v) => onPatch({ modifiers: v.length ? v : undefined })} />
              {traitGrants && <TraitGrantsEditor value={f.grants} onChange={(v) => onPatch({ grants: v })} />}
            </>
          )}
          {cur.id === "toggle" && <SwitchEffectsEditor toggle={f.toggle || true} onChange={(t) => onPatch({ toggle: t })} hasUses={!!f.uses} />}
          {cur.id === "picks" && <PicksEditor value={f.choices} onChange={(v) => onPatch({ choices: v.length ? v : undefined })} index={index} />}
        </PartPopup>
      )}
    </div>
  );
}

/* What a switch does while it's on: `toggle` is true (a plain on/off)
   or { uses_charge, modifiers, grants }. hasUses: the feature has uses
   (switching it on can spend one). */
export function SwitchEffectsEditor({ toggle, onChange, hasUses = false }) {
  const t = toggle && typeof toggle === "object" ? toggle : {};
  const write = (p) => {
    const out = { ...t, ...p };
    for (const k of Object.keys(out)) if (out[k] == null || out[k] === false || (Array.isArray(out[k]) && !out[k].length)) delete out[k];
    onChange(Object.keys(out).length ? out : true);
  };
  return (
    <div className="space-y-1.5">
      {hasUses && (
        <label className="flex items-baseline gap-2 text-sm">
          <input type="checkbox" checked={!!t.uses_charge} onChange={(e) => write({ uses_charge: e.target.checked })} className="accent-rubric" />
          switching it on spends one of its uses
        </label>
      )}
      <ModifiersEditor value={t.modifiers} onChange={(v) => write({ modifiers: v })} addLabel="+ a number while it's on" />
      <TraitGrantsEditor value={t.grants} onChange={(v) => write({ grants: v })} />
    </div>
  );
}
const LEVEL_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

export function FeaturesEditor({
  features, onChange, categories = ["actions", "bonus_actions", "reactions", "traits", "riders"], spell = false, hint,
  levels = false, withText = false, newLevel = 1, pools = [], itemCharges = false, index,
}) {
  const [open, setOpen] = useState(null);
  const list = features || [];
  const nameOf = Object.fromEntries(list.filter((f) => f.id).map((f) => [f.id, f.name]));
  // patch(i, key, value) or patch(i, { key: value, … }); undefined removes a key
  const patch = (i, key, v) =>
    onChange(list.map((f, j) => {
      if (j !== i) return f;
      const p = typeof key === "object" ? key : { [key]: v };
      const next = { ...f, ...p };
      for (const [k, x] of Object.entries(p)) if (x === undefined) delete next[k];
      return next;
    }));
  // ▲ ▼ swap with the neighbour as shown (level order when `levels`).
  const order = list.map((f, i) => i);
  if (levels) order.sort((a, b) => (list[a].level ?? 0) - (list[b].level ?? 0) || a - b);
  const move = (i, dir) => {
    const pos = order.indexOf(i);
    const j = order[pos + dir];
    if (j == null) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setOpen(open === i ? j : open);
  };
  const add = () => {
    onChange([...list, { name: "", category: categories[0], ...(levels ? { level: newLevel } : {}), ...(withText ? { text: "" } : {}) }]);
    setOpen(list.length);
  };
  return (
    <div className="space-y-1">
      {hint && <p className={`${hintCls} mb-1`}>{hint}</p>}
      {list.length === 0 && <p className={hintCls}>None.</p>}
      {order.map((i) => {
        const f = list[i];
        const words = describeFeature(f).join(" · ");
        const isOpen = open === i;
        return (
          <div key={f.id || `new-${i}`} className={`${isOpen ? "space-y-2 border-l border-rubric/40 pb-2 pl-3" : ""} ${f.parent ? "ml-5" : ""}`}>
            <div className="flex items-baseline gap-2">
              <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="min-w-0 flex-1 truncate text-left text-sm hover:text-rubric">
                <span className={`mr-1.5 inline-block text-[9px] text-ink-faded transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                {levels && <span className="mr-2 text-[10px] font-semibold uppercase tracking-wider text-rubric">Lv {f.level ?? "—"}</span>}
                <span className="font-semibold italic">{f.name || <span className="text-ink-faded">(no name)</span>}</span>
                {f.optional && <span className="ml-2 text-[10px] uppercase tracking-wider text-ink-faded">optional</span>}
                {f.parent && <span className="ml-2 text-xs italic text-ink-faint">part of {nameOf[f.parent] || f.parent}</span>}
                {words && <span className="ml-2 text-xs italic text-ink-faded">{words}</span>}
              </button>
              <button type="button" onClick={() => move(i, -1)} className={removeRowCls} aria-label="Move up">▲</button>
              <button type="button" onClick={() => move(i, 1)} className={removeRowCls} aria-label="Move down">▼</button>
              <button type="button" onClick={() => { onChange(list.filter((_, j) => j !== i)); setOpen(null); }} className={removeRowCls}
                      aria-label="Remove">✕</button>
            </div>
            {isOpen && (
              <FeatureFields f={f} patch={(key, v) => patch(i, key, v)} categories={categories} spell={spell} levels={levels}
                             withText={withText} pools={pools} itemCharges={itemCharges} index={index} />
            )}
          </div>
        );
      })}
      <button type="button" onClick={add} className={addRowCls}>+ feature</button>
    </div>
  );
}

/* ─── Equipment picks ────────────────────────────────────────────── */
// One "choose one" pick of items and gold (A: items + gold · B: gold).
// options: the option forms from catalogueForms.bundleToForm. A choice
// inside an option (a martial weapon of your choice) is kept and shown.

export function BundleOptionsEditor({ options, onChange, entries, index, title = "Or choose one of", emptyHint }) {
  const list = options || [];
  const setOption = (i, p) => onChange(list.map((o, j) => (j === i ? { ...o, ...p } : o)));
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3">
        <span className={`${labelCls} !mb-0`}>{title}</span>
        <button type="button" onClick={() => onChange([...list, emptyOption()])} className={addRowCls}>
          + add option
        </button>
      </div>
      {list.length === 0 && emptyHint && <p className={hintCls}>{emptyHint}</p>}
      {list.map((o, i) => (
        <div key={i} className="space-y-2 border-l border-rule/30 pl-3">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-semibold">{String.fromCharCode(65 + i)}</span>
            <input type="text" value={o.label} onChange={(e) => setOption(i, { label: e.target.value })}
                   placeholder={optionLabel(o, index) || "label (made from the items when empty)"} className={`${fieldCls} flex-1`} />
            <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove option">
              ✕
            </button>
          </div>
          <ItemsEditor items={o.items} onChange={(v) => setOption(i, { items: v })} entries={entries} index={index} />
          <CurrencyEditor value={o.currency} onChange={(v) => setOption(i, { currency: v })} />
          {o.choices.map((c, k) => {
            const d = describeChoice(c, index);
            return d ? <p key={k} className={hintCls}>also: {d.label} — {d.value}</p> : null;
          })}
        </div>
      ))}
    </div>
  );
}
