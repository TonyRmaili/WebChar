import React, { useEffect, useState } from "react";
import { useCatalogueStore } from "../../../../store/CatalogueStore";
import { Hint, PickerRow, PickerShell, Tag, chipBtn } from "../../../../styles/parchmentForm";
import { asList, labelOf } from "../sheetHelpers";

/* Optional features from the catalogue (invocations, metamagic, maneuvers,
   fighting styles…), filtered to some kinds: the Spellbook's and the
   Feats & Options tab's "+ from the catalogue". types: [{ id, label }]. */

const MAX_ROWS = 80;
const EDITIONS = [
  { id: "one", label: "One D&D" },
  { id: "classic", label: "Classic" },
];

export default function OptionPicker({ title, types, have, onAdd, onView, onClose }) {
  const list = useCatalogueStore((s) => s.optionalFeatures);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(types.map((t) => t.id));
  const [editions, setEditions] = useState(["one"]);

  useEffect(() => {
    const store = useCatalogueStore.getState();
    if (!asList(store.optionalFeatures).length && !store.loadingOptionalFeatures) store.loadOptionalFeatures();
  }, []);

  const q = query.trim().toLowerCase();
  const all = asList(list).filter((o) => o?.name && asList(o.feature_types).some((t) => picked.includes(t)) && editions.includes(o.edition === "classic" ? "classic" : "one"));
  const rows = all.filter((o) => !q || o.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  const toggle = (setter) => (id) => setter((cur) => (cur.includes(id) ? (cur.length > 1 ? cur.filter((x) => x !== id) : cur) : [...cur, id]));

  return (
    <PickerShell
      title={title}
      query={query}
      onQuery={setQuery}
      onClose={onClose}
      filters={
        <>
          {EDITIONS.map((e) => (
            <button key={e.id} type="button" onClick={() => toggle(setEditions)(e.id)} className={chipBtn(editions.includes(e.id))}>
              {e.label}
            </button>
          ))}
          {types.map((t) => (
            <button key={t.id} type="button" onClick={() => toggle(setPicked)(t.id)} className={chipBtn(picked.includes(t.id))}>
              {t.label}
            </button>
          ))}
        </>
      }
      footer={`${rows.length > MAX_ROWS ? `first ${MAX_ROWS} of ${rows.length} — type to narrow` : `${rows.length} of ${all.length}`} · click a name to view its card`}
    >
      {rows.length === 0 && <Hint className="py-2">{all.length ? "Nothing matches." : "Fetching the catalogue…"}</Hint>}
      {rows.slice(0, MAX_ROWS).map((o) => {
        const got = have.has(o.id);
        return (
          <PickerRow
            key={`${o.id}-${o.visibility || ""}`}
            name={o.name}
            onOpen={() => onView(o)}
            meta={<Tag>{labelOf(asList(o.feature_types)[0] || "")}</Tag>}
            source={o.source}
            highlight={got}
            action={{ label: got ? "added" : "add", disabled: got, onClick: () => onAdd(o) }}
          />
        );
      })}
    </PickerShell>
  );
}
