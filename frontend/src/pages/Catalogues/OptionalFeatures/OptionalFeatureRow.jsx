import React from "react";
import { formatSource, formatFeatureType } from "./optionalFeatureHelpers";
import { RowTag, rowCls, rowNameCls } from "../catalogueStyle";

/* One optional feature in the list: name · feature type · source (or, for
   homebrew, public / private), on a dotted line. Right-click for the
   feature's menu. */
export default function OptionalFeatureRow({ feature, onOpen, onContextMenu }) {
  if (!feature) return null;
  const { name, source, feature_type, visibility } = feature;
  const isHomebrew = source === "HOMEBREW";

  const handleContext = (e) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, feature);
    }
  };

  return (
    <button type="button" onClick={() => onOpen(feature)} onContextMenu={handleContext} className={rowCls}>
      <span className={rowNameCls}>{name || "Unnamed feature"}</span>

      {feature_type && <span className="hidden max-w-[140px] truncate text-xs italic text-ink-faded sm:inline">{formatFeatureType(feature_type)}</span>}

      {isHomebrew ? (
        <RowTag className={visibility === "public" ? "!text-good" : "!text-info"}>{visibility === "public" ? "Public" : "Private"}</RowTag>
      ) : (
        source && <RowTag title={formatSource(source)}>{source}</RowTag>
      )}
    </button>
  );
}