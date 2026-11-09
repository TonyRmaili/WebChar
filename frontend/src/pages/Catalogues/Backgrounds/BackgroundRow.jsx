import React from "react";
import { formatSource, formatFeatTag } from "./backgroundHelpers";
import { RowTag, rowCls, rowNameCls } from "../catalogueStyle";

/* One background in the list: name · origin feat · source (or, for
   homebrew, public / private), on a dotted line. Right-click for the
   background's menu. */
export default function BackgroundRow({ background, onOpen, onContextMenu }) {
  if (!background) return null;
  const { name, source, feats = [], visibility } = background;
  const isHomebrew = source === "HOMEBREW";
  const featLabel = feats.length > 0 ? formatFeatTag(feats[0]) : null;

  const handleContext = (e) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, background);
    }
  };

  return (
    <button type="button" onClick={() => onOpen(background)} onContextMenu={handleContext} className={rowCls}>
      <span className={rowNameCls}>{name || "Unnamed background"}</span>

      {featLabel && (
        <span className="hidden max-w-[160px] truncate text-xs italic text-ink-faded sm:inline" title={feats.map(formatFeatTag).join(", ")}>
          {featLabel}
        </span>
      )}

      {isHomebrew ? (
        <RowTag className={visibility === "public" ? "!text-good" : "!text-info"}>{visibility === "public" ? "Public" : "Private"}</RowTag>
      ) : (
        source && <RowTag title={formatSource(source)}>{source}</RowTag>
      )}
    </button>
  );
}