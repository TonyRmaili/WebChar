import React, { useState } from "react";
import { usePersistedOpen } from "../../../../utils/SectionCard";
import { Bubble, INK, InkButton, InkHeading, InkNumber, InkSelect, InkText, Leader, ParchmentSheet } from "../../../../styles/parchment";
import { ABILITIES as ABILITY_KEYS } from "../../../../utils/derive";
import {
  LEVEL_WORD,
  addCustomSkill,
  manualAdd,
  manualOf,
  nextLevel,
  removeCustomSkill,
  setHas,
  setManualAdd,
  setSkillLevel,
  signed,
  sourcesOf,
  toInt,
  useSheet,
} from "../sheetHelpers";

/* Define tab: Abilities — ability scores, saves and skills, written on a
   parchment sheet (see src/styles/parchment.jsx).

   Everything is worked out by utils/derive.js from the character's layers;
   what the player changes here goes to:
     the score            abilities.base (the number typed is the TOTAL;
                          bonuses from race, feats… stay on top of it)
     a proficiency bubble the manual layer's grants / removes
     the ± adjustments    the manual layer's modifiers (check.<ab>,
                          save.<ab>, check.<skill>)
     an added skill       the manual layer's custom_skills

   Half width: abilities, then skills (two columns when there's room).
   Full width: abilities on the left, skills on the right. */

const small = `text-[10px] font-semibold uppercase tracking-[0.18em] ${INK.faded}`;
const NAMES = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
const SHORT = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };

// "from Barbarian 1, Acolyte" for a title, or "" when nothing grants it.
const fromWords = (list) => (list.length ? `from ${list.join(", ")}` : "");

/* ─── Ability table ──────────────────────────────────────────────── */

