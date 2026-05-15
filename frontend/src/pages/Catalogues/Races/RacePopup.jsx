import React, { useState } from "react";
import {
  ABILITY_LABELS,
  formatSpeed,
  formatSenses,
  formatTypeAndSize,
  formatChoose,
  cap,
} from "./raceHelpers";

export default function RacePopup({ race }) {
  if (!race) return null;

  const {
    name, source,
    speed, senses, abilities, defenses, proficiencies,
    spells = [], spell_ability, traits = [], sub_races = [],
  } = race;

  return (
    <div className="bg-[#fdf6e3] text-stone-900 font-serif rounded-sm shadow-lg
                    border border-stone-400 overflow-y-auto h-full">
      <div className="px-5 py-4">
        {/* Title */}
        <div className="flex justify-between items-baseline border-b border-stone-300 pb-1 mb-2">
          <h2 className="text-xl font-bold tracking-wide uppercase text-stone-900">
            {name}
          </h2>
          <span className="text-xs text-stone-500">{source}</span>
        </div>

        {/* Subheader */}
        <p className="italic text-sm text-stone-700 mb-3">
          {formatTypeAndSize(race)}
        </p>

        {/* Quick stats */}
        <QuickStats speed={speed} senses={senses} />

        {/* Ability bonuses */}
        {abilities && <AbilityBlock abilities={abilities} />}

        {/* Defenses */}
        {defenses && <DefenseBlock defenses={defenses} />}

        {/* Proficiencies */}
        {proficiencies && <ProfBlock proficiencies={proficiencies} />}

        {/* Spells */}
        {spells.length > 0 && (
          <SpellBlock spells={spells} spellAbility={spell_ability} />
        )}

        {/* Traits */}
        {traits.length > 0 && (
          <div className="mt-3 space-y-2 text-sm leading-relaxed">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
              Traits
            </div>
            {traits.map((t, i) => (
              <p key={i}>
                <span className="font-bold italic">{t.name}. </span>
                <span>{t.notes}</span>
              </p>
            ))}
          </div>
        )}

        {/* Sub-races */}
        {sub_races.length > 0 && (
          <div className="mt-4 pt-3 border-t border-stone-300">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-2">
              Sub-races ({sub_races.length})
            </div>
            <div className="space-y-2">
              {sub_races.map((sr, i) => <SubRaceBlock key={i} sub={sr} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── sub-components ───────── */

function QuickStats({ speed, senses }) {
  const rows = [];
  const sp = formatSpeed(speed);
  const sn = formatSenses(senses);
  if (sp) rows.push(["Speed", sp]);
  if (sn) rows.push(["Senses", sn]);
  if (!rows.length) return null;

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-stone-700 mb-3">
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

function AbilityBlock({ abilities }) {
  const { fixed = {}, choose } = abilities || {};
  const fixedEntries = Object.entries(fixed).filter(([, v]) => v != null);
  if (!fixedEntries.length && !choose) return null;

  return (
    <SectionStrip title="Ability Bonuses">
      {fixedEntries.map(([k, v]) => (
        <Chip key={k} label={ABILITY_LABELS[k] || k.toUpperCase()}>
          {v >= 0 ? `+${v}` : v}
        </Chip>
      ))}
      {choose && (
        <Chip label="Choose">
          {formatChoose(choose, { abilityMode: true }).replace(/^Choose /, "")}
        </Chip>
      )}
    </SectionStrip>
  );
}

function DefenseBlock({ defenses }) {
  const {
    resistances = [], immunities = [],
    vulnerabilities = [], condition_advantages = [],
  } = defenses || {};
  const total = resistances.length + immunities.length +
                vulnerabilities.length + condition_advantages.length;
  if (!total) return null;

  return (
    <SectionStrip title="Defenses">
      {resistances.map((r) => <Chip key={`r-${r}`} label="Resist">{r}</Chip>)}
      {immunities.map((r) => <Chip key={`i-${r}`} label="Immune">{r}</Chip>)}
      {vulnerabilities.map((r) => <Chip key={`v-${r}`} label="Vulnerable">{r}</Chip>)}
      {condition_advantages.map((r) =>
        <Chip key={`c-${r}`} label="Adv. vs">{r}</Chip>
      )}
    </SectionStrip>
  );
}

function ProfBlock({ proficiencies }) {
  const { languages, skills, tools, weapons, armor } = proficiencies || {};

  const groupChips = (group) => {
    if (!group) return [];
    const chips = [...(group.fixed || [])];
    if (group.choose) chips.push(formatChoose(group.choose));
    return chips;
  };

  const wpArmorChips = (g) => {
    if (!g) return [];
    return [...(g.fixed || []), ...(g.categories || []).map((c) => `${c} (category)`)];
  };

  const rows = [
    ["Languages", groupChips(languages)],
    ["Skills", groupChips(skills)],
    ["Tools", groupChips(tools)],
    ["Weapons", wpArmorChips(weapons)],
    ["Armor", wpArmorChips(armor)],
  ].filter(([, arr]) => arr.length > 0);

  if (!rows.length) return null;

  return (
    <div className="mb-2">
      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
        Proficiencies
      </div>
      <div className="space-y-1">
        {rows.map(([label, chips]) => (
          <div key={label} className="flex flex-wrap gap-1 items-center">
            <span className="text-[11px] font-semibold text-stone-700 mr-1">{label}:</span>
            {chips.map((c, i) => <Chip key={i}>{c}</Chip>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function SpellBlock({ spells, spellAbility }) {
  const abilityLabel = !spellAbility
    ? null
    : typeof spellAbility === "string"
      ? (ABILITY_LABELS[spellAbility] || spellAbility.toUpperCase())
      : formatChoose(spellAbility, { abilityMode: true });

  return (
    <div className="mb-2">
      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
        Spells {abilityLabel && <span className="text-stone-500 normal-case">· {abilityLabel}</span>}
      </div>
      <div className="space-y-0.5 text-xs text-stone-800">
        {spells.map((s, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <span className="font-semibold">{s.name}</span>
            <span className="text-stone-500">
              lvl {s.level_available} · {formatUses(s.uses)} · {s.category}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatUses(uses) {
  if (!uses) return "";
  const label = {
    at_will: "at will",
    per_short_rest: "per short rest",
    per_long_rest: "per long rest",
    class_list_addition: "class list",
  }[uses.type] || uses.type;
  const count = uses.count != null ? `${uses.count} ` : "";
  return `${count}${label}`;
}

function SubRaceBlock({ sub }) {
  const [open, setOpen] = useState(false);
  const hasBody =
    sub?.speed || sub?.senses || sub?.abilities || sub?.defenses ||
    sub?.proficiencies || (sub?.spells?.length) || (sub?.traits?.length);

  return (
    <div className="border border-stone-300 rounded bg-stone-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-2 py-1 hover:bg-stone-100"
      >
        <span className="text-sm font-semibold">
          {sub.display_name || sub.name}
          {sub.source && <span className="text-stone-500 font-normal"> · {sub.source}</span>}
        </span>
        <span className="text-stone-500 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && hasBody && (
        <div className="px-3 py-2 border-t border-stone-300">
          <QuickStats speed={sub.speed} senses={sub.senses} />
          {sub.abilities && <AbilityBlock abilities={sub.abilities} />}
          {sub.defenses && <DefenseBlock defenses={sub.defenses} />}
          {sub.proficiencies && <ProfBlock proficiencies={sub.proficiencies} />}
          {sub.spells?.length > 0 && (
            <SpellBlock spells={sub.spells} spellAbility={sub.spell_ability} />
          )}
          {sub.traits?.length > 0 && (
            <div className="mt-2 space-y-1 text-sm leading-relaxed">
              {sub.traits.map((t, i) => (
                <p key={i}>
                  <span className="font-bold italic">{t.name}. </span>
                  <span>{t.notes}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}