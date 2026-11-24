import React, { useMemo, useState } from "react";
import { INK } from "../../../styles/parchment";
import { formatSource } from "../../Catalogues/catalogueHelpers";
import { raceSubtitle } from "../../Catalogues/Races/raceHelpers";
import { featSubtitle } from "../../Catalogues/Feats/featsHelpers";
import EntityList from "./EntityList";
import ChoiceList from "./ChoiceList";
import { ChoiceHead, Pick, PickRow, Rule } from "./wizardInk";

/* ═══════════════════════════════════════════════════════════════════
   OriginStep — the race step and the background step: pick one from
   the catalogue (filtered by the ruleset chips), then its choices are
   written underneath. A race with subraces asks for the subrace first;
   its choices come with it. Feats the race or background grants (an
   origin feat) bring their own choices, shown here too.
   ═══════════════════════════════════════════════════════════════════ */

const byName = (a, b) => String(a.name).localeCompare(String(b.name));

export default function OriginStep({
  kind, // "race" | "background" | "feat" (the sheet's Feats & Options: OriginSwap)
  entries,
  loading,
  editions,
  selectedId,
  subraceId,
  onSelect,
  onSelectSubrace,
  onPreview,
  choices,
  own,
  onPick,
  ownerLabel,
  rolled,
  onView,
  fixed = false, // the entry is already picked and can't change (OriginSwap keepRace): no list
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (entries || [])
      .filter((e) => e && editions.includes(e.edition === "classic" ? "classic" : "one") && (!q || e.name?.toLowerCase().includes(q)))
      .sort(byName);
  }, [entries, editions, search]);

  const selected = (entries || []).find((e) => e.id === selectedId);
  const subraces = kind === "race" ? selected?.subraces || [] : [];
  const word = { race: "races", background: "backgrounds", feat: "feats" }[kind] || `${kind}s`;

  return (
    <div>
      {!fixed && <EntityList
        items={filtered}
        selected={selectedId}
        onSelect={(e) => onSelect(e.id === selectedId ? null : e.id)}
        onPreview={onPreview}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={`Search ${word}…`}
        loadingText={`Fetching ${word}…`}
        emptyText={`No ${word} match.`}
        renderSubtitle={kind === "race" ? raceSubtitle : kind === "feat" ? featSubtitle : undefined}
        sourceTitle={formatSource}
      />}

      {selected && (
        <>
          {!fixed && <Rule />}
          <div className="space-y-5">
            {subraces.length > 0 && (
              <div>
                <ChoiceHead title="Subrace" need={subraceId ? "pick one · done" : "pick one · 1 left"} done={!!subraceId} owner={selected.name} />
                <PickRow>
                  {subraces.map((sr) => (
                    <Pick key={sr.id} round on={subraceId === sr.id} onClick={() => onSelectSubrace(subraceId === sr.id ? null : sr.id)}>
                      {sr.name || "Standard"}
                      {sr.source && sr.source !== selected.source && (
                        <span className={`ml-1.5 text-[10px] font-normal uppercase tracking-wider ${INK.faint}`}>{sr.source}</span>
                      )}
                    </Pick>
                  ))}
                </PickRow>
              </div>
            )}
            <ChoiceList
              choices={choices}
              own={own}
              onPick={onPick}
              ownerLabel={ownerLabel}
              rolled={rolled}
              onView={onView}
              empty={subraces.length ? null : `Nothing to choose: everything the ${kind} gives is fixed.`}
            />
          </div>
        </>
      )}
    </div>
  );
}
