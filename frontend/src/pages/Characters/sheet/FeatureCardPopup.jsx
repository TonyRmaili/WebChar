import React from "react";
import { CardHeader, RichText } from "../../Catalogues/catalogueParts";
import { actionWords, regainWords } from "../../../utils/featureRuntime";

/* The card of one of a character's features (a racial trait, a class
   feature): the character's own copy, opened from the sheet (FeatureList).
   data: { key, name, owner, level, category, text, uses, action words,
   edited, own } — see FeatureList's `cardOf`. */

const USED_AS = { actions: "Action", bonus_actions: "Bonus Action", reactions: "Reaction", traits: "Passive" };

export default function FeatureCardPopup({ feature: f }) {
  if (!f) return null;
  const rows = [
    ["Used as", USED_AS[f.category] || null],
    ["Uses", f.uses ? `${f.uses.max} ${regainWords(f.usesRaw) || ""}`.trim() : null],
    ["Spends", f.spends || null],
    ["Does", f.action ? actionWords(f.action) : null],
    ["Switch", f.toggle ? (f.on ? "on" : "off") : null],
  ].filter(([, v]) => v);
  const subtitle = [f.owner, f.level ? `level ${f.level}` : null, f.own ? "your own" : f.edited ? "edited" : null].filter(Boolean).join(" · ");

  return (
    <div className="wc-page h-full overflow-y-auto !rounded-none">
      <div className="px-5 py-4">
        <CardHeader entry={{ name: f.name || "Unnamed" }} subtitle={subtitle} />
        {rows.length > 0 && (
          <div className="mb-3 space-y-0.5 border-b border-rule/40 pb-2">
            {rows.map(([label, value]) => (
              <div key={label} className="text-sm leading-snug">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faded">{label}: </span>
                <span className="text-ink">{value}</span>
              </div>
            ))}
          </div>
        )}
        {f.text ? <RichText text={f.text} /> : <p className="text-sm italic text-ink-faded">No description.</p>}
      </div>
    </div>
  );
}
