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
    <div className="wc-page h-full overflow-y-auto !rounded-none">
      <div className="px-5 py-4">
        {/* Title */}
        <div className="mb-2 flex items-baseline justify-between border-b border-rule/40 pb-1">
          <h2 className="text-xl font-bold uppercase tracking-wide text-ink">{name}</h2>
          <span className="text-xs text-ink-faded">{source}</span>
        </div>

        {/* Subheader */}
        <p className="mb-3 text-sm italic text-ink-faded">
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
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faded mb-1">
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
          <div className="mt-4 border-t border-rule/40 pt-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faded mb-2">
              Sub-races ({sub_races.length})
            </div>
            <div>
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
    <div className="mb-3 grid grid-cols-1 gap-y-0.5 border-y border-rule/40 py-2 text-xs text-ink-faded">
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
      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faded mb-1">
        {title}
      </div>
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
      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faded mb-1">
        Proficiencies
      </div>
      <div className="space-y-1">
        {rows.map(([label, chips]) => (
          <div key={label} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
            <span className="text-xs font-semibold text-ink-faded">{label}:</span>
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
      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faded mb-1">
        Spells {abilityLabel && <span className="normal-case tracking-normal">· {abilityLabel}</span>}
      </div>
      <div className="space-y-0.5 text-sm text-ink">
        {spells.map((s, i) => (
          <div key={i} className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-semibold">{s.name}</span>
            <span className="text-xs italic text-ink-faded">
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
    <div className="border-b border-dotted border-rule/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-baseline justify-between px-1 py-1 text-left transition-colors hover:bg-ink/[0.04]"
      >
        <span className="text-sm font-semibold text-ink group-hover:text-rubric">
          {sub.display_name || sub.name}
          {sub.source && <span className="font-normal text-ink-faded"> · {sub.source}</span>}
        </span>
        <span className={`text-[9px] text-ink-faded transition-transform duration-150 ${open ? "rotate-90" : ""}`}>▶</span>
      </button>

      {open && hasBody && (
        <div className="ml-1 border-l border-rule/30 py-2 pl-3">
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