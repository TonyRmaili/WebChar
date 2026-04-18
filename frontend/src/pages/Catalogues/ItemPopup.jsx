import React from "react";
import { attuneLabel } from "./itemHelpers";

// Header line like: "Wondrous Item, Rare (Requires Attunement By A Wizard)"
const buildSubheader = (item) => {
  const parts = [];
  if (item.wondrous) parts.push("Wondrous Item");
  if (item.type) parts.push(item.type);
  if (item.rarity && item.rarity !== "none") parts.push(cap(item.rarity));
  const head = parts.join(", ");
  const attune = attuneLabel(item.reqAttune);
  return attune ? `${head} (Requires ${attune.replace(/^Attunement/, "Attunement")})` : head;
};

const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

// Format "+1", "+2d6" style bonus entries
const BONUS_LABELS = {
  ac: "AC",
  weapon: "Attack & Damage",
  weaponAttack: "Weapon Attack",
  weaponDamage: "Weapon Damage",
  spellAttack: "Spell Attack",
  spellSaveDc: "Spell Save DC",
  savingThrow: "Saving Throws",
  savingThrowConcentration: "Concentration Saves",
  proficiencyBonus: "Proficiency Bonus",
  abilityCheck: "Ability Checks",
};

export default function ItemPopup({ item }) {
  if (!item) return null;

  const {
    name, source, page, entries = [],
    bonuses, ability, focus, charges, recharge,
    weight, value, dmg1, dmg2, dmgType, property,
    resist, immune, vulnerable, conditionImmune,
    attachedSpells, lootTables,
  } = item;

  return (
    <div className="bg-[#fdf6e3] text-stone-900 font-serif rounded-sm shadow-lg
                    border border-stone-400 overflow-y-auto h-full">
      <div className="px-5 py-4">
        {/* Title row */}
        <div className="flex justify-between items-baseline border-b border-stone-300 pb-1 mb-2">
          <h2 className="text-xl font-bold tracking-wide uppercase text-stone-900">
            {name}
          </h2>
          <span className="text-xs text-stone-500">
            {source}{page ? ` p${page}` : ""}
          </span>
        </div>

        {/* Subheader */}
        <p className="italic text-sm text-stone-700 mb-3">
          {buildSubheader(item)}
        </p>

        {/* Quick stats strip */}
        <QuickStats
          weight={weight}
          value={value}
          dmg1={dmg1}
          dmg2={dmg2}
          dmgType={dmgType}
          property={property}
          charges={charges}
          recharge={recharge}
        />

        {/* Bonuses */}
        {bonuses && Object.keys(bonuses).length > 0 && (
          <SectionStrip title="Bonuses">
            {Object.entries(bonuses).map(([k, v]) => (
              <Chip key={k} label={BONUS_LABELS[k] || k}>{v}</Chip>
            ))}
          </SectionStrip>
        )}

        {/* Ability */}
        {ability && <AbilityBlock ability={ability} />}

        {/* Resistances / immunities */}
        {(resist || immune || vulnerable || conditionImmune) && (
          <SectionStrip title="Defenses">
            {resist?.map((r) => <Chip key={`r-${r}`} label="Resist">{r}</Chip>)}
            {immune?.map((r) => <Chip key={`i-${r}`} label="Immune">{r}</Chip>)}
            {vulnerable?.map((r) => <Chip key={`v-${r}`} label="Vulnerable">{r}</Chip>)}
            {conditionImmune?.map((r) => <Chip key={`ci-${r}`} label="Cond. Immune">{r}</Chip>)}
          </SectionStrip>
        )}

        {/* Focus */}
        {focus?.length > 0 && (
          <SectionStrip title="Spellcasting Focus">
            {focus.map((f) => <Chip key={f}>{f}</Chip>)}
          </SectionStrip>
        )}

        {/* Entries */}
        <div className="mt-3 space-y-2 text-sm leading-relaxed">
          {entries.map((e, i) => <EntryBlock key={i} entry={e} />)}
        </div>

        {/* Attached spells */}
        {attachedSpells?.length > 0 && (
          <div className="mt-4 pt-2 border-t border-stone-300 text-sm">
            <span className="font-bold">Spells: </span>
            <span className="italic text-stone-700">{attachedSpells.join(", ")}</span>
          </div>
        )}

        {/* Loot tables */}
        {lootTables?.length > 0 && (
          <div className="mt-2 text-xs text-stone-600">
            <span className="font-semibold">Found On: </span>
            {lootTables.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────── sub-components ─────────

function QuickStats({ weight, value, dmg1, dmg2, dmgType, property, charges, recharge }) {
  const rows = [];
  if (dmg1) {
    const dmg = [dmg1, dmg2 && `(${dmg2})`, dmgType].filter(Boolean).join(" ");
    rows.push(["Damage", dmg]);
  }
  if (property?.length) {
    rows.push(["Properties", property.map((p) => p.name).join(", ")]);
  }
  if (weight) rows.push(["Weight", `${weight} lb`]);
  if (value) rows.push(["Value", `${value} cp`]);
  if (charges) {
    const rechargeStr = recharge ? ` (recharges at ${recharge})` : "";
    rows.push(["Charges", `${charges}${rechargeStr}`]);
  }
  if (rows.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-stone-700 mb-3">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-1">
          <span className="font-semibold">{k}:</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}

function SectionStrip({ title, children }) {
  return (
    <div className="mb-2">
      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
        {title}
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
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

function AbilityBlock({ ability }) {
  const { set, increase, choose, count, amount } = ability;
  return (
    <SectionStrip title="Ability">
      {set && Object.entries(set).map(([k, v]) => (
        <Chip key={k} label={k.toUpperCase()}>set to {v}</Chip>
      ))}
      {increase && Object.entries(increase).map(([k, v]) => (
        <Chip key={k} label={k.toUpperCase()}>+{v}</Chip>
      ))}
      {choose && (
        <Chip label="Choose">
            {count} of [{choose.map((s) => String(s).toUpperCase()).join(", ")}], +{amount} each
        </Chip>
        )}
    </SectionStrip>
  );
}

function EntryBlock({ entry }) {
  if (entry.table) return <EntryTable table={entry.table} />;

  return (
    <p>
      {entry.name && <span className="font-bold italic">{entry.name}. </span>}
      <span>{entry.text}</span>
    </p>
  );
}

function EntryTable({ table }) {
  return (
    <div className="my-2 border border-stone-400 rounded overflow-hidden">
      {table.caption && (
        <div className="bg-stone-200 px-2 py-1 text-xs font-semibold">{table.caption}</div>
      )}
      <table className="w-full text-xs">
        <thead className="bg-stone-100 border-b border-stone-300">
          <tr>
            {table.columns.map((c, i) => (
              <th key={i} className="text-left px-2 py-1 font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-t border-stone-200">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}