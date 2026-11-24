import React, { useEffect, useMemo, useState } from "react";
import useStoredState from "../../../utils/useStoredState";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import FeatCardForm from "./FeatCardForm";
import { ErrorLine, LoadingLine, Toolbar, searchCls } from "../catalogueStyle";
import { CatalogueRow, ChipToggles, useEntryMenu } from "../catalogueParts";
import { addBtn } from "../../../styles/parchmentForm";
import {
  HOMEBREW, ABILITIES, ABILITY_SHORT, EDITIONS, formatEdition, formatSource,
  collectUnique, toggleIn, matchesQuery, passesAny, byName, buildNameIndex,
  offeredAbilities, offeredKinds, GIVES_LABELS, prerequisiteKinds, PREREQUISITE_LABELS,
} from "../catalogueHelpers";
import { categoryLabel, featRowMeta } from "./featsHelpers";

const NO_CATEGORY = "none";
const REPEATABLE = [
  { value: "yes", label: "Repeatable" },
  { value: "no", label: "Once only" },
];

/* The Feats catalogue: a filterable list; a click opens the card, a
   right-click copies (and, for your own homebrew, edits or deletes).
   The filters offer only values the loaded feats have. */
export default function Feats() {
  const feats = useCatalogueStore((s) => s.feats);
  const loading = useCatalogueStore((s) => s.loadingFeats);
  const error = useCatalogueStore((s) => s.featsError);
  const loadFeats = useCatalogueStore((s) => s.loadFeats);
  const deleteFeat = useCatalogueStore((s) => s.deleteFeat);

  const openPopup = usePopupStore((s) => s.open);
  const currentUser = useAuthStore((s) => s.userData?.name);

  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editions, setEditions] = useStoredState("catalogue.feats.editions", ["one"]);
  const [sources, setSources] = useStoredState("catalogue.feats.sources", []);
  const [categories, setCategories] = useStoredState("catalogue.feats.categories", []);
  const [abilities, setAbilities] = useStoredState("catalogue.feats.abilities", []);
  const [prereqs, setPrereqs] = useStoredState("catalogue.feats.prereqs", []);
  const [gives, setGives] = useStoredState("catalogue.feats.gives", []);
  const [repeatable, setRepeatable] = useStoredState("catalogue.feats.repeatable", []);

  const [form, setForm] = useState(null); // null = closed · {} new · { editing } · { copyFrom }
  const [openMenu, menu] = useEntryMenu({
    user: currentUser,
    onCopy: (f) => setForm({ copyFrom: f }),
    onEdit: (f) => setForm({ editing: f }),
    onDelete: deleteFeat,
  });

  useEffect(() => {
    loadFeats();
  }, [loadFeats]);

  const index = useMemo(() => buildNameIndex(feats), [feats]);

  // What the filters offer: only values some feat has.
  const sourceOptions = useMemo(() => {
    const found = collectUnique(feats, "source");
    return found.includes(HOMEBREW) ? found : [HOMEBREW, ...found];
  }, [feats]);
  const categoryOptions = useMemo(() => collectUnique(feats, (f) => f.category || NO_CATEGORY), [feats]);
  const prereqOptions = useMemo(() => collectUnique(feats, prerequisiteKinds), [feats]);
  const givesOptions = useMemo(() => collectUnique(feats, offeredKinds), [feats]);

  const filtered = useMemo(
    () =>
      (feats || [])
        .filter(
          (f) =>
            passesAny(editions, [f.edition]) &&
            passesAny(sources, [f.source]) &&
            passesAny(categories, [f.category || NO_CATEGORY]) &&
            passesAny(abilities, offeredAbilities(f)) &&
            passesAny(prereqs, prerequisiteKinds(f)) &&
            passesAny(gives, offeredKinds(f)) &&
            passesAny(repeatable, [f.repeatable ? "yes" : "no"]) &&
            matchesQuery(f, query)
        )
        .sort(byName),
    [feats, editions, sources, categories, abilities, prereqs, gives, repeatable, query]
  );

  const activeCount =
    editions.length + sources.length + categories.length + abilities.length + prereqs.length + gives.length + repeatable.length;
  const clearAll = () => {
    [setEditions, setSources, setCategories, setAbilities, setPrereqs, setGives, setRepeatable].forEach((s) => s([]));
    setQuery("");
  };

  const toggler = (setter) => (v) => setter((l) => toggleIn(l, v));

  return (
    <div className="min-h-[640px] w-full">
      {error && <ErrorLine>{error}</ErrorLine>}

      {loading ? (
        <LoadingLine>Fetching feats…</LoadingLine>
      ) : (
        <>
          <Toolbar
            filters={<FilterButton activeCount={activeCount} onClick={() => setFiltersOpen(true)} />}
            search={<input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search feats…" className={searchCls} />}
            right={
              <>
                <span className="text-xs italic text-ink-faded">
                  {filtered.length} of {feats.length}
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
              <ChipToggles options={sourceOptions} selected={sources} labelOf={formatSource} onToggle={toggler(setSources)}
                           className="!grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
            </FilterSection>
            <FilterSection title="Category">
              <ChipToggles options={categoryOptions} selected={categories} onToggle={toggler(setCategories)}
                           labelOf={(c) => (c === NO_CATEGORY ? "No category (classic)" : categoryLabel(c))} />
            </FilterSection>
            <FilterSection title="Ability Scores">
              <ChipToggles options={ABILITIES} selected={abilities} labelOf={(a) => ABILITY_SHORT[a]} onToggle={toggler(setAbilities)} />
            </FilterSection>
            <FilterSection title="Prerequisite">
              <ChipToggles options={prereqOptions} selected={prereqs} onToggle={toggler(setPrereqs)}
                           labelOf={(k) => (k === "none" ? "None" : PREREQUISITE_LABELS[k] || k)} />
            </FilterSection>
            <FilterSection title="Gives">
              <ChipToggles options={givesOptions} selected={gives} labelOf={(k) => GIVES_LABELS[k] || k} onToggle={toggler(setGives)} />
            </FilterSection>
            <FilterSection title="Repeatable" defaultOpen={false}>
              <ChipToggles options={REPEATABLE.map((r) => r.value)} selected={repeatable} onToggle={toggler(setRepeatable)}
                           labelOf={(v) => REPEATABLE.find((r) => r.value === v).label} />
            </FilterSection>
          </FilterPopup>

          {filtered.length === 0 ? (
            <LoadingLine>No feats match your filters.</LoadingLine>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((f) => (
                <CatalogueRow key={`${f.id}-${f.visibility || ""}`} entry={f} meta={featRowMeta(f, index)}
                              onOpen={(x) => openPopup("feat", x)} onContextMenu={openMenu} />
              ))}
            </div>
          )}

          {menu}

          <FeatCardForm open={form !== null} onClose={() => setForm(null)}
                        editingFeat={form?.editing || null} copyFromFeat={form?.copyFrom || null} />
        </>
      )}
    </div>
  );
}
