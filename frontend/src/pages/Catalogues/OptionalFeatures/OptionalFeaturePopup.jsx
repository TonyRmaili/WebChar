import React from "react";
import {
  formatSource, formatFeatureType, formatPrerequisite, formatConsumes,
  parseEntries, formatSpellAbility, formatSpellChoice, formatSpellName,
} from "./optionalFeatureHelpers";
import { SKILL_OPTIONS } from "../../../utils/Constants";

const ABIL = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };
const SENSE_LABEL = { darkvision: "Darkvision", tremorsense: "Tremorsense", blindsight: "Blindsight", truesight: "Truesight" };
const SPEED_LABEL = { walk: "Walk", fly: "Fly", swim: "Swim", climb: "Climb", burrow: "Burrow" };
const BONUS_LABEL = {
  spell_attack: "Spell Atk", spell_save_dc: "Spell Save DC", spell_damage: "Spell Dmg",
  weapon_attack: "Weapon Atk", weapon_damage: "Weapon Dmg",
  ranged_attack: "Ranged Atk", ranged_damage: "Ranged Dmg",
  melee_attack: "Melee Atk", melee_damage: "Melee Dmg",
  max_hp: "Max HP", ac: "AC", initiative: "Initiative",
  proficiency: "Proficiency", saving_throws: "Saving Throws", ability_checks: "Ability Checks",
};

const titleCase = (s) =>
  String(s || "").split(/[_\s]+/).filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const signed = (n) => (n > 0 ? `+${n}` : String(n));
const skillLabel = (k) => SKILL_OPTIONS[k]?.label || titleCase(k);

export default function OptionalFeaturePopup({ feature }) {
  if (!feature) return null;
  const {
    name, source, feature_type, consumes,
    prerequisite, entries, additional_spells,
    skill_proficiencies, featProgression, optionalfeatureProgression,
  } = feature;

  const blocks = parseEntries(entries);
  const prereqs = formatPrerequisite(prerequisite);
  // `consumes` may be an object ({ name, amount }) or a plain string.
  const cost = formatConsumes(consumes);

  return (
    <div className="bg-[#fdf6e3] text-stone-900 font-serif rounded-sm shadow-lg
                    border border-stone-400 overflow-y-auto h-full">
      <div className="px-5 py-4">
        <div className="flex justify-between items-baseline border-b border-stone-300 pb-1 mb-2">
          <h2 className="text-xl font-bold tracking-wide uppercase text-stone-900">{name}</h2>
          <span className="text-xs text-stone-500" title={formatSource(source)}>{source}</span>
        </div>

        {(feature_type || cost) && (
          <p className="italic text-sm text-stone-700 mb-3 flex items-center gap-2 flex-wrap">
            {feature_type && <span>{formatFeatureType(feature_type)}</span>}
            {cost && (
              <span className="not-italic text-[10px] uppercase tracking-wider
                               bg-stone-200 border border-stone-400 rounded px-1.5 py-0.5">
                Consumes {cost}
              </span>
            )}
          </p>
        )}

        {prereqs.length > 0 && (
          <SectionStrip title="Prerequisite">
            <span className="text-xs text-stone-800">{prereqs.join(" · ")}</span>
          </SectionStrip>
        )}

        {Array.isArray(skill_proficiencies) && skill_proficiencies.length > 0 && (
          <SectionStrip title="Skill Proficiencies">
            {skill_proficiencies.map((s, i) => <Chip key={i}>{skillLabel(s)}</Chip>)}
          </SectionStrip>
        )}

        <MechanicsBlock feature={feature} />

        <div className="mt-3 space-y-2 text-sm leading-relaxed">
          {blocks.map((b, i) => <Block key={i} block={b} />)}
        </div>

        {Array.isArray(featProgression) && featProgression.length > 0 && (
          <ProgressionSection title="Feat Progression" progression={featProgression} subKey="category" />
        )}
        {Array.isArray(optionalfeatureProgression) && optionalfeatureProgression.length > 0 && (
          <ProgressionSection title="Optional Feature Progression" progression={optionalfeatureProgression} subKey="featureType" />
        )}

        {additional_spells && <SpellSection spells={additional_spells} />}
      </div>
    </div>
  );
}

/* ───────── new mechanics block ───────── */

function objToChips(obj, labelMap = {}, valueFmt = (v) => `${v} ft.`) {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj)
    .filter(([, v]) => v != null && v !== "" && v !== 0)
    .map(([k, v]) => `${labelMap[k] || titleCase(k)} ${valueFmt(v)}`);
}

