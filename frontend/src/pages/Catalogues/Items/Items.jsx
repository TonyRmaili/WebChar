import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";
import ItemCreatePopup from "./ItemCreatePopup";
import { ErrorLine, LoadingLine, Toolbar, chip, searchCls } from "../catalogueStyle";
import { CatalogueRow, ChipToggles, useEntryMenu } from "../catalogueParts";
import { addBtn } from "../../../styles/parchmentForm";
import {
  HOMEBREW, EDITIONS, RARITY_ORDER, formatEdition, formatSource, formatRarity, labelFromId, titleCase,
  collectUnique, toggleIn, matchesQuery, passesAny, byName,
} from "../catalogueHelpers";
import { HAS_LABELS, KINDS, itemHas, itemRowMeta, kindOf } from "./itemHelpers";

/* The Items catalogue: items, magic variants (Flame Tongue, +1 Weapon)
   and groups (Absorbing Tattoo). A group's members are left out of the
   list unless you search, or switch "group members" on; they open from
   the group's card. The filters offer only values the loaded items have. */
export default function Items() {
  const items = useCatalogueStore((s) => s.items);
  const loading = useCatalogueStore((s) => s.loadingItems);
  const error = useCatalogueStore((s) => s.itemsError);
  const loadItems = useCatalogueStore((s) => s.loadItems);
  const deleteItem = useCatalogueStore((s) => s.deleteItem);

  const openPopup = usePopupStore((s) => s.open);
  const currentUser = useAuthStore((s) => s.userData?.name);

  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [editions, setEditions] = useState(["one"]);
  const [sources, setSources] = useState([]);
  const [kinds, setKinds] = useState([]);
  const [rarities, setRarities] = useState([]);
  const [types, setTypes] = useState([]);
  const [tags, setTags] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [has, setHas] = useState([]);
  const [properties, setProperties] = useState([]);
  const [masteries, setMasteries] = useState([]);
  const [damageTypes, setDamageTypes] = useState([]);

  const [form, setForm] = useState(null); // null = closed · {} new · { editing } · { copyFrom }
  const [openMenu, menu] = useEntryMenu({
    user: currentUser,
    onCopy: (it) => setForm({ copyFrom: it }),
    onEdit: (it) => setForm({ editing: it }),
    onDelete: deleteItem,
  });

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // What the filters offer: only values some item has.
  const options = useMemo(() => {
    const found = collectUnique(items, "source");
    const rar = collectUnique(items, "rarity");
    return {
      sources: found.includes(HOMEBREW) ? found : [HOMEBREW, ...found],
      kinds: Object.keys(KINDS).filter((k) => (items || []).some((it) => kindOf(it) === k)),
      rarities: RARITY_ORDER.filter((r) => rar.includes(r)),
      types: collectUnique(items, "item_types"),
      tags: collectUnique(items, "item_tags"),
      tiers: collectUnique(items, "tier"),
      has: Object.keys(HAS_LABELS).filter((k) => (items || []).some((it) => itemHas(it).includes(k))),
      properties: collectUnique(items, (it) => it.weapon?.properties),
      masteries: collectUnique(items, (it) => it.weapon?.mastery),
      damageTypes: collectUnique(items, (it) => it.weapon?.damage?.type),
    };
  }, [items]);

  const filtered = useMemo(
    () =>
      (items || [])
        .filter(
          (it) =>
            (showMembers || query.trim() || !it.group) &&
            passesAny(editions, [it.edition]) &&
            passesAny(sources, [it.source]) &&
            passesAny(kinds, [kindOf(it)]) &&
            passesAny(rarities, [it.rarity]) &&
            passesAny(types, it.item_types) &&
            passesAny(tags, it.item_tags) &&
            passesAny(tiers, [it.tier]) &&
            passesAny(has, itemHas(it)) &&
            passesAny(properties, it.weapon?.properties) &&
            passesAny(masteries, it.weapon?.mastery) &&
            passesAny(damageTypes, [it.weapon?.damage?.type]) &&
            matchesQuery(it, query)
        )
        .sort(byName),
    [items, showMembers, editions, sources, kinds, rarities, types, tags, tiers, has, properties, masteries, damageTypes, query]
  );

  const all = [editions, sources, kinds, rarities, types, tags, tiers, has, properties, masteries, damageTypes];
  const setters = [setEditions, setSources, setKinds, setRarities, setTypes, setTags, setTiers, setHas, setProperties, setMasteries, setDamageTypes];
  const activeCount = all.reduce((n, l) => n + l.length, 0) + (showMembers ? 1 : 0);
  const clearAll = () => {
    setters.forEach((s) => s([]));
    setShowMembers(false);
    setQuery("");
  };
  const toggler = (setter) => (v) => setter((l) => toggleIn(l, v));

  return (
    <div className="min-h-[640px] w-full">
      {error && <ErrorLine>{error}</ErrorLine>}

      {loading ? (
        <LoadingLine>Fetching items…</LoadingLine>
      ) : (
        <>
          <Toolbar
            filters={<FilterButton activeCount={activeCount} onClick={() => setFiltersOpen(true)} />}
            search={<input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search items…" className={searchCls} />}
            right={
              <>
                <span className="text-xs italic text-ink-faded">
                  {filtered.length} of {items.length}
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
            <FilterSection title="Sources" defaultOpen={false}>
              <ChipToggles options={options.sources} selected={sources} labelOf={formatSource} onToggle={toggler(setSources)}
                           className="!grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
            </FilterSection>
            <FilterSection title="Kind">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                <ChipToggles options={options.kinds} selected={kinds} labelOf={(k) => KINDS[k]} onToggle={toggler(setKinds)} />
                <button type="button" onClick={() => setShowMembers((v) => !v)} className={chip(showMembers)}
                        title="A group's items (the ten Absorbing Tattoos) are listed in the group's card; this lists them here too">
                  group members
                </button>
              </div>
            </FilterSection>
            <FilterSection title="Rarity">
              <ChipToggles options={options.rarities} selected={rarities} labelOf={formatRarity} onToggle={toggler(setRarities)} />
            </FilterSection>
            <FilterSection title="Type">
              <ChipToggles options={options.types} selected={types} labelOf={labelFromId} onToggle={toggler(setTypes)} />
            </FilterSection>
            <FilterSection title="Has">
              <ChipToggles options={options.has} selected={has} labelOf={(k) => HAS_LABELS[k]} onToggle={toggler(setHas)} />
            </FilterSection>
            <FilterSection title="Tags" defaultOpen={false}>
              <ChipToggles options={options.tags} selected={tags} labelOf={labelFromId} onToggle={toggler(setTags)} />
            </FilterSection>
            {options.tiers.length > 0 && (
              <FilterSection title="Tier" defaultOpen={false}>
                <ChipToggles options={options.tiers} selected={tiers} labelOf={titleCase} onToggle={toggler(setTiers)} />
              </FilterSection>
            )}
            <FilterSection title="Weapon Properties" defaultOpen={false}>
              <ChipToggles options={options.properties} selected={properties} labelOf={labelFromId} onToggle={toggler(setProperties)} />
            </FilterSection>
            <FilterSection title="Mastery" defaultOpen={false}>
              <ChipToggles options={options.masteries} selected={masteries} labelOf={labelFromId} onToggle={toggler(setMasteries)} />
            </FilterSection>
            <FilterSection title="Damage Type" defaultOpen={false}>
              <ChipToggles options={options.damageTypes} selected={damageTypes} labelOf={labelFromId} onToggle={toggler(setDamageTypes)} />
            </FilterSection>
          </FilterPopup>

          {filtered.length === 0 ? (
            <LoadingLine>No items match your filters.</LoadingLine>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((it) => (
                <CatalogueRow key={`${it.id}-${it.visibility || ""}`} entry={it} meta={itemRowMeta(it)}
                              onOpen={(x) => openPopup("item", x)} onContextMenu={openMenu} />
              ))}
            </div>
          )}

          {menu}

          <ItemCreatePopup open={form !== null} onClose={() => setForm(null)}
                           editingItem={form?.editing || null} copyFromItem={form?.copyFrom || null} />
        </>
      )}
    </div>
  );
}
