import React from "react";
import { CardHeader, RichText } from "../catalogueParts";
import { factsOf, subtitleOf } from "./referenceHelpers";

/* The card of a Rules, Lore or Toolkit entry (popup type "reference"):
   its type, its own lines (a deity's pantheon, domains, symbol…; a trap's
   tier and threat), and its text. */
export default function ReferencePopup({ entry }) {
  if (!entry) return null;
  const facts = factsOf(entry);
  return (
    <div className="wc-page h-full overflow-y-auto !rounded-none">
      <div className="px-5 py-4">
        <CardHeader entry={entry} subtitle={subtitleOf(entry)} />
        {entry.aliases?.length > 0 && <p className="-mt-2 mb-2 text-xs italic text-ink-faded">Also: {entry.aliases.join(" · ")}</p>}

        {facts.length > 0 && (
          <div className="mb-3 space-y-0.5 border-b border-rule/40 pb-2">
            {facts.map((r) => (
              <div key={r.label} className="text-sm leading-snug">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faded">{r.label}: </span>
                <span className="text-ink">{r.value}</span>
              </div>
            ))}
          </div>
        )}

        {entry.text ? <RichText text={entry.text} /> : facts.length === 0 && <p className="text-sm italic text-ink-faded">No description.</p>}
      </div>
    </div>
  );
}
