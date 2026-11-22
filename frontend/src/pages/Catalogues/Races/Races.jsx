import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import RaceCreatePopup from "./RaceCreatePopup";
import { ErrorLine, LoadingLine, Toolbar, searchCls } from "../catalogueStyle";
import { CatalogueRow, ChipToggles, useEntryMenu } from "../catalogueParts";
import { addBtn } from "../../../styles/parchmentForm";
import {
  HOMEBREW, ABILITIES, ABILITY_SHORT, EDITIONS, formatEdition, formatSource, labelFromId, titleCase,
  collectUnique, toggleIn, matchesQuery, passesAny, byName, offeredAbilities, offeredKinds, GIVES_LABELS,
  offeredSenses, offeredSpeeds, offeredResistances,
} from "../catalogueHelpers";
import { raceRowMeta } from "./raceHelpers";

const SUBRACES = [
  { value: "yes", label: "Has subraces" },
  { value: "no", label: "No subraces" },
];

/* The Races catalogue: a filterable list; a click opens the card, a
   right-click copies (and, for your own homebrew, edits or deletes).
   The filters offer only values the loaded races have, subraces included. */
export default function Races() {
  const races = useCatalogueStore((s) => s.races);
  const loading = useCatalogueStore((s) => s.loadingRaces);
  const error = useCatalogueStore((s) => s.racesError);
  const loadRaces = useCatalogueStore((s) => s.loadRaces);
  const deleteRace = useCatalogueStore((s) => s.deleteRace);

  const openPopup = usePopupStore((s) => s.open);
  const currentUser = useAuthStore((s) => s.userData?.name);

  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editions, setEditions] = useState(["one"]);
  const [sources, setSources] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [types, setTypes] = useState([]);
  const [abilities, setAbilities] = useState([]);
  const [senses, setSenses] = useState([]);
  const [speeds, setSpeeds] = useState([]);
  const [resists, setResists] = useState([]);
  const [gives, setGives] = useState([]);
  const [subraces, setSubraces] = useState([]);

  const [form, setForm] = useState(null); // null = closed · {} new · { editing } · { copyFrom }
  const [openMenu, menu] = useEntryMenu({
    user: currentUser,
    onCopy: (r) => setForm({ copyFrom: r }),
    onEdit: (r) => setForm({ editing: r }),
    onDelete: deleteRace,
  });

  useEffect(() => {
    loadRaces();
  }, [loadRaces]);

  // What the filters offer: only values some race (or subrace) has.
  const options = useMemo(() => {
    const found = collectUnique(races, "source");
    return {
      sources: found.includes(HOMEBREW) ? found : [HOMEBREW, ...found],
      sizes: collectUnique(races, (r) => [...(r.size || []), ...(r.subraces || []).flatMap((s) => s.size || [])]),
      types: collectUnique(races, "creature_types"),
      senses: collectUnique(races, offeredSenses),
      speeds: collectUnique(races, offeredSpeeds),
      resists: collectUnique(races, offeredResistances),
      gives: collectUnique(races, offeredKinds),
    };
  }, [races]);

  const filtered = useMemo(
    () =>
      (races || [])
        .filter(
          (r) =>
            passesAny(editions, [r.edition]) &&
            passesAny(sources, [r.source]) &&
            passesAny(sizes, [...(r.size || []), ...(r.subraces || []).flatMap((s) => s.size || [])]) &&
            passesAny(types, r.creature_types) &&
            passesAny(abilities, offeredAbilities(r)) &&
            passesAny(senses, offeredSenses(r)) &&
            passesAny(speeds, offeredSpeeds(r)) &&
            passesAny(resists, offeredResistances(r)) &&
            passesAny(gives, offeredKinds(r)) &&
            passesAny(subraces, [r.subraces?.length ? "yes" : "no"]) &&
            matchesQuery(r, query)
        )
        .sort(byName),
    [races, editions, sources, sizes, types, abilities, senses, speeds, resists, gives, subraces, query]
  );

  const all = [editions, sources, sizes, types, abilities, senses, speeds, resists, gives, subraces];
  const activeCount = all.reduce((n, l) => n + l.length, 0);
  const clearAll = () => {
    [setEditions, setSources, setSizes, setTypes, setAbilities, setSenses, setSpeeds, setResists, setGives, setSubraces].forEach((s) => s([]));
    setQuery("");
  };
  const toggler = (setter) => (v) => setter((l) => toggleIn(l, v));

  return (
    <div className="min-h-[640px] w-full">
      {error && <ErrorLine>{error}</ErrorLine>}

      {loading ? (
        <LoadingLine>Fetching races…</LoadingLine>
      ) : (
        <>
          <Toolbar
            filters={<FilterButton activeCount={activeCount} onClick={() => setFiltersOpen(true)} />}
            search={<input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search races…" className={searchCls} />}
            right={
              <>
                <span className="text-xs italic text-ink-faded">
                  {filtered.length} of {races.length}
                </span>
                <button type="button" onClick={() => setForm({})} className={`${addBtn} !text-sm`}>
                  + create
                </button>
              </>
            }
          />

          <FilterPopup open={filtersOpen} onClose={() => setFiltersOpen(false)} activeCount={activeCount} onClear={clearAll}>
            <FilterSection title="Edition">
              <ChipToggles options={EDITIONS} selected={editions} labelOf={formatEdition} onToggle={toggler(setEditions)} />
            </FilterSection>
            <FilterSection title="Sources">
              <ChipToggles options={options.sources} selected={sources} labelOf={formatSource} onToggle={toggler(setSources)}
                           className="!grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
            </FilterSection>
            <FilterSection title="Size">
              <ChipToggles options={options.sizes} selected={sizes} labelOf={titleCase} onToggle={toggler(setSizes)} />
            </FilterSection>
            <FilterSection title="Creature Type">
              <ChipToggles options={options.types} selected={types} labelOf={titleCase} onToggle={toggler(setTypes)} />
            </FilterSection>
            <FilterSection title="Ability Scores">
              <ChipToggles options={ABILITIES} selected={abilities} labelOf={(a) => ABILITY_SHORT[a]} onToggle={toggler(setAbilities)} />
            </FilterSection>
            <FilterSection title="Senses">
              <ChipToggles options={options.senses} selected={senses} labelOf={labelFromId} onToggle={toggler(setSenses)} />
            </FilterSection>
            <FilterSection title="Speed">
              <ChipToggles options={options.speeds} selected={speeds} labelOf={labelFromId} onToggle={toggler(setSpeeds)} />
            </FilterSection>
            <FilterSection title="Resistances & Immunities" defaultOpen={false}>
              <ChipToggles options={options.resists} selected={resists} labelOf={labelFromId} onToggle={toggler(setResists)} />
            </FilterSection>
            <FilterSection title="Gives" defaultOpen={false}>
              <ChipToggles options={options.gives} selected={gives} labelOf={(k) => GIVES_LABELS[k] || k} onToggle={toggler(setGives)} />
            </FilterSection>
            <FilterSection title="Subraces" defaultOpen={false}>
              <ChipToggles options={SUBRACES.map((o) => o.value)} selected={subraces} onToggle={toggler(setSubraces)}
                           labelOf={(v) => SUBRACES.find((o) => o.value === v).label} />
            </FilterSection>
          </FilterPopup>

          {filtered.length === 0 ? (
            <LoadingLine>No races match your filters.</LoadingLine>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((r) => (
                <CatalogueRow key={`${r.id}-${r.visibility || ""}`} entry={r} meta={raceRowMeta(r)}
                              onOpen={(x) => openPopup("race", x)} onContextMenu={openMenu} />
              ))}
            </div>
          )}

          {menu}

          <RaceCreatePopup open={form !== null} onClose={() => setForm(null)}
                           editingRace={form?.editing || null} copyFromRace={form?.copyFrom || null} />
        </>
      )}
    </div>
  );
}
