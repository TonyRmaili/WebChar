import React, { useState } from "react";
import { INK, InkButton } from "../../../../styles/parchment";
import { featureText, ordinal, progressionView } from "./generalHelpers";

/* The 5e class table for one of the character's classes — the same data
   as the catalogue's Class Progression, cut down to the levels the
   character has (plus the next one, faded, as a preview). "show all"
   opens the whole 1–20 table. Click a feature to read it. Subclass
   features are written in rust red. */

const head = `px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${INK.faded}`;

export default function ClassProgress({ entry, row }) {
  const [all, setAll] = useState(false);
  const [reading, setReading] = useState(null); // { name, level }

  const view = progressionView(entry, row, all);
  if (!view) return <p className={`text-xs italic ${INK.faint}`}>No progression table in the catalogue for this class.</p>;

  const toggleFeature = (name, level) =>
    setReading((r) => (r && r.name === name && r.level === level ? null : { name, level }));
  const text = reading ? featureText(entry, row, reading.name, reading.level) : "";

  return (
    <div className="space-y-2">
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[#7b6346]/35">
              <th className={`${head} text-left`}>Lvl</th>
              <th className={`${head} text-center`}>PB</th>
              <th className={`${head} text-left`}>Features</th>
              {view.columns.map((c) => (
                <th key={c.key} className={`${head} whitespace-nowrap text-center`}>
                  {c.label}
                </th>
              ))}
              {Array.from({ length: view.slotCount }, (_, i) => (
                <th key={i} className={`${head} text-center ${i === 0 ? "pl-4" : ""}`} title={`${ordinal(i + 1)}-level spell slots`}>
                  {ordinal(i + 1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => {
              const isCurrent = r.level === view.current;
              return (
                <tr
                  key={r.level}
                  className={`align-baseline ${r.reached ? "" : "italic opacity-55"} ${isCurrent ? "bg-[#9a3412]/[0.07]" : ""}`}
                >
                  <td className={`whitespace-nowrap px-2 py-1 ${isCurrent ? `font-semibold ${INK.rubric}` : ""}`}>{ordinal(r.level)}</td>
                  <td className="px-2 py-1 text-center tabular-nums">+{r.pb}</td>
                  <td className="px-2 py-1">
                    {r.features.length === 0 ? (
                      <span className={INK.faint}>—</span>
                    ) : (
                      r.features.map((f, i) => {
                        const open = reading && reading.name === f.name && reading.level === r.level;
                        return (
                          <React.Fragment key={`${f.name}-${i}`}>
                            {i > 0 && ", "}
                            <button
                              type="button"
                              onClick={() => toggleFeature(f.name, r.level)}
                              className={`text-left decoration-dotted underline-offset-2 hover:underline ${
                                f.from === "subclass" ? INK.rubric : ""
                              } ${open ? "underline" : ""}`}
                              title={f.from === "subclass" ? "Subclass feature — click to read" : "Click to read"}
                            >
                              {f.name}
                            </button>
                          </React.Fragment>
                        );
                      })
                    )}
                  </td>
                  {r.extras.map((v, i) => (
                    <td key={i} className="px-2 py-1 text-center tabular-nums">
                      {v}
                    </td>
                  ))}
                  {r.slots.map((v, i) => (
                    <td key={i} className={`px-2 py-1 text-center tabular-nums ${i === 0 ? "pl-4" : ""}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {reading && (
        <div className="border-l-2 border-[#9a3412]/60 pl-3">
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold">{reading.name}</span>
            <span className={`text-[11px] italic ${INK.faded}`}>level {reading.level}</span>
            <InkButton onClick={() => setReading(null)} className="ml-auto">
              close
            </InkButton>
          </div>
          <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed">
            {text ? text.replace(/^#+\s*/gm, "") : <span className={`italic ${INK.faint}`}>No description in the catalogue.</span>}
          </p>
        </div>
      )}

      {(view.hasMore || all) && (
        <InkButton onClick={() => setAll((v) => !v)}>{all ? "show only my levels" : "show all 20 levels"}</InkButton>
      )}
    </div>
  );
}