import React from "react";
import { formatSource, formatLevelChip } from "./spellHelpers";

const SCHOOL_NAMES = {
  A: "Abjuration", C: "Conjuration", D: "Divination",
  E: "Enchantment", V: "Evocation", I: "Illusion",
  N: "Necromancy", T: "Transmutation",
};

export default function SpellRow({ spell, onOpen }) {
  const { name, source, level, school } = spell || {};
  const schoolName =
    SCHOOL_NAMES[school] ||
    (school ? school[0].toUpperCase() + school.slice(1) : "");

  return (
    <button
      type="button"
      onClick={() => onOpen(spell)}
      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg
                 border border-slate-700 bg-slate-800/40 hover:bg-slate-800/80
                 hover:border-amber-500/40 transition-colors"
    >
      <span
        className="text-[10px] uppercase tracking-wider text-amber-300
                   border border-amber-500/40 rounded px-1.5 py-0.5 shrink-0 w-14 text-center"
        title={level === 0 ? "Cantrip" : `Level ${level}`}
      >
        {formatLevelChip(level)}
      </span>

      <span className="flex-1 min-w-0 truncate text-slate-100 font-medium text-sm">
        {name || "Unnamed spell"}
      </span>

      {schoolName && (
        <span className="hidden sm:inline text-[11px] text-slate-400 truncate max-w-[120px]">
          {schoolName}
        </span>
      )}

      {source && (
        <span
          className="text-[10px] uppercase tracking-wider text-slate-400
                     border border-slate-600/40 rounded px-1.5 py-0.5"
          title={formatSource(source)}
        >
          {source}
        </span>
      )}
    </button>
  );
}