import React, { useState } from "react";
import { chip, fieldCls, hintCls, addRowCls, removeRowCls } from "../catalogueStyle";
import { ChipToggles, Segmented } from "../catalogueParts";
import { ABILITIES, ABILITY_SHORT, FEATURE_TYPES, describeChoice, formatFeatureType, numOrNull, toggleIn } from "../catalogueHelpers";
import { LEVELS, PICK_KINDS, PROGRESSIONS, makePick, pickWords, standardSlots } from "./classHelpers";

/* ═══════════════════════════════════════════════════════════════════
   classFormParts — the pieces the class and subclass forms share:
     <AbilityGroupsEditor>   "Str or Dex" / "Dex 13 and Wis 13" groups
     <ColumnsEditor>         the class table's own columns
     <ResourcesEditor>       pools features spend (superiority dice…)
     <SpellcastingEditor>    ability, caster kind, spell list, cantrips,
                             prepared / known, slots
     <ProgressionEditor>     what each level gives: its features (from
                             the features list), picks, subclass levels
   Level tables are typed as "1: 2, 4: 3, 10: 4" (the value from that
   level on); a formula ("class_level + wis_mod") works too.
   ═══════════════════════════════════════════════════════════════════ */

export const TABLE_HINT = "Typed as level: value, e.g. 1: 2, 4: 3, 10: 4 (the value from that level on); a formula like class_level + wis_mod works too.";

/* withScores = false: [["str"], ["dex"]] (Strength or Dexterity)
   withScores = true:  [{str: 13}, {dex: 13}] (Str 13 or Dex 13)
   Inside a group every ability is needed; any one group is enough. */
export function AbilityGroupsEditor({ groups, onChange, withScores = false }) {
  const list = groups || [];
  const abilitiesOf = (g) => (withScores ? Object.keys(g) : g);
  const setGroup = (i, g) => onChange(list.map((x, j) => (j === i ? g : x)));
  const toggleAbility = (i, a) => {
    const g = list[i];
    if (!withScores) return setGroup(i, toggleIn(g, a));
    const next = { ...g };
    if (a in next) delete next[a];
    else next[a] = 13;
    return setGroup(i, next);
  };
  return (
    <div className="space-y-1">
      {list.map((g, i) => (
        <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {i > 0 && <span className="text-xs italic text-ink-faded">or</span>}
          <ChipToggles options={ABILITIES} selected={abilitiesOf(g)} labelOf={(a) => ABILITY_SHORT[a]} onToggle={(a) => toggleAbility(i, a)} />
          {withScores &&
            Object.entries(g).map(([a, n]) => (
              <label key={a} className="flex items-baseline gap-1">
                <span className="text-xs text-ink-faded">{ABILITY_SHORT[a]}</span>
                <input type="number" min={1} max={30} value={n} onChange={(e) => setGroup(i, { ...g, [a]: numOrNull(e.target.value) ?? 13 })}
                       className={`${fieldCls} !w-12`} />
              </label>
            ))}
          <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...list, withScores ? { str: 13 } : ["str"]])} className={addRowCls}>
        {list.length ? "+ or…" : "+ add"}
      </button>
    </div>
  );
}

