import React from "react";
import {
  propertyDescription, masteryDescription, attuneLabel,
  formatValue, formatCharged, formatModifySpeed,
  formatRange, formatLight, formatTierRarity,
} from "./itemHelpers";

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Header line like: "Wondrous Item, Major Legendary (Requires Attunement By A Wizard)"
const buildSubheader = (item) => {
  const parts = [];
  if (item.wondrous) parts.push("Wondrous Item");
  if (Array.isArray(item.types) && item.types.length) {
    parts.push(item.types.join(", "));
  } else if (item.type) {
    parts.push(item.type);
  }
  const tr = formatTierRarity(item.tier, item.rarity);
  if (tr) parts.push(tr);
  const head = parts.join(", ");
  const attune = attuneLabel(item.reqAttune);
  return attune ? `${head} (Requires ${attune.replace(/^Attunement/, "Attunement")})` : head;
};

// Format a damage object into a human-readable string.
function formatDamage(damage) {
  if (!damage) return "";
  if (damage.raw) {
    return damage.type ? `${damage.raw} ${damage.type}` : damage.raw;
  }

  const parts = [];
  if (damage.dice) {
    parts.push(`${damage.amount || 1}${damage.dice}`);
  } else if (damage.amount != null) {
    parts.push(String(damage.amount));
  }

  if (damage.mod != null && damage.mod !== 0) {
    if (parts.length > 0) {
      parts.push(damage.mod > 0 ? `+${damage.mod}` : String(damage.mod));
    } else {
      parts.push(String(damage.mod));
    }
  }

  let result = parts.join("");
  if (damage.type) {
    result = result ? `${result} ${damage.type}` : damage.type;
  }
  return result;
}

function formatBonusValue(key, value) {
  if (key === "spellDamage" && value && typeof value === "object") {
    return formatDamage(value);
  }
  if (typeof value === "number") {
    return value >= 0 ? `+${value}` : String(value);
  }
  return value == null ? "" : String(value);
}

const BONUS_LABELS = {
  ac: "AC",
  weapon: "Attack & Damage",
  weaponAttack: "Weapon Attack",
  weaponDamage: "Weapon Damage",
  spellAttack: "Spell Attack",
  spellSaveDc: "Spell Save DC",
  spellDamage: "Spell Damage",
  savingThrow: "Saving Throws",
  savingThrowConcentration: "Concentration Saves",
  proficiencyBonus: "Proficiency Bonus",
  abilityCheck: "Ability Checks",
};

