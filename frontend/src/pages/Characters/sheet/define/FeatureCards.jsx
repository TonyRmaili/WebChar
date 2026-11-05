import React, { useState } from "react";
import { INK, InkRemove } from "../../../../styles/parchment";
import { DefineSection, Hint, PickerRow, PickerShell, addBtn } from "../../../../styles/parchmentForm";
import { formatConsumes } from "../../../Catalogues/OptionalFeatures/optionalFeatureHelpers";

/* Optional features kept in the spellbook (metamagic, invocations).
   Stored rows are only a reference { id, name, source }; the full entry is
   looked up in the catalogue for the popup and the cost/requirement line. */

const asList = (v) => (Array.isArray(v) ? v : []);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

export const featureKey = (f) => `${f.name}|${f.source}`;

/* ---------- labels ----------
   Both are shown only when the data has them: metamagic has a cost and
   no prerequisite, invocations the reverse. */

function prerequisitePart(pre) {
  if (!pre || typeof pre !== "object") return [];
  const parts = [];

  for (const [key, value] of Object.entries(pre)) {
    if (key === "level") {
      if (typeof value === "number") parts.push(`Level ${value}`);
      else if (value?.class) parts.push(`${value.class} ${value.value ?? ""}`.trim());
      else if (value?.value != null) parts.push(`Level ${value.value}`);
      continue;
    }
    if (Array.isArray(value)) {
      value
        .map((v) => (typeof v === "string" ? v : v?.name ?? ""))
        .filter(Boolean)
        .forEach((v) => parts.push(v));
      continue;
    }
    if (typeof value === "string") parts.push(value);
    else if (typeof value === "number") parts.push(`${cap(key)} ${value}`);
  }

  return parts;
}

// The data may hold one prerequisite object or a list of alternatives.
export function prerequisiteLabel(pre) {
  if (Array.isArray(pre)) {
    return pre
      .map((p) => prerequisitePart(p).join(" · "))
      .filter(Boolean)
      .join(" or ");
  }
  return prerequisitePart(pre).join(" · ");
}

// Handles both shapes of `consumes` (object from the catalogue, string from homebrew).
export const costLabel = formatConsumes;

function Meta({ entry }) {
  const cost = costLabel(entry?.consumes);
  const pre = prerequisiteLabel(entry?.prerequisite);
  if (!cost && !pre) return null;
  return (
    <span className="shrink-0 text-xs italic">
      {cost && <span className={INK.rubric}>{cost}</span>}
      {cost && pre && <span className={INK.faint}> · </span>}
      {pre && <span className={INK.faded}>requires {pre}</span>}
    </span>
  );
}

/* ---------- picker ---------- */

function FeaturePicker({ entries, knownKeys, onOpen, onAdd, onClose, label }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const rows = asList(entries)
    .filter((e) => !q || e.name.toLowerCase().includes(q) || String(e.source || "").toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name) || String(a.source).localeCompare(String(b.source)));

  return (
    <PickerShell title={`Add ${label}`} query={query} onQuery={setQuery} placeholder={`search ${label} by name or source…`} onClose={onClose} footer={`${rows.length} of ${asList(entries).length} · click a name to view its card`}>
      {rows.length === 0 && <Hint className="py-2">Nothing matches.</Hint>}
      {rows.map((entry) => {
        const known = knownKeys.has(featureKey(entry));
        return (
          <PickerRow
            key={featureKey(entry)}
            name={entry.name}
            onOpen={() => onOpen(entry)}
            meta={<span className="hidden @lg:inline">{<Meta entry={entry} />}</span>}
            source={entry.source}
            highlight={known}
            action={{ label: known ? "added" : "add", disabled: known, onClick: () => onAdd(entry) }}
          />
        );
      })}
    </PickerShell>
  );
}

/* ---------- list section ---------- */

export function FeatureListCard({ title, label, storageKey, catalogue, list, onAdd, onRemove, onOpen }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const knownKeys = new Set(asList(list).map(featureKey));
  const entryFor = (row) => asList(catalogue).find((c) => c.name === row.name && c.source === row.source) ?? row;
  const rows = [...asList(list)].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <DefineSection
      title={title}
      count={rows.length}
      storageKey={storageKey}
      actions={(setOpen) => (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setPickerOpen((open) => !open);
          }}
          className={addBtn}
        >
          {pickerOpen ? "close the catalogue" : "+ from the catalogue"}
        </button>
      )}
    >
      {pickerOpen && (
        <FeaturePicker
          entries={catalogue}
          knownKeys={knownKeys}
          onOpen={onOpen}
          onAdd={onAdd}
          onClose={() => setPickerOpen(false)}
          label={label}
        />
      )}

      {rows.length === 0 ? (
        <Hint>No {label} yet.</Hint>
      ) : (
        <div className="grid grid-cols-1 gap-x-10 @4xl:grid-cols-2">
          {rows.map((row) => {
            const entry = entryFor(row);
            return (
              <div key={row.id} className="group flex items-baseline gap-1.5 py-1">
                <button type="button" onClick={() => onOpen(entry)} className="truncate text-left text-[15px] hover:underline hover:decoration-dotted hover:underline-offset-4" title="Open its card">
                  {row.name}
                </button>
                <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`}>{row.source}</span>
                <span aria-hidden="true" className="mx-1 min-w-[0.75rem] flex-1 translate-y-[-4px] border-b-2 border-dotted border-[#7b6346]/35" />
                <Meta entry={entry} />
                <span className="opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  <InkRemove onClick={() => onRemove(row.id)} label={`Remove ${row.name}`} />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </DefineSection>
  );
}