import React, { useMemo } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { CardHeader, MechanicsRows, MechanicsSection, RichText, hasMechanics } from "../catalogueParts";
import { buildNameIndex, describePrerequisites } from "../catalogueHelpers";
import { featSubtitle } from "./featsHelpers";

/* A feat's card: category and prerequisites, the book text, its options
   (Magic Initiate: Cleric / Druid / Wizard) each with its own text and
   picks, then "What it gives". */
export default function FeatPopup({ feat }) {
  const feats = useCatalogueStore((s) => s.feats);
  const backgrounds = useCatalogueStore((s) => s.backgrounds);
  const spells = useCatalogueStore((s) => s.spells);
  const index = useMemo(() => buildNameIndex(feats, backgrounds, spells), [feats, backgrounds, spells]);

  if (!feat) return null;
  const prereqs = describePrerequisites(feat.prerequisites, index);

  return (
    <div className="wc-page h-full overflow-y-auto !rounded-none">
      <div className="px-5 py-4">
        <CardHeader entry={feat} subtitle={featSubtitle(feat)} />

        {prereqs.length > 0 && (
          <p className="mb-3 text-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faded">Prerequisite: </span>
            {prereqs.join("; or ")}
          </p>
        )}

        {feat.text ? <RichText text={feat.text} /> : <p className="text-sm italic text-ink-faded">No description.</p>}

        {feat.options?.length > 0 && (
          <div className="mt-4 space-y-4">
            {feat.options.map((o) => (
              <div key={o.id || o.name} className="border-l border-rule/30 pl-3">
                <h3 className="mb-1 text-base font-semibold text-ink">{o.name}</h3>
                <RichText text={o.text} />
                {hasMechanics(o) && (
                  <div className="mt-2">
                    <MechanicsRows entry={o} index={index} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <MechanicsSection entry={feat} index={index} storageKey="catalogue.feat.mechanics" />
      </div>
    </div>
  );
}