export default function ItemPopup({ item }) {
  if (!item) return null;

  const {
    name,
    source,
    page,
    entries = [],
    bonuses,
    ability,
    focus,
    weight,
    value,
    damage,
    resist,
    immune,
    vulnerable,
    conditionImmune,
    attachedSpells,
    lootTables,
    curse,
    sentient,
    age,
    modifySpeed,
    baseItem,
    weaponCategory,
    range,
    light,
    charged,
  } = item;

  const tags = [
    curse && "Cursed",
    sentient && "Sentient",
    age && cap(age),
  ].filter(Boolean);

  const speedMods = formatModifySpeed(modifySpeed);

  return (
    <div className="wc-page h-full overflow-y-auto !rounded-none">
      <div className="px-5 py-4">
        {/* Title row */}
        <div className="mb-2 flex items-baseline justify-between border-b border-rule/40 pb-1">
          <h2 className="text-xl font-bold uppercase tracking-wide text-ink">
            {name}
          </h2>
          <span className="text-xs text-ink-faded">
            {source}
            {page ? ` p${page}` : ""}
          </span>
        </div>

        {/* Subheader */}
        <p className="mb-1 text-sm italic text-ink-faded">
          {buildSubheader(item)}
        </p>

        {/* Cursed • Sentient • Era */}
        {tags.length > 0 && (
          <p className="mb-3 text-xs italic text-rubric">
            {tags.join(" • ")}
          </p>
        )}

        {/* Quick stats strip */}
        <QuickStats
          weight={weight}
          value={value}
          damage={damage}
          range={range}
          light={light}
          baseItem={baseItem}
          weaponCategory={weaponCategory}
          charged={charged}
        />

        {/* Bonuses */}
        {bonuses && Object.keys(bonuses).length > 0 && (
          <SectionStrip title="Bonuses">
            {Object.entries(bonuses).map(([k, v]) => (
              <Chip key={k} label={BONUS_LABELS[k] || k}>
                {formatBonusValue(k, v)}
              </Chip>
            ))}
          </SectionStrip>
        )}

        {/* Speed modifications */}
        {speedMods.length > 0 && (
          <SectionStrip title="Speed">
            {speedMods.map((m, i) => (
              <Chip key={`${m.label}-${i}`} label={m.label}>{m.value}</Chip>
            ))}
          </SectionStrip>
        )}

        {/* Ability */}
        {ability && <AbilityBlock ability={ability} />}

        {/* Resistances / immunities */}
        {(resist || immune || vulnerable || conditionImmune) && (
          <SectionStrip title="Defenses">
            {resist?.map((r) => (
              <Chip key={`r-${r}`} label="Resist">{r}</Chip>
            ))}
            {immune?.map((r) => (
              <Chip key={`i-${r}`} label="Immune">{r}</Chip>
            ))}
            {vulnerable?.map((r) => (
              <Chip key={`v-${r}`} label="Vulnerable">{r}</Chip>
            ))}
            {conditionImmune?.map((r) => (
              <Chip key={`ci-${r}`} label="Cond. Immune">{r}</Chip>
            ))}
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

        {/* Properties */}
        {item.properties?.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faded">
              Properties
            </div>
            <div className="space-y-1 text-sm leading-relaxed">
              {item.properties.map((p) => {
                const desc = propertyDescription(p);
                return (
                  <p key={p}>
                    <span className="font-bold italic">{p}.</span>
                    {desc && <span> {desc}</span>}
                  </p>
                );
              })}
            </div>
          </div>
        )}

        {/* Mastery */}
        {item.mastery && (
          <div className="mt-3">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faded">
              Mastery
            </div>
            <p className="text-sm leading-relaxed">
              <span className="font-bold italic">{item.mastery}.</span>
              {masteryDescription(item.mastery) && (
                <span> {masteryDescription(item.mastery)}</span>
              )}
            </p>
          </div>
        )}

        {/* Attached spells */}
        {attachedSpells?.length > 0 && (
          <div className="mt-4 border-t border-rule/40 pt-2 text-sm">
            <span className="font-bold">Spells: </span>
            <span className="italic text-ink-faded">
              {attachedSpells.join(", ")}
            </span>
          </div>
        )}

        {/* Loot tables */}
        {lootTables?.length > 0 && (
          <div className="mt-2 text-xs text-ink-faded">
            <span className="font-semibold">Found On: </span>
            {lootTables.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────── sub-components ─────────

function QuickStats({ weight, value, damage, range, light, baseItem, weaponCategory, charged }) {
  const rows = [];
  if (damage) {
    const formatted = formatDamage(damage);
    if (formatted) rows.push(["Damage", formatted]);
  }
  const rangeStr = formatRange(range);
  if (rangeStr) rows.push(["Range", rangeStr]);
  if (weight) rows.push(["Weight", `${weight} lb`]);
  const valueStr = formatValue(value);
  if (valueStr) rows.push(["Value", valueStr]);
  if (baseItem) rows.push(["Base Item", baseItem]);
  if (weaponCategory) rows.push(["Category", weaponCategory]);
  const lightStr = formatLight(light);
  if (lightStr) rows.push(["Light", lightStr]);
  const chargedStr = formatCharged(charged);
  if (chargedStr) rows.push(["Charges", chargedStr]);

  if (rows.length === 0) return null;

  return (
    <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-0.5 border-y border-rule/40 py-2 text-xs text-ink-faded">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-1">
          <span className="font-semibold text-ink">{k}:</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}

function SectionStrip({ title, children }) {
  return (
    <div className="mb-2">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faded">
        {title}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5">{children}</div>
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

function AbilityBlock({ ability }) {
  const { set, increase, choose, count, amount } = ability;
  return (
    <SectionStrip title="Ability">
      {set &&
        Object.entries(set).map(([k, v]) => (
          <Chip key={k} label={k.toUpperCase()}>
            set to {v}
          </Chip>
        ))}
      {increase &&
        Object.entries(increase).map(([k, v]) => (
          <Chip key={k} label={k.toUpperCase()}>
            +{v}
          </Chip>
        ))}
      {choose && (
        <Chip label="Choose">
          {count} of [{choose.map((s) => String(s).toUpperCase()).join(", ")}],
          +{amount} each
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
    <div className="my-2 overflow-hidden border-y border-rule/40">
      {table.caption && (
        <div className="bg-rule/10 px-2 py-1 text-xs font-semibold">
          {table.caption}
        </div>
      )}
      <table className="w-full text-xs">
        <thead className="border-b border-rule/40">
          <tr>
            {table.columns.map((c, i) => (
              <th key={i} className="px-2 py-1 text-left font-semibold text-ink-faded">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-t border-rule/20 even:bg-ink/[0.03]">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}