function AbilityTable({ ch, d, showAdj, onScore, onPatch }) {
  const cols = showAdj
    ? "grid-cols-[minmax(0,1fr)_3.5rem_2.5rem_5.25rem_6.75rem]"
    : "grid-cols-[minmax(0,1fr)_3.5rem_2.5rem_3rem_4.25rem]";
  const base = ch?.abilities?.base || {};

  return (
    <div className={`grid ${cols} items-baseline gap-x-2`}>
      <span />
      <span className={`${small} text-center`}>Score</span>
      <span className={`${small} text-center`}>Mod</span>
      <span className={`${small} text-center`}>Check</span>
      <span className={`${small} text-center`}>Save</span>

      {ABILITY_KEYS.map((a) => {
        const row = d.abilities[a];
        const bonus = row.score - toInt(base[a], 10);
        const level = row.save_prof ? "proficient" : "none";
        const from = fromWords(sourcesOf(ch, "saves", a));
        return (
          <React.Fragment key={a}>
            <div className="flex min-w-0 items-baseline py-1.5">
              <span className="truncate text-[15px]">{NAMES[a]}</span>
              <Leader />
            </div>
            <span className="flex items-baseline justify-center gap-0.5" title={bonus ? `${signed(bonus)} from race, feats or items, already counted` : undefined}>
              <InkNumber
                value={row.score}
                min={0}
                max={30}
                fallback={row.score}
                onChange={(v) => v != null && onScore(a, v - bonus)}
                aria-label={`${NAMES[a]} score`}
                className="h-8 w-9 text-base"
              />
              {bonus !== 0 && <span className={`text-[10px] ${INK.faint}`}>{signed(bonus)}</span>}
            </span>
            <span className="text-center text-lg font-semibold">{signed(row.mod)}</span>
            <span className="flex items-baseline justify-center gap-1">
              <span className="tabular-nums">{signed(row.check)}</span>
              {showAdj && <AdjInput value={manualAdd(ch, `check.${a}`)} onChange={(v) => onPatch(setManualAdd(ch, `check.${a}`, v))} label={`${NAMES[a]} check adjustment`} />}
            </span>
            <span className="flex items-center justify-center gap-1" title={from || undefined}>
              <Bubble level={level} onClick={() => onPatch(setHas(ch, "saves", a, !row.save_prof))} label={`${NAMES[a]} save`} />
              <span className={`w-7 tabular-nums ${row.save_prof ? `${INK.rubric} font-semibold` : ""}`}>{signed(row.save)}</span>
              {showAdj && <AdjInput value={manualAdd(ch, `save.${a}`)} onChange={(v) => onPatch(setManualAdd(ch, `save.${a}`, v))} label={`${NAMES[a]} save adjustment`} />}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Small "± n" blank for manual adjustments.
function AdjInput({ value, onChange, label }) {
  const n = toInt(value);
  return (
    <span className={`inline-flex items-baseline text-xs ${n ? INK.ink : INK.faint}`}>
      ±
      <InkNumber value={n || null} placeholder="0" fallback={0} onChange={(v) => onChange(v ?? 0)} aria-label={label} className="h-6 w-7 text-xs" />
    </span>
  );
}

/* ─── Skills ─────────────────────────────────────────────────────── */

function SkillRow({ ch, skillKey, row, showAdj, onPatch, onRemove }) {
  const level = LEVEL_WORD[row.prof];
  const removed = (ch && manualOf(ch).removes?.skills || []).includes(skillKey);
  const from = fromWords(sourcesOf(ch, "skills", skillKey));
  return (
    <div className="group flex break-inside-avoid items-center gap-1.5 py-[3px]">
      <span title={from || undefined}>
        <Bubble level={level} onClick={() => onPatch(setSkillLevel(ch, skillKey, nextLevel(row.prof)))} label={row.label} />
      </span>
      <div className="flex min-w-0 flex-1 items-baseline">
        <span className={`truncate text-[15px] ${row.prof ? "font-semibold" : ""} ${removed ? "line-through decoration-rubric/60" : ""}`} title={removed ? `Taken away by you (${from})` : undefined}>
          {row.label}
        </span>
        <span className={`ml-1.5 shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`}>{SHORT[row.ability]}</span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            title="Remove this skill"
            aria-label={`Remove ${row.label}`}
            className={`ml-1 hidden shrink-0 text-xs group-hover:inline focus:inline ${INK.faded} hover:text-rubric`}
          >
            ✕
          </button>
        )}
        <Leader />
      </div>
      <span className={`w-8 shrink-0 text-right tabular-nums ${row.prof ? `${INK.rubric} font-semibold` : ""}`}>{signed(row.total)}</span>
      {showAdj && <AdjInput value={manualAdd(ch, `check.${skillKey}`)} onChange={(v) => onPatch(setManualAdd(ch, `check.${skillKey}`, v))} label={`${row.label} adjustment`} />}
    </div>
  );
}

function AddSkill({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ability, setAbility] = useState("str");

  const close = () => {
    setOpen(false);
    setName("");
  };
  const submit = () => {
    if (!name.trim()) return;
    onAdd(name, ability);
    close();
  };

  if (!open) return <InkButton onClick={() => setOpen(true)}>+ add a skill</InkButton>;

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
      <InkText
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") close();
        }}
        placeholder="Skill name"
        className="h-8 w-40 text-[15px]"
      />
      <InkSelect value={ability} onChange={(e) => setAbility(e.target.value)} aria-label="Ability" className="h-8 text-sm">
        {ABILITY_KEYS.map((a) => (
          <option key={a} value={a}>
            {NAMES[a]}
          </option>
        ))}
      </InkSelect>
      <InkButton onClick={submit} active>
        add
      </InkButton>
      <InkButton onClick={close}>cancel</InkButton>
    </div>
  );
}

/* ─── Tab ─────────────────────────────────────────────────────────── */

const hasAdjustments = (ch) =>
  (manualOf(ch).modifiers || []).some((m) => /^(check|save)\./.test(String(m?.target || "")) && m.add != null);

export default function AbilitiesDefine() {
  const { ch, d, patchChar } = useSheet();
  const [showAdj, setShowAdj] = usePersistedOpen("abilities.adjustments", ch ? hasAdjustments(ch) : false);

  if (!ch || !d) return null;

  // Every change here is a single click or a finished number, so save right away.
  const write = (patch) => patchChar(patch, { now: true });
  const setBase = (a, value) =>
    write({ abilities: { ...(ch.abilities || {}), base: { ...(ch.abilities?.base || {}), [a]: Math.max(1, Math.min(30, value)) } } });

  const skills = Object.entries(d.skills).sort(([, a], [, b]) => a.label.localeCompare(b.label));
  const removeCustom = (key) => {
    if (!window.confirm(`Remove "${d.skills[key]?.label || key}"?`)) return;
    write(removeCustomSkill(ch, key));
  };

  const passives = [
    ["Perception", d.skills.perception?.passive],
    ["Insight", d.skills.insight?.passive],
    ["Investigation", d.skills.investigation?.passive],
  ].filter(([, v]) => v != null);

  return (
    <ParchmentSheet>
      {/* Title */}
      <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="text-2xl tracking-wide">Abilities &amp; Skills</h3>
        <span className={`text-sm italic ${INK.faded}`}>
          proficiency bonus <span className={`not-italic font-semibold ${INK.ink}`}>{signed(d.pb)}</span>
        </span>
        <InkButton
          onClick={() => setShowAdj((v) => !v)}
          active={showAdj}
          title="Show the small ± boxes for bonuses from items, feats and the like"
          className="ml-auto"
        >
          {showAdj ? "hide adjustments" : "adjustments"}
        </InkButton>
      </div>

      <div className="grid grid-cols-1 gap-x-12 gap-y-8 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Left: abilities + passives */}
        <div className="space-y-8">
          <section>
            <InkHeading>Ability scores</InkHeading>
            <AbilityTable ch={ch} d={d} showAdj={showAdj} onScore={setBase} onPatch={write} />
          </section>

          {passives.length > 0 && (
            <section>
              <InkHeading>Passive</InkHeading>
              <div className="grid grid-cols-1 gap-x-10 @md:grid-cols-3 @4xl:grid-cols-1">
                {passives.map(([label, value]) => (
                  <div key={label} className="flex items-baseline py-1">
                    <span className="text-[15px]">{label}</span>
                    <Leader />
                    <span className="w-8 text-right font-semibold tabular-nums">{value}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right: skills */}
        <section className="@container">
          <InkHeading right={<span className={`text-[11px] italic ${INK.faint}`}>click a bubble: proficient, expertise, none</span>}>
            Skills
          </InkHeading>
          <div className="columns-1 gap-x-10 @lg:columns-2">
            {skills.map(([key, row]) => (
              <SkillRow
                key={key}
                ch={ch}
                skillKey={key}
                row={row}
                showAdj={showAdj}
                onPatch={write}
                onRemove={row.custom ? () => removeCustom(key) : null}
              />
            ))}
          </div>
          <div className="mt-4">
            <AddSkill onAdd={(name, ability) => write(addCustomSkill(ch, name, ability, d.skills))} />
          </div>
        </section>
      </div>
    </ParchmentSheet>
  );
}
