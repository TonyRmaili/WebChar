import React from "react";
import { formatSource, formatTypeAndSize } from "./raceHelpers";

export default function RaceRow({ race, onOpen, onContextMenu }) {
  if (!race) return null;
  const isHomebrew = race.source === "HOMEBREW";

  const handleContext = (e) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, race);
    }
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(race)}
      onContextMenu={handleContext}
      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg
                 border border-slate-700 bg-slate-800/40 hover:bg-slate-800/80
                 hover:border-amber-500/40 transition-colors"
    >
      <span className="flex-1 min-w-0 truncate text-slate-100 font-medium text-sm">
        {race.name}
      </span>

      <span className="hidden sm:inline text-[11px] text-slate-400 truncate max-w-[180px]">
        {formatTypeAndSize(race)}
      </span>

      {isHomebrew ? (
        <span
          className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border
            ${race.visibility === "public"
              ? "text-green-300 border-green-500/40"
              : "text-blue-300 border-blue-500/40"}`}
        >
          {race.visibility === "public" ? "Public" : "Private"}
        </span>
      ) : (
        race.source && (
          <span
            className="text-[10px] uppercase tracking-wider text-slate-400
                       border border-slate-600/40 rounded px-1.5 py-0.5"
            title={formatSource(race.source)}
          >
            {race.source}
          </span>
        )
      )}
    </button>
  );
}