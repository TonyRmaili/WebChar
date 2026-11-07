import React, { useEffect, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { Hint, PickerRow, PickerShell, Tag, chipBtn } from "../../../styles/parchmentForm";

/* Pick something from a catalogue to add to a statblock: feats, optional
   features, items or spells. Click a name to read its card; "add" puts it
   on the statblock. */

const asList = (v) => (Array.isArray(v) ? v : []);
const MAX_ROWS = 80;
const ORD = ["Cantrip", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
const words = (s) => String(s || "").replace(/_/g, " ");

// What each kind reads from the catalogue store, and how a row is labelled.
const KINDS = {
  feat: {
    title: "Add a feat",
    popup: "feat",
    select: (s) => s.featsData?.feats,
    loader: "loadFeats",
    tag: (e) => (e.category ? words(e.category) : "classic"),
    // Feats have no edition key; One D&D feats are the ones with a category.
    edition: (e) => (e.category ? "one" : "classic"),
  },
  optionalFeature: {
    title: "Add an optional feature",
    popup: "optionalFeature",
    select: (s) => s.optionalFeaturesData?.features,
    loader: "loadOptionalFeatures",
    tag: (e) => words(e.feature_type),
  },
  item: {
    title: "Add an item",
    popup: "item",
    select: (s) => s.items,
    loader: "loadItems",
    tag: (e) => (e.rarity && e.rarity !== "none" ? e.rarity : asList(e.types)[0] || ""),
  },
  spell: {
    title: "Add a spell",
    popup: "spell",
    select: (s) => s.spellsData?.spells,
    loader: "loadSpells",
    tag: (e) => ORD[Number(e.level) || 0] || "",
  },
};

const EDITIONS = [
  { id: "one", label: "One D&D" },
  { id: "classic", label: "Classic" },
];

export default function CataloguePicker({ kind, has, onAdd, onView, onClose }) {
  const cfg = KINDS[kind];
  // Select the stored array itself (a new [] here would re-render forever).
  const all = asList(useCatalogueStore(cfg.select));
  const load = useCatalogueStore((s) => s[cfg.loader]);
  const [query, setQuery] = useState("");
  const [editions, setEditions] = useState(["one"]);

  useEffect(() => {
    if (!all.length) load?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const q = query.trim().toLowerCase();
  const pool = all.filter((e) => e?.name && (!cfg.edition || editions.includes(cfg.edition(e))));
  const rows = pool
    .filter((e) => !q || e.name.toLowerCase().includes(q) || String(e.source || "").toLowerCase().includes(q) || cfg.tag(e).toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name) || String(a.source).localeCompare(String(b.source)));

  const toggleEdition = (id) => {
    const next = editions.includes(id) ? editions.filter((v) => v !== id) : [...editions, id];
    if (next.length) setEditions(next); // never zero
  };

  return (
    <PickerShell
      title={cfg.title}
      query={query}
      onQuery={setQuery}
      placeholder="search by name, book or type…"
      onClose={onClose}
      filters={
        cfg.edition &&
        EDITIONS.map((e) => (
          <button key={e.id} type="button" onClick={() => toggleEdition(e.id)} className={chipBtn(editions.includes(e.id))}>
            {e.label}
          </button>
        ))
      }
      footer={`${rows.length > MAX_ROWS ? `first ${MAX_ROWS} of ${rows.length} — type to narrow` : `${rows.length} of ${pool.length}`} · click a name to read it`}
    >
      {rows.length === 0 && <Hint className="py-2">{all.length ? "Nothing matches." : "Fetching the catalogue…"}</Hint>}
      {rows.slice(0, MAX_ROWS).map((entry) => {
        const taken = has(entry);
        return (
          <PickerRow
            key={`${entry.name}__${entry.source}__${entry.feature_type || ""}`}
            name={entry.name}
            onOpen={() => onView(cfg.popup, entry)}
            meta={<Tag>{cfg.tag(entry)}</Tag>}
            source={entry.source}
            highlight={taken}
            action={{ label: taken ? (kind === "item" ? "add another" : "added") : "add", disabled: taken && kind !== "item", onClick: () => onAdd(entry) }}
          />
        );
      })}
    </PickerShell>
  );
}