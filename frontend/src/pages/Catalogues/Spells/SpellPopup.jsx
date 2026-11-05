import React from "react";
import {
  formatSource,
  formatLevelSchool,
  formatTime,
  formatRange,
  formatComponents,
  formatDuration,
  parseSpellEntries,
} from "./spellHelpers";

export default function SpellPopup({ spell }) {
  if (!spell) return null;

  const {
    name, source, level, school,
    time, range, components, duration,
    cleaned_data,
  } = spell;

  const blocks = parseSpellEntries(cleaned_data?.entries);

  const stats = [
    ["Casting Time", formatTime(time)],
    ["Range", formatRange(range)],
    ["Components", formatComponents(components)],
    ["Duration", formatDuration(duration)],
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

        {/* Subheader */}
        <p className="italic text-sm text-stone-700 mb-3">
          {formatLevelSchool(level, school)}
        </p>

        {/* Quick stats */}
        {stats.length > 0 && (
          <div className="grid grid-cols-1 gap-y-0.5 text-xs text-stone-700 mb-3
                          border-y border-stone-300 py-2">
            {stats.map(([k, v]) => (
              <div key={k} className="flex gap-1">
                <span className="font-semibold">{k}:</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="mt-2 space-y-2 text-sm leading-relaxed">
          {blocks.map((b, i) => <Block key={i} block={b} />)}
        </div>
      </div>
    </div>
  );
}

/* ───────── sub-components ───────── */

function Block({ block }) {
  if (block.type === "heading")
    return (
      <h3 className="font-bold text-base mt-3 mb-1 text-stone-900">
        {block.text}
      </h3>
    );
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
          <span className="text-stone-400">•</span>
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
    <div className="my-2 border border-stone-400 rounded overflow-hidden">
      {block.caption && (
        <div className="bg-stone-200 px-2 py-1 text-xs font-semibold">
          {block.caption}
        </div>
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