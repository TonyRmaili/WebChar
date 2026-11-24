import React, { useEffect, useMemo, useState } from "react";
import useStoredState from "../../../utils/useStoredState";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import BackgroundCardForm from "./BackgroundCardForm";
import { ErrorLine, LoadingLine, Toolbar, searchCls } from "../catalogueStyle";
import { CatalogueRow, ChipToggles, useEntryMenu } from "../catalogueParts";
import { addBtn } from "../../../styles/parchmentForm";
import {
  HOMEBREW, ABILITIES, ABILITY_SHORT, EDITIONS, formatEdition, formatSource,
  collectUnique, toggleIn, matchesQuery, passesAny, byName, buildNameIndex,
  offeredAbilities, offeredSkills, offeredFeats, formatFeatOffer, labelFromId,
} from "../catalogueHelpers";
import { backgroundFeatLabel } from "./backgroundHelpers";

/* The Backgrounds catalogue: a filterable list; a click opens the card,
   a right-click copies (and, for your own homebrew, edits or deletes).
   The filters offer only values the loaded backgrounds have. */
export default function Backgrounds() {
  const backgrounds = useCatalogueStore((s) => s.backgrounds);
  const loading = useCatalogueStore((s) => s.loadingBackgrounds);
  const error = useCatalogueStore((s) => s.backgroundsError);
  const loadBackgrounds = useCatalogueStore((s) => s.loadBackgrounds);
  const deleteBackground = useCatalogueStore((s) => s.deleteBackground);
  const feats = useCatalogueStore((s) => s.feats);

  const openPopup = usePopupStore((s) => s.open);
  const currentUser = useAuthStore((s) => s.userData?.name);

  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sources, setSources] = useStoredState("catalogue.backgrounds.sources", []);
  const [editions, setEditions] = useStoredState("catalogue.backgrounds.editions", ["one"]);
  const [featPicks, setFeatPicks] = useStoredState("catalogue.backgrounds.featPicks", []);
  const [abilities, setAbilities] = useStoredState("catalogue.backgrounds.abilities", []);
  const [skills, setSkills] = useStoredState("catalogue.backgrounds.skills", []);

  const [form, setForm] = useState(null); // null = closed · {} new · { editing } · { copyFrom }
  const [openMenu, menu] = useEntryMenu({
    user: currentUser,
    onCopy: (bg) => setForm({ copyFrom: bg }),
    onEdit: (bg) => setForm({ editing: bg }),
    onDelete: deleteBackground,
  });

  useEffect(() => {
    loadBackgrounds();
  }, [loadBackgrounds]);

  const index = useMemo(() => buildNameIndex(feats), [feats]);

  const sourceOptions = useMemo(() => {
    const found = collectUnique(backgrounds, "source");
    return found.includes(HOMEBREW) ? found : [HOMEBREW, ...found];
  }, [backgrounds]);
  const featOptions = useMemo(() => collectUnique(backgrounds, offeredFeats), [backgrounds]);
  const skillOptions = useMemo(() => collectUnique(backgrounds, offeredSkills), [backgrounds]);

  const filtered = useMemo(
    () =>
      (backgrounds || [])
        .filter(
          (bg) =>
            passesAny(sources, [bg.source]) &&
            passesAny(editions, [bg.edition]) &&
            passesAny(featPicks, offeredFeats(bg)) &&
            passesAny(abilities, offeredAbilities(bg)) &&
            passesAny(skills, offeredSkills(bg)) &&
            matchesQuery(bg, query)
        )
        .sort(byName),
    [backgrounds, sources, editions, featPicks, abilities, skills, query]
  );

  const activeCount = sources.length + editions.length + featPicks.length + abilities.length + skills.length;
  const clearAll = () => {
    setSources([]);
    setEditions([]);
    setFeatPicks([]);
    setAbilities([]);
    setSkills([]);
    setQuery("");
  };

  return (
    <div className="min-h-[640px] w-full">
      {error && <ErrorLine>{error}</ErrorLine>}

      {loading ? (
        <LoadingLine>Fetching backgrounds…</LoadingLine>
      ) : (
        <>
          <Toolbar
            filters={<FilterButton activeCount={activeCount} onClick={() => setFiltersOpen(true)} />}
            search={<input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search backgrounds…" className={searchCls} />}
            right={
              <>
                <span className="text-xs italic text-ink-faded">
                  {filtered.length} of {backgrounds.length}
                </span>
                <button type="button" onClick={() => setForm({})} className={`${addBtn} !text-sm`}>
                  + create
                </button>
              </>
            }
          />

          <FilterPopup open={filtersOpen} onClose={() => setFiltersOpen(false)} activeCount={activeCount} onClear={clearAll}>
            <FilterSection title="Edition">
              <ChipToggles options={EDITIONS} selected={editions} labelOf={formatEdition} onToggle={(v) => setEditions((l) => toggleIn(l, v))} />
            </FilterSection>
            <FilterSection title="Sources">
              <ChipToggles options={sourceOptions} selected={sources} labelOf={formatSource} onToggle={(v) => setSources((l) => toggleIn(l, v))}
                           className="!grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
            </FilterSection>
            <FilterSection title="Feat">
              <ChipToggles options={featOptions} selected={featPicks} labelOf={(v) => formatFeatOffer(v, index)} onToggle={(v) => setFeatPicks((l) => toggleIn(l, v))} />
            </FilterSection>
            <FilterSection title="Ability Scores">
              <ChipToggles options={ABILITIES} selected={abilities} labelOf={(a) => ABILITY_SHORT[a]} onToggle={(v) => setAbilities((l) => toggleIn(l, v))} />
            </FilterSection>
            <FilterSection title="Skills" defaultOpen={false}>
              <ChipToggles options={skillOptions} selected={skills} labelOf={labelFromId} onToggle={(v) => setSkills((l) => toggleIn(l, v))} />
            </FilterSection>
          </FilterPopup>

          {filtered.length === 0 ? (
            <LoadingLine>No backgrounds match your filters.</LoadingLine>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((bg) => (
                <CatalogueRow key={`${bg.id}-${bg.visibility || ""}`} entry={bg} meta={backgroundFeatLabel(bg, index)}
                              onOpen={(b) => openPopup("background", b)} onContextMenu={openMenu} />
              ))}
            </div>
          )}

          {menu}

          <BackgroundCardForm
            open={form !== null}
            onClose={() => setForm(null)}
            editingBackground={form?.editing || null}
            copyFromBackground={form?.copyFrom || null}
          />
        </>
      )}
    </div>
  );
}
