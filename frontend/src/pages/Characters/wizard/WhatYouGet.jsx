import React, { useState } from "react";
import { INK } from "../../../styles/parchment";
import { Chevron } from "../../../styles/parchmentForm";
import { Note } from "./wizardInk";

/* ═══════════════════════════════════════════════════════════════════
   WhatYouGet — what each class level gives, choice or not: Level 1
   Spellcasting, Arcane Recovery…; Level 3 the subclass's features and
   spells. Hover a name for its text (like Play's cards); click it to
   read the text right there. Each level folds away.

   rows: [{ level, features: [{id, name, text, via}], spells: [{name, via}] }]
   (classPicks.gainsByLevel)
   ═══════════════════════════════════════════════════════════════════ */

function Feature({ f }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={f.text || undefined}
        aria-expanded={open}
        className={`text-left text-[15px] underline-offset-4 ${f.text ? "decoration-dotted hover:underline" : "cursor-default"} ${open ? "underline" : ""}`}
      >
        {f.name}
      </button>
      {f.via && <span className={`ml-1.5 text-[11px] italic ${INK.faint}`}>{f.via}</span>}
      {open && f.text && <p className={`mb-2 mt-1 whitespace-pre-line border-l-2 border-rule/30 pl-3 text-sm leading-snug ${INK.faded}`}>{f.text}</p>}
    </li>
  );
}

function Level({ row, startOpen }) {
  const [open, setOpen] = useState(startOpen);
  const empty = !row.features.length && !row.spells.length;
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-baseline gap-1.5 text-left">
        <span className="self-center">
          <Chevron open={open} />
        </span>
        <span className={`text-xs font-semibold uppercase tracking-[0.25em] ${INK.rubric}`}>Level {row.level}</span>
        {!open && !empty && <span className={`truncate text-xs italic ${INK.faint}`}>{row.features.map((f) => f.name).join(", ")}</span>}
      </button>
      {open && (
        <div className="mb-1 mt-1 pl-5">
          {empty ? (
            <Note>Nothing new here but what you pick.</Note>
          ) : (
            <ul className="space-y-0.5">
              {row.features.map((f, i) => (
                <Feature key={`${f.from}|${f.id || f.name}|${i}`} f={f} />
              ))}
              {row.spells.length > 0 && (
                <li className="text-sm">
                  <span className={`italic ${INK.faded}`}>Spells always ready: </span>
                  {row.spells.map((s) => s.name || s.id).join(", ")}
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function WhatYouGet({ rows, openLevels = "all", empty = "Nothing yet." }) {
  if (!rows?.length) return <Note>{empty}</Note>;
  const last = rows[rows.length - 1]?.level;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Level key={r.level} row={r} startOpen={openLevels === "all" || (openLevels === "last" && r.level === last)} />
      ))}
    </div>
  );
}
