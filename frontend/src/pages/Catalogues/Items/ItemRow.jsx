import React from "react";
import { rarityClass } from "./itemHelpers";
import { RowTag, rowCls, rowNameCls } from "../catalogueStyle";

/* One item in the list: name · type · attunement · rarity · source (or,
   for homebrew, public / private), on a dotted line. Right-click for the
   item's menu. */
export default function ItemRow({ item, onOpen, onContextMenu }) {
  if (!item) return null;
  const { name, types, rarity, reqAttune, source } = item;
  const isHomebrew = source === "HOMEBREW";
  const primaryType = Array.isArray(types) && types.length > 0 ? types[0] : null;
  const extraTypeCount = Array.isArray(types) && types.length > 1 ? types.length - 1 : 0;

  const handleContext = (e) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, item);
    }
  };

  return (
    <button type="button" onClick={() => onOpen(item)} onContextMenu={handleContext} className={rowCls}>
      <span className={rowNameCls}>{name || "Unnamed item"}</span>

      {primaryType && (
        <span className="hidden max-w-[140px] truncate text-xs italic text-ink-faded sm:inline" title={Array.isArray(types) ? types.join(", ") : primaryType}>
          {primaryType}
          {extraTypeCount > 0 ? ` +${extraTypeCount}` : ""}
        </span>
      )}

      {reqAttune && (
        <RowTag className="!text-rubric" title={reqAttune === true ? "Requires attunement" : `Requires attunement ${reqAttune}`}>
          A
        </RowTag>
      )}

      {rarity && <RowTag className={rarityClass(rarity)}>{rarity}</RowTag>}

      {isHomebrew ? (
        <RowTag className={item.visibility === "public" ? "!text-good" : "!text-info"}>{item.visibility === "public" ? "Public" : "Private"}</RowTag>
      ) : (
        source && <RowTag>{source}</RowTag>
      )}
    </button>
  );
}