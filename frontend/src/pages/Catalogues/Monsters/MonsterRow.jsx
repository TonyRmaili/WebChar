import React from "react";
import { formatSource, getMonsterType, formatCR, titleCase } from "./monsterHelpers";
import { RowTag, rowCls, rowNameCls } from "../catalogueStyle";

/* One monster in the list: name · type · CR (or level) · source (or, for
   homebrew, public / private), on a dotted line. Right-click for the
   monster's menu. */
export default function MonsterRow({ monster, onOpen, onContextMenu }) {
  if (!monster) return null;
  const { name, source, cr, visibility } = monster;
  const type = getMonsterType(monster);
  const isHomebrew = source === "HOMEBREW";

  const handleContext = (e) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, monster);
    }
  };

  return (
    <button type="button" onClick={() => onOpen(monster)} onContextMenu={handleContext} className={rowCls}>
      <span className={rowNameCls}>{name || "Unnamed creature"}</span>

      {type && <span className="hidden max-w-[120px] truncate text-xs italic text-ink-faded sm:inline">{titleCase(type)}</span>}

      {cr && <RowTag className="whitespace-nowrap !text-rubric">{formatCR(cr)}</RowTag>}

      {isHomebrew ? (
        <RowTag className={visibility === "public" ? "!text-good" : "!text-info"}>{visibility === "public" ? "Public" : "Private"}</RowTag>
      ) : (
        source && <RowTag title={formatSource(source)}>{source}</RowTag>
      )}
    </button>
  );
}