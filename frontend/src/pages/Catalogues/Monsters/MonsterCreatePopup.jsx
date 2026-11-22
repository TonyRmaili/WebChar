import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import { CreateModal, fieldCls, hintCls, labelCls, addRowCls, removeRowCls, textareaCls } from "../catalogueStyle";
import { BasicsSection, ChipToggles, EntryPicker, FoldChips, Segmented } from "../catalogueParts";
import {
  ABILITIES, ABILITY_SHORT, SKILL_IDS, DAMAGE_TYPES, CONDITIONS, CREATURE_TYPES,
  buildNameIndex, collectUnique, toggleIn, numOrNull, labelFromId, nameFromId, titleCase,
} from "../catalogueHelpers";
import {
  CR_OPTIONS, DEFENSE_KINDS, DEFENSE_LABELS, SIZE_OPTIONS, SPEED_MODES,
  abilityMod, crStats, emptyMonsterForm, formToMonster, formatDefense, monsterToForm, signed,
} from "./monsterHelpers";
import MonsterFeaturesEditor from "./MonsterFeaturesEditor";
import MonsterSpellcastingEditor from "./MonsterSpellcastingEditor";

const CHALLENGE_MODES = [
  { value: "cr", label: "Challenge rating" },
  { value: "level", label: "Level" },
  { value: "none", label: "None" },
];
const SENSE_KEYS = ["darkvision", "blindsight", "tremorsense", "truesight"];

/* Create, edit or copy a monster: the whole statblock, top to bottom.
   The form writes the same record the pipeline makes (data-model §4h);
   what it has no field for (variants, a version's base, a summon's
   spell, 5etools' tag lists) is kept unchanged. */
