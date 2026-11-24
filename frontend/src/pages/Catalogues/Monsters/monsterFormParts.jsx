import React from "react";
import { addRowCls, chip, fieldCls, hintCls, labelCls, removeRowCls, textareaCls } from "../catalogueStyle";
import { ActionEditor, ChipToggles, EntryPicker, FoldChips, Segmented } from "../catalogueParts";
import {
  ABILITIES, ABILITY_SHORT, CONDITIONS, CREATURE_TYPES, DAMAGE_TYPES, SKILL_IDS, labelFromId, nameFromId, numOrNull, textFromValue, titleCase, toggleIn, valueFromText,
} from "../catalogueHelpers";
import {
  CATEGORY_OPTIONS, CR_OPTIONS, DEFENSE_KINDS, DEFENSE_LABELS, SIZE_OPTIONS, SPEED_MODES, abilityMod, crStats, formatDefense, signed, spellGroupLabel,
} from "./monsterHelpers";

/* ═══════════════════════════════════════════════════════════════════
   monsterFormParts — the windows of the monster card (MonsterCardForm).
   Each edits one part of the monster form (monsterHelpers.monsterToForm
   / formToMonster): `form` is the whole form, `set(key, value)` changes
   one key. The feature and spellcasting windows edit one record-shaped
   entry instead (`f` / `block` with `onPatch`).
   ═══════════════════════════════════════════════════════════════════ */

const union = (a, b) => [...new Set([...(a || []), ...(b || [])])];
const SENSE_KEYS = ["darkvision", "blindsight", "tremorsense", "truesight"];

// ─── header ─────────────────────────────────────────────────────────

