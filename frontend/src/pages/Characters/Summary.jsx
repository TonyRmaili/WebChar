import React from "react";
import { formatSpeed, formatSenses } from "../Catalogues/Races/raceHelpers";
import { ABILITIES_ORDER } from "../../utils/Constants";
import { INK, InkHeading, Line, SubHeading } from "../../styles/parchment";
import { labelFor, formatFeatTag } from "./wizard/wizardHelpers";
import { selectedValues, isResolved } from "./wizard/choiceEngine";
import { classDisplayName } from "./wizard/classEngine";

/* The Builder's running summary, written in the margin beside the steps:
   what the character has so far, clashes, and what is still to choose. */

const METHOD_LABELS = {
  standard: "standard array",
  pointBuy: "point buy",
  random: "rolled 3d6",
  custom: "custom",
};

const ABIL = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };
const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
const fmtMod = (m) => (m == null ? "" : m >= 0 ? `+${m}` : `${m}`);

/* Collapse duplicate grants for display while remembering every owner,
   so a clash shows once, flagged with both sources. */
function dedupe(entries = []) {
  const map = new Map();
  for (const e of entries) {
    const k = `${e.family}:${e.value}`;
    if (!map.has(k)) map.set(k, { ...e, owners: [] });
    const row = map.get(k);
    if (e.owner && !row.owners.includes(e.owner)) row.owners.push(e.owner);
  }
  return [...map.values()];
}

