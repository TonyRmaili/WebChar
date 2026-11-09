import React from "react";
import { formatSource, formatLevelSchool, formatTime, formatRange, formatComponents, formatDuration, parseSpellEntries } from "./spellHelpers";

/* A spell's card (popup type "spell"): written on parchment, filling its
   card window. Colours are theme slots. */
export default function SpellPopup({ spell }) {
  if (!spell) return null;

  const { name, source, level, school, time, range, components, duration, cleaned_data } = spell;

  const blocks = parseSpellEntries(cleaned_data?.entries);

  const stats = [
    ["Casting Time", formatTime(time)],
    ["Range", formatRange(range)],
    ["Components", formatComponents(components)],
    ["Duration", formatDuration(duration)],
  ].filter(([, v]) => v);

  return (
    <div className="wc-page h-full overflow-y-auto !rounded-none">
      <div className="px-5 py-4">
        {/* Title */}
        <div className="mb-2 flex items-baseline justify-between border-b border-rule/40 pb-1">
          <h2 className="text-xl font-bold uppercase tracking-wide text-ink">{name}</h2>
          <span className="text-xs text-ink-faded" title={formatSource(source)}>
            {source}
          </span>
        </div>

        {/* Subheader */}
        <p className="mb-3 text-sm italic text-ink-faded">{formatLevelSchool(level, school)}</p>

        {/* Quick stats */}
        {stats.length > 0 && (
          <div className="mb-3 grid grid-cols-1 gap-y-0.5 border-y border-rule/40 py-2 text-xs text-ink-faded">
            {stats.map(([k, v]) => (
              <div key={k} className="flex gap-1">
                <span className="font-semibold text-ink">{k}:</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="mt-2 space-y-2 text-sm leading-relaxed">
          {blocks.map((b, i) => (
            <Block key={i} block={b} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────── sub-components ───────── */

function Block({ block }) {
  if (block.type === "heading") return <h3 className="mb-1 mt-3 text-base font-bold text-ink">{block.text}</h3>;
  if (block.type === "table") return <EntryTable block={block} />;
  if (block.type === "list") return <EntryList items={block.items} />;
  return (
    <p>
      {block.lead && <span className="font-bold italic">{block.lead} </span>}
      {block.text}
    </p>
  );
}

function EntryList({ items }) {
  return (
    <ul className="space-y-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-1">
          <span className="text-ink-faint">•</span>
          <span>
            {it.lead && <span className="font-semibold">{it.lead} </span>}
            {it.text}
          </span>
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
          <tr>
            {block.header.map((c, i) => (
              <th key={i} className="px-2 py-1 text-left font-semibold text-ink-faded">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
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