export default function MonsterCreatePopup({ open, onClose, editingMonster, copyFromMonster }) {
  const createMonster = useCatalogueStore((s) => s.createMonster);
  const updateMonster = useCatalogueStore((s) => s.updateMonster);
  const saving = useCatalogueStore((s) => s.savingMonster);
  const saveError = useCatalogueStore((s) => s.monstersError);

  const monsters = useCatalogueStore((s) => s.monsters);
  const spells = useCatalogueStore((s) => s.spells);
  const items = useCatalogueStore((s) => s.items);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);
  const loadItems = useCatalogueStore((s) => s.loadItems);

  const [form, setForm] = useState(emptyMonsterForm);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!spells?.length) loadSpells();
    if (!items?.length) loadItems();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    setNameError(false);
    const src = editingMonster || copyFromMonster;
    setForm(src ? monsterToForm(src, { copy: !editingMonster }) : emptyMonsterForm());
  }, [open, editingMonster, copyFromMonster]);

  const index = useMemo(() => buildNameIndex(spells, items), [spells, items]);
  const habitats = useMemo(() => collectUnique(monsters, (m) => m.filters?.environment), [monsters]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const patch = (key, p) => setForm((f) => ({ ...f, [key]: { ...f[key], ...p } }));
  const union = (a, b) => [...new Set([...(a || []), ...(b || [])])];

  const isEditing = !!editingMonster;
  const title = isEditing ? "Edit Monster" : copyFromMonster ? "Copy Monster" : "Create Monster";

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    const record = formToMonster(form, isEditing ? editingMonster : null);
    try {
      if (isEditing) await updateMonster(editingMonster.id, record);
      else await createMonster(record);
      onClose();
    } catch {
      /* the error is shown in the footer */
    }
  };

  // Picking a CR fills in its XP and proficiency bonus.
  const setCR = (cr) => {
    const stats = crStats(cr);
    setForm((f) => ({ ...f, cr, xp: stats?.xp ?? f.xp, pb: stats?.pb ?? f.pb }));
  };
  const setAc = (i, p) => set("ac", form.ac.map((a, j) => (j === i ? { ...a, ...p } : a)));
  const setSkill = (i, p) => set("skills", form.skills.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const setSpeed = (k, v) => {
    const next = { ...form.speed };
    if (v == null) delete next[k];
    else next[k] = v;
    set("speed", next);
  };
  const setSense = (k, v) => {
    const next = { ...form.senses };
    if (v == null) delete next[k];
    else next[k] = v;
    set("senses", next);
  };
  const restKeys = Object.keys(form.rest);
  const pb = form.challenge === "cr" ? form.pb : null;

  return (
    <CreateModal open={open} title={title} onClose={onClose} onSave={handleSave} saving={saving}
                 saveLabel={isEditing ? "Save Changes" : "Save"} error={saveError} width="max-w-4xl">
      <BasicsSection form={form} set={set} nameError={nameError} namePlaceholder="e.g. Ash Wyrmling">
        <div>
          <div className={labelCls}>Size (several = pick one)</div>
          <ChipToggles options={union(SIZE_OPTIONS, form.size)} selected={form.size} labelOf={titleCase}
                       onToggle={(s) => set("size", toggleIn(form.size, s))} />
        </div>
        <div>
          <div className={labelCls}>Creature type (several = pick one)</div>
          <ChipToggles options={union(CREATURE_TYPES, form.types)} selected={form.types} labelOf={titleCase}
                       onToggle={(t) => set("types", toggleIn(form.types, t))} />
        </div>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <label className="flex items-baseline gap-2">
            <span className={`${labelCls} !mb-0`}>Tags</span>
            <input type="text" value={form.typeTags} onChange={(e) => set("typeTags", e.target.value)} placeholder="demon, shapechanger"
                   className={`${fieldCls} !w-48`} />
          </label>
          <label className="flex items-baseline gap-2">
            <span className={`${labelCls} !mb-0`}>Swarm of</span>
            <select value={form.swarmOf} onChange={(e) => set("swarmOf", e.target.value)} className={`${fieldCls} !w-28`}>
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
      </BasicsSection>

      <FilterSection title="Armor, Hit Points & Initiative">
        <div className="space-y-3">
          <div>
            <div className="flex items-baseline gap-3">
              <span className={`${labelCls} !mb-0`}>Armor Class</span>
              <button type="button" onClick={() => set("ac", [...form.ac, { value: null, from: "", condition: "", special: "" }])} className={addRowCls}>
                + another AC
              </button>
            </div>
            {form.ac.map((a, i) => (
              <div key={i} className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <input type="number" value={a.value ?? ""} onChange={(e) => setAc(i, { value: numOrNull(e.target.value) })} placeholder="—"
                       className={`${fieldCls} !w-14`} aria-label="AC" />
                <input type="text" value={a.from} onChange={(e) => setAc(i, { from: e.target.value })} placeholder="from (natural armor)"
                       className={`${fieldCls} !w-44`} />
                <input type="text" value={a.condition} onChange={(e) => setAc(i, { condition: e.target.value })} placeholder="when (in bear form)"
                       className={`${fieldCls} !w-44`} />
                <input type="text" value={a.special} onChange={(e) => setAc(i, { special: e.target.value })} placeholder="or a rule in words"
                       className={`${fieldCls} min-w-[8rem] flex-1`} />
                <button type="button" onClick={() => set("ac", form.ac.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove AC">✕</button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={`${labelCls} !mb-0`}>Hit Points</span>
            <input type="number" min={0} value={form.hp.average ?? ""} onChange={(e) => patch("hp", { average: numOrNull(e.target.value) })}
                   placeholder="—" className={`${fieldCls} !w-16`} aria-label="Average" />
            <input type="text" value={form.hp.formula} onChange={(e) => patch("hp", { formula: e.target.value })} placeholder="19d12 + 133"
                   className={`${fieldCls} !w-32`} aria-label="Dice" />
            <input type="text" value={form.hp.special} onChange={(e) => patch("hp", { special: e.target.value })} placeholder="or in words (a summon's HP)"
                   className={`${fieldCls} min-w-[8rem] flex-1`} />
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={`${labelCls} !mb-0`}>Initiative</span>
            <input type="number" value={form.initiative ?? ""} onChange={(e) => set("initiative", numOrNull(e.target.value))}
                   placeholder={signed(abilityMod(form.abilities.dex) ?? 0)} className={`${fieldCls} !w-14`} aria-label="Initiative bonus" />
            <label className="flex items-baseline gap-2 text-sm">
              <input type="checkbox" checked={form.initAdvantage} onChange={(e) => set("initAdvantage", e.target.checked)} className="accent-rubric" />
              with advantage
            </label>
            <span className={hintCls}>Empty = its Dexterity modifier.</span>
          </div>
        </div>
      </FilterSection>

      <FilterSection title="Speed & Senses">
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
            {SPEED_MODES.map((k) => (
              <label key={k} className="flex items-baseline gap-1.5">
                <span className="text-xs text-ink-faded">{titleCase(k)}</span>
                <input type="number" min={0} value={form.speed[k] ?? ""} placeholder="—" onChange={(e) => setSpeed(k, numOrNull(e.target.value))}
                       className={`${fieldCls} !w-14`} />
              </label>
            ))}
            <label className="flex items-baseline gap-2 text-sm">
              <input type="checkbox" checked={form.hover} onChange={(e) => set("hover", e.target.checked)} className="accent-rubric" />
              hover
            </label>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
            {SENSE_KEYS.map((k) => (
              <label key={k} className="flex items-baseline gap-1.5">
                <span className="text-xs text-ink-faded">{titleCase(k)}</span>
                <input type="number" min={0} value={form.senses[k] ?? ""} placeholder="—" onChange={(e) => setSense(k, numOrNull(e.target.value))}
                       className={`${fieldCls} !w-14`} />
              </label>
            ))}
            <label className="flex items-baseline gap-1.5">
              <span className="text-xs text-ink-faded">Passive Perception</span>
              <input type="number" min={0} value={form.passive ?? ""} onChange={(e) => set("passive", numOrNull(e.target.value))}
                     placeholder={String(10 + (abilityMod(form.abilities.wis) ?? 0))} className={`${fieldCls} !w-14`} />
            </label>
          </div>
          <input type="text" value={form.sensesNotes} onChange={(e) => set("sensesNotes", e.target.value)}
                 placeholder="a note on its senses (blind beyond this radius)" className={fieldCls} />
        </div>
      </FilterSection>

      <FilterSection title="Abilities, Saves & Skills">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-6">
            {ABILITIES.map((a) => {
              const mod = abilityMod(form.abilities[a]);
              return (
                <div key={a} className="text-center">
                  <div className={labelCls}>{ABILITY_SHORT[a]}</div>
                  <input type="number" min={0} value={form.abilities[a] ?? ""} onChange={(e) => patch("abilities", { [a]: numOrNull(e.target.value) })}
                         className={`${fieldCls} !w-14 text-center`} aria-label={`${a} score`} />
                  <div className="text-xs text-ink-faded">{mod == null ? "—" : signed(mod)}</div>
                  <input type="text" value={form.saves[a] ?? ""} placeholder="save"
                         onChange={(e) => set("saves", { ...form.saves, [a]: e.target.value })}
                         className={`${fieldCls} !w-14 text-center text-xs`} aria-label={`${a} save bonus`}
                         title={pb != null && mod != null ? `Proficient: ${signed(mod + pb)}` : "A proficient save's bonus"} />
                </div>
              );
            })}
          </div>
          <p className={hintCls}>Fill a save only where it's proficient; the others use the modifier. A summon's bonus can be a formula (2 + pb).</p>
          <div>
            <div className="flex items-baseline gap-3">
              <span className={`${labelCls} !mb-0`}>Skills</span>
              <button type="button" onClick={() => set("skills", [...form.skills, { skill: "perception", value: "" }])} className={addRowCls}>
                + skill
              </button>
            </div>
            {form.skills.map((s, i) => (
              <div key={i} className="mt-1 flex items-baseline gap-3">
                <select value={s.skill} onChange={(e) => setSkill(i, { skill: e.target.value })} className={`${fieldCls} !w-44`}>
                  {union(SKILL_IDS, [s.skill]).map((k) => <option key={k} value={k}>{labelFromId(k)}</option>)}
                </select>
                <span className="text-xs text-ink-faded">+</span>
                <input type="text" value={s.value} onChange={(e) => setSkill(i, { value: e.target.value })} placeholder="5" className={`${fieldCls} !w-20`} />
                <button type="button" onClick={() => set("skills", form.skills.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove skill">✕</button>
              </div>
            ))}
          </div>
        </div>
      </FilterSection>

      <FilterSection title="Resistances & Immunities" defaultOpen={false}>
        <div className="space-y-1">
          {DEFENSE_KINDS.map((k) => {
            const kept = form.defensesRest[k];
            const keptWords = kept ? formatDefense(kept) : "";
            return (
              <div key={k}>
                <FoldChips label={DEFENSE_LABELS[k]} options={k === "condition_immune" ? CONDITIONS : DAMAGE_TYPES}
                           selected={form.defenses[k]} onToggle={(t) => set("defenses", { ...form.defenses, [k]: toggleIn(form.defenses[k], t) })} />
                {keptWords && <p className={`${hintCls} mb-1 pl-4`}>Also: {keptWords} (kept as written)</p>}
              </div>
            );
          })}
        </div>
      </FilterSection>

      <FilterSection title="Languages & Challenge">
        <div className="space-y-3">
          <div>
            <div className={labelCls}>Languages (one per line)</div>
            <textarea value={form.languages} onChange={(e) => set("languages", e.target.value)} rows={2} className={textareaCls}
                      placeholder={"Common\nDraconic\ntelepathy 120 ft."} />
          </div>
          <Segmented options={CHALLENGE_MODES} value={form.challenge} onChange={(v) => set("challenge", v)} />
          {form.challenge === "cr" && (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs text-ink-faded">CR</span>
              <select value={form.cr} onChange={(e) => setCR(e.target.value)} className={`${fieldCls} !w-20`}>
                {union(CR_OPTIONS, form.cr ? [form.cr] : []).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-xs text-ink-faded">XP</span>
              <input type="number" min={0} value={form.xp ?? ""} onChange={(e) => set("xp", numOrNull(e.target.value))} className={`${fieldCls} !w-20`} />
              <span className="text-xs text-ink-faded">PB +</span>
              <input type="number" min={0} value={form.pb ?? ""} onChange={(e) => set("pb", numOrNull(e.target.value))} className={`${fieldCls} !w-12`} />
            </div>
          )}
          {form.challenge === "level" && (
            <label className="flex items-baseline gap-2">
              <span className="text-xs text-ink-faded">Level</span>
              <input type="number" min={1} max={20} value={form.level ?? ""} onChange={(e) => set("level", numOrNull(e.target.value))}
                     className={`${fieldCls} !w-14`} />
            </label>
          )}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-xs text-ink-faded">Legendary action uses</span>
            <input type="number" min={0} value={form.legendaryUses ?? ""} placeholder="—" onChange={(e) => set("legendaryUses", numOrNull(e.target.value))}
                   className={`${fieldCls} !w-12`} />
            <span className="text-xs text-ink-faded">in its lair</span>
            <input type="number" min={0} value={form.legendaryLair ?? ""} placeholder="—" onChange={(e) => set("legendaryLair", numOrNull(e.target.value))}
                   className={`${fieldCls} !w-12`} />
          </div>
        </div>
      </FilterSection>

      <FilterSection title="Traits & Actions">
        <MonsterFeaturesEditor features={form.features} onChange={(v) => set("features", v)} variants={form.rest.variants || []} />
      </FilterSection>

      <FilterSection title="Spellcasting" defaultOpen={form.spellcasting.length > 0}>
        <MonsterSpellcastingEditor blocks={form.spellcasting} onChange={(v) => set("spellcasting", v)} spells={spells} index={index} />
      </FilterSection>

      <FilterSection title="Gear" defaultOpen={false}>
        <div className="space-y-2">
          {form.items.map((it, i) => (
            <div key={`${it.item}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <input type="number" min={1} value={it.qty ?? 1} aria-label="Quantity" className={`${fieldCls} !w-12`}
                     onChange={(e) => set("items", form.items.map((x, j) => (j === i ? { ...x, qty: numOrNull(e.target.value) ?? 1 } : x)))} />
              <span className="min-w-[10rem] flex-1 text-sm">{nameFromId(it.item, index)}</span>
              <label className="flex items-baseline gap-2 text-sm" title="One of its attacks uses this item">
                <input type="checkbox" checked={!!it.attacks} className="accent-rubric"
                       onChange={(e) => set("items", form.items.map((x, j) => (j === i ? { ...x, attacks: e.target.checked || undefined } : x)))} />
                attacks with it
              </label>
              <button type="button" onClick={() => set("items", form.items.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove">✕</button>
            </div>
          ))}
          <EntryPicker entries={items} selected={[]} index={index} placeholder="add from the item catalogue…"
                       onToggle={(id) => set("items", [...form.items, { item: id, qty: 1 }])} />
        </div>
      </FilterSection>

      <FilterSection title="Labels" defaultOpen={false}>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-x-6">
            {[["npc", "NPC"], ["named", "Named character"], ["familiar", "Can be a familiar"]].map(([k, label]) => (
              <label key={k} className="flex items-baseline gap-2 text-sm">
                <input type="checkbox" checked={form.flags[k]} onChange={(e) => patch("flags", { [k]: e.target.checked })} className="accent-rubric" />
                {label}
              </label>
            ))}
          </div>
          <FoldChips label="Habitat" options={union(habitats, form.environment)} selected={form.environment}
                     onToggle={(h) => set("environment", toggleIn(form.environment, h))} />
        </div>
      </FilterSection>

      {restKeys.length > 0 && (
        <p className={`${hintCls} mt-2`}>Also kept as they are: {restKeys.map((k) => titleCase(k.replace(/_/g, " "))).join(", ")}.</p>
      )}
    </CreateModal>
  );
}
