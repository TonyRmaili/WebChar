import React, { useMemo } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { CardHeader, MechanicsRows, MechanicsSection, RichText, hasMechanics } from "../catalogueParts";
import { buildNameIndex, formatSize, labelFromId } from "../catalogueHelpers";
import { raceSubtitle } from "./raceHelpers";

/* A race's card: size and creature type, the book text, "What it gives",
   then its subraces (lineages, legacies, ancestries), each with its own
   text, what it gives, and what of the race it replaces. */
export default function RacePopup({ race }) {
  const feats = useCatalogueStore((s) => s.feats);
  const spells = useCatalogueStore((s) => s.spells);
  const index = useMemo(() => buildNameIndex(feats, spells), [feats, spells]);

  if (!race) return null;

  return (
    <div className="wc-page h-full overflow-y-auto !rounded-none">
      <div className="px-5 py-4">
        <CardHeader entry={race} subtitle={raceSubtitle(race)} />
        {race.text ? <RichText text={race.text} /> : <p className="text-sm italic text-ink-faded">No description.</p>}
        <MechanicsSection entry={race} index={index} storageKey="catalogue.race.mechanics" />

        {race.subraces?.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-faded">
              Choose one · {race.subraces.length}
            </h3>
            <div className="space-y-4">
              {race.subraces.map((sr) => (
                <div key={sr.id || sr.name} className="border-l border-rule/30 pl-3">
                  <h4 className="text-base font-semibold text-ink">
                    {sr.name}
                    {sr.size?.length > 0 && <span className="ml-2 text-xs font-normal italic text-ink-faded">{formatSize(sr.size)}</span>}
                  </h4>
                  {(sr.replaces?.length > 0 || sr.replaces_text?.length > 0) && (
                    <p className="text-xs italic text-ink-faded">
                      Replaces the race's {[...(sr.replaces || []).map(labelFromId), ...(sr.replaces_text || [])].join(", ")}
                    </p>
                  )}
                  <RichText text={sr.text} className="mt-1" />
                  {hasMechanics(sr) && (
                    <div className="mt-2">
                      <MechanicsRows entry={sr} index={index} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
