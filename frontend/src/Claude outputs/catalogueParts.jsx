import React, { useMemo, useState } from "react";
import { DefineSection, Segmented } from "../../styles/parchmentForm";
import {
  chip, fieldCls, hintCls, labelCls, textareaCls, removeRowCls, addRowCls, ChipsHeading,
  RowTag, rowCls, rowNameCls,
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
        <h2 className="text-xl font-bold uppercase tracking-wide text-ink">{entry.name}</h2>
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
export function ChipToggles({ options, selected, onToggle, labelOf = labelFromId, className = "" }) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1.5 ${className}`}>
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onToggle(o)} className={chip((selected || []).includes(o))}>
          {labelOf(o)}
        </button>
      ))}
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
export function EntryPicker({ entries, selected, onToggle, placeholder = "search…", index, max = 40 }) {
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
      <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
             placeholder={entries?.length ? placeholder : "loading…"} className={`${fieldCls} mb-1`} />
      {query && (
        <div className="flex max-h-32 flex-wrap gap-x-4 gap-y-1 overflow-y-auto pr-1">
          {found.map((e) => {
            const id = e.id;
            return (
              <button key={id} type="button" onClick={() => onToggle(id)} className={chip(selected?.includes(id))}>
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
export function BasicsSection({ form, set, nameError, namePlaceholder = "", children }) {
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
          <div>
            <div className={labelCls}>Edition</div>
            <Segmented options={EDITION_OPTIONS} value={form.edition} onChange={(v) => set("edition", v)} />
          </div>
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

export function TextField({ value, onChange, placeholder, rows = 8 }) {
  return (
    <>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={textareaCls} placeholder={placeholder} />
      <p className={`${hintCls} mt-1`}>{TEXT_HINT}</p>
    </>
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
function SpellReadyEditor({ value, onChange }) {
  const r = spellReady(value);
  const write = (p) => onChange(spellReadyGrant({ ...r, ...p }));
  return (
    <>
      <Segmented size="sm" options={SPELL_READY} value={r.ready} onChange={(ready) => write({ ready })} />
      {r.ready === "innate" && (
        <span className="flex flex-wrap items-baseline gap-2" title="Free casts are optional: leave it empty for none (a number or a formula, like pb)">
          <ValueField value={r.max} onChange={(max) => write({ max })} placeholder="—" className="!w-12" label="Free casts" />
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
        <SpellReadyEditor value={v} onChange={(p) => onChange(withReady(v, p))} />
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
function NumberMap({ keys, value, onChange, labelOf = labelFromId, unit = "", allowWalk = false, signed = false }) {
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
            <input type="number" value={typeof v[k] === "number" ? v[k] : ""} placeholder="—"
                   onChange={(e) => setKey(k, numOrNull(e.target.value))} className={`${fieldCls} !w-14`}
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
export function GrantsEditor({ value, onChange, catalogues = {}, index, show = SECTIONS_ALL, equipmentExtra = null }) {
  const f = value;
  const set = (key, v) => onChange({ ...f, [key]: v });
  const patch = (key, p) => onChange({ ...f, [key]: { ...f[key], ...p } });
  // Traits show whenever the entry has any, even where the form didn't ask
  // for them, so nothing a record holds is hidden.
  const hasTraits = Object.keys(f.abilityFixed).length || Object.keys(f.speed).length || Object.keys(f.senses).length ||
    Object.values(f.defenses).some((l) => l.length);
  const has = (k) => show.includes(k) || (k === "traits" && hasTraits);

  return (
    <>
      {has("traits") && (
        <FilterSection title="Traits">
          <div className="space-y-3">
            <div>
              <div className={labelCls}>Ability bonuses (fixed)</div>
              <NumberMap keys={ABILITIES} value={f.abilityFixed} onChange={(v) => set("abilityFixed", v)} labelOf={(a) => ABILITY_SHORT[a]} signed />
            </div>
            <div>
              <div className={labelCls}>Speed</div>
              <NumberMap keys={SPEED_MODES} value={f.speed} onChange={(v) => set("speed", v)} unit="ft." allowWalk />
            </div>
            <div>
              <div className={labelCls}>Senses</div>
              <NumberMap keys={SENSES} value={f.senses} onChange={(v) => set("senses", v)} unit="ft." />
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
              <div className={labelCls}>Raise one of these</div>
              <ChipToggles options={ABILITIES} selected={f.ability.from} labelOf={(a) => ABILITY_SHORT[a]}
                           onToggle={(a) => patch("ability", { from: toggleIn(f.ability.from, a) })} />
            </div>
            <div>
              <div className={labelCls}>By</div>
              <ChipToggles options={Object.keys(BONUS_SETS)} selected={f.ability.sets}
                           labelOf={(k) => k.split("/").map((n) => `+${n}`).join(" / ")}
                           onToggle={(k) => patch("ability", { sets: toggleIn(f.ability.sets, k) })} />
            </div>
            {(!f.ability.from.length || !f.ability.sets.length) && (
              <p className={hintCls}>Pick abilities and at least one bonus, or nothing is raised.</p>
            )}
          </div>
        </FilterSection>
      )}

      {has("feats") && (
        <FilterSection title="Feat">
          <div className="space-y-3">
            <div>
              <div className={labelCls}>Gives this feat</div>
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
            <PoolEditor label="Saving Throws" options={ABILITIES} groups={POOL_GROUPS.saves} value={f.saves} onChange={(v) => set("saves", v)} />
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
                  <SpellReadyEditor value={sp} onChange={(p) => set("spells", f.spells.map((x, j) => (j === i ? withReady(x, p) : x)))} />
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
  { value: "any", label: "rider" },
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

// Drops the keys a blank was emptied in.
const withKey = (obj, key, v) => {
  const out = { ...obj, [key]: v };
  if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) delete out[key];
  return out;
};

export function DamageEditor({ parts, onChange, label = "Damage", perSlot = false }) {
  const list = parts || [];
  const update = (i, key, v) => onChange(list.map((d, j) => (j === i ? withKey(d, key, v) : d)));
  return (
    <div className="space-y-1">
      {list.map((d, i) => (
        <div key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <ValueField value={d.dice} onChange={(v) => update(i, "dice", v)} placeholder="2d6" label="Dice" />
          <span className="text-xs text-ink-faded">+</span>
          <ValueField value={d.bonus} onChange={(v) => update(i, "bonus", v)} placeholder="0" className="!w-20" label="Bonus" />
          <select value={d.type || ""} onChange={(e) => update(i, "type", e.target.value || undefined)} className={`${fieldCls} !w-36`}>
            <option value="">— type —</option>
            {[...new Set([...DAMAGE_TYPE_OPTIONS, d.type].filter(Boolean))].map((t) => <option key={t} value={t}>{damageTypeLabel(t)}</option>)}
          </select>
          {perSlot && (
            <label className="flex items-baseline gap-1" title="Dice added for each spell slot level above the spell's level">
              <span className="text-xs text-ink-faded">+ per slot</span>
              <input type="text" value={d.per_slot || ""} onChange={(e) => update(i, "per_slot", e.target.value || undefined)} placeholder="1d6"
                     className={`${fieldCls} !w-14`} />
            </label>
          )}
          <input type="text" value={d.condition || ""} onChange={(e) => update(i, "condition", e.target.value || undefined)}
                 placeholder="only if… (optional)" className={`${fieldCls} min-w-[8rem] flex-1`} />
          <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove damage">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...list, { dice: "", type: "" }])} className={addRowCls}>
        + {label.toLowerCase()}
      </button>
    </div>
  );
}

/* spell: also healing and temporary HP, and dice added per slot level
   (upcasting). A cantrip's dice can be a level table: "1: 1d10, 5: 2d10". */
export function ActionEditor({ value, onChange, spell = false }) {
  const a = value || {};
  const set = (key, v) => onChange(withKey(a, key, v));
  const attack = a.attack;
  const save = a.save;
  const setAttack = (key, v) => set("attack", withKey(attack, key, v));
  const setSave = (key, v) => set("save", withKey(save, key, v));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <label className="flex items-baseline gap-1.5">
          <span className="text-xs text-ink-faded">Range / reach</span>
          <input type="text" value={a.range || ""} onChange={(e) => set("range", e.target.value || undefined)} placeholder="reach 10 ft."
                 className={`${fieldCls} !w-36`} />
        </label>
        <label className="flex items-baseline gap-1.5">
          <span className="text-xs text-ink-faded">Area</span>
          <input type="text" value={a.area || ""} onChange={(e) => set("area", e.target.value || undefined)} placeholder="60-foot cone"
                 className={`${fieldCls} !w-36`} />
        </label>
      </div>

      <div className="space-y-1">
        <label className="flex items-baseline gap-2 text-sm">
          <input type="checkbox" checked={!!attack} className="accent-rubric"
                 onChange={(e) => set("attack", e.target.checked ? { kind: "melee", damage: [] } : undefined)} />
          Attack roll
        </label>
        {attack && (
          <div className="space-y-1 border-l border-rule/30 pl-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Segmented size="sm" options={ATTACK_KINDS} value={attack.kind} onChange={(v) => setAttack("kind", v)} />
              <span className="text-xs text-ink-faded">to hit +</span>
              <ValueField value={attack.bonus} onChange={(v) => setAttack("bonus", v)} placeholder="5" className="!w-20" label="To hit" />
            </div>
            <DamageEditor parts={attack.damage} onChange={(v) => setAttack("damage", v)} label="Damage on a hit" perSlot={spell} />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="flex items-baseline gap-2 text-sm">
          <input type="checkbox" checked={!!save} className="accent-rubric"
                 onChange={(e) => set("save", e.target.checked ? { ability: "dex", on_success: "none" } : undefined)} />
          Saving throw{attack ? " (on a hit)" : ""}
        </label>
        {save && (
          <div className="space-y-1 border-l border-rule/30 pl-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <select value={save.ability} onChange={(e) => setSave("ability", e.target.value)} className={`${fieldCls} !w-20`}>
                {ABILITIES.map((ab) => <option key={ab} value={ab}>{ABILITY_SHORT[ab]}</option>)}
              </select>
              <span className="text-xs text-ink-faded">DC</span>
              <ValueField value={save.dc} onChange={(v) => setSave("dc", v)} placeholder="13" className="!w-20" label="DC" />
              <span className="text-xs text-ink-faded">on a success</span>
              <Segmented size="sm" options={ON_SUCCESS} value={save.on_success || "none"} onChange={(v) => setSave("on_success", v)} />
            </div>
            <DamageEditor parts={save.damage} onChange={(v) => setSave("damage", v)} label="Damage on a failure" perSlot={spell} />
            <FoldChips label="Conditions on a failure" options={CONDITIONS} selected={save.conditions || []}
                       onToggle={(c) => setSave("conditions", toggleIn(save.conditions || [], c))} />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="flex items-baseline gap-2 text-sm">
          <input type="checkbox" checked={!!a.damage} className="accent-rubric"
                 onChange={(e) => set("damage", e.target.checked ? [{ dice: "", type: "" }] : undefined)} />
          Damage with no roll (an aura, a sure hit)
        </label>
        {a.damage && (
          <div className="border-l border-rule/30 pl-3">
            <DamageEditor parts={a.damage} onChange={(v) => set("damage", v.length ? v : undefined)} perSlot={spell} />
          </div>
        )}
      </div>

      {spell && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-xs text-ink-faded">Heals</span>
          <ValueField value={a.heal} onChange={(v) => set("heal", v)} placeholder="2d8 + spell_mod" className="!w-32" label="Healing" />
          <span className="text-xs text-ink-faded">+ per slot</span>
          <input type="text" value={a.heal_per_slot || ""} onChange={(e) => set("heal_per_slot", e.target.value || undefined)} placeholder="2d8"
                 className={`${fieldCls} !w-14`} />
          <span className="ml-4 text-xs text-ink-faded">Temporary HP</span>
          <ValueField value={a.temp_hp} onChange={(v) => set("temp_hp", v)} placeholder="—" className="!w-24" label="Temporary HP" />
          <span className="text-xs text-ink-faded">+ per slot</span>
          <input type="text" value={a.temp_hp_per_slot || ""} onChange={(e) => set("temp_hp_per_slot", e.target.value || undefined)} placeholder="5"
                 className={`${fieldCls} !w-14`} />
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

const FEATURE_USES = [
  { value: "", label: "no limit" },
  { value: "long", label: "per long rest" },
  { value: "short", label: "per short rest" },
];
const LEVEL_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

export function FeaturesEditor({
  features, onChange, categories = ["actions", "bonus_actions", "reactions", "traits"], spell = false, hint,
  levels = false, withText = false, newLevel = 1,
}) {
  const [open, setOpen] = useState(null);
  const list = features || [];
  const nameOf = Object.fromEntries(list.filter((f) => f.id).map((f) => [f.id, f.name]));
  const patch = (i, key, v) =>
    onChange(list.map((f, j) => {
      if (j !== i) return f;
      const next = { ...f, [key]: v };
      if (v === undefined) delete next[key];
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
              <>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {levels && (
                    <select value={f.level ?? 1} onChange={(e) => patch(i, "level", Number(e.target.value))} className={`${fieldCls} !w-20`} aria-label="Level">
                      {LEVEL_OPTIONS.map((l) => <option key={l} value={l}>Lv {l}</option>)}
                    </select>
                  )}
                  <input type="text" value={f.name || ""} onChange={(e) => patch(i, "name", e.target.value)} placeholder="name"
                         className={`${fieldCls} min-w-[10rem] flex-1`} />
                  <select value={f.category || categories[0]} onChange={(e) => patch(i, "category", e.target.value)} className={`${fieldCls} !w-40`}>
                    {[...new Set([...categories, f.category].filter(Boolean))].map((c) => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c] || labelFromId(c)}</option>
                    ))}
                  </select>
                  {levels && (
                    <label className="flex items-baseline gap-1.5 text-sm" title="An optional class feature (Tasha's): the player may take it">
                      <input type="checkbox" checked={!!f.optional} onChange={(e) => patch(i, "optional", e.target.checked || undefined)} className="accent-rubric" />
                      optional
                    </label>
                  )}
                </div>
                {withText && <TextField value={f.text || ""} onChange={(v) => patch(i, "text", v)} rows={4} placeholder="What it does…" />}
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-xs text-ink-faded">Uses</span>
                  <Segmented size="sm" options={FEATURE_USES} value={["long", "short"].includes(f.uses?.reset) ? f.uses.reset : ""}
                             onChange={(r) => patch(i, "uses", r ? { ...f.uses, max: f.uses?.max ?? 1, reset: r } : undefined)} />
                  {f.uses && (
                    <ValueField value={f.uses.max} onChange={(v) => patch(i, "uses", { ...f.uses, max: v })} placeholder="1" className="!w-24" label="How many" />
                  )}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faded">Numbers the sheet and dice tower use</div>
                <ActionEditor value={f.action} spell={spell} onChange={(a) => patch(i, "action", a && Object.keys(a).length ? a : undefined)} />
                {(f.toggle || f.modifiers?.length || f.consumes || f.choices?.length) && (
                  <p className={hintCls}>
                    Also kept as they are: {[
                      f.toggle && "what it does while switched on",
                      f.modifiers?.length && plural(f.modifiers.length, "modifier"),
                      f.consumes && `its cost (${describeConsumes(f.consumes)})`,
                      f.choices?.length && plural(f.choices.length, "pick"),
                    ].filter(Boolean).join(", ")}.
                  </p>
                )}
              </>
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
