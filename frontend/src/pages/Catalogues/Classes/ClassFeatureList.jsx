import React, { useMemo } from "react";
import { parseDescription } from "./classHelpers";
import { InkHeading } from "../../../styles/parchment";

/* The class's features (plus the chosen subclass's), in level order. Each is
   an entry — "Level 3 · Improved Critical" — and its text, with a dotted line
   between entries. */
export default function ClassFeatureList({ selectedClassData, selectedSubclass }) {
  const features = useMemo(() => {
    if (!selectedClassData) return [];

    const classFeatures = (selectedClassData.class_features ?? []).map((f) => ({
      ...f,
      source: "class",
    }));

    let subclassFeatures = [];
    if (selectedSubclass) {
      const sc = (selectedClassData.subclasses ?? []).find((s) => s.name === selectedSubclass);
      if (sc?.features) {
        subclassFeatures = sc.features.map((f) => ({ ...f, source: "subclass" }));
      }
    }

    return [...classFeatures, ...subclassFeatures].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  }, [selectedClassData, selectedSubclass]);

  if (!features.length) return null;

  return (
    <section>
      <InkHeading right={selectedSubclass && <span className="text-xs italic text-ink-faded">including {selectedSubclass}</span>}>Features</InkHeading>

      <div className="flex flex-col">
        {features.map((feature, i) => (
          <FeatureCard key={`${feature.source}-${feature.name}-${feature.level}-${i}`} feature={feature} />
        ))}
      </div>
    </section>
  );
}

function FeatureCard({ feature }) {
  const blocks = parseDescription(feature.clean_entries?.description);
  return (
    <div className="border-b border-dotted border-rule/30 py-3 first:pt-0 last:border-b-0">
      <div className="mb-1 flex items-baseline gap-3">
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-rubric">Level {feature.level}</span>
        <h6 className="text-base font-semibold text-ink">{feature.name}</h6>
        {feature.source === "subclass" && <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faded">Subclass</span>}
      </div>

      {blocks ? (
        <div className="space-y-1.5">
          {blocks.map((block, i) =>
            block.type === "heading" ? (
              <p key={i} className="mt-2 text-sm font-semibold text-ink">
                {block.text}
              </p>
            ) : (
              <p key={i} className="whitespace-pre-line text-sm leading-relaxed text-ink">
                {block.text}
              </p>
            )
          )}
        </div>
      ) : (
        <p className="text-sm italic text-ink-faded">No description available.</p>
      )}
    </div>
  );
}