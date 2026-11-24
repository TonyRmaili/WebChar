import React from "react";
import { AsidePanel, fieldCls, hintCls, labelCls, addRowCls, removeRowCls } from "../catalogueStyle";
import { ChipToggles, FeatureFields, Segmented } from "../catalogueParts";
import { ABILITIES, ABILITY_SHORT, numOrNull, toggleIn } from "../catalogueHelpers";
import { LEVELS, PREP_STYLES, featureRef, newFeatureAt, rebaseSteps, standardNumbers } from "./classHelpers";

/* ═══════════════════════════════════════════════════════════════════
   classFormParts — the pieces the class and subclass forms share:
     <AbilityGroupsEditor>   "Str or Dex" / "Dex 13 and Wis 13" groups
     <ResourcesEditor>       pools that aren't a column of the table
                             (superiority dice, Lay on Hands…)
     <SpellcastingEditor>    ability, list, caster kind, how it
                             prepares (the numbers are in the table)
     <FeatureAside>          one feature, in the window beside the form
   The class table itself is ClassTableEditor.
   ═══════════════════════════════════════════════════════════════════ */

export const FEATURE_CATEGORIES = ["traits", "actions", "bonus_actions", "reactions", "riders"];

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

export const RESET_OPTIONS = [
  { value: "short", label: "short rest" },
  { value: "long", label: "long rest" },
];

/* Pools that aren't a column of the class table: ones with a die
   (superiority dice), a formula (Lay on Hands: 5 × level) or numbers
   of their own. [{ id, name, max: "1: 2, 4: 3", die: "3: d8, 10: d10", reset, short_rest }] */
export function ResourcesEditor({ resources, onChange }) {
  const set = (i, p) => onChange(resources.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <div className="space-y-2">
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
            <input type="text" value={r.max} onChange={(e) => set(i, { max: e.target.value })} placeholder="3: 4, 7: 5 or 5 * class_level" className={`${fieldCls} !w-48`} />
            <span className="text-xs text-ink-faded">die</span>
            <input type="text" value={r.die} onChange={(e) => set(i, { die: e.target.value })} placeholder="3: d8, 10: d10" className={`${fieldCls} !w-32`} />
            <span className="text-xs text-ink-faded">back on a</span>
            <Segmented size="sm" options={RESET_OPTIONS} value={r.reset || ""} onChange={(v) => set(i, { reset: v })} />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...resources, { name: "", max: "", die: "", reset: "long" }])} className={addRowCls}>+ pool</button>
      <p className={hintCls}>Typed as level: value, e.g. 3: 4, 7: 5 (from that level on), or a formula like 5 * class_level.</p>
    </div>
  );
}

/* One "Half": it casts from the level it starts (a class: level 1, a
   subclass: its first level), saved as half_up. A book's 2014 half
   caster ("half": from level 2) stays as it is until another kind is
   picked; it shows as Half. */
const PROGRESSION_OPTIONS = [
  { value: "full", label: "Full" },
  { value: "half_up", label: "Half" },
  { value: "third", label: "Third" },
  { value: "pact", label: "Pact Magic" },
];
const sameSteps = (a, b) => JSON.stringify(a || {}) === JSON.stringify(b || {});
const isEmptySteps = (t) => !t || Object.keys(t).length === 0;

/* value: the spellcasting form (classHelpers.emptySpellcasting).
   Four picks that don't depend on each other: ability · spell list ·
   caster kind · how it prepares (PREP_STYLES). The numbers (slots,
   prepared, cantrips) are columns of the class table: the caster kind
   fills them in; a cell changed there keeps its number when the kind
   changes (↺ puts the standard ones back). classes: the spell-list pick. */
