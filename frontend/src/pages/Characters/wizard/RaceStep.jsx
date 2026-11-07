import React, { useMemo, useState } from "react";
import { INK } from "../../../styles/parchment";
import EntityList from "./EntityList";
import ChoiceGroup from "./ChoiceGroup";
import { ChoiceHead, Pick, PickRow, Rule } from "./wizardInk";
import { editionOf } from "./wizardHelpers";
import { formatSource, formatTypeAndSize } from "../../Catalogues/Races/raceHelpers";

/* ═══════════════════════════════════════════════════════════════════
   RaceStep — race picker with its choices written underneath.
   The subrace comes first: a subrace can add its own choices, so the
   rest only appear once it is picked.
   ═══════════════════════════════════════════════════════════════════ */

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
      .filter((r) => r && editions.includes(editionOf(r)) && (!q || r.name?.toLowerCase().includes(q)))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [races, editions, search]);

  const raceOwned = (choices || []).filter((c) => c.scope === "race");

  return (
    <div>
      <EntityList
        items={filtered}
        selected={selectedRace}
        onSelect={onSelectRace}
        onPreview={onPreview}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search races…"
        loadingText="Fetching races…"
        emptyText="No races match."
        renderSubtitle={formatTypeAndSize}
        sourceTitle={formatSource}
      />

      {selectedRace && raceOwned.length > 0 && (
        <>
          <Rule />
          <div className="space-y-5">
            {raceOwned.map((c) =>
              c.kind === "subrace" ? (
                <div key={c.id}>
                  <ChoiceHead title="Subrace" need={subrace ? "pick one · done" : "pick one · 1 left"} done={!!subrace} owner={selectedRace.name} />
                  <PickRow>
                    {(selectedRace.sub_races || []).map((sr) => (
                      // Two subraces can share a name (Elf/PHB has two Eladrin), so match on source too.
                      <Pick
                        key={`${sr.name}-${sr.source}`}
                        round
                        on={subrace?.name === sr.name && subrace?.source === sr.source}
                        onClick={() => onSelectSubrace(sr)}
                      >
                        {sr.display_name || sr.name}
                        {sr.source && <span className={`ml-1.5 text-[10px] font-normal uppercase tracking-wider ${INK.faint}`}>{sr.source}</span>}
                      </Pick>
                    ))}
                  </PickRow>
                </div>
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
        </>
      )}
    </div>
  );
}