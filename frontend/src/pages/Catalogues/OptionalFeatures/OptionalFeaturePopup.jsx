import React, { useMemo } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { CardHeader, MechanicsSection, RichText } from "../catalogueParts";
import { buildNameIndex, describeConsumes, describePrerequisites } from "../catalogueHelpers";
import { typesLabel } from "./optionalFeatureHelpers";

/* An optional feature's card: its type (and whose list), prerequisites,
   what it costs, the book text, then "What it gives". */
export default function OptionalFeaturePopup({ feature }) {
  const optionalFeatures = useCatalogueStore((s) => s.optionalFeatures);
  const spells = useCatalogueStore((s) => s.spells);
  const index = useMemo(() => buildNameIndex(optionalFeatures, spells), [optionalFeatures, spells]);

  if (!feature) return null;
  const prereqs = describePrerequisites(feature.prerequisites, index);
  const cost = describeConsumes(feature.consumes);
  const subtitle = [typesLabel(feature), feature.repeatable ? "Repeatable" : null].filter(Boolean).join(" · ");

  return (
    <div className="wc-page h-full overflow-y-auto !rounded-none">
      <div className="px-5 py-4">
        <CardHeader entry={feature} subtitle={subtitle} />

        {(prereqs.length > 0 || cost) && (
          <div className="mb-3 space-y-0.5 text-sm">
            {prereqs.length > 0 && (
              <p>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faded">Prerequisite: </span>
                {prereqs.join("; or ")}
              </p>
            )}
            {cost && (
              <p>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faded">Cost: </span>
                {cost}
              </p>
            )}
          </div>
        )}

        {feature.text ? <RichText text={feature.text} /> : <p className="text-sm italic text-ink-faded">No description.</p>}
        <MechanicsSection entry={feature} index={index} storageKey="catalogue.optionalFeature.mechanics" />
      </div>
    </div>
  );
}
