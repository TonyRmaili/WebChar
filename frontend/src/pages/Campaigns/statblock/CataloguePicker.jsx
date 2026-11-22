import React, { useEffect, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { Hint, PickerRow, PickerShell, Tag, chipBtn } from "../../../styles/parchmentForm";
import { featRowMeta } from "../../Catalogues/Feats/featsHelpers";
import { itemRowMeta } from "../../Catalogues/Items/itemHelpers";
import { optionalFeatureRowMeta } from "../../Catalogues/OptionalFeatures/optionalFeatureHelpers";
import { spellRowMeta } from "../../Catalogues/Spells/spellHelpers";

/* Pick something from a catalogue to add to a statblock: feats, optional
   features, items or spells. Click a name to read its card; "add" puts it
   on the statblock. */

const asList = (v) => (Array.isArray(v) ? v : []);
const MAX_ROWS = 80;

// What each kind reads from the catalogue store, and how a row is labelled
// (the same short note the catalogue's own list shows).
const KINDS = {
  feat: { title: "Add a feat", popup: "feat", select: (s) => s.feats, loader: "loadFeats", tag: (e) => featRowMeta(e) || "" },
  optionalFeature: {
    title: "Add an optional feature",
    popup: "optionalFeature",
    select: (s) => s.optionalFeatures,
    loader: "loadOptionalFeatures",
    tag: (e) => optionalFeatureRowMeta(e) || "",
  },
  item: { title: "Add an item", popup: "item", select: (s) => s.items, loader: "loadItems", tag: (e) => itemRowMeta(e) || "" },
  spell: { title: "Add a spell", popup: "spell", select: (s) => s.spells, loader: "loadSpells", tag: (e) => spellRowMeta(e) || "" },
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
  // Every catalogue entry has an edition ("one" or "classic").
  const pool = all.filter((e) => e?.name && editions.includes(e.edition || "one"));
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
      filters={EDITIONS.map((e) => (
          <button key={e.id} type="button" onClick={() => toggleEdition(e.id)} className={chipBtn(editions.includes(e.id))}>
            {e.label}
          </button>
        ))}
      footer={`${rows.length > MAX_ROWS ? `first ${MAX_ROWS} of ${rows.length} — type to narrow` : `${rows.length} of ${pool.length}`} · click a name to read it`}
    >
      {rows.length === 0 && <Hint className="py-2">{all.length ? "Nothing matches." : "Fetching the catalogue…"}</Hint>}
      {rows.slice(0, MAX_ROWS).map((entry) => {
        const taken = has(entry);
        return (
          <PickerRow
            key={`${entry.id}__${entry.visibility || ""}`}
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