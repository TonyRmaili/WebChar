import React, { useEffect, useMemo, useState } from "react";
import useStoredState from "../../../utils/useStoredState";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import { ErrorLine, LoadingLine, Toolbar, searchCls } from "../catalogueStyle";
import { CatalogueRow, ChipToggles, useEntryMenu } from "../catalogueParts";
import { addBtn } from "../../../styles/parchmentForm";
import { HOMEBREW, EDITIONS, formatEdition, formatSource, collectUnique, toggleIn, matchesQuery, passesAny, byName, titleCase } from "../catalogueHelpers";
import ReferenceCardForm from "./ReferenceCardForm";
import { KINDS, REFERENCE_CATALOGUES, filterValues, kindLabel, kindsOf, rowMeta } from "./referenceHelpers";

/* One page for each text-only catalogue (Rules, Lore, Toolkit): a
   filterable list; a click opens the card, a right-click copies (and, for
   your own homebrew, edits or deletes). `catalogue`: "rules" | "lore" |
   "toolkit".

   Filters: edition, source, type (action, deity, trap…), then each type's
   own filters (a deity's pantheon, a trap's tier…), offering only the
   values the loaded entries have. A type's own filter keeps only entries
   of that type. All filters are remembered in this browser. */
export default function ReferencePage({ catalogue }) {
  const meta = REFERENCE_CATALOGUES[catalogue];
  const List = meta.store;
  const entries = useCatalogueStore((s) => s[catalogue]);
  const loading = useCatalogueStore((s) => s[`loading${List}`]);
  const error = useCatalogueStore((s) => s[`${catalogue}Error`]);
  const load = useCatalogueStore((s) => s[`load${List}`]);
  const remove = useCatalogueStore((s) => s[`delete${List}`]);

  const openPopup = usePopupStore((s) => s.open);
  const currentUser = useAuthStore((s) => s.userData?.name);

  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editions, setEditions] = useStoredState(`catalogue.${catalogue}.editions`, ["one"]);
  const [sources, setSources] = useStoredState(`catalogue.${catalogue}.sources`, []);
  const [kinds, setKinds] = useStoredState(`catalogue.${catalogue}.kinds`, []);
  // the types' own filters: { "<kind>.<field>": [values] }
  const [fieldFilters, setFieldFilters] = useStoredState(`catalogue.${catalogue}.fields`, {});

  const [form, setForm] = useState(null); // null = closed · {} new · { editing } · { copyFrom }
  const [openMenu, menu] = useEntryMenu({
    user: currentUser,
    onCopy: (e) => setForm({ copyFrom: e }),
    onEdit: (e) => setForm({ editing: e }),
    onDelete: remove,
  });

  useEffect(() => {
    if (!entries?.length) load();
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = entries || [];
  const sourceOptions = useMemo(() => {
    const found = collectUnique(list, "source");
    return found.includes(HOMEBREW) ? found : [HOMEBREW, ...found];
  }, [list]);
  const kindOptions = useMemo(() => kindsOf(catalogue).filter((k) => list.some((e) => e.kind === k)), [catalogue, list]);

  // Each type's filterable fields, with the values its entries have: [{ id, kind, field, options }]
  const fieldSections = useMemo(
    () =>
      kindOptions.flatMap((kind) =>
        KINDS[kind].fields
          .filter((f) => f.filter)
          .map((f) => {
            const values = collectUnique(list.filter((e) => e.kind === kind), (e) => filterValues(e, f.key));
            const options = f.type === "number" || f.key === "tiers" ? values.sort((a, b) => Number(a) - Number(b)) : values;
            return { id: `${kind}.${f.key}`, kind, field: f, options };
          })
          .filter((s) => s.options.length > 1)
      ),
    [kindOptions, list]
  );

  const filtered = useMemo(
    () =>
      list
        .filter((e) => {
          if (!passesAny(editions, [e.edition]) || !passesAny(sources, [e.source]) || !passesAny(kinds, [e.kind])) return false;
          for (const s of fieldSections) {
            const picked = fieldFilters[s.id] || [];
            if (!picked.length) continue;
            // a type's own filter keeps only entries of that type (a "hide" one leaves the others alone)
            if (e.kind !== s.kind) {
              if (picked.every((p) => String(p).startsWith("!"))) continue;
              return false;
            }
            if (!passesAny(picked, filterValues(e, s.field.key))) return false;
          }
          return matchesQuery(e, query);
        })
        .sort(byName),
    [list, editions, sources, kinds, fieldSections, fieldFilters, query]
  );

  const fieldCount = Object.values(fieldFilters).reduce((n, l) => n + (l?.length || 0), 0);
  const activeCount = editions.length + sources.length + kinds.length + fieldCount;
  const clearAll = () => {
    setEditions([]);
    setSources([]);
    setKinds([]);
    setFieldFilters({});
    setQuery("");
  };
  const toggler = (setter) => (v) => setter((l) => toggleIn(l, v));
  const toggleField = (id) => (v) => setFieldFilters((all) => ({ ...all, [id]: toggleIn(all[id] || [], v) }));

  return (
    <div className="min-h-[640px] w-full">
      {error && <ErrorLine>{error}</ErrorLine>}

      {loading && !list.length ? (
        <LoadingLine>Fetching {meta.label.toLowerCase()}…</LoadingLine>
      ) : (
        <>
          <Toolbar
            filters={<FilterButton activeCount={activeCount} onClick={() => setFiltersOpen(true)} />}
            search={<input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={meta.search} className={searchCls} />}
            right={
              <>
                <span className="text-xs italic text-ink-faded">
                  {filtered.length} of {list.length}
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
            <FilterSection title="Type">
              <ChipToggles options={kindOptions} selected={kinds} labelOf={kindLabel} onToggle={toggler(setKinds)} />
            </FilterSection>
            <FilterSection title="Sources" defaultOpen={false}>
              <ChipToggles options={sourceOptions} selected={sources} labelOf={formatSource} onToggle={toggler(setSources)}
                           className="!grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
            </FilterSection>
            {fieldSections.map((s) => (
              <FilterSection key={s.id} title={`${kindLabel(s.kind)}: ${s.field.label}`} defaultOpen={false}>
                <ChipToggles options={s.options} selected={fieldFilters[s.id] || []} onToggle={toggleField(s.id)}
                             labelOf={(v) => (s.field.key === "tiers" ? `Tier ${v}` : s.field.key === "level" ? `Level ${v}` : titleCase(String(v)))}
                             className={s.options.length > 12 ? "!grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : ""} />
              </FilterSection>
            ))}
          </FilterPopup>

          {filtered.length === 0 ? (
            <LoadingLine>Nothing matches your filters.</LoadingLine>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((e) => (
                <CatalogueRow key={`${e.id}-${e.visibility || ""}`} entry={e} meta={rowMeta(e)}
                              onOpen={(x) => openPopup("reference", x)} onContextMenu={openMenu} />
              ))}
            </div>
          )}

          {menu}

          <ReferenceCardForm catalogue={catalogue} open={form !== null} onClose={() => setForm(null)}
                             editingEntry={form?.editing || null} copyFromEntry={form?.copyFrom || null} />
        </>
      )}
    </div>
  );
}
