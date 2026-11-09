import React from "react";
import { formatSource, formatCategory } from "./featsHelpers";
import { RowTag, rowCls, rowNameCls } from "../catalogueStyle";

/* One feat in the list: name · category · source (or, for homebrew,
   public / private), on a dotted line. Right-click for the feat's menu. */
export default function FeatRow({ feat, onOpen, onContextMenu }) {
  if (!feat) return null;
  const { name, source, category, visibility } = feat;
  const isHomebrew = source === "HOMEBREW";

  const handleContext = (e) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, feat);
    }
  };

  return (
    <button type="button" onClick={() => onOpen(feat)} onContextMenu={handleContext} className={rowCls}>
      <span className={rowNameCls}>{name || "Unnamed feat"}</span>

      {category && <span className="hidden max-w-[140px] truncate text-xs italic text-ink-faded sm:inline">{formatCategory(category)}</span>}

      {isHomebrew ? (
        <RowTag className={visibility === "public" ? "!text-good" : "!text-info"}>{visibility === "public" ? "Public" : "Private"}</RowTag>
      ) : (
        source && <RowTag title={formatSource(source)}>{source}</RowTag>
      )}
    </button>
  );
}