function MechanicsBlock({ feature }) {
  const senses = objToChips(feature.senses, SENSE_LABEL);
  const speeds = objToChips(feature.speeds, SPEED_LABEL);
  const asi = objToChips(feature.ability_score_increase, ABIL, (v) => signed(v));
  const bonuses = objToChips(feature.bonuses, BONUS_LABEL, (v) => signed(v));

  const immune = Array.isArray(feature.immune) ? feature.immune.map(titleCase) : [];
  const resist = Array.isArray(feature.resist) ? feature.resist.map(titleCase) : [];
  const vulnerable = Array.isArray(feature.vulnerable) ? feature.vulnerable.map(titleCase) : [];
  const condImmune = Array.isArray(feature.conditionImmune) ? feature.conditionImmune.map(titleCase) : [];

  const rows = [
    ["Senses", senses],
    ["Speeds", speeds],
    ["Ability Scores", asi],
    ["Bonuses", bonuses],
    ["Damage Immunities", immune],
    ["Damage Resistances", resist],
    ["Damage Vulnerabilities", vulnerable],
    ["Condition Immunities", condImmune],
  ];
  if (!rows.some(([, v]) => v.length)) return null;

  return (
    <div className="mt-1 mb-3 pb-2 border-b border-stone-300 space-y-1.5">
      {rows.map(([title, items]) =>
        items.length ? (
          <SectionStrip key={title} title={title}>
            {items.map((x, i) => <Chip key={i}>{x}</Chip>)}
          </SectionStrip>
        ) : null
      )}
    </div>
  );
}

function ProgressionSection({ title, progression, subKey }) {
  return (
    <div className="mt-4 pt-3 border-t border-stone-300">
      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">{title}</div>
      <div className="space-y-1 text-xs text-stone-800">
        {progression.map((p, i) => {
          const sub = p[subKey];
          return (
            <div key={i}>
              <span className="font-semibold">{p.name}</span>
              {Array.isArray(sub) && sub.length > 0 && (
                <span className="text-stone-500"> · {sub.map(titleCase).join(", ")}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── unchanged sub-components from your previous file ───────── */

function Block({ block }) {
  if (block.type === "heading")
    return <h3 className="font-bold text-base mt-3 mb-1 text-stone-900">{block.text}</h3>;
  if (block.type === "table") return <EntryTable block={block} />;
  if (block.type === "list") return <EntryList items={block.items} />;
  if (block.type === "paragraph")
    return <p>{block.lead && <span className="font-semibold">{block.lead}. </span>}{block.text}</p>;
  return <p>{block.text}</p>;
}

function EntryList({ items }) {
  return (
    <ul className="space-y-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-1">
          <span className="text-stone-400">•</span>
          <span>{it.label && <span className="font-semibold">{it.label} </span>}{it.text}</span>
        </li>
      ))}
    </ul>
  );
}

function EntryTable({ block }) {
  return (
    <div className="my-2 border border-stone-400 rounded overflow-hidden">
      {block.caption && <div className="bg-stone-200 px-2 py-1 text-xs font-semibold">{block.caption}</div>}
      <table className="w-full text-xs">
        <thead className="bg-stone-100 border-b border-stone-300">
          <tr>{block.header.map((c, i) => <th key={i} className="text-left px-2 py-1 font-semibold">{c}</th>)}</tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i} className="border-t border-stone-200">
              {row.map((cell, j) => <td key={j} className="px-2 py-1 align-top">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionStrip({ title, children }) {
  return (
    <div className="mb-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">{title}: </span>
      <span className="inline-flex flex-wrap gap-1 align-middle">{children}</span>
    </div>
  );
}

function Chip({ children }) {
  return (
    <span className="text-xs bg-stone-200 border border-stone-400 rounded px-1.5 py-0.5">
      {children}
    </span>
  );
}

function SpellSection({ spells }) {
  const ability = formatSpellAbility(spells.ability);
  const resourceName = spells.resource_name;
  const atWill = spells.at_will || [];
  const daily = spells.daily || [];
  const ritualNamed = spells.ritual_named || [];
  const ritualChoice = spells.ritual_choice || [];
  const resourceCost = spells.resource_cost || [];
  const granted = spells.granted || [];

  const hasAny = atWill.length || daily.length || ritualNamed.length ||
                 ritualChoice.length || resourceCost.length || granted.length;
  if (!hasAny) return null;

  return (
    <div className="mt-4 pt-3 border-t border-stone-300">
      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
        Granted Spells
        {ability && <span className="text-stone-500 normal-case"> · {ability}</span>}
      </div>
      <div className="space-y-1.5 text-xs text-stone-800">
        {atWill.length > 0 && <SpellLine label="At Will">{atWill.map(formatSpellName).join(", ")}</SpellLine>}
        {daily.map((g, i) => (
          <SpellLine key={`d${i}`} label={`${g.uses}/long rest`}>{(g.spells || []).map(formatSpellName).join(", ")}</SpellLine>
        ))}
        {ritualNamed.length > 0 && <SpellLine label="Rituals">{ritualNamed.map(formatSpellName).join(", ")}</SpellLine>}
        {ritualChoice.map((c, i) => (
          <SpellLine key={`rch${i}`} label="Ritual Choice">{formatSpellChoice(c)}</SpellLine>
        ))}
        {resourceCost.map((c, i) => (
          <SpellLine key={`rc${i}`} label={`${c.cost} ${resourceName || "resource"}${c.cost > 1 ? "s" : ""}`}>
            {(c.spells || []).map(formatSpellName).join(", ")}
          </SpellLine>
        ))}
        {granted.map((c, i) => <SpellLine key={`g${i}`} label="Known">{formatSpellChoice(c)}</SpellLine>)}
      </div>
    </div>
  );
}

function SpellLine({ label, children }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="font-semibold">{label}:</span>
      <span className="text-stone-700">{children}</span>
    </div>
  );
}