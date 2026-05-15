import React, { useMemo } from "react";
import { parseDescription } from "./classHelpers";

export default function ClassFeatureList({ selectedClassData, selectedSubclass }) {
  const features = useMemo(() => {
    if (!selectedClassData) return [];

    const classFeatures = (selectedClassData.class_features ?? []).map((f) => ({
      ...f,
      source: "class",
    }));

    let subclassFeatures = [];
    if (selectedSubclass) {
      const sc = (selectedClassData.subclasses ?? []).find(
        (s) => s.name === selectedSubclass
      );
      if (sc?.features) {
        subclassFeatures = sc.features.map((f) => ({ ...f, source: "subclass" }));
      }
    }

    return [...classFeatures, ...subclassFeatures].sort(
      (a, b) => (a.level ?? 0) - (b.level ?? 0)
    );
  }, [selectedClassData, selectedSubclass]);

  if (!features.length) return null;

  return (
    <div className="mt-6">
      <h5 className="text-lg text-lime-400 mb-2">
        Features
        {selectedSubclass && (
          <span className="text-cyan-400 text-base font-normal">
            {" "}— including {selectedSubclass}
          </span>
        )}
      </h5>

      <div className="flex flex-col gap-3">
        {features.map((feature, i) => (
          <FeatureCard
            key={`${feature.source}-${feature.name}-${feature.level}-${i}`}
            feature={feature}
          />
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ feature }) {
  const blocks = parseDescription(feature.clean_entries?.description);
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-md p-3">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xs font-semibold text-amber-400 whitespace-nowrap">
          Level {feature.level}
        </span>
        <h6 className="text-base font-semibold text-lime-400">{feature.name}</h6>
        {feature.source === "subclass" && (
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-cyan-900 text-cyan-300 border border-cyan-700">
            Subclass
          </span>
        )}
      </div>

      {blocks ? (
        <div className="space-y-1.5">
          {blocks.map((block, i) =>
            block.type === "heading" ? (
              <p key={i} className="text-sm font-semibold text-amber-300 mt-2">
                {block.text}
              </p>
            ) : (
              <p
                key={i}
                className="text-sm text-slate-300 leading-relaxed whitespace-pre-line"
              >
                {block.text}
              </p>
            )
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500 italic">No description available.</p>
      )}
    </div>
  );
}