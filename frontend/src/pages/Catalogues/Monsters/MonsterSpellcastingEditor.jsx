import React from "react";
import { chip, fieldCls, hintCls, addRowCls, removeRowCls, textareaCls } from "../catalogueStyle";
import { EntryPicker, Segmented } from "../catalogueParts";
import { ABILITIES, ABILITY_SHORT, numOrNull, nameFromId } from "../catalogueHelpers";
import { CATEGORY_OPTIONS, emptySpellBlock, spellGroupLabel } from "./monsterHelpers";

const GROUP_KINDS = [
  { value: "at_will", label: "at will" },
  { value: "daily", label: "per day" },
  { value: "slots", label: "spell slots" },
];

const kindOf = (g) => (g.how === "at_will" ? "at_will" : g.per === "day" && !g.how ? "daily" : g.how ? "other" : g.slots != null || g.level != null ? "slots" : g.uses != null ? "other" : "at_will");

// Switching a group's kind keeps its spells and drops the old numbers.
const groupFor = (kind, g) =>
  kind === "at_will" ? { how: "at_will", spells: g.spells }
  : kind === "daily" ? { uses: g.uses ?? 1, per: "day", each: true, spells: g.spells }
  : { level: g.level || 1, slots: g.slots ?? 2, spells: g.spells };

/* A statblock's spellcasting blocks: the book's line (ability, DC,
   attack), where the block is listed (traits or actions), and its spell
   groups (at will · N/day each · level N with slots), each a list of
   spells from the spell catalogue. */
export default function MonsterSpellcastingEditor({ blocks, onChange, spells, index }) {
  const list = blocks || [];
  const update = (i, p) => onChange(list.map((b, j) => (j === i ? { ...b, ...p } : b)));
  return (
    <div className="space-y-4">
      {list.length === 0 && <p className={hintCls}>No spellcasting.</p>}
      {list.map((b, i) => (
        <Block key={i} block={b} spells={spells} index={index} onPatch={(p) => update(i, p)}
               onRemove={() => onChange(list.filter((_, j) => j !== i))} />
      ))}
      <button type="button" onClick={() => onChange([...list, emptySpellBlock()])} className={addRowCls}>+ spellcasting</button>
    </div>
  );
}

function Block({ block: b, spells, index, onPatch, onRemove }) {
  const groups = b.groups || [];
  const setGroup = (i, g) => onPatch({ groups: groups.map((x, j) => (j === i ? g : x)) });
  return (
    <div className="space-y-2 border-l border-rule/30 pl-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <input type="text" value={b.name || ""} onChange={(e) => onPatch({ name: e.target.value })} placeholder="Spellcasting"
               className={`${fieldCls} min-w-[10rem] flex-1`} />
        <select value={b.display_as || "traits"} onChange={(e) => onPatch({ display_as: e.target.value === "traits" ? undefined : e.target.value })}
                className={`${fieldCls} !w-44`} aria-label="Listed under">
          {CATEGORY_OPTIONS.slice(0, 5).map((o) => <option key={o.value} value={o.value}>listed as {o.label.toLowerCase()}</option>)}
        </select>
        <button type="button" onClick={onRemove} className={removeRowCls} aria-label="Remove spellcasting">✕</button>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs text-ink-faded">Ability</span>
        <select value={b.ability || ""} onChange={(e) => onPatch({ ability: e.target.value || undefined })} className={`${fieldCls} !w-20`}>
          <option value="">—</option>
          {ABILITIES.map((a) => <option key={a} value={a}>{ABILITY_SHORT[a]}</option>)}
        </select>
        <span className="text-xs text-ink-faded">save DC</span>
        <input type="number" value={b.dc ?? ""} onChange={(e) => onPatch({ dc: numOrNull(e.target.value) ?? undefined })} placeholder="—"
               className={`${fieldCls} !w-14`} />
        <span className="text-xs text-ink-faded">spell attack +</span>
        <input type="number" value={b.attack ?? ""} onChange={(e) => onPatch({ attack: numOrNull(e.target.value) ?? undefined })} placeholder="—"
               className={`${fieldCls} !w-14`} />
      </div>
      <textarea value={b.text || ""} onChange={(e) => onPatch({ text: e.target.value })} rows={2} className={textareaCls}
                placeholder="The mage casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC 14):" />

      {groups.map((g, i) => {
        const kind = kindOf(g);
        const setSpells = (list) => setGroup(i, { ...g, spells: list });
        return (
          <div key={i} className="space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {kind === "other" ? (
                <span className="text-sm italic">{spellGroupLabel(g)}</span>
              ) : (
                <Segmented size="sm" options={GROUP_KINDS} value={kind} onChange={(k) => setGroup(i, groupFor(k, g))} />
              )}
              {kind === "daily" && (
                <>
                  <input type="number" min={1} value={g.uses ?? 1} onChange={(e) => setGroup(i, { ...g, uses: numOrNull(e.target.value) ?? 1 })}
                         className={`${fieldCls} !w-12`} aria-label="Times per day" />
                  <span className="text-xs text-ink-faded">/day</span>
                  <label className="flex items-baseline gap-1.5 text-sm">
                    <input type="checkbox" checked={!!g.each} onChange={(e) => setGroup(i, { ...g, each: e.target.checked || undefined })} className="accent-rubric" />
                    each
                  </label>
                </>
              )}
              {kind === "slots" && (
                <>
                  <span className="text-xs text-ink-faded">level</span>
                  <select value={g.level ?? 1} onChange={(e) => setGroup(i, { ...g, level: Number(e.target.value) })} className={`${fieldCls} !w-24`}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => <option key={l} value={l}>{l === 0 ? "cantrips" : l}</option>)}
                  </select>
                  {g.level !== 0 && (
                    <>
                      <input type="number" min={0} value={g.slots ?? ""} onChange={(e) => setGroup(i, { ...g, slots: numOrNull(e.target.value) ?? undefined })}
                             className={`${fieldCls} !w-12`} aria-label="Slots" />
                      <span className="text-xs text-ink-faded">slots</span>
                    </>
                  )}
                </>
              )}
              <span className="flex-1" />
              <button type="button" onClick={() => onPatch({ groups: groups.filter((_, j) => j !== i) })} className={removeRowCls}
                      aria-label="Remove this group">✕</button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {(g.spells || []).map((s, j) => (
                <button key={`${s.spell || s.text}-${j}`} type="button" title="Remove" className={chip(true)}
                        onClick={() => setSpells(g.spells.filter((_, k) => k !== j))}>
                  {s.spell ? nameFromId(s.spell, index) : s.text}{s.note ? ` ${s.note}` : ""} <span aria-hidden className="text-ink-faded">✕</span>
                </button>
              ))}
            </div>
            <EntryPicker entries={spells} selected={[]} index={index} placeholder="add a spell…"
                         onToggle={(id) => setSpells([...(g.spells || []), { spell: id }])} />
          </div>
        );
      })}
      <button type="button" onClick={() => onPatch({ groups: [...groups, { uses: 1, per: "day", each: true, spells: [] }] })} className={addRowCls}>
        + spell group
      </button>
    </div>
  );
}
