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
    <div className="wc-page h-full overflow-y-auto !rounded-none">
      <div className="px-5 py-4">
        {/* Title */}
        <div className="mb-2 flex items-baseline justify-between border-b border-rule/40 pb-1">
          <h2 className="text-xl font-bold uppercase tracking-wide text-ink">{name}</h2>
          <span className="text-xs text-ink-faded" title={formatSource(source)}>{source}</span>
        </div>

        {/* Subheader: category + repeatable */}
        {(category || repeatable) && (
          <p className="mb-3 flex items-baseline gap-3 text-sm italic text-ink-faded">
            {category && <span>{formatCategory(category)} Feat</span>}
            {repeatable && (
              <span className="text-[10px] font-semibold uppercase not-italic tracking-wider text-rubric">
                Repeatable
              </span>
            )}
          </p>
        )}

        {/* Prerequisite */}
        {prereqs.length > 0 && (
          <SectionStrip title="Prerequisite">
            <span className="text-sm text-ink">{prereqs.join(" or ")}</span>
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
    <div className="mt-4 space-y-2 border-t border-rule/40 pt-3">
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
              {f.type && <span className="text-ink-faded"> · {titleCase(f.type)}</span>}
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
    return <h3 className="mb-1 mt-3 text-base font-bold text-ink">{block.text}</h3>;
  if (block.type === "table") return <EntryTable block={block} />;
  return <p>{block.text}</p>;
}

function EntryTable({ block }) {
  return (
    <div className="my-2 overflow-hidden border-y border-rule/40">
      {block.caption && (
        <div className="bg-rule/10 px-2 py-1 text-xs font-semibold">{block.caption}</div>
      )}
      <table className="w-full text-xs">
        <thead className="border-b border-rule/40">
          <tr>
            {block.header.map((c, i) => (
              <th key={i} className="px-2 py-1 text-left font-semibold text-ink-faded">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i} className="border-t border-rule/20 even:bg-ink/[0.03]">
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
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faded">{title}</div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">{children}</div>
    </div>
  );
}

function Chip({ label, children }) {
  return (
    <span className="text-sm">
      {label && <span className="font-semibold text-ink-faded">{label}: </span>}
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
    <div className="mt-4 border-t border-rule/40 pt-3">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faded">
        Granted Spells
        {ability && <span className="normal-case tracking-normal"> · {ability}</span>}
      </div>

      {list.length > 0 && (
        <div className="mb-2 space-y-0.5 text-sm text-ink">
          {list.map((s, i) => {
            const { label, meta } = formatSpellEntry(s);
            return (
              <div key={i} className="flex flex-wrap gap-2">
                <span className="font-semibold">{label}</span>
                {meta && <span className="italic text-ink-faded">{meta}</span>}
              </div>
            );
          })}
        </div>
      )}

      {extended.length > 0 && (
        <div className="text-sm text-ink">
          <span className="font-semibold">Expanded list:</span>
          {Object.keys(byLevel).sort((a, b) => a - b).map((lvl) => (
            <div key={lvl}>
              <span className="text-ink-faded">Lvl {lvl}: </span>
              {byLevel[lvl].join(", ")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}