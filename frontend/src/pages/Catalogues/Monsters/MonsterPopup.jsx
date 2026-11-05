import React from "react";
import {
  formatSource,
  formatTypeLine,
  formatAC,
  formatHP,
  formatSpeed,
  formatInitiative,
  formatSenses,
  formatSkills,
  formatTypedBlock,
  formatLanguages,
  formatChallenge,
  formatCharges,
  formatSpellMeta,
  formatSpellEntry,
  getEffectCategories,
  monsterUsesLevel,
  ABILITY,
  ABILITY_ORDER,
  EFFECT_SECTIONS,
  titleCase,
} from "./monsterHelpers";

export default function MonsterPopup({ monster }) {
  if (!monster) return null;

  const {
    name, source,
    ac, hp, speed, initiative,
    ability_scores, skill,
    immunities, resistances, vulnerabilities, condition_immunities,
    senses, passive_perception, languages,
    cr, environment, treasure, gear,
    traitTags, actionTags,
    legendary_action_points,
    spellcasting,
  } = monster;

  const cats = getEffectCategories(monster);
  const challengeLabel = monsterUsesLevel(monster) ? "Level" : "Challenge";

  const meta = [
    ["Skills", formatSkills(skill)],
    ["Damage Immunities", formatTypedBlock(immunities)],
    ["Damage Resistances", formatTypedBlock(resistances)],
    ["Damage Vulnerabilities", formatTypedBlock(vulnerabilities)],
    ["Condition Immunities", formatTypedBlock(condition_immunities)],
    ["Senses", formatSenses(senses, passive_perception)],
    ["Languages", formatLanguages(languages)],
    [challengeLabel, formatChallenge(cr)],
    ["Environment", (environment || []).map(titleCase).join(", ")],
    ["Treasure", (treasure || []).map(titleCase).join(", ")],
    [
      "Gear",
      (gear || [])
        .map((g) => `${g.quantity > 1 ? `${g.quantity}× ` : ""}${titleCase(g.name)}`)
        .join(", "),
    ],
  ].filter(([, v]) => v);

  const vitals = [
    ["AC", formatAC(ac)],
    ["HP", formatHP(hp)],
    ["Speed", formatSpeed(speed)],
    ["Initiative", formatInitiative(initiative)],
  ].filter(([, v]) => v);

  return (
    <div className="bg-[#fdf6e3] text-stone-900 font-serif rounded-sm shadow-lg
                    border border-stone-400 overflow-y-auto h-full">
      <div className="px-5 py-4">
        {/* Title */}
        <div className="flex justify-between items-baseline border-b border-stone-300 pb-1 mb-2">
          <h2 className="text-xl font-bold tracking-wide uppercase text-stone-900">
            {name}
          </h2>
          <span className="text-xs text-stone-500" title={formatSource(source)}>
            {source}
          </span>
        </div>

        <p className="italic text-sm text-stone-700 mb-3">
          {formatTypeLine(monster)}
        </p>

        {vitals.length > 0 && (
          <div className="grid grid-cols-1 gap-y-0.5 text-xs text-stone-700 mb-3
                          border-y border-stone-300 py-2">
            {vitals.map(([k, v]) => (
              <div key={k} className="flex gap-1">
                <span className="font-semibold">{k}:</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        )}

        {ability_scores && <AbilityTable scores={ability_scores} />}

        {meta.length > 0 && (
          <div className="mt-3 text-xs text-stone-800 space-y-0.5
                          border-b border-stone-300 pb-2">
            {meta.map(([k, v]) => (
              <div key={k}>
                <span className="font-semibold">{k}: </span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        )}

        {(traitTags?.length || actionTags?.length) ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {(traitTags || []).map((t) => <Chip key={`t-${t}`}>{t}</Chip>)}
            {(actionTags || []).map((t) => <Chip key={`a-${t}`}>{t}</Chip>)}
          </div>
        ) : null}

        {EFFECT_SECTIONS.map(({ key, title }) => {
          const cat = cats?.[key];
          const items = cat?.items || [];
          if (!items.length && !cat?.header) return null;

          let displayTitle = title;
          if (key === "legendary_actions" && legendary_action_points?.legendary_actions != null) {
            displayTitle = `Legendary Actions (${legendary_action_points.legendary_actions})`;
          }
          if (key === "lair_actions" && legendary_action_points?.lair_actions != null) {
            displayTitle = `Lair Actions (${legendary_action_points.lair_actions})`;
          }

          return (
            <EffectSection
              key={key}
              title={displayTitle}
              header={cat?.header}
              items={items}
            />
          );
        })}

        {Array.isArray(spellcasting) && spellcasting.length > 0 && (
          <div className="mt-4 pt-3 border-t border-stone-300 space-y-3">
            {spellcasting.map((b, i) => <SpellcastingBlock key={i} block={b} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── sub-components (unchanged) ───────── */

function AbilityTable({ scores }) {
  return (
    <div className="my-3 border-y border-stone-300 py-2">
      <table className="w-full text-xs text-center">
        <thead>
          <tr className="text-stone-600">
            {ABILITY_ORDER.map((a) => (
              <th key={a} className="font-bold uppercase tracking-wider py-0.5">
                {ABILITY[a]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {ABILITY_ORDER.map((a) => {
              const s = scores[a] || {};
              const sign = s.mod >= 0 ? "+" : "";
              const showSave = s.proficient || s.expertise || s.save !== s.mod;
              return (
                <td key={a} className="py-0.5">
                  <div>{s.score} <span className="text-stone-500">({sign}{s.mod})</span></div>
                  {showSave && (
                    <div className="text-[10px] text-stone-500">
                      save {s.save >= 0 ? "+" : ""}{s.save}
                    </div>
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function EffectSection({ title, header, items }) {
  return (
    <div className="mt-3">
      <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800
                     border-b border-stone-400 pb-0.5 mb-1.5">
        {title}
      </h3>
      {header && (
        <p className="text-xs italic text-stone-600 mb-1.5 whitespace-pre-line">
          {header}
        </p>
      )}
      <div className="space-y-1.5 text-sm">
        {items.map((it, i) => <EffectItem key={i} item={it} />)}
      </div>
    </div>
  );
}

function EffectItem({ item }) {
  const chargeLabel = formatCharges(item.charges);
  return (
    <p>
      <span className="font-bold italic">{item.name}.</span>
      {chargeLabel && (
        <span className="text-xs text-stone-600 ml-1">{chargeLabel}</span>
      )}{" "}
      <span>{item.notes}</span>
    </p>
  );
}

function SpellcastingBlock({ block }) {
  const meta = formatSpellMeta(block);
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800
                     border-b border-stone-400 pb-0.5 mb-1.5">
        {block.name}
        {meta && (
          <span className="text-xs font-normal normal-case text-stone-500 ml-2">
            · {meta}
          </span>
        )}
      </h3>
      {block.notes && (
        <p className="text-sm text-stone-800 mb-1.5">{block.notes}</p>
      )}
      {(block.groups || []).length > 0 && (
        <div className="space-y-0.5 text-sm text-stone-800">
          {block.groups.map((g, i) => (
            <div key={i}>
              <span className="font-semibold">{g.label}: </span>
              <span>
                {(g.spells || []).map(formatSpellEntry).join(", ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ children }) {
  return (
    <span className="text-[10px] uppercase tracking-wider
                     bg-stone-200 border border-stone-400 rounded px-1.5 py-0.5">
      {children}
    </span>
  );
}