export function TypeFields({ form, set }) {
  return (
    <>
      <div>
        <div className={labelCls}>Size (several = pick one)</div>
        <ChipToggles options={union(SIZE_OPTIONS, form.size)} selected={form.size} labelOf={titleCase} onToggle={(s) => set("size", toggleIn(form.size, s))} />
      </div>
      <div>
        <div className={labelCls}>Creature type (several = pick one)</div>
        <ChipToggles options={union(CREATURE_TYPES, form.types)} selected={form.types} labelOf={titleCase} onToggle={(t) => set("types", toggleIn(form.types, t))} />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <label className="flex items-baseline gap-2">
          <span className={`${labelCls} !mb-0`}>Tags</span>
          <input type="text" value={form.typeTags} onChange={(e) => set("typeTags", e.target.value)} placeholder="demon, shapechanger" className={`${fieldCls} !w-48`} />
        </label>
        <label className="flex items-baseline gap-2">
          <span className={`${labelCls} !mb-0`}>Swarm of</span>
          <select value={form.swarmOf} onChange={(e) => set("swarmOf", e.target.value)} className={`${fieldCls} !w-32`}>
            <option value="">— not a swarm —</option>
            {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <span className={`${labelCls} !mb-0`}>Alignment</span>
        <input type="text" value={form.alignmentPrefix} onChange={(e) => set("alignmentPrefix", e.target.value)} placeholder="typically"
               className={`${fieldCls} !w-24`} aria-label="Alignment prefix" />
        <input type="text" value={form.alignment} onChange={(e) => set("alignment", e.target.value)} placeholder="chaotic evil"
               className={`${fieldCls} !w-56`} aria-label="Alignment (several: comma between)" />
      </div>
    </>
  );
}

// ─── armor, hit points, speed, initiative ───────────────────────────

export function AcFields({ form, set }) {
  const setAc = (i, p) => set("ac", form.ac.map((a, j) => (j === i ? { ...a, ...p } : a)));
  return (
    <div className="space-y-1">
      {form.ac.map((a, i) => (
        <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {i > 0 && <span className="text-xs italic text-ink-faded">or</span>}
          <input type="number" value={a.value ?? ""} onChange={(e) => setAc(i, { value: numOrNull(e.target.value) })} placeholder="—" className={`${fieldCls} !w-14`} aria-label="AC" />
          <input type="text" value={a.from} onChange={(e) => setAc(i, { from: e.target.value })} placeholder="from (natural armor)" className={`${fieldCls} !w-44`} />
          <input type="text" value={a.condition} onChange={(e) => setAc(i, { condition: e.target.value })} placeholder="when (in bear form)" className={`${fieldCls} !w-40`} />
          <input type="text" value={a.special} onChange={(e) => setAc(i, { special: e.target.value })} placeholder="or a rule in words" className={`${fieldCls} min-w-[8rem] flex-1`} />
          {form.ac.length > 1 && (
            <button type="button" onClick={() => set("ac", form.ac.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove AC">✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => set("ac", [...form.ac, { value: null, from: "", condition: "", special: "" }])} className={addRowCls}>
        + another AC
      </button>
    </div>
  );
}

export function HpFields({ form, set }) {
  const patch = (p) => set("hp", { ...form.hp, ...p });
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <input type="number" min={0} value={form.hp.average ?? ""} onChange={(e) => patch({ average: numOrNull(e.target.value) })} placeholder="—"
             className={`${fieldCls} !w-16`} aria-label="Average" />
      <input type="text" value={form.hp.formula} onChange={(e) => patch({ formula: e.target.value })} placeholder="19d12 + 133" className={`${fieldCls} !w-32`} aria-label="Dice" />
      <input type="text" value={form.hp.special} onChange={(e) => patch({ special: e.target.value })} placeholder="or in words (a summon's HP)"
             className={`${fieldCls} min-w-[8rem] flex-1`} />
    </div>
  );
}

export function SpeedFields({ form, set }) {
  const setSpeed = (k, v) => {
    const next = { ...form.speed };
    if (v == null) delete next[k];
    else next[k] = v;
    set("speed", next);
  };
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
      {SPEED_MODES.map((k) => (
        <label key={k} className="flex items-baseline gap-1.5">
          <span className="text-xs text-ink-faded">{titleCase(k)}</span>
          <input type="number" min={0} value={form.speed[k] ?? ""} placeholder="—" onChange={(e) => setSpeed(k, numOrNull(e.target.value))} className={`${fieldCls} !w-14`} />
        </label>
      ))}
      <label className="flex items-baseline gap-2 text-sm">
        <input type="checkbox" checked={form.hover} onChange={(e) => set("hover", e.target.checked)} className="accent-rubric" />
        hover
      </label>
    </div>
  );
}

export function InitiativeFields({ form, set }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <input type="number" value={form.initiative ?? ""} onChange={(e) => set("initiative", numOrNull(e.target.value))}
             placeholder={signed(abilityMod(form.abilities.dex) ?? 0)} className={`${fieldCls} !w-14`} aria-label="Initiative bonus" />
      <label className="flex items-baseline gap-2 text-sm">
        <input type="checkbox" checked={form.initAdvantage} onChange={(e) => set("initAdvantage", e.target.checked)} className="accent-rubric" />
        with advantage
      </label>
      <span className={hintCls}>Empty = its Dexterity modifier.</span>
    </div>
  );
}

// ─── abilities ──────────────────────────────────────────────────────

export function SavesFields({ form, set }) {
  const pb = form.challenge === "cr" ? form.pb : null;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-6">
        {ABILITIES.map((a) => {
          const mod = abilityMod(form.abilities[a]);
          return (
            <label key={a} className="text-center">
              <div className={labelCls}>{ABILITY_SHORT[a]}</div>
              <input type="text" value={form.saves[a] ?? ""} placeholder={mod == null ? "—" : signed(mod)}
                     onChange={(e) => set("saves", { ...form.saves, [a]: e.target.value })}
                     className={`${fieldCls} !w-14 text-center`} aria-label={`${a} save bonus`}
                     title={pb != null && mod != null ? `Proficient: ${signed(mod + pb)}` : "A proficient save's bonus"} />
            </label>
          );
        })}
      </div>
      <p className={hintCls}>Fill a save only where it's proficient (its modifier + PB); the others use the modifier. A summon's bonus can be a formula (2 + pb).</p>
    </div>
  );
}

export function SkillsFields({ form, set }) {
  const setSkill = (i, p) => set("skills", form.skills.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div className="space-y-1">
      {form.skills.map((s, i) => (
        <div key={i} className="flex items-baseline gap-3">
          <select value={s.skill} onChange={(e) => setSkill(i, { skill: e.target.value })} className={`${fieldCls} !w-44`} aria-label="Skill">
            {union(SKILL_IDS, [s.skill]).map((k) => <option key={k} value={k}>{labelFromId(k)}</option>)}
          </select>
          <span className="text-xs text-ink-faded">+</span>
          <input type="text" value={s.value} onChange={(e) => setSkill(i, { value: e.target.value })} placeholder="5" className={`${fieldCls} !w-20`} aria-label="Bonus" />
          <button type="button" onClick={() => set("skills", form.skills.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove skill">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => set("skills", [...form.skills, { skill: "perception", value: "" }])} className={addRowCls}>
        + skill
      </button>
    </div>
  );
}

// ─── resistances, senses, languages, challenge ─────────────────────

export function DefensesFields({ form, set }) {
  return (
    <div className="space-y-1">
      {DEFENSE_KINDS.map((k) => {
        const kept = form.defensesRest[k];
        const keptWords = kept ? formatDefense(kept) : "";
        return (
          <div key={k}>
            <FoldChips label={DEFENSE_LABELS[k]} options={k === "condition_immune" ? CONDITIONS : DAMAGE_TYPES} defaultOpen={form.defenses[k].length > 0}
                       selected={form.defenses[k]} onToggle={(t) => set("defenses", { ...form.defenses, [k]: toggleIn(form.defenses[k], t) })} />
            {keptWords && <p className={`${hintCls} mb-1 pl-4`}>Also: {keptWords} (kept as written)</p>}
          </div>
        );
      })}
    </div>
  );
}

export function SensesFields({ form, set }) {
  const setSense = (k, v) => {
    const next = { ...form.senses };
    if (v == null) delete next[k];
    else next[k] = v;
    set("senses", next);
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
        {SENSE_KEYS.map((k) => (
          <label key={k} className="flex items-baseline gap-1.5">
            <span className="text-xs text-ink-faded">{titleCase(k)}</span>
            <input type="number" min={0} value={form.senses[k] ?? ""} placeholder="—" onChange={(e) => setSense(k, numOrNull(e.target.value))} className={`${fieldCls} !w-14`} />
          </label>
        ))}
        <label className="flex items-baseline gap-1.5">
          <span className="text-xs text-ink-faded">Passive Perception</span>
          <input type="number" min={0} value={form.passive ?? ""} onChange={(e) => set("passive", numOrNull(e.target.value))}
                 placeholder={String(10 + (abilityMod(form.abilities.wis) ?? 0))} className={`${fieldCls} !w-14`} />
        </label>
      </div>
      <input type="text" value={form.sensesNotes} onChange={(e) => set("sensesNotes", e.target.value)} placeholder="a note on its senses (blind beyond this radius)" className={fieldCls} />
    </div>
  );
}

export function LanguagesFields({ form, set }) {
  return (
    <textarea value={form.languages} onChange={(e) => set("languages", e.target.value)} rows={3} className={textareaCls} autoFocus
              aria-label="Languages, one per line" placeholder={"Common\nDraconic\ntelepathy 120 ft."} />
  );
}

const CHALLENGE_MODES = [
  { value: "cr", label: "Challenge rating" },
  { value: "level", label: "Level" },
  { value: "none", label: "None" },
];

export function ChallengeFields({ form, set, setForm }) {
  // Picking a CR fills in its XP and proficiency bonus.
  const setCR = (cr) => {
    const stats = crStats(cr);
    setForm((f) => ({ ...f, cr, xp: stats?.xp ?? f.xp, pb: stats?.pb ?? f.pb }));
  };
  return (
    <div className="space-y-3">
      <Segmented options={CHALLENGE_MODES} value={form.challenge} onChange={(v) => set("challenge", v)} />
      {form.challenge === "cr" && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-xs text-ink-faded">CR</span>
          <select value={form.cr} onChange={(e) => setCR(e.target.value)} className={`${fieldCls} !w-20`} aria-label="CR">
            {union(CR_OPTIONS, form.cr ? [form.cr] : []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-xs text-ink-faded">XP</span>
          <input type="number" min={0} value={form.xp ?? ""} onChange={(e) => set("xp", numOrNull(e.target.value))} className={`${fieldCls} !w-20`} aria-label="XP" />
          <span className="text-xs text-ink-faded">PB +</span>
          <input type="number" min={0} value={form.pb ?? ""} onChange={(e) => set("pb", numOrNull(e.target.value))} className={`${fieldCls} !w-12`} aria-label="PB" />
        </div>
      )}
      {form.challenge === "level" && (
        <label className="flex items-baseline gap-2">
          <span className="text-xs text-ink-faded">Level</span>
          <input type="number" min={1} max={20} value={form.level ?? ""} onChange={(e) => set("level", numOrNull(e.target.value))} className={`${fieldCls} !w-14`} />
        </label>
      )}
    </div>
  );
}

export function LegendaryUsesFields({ form, set }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-xs text-ink-faded">Uses per round</span>
      <input type="number" min={0} value={form.legendaryUses ?? ""} placeholder="—" onChange={(e) => set("legendaryUses", numOrNull(e.target.value))}
             className={`${fieldCls} !w-12`} aria-label="Legendary action uses" />
      <span className="text-xs text-ink-faded">in its lair</span>
      <input type="number" min={0} value={form.legendaryLair ?? ""} placeholder="—" onChange={(e) => set("legendaryLair", numOrNull(e.target.value))}
             className={`${fieldCls} !w-12`} aria-label="Uses in its lair" />
    </div>
  );
}

// ─── gear, labels ──────────────────────────────────────────────────

export function GearFields({ form, set, items, index }) {
  const setItem = (i, p) => set("items", form.items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="space-y-2">
      {form.items.map((it, i) => (
        <div key={`${it.item}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <input type="number" min={1} value={it.qty ?? 1} aria-label="Quantity" className={`${fieldCls} !w-12`}
                 onChange={(e) => setItem(i, { qty: numOrNull(e.target.value) ?? 1 })} />
          <span className="min-w-[10rem] flex-1 text-sm">{nameFromId(it.item, index)}</span>
          <label className="flex items-baseline gap-2 text-sm" title="One of its attacks uses this item">
            <input type="checkbox" checked={!!it.attacks} className="accent-rubric" onChange={(e) => setItem(i, { attacks: e.target.checked || undefined })} />
            attacks with it
          </label>
          <button type="button" onClick={() => set("items", form.items.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove">✕</button>
        </div>
      ))}
      <EntryPicker entries={items} selected={[]} index={index} placeholder="add from the item catalogue…"
                   onToggle={(id) => set("items", [...form.items, { item: id, qty: 1 }])} />
    </div>
  );
}

export function LabelsFields({ form, set, habitats }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-6">
        {[["npc", "NPC"], ["named", "Named character"], ["familiar", "Can be a familiar"]].map(([k, label]) => (
          <label key={k} className="flex items-baseline gap-2 text-sm">
            <input type="checkbox" checked={form.flags[k]} onChange={(e) => set("flags", { ...form.flags, [k]: e.target.checked })} className="accent-rubric" />
            {label}
          </label>
        ))}
      </div>
      <FoldChips label="Habitat" options={union(habitats, form.environment)} selected={form.environment} defaultOpen
                 onToggle={(h) => set("environment", toggleIn(form.environment, h))} />
    </div>
  );
}

// ─── one trait or action ───────────────────────────────────────────

const USES_MODES = [
  { value: "", label: "always" },
  { value: "long", label: "per day" },
  { value: "short", label: "per short rest" },
  { value: "turn", label: "per turn" },
  { value: "recharge", label: "recharge" },
];

const usesFor = (mode, old) =>
  !mode ? undefined
  : mode === "recharge" ? { max: 1, reset: "recharge", recharge: old?.recharge ?? 5 }
  : { ...old, max: old?.reset === "recharge" ? 1 : old?.max ?? 1, reset: mode, recharge: undefined };

/* One trait or action: its name, section, uses, its book text and its
   numbers (attack roll, saving throw, damage) for the tracker and the
   dice tower. `sections`: which sections it may go in (a variant's). */
export function MonsterFeatureFields({ f, onPatch, sections = CATEGORY_OPTIONS }) {
  const mode = f.uses?.reset || "";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <input type="text" value={f.name || ""} onChange={(e) => onPatch("name", e.target.value)} placeholder="name (e.g. Bite)" autoFocus={!f.name}
               className={`${fieldCls} min-w-[10rem] flex-1`} aria-label="Name" />
        <select value={f.category || "traits"} onChange={(e) => onPatch("category", e.target.value)} className={`${fieldCls} !w-44`} aria-label="Section">
          {sections.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs text-ink-faded">Uses</span>
        <Segmented size="sm" options={USES_MODES} value={mode} onChange={(m) => onPatch("uses", usesFor(m, f.uses))} />
        {mode && mode !== "recharge" && (
          <input type="text" value={textFromValue(f.uses?.max)} aria-label="How many" onChange={(e) => onPatch("uses", { ...f.uses, max: valueFromText(e.target.value) })}
                 className={`${fieldCls} !w-12`} />
        )}
        {mode === "long" && (
          <label className="flex items-baseline gap-1.5">
            <span className="text-xs text-ink-faded">in its lair</span>
            <input type="number" min={1} value={f.uses?.max_in_lair ?? ""} placeholder="—" className={`${fieldCls} !w-12`}
                   onChange={(e) => onPatch("uses", { ...f.uses, max_in_lair: numOrNull(e.target.value) ?? undefined })} />
          </label>
        )}
        {mode === "recharge" && (
          <label className="flex items-baseline gap-1.5">
            <span className="text-xs text-ink-faded">on a</span>
            <select value={f.uses?.recharge ?? 6} onChange={(e) => onPatch("uses", { ...f.uses, recharge: Number(e.target.value) })} className={`${fieldCls} !w-20`}>
              {[6, 5, 4, 3, 2].map((n) => <option key={n} value={n}>{n === 6 ? "6" : `${n}–6`}</option>)}
            </select>
          </label>
        )}
        {f.category === "legendary_actions" && (
          <label className="flex items-baseline gap-1.5">
            <span className="text-xs text-ink-faded">costs</span>
            <select value={f.cost ?? 1} onChange={(e) => onPatch("cost", Number(e.target.value) > 1 ? Number(e.target.value) : undefined)} className={`${fieldCls} !w-14`}>
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-xs text-ink-faded">actions</span>
          </label>
        )}
      </div>
      <textarea value={f.text || ""} onChange={(e) => onPatch("text", e.target.value)} rows={4} className={textareaCls} aria-label="Text"
                placeholder={f.category === "actions" ? "Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Piercing damage." : "What it does…"} />
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faded">Numbers the tracker and dice tower use</div>
        <ActionEditor value={f.action} onChange={(a) => onPatch("action", a && Object.keys(a).length ? a : undefined)} />
      </div>
    </div>
  );
}

// ─── one spellcasting block ────────────────────────────────────────

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

/* A spellcasting block: the book's line (ability, DC, attack), the
   section it's listed in, and its spell groups (at will · N/day each ·
   level N with slots), each a list of spells from the catalogue. */
export function SpellBlockFields({ block: b, onPatch, spells, index }) {
  const groups = b.groups || [];
  const setGroup = (i, g) => onPatch({ groups: groups.map((x, j) => (j === i ? g : x)) });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <input type="text" value={b.name || ""} onChange={(e) => onPatch({ name: e.target.value })} placeholder="Spellcasting" className={`${fieldCls} min-w-[10rem] flex-1`} aria-label="Name" />
        <select value={b.display_as || "traits"} onChange={(e) => onPatch({ display_as: e.target.value === "traits" ? undefined : e.target.value })}
                className={`${fieldCls} !w-44`} aria-label="Listed under">
          {CATEGORY_OPTIONS.slice(0, 5).map((o) => <option key={o.value} value={o.value}>listed as {o.label.toLowerCase()}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs text-ink-faded">Ability</span>
        <select value={b.ability || ""} onChange={(e) => onPatch({ ability: e.target.value || undefined })} className={`${fieldCls} !w-20`} aria-label="Ability">
          <option value="">—</option>
          {ABILITIES.map((a) => <option key={a} value={a}>{ABILITY_SHORT[a]}</option>)}
        </select>
        <span className="text-xs text-ink-faded">save DC</span>
        <input type="number" value={b.dc ?? ""} onChange={(e) => onPatch({ dc: numOrNull(e.target.value) ?? undefined })} placeholder="—" className={`${fieldCls} !w-14`} aria-label="Save DC" />
        <span className="text-xs text-ink-faded">spell attack +</span>
        <input type="number" value={b.attack ?? ""} onChange={(e) => onPatch({ attack: numOrNull(e.target.value) ?? undefined })} placeholder="—" className={`${fieldCls} !w-14`} aria-label="Spell attack" />
      </div>
      <textarea value={b.text || ""} onChange={(e) => onPatch({ text: e.target.value })} rows={2} className={textareaCls}
                placeholder="The mage casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC 14):" />
      {groups.map((g, i) => {
        const kind = kindOf(g);
        const setSpells = (list) => setGroup(i, { ...g, spells: list });
        return (
          <div key={i} className="space-y-1 border-l border-rule/30 pl-3">
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
              <button type="button" onClick={() => onPatch({ groups: groups.filter((_, j) => j !== i) })} className={removeRowCls} aria-label="Remove this group">✕</button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {(g.spells || []).map((s, j) => (
                <button key={`${s.spell || s.text}-${j}`} type="button" title="Remove" className={chip(true)} onClick={() => setSpells(g.spells.filter((_, k) => k !== j))}>
                  {s.spell ? nameFromId(s.spell, index) : s.text}{s.note ? ` ${s.note}` : ""} <span aria-hidden className="text-ink-faded">✕</span>
                </button>
              ))}
            </div>
            <EntryPicker entries={spells} selected={[]} index={index} placeholder="add a spell…" onToggle={(id) => setSpells([...(g.spells || []), { spell: id }])} />
          </div>
        );
      })}
      <button type="button" onClick={() => onPatch({ groups: [...groups, { uses: 1, per: "day", each: true, spells: [] }] })} className={addRowCls}>
        + spell group
      </button>
    </div>
  );
}
