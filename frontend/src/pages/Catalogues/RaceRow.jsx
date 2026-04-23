import React from "react";
import { SIZE_LABELS, cap } from "./raceHelpers";

export default function RaceRow({ race, onOpen }) {
  const { name, source, creature_type, sizes = [], sub_races = [] } = race || {};
  const sizeText = sizes.map((s) => SIZE_LABELS[s] || cap(s)).join("/");

  return (
    <button
      type="button"
      onClick={() => onOpen(race)}
      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg
                 border border-slate-700 bg-slate-800/40 hover:bg-slate-800/80
                 hover:border-amber-500/40 transition-colors"
    >
      <span className="flex-1 min-w-0 truncate text-slate-100 font-medium text-sm">
        {name || "Unnamed race"}
      </span>

      {creature_type && (
        <span className="hidden sm:inline text-[11px] text-slate-400 truncate max-w-[140px]">
          {cap(creature_type)}
        </span>
      )}

      {sizeText && (
        <span className="text-[10px] uppercase tracking-wider text-slate-300
                         border border-slate-600/60 rounded px-1.5 py-0.5">
          {sizeText}
        </span>
      )}

      {sub_races.length > 0 && (
        <span
          className="text-[10px] uppercase tracking-wider text-amber-300
                     border border-amber-500/40 rounded px-1.5 py-0.5"
          title={`${sub_races.length} sub-race${sub_races.length === 1 ? "" : "s"}`}
        >
          {sub_races.length} sub
        </span>
      )}

      {source && (
        <span className="text-[10px] uppercase tracking-wider text-slate-400
                         border border-slate-600/40 rounded px-1.5 py-0.5">
          {source}
        </span>
      )}
    </button>
  );
}