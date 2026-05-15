import React from "react";
import { rarityClass } from "./itemHelpers";

export default function ItemRow({ item, onOpen }) {
  const { name, type, rarity, reqAttune } = item || {};

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg
                 border border-slate-700 bg-slate-800/40 hover:bg-slate-800/80
                 hover:border-amber-500/40 transition-colors"
    >
      <span className="flex-1 min-w-0 truncate text-slate-100 font-medium text-sm">
        {name || "Unnamed item"}
      </span>

      {type && (
        <span className="hidden sm:inline text-[11px] text-slate-400 truncate max-w-[140px]">
          {type}
        </span>
      )}

      {reqAttune && (
        <span
          className="text-[10px] uppercase tracking-wider text-amber-300
                     border border-amber-500/40 rounded px-1.5 py-0.5"
          title={reqAttune === true ? "Requires attunement" : `Requires attunement ${reqAttune}`}
        >
          A
        </span>
      )}

      {rarity && (
        <span
          className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border ${rarityClass(rarity)}`}
        >
          {rarity}
        </span>
      )}
    </button>
  );
}