export function SpellcastingEditor({ value, onChange, classes = [], startsAt = 1 }) {
  const s = value;
  const set = (p) => onChange({ ...s, ...p });
  const std = standardNumbers(s.progression, startsAt);
  const keys = Object.keys(std).filter((k) => !(k === "prepared" && s.prepFormula));
  const changed = keys.some((k) => !sameSteps(s[k], std[k]));

  // A new kind fills in its numbers; a cell changed by hand keeps its number.
  const setProgression = (progression) => {
    const now = standardNumbers(progression, startsAt);
    const p = { progression };
    for (const k of Object.keys(now)) p[k] = rebaseSteps(s[k], std[k], now[k]);
    set(p);
  };
  const turnOn = (on) => {
    if (!on) return set({ on });
    const progression = s.progression || "full";
    const now = standardNumbers(progression, startsAt);
    const p = { on, progression };
    for (const k of Object.keys(now)) if (isEmptySteps(s[k])) p[k] = now[k];
    set(p);
  };

  const lists = [...classes].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  return (
    <div className="space-y-3">
      <label className="flex items-baseline gap-2 text-sm">
        <input type="checkbox" checked={s.on} onChange={(e) => turnOn(e.target.checked)} className="accent-rubric" />
        It casts spells
      </label>
      {s.on && (
        <div className="space-y-4 border-l border-rule/30 pl-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={`${labelCls} !mb-0`}>Spellcasting ability</span>
            <select value={s.ability} onChange={(e) => set({ ability: e.target.value })} className={`${fieldCls} !w-20`}>
              {ABILITIES.map((a) => <option key={a} value={a}>{ABILITY_SHORT[a]}</option>)}
            </select>
            <span className={`${labelCls} !mb-0 ml-3`}>Spell list</span>
            <select value={s.list} onChange={(e) => set({ list: e.target.value })} className={`${fieldCls} !w-56`}>
              <option value="">— its own —</option>
              {lists.map((c) => <option key={c.id} value={c.id}>{c.name}{c.source ? ` (${c.source})` : ""}</option>)}
              {s.list && !lists.some((c) => c.id === s.list) && <option value={s.list}>{s.list}</option>}
            </select>
          </div>

          <div>
            <div className={labelCls}>Caster kind</div>
            <Segmented size="sm" options={PROGRESSION_OPTIONS} value={s.progression === "half" ? "half_up" : s.progression}
                       onChange={(v) => v !== (s.progression === "half" ? "half_up" : s.progression) && setProgression(v)} />
            <p className={`${hintCls} mt-1`}>
              The spell slots it gets, and the standard numbers of spells and cantrips for that kind.
              {startsAt > 1 && ` It casts from level ${startsAt}, when the subclass is picked; the numbers follow the class level, as they do when multiclassing.`}
              {s.progression === "half" && " (This book class is a 2014 half caster: it starts casting at level 2.)"}
            </p>
          </div>

          <div>
            <div className={labelCls}>How it prepares spells</div>
            <div className="space-y-1">
              {PREP_STYLES.map((o) => (
                <label key={o.value} className="flex items-baseline gap-2 text-sm">
                  <input type="radio" name="prep-style" checked={s.style === o.value} onChange={() => set({ style: o.value })} className="accent-rubric" />
                  <span>
                    <span className="font-semibold">{o.label}</span> <span className="text-ink-faded">(like {o.like})</span>
                    <span className="block text-xs italic text-ink-faded">{o.words}</span>
                  </span>
                </label>
              ))}
            </div>
            {s.style === "book" && (
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 pl-6">
                <span className="text-xs text-ink-faded">The book starts with</span>
                <input type="number" min={0} value={s.spellbookFirst ?? ""} onChange={(e) => set({ spellbookFirst: numOrNull(e.target.value) })}
                       className={`${fieldCls} !w-12`} aria-label="Spells in the book at its first level" />
                <span className="text-xs text-ink-faded">spells and gets</span>
                <input type="number" min={0} value={s.spellbookPerLevel ?? ""} onChange={(e) => set({ spellbookPerLevel: numOrNull(e.target.value) })}
                       className={`${fieldCls} !w-12`} aria-label="Spells written per level" />
                <span className="text-xs text-ink-faded">more each level</span>
              </div>
            )}
          </div>

          {s.prepFormula && (
            <p className="text-sm">
              <span className="text-ink-faded">Spells prepared:</span> <span className="font-semibold">{s.prepFormula}</span>{" "}
              <span className={hintCls}>(the book's formula, worked out from the character)</span>
              <button type="button" onClick={() => set({ prepFormula: "", prepared: std.prepared })} className={`${addRowCls} ml-2`}>use a column instead</button>
            </p>
          )}

          <p className={hintCls}>
            The numbers (spell slots{s.prepFormula ? "" : ", spells prepared"} and cantrips) are columns of the Class Table, filled in for this caster kind; change any cell there.
            {changed && (
              <button type="button" onClick={() => set(Object.fromEntries(keys.map((k) => [k, std[k]])))} className="ml-2 not-italic underline decoration-dotted hover:text-rubric">
                ↺ back to the standard numbers
              </button>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

/* One feature in the window beside the form (opened from the class
   table): all its fields, the options inside it (Maneuver Options…), and
   "remove". features / onFeatures: the form's list; openRef: the open
   feature (featureRef); onOpen(ref) moves to another; onRemove(ref).
   levelOptions: the levels it can sit on (a subclass: its levels). */
export function FeatureAside({ features, onFeatures, openRef, onOpen, onClose, onRemove, pools = [], index, levelOptions = LEVELS }) {
  const i = features.findIndex((x) => featureRef(x) === openRef);
  if (i < 0) return null;
  const f = features[i];
  // patch(key, value) or patch({ key: value, … }); undefined removes a key
  const patch = (key, v) => {
    const p = typeof key === "object" ? key : { [key]: v };
    onFeatures(features.map((x, j) => {
      // an option moves with its feature to another level
      if (j !== i) return "level" in p && x.parent === openRef ? { ...x, level: p.level } : x;
      const next = { ...x, ...p };
      for (const [k, val] of Object.entries(p)) if (val === undefined) delete next[k];
      return next;
    }));
  };
  const parent = f.parent ? features.find((x) => featureRef(x) === f.parent) : null;
  const kids = features.filter((x) => x.parent === openRef);
  const addKid = () => {
    const k = newFeatureAt(f.level, { parent: openRef, category: f.category || "traits" });
    onFeatures([...features, k]);
    onOpen(featureRef(k));
  };
  const options = levelOptions.includes(f.level ?? 1) ? levelOptions : [...levelOptions, f.level ?? 1].sort((a, b) => a - b);

  return (
    <AsidePanel title={f.name || (parent ? "New option" : "New feature")} onClose={onClose} width="max-w-2xl">
      <div className="space-y-2">
        {parent && (
          <button type="button" onClick={() => onOpen(f.parent)} className="text-xs italic text-ink-faded hover:text-rubric">
            ↑ part of {parent.name || "(no name)"}
          </button>
        )}
        <FeatureFields f={f} patch={patch} categories={FEATURE_CATEGORIES} levels={!parent} levelOptions={options} withText pools={pools} index={index} />

        <div className="pt-2">
          <div className={labelCls}>Options inside it</div>
          {kids.length === 0 && <p className={hintCls}>None (a feature with options to pick, like Maneuver Options, lists them here).</p>}
          {kids.map((k) => (
            <div key={featureRef(k)} className="flex items-baseline gap-2 text-sm">
              <button type="button" onClick={() => onOpen(featureRef(k))} className="min-w-0 flex-1 truncate text-left italic hover:text-rubric">
                {k.name || "(no name)"}
              </button>
              <button type="button" onClick={() => onRemove(featureRef(k))} className={removeRowCls} aria-label="Remove option">✕</button>
            </div>
          ))}
          <button type="button" onClick={addKid} className={addRowCls}>+ option</button>
        </div>

        <div className="pt-3">
          <button type="button" onClick={() => { onRemove(openRef); onClose(); }} className="text-xs italic text-ink-faded hover:text-bad">
            ✕ remove this {parent ? "option" : "feature"}
          </button>
        </div>
      </div>
    </AsidePanel>
  );
}
