import React from "react";
import {
  formatSource,
  formatCategory,
  formatPrerequisite,
  formatAbilityScoreIncrease,
  parseFeatEntries,
  formatSpellAbility,
  formatSpellEntry,
} from "./featsHelpers";

const ABIL = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };
const SENSE_LABEL = {
  darkvision: "Darkvision", tremorsense: "Tremorsense",
  blindsight: "Blindsight", truesight: "Truesight",
};
const titleCase = (s) =>
  String(s || "").split(/[_\s]+/).filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const strList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

export default function FeatPopup({ feat }) {
  if (!feat) return null;

  const {
    name, source, category, repeatable,
    prerequisite, ability_score_increase,
    entries, additional_spells,
  } = feat;

  const blocks = parseFeatEntries(entries);
  const prereqs = formatPrerequisite(prerequisite);
  const asi = formatAbilityScoreIncrease(ability_score_increase);
  const spells = additional_spells;

  return (
    <div className="bg-[#fdf6e3] text-stone-900 font-serif rounded-sm shadow-lg
                    border border-stone-400 overflow-y-auto h-full">
      <div className="px-5 py-4">
        {/* Title */}
        <div className="flex justify-between items-baseline border-b border-stone-300 pb-1 mb-2">
          <h2 className="text-xl font-bold tracking-wide uppercase text-stone-900">{name}</h2>
          <span className="text-xs text-stone-500" title={formatSource(source)}>{source}</span>
        </div>

        {/* Subheader: category + repeatable */}
        {(category || repeatable) && (
          <p className="italic text-sm text-stone-700 mb-3 flex items-center gap-2">
            {category && <span>{formatCategory(category)} Feat</span>}
            {repeatable && (
              <span className="not-italic text-[10px] uppercase tracking-wider
                               bg-stone-200 border border-stone-400 rounded px-1.5 py-0.5">
                Repeatable
              </span>
            )}
          </p>
        )}

        {/* Prerequisite */}
        {prereqs.length > 0 && (
          <SectionStrip title="Prerequisite">
            <span className="text-xs text-stone-800">{prereqs.join(" or ")}</span>
          </SectionStrip>
        )}

        {/* Ability Score Increase */}
        {asi.length > 0 && (
          <SectionStrip title="Ability Score Increase">
            {asi.map((a, i) => <Chip key={i}>{a}</Chip>)}
          </SectionStrip>
        )}

        {/* Body */}
        <div className="mt-3 space-y-2 text-sm leading-relaxed">
          {blocks.map((b, i) => <Block key={i} block={b} />)}
        </div>

        {/* Mechanical grants */}
        <MechanicsBlock feat={feat} />

        {/* Granted spells */}
        {spells && <SpellSection spells={spells} />}
      </div>
    </div>
  );
}

/* ───────── mechanics (senses / defenses / proficiencies / features) ───────── */

