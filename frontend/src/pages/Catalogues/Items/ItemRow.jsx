import React from "react";
import { rarityClass } from "./itemHelpers";

export default function ItemRow({ item, onOpen, onContextMenu }) {
  if (!item) return null;
  const { name, types, rarity, reqAttune, source } = item;
  const isHomebrew = source === "HOMEBREW";
  const primaryType = Array.isArray(types) && types.length > 0
    ? types[0]
    : null;
  const extraTypeCount = Array.isArray(types) && types.length > 1
    ? types.length - 1
    : 0;

  const handleContext = (e) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, item);
    }
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      onContextMenu={handleContext}
      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg
                 border border-slate-700 bg-slate-800/40 hover:bg-slate-800/80
                 hover:border-amber-500/40 transition-colors"
    >
      <span className="flex-1 min-w-0 truncate text-slate-100 font-medium text-sm">
        {name || "Unnamed item"}
      </span>

      {primaryType && (
        <span
          className="hidden sm:inline text-[11px] text-slate-400 truncate max-w-[140px]"
          title={Array.isArray(types) ? types.join(", ") : primaryType}
        >
          {primaryType}{extraTypeCount > 0 ? ` +${extraTypeCount}` : ""}
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

      {isHomebrew ? (
        <span
          className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border
            ${item.visibility === "public"
              ? "text-green-300 border-green-500/40"
              : "text-blue-300 border-blue-500/40"}`}
        >
          {item.visibility === "public" ? "Public" : "Private"}
        </span>
      ) : (
        source && (
          <span
            className="text-[10px] uppercase tracking-wider text-slate-400
                       border border-slate-600/40 rounded px-1.5 py-0.5"
          >
            {source}
          </span>
        )
      )}
    </button>
  );
}