import React from "react";
import { formatSource, formatFeatureType } from "./optionalFeatureHelpers";

export default function OptionalFeatureRow({ feature, onOpen, onContextMenu }) {
  if (!feature) return null;
  const { name, source, feature_type, visibility } = feature;
  const isHomebrew = source === "HOMEBREW";

  const handleContext = (e) => {
    if (onContextMenu) { e.preventDefault(); onContextMenu(e, feature); }
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(feature)}
      onContextMenu={handleContext}
      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg
                 border border-slate-700 bg-slate-800/40 hover:bg-slate-800/80
                 hover:border-amber-500/40 transition-colors"
    >
      <span className="flex-1 min-w-0 truncate text-slate-100 font-medium text-sm">
        {name || "Unnamed feature"}
      </span>

      {feature_type && (
        <span className="hidden sm:inline text-[11px] text-slate-400 truncate max-w-[140px]">
          {formatFeatureType(feature_type)}
        </span>
      )}

      {isHomebrew ? (
        <span className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border
          ${visibility === "public" ? "text-green-300 border-green-500/40" : "text-blue-300 border-blue-500/40"}`}>
          {visibility === "public" ? "Public" : "Private"}
        </span>
      ) : (
        source && (
          <span className="text-[10px] uppercase tracking-wider text-slate-400 border border-slate-600/40 rounded px-1.5 py-0.5"
                title={formatSource(source)}>
            {source}
          </span>
        )
      )}
    </button>
  );
}