import React, { useState } from "react";
import useCharStore from "../../../../store/CharStore";
import { usePersistedOpen } from "../../../../utils/SectionCard";
import { Bubble, INK, InkButton, InkHeading, InkNumber, InkSelect, InkText, Leader, ParchmentSheet } from "../../../../styles/parchment";
import {
  ABILITIES,
  abilitiesOf,
  addSkill,
  checkTotal,
  hasAdjustments,
  isCustomSkill,
  modOf,
  nextProf,
  passiveOf,
  patchAbility,
  pbOf,
  profLevel,
  removeSkill,
  saveTotal,
  signed,
  skillAbilityShort,
  skillTotal,
  skillsOf,
  sortedSkills,
  toInt,
} from "./abilityHelpers";

/* Define tab: Abilities — ability scores, saves and skills, written on a
   parchment sheet (see src/styles/parchment.jsx).

   Half width: abilities, then skills (two columns when there's room).
   Full width: abilities on the left, skills on the right.
   Adjustments (the small ± boxes) are hidden until "adjustments" is on,
   or shown from the start if any are already set. */

const small = `text-[10px] font-semibold uppercase tracking-[0.18em] ${INK.faded}`;

/* ─── Ability table ──────────────────────────────────────────────── */

function AbilityTable({ abilities, pb, showAdj, onPatch }) {
  const cols = showAdj
    ? "grid-cols-[minmax(0,1fr)_3rem_2.5rem_5.25rem_6.75rem]"
    : "grid-cols-[minmax(0,1fr)_3rem_2.5rem_3rem_4.25rem]";

  return (
    <div className={`grid ${cols} items-baseline gap-x-2`}>
      <span />
      <span className={`${small} text-center`}>Score</span>
      <span className={`${small} text-center`}>Mod</span>
      <span className={`${small} text-center`}>Check</span>
      <span className={`${small} text-center`}>Save</span>

      {ABILITIES.map((a) => {
        const row = abilities[a.key];
        const mod = modOf(row);
        const save = saveTotal(row, pb);
        const level = profLevel(row);
        return (
          <React.Fragment key={a.key}>
            <div className="flex min-w-0 items-baseline py-1.5">
              <span className="truncate text-[15px]">{a.label}</span>
              <Leader />
            </div>
            <InkNumber
              value={row.score === "" ? null : toInt(row.score, null)}
              min={0}
              max={30}
              placeholder="—"
              onChange={(v) => onPatch(a.key, { score: v })}
              aria-label={`${a.label} score`}
              className="h-8 text-base"
            />
            <span className="text-center text-lg font-semibold">{signed(mod)}</span>
            <span className="flex items-baseline justify-center gap-1">
              <span className="tabular-nums">{signed(checkTotal(row))}</span>
              {showAdj && <AdjInput value={row.check_mod} onChange={(v) => onPatch(a.key, { check_mod: v })} label={`${a.label} check adjustment`} />}
            </span>
            <span className="flex items-center justify-center gap-1">
              <Bubble level={level} onClick={() => onPatch(a.key, nextProf(row))} label={`${a.label} save`} />
              <span className={`w-7 tabular-nums ${level !== "none" ? `${INK.rubric} font-semibold` : ""}`}>{signed(save)}</span>
              {showAdj && <AdjInput value={row.save_mod} onChange={(v) => onPatch(a.key, { save_mod: v })} label={`${a.label} save adjustment`} />}
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

function SkillRow({ skillKey, row, total, showAdj, onPatch, onRemove }) {
  const level = profLevel(row);
  return (
    <div className="group flex break-inside-avoid items-center gap-1.5 py-[3px]">
      <Bubble level={level} onClick={() => onPatch(nextProf(row))} label={row.label} />
      <div className="flex min-w-0 flex-1 items-baseline">
        <span className={`truncate text-[15px] ${level === "none" ? "" : "font-semibold"}`}>{row.label || skillKey}</span>
        <span className={`ml-1.5 shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`}>{skillAbilityShort(row)}</span>
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
      <span className={`w-8 shrink-0 text-right tabular-nums ${level !== "none" ? `${INK.rubric} font-semibold` : ""}`}>{signed(total)}</span>
      {showAdj && <AdjInput value={row.value} onChange={(v) => onPatch({ value: v })} label={`${row.label} adjustment`} />}
    </div>
  );
}

function AddSkill({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ability, setAbility] = useState("Strength");

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
        {ABILITIES.map((a) => (
          <option key={a.key} value={a.label}>
            {a.label}
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

export default function AbilitiesDefine() {
  const charData = useCharStore((s) => s.charData);
  const patchChar = useCharStore((s) => s.patchChar);

  const abilities = abilitiesOf(charData);
  const skills = skillsOf(charData);
  const [showAdj, setShowAdj] = usePersistedOpen("abilities.adjustments", hasAdjustments(abilities, skills));

  if (!charData) return null;

  const pb = pbOf(charData);

  // Every change here is a single click or a finished number, so save right away.
  const write = (key, value) => patchChar({ [key]: value }, { now: true });

  const patchAbilityRow = (key, patch) => write("ability_scores", patchAbility(abilities, key, patch));
  const patchSkill = (key, patch) => write("skills", { ...skills, [key]: { ...skills[key], ...patch } });

  const removeCustom = (key) => {
    if (!window.confirm(`Remove "${skills[key]?.label || key}"?`)) return;
    write("skills", removeSkill(skills, key));
  };

  const passives = [
    ["Perception", passiveOf(skills, "perception", abilities, pb)],
    ["Insight", passiveOf(skills, "insight", abilities, pb)],
    ["Investigation", passiveOf(skills, "investigation", abilities, pb)],
  ].filter(([, v]) => v != null);

  return (
    <ParchmentSheet>
      {/* Title */}
      <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="text-2xl tracking-wide">Abilities &amp; Skills</h3>
        <span className={`text-sm italic ${INK.faded}`}>
          proficiency bonus <span className={`not-italic font-semibold ${INK.ink}`}>{signed(pb)}</span>
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
            <AbilityTable abilities={abilities} pb={pb} showAdj={showAdj} onPatch={patchAbilityRow} />
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
            {sortedSkills(skills).map(([key, row]) => (
              <SkillRow
                key={key}
                skillKey={key}
                row={row}
                total={skillTotal(row, abilities, pb)}
                showAdj={showAdj}
                onPatch={(patch) => patchSkill(key, patch)}
                onRemove={isCustomSkill(key) ? () => removeCustom(key) : null}
              />
            ))}
          </div>
          <div className="mt-4">
            <AddSkill onAdd={(name, ability) => write("skills", addSkill(skills, name, ability))} />
          </div>
        </section>
      </div>
    </ParchmentSheet>
  );
}