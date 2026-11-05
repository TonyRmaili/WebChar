import React, { useCallback, useMemo, useRef, useState } from "react";
import useCharStore from "../../../../store/CharStore";
import { effectChips, effectDamage, usesFromCharges, regainLabel } from "../play/playHelpers";
import { INK, InkRemove, InkSelect, InkText, ParchmentSheet, Title } from "../../../../styles/parchment";
import {
  DefineSection,
  Field,
  Fieldset,
  Hint,
  NumberInput,
  Segmented,
  Switch,
  TextBlock,
  UsesEditor,
  addBtn,
  dangerBtn,
  ghostBtn,
  inputBase,
  inputCls,
} from "../../../../styles/parchmentForm";

/* Define tab: Effects — everything that becomes a button in Play's
   "Actions & Charges". Written on parchment.

   Grouped by when you use it (Action, Bonus Action, Reaction, Passive).
   Each row is one ledger line with the same numbers Play shows; the
   diamond turns it on/off in Play, click the name to open the editor. At full width the rows sit in two
   columns and an open editor spans both. Data shape is unchanged. */

const ACTION_GROUPS = [
  { value: "action", label: "Action", title: "Actions" },
  { value: "bonus_action", label: "Bonus", title: "Bonus Actions" },
  { value: "reaction", label: "Reaction", title: "Reactions" },
  { value: "passive", label: "Passive", title: "Passives" },
];

const KINDS = [
  { value: "none", label: "None", hint: "No roll — a utility, buff or rider" },
  { value: "attack", label: "Attack", hint: "You roll to hit" },
  { value: "save", label: "Save", hint: "The target rolls a saving throw" },
  { value: "attack_and_save", label: "Both", hint: "Attack roll, then a save" },
];

const ATTACK_TYPES = [
  { value: "melee", label: "Melee" },
  { value: "ranged", label: "Ranged" },
  { value: "spell", label: "Spell" },
];

const SOURCES = [
  { value: "standard", label: "Standard" },
  { value: "class", label: "Class" },
  { value: "race", label: "Race" },
  { value: "feat", label: "Feat" },
  { value: "martial", label: "Martial" },
  { value: "background", label: "Background" },
  { value: "spell", label: "Spell" },
  { value: "other", label: "Other" },
];
const sourceLabel = (v) => (SOURCES.find((s) => s.value === v) || SOURCES[0]).label;

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const DAMAGE_TYPES = [
  "slashing", "piercing", "bludgeoning", "fire", "cold", "acid", "lightning",
  "thunder", "poison", "necrotic", "radiant", "psychic", "force",
];
const DICE = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];

const idGen = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const numOr = (v, fallback) => (Number.isFinite(Number(v)) && v !== "" && v != null ? Number(v) : fallback);

const newEffect = (actionType) => ({
  id: idGen(),
  name: "",
  action_type: actionType,
  kind: "none",
  trait: "standard",
  active: true,
  attack: { attack_type: "", hit_bonus: null, range_ft: null },
  save: { target: "", ability: "", dc_bonus: null },
  damages: [],
  notes: "",
  charges: { has: false, max_charges: "", reset_amount: 0, current_charges: "" },
  linked_effect_ids: [],
});

const newDamage = () => ({ id: idGen(), dice_count: 1, dice_size: "d6", mod: null, damage_type: "" });

// Switching kind keeps the range and clears the parts that no longer apply,
// so Play never shows a stale to-hit or DC.
const withKind = (row, kind) => {
  const range = row.attack?.range_ft ?? null;
  const keepAttack = kind === "attack" || kind === "attack_and_save";
  const keepSave = kind === "save" || kind === "attack_and_save";
  return {
    ...row,
    kind,
    attack: keepAttack
      ? { attack_type: row.attack?.attack_type || "melee", hit_bonus: row.attack?.hit_bonus ?? null, range_ft: range }
      : { attack_type: "", hit_bonus: null, range_ft: range },
    save: keepSave
      ? { target: row.save?.target || "dex", ability: row.save?.ability || "", dc_bonus: row.save?.dc_bonus ?? null }
      : { target: "", ability: "", dc_bonus: null },
  };
};

/* ─── One effect: summary row + editor ───────────────────────────── */

