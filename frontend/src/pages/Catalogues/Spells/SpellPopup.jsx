import React from "react";
import { CardHeader, MechanicsSection, RichText } from "../catalogueParts";
import { formatComponents, formatDuration, formatRange, formatTime, spellClasses, spellSubtitle } from "./spellHelpers";

/* A spell's card: level and school; casting time, range, components,
   duration and the classes that have it; the book text; and, once the
   LLM step has filled them, its numbers under "What it does". */
export default function SpellPopup({ spell }) {
  if (!spell) return null;
  const rows = [
    ["Casting Time", formatTime(spell)],
    ["Range", formatRange(spell.range)],
    ["Components", formatComponents(spell.components)],
    ["Duration", formatDuration(spell)],
    ["Classes", spellClasses(spell).join(", ")],
  ].filter(([, v]) => v);

  return (
    <div className="wc-page h-full overflow-y-auto !rounded-none">
      <div className="px-5 py-4">
        <CardHeader entry={spell} subtitle={spellSubtitle(spell)} />
        {spell._sheet && <p className="-mt-2 mb-2 text-xs italic text-ink-faded">{spell.edited ? "Your copy, changed by you" : spell._own ? "Your own spell" : "Your copy"}</p>}

        {rows.length > 0 && (
          <div className="mb-3 space-y-0.5 border-b border-rule/40 pb-2">
            {rows.map(([label, value]) => (
              <div key={label} className="text-sm leading-snug">
                <span className="font-bold text-ink">{label}: </span>
                <span className="text-ink">{value}</span>
              </div>
            ))}
          </div>
        )}

        {spell.text ? <RichText text={spell.text} /> : <p className="text-sm italic text-ink-faded">No description.</p>}

        <MechanicsSection entry={spell} title="What it does" storageKey="catalogue.spell.mechanics" />
      </div>
    </div>
  );
}
