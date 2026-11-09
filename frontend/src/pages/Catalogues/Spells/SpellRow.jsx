import React from "react";
import { formatSource, formatLevelChip } from "./spellHelpers";
import { RowTag, rowCls, rowNameCls } from "../catalogueStyle";

const SCHOOL_NAMES = {
  A: "Abjuration",
  C: "Conjuration",
  D: "Divination",
  E: "Enchantment",
  V: "Evocation",
  I: "Illusion",
  N: "Necromancy",
  T: "Transmutation",
};

// One spell in the list: level · name · school · source, on a dotted line.
export default function SpellRow({ spell, onOpen }) {
  const { name, source, level, school } = spell || {};
  const schoolName = SCHOOL_NAMES[school] || (school ? school[0].toUpperCase() + school.slice(1) : "");

  return (
    <button type="button" onClick={() => onOpen(spell)} className={rowCls}>
      <RowTag className="w-12 !text-rubric" title={level === 0 ? "Cantrip" : `Level ${level}`}>
        {formatLevelChip(level)}
      </RowTag>

      <span className={rowNameCls}>{name || "Unnamed spell"}</span>

      {schoolName && <span className="hidden max-w-[120px] truncate text-xs italic text-ink-faded sm:inline">{schoolName}</span>}

      {source && <RowTag title={formatSource(source)}>{source}</RowTag>}
    </button>
  );
}