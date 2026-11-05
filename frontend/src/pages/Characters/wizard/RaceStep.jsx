import React, { useMemo, useState } from "react";
import EntityList from "./EntityList";
import ChoiceGroup from "./ChoiceGroup";
import { editionOf, sameEntity } from "./wizardHelpers";
import { formatSource, formatTypeAndSize } from "../../Catalogues/Races/raceHelpers";

/* ═══════════════════════════════════════════════════════════════════
   RaceStep — race picker with its choices rendered inline underneath.

   Choices used to live in a hidden `activeSection === "choices"` tab
   that no wizard block pointed at, so picking a race with choices left
   the user stranded. They now sit directly under the picker that
   produced them, which is also what makes room for backgrounds and,
   later, classes to each own their choices.
   ═══════════════════════════════════════════════════════════════════ */

function SubracePicker({ race, subrace, onChoose }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-amber-400 mb-1.5">
        Choose a subrace
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(race.sub_races || []).map((sr) => {
          const isSel = sameEntity(subrace, sr) || (subrace?.name === sr.name && subrace?.source === sr.source);
          return (
            <button
              key={`${sr.name}-${sr.source}`}
              type="button"
              onClick={() => onChoose(sr)}
              className={`text-left px-3 py-2 rounded-lg border transition-colors
                ${isSel
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                  : "border-slate-700 bg-slate-800/40 text-slate-200 hover:border-amber-500/40"}`}
            >
              <div className="text-sm font-medium truncate">{sr.display_name || sr.name}</div>
              {sr.source && (
                <div className="text-[10px] uppercase tracking-wider text-slate-400">{sr.source}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function RaceStep({
  races,
  loading,
  editions,
  selectedRace,
  subrace,
  choices,
  choiceSel,
  overlap,
  onSelectRace,
  onSelectSubrace,
  onToggleChoice,
  onAsiChange,
  onPreview,
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (races || [])
      .filter((r) => {
        if (!r) return false;
        if (!editions.includes(editionOf(r))) return false;
        if (q && !r.name?.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [races, editions, search]);

  const raceOwned = (choices || []).filter((c) => c.scope === "race");

  return (
    <div className="space-y-4">
      <EntityList
        items={filtered}
        selected={selectedRace}
        onSelect={onSelectRace}
        onPreview={onPreview}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search races…"
        loadingText="Loading races…"
        emptyText="No races match."
        renderSubtitle={formatTypeAndSize}
        sourceTitle={formatSource}
      />

      {selectedRace && raceOwned.length > 0 && (
        <div className="space-y-4 border-t border-slate-700/60 pt-4">
          {raceOwned.map((c) =>
            c.kind === "subrace" ? (
              <SubracePicker
                key={c.id}
                race={selectedRace}
                subrace={subrace}
                onChoose={onSelectSubrace}
              />
            ) : (
              <ChoiceGroup
                key={c.id}
                choice={c}
                sel={choiceSel[c.id]}
                overlap={overlap}
                onToggle={onToggleChoice}
                onAsiChange={onAsiChange}
                subrace={subrace}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}