// [{ id, name, values: "1: 2, 4: 3" }]
export function ColumnsEditor({ columns, onChange }) {
  const set = (i, p) => onChange(columns.map((c, j) => (j === i ? { ...c, ...p } : c)));
  return (
    <div className="space-y-1">
      {columns.length === 0 && <p className={hintCls}>No columns of its own (rages, sneak attack dice, invocations known…).</p>}
      {columns.map((c, i) => (
        <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <input type="text" value={c.name || ""} onChange={(e) => set(i, { name: e.target.value })} placeholder="column name (Rages)" className={`${fieldCls} !w-44`} />
          <input type="text" value={c.values} onChange={(e) => set(i, { values: e.target.value })} placeholder="1: 2, 3: 3, 6: 4"
                 className={`${fieldCls} min-w-[12rem] flex-1`} />
          {c.id && <span className="text-[10px] text-ink-faint" title="Formulas can use this id">{c.id}</span>}
          <button type="button" onClick={() => onChange(columns.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove column">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...columns, { name: "", values: "" }])} className={addRowCls}>+ column</button>
    </div>
  );
}

const RESETS = [
  { value: "short", label: "short rest" },
  { value: "long", label: "long rest" },
];

// [{ id, name, max: "1: 2, 4: 3", die: "3: d8, 10: d10", reset, short_rest }]
export function ResourcesEditor({ resources, onChange }) {
  const set = (i, p) => onChange(resources.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <div className="space-y-2">
      {resources.length === 0 && <p className={hintCls}>No pools (superiority dice, focus points, channel divinity…).</p>}
      {resources.map((r, i) => (
        <div key={i} className="space-y-1 border-l border-rule/30 pl-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <input type="text" value={r.name || ""} onChange={(e) => set(i, { name: e.target.value })} placeholder="Superiority Dice" className={`${fieldCls} !w-44`} />
            {r.id && <span className="text-[10px] text-ink-faint" title="Features spend from this id">{r.id}</span>}
            <span className="flex-1" />
            <button type="button" onClick={() => onChange(resources.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove">✕</button>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-xs text-ink-faded">How many</span>
            <input type="text" value={r.max} onChange={(e) => set(i, { max: e.target.value })} placeholder="3: 4, 7: 5, 15: 6" className={`${fieldCls} !w-40`} />
            <span className="text-xs text-ink-faded">die</span>
            <input type="text" value={r.die} onChange={(e) => set(i, { die: e.target.value })} placeholder="3: d8, 10: d10" className={`${fieldCls} !w-32`} />
            <span className="text-xs text-ink-faded">back on a</span>
            <Segmented size="sm" options={RESETS} value={r.reset || ""} onChange={(v) => set(i, { reset: v })} />
            {r.reset === "long" && (
              <label className="flex items-baseline gap-1.5" title="What a short rest gives back (2024 Channel Divinity: 1)">
                <span className="text-xs text-ink-faded">short rest gives</span>
                <input type="text" value={r.short_rest ?? ""} onChange={(e) => set(i, { short_rest: e.target.value === "" ? undefined : numOrNull(e.target.value) ?? e.target.value })}
                       placeholder="—" className={`${fieldCls} !w-12`} />
              </label>
            )}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...resources, { name: "", max: "", die: "", reset: "long" }])} className={addRowCls}>+ pool</button>
    </div>
  );
}

const PROGRESSION_OPTIONS = Object.entries(PROGRESSIONS).map(([value, label]) => ({ value, label }));
const CHANGE_OPTIONS = [
  { value: "", label: "—" },
  { value: "level", label: "one per level" },
  { value: "long_rest", label: "after a long rest" },
];

/* value: the spellcasting form (classHelpers.emptySpellcasting).
   lists: class ids for the spell-list pick. A caster kind fills in the
   standard spell slots; pact magic uses its own two rows instead. */
export function SpellcastingEditor({ value, onChange, lists = [] }) {
  const s = value;
  const set = (p) => onChange({ ...s, ...p });
  const setProgression = (progression) => set({ progression, slots: standardSlots(progression) ?? (progression === "pact" ? undefined : s.slots) });
  const slotSummary = s.slots
    ? Object.entries(s.slots).map(([l, a]) => `${l}: ${a.join("/")}`).join(" · ")
    : "";
  return (
    <div className="space-y-2">
      <label className="flex items-baseline gap-2 text-sm">
        <input type="checkbox" checked={s.on} onChange={(e) => set({ on: e.target.checked, progression: s.progression || "full", slots: s.slots ?? standardSlots(s.progression || "full") })}
               className="accent-rubric" />
        It casts spells
      </label>
      {s.on && (
        <div className="space-y-2 border-l border-rule/30 pl-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-xs text-ink-faded">Ability</span>
            <select value={s.ability} onChange={(e) => set({ ability: e.target.value })} className={`${fieldCls} !w-20`}>
              {ABILITIES.map((a) => <option key={a} value={a}>{ABILITY_SHORT[a]}</option>)}
            </select>
            <span className="text-xs text-ink-faded">Spell list</span>
            <select value={s.list} onChange={(e) => set({ list: e.target.value })} className={`${fieldCls} !w-44`}>
              <option value="">— its own / none —</option>
              {[...new Set([...lists, s.list].filter(Boolean))].map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <Segmented size="sm" options={PROGRESSION_OPTIONS} value={s.progression} onChange={setProgression} />
          {s.progression !== "pact" && (
            <p className={hintCls}>
              Spell slots: {slotSummary || "none"}{" "}
              {standardSlots(s.progression) && (
                <button type="button" onClick={() => set({ slots: standardSlots(s.progression) })} className="not-italic underline decoration-dotted hover:text-rubric">
                  use the standard table
                </button>
              )}
            </p>
          )}
          {s.progression === "pact" && (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs text-ink-faded">Pact slots</span>
              <input type="text" value={s.pactSlots} onChange={(e) => set({ pactSlots: e.target.value })} placeholder="1: 1, 2: 2, 11: 3, 17: 4" className={`${fieldCls} !w-44`} />
              <span className="text-xs text-ink-faded">slot level</span>
              <input type="text" value={s.pactLevel} onChange={(e) => set({ pactLevel: e.target.value })} placeholder="1: 1, 3: 2, 5: 3, 7: 4, 9: 5" className={`${fieldCls} !w-44`} />
            </div>
          )}
          <div className="grid gap-x-3 gap-y-1 sm:grid-cols-[8rem_1fr]">
            <span className="text-xs text-ink-faded">Cantrips</span>
            <input type="text" value={s.cantrips} onChange={(e) => set({ cantrips: e.target.value })} placeholder="1: 3, 4: 4, 10: 5" className={fieldCls} />
            <span className="text-xs text-ink-faded">Prepared spells</span>
            <input type="text" value={s.prepared} onChange={(e) => set({ prepared: e.target.value })} placeholder="1: 4, 2: 5… or class_level + wis_mod" className={fieldCls} />
            <span className="text-xs text-ink-faded">Spells known</span>
            <input type="text" value={s.known} onChange={(e) => set({ known: e.target.value })} placeholder="(2014 known casters)" className={fieldCls} />
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-xs text-ink-faded">Changing spells</span>
            <Segmented size="sm" options={CHANGE_OPTIONS} value={s.change} onChange={(v) => set({ change: v })} />
            <span className="ml-4 text-xs text-ink-faded">Spellbook</span>
            <input type="number" min={0} value={s.spellbookFirst ?? ""} placeholder="—" onChange={(e) => set({ spellbookFirst: numOrNull(e.target.value) })}
                   className={`${fieldCls} !w-12`} aria-label="Spells in the book at level 1" />
            <span className="text-xs text-ink-faded">+</span>
            <input type="number" min={0} value={s.spellbookPerLevel ?? ""} placeholder="—" onChange={(e) => set({ spellbookPerLevel: numOrNull(e.target.value) })}
                   className={`${fieldCls} !w-12`} aria-label="Spells added per level" />
            <span className="text-xs text-ink-faded">per level</span>
          </div>
        </div>
      )}
    </div>
  );
}

const PICK_OPTIONS = (isSubclass) => Object.entries(PICK_KINDS).filter(([k]) => !(isSubclass && k === "subclass"));

/* rows: { level: { features, choices, subclass_features, upgrades } }.
   A level's features come from the features list (by their level) and
   are shown here, not edited; picks are added from the common kinds. */
export function ProgressionEditor({ rows, onChange, features, edition, classId, subclassTitle, isSubclass = false, index }) {
  const [adding, setAdding] = useState(null); // { level, kind, type, count }
  const setRow = (level, p) => onChange({ ...rows, [level]: { ...rows[level], ...p } });
  const nameOf = Object.fromEntries((features || []).map((f) => [f.id, f.name]));
  const add = () => {
    const pick = makePick(adding.kind, { level: adding.level, edition, classId, subclassTitle, featureType: adding.type, count: adding.count });
    if (pick) setRow(adding.level, { choices: [...rows[adding.level].choices, pick] });
    setAdding(null);
  };
  return (
    <div>
      <p className={`${hintCls} mb-2`}>
        Features land on their level from the features list below. Here: the picks each level gives{isSubclass ? "" : " and the levels a subclass gives a feature"}.
      </p>
      <table className="w-full text-sm">
        <tbody>
          {LEVELS.map((level) => {
            const row = rows[level];
            const here = (features || []).filter((f) => !f.parent && f.level === level);
            const isAdding = adding?.level === level;
            return (
              <tr key={level} className="border-b border-dotted border-rule/25 align-baseline">
                <td className="w-10 py-1 pr-2 text-xs font-semibold text-rubric">{level}</td>
                <td className="py-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {here.map((f, i) => <span key={f.id || i} className="italic">{f.name || "(no name)"}</span>)}
                    {row.upgrades.map((id) => (
                      <span key={id} className="text-ink-faded" title="Its text is in the earlier feature">↑ {nameOf[id] || id}</span>
                    ))}
                    {row.choices.map((c, i) => {
                      const d = describeChoice(c, index);
                      return (
                        <button key={c.id || i} type="button" className={chip(true)} title="Remove this pick"
                                onClick={() => setRow(level, { choices: row.choices.filter((_, j) => j !== i) })}>
                          {c.label || d?.label}{pickWords(c) ? `: ${pickWords(c)}` : ""} <span aria-hidden className="text-ink-faded">✕</span>
                        </button>
                      );
                    })}
                    {!isSubclass && (
                      <label className="flex items-baseline gap-1.5 text-xs text-ink-faded">
                        <input type="checkbox" checked={row.subclass_features} onChange={(e) => setRow(level, { subclass_features: e.target.checked })} className="accent-rubric" />
                        subclass feature
                      </label>
                    )}
                    {!isAdding && (
                      <button type="button" onClick={() => setAdding({ level, kind: "", type: "maneuver", count: 1 })} className={addRowCls}>+ pick</button>
                    )}
                  </div>
                  {isAdding && (
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <select value={adding.kind} onChange={(e) => setAdding({ ...adding, kind: e.target.value })} className={`${fieldCls} !w-64`}>
                        <option value="">— what is picked —</option>
                        {PICK_OPTIONS(isSubclass).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                      </select>
                      {adding.kind === "optional_features" && (
                        <select value={adding.type} onChange={(e) => setAdding({ ...adding, type: e.target.value })} className={`${fieldCls} !w-44`}>
                          {Object.keys(FEATURE_TYPES).map((t) => <option key={t} value={t}>{formatFeatureType(t)}</option>)}
                        </select>
                      )}
                      {["optional_features", "weapon_mastery"].includes(adding.kind) && (
                        <input type="number" min={1} value={adding.count} onChange={(e) => setAdding({ ...adding, count: numOrNull(e.target.value) ?? 1 })}
                               className={`${fieldCls} !w-12`} aria-label="How many" />
                      )}
                      <button type="button" onClick={add} disabled={!adding.kind} className={addRowCls}>add</button>
                      <button type="button" onClick={() => setAdding(null)} className={removeRowCls}>cancel</button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
