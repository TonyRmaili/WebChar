import React from "react";
import { InkHeading } from "../../../styles/parchment";
import { MechanicsRows } from "../catalogueParts";
import { ABILITY_NAMES, formatCurrency, formatItemGrant } from "../catalogueHelpers";
import { formatAbilityGroups, formatRequires, isEquipment, resourceWords, spellcastingRows } from "./classHelpers";

/* A class's traits down the left column: primary ability, hit point
   die, saves, proficiencies and picks, starting equipment, spellcasting,
   resources and multiclassing. Grants and picks are written with the
   catalogue's shared wording (MechanicsRows); the starting equipment is
   written here: what's always given, then each "choose one of" A / B / C. */
export default function ClassTraitsPanel({ cls, index }) {
  if (!cls) return <p className="text-sm italic text-ink-faded">Pick a class to see its traits.</p>;

  const choices = cls.choices || [];
  const equipment = choices.filter(isEquipment);
  const other = choices.filter((c) => !isEquipment(c));
  const sc = spellcastingRows(cls.spellcasting, index);
  const mc = cls.multiclass;
  // Items and coins are starting equipment, not proficiencies.
  const { items, currency, ...proficiencies } = cls.grants || {};
  const always = itemWords({ items, currency }, index);

  return (
    <aside className="space-y-6">
      <section className="space-y-2">
        <InkHeading>Core Traits</InkHeading>
        {cls.primary_ability?.length > 0 && <Trait label="Primary Ability">{formatAbilityGroups(cls.primary_ability)}</Trait>}
        <Trait label="Hit Point Die">
          <span className="font-semibold text-rubric">{cls.hit_die}</span> per {cls.name} level
        </Trait>
        {cls.saves?.length > 0 && <Trait label="Saving Throws">{cls.saves.map((a) => ABILITY_NAMES[a] || a).join(", ")}</Trait>}
      </section>

      <section className="space-y-2">
        <InkHeading>Proficiencies</InkHeading>
        <MechanicsRows entry={{ grants: proficiencies, choices: other }} index={index} />
      </section>

      {(always || equipment.length > 0 || cls.starting_gold) && (
        <section className="space-y-2">
          <InkHeading>Starting Equipment</InkHeading>
          {always && <Trait label="Always">{always}</Trait>}
          {equipment.map((b, i) => (
            <Trait key={b.id || i} label={equipment.length > 1 ? `Choose one of (${i + 1})` : "Choose one of"}>
              <ol className="space-y-0.5">
                {(b.options || []).map((o, j) => (
                  <li key={o.id || j} className="flex gap-2">
                    <span className="font-semibold text-rubric">{String.fromCharCode(65 + j)}</span>
                    <span>{optionWords(o, index)}</span>
                  </li>
                ))}
              </ol>
            </Trait>
          ))}
          {cls.starting_gold && <Trait label="Or gold instead">{cls.starting_gold} GP</Trait>}
        </section>
      )}

      {sc.length > 0 && (
        <section className="space-y-2">
          <InkHeading>Spellcasting</InkHeading>
          {sc.map((r) => <Trait key={r.label} label={r.label}>{r.value}</Trait>)}
        </section>
      )}

      {cls.resources?.length > 0 && (
        <section className="space-y-2">
          <InkHeading>Resources</InkHeading>
          {cls.resources.map((r) => <Trait key={r.id} label={r.name}>{resourceWords(r) || "see its feature"}</Trait>)}
        </section>
      )}

      {mc && (
        <section className="space-y-2">
          <InkHeading>Multiclassing</InkHeading>
          <Trait label="Requirements">{formatRequires(mc.requires) || "none"}</Trait>
          <MechanicsRows entry={{ grants: mc.grants, choices: mc.choices }} index={index} />
        </section>
      )}
    </aside>
  );
}

function Trait({ label, children }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faded">{label}</p>
      <div className="text-sm text-ink">{children}</div>
    </div>
  );
}

// "Bag of Holding, Focus, 1 GP" — the items and coins of a grant.
const itemWords = (g, index) =>
  [...(g?.items || []).map((i) => formatItemGrant(i, index)), formatCurrency(g?.currency)].filter(Boolean).join(", ");

// One "choose one of" option: its items and coins, else its label.
const optionWords = (o, index) => itemWords(o.grants, index) || o.label || "—";
