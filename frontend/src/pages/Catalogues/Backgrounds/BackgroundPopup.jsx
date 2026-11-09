import React from "react";
import {
  formatSource, formatFeatTag, formatAbilityScoreIncrease, parseBackgroundEntries,
} from "./backgroundHelpers";
import { SKILL_OPTIONS } from "../../../utils/Constants";

const titleCase = (s) =>
  String(s || "").split(/[_\s]+/).filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const skillLabel = (k) => SKILL_OPTIONS[k]?.label || titleCase(k);

const SPELL_LEVEL_LABEL = {
  s0: "Cantrips", s1: "1st", s2: "2nd", s3: "3rd", s4: "4th",
  s5: "5th", s6: "6th", s7: "7th", s8: "8th", s9: "9th",
};

export default function BackgroundPopup({ background }) {
  if (!background) return null;
  const { name, source, edition, entries, cleaned_entries } = background;

  // New data flattens cleaned_entries → entries (string); fall back during transition.
  const entryText = typeof entries === "string" ? entries : cleaned_entries?.entries;
  const blocks = parseBackgroundEntries(entryText);

  return (
    <div className="wc-page h-full overflow-y-auto !rounded-none">
      <div className="px-5 py-4">
        <div className="mb-2 flex items-baseline justify-between border-b border-rule/40 pb-1">
          <h2 className="text-xl font-bold uppercase tracking-wide text-ink">{name}</h2>
          <span className="text-xs text-ink-faded" title={formatSource(source)}>
            {source}{edition ? ` · ${edition}` : ""}
          </span>
        </div>

        <Mechanics bg={background} />

        <div className="mt-2 space-y-2 text-sm leading-relaxed">
          {blocks.map((b, i) => <Block key={i} block={b} />)}
        </div>
      </div>
    </div>
  );
}

/* ───────── mechanics summary ───────── */

function formatProf(obj, labelFn = titleCase) {
  if (!obj || typeof obj !== "object") return [];
  const out = [];
  for (const f of obj.fixed || []) out.push(labelFn(f));
  if (obj.choose && Array.isArray(obj.choose.from) && obj.choose.from.length) {
    const n = obj.choose.count || 1;
    out.push(`Choose ${n}: ${obj.choose.from.map(labelFn).join(", ")}`);
  }
  return out;
}

function formatEquipment(se) {
  if (!Array.isArray(se) || !se.length) return [];
  const group = se[0]?.["_"];
  if (!Array.isArray(group)) return [];
  const out = [];
  for (const el of group) {
    if (typeof el === "string") out.push(titleCase(el));
    else if (el?.item === "pouch" && el.containsValue != null) out.push(`${el.containsValue / 100} gp`);
    else if (el?.item) out.push(titleCase(el.displayName || el.item));
    else if (el?.special) out.push(`${titleCase(el.special)}${el.quantity ? ` ×${el.quantity}` : ""}`);
  }
  return out;
}

function formatSpells(as) {
  if (!Array.isArray(as) || !as.length) return [];
  const expanded = as[0]?.expanded;
  if (!expanded || typeof expanded !== "object") return [];
  return Object.entries(expanded)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lvl, names]) => ({
      label: SPELL_LEVEL_LABEL[lvl] || lvl,
      names: (names || []).map((n) => titleCase(String(n).split("#")[0])),
    }))
    .filter((r) => r.names.length);
}

function Mechanics({ bg }) {
  const feats = (bg.feats || []).map(formatFeatTag);
  const asi = formatAbilityScoreIncrease(bg.ability_score_increase);
  const skills = formatProf(bg.skill_proficiencies, skillLabel);
  const tools = formatProf(bg.tool_proficiencies);
  const langs = formatProf(bg.language_proficiencies);
  const equip = formatEquipment(bg.starting_equipment);
  const spells = formatSpells(bg.additional_spells);

  const rows = [
    ["Ability Scores", asi], ["Feat", feats], ["Skills", skills],
    ["Tools", tools], ["Languages", langs], ["Equipment", equip],
  ];
  const hasAny = rows.some(([, v]) => v.length) || spells.length;
  if (!hasAny) return null;

  return (
    <div className="mb-3 space-y-1.5 border-b border-rule/40 pb-2">
      {rows.map(([title, items]) =>
        items.length ? (
          <div key={title}>
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faded">{title}: </span>
            <span className="text-sm text-ink">{items.join(" · ")}</span>
          </div>
        ) : null
      )}
      {spells.length > 0 && (
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faded">Expanded Spells</span>
          {spells.map((r) => (
            <div key={r.label} className="text-sm text-ink">
              <span className="text-ink-faded">{r.label}: </span>{r.names.join(", ")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── existing entry blocks ───────── */

function Block({ block }) {
  if (block.type === "heading")
    return <h3 className="mb-1 mt-3 text-base font-bold text-ink">{block.text}</h3>;
  if (block.type === "table") return <EntryTable block={block} />;
  if (block.type === "list") return <EntryList items={block.items} />;
  return <p>{block.text}</p>;
}

function EntryList({ items }) {
  return (
    <ul className="space-y-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-1">
          <span className="text-ink-faint">•</span>
          <span>{it.label && <span className="font-semibold">{it.label} </span>}{it.text}</span>
        </li>
      ))}
    </ul>
  );
}

function EntryTable({ block }) {
  return (
    <div className="my-2 overflow-hidden border-y border-rule/40">
      {block.caption && <div className="bg-rule/10 px-2 py-1 text-xs font-semibold">{block.caption}</div>}
      <table className="w-full text-xs">
        <thead className="border-b border-rule/40">
          <tr>{block.header.map((c, i) => <th key={i} className="px-2 py-1 text-left font-semibold text-ink-faded">{c}</th>)}</tr>
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