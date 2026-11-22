import React, { useMemo, useState } from "react";
import { INK, InkButton } from "../../../styles/parchment";
import { formatSource } from "../../Catalogues/catalogueHelpers";
import EntityList from "./EntityList";
import PickGroups from "./PickGroups";
import WhatYouGet from "./WhatYouGet";
import { gainsByLevel, groupChoices } from "./classPicks";
import { Rule, Stepper } from "./wizardInk";

/* ═══════════════════════════════════════════════════════════════════
   ClassStep — the classes taken, in order (the first one is the
   character's starting class: its proficiencies, saves and gear), each
   with its level. Under each class, side by side:

     Picks          every choice of levels 1 to N, condensed: all the
                    spell picks in one block, all the feats in one…
                    (PickGroups). Right-click an option for its card.
     What you get   each level's features with their text, choice or
                    not (WhatYouGet).

   A feat a level grants brings its own choices along.
   ═══════════════════════════════════════════════════════════════════ */

const MAX_LEVEL = 20;
const editionWord = (c) => (c?.edition === "classic" ? "Classic" : "One D&D");

export default function ClassStep({
  classes,
  loading,
  editions,
  entries, // [{ id, level }]
  levelCap = MAX_LEVEL,
  onAdd,
  onRemove,
  onLevel,
  onPreview,
  choices, // already filtered to class levels (and the feats they grant)
  rootOf, // from -> the class layer it hangs on
  own,
  onPick,
  ownerLabel,
  rolled,
  onView,
  features, // preview.features: what every layer gives
  spells, // preview.spells
  labelOf = () => null,
}) {
  const [search, setSearch] = useState("");
  const total = entries.reduce((n, e) => n + e.level, 0);
  const byId = useMemo(() => Object.fromEntries((classes || []).map((c) => [c.id, c])), [classes]);

  const pickable = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (classes || [])
      .filter((c) => c && c.hit_die && editions.includes(c.edition === "classic" ? "classic" : "one") && (!q || c.name?.toLowerCase().includes(q)))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)) || String(a.source).localeCompare(String(b.source)));
  }, [classes, editions, search]);

  // class id -> condensed choice groups, and what each level gives
  const grouped = useMemo(() => Object.fromEntries(groupChoices(choices, rootOf).map((g) => [g.classId, g.groups])), [choices, rootOf]);
  const gains = useMemo(() => gainsByLevel(features, spells, rootOf, labelOf), [features, spells, rootOf, labelOf]);

  return (
    <div>
      {entries.length > 0 && (
        <ol className="mb-4 space-y-1.5">
          {entries.map((e, i) => {
            const cls = byId[e.id];
            const room = levelCap - (total - e.level);
            return (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 border-b border-dotted border-rule/25 pb-1.5">
                <span className={`w-5 text-xs ${INK.faint}`}>{i + 1}.</span>
                <span className="text-[17px] font-semibold">{cls?.name || e.id}</span>
                <span className={`text-xs italic ${INK.faded}`}>
                  {editionWord(cls)} · {cls?.source} · {cls?.hit_die}
                  {i === 0 && " · starting class"}
                </span>
                <span className="ml-auto flex items-baseline gap-3">
                  <span className={`text-sm italic ${INK.faded}`}>level</span>
                  <Stepper value={e.level} min={1} max={Math.max(e.level, Math.min(MAX_LEVEL, room))} onChange={(v) => onLevel(e.id, v)} label={`${cls?.name} level`} />
                  {cls && onPreview && <InkButton onClick={() => onPreview(cls)}>view</InkButton>}
                  <InkButton onClick={() => onRemove(e.id)} title="Take this class off">remove</InkButton>
                </span>
              </li>
            );
          })}
          <li className={`pt-1 text-right text-sm italic ${INK.faded}`}>
            total level {total}
            {levelCap < MAX_LEVEL ? ` of ${levelCap}` : ""}
          </li>
        </ol>
      )}

      <EntityList
        items={pickable}
        selected={entries.map((e) => e.id)}
        onSelect={(c) => (entries.some((e) => e.id === c.id) ? onRemove(c.id) : onAdd(c.id))}
        isDisabled={(c) => total >= levelCap || entries.some((e) => byId[e.id]?.name === c.name)}
        onPreview={onPreview}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={entries.length ? "Add a class (multiclass)…" : "Search classes…"}
        loadingText="Fetching classes…"
        emptyText="No classes match."
        renderSubtitle={(c) => `${editionWord(c)} · ${c.hit_die}`}
        sourceTitle={formatSource}
      />

      {entries.map((e) => {
        const cls = byId[e.id];
        return (
          <div key={e.id}>
            <Rule />
            <h3 className="mb-3 text-lg font-semibold">
              {cls?.name || e.id} <span className={`text-sm font-normal italic ${INK.faded}`}>levels 1–{e.level}</span>
            </h3>
            <div className="grid grid-cols-1 gap-x-10 gap-y-6 @3xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="min-w-0">
                <div className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] ${INK.faint}`}>Picks</div>
                <PickGroups groups={grouped[e.id]} own={own} onPick={onPick} rolled={rolled} onView={onView} ownerLabel={ownerLabel} empty="Nothing to choose for these levels." />
              </div>
              <div className="min-w-0 @3xl:border-l @3xl:border-rule/20 @3xl:pl-6">
                <div className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] ${INK.faint}`}>What you get</div>
                <WhatYouGet rows={gains[e.id]} openLevels={e.level > 5 ? "last" : "all"} empty="Waiting for the server…" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
