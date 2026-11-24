import React, { useEffect, useMemo, useState } from "react";
import useStoredState from "../../../utils/useStoredState";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import OptionalFeatureCardForm from "./OptionalFeatureCardForm";
import { ErrorLine, LoadingLine, Toolbar, searchCls } from "../catalogueStyle";
import { CatalogueRow, ChipToggles, useEntryMenu } from "../catalogueParts";
import { addBtn } from "../../../styles/parchmentForm";
import {
  HOMEBREW, EDITIONS, formatEdition, formatSource, formatFeatureType, labelFromId,
  collectUnique, toggleIn, matchesQuery, passesAny, byName, offeredKinds, GIVES_LABELS,
  prerequisiteKinds, PREREQUISITE_LABELS,
} from "../catalogueHelpers";
import { consumedResources, featureClasses, optionalFeatureRowMeta } from "./optionalFeatureHelpers";

const REPEATABLE = [
  { value: "yes", label: "Repeatable" },
  { value: "no", label: "Once only" },
];
const NO_COST = "none";

/* The Optional Features catalogue (invocations, maneuvers, metamagic,
   fighting styles, …): a filterable list; a click opens the card, a
   right-click copies (and, for your own homebrew, edits or deletes).
   The filters offer only values the loaded features have. */
export default function OptionalFeatures() {
  const features = useCatalogueStore((s) => s.optionalFeatures);
  const loading = useCatalogueStore((s) => s.loadingOptionalFeatures);
  const error = useCatalogueStore((s) => s.optionalFeaturesError);
  const loadOptionalFeatures = useCatalogueStore((s) => s.loadOptionalFeatures);
  const deleteOptionalFeature = useCatalogueStore((s) => s.deleteOptionalFeature);

  const openPopup = usePopupStore((s) => s.open);
  const currentUser = useAuthStore((s) => s.userData?.name);

  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editions, setEditions] = useStoredState("catalogue.optionalFeatures.editions", ["one"]);
  const [sources, setSources] = useStoredState("catalogue.optionalFeatures.sources", []);
  const [types, setTypes] = useStoredState("catalogue.optionalFeatures.types", []);
  const [classes, setClasses] = useStoredState("catalogue.optionalFeatures.classes", []);
  const [prereqs, setPrereqs] = useStoredState("catalogue.optionalFeatures.prereqs", []);
  const [costs, setCosts] = useStoredState("catalogue.optionalFeatures.costs", []);
  const [gives, setGives] = useStoredState("catalogue.optionalFeatures.gives", []);
  const [repeatable, setRepeatable] = useStoredState("catalogue.optionalFeatures.repeatable", []);

  const [form, setForm] = useState(null); // null = closed · {} new · { editing } · { copyFrom }
  const [openMenu, menu] = useEntryMenu({
    user: currentUser,
    onCopy: (f) => setForm({ copyFrom: f }),
    onEdit: (f) => setForm({ editing: f }),
    onDelete: deleteOptionalFeature,
  });

  useEffect(() => {
    loadOptionalFeatures();
  }, [loadOptionalFeatures]);

  const costOf = (f) => (consumedResources(f).length ? consumedResources(f) : [NO_COST]);

  // What the filters offer: only values some feature has.
  const options = useMemo(() => {
    const found = collectUnique(features, "source");
    return {
      sources: found.includes(HOMEBREW) ? found : [HOMEBREW, ...found],
      types: collectUnique(features, "feature_types"),
      classes: collectUnique(features, featureClasses),
      prereqs: collectUnique(features, prerequisiteKinds),
      costs: collectUnique(features, costOf),
      gives: collectUnique(features, offeredKinds),
    };
  }, [features]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(
    () =>
      (features || [])
        .filter(
          (f) =>
            passesAny(editions, [f.edition]) &&
            passesAny(sources, [f.source]) &&
            passesAny(types, f.feature_types) &&
            passesAny(classes, featureClasses(f)) &&
            passesAny(prereqs, prerequisiteKinds(f)) &&
            passesAny(costs, costOf(f)) &&
            passesAny(gives, offeredKinds(f)) &&
            passesAny(repeatable, [f.repeatable ? "yes" : "no"]) &&
            matchesQuery(f, query)
        )
        .sort(byName),
    [features, editions, sources, types, classes, prereqs, costs, gives, repeatable, query] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const all = [editions, sources, types, classes, prereqs, costs, gives, repeatable];
  const activeCount = all.reduce((n, l) => n + l.length, 0);
  const clearAll = () => {
    [setEditions, setSources, setTypes, setClasses, setPrereqs, setCosts, setGives, setRepeatable].forEach((s) => s([]));
    setQuery("");
  };
  const toggler = (setter) => (v) => setter((l) => toggleIn(l, v));

  return (
    <div className="min-h-[640px] w-full">
      {error && <ErrorLine>{error}</ErrorLine>}

      {loading ? (
        <LoadingLine>Fetching optional features…</LoadingLine>
      ) : (
        <>
          <Toolbar
            filters={<FilterButton activeCount={activeCount} onClick={() => setFiltersOpen(true)} />}
            search={<input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search optional features…" className={searchCls} />}
            right={
              <>
                <span className="text-xs italic text-ink-faded">
                  {filtered.length} of {features.length}
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
            <FilterSection title="Type">
              <ChipToggles options={options.types} selected={types} labelOf={formatFeatureType} onToggle={toggler(setTypes)} />
            </FilterSection>
            <FilterSection title="Class">
              <ChipToggles options={options.classes} selected={classes} labelOf={labelFromId} onToggle={toggler(setClasses)} />
            </FilterSection>
            <FilterSection title="Prerequisite">
              <ChipToggles options={options.prereqs} selected={prereqs} onToggle={toggler(setPrereqs)}
                           labelOf={(k) => (k === "none" ? "None" : PREREQUISITE_LABELS[k] || k)} />
            </FilterSection>
            <FilterSection title="Cost">
              <ChipToggles options={options.costs} selected={costs} onToggle={toggler(setCosts)}
                           labelOf={(k) => (k === NO_COST ? "No cost" : labelFromId(k))} />
            </FilterSection>
            <FilterSection title="Gives" defaultOpen={false}>
              <ChipToggles options={options.gives} selected={gives} labelOf={(k) => GIVES_LABELS[k] || k} onToggle={toggler(setGives)} />
            </FilterSection>
            <FilterSection title="Repeatable" defaultOpen={false}>
              <ChipToggles options={REPEATABLE.map((r) => r.value)} selected={repeatable} onToggle={toggler(setRepeatable)}
                           labelOf={(v) => REPEATABLE.find((r) => r.value === v).label} />
            </FilterSection>
          </FilterPopup>

          {filtered.length === 0 ? (
            <LoadingLine>No optional features match your filters.</LoadingLine>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((f) => (
                <CatalogueRow key={`${f.id}-${f.visibility || ""}`} entry={f} meta={optionalFeatureRowMeta(f)}
                              onOpen={(x) => openPopup("optionalFeature", x)} onContextMenu={openMenu} />
              ))}
            </div>
          )}

          {menu}

          <OptionalFeatureCardForm open={form !== null} onClose={() => setForm(null)}
                                   editingFeature={form?.editing || null} copyFromFeature={form?.copyFrom || null} />
        </>
      )}
    </div>
  );
}