// A heading and a comma list of words.
function Words({ label, children }) {
  return (
    <div>
      <SubHeading>{label}</SubHeading>
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function wordList(items) {
  return items.map((it, i) => (
    <React.Fragment key={i}>
      {i > 0 && <span className={INK.faint}>, </span>}
      {it}
    </React.Fragment>
  ));
}

/* Grants that carry their owner in a tooltip and turn rubric (with ⚠)
   when more than one source granted the same thing. */
function GrantWords({ label, entries }) {
  if (!entries?.length) return null;
  return (
    <Words label={label}>
      {wordList(
        entries.map((e) => {
          const clash = e.owners.length > 1;
          return (
            <span key={`${e.family}:${e.value}`} title={`${clash ? "Granted twice by " : "From "}${e.owners.join(", ")}`} className={clash ? INK.rubric : ""}>
              {labelFor(e.value, e.family)}
              {clash && " ⚠"}
            </span>
          );
        })
      )}
    </Words>
  );
}

export default function Summary({
  editions,
  selectedRace,
  subrace,
  selectedBackground,
  classEntries = [],
  classes,
  stats,
  optionalFeatures = [],
  maxHp,
  grants,
  choices = [],
  choiceSel = {},
  overlap,
  choiceTitle,
  valueLabel,
  abilityMethod,
  abilityScores,
}) {
  const hasAnyScore = abilityScores && Object.values(abilityScores).some((v) => v != null);

  const g = grants || {};
  const feats = dedupe(g.feats);
  const classFeats = classEntries.flatMap((e) => e.feats || []);
  const goldTotal = (g.equipment || []).reduce((sum, e) => sum + (e.gp || 0), 0);
  const gear = (g.equipment || []).filter((e) => !String(e.value).startsWith("gold:"));
  const pending = choices.filter((c) => c.kind !== "subrace" && !isResolved(c, choiceSel[c.id], subrace));
  const nothingYet = !selectedRace && !selectedBackground && classEntries.length === 0;

  return (
    <aside className="@5xl:sticky @5xl:top-4 @5xl:max-h-[calc(100vh-2rem)] @5xl:overflow-y-auto">
      <InkHeading right={<span className={`text-[11px] italic ${INK.faint}`}>{editions.length === 2 ? "One D&D + Classic" : editions.includes("one") ? "One D&D" : "Classic"}</span>}>
        So far
      </InkHeading>

      <div className="space-y-4">
        {/* ───────── ability scores ───────── */}
        {abilityScores && (
          <div>
            <SubHeading>
              Ability scores <span className={`ml-1 normal-case tracking-normal italic ${INK.faint}`}>{METHOD_LABELS[abilityMethod] || ""}</span>
            </SubHeading>
            {hasAnyScore ? (
              <div className="grid grid-cols-6 gap-1 text-center @5xl:grid-cols-3">
                {ABILITIES_ORDER.map(({ key, label }) => {
                  const base = abilityScores[key];
                  const bonus = g.abilities?.[key] || 0;
                  const total = base == null ? null : base + bonus;
                  return (
                    <div key={key} title={bonus ? `${base} + ${bonus} from race/background` : undefined}>
                      <div className={`text-[9px] font-semibold uppercase tracking-[0.15em] ${INK.faded}`}>{label}</div>
                      <div className={`text-xl leading-tight tabular-nums ${total == null ? INK.faint : bonus ? INK.rubric : ""}`}>{total ?? "—"}</div>
                      <div className={`text-[10px] italic tabular-nums ${INK.faded}`}>{fmtMod(total == null ? null : Math.floor((total - 10) / 2))}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={`text-sm italic ${INK.faint}`}>No scores assigned yet.</p>
            )}
          </div>
        )}

        {/* ───────── overlap warnings ───────── */}
        {overlap?.collisions?.length > 0 && (
          <div>
            <SubHeading>Given twice</SubHeading>
            <ul className="space-y-0.5">
              {overlap.collisions.map((c) => (
                <li key={`${c.family}:${c.value}`} className={`text-sm leading-snug ${INK.rubric}`}>
                  ⚠ {c.label}{" "}
                  <span className="italic">
                    — {c.owners.join(" and ")}
                    {c.resolvable ? "; pick something else" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {nothingYet ? (
          <p className={`text-sm italic ${INK.faint}`}>Nothing chosen yet.</p>
        ) : (
          <>
            {classEntries.length > 0 && (
              <div>
                <SubHeading>
                  {classEntries.length > 1 ? "Classes" : "Class"}
                  <span className={`ml-1 normal-case tracking-normal italic ${INK.faint}`}>
                    level {stats?.totalLevel ?? 0}
                    {stats?.proficiencyBonus != null && ` · proficiency +${stats.proficiencyBonus}`}
                  </span>
                </SubHeading>
                {classEntries.map((e) => (
                  <p key={e.key} className="text-[15px]">
                    {classDisplayName(classes, e.key, e.edition)} <span className="tabular-nums">{e.level}</span>
                    {e.subclass && <span className="italic"> · {e.subclass}</span>}
                    <span className={`text-xs italic ${INK.faint}`}> {e.edition === "one" ? "One D&D" : "Classic"}</span>
                  </p>
                ))}
                {stats?.hitDice?.length > 0 && (
                  <Line label="Hit dice" className="text-sm">
                    <span className="tabular-nums">{stats.hitDice.map((h) => h.label).join(" + ")}</span>
                  </Line>
                )}
                {maxHp > 0 && (
                  <Line label="Max HP">
                    <span className="tabular-nums">{maxHp}</span>
                  </Line>
                )}
                {stats?.saves?.length > 0 && (
                  <Line label="Saves">
                    <span>{stats.saves.map((s) => ABIL[s] || s.toUpperCase()).join(", ")}</span>
                  </Line>
                )}
              </div>
            )}

            {stats?.spellSlots && (
              <Words label="Spell slots">
                {wordList(
                  stats.spellSlots
                    .map((n, i) => (n > 0 ? <span key={i}><span className={INK.faded}>{ORDINAL[i]}</span> {n}</span> : null))
                    .filter(Boolean)
                )}
              </Words>
            )}
            {stats?.spellNote && <p className={`text-sm italic ${INK.rubric}`}>{stats.spellNote}</p>}

            {optionalFeatures.length > 0 && (
              <Words label="Feature choices">
                {wordList(optionalFeatures.map((f) => `${f.name} ×${f.count}`))}
                <span className={`block text-xs italic ${INK.faint}`}>not pickable in the builder yet</span>
              </Words>
            )}

            {(selectedRace || selectedBackground) && (
              <div>
                {selectedRace && (
                  <Line label="Race">
                    <span>{subrace ? subrace.display_name || subrace.name : selectedRace.name}</span>
                    <span className={`text-[10px] uppercase tracking-wider ${INK.faint}`}>{selectedRace.source}</span>
                  </Line>
                )}
                {selectedBackground && (
                  <Line label="Background">
                    <span>{selectedBackground.name}</span>
                    <span className={`text-[10px] uppercase tracking-wider ${INK.faint}`}>{selectedBackground.source}</span>
                  </Line>
                )}
                {formatSpeed(g.speed) && <Line label="Speed">{formatSpeed(g.speed)}</Line>}
                {formatSenses(g.senses) && <Line label="Senses">{formatSenses(g.senses)}</Line>}
                {g.traits?.length > 0 && <Line label="Traits">{g.traits.length}</Line>}
              </div>
            )}

            {Object.keys(g.abilities || {}).length > 0 && (
              <Words label="Ability bonuses">
                {wordList(Object.entries(g.abilities).map(([k, v]) => `${ABIL[k] || k.toUpperCase()} ${v >= 0 ? "+" : ""}${v}`))}
              </Words>
            )}

            <GrantWords label="Skills" entries={dedupe(g.skills)} />
            <GrantWords label="Tools" entries={dedupe(g.tools)} />
            <GrantWords label="Languages" entries={dedupe(g.languages)} />
            <GrantWords label="Weapons" entries={dedupe(g.weapons)} />
            <GrantWords label="Armor" entries={dedupe(g.armor)} />

            {feats.length > 0 && <Words label="Origin feats">{wordList(feats.map((f) => formatFeatTag(f.value)))}</Words>}

            {/* With the book shown, so it's clear WHICH Alert was picked. */}
            {classFeats.length > 0 && (
              <Words label="Class feats">
                {wordList(
                  classFeats.map((f) => (
                    <span key={`${f.name}__${f.source}`}>
                      {f.name} <span className={`text-[10px] uppercase tracking-wider ${INK.faint}`}>{f.source}</span>
                    </span>
                  ))
                )}
              </Words>
            )}

            {(gear.length > 0 || goldTotal > 0) && (
              <Words label={goldTotal > 0 ? `Equipment · ${goldTotal} gp` : "Equipment"}>{wordList(gear.map((e) => e.label))}</Words>
            )}

            {/* ───────── outstanding choices ───────── */}
            {pending.length > 0 && (
              <div>
                <SubHeading>Still to choose</SubHeading>
                <ul className="space-y-0.5">
                  {pending.map((c) => {
                    const sel = selectedValues(c, choiceSel[c.id]);
                    return (
                      <li key={c.id} className="text-sm">
                        <span className={INK.faded}>{choiceTitle(c)}</span>{" "}
                        {sel.length ? (
                          <span>{sel.map((v) => valueLabel(c, v)).join(", ")}</span>
                        ) : (
                          <span className={`italic ${INK.rubric}`}>{c.count} to pick</span>
                        )}
                        <span className={`italic ${INK.faint}`}> · {c.owner}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}