import React from "react";
import { formatSource, formatTypeAndSize } from "./raceHelpers";
import { RowTag, rowCls, rowNameCls } from "../catalogueStyle";

/* One race in the list: name · type and size · source (or, for homebrew,
   public / private), on a dotted line. Right-click for the race's menu. */
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
    <button type="button" onClick={() => onOpen(race)} onContextMenu={handleContext} className={rowCls}>
      <span className={rowNameCls}>{race.name}</span>

      <span className="hidden max-w-[180px] truncate text-xs italic text-ink-faded sm:inline">{formatTypeAndSize(race)}</span>

      {isHomebrew ? (
        <RowTag className={race.visibility === "public" ? "!text-good" : "!text-info"}>{race.visibility === "public" ? "Public" : "Private"}</RowTag>
      ) : (
        race.source && <RowTag title={formatSource(race.source)}>{race.source}</RowTag>
      )}
    </button>
  );
}