function MechanicsBlock({ feat }) {
  const senses = feat.senses;
  const senseChips =
    senses && typeof senses === "object"
      ? Object.entries(senses)
          .filter(([, v]) => v != null && v !== "")
          .map(([k, v]) => `${SENSE_LABEL[k] || titleCase(k)} ${v} ft.`)
      : [];

  const features = Array.isArray(feat.additonal_feature)
    ? feat.additonal_feature
        .map((f) => (typeof f === "string"
          ? { name: f, type: "" }
          : { name: f?.name || "", type: f?.feature_type || "" }))
        .filter((f) => f.name)
    : [];

  const rows = [
    ["Senses", senseChips],
    ["Damage Immunities", strList(feat.immune).map(titleCase)],
    ["Damage Resistances", strList(feat.resist).map(titleCase)],
    ["Condition Immunities", strList(feat.conditionImmune).map(titleCase)],
    ["Saving Throws", strList(feat.savingThrowProficiencies).map((a) => ABIL[a] || a.toUpperCase())],
    ["Skills", strList(feat.skillProficiencies).map(titleCase)],
    ["Expertise", strList(feat.expertise).map(titleCase)],
    ["Languages", strList(feat.languageProficiencies).map(titleCase)],
    ["Tools", strList(feat.toolProficiencies).map(titleCase)],
    ["Weapon Proficiencies", strList(feat.weaponProficiencies).map(titleCase)],
    ["Armor Proficiencies", strList(feat.armorProficiencies).map(titleCase)],
  ];

  const hasAny = rows.some(([, items]) => items.length) || features.length;
  if (!hasAny) return null;

  return (
    <div className="mt-4 pt-3 border-t border-stone-300 space-y-2">
      {rows.map(([title, items]) =>
        items.length ? (
          <SectionStrip key={title} title={title}>
            {items.map((x, i) => <Chip key={i}>{x}</Chip>)}
          </SectionStrip>
        ) : null
      )}
      {features.length > 0 && (
        <SectionStrip title="Additional Features">
          {features.map((f, i) => (
            <Chip key={i}>
              {f.name}
              {f.type && <span className="text-stone-500"> · {titleCase(f.type)}</span>}
            </Chip>
          ))}
        </SectionStrip>
      )}
    </div>
  );
}

/* ───────── existing sub-components ───────── */

function Block({ block }) {
  if (block.type === "heading")
    return <h3 className="font-bold text-base mt-3 mb-1 text-stone-900">{block.text}</h3>;
  if (block.type === "table") return <EntryTable block={block} />;
  return <p>{block.text}</p>;
}

function EntryTable({ block }) {
  return (
    <div className="my-2 border border-stone-400 rounded overflow-hidden">
      {block.caption && (
        <div className="bg-stone-200 px-2 py-1 text-xs font-semibold">{block.caption}</div>
      )}
      <table className="w-full text-xs">
        <thead className="bg-stone-100 border-b border-stone-300">
          <tr>
            {block.header.map((c, i) => (
              <th key={i} className="text-left px-2 py-1 font-semibold">{c}</th>
            ))}
          </tr>
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
    <div className="mb-2">
      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">{title}</div>
      <div className="flex flex-wrap gap-1 items-center">{children}</div>
    </div>
  );
}

function Chip({ label, children }) {
  return (
    <span className="text-xs bg-stone-200 border border-stone-400 rounded px-1.5 py-0.5">
      {label && <span className="font-semibold">{label}: </span>}
      {children}
    </span>
  );
}

function SpellSection({ spells }) {
  const ability = formatSpellAbility(spells.spellcasting_ability);
  const list = spells.spells || [];
  const extended = spells.extended_spell_list || [];
  if (!list.length && !extended.length) return null;

  const byLevel = {};
  for (const e of extended) {
    if (!byLevel[e.spell_level]) byLevel[e.spell_level] = [];
    byLevel[e.spell_level].push(e.name);
  }

  return (
    <div className="mt-4 pt-3 border-t border-stone-300">
      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
        Granted Spells
        {ability && <span className="text-stone-500 normal-case"> · {ability}</span>}
      </div>

      {list.length > 0 && (
        <div className="space-y-0.5 text-xs text-stone-800 mb-2">
          {list.map((s, i) => {
            const { label, meta } = formatSpellEntry(s);
            return (
              <div key={i} className="flex flex-wrap gap-2">
                <span className="font-semibold">{label}</span>
                {meta && <span className="text-stone-500">{meta}</span>}
              </div>
            );
          })}
        </div>
      )}

      {extended.length > 0 && (
        <div className="text-xs text-stone-800">
          <span className="font-semibold">Expanded list:</span>
          {Object.keys(byLevel).sort((a, b) => a - b).map((lvl) => (
            <div key={lvl}>
              <span className="text-stone-500">Lvl {lvl}: </span>
              {byLevel[lvl].join(", ")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}