function EffectRow({ row, charData, open, onToggle, onPatch, onReplace, onRemove, onDuplicate }) {
  const kind = row.kind || "none";
  const chips = effectChips(charData, row);
  const damage = effectDamage(charData, row);
  const uses = usesFromCharges(row.charges);
  const showAttack = kind === "attack" || kind === "attack_and_save";
  const showSave = kind === "save" || kind === "attack_and_save";

  const patchDamage = (id, patch) =>
    onPatch({ damages: (row.damages || []).map((d) => (d.id === id ? { ...d, ...patch } : d)) });

  return (
    <div className={`${open ? "col-span-full" : ""} ${row.active ? "" : "opacity-60"}`}>
      {/* Ledger line */}
      <div className="group flex items-baseline gap-1.5 py-[3px]">
        <span className="self-center">
          <Switch checked={!!row.active} onChange={(v) => onPatch({ active: v })} label={row.active ? "Active — shown in Play" : "Inactive — hidden in Play"} />
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={`truncate text-left text-[15px] hover:underline hover:decoration-dotted hover:underline-offset-4 ${row.name ? "" : `italic ${INK.faint}`} ${open ? "underline decoration-dotted underline-offset-4" : ""}`}
        >
          {row.name || "unnamed effect"}
        </button>
        <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`}>{sourceLabel(row.trait)}</span>
        <span aria-hidden="true" className="mx-1 min-w-[0.75rem] flex-1 translate-y-[-4px] border-b-2 border-dotted border-[#7b6346]/35" />
        <span className="flex shrink-0 flex-wrap items-baseline justify-end gap-x-2 text-xs">
          {chips.map((c, i) => (
            <span key={i} className={c.tone === "hit" ? "text-[#1e3a8a]" : c.tone === "save" ? "text-[#6b21a8]" : INK.faded}>
              {c.text}
            </span>
          ))}
          {damage && <span className={INK.rubric}>{damage}</span>}
          {uses && (
            <span className={`italic ${INK.faded}`}>
              {uses.max} {uses.max === 1 ? "use" : "uses"}
            </span>
          )}
        </span>
      </div>

      {/* Editor */}
      {open && (
        <div className="@container mb-4 ml-[26px] mt-2 space-y-4 border-l-2 border-[#9a3412]/40 pl-4">
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Field label="Name">
              <input
                type="text"
                value={row.name ?? ""}
                autoFocus={!row.name}
                onChange={(e) => onPatch({ name: e.target.value })}
                placeholder="e.g. Shadow Strike"
                className={`${inputCls} text-[17px]`}
              />
            </Field>
            <Field label="Source">
              <select value={row.trait || "standard"} onChange={(e) => onPatch({ trait: e.target.value })} className={`${inputCls} cursor-pointer`}>
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex flex-wrap gap-x-10 gap-y-3">
            <Field label="Used as">
              <Segmented options={ACTION_GROUPS} value={row.action_type || "action"} onChange={(v) => onPatch({ action_type: v })} />
            </Field>
            <Field label="Roll">
              <Segmented options={KINDS} value={kind} onChange={(v) => onReplace(withKind(row, v))} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 @3xl:grid-cols-2">
            {showAttack && (
              <Fieldset title="Attack">
                <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                  <Field label="Type" hint="Uses the matching row of the Offense card">
                    <Segmented
                      options={ATTACK_TYPES}
                      value={row.attack?.attack_type || ""}
                      onChange={(v) => onPatch({ attack: { ...row.attack, attack_type: v } })}
                    />
                  </Field>
                  <Field label="Extra to hit" hint="Added on top of PB + ability + Offense modifier">
                    <NumberInput
                      value={row.attack?.hit_bonus ?? null}
                      placeholder="0"
                      onChange={(v) => onPatch({ attack: { ...row.attack, hit_bonus: v } })}
                      className="w-14"
                    />
                  </Field>
                </div>
              </Fieldset>
            )}

            {showSave && (
              <Fieldset title="Saving throw">
                <div className="space-y-3">
                  <Field label="Target rolls">
                    <Segmented
                      size="sm"
                      options={ABILITIES.map((a) => ({ value: a, label: a.toUpperCase() }))}
                      value={row.save?.target || ""}
                      onChange={(v) => onPatch({ save: { ...row.save, target: v } })}
                    />
                  </Field>
                  <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                    <Field label="DC uses your" hint="Which of your abilities sets the DC (8 + PB + this modifier)">
                      <select
                        value={row.save?.ability || ""}
                        onChange={(e) => onPatch({ save: { ...row.save, ability: e.target.value } })}
                        className={`${inputBase} w-36 cursor-pointer`}
                      >
                        <option value="">same as target</option>
                        {ABILITIES.map((a) => (
                          <option key={a} value={a}>
                            {a.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Extra DC">
                      <NumberInput
                        value={row.save?.dc_bonus ?? null}
                        placeholder="0"
                        onChange={(v) => onPatch({ save: { ...row.save, dc_bonus: v } })}
                        className="w-14"
                      />
                    </Field>
                  </div>
                </div>
              </Fieldset>
            )}
          </div>

          <Fieldset title="Damage & range">
            <div className="space-y-2">
              <Field label="Range / reach (ft)" className="w-40">
                <NumberInput
                  value={row.attack?.range_ft ?? null}
                  min={0}
                  placeholder="—"
                  onChange={(v) => onPatch({ attack: { ...row.attack, range_ft: v } })}
                />
              </Field>
              {(row.damages || []).map((d, i) => (
                <div key={d.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <NumberInput
                    value={d.dice_count ?? null}
                    min={0}
                    placeholder="#"
                    onChange={(v) => patchDamage(d.id, { dice_count: v })}
                    className="w-10"
                    aria-label="Number of dice"
                  />
                  <select
                    value={d.dice_size || ""}
                    onChange={(e) => patchDamage(d.id, { dice_size: e.target.value })}
                    className={`${inputBase} w-16 cursor-pointer`}
                    aria-label="Die"
                  >
                    <option value="">die</option>
                    {DICE.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <span className={INK.faded}>+</span>
                  <NumberInput
                    value={d.mod ?? null}
                    placeholder="0"
                    onChange={(v) => patchDamage(d.id, { mod: v })}
                    className="w-10"
                    aria-label="Flat damage"
                  />
                  <select
                    value={d.damage_type || ""}
                    onChange={(e) => patchDamage(d.id, { damage_type: e.target.value })}
                    className={`${inputBase} min-w-[7rem] flex-1 cursor-pointer capitalize`}
                    aria-label="Damage type"
                  >
                    <option value="">type…</option>
                    {DAMAGE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <InkRemove onClick={() => onPatch({ damages: row.damages.filter((x) => x.id !== d.id) })} label="Remove damage" />
                  {i === 0 && showAttack && (
                    <span className={`w-full text-[11px] italic ${INK.faint}`}>The attack's ability modifier is added to this first line.</span>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => onPatch({ damages: [...(row.damages || []), newDamage()] })} className={addBtn}>
                + damage
              </button>
            </div>
          </Fieldset>

          <Fieldset
            title="Limited uses"
            right={
              <Switch
                checked={!!row.charges?.has}
                label="Has limited uses"
                onChange={(v) =>
                  onPatch({
                    charges: v
                      ? { has: true, max_charges: row.charges?.max_charges ?? "", current_charges: "", reset_amount: row.charges?.reset_amount ?? 0 }
                      : { has: false, max_charges: "", reset_amount: 0, current_charges: "" },
                  })
                }
              />
            }
          >
            {row.charges?.has ? (
              <>
                <UsesEditor charges={row.charges} onChange={(charges) => onPatch({ charges })} />
                {uses && <p className={`mt-1 text-[11px] italic ${INK.faint}`}>{regainLabel(row.charges.reset_amount, uses.max)}</p>}
              </>
            ) : (
              <Hint>Unlimited. Turn on the diamond for things like 3/day or once per rest.</Hint>
            )}
          </Fieldset>

          <Field label="Notes (shown when hovering the card in Play)">
            <TextBlock value={row.notes} onChange={(e) => onPatch({ notes: e.target.value })} placeholder="Riders, conditions, what it does…" minRows={2} />
          </Field>

          <div className="flex flex-wrap items-baseline justify-end gap-x-4">
            <button type="button" onClick={onDuplicate} className={ghostBtn}>
              duplicate
            </button>
            <button type="button" onClick={onRemove} className={dangerBtn}>
              delete
            </button>
            <button type="button" onClick={onToggle} className={addBtn}>
              done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── One group (Actions, Bonus Actions…) ─────────────────────────── */

function EffectGroup({ group, rows, filtered, onAdd, children }) {
  return (
    <DefineSection
      title={group.title}
      count={filtered ? `${rows.length} shown` : rows.length}
      storageKey={`define.effects.${group.value}`}
      actions={(setOpen) => (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            onAdd();
          }}
          className={addBtn}
        >
          + add
        </button>
      )}
    >
      {rows.length === 0 ? <Hint>{filtered ? "Nothing matches." : "None yet."}</Hint> : <div className="grid grid-cols-1 items-start gap-x-10 @5xl:grid-cols-2">{children}</div>}
    </DefineSection>
  );
}

/* ─── Tab ─────────────────────────────────────────────────────────── */

export default function EffectsDefine() {
  const charData = useCharStore((s) => s.charData);
  const updateCharField = useCharStore((s) => s.updateCharField);
  const postCharData = useCharStore((s) => s.postCharData);

  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const timer = useRef(null);

  const effects = useMemo(() => (Array.isArray(charData?.effects) ? charData.effects : []), [charData?.effects]);

  // Typing saves a moment later; adding/removing saves right away.
  const persist = useCallback(
    (next, immediate = false) => {
      updateCharField("effects", next);
      clearTimeout(timer.current);
      if (immediate) postCharData();
      else timer.current = setTimeout(() => postCharData(), 400);
    },
    [updateCharField, postCharData]
  );

  const q = query.trim().toLowerCase();
  const filtered = q !== "" || source !== "";
  const visible = useMemo(
    () => effects.filter((e) => (!q || String(e.name || "").toLowerCase().includes(q)) && (!source || (e.trait || "standard") === source)),
    [effects, q, source]
  );

  if (!charData) return null;

  const replaceRow = (next) => persist(effects.map((e) => (e.id === next.id ? next : e)));
  const patchRow = (id, patch) => persist(effects.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const addRow = (actionType) => {
    const row = newEffect(actionType);
    persist([...effects, row], true);
    setOpenId(row.id);
  };

  const removeRow = (row) => {
    if (!window.confirm(`Delete "${row.name || "Unnamed effect"}"?`)) return;
    persist(effects.filter((e) => e.id !== row.id), true);
    if (openId === row.id) setOpenId(null);
  };

  const duplicateRow = (row) => {
    const copy = {
      ...structuredClone(row),
      id: idGen(),
      name: row.name ? `${row.name} (copy)` : "",
      damages: (row.damages || []).map((d) => ({ ...d, id: idGen() })),
    };
    const i = effects.findIndex((e) => e.id === row.id);
    persist([...effects.slice(0, i + 1), copy, ...effects.slice(i + 1)], true);
    setOpenId(copy.id);
  };

  const activeCount = effects.filter((e) => e.active).length;

  return (
    <ParchmentSheet>
      <Title
        after={
          <span className={`text-sm italic ${INK.faded}`}>
            {activeCount} of {effects.length} active
          </span>
        }
        right={
          <>
            <InkText value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search…" aria-label="Search effects" className="h-7 w-32 text-sm" />
            <InkSelect value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter by source" className="h-7 text-sm">
              <option value="">all sources</option>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </InkSelect>
          </>
        }
      >
        Effects
      </Title>
      <p className={`-mt-4 mb-6 text-xs italic ${INK.faint}`}>◆ = shown in Play · click a name to edit</p>

      <div className="space-y-8">
      {ACTION_GROUPS.map((g) => {
        const rows = visible.filter((e) => (e.action_type || "action") === g.value);
        return (
          <EffectGroup key={g.value} group={g} rows={rows} filtered={filtered} onAdd={() => addRow(g.value)}>
            {rows.map((row) => (
              <EffectRow
                key={row.id}
                row={row}
                charData={charData}
                open={openId === row.id}
                onToggle={() => setOpenId((id) => (id === row.id ? null : row.id))}
                onPatch={(patch) => patchRow(row.id, patch)}
                onReplace={replaceRow}
                onRemove={() => removeRow(row)}
                onDuplicate={() => duplicateRow(row)}
              />
            ))}
          </EffectGroup>
        );
      })}
      </div>
    </ParchmentSheet>
  );
}