import React, { useMemo, useState } from "react";
import { INK, InkButton, InkRemove, InkSelect, Leader } from "../../../styles/parchment";
import { addBtn } from "../../../styles/parchmentForm";
import CatalogueMonsterPicker from "../../Catalogues/Monsters/CatalogueMonsterPicker";
import { CR_OPTIONS, crToNumber, formatCR, getMonsterMovements, getMonsterType, titleCase } from "../../Catalogues/Monsters/monsterHelpers";
import { SIZES } from "../statblock/monsterStatblock";
import CombatSection from "./CombatSection";

/* Campaign › Combat › Monster shelf — catalogue monsters the DM keeps
   ready (tweaked if they like) to drop into encounters. Shelf entries
   never fight; encounters get their own copies.

   A compact list (no tokens), filtered by CR, size, movement, type and
   environment. Click a name for its statblock card, ✕ takes it off the
   shelf straight away, right-click for more.

   `shelf` is the campaign's monster copies ({ file, data }). */

const ANY = "";
const asList = (v) => (Array.isArray(v) ? v : []);
const sizeName = (s) => SIZES.find((x) => x.value === s)?.label || s;
const crOf = (m) => (m?.cr?.base != null ? crToNumber(m.cr.base) : m?.cr?.level ?? null);
const sortedUnique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));

const NO_FILTERS = { crMin: ANY, crMax: ANY, size: ANY, movement: ANY, type: ANY, environment: ANY };

function Filter({ label, value, onChange, options }) {
  return (
    <label className={`flex items-baseline gap-1.5 text-xs italic ${value ? INK.rubric : INK.faded}`}>
      {label}
      <InkSelect value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-6 text-sm">
        <option value={ANY}>any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </InkSelect>
    </label>
  );
}

export default function MonsterShelf({ shelf, loading, onAdd, onOpen, onRemove, onMenu }) {
  const [picking, setPicking] = useState(false);
  const [filters, setFilters] = useState(NO_FILTERS);
  const setFilter = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));
  const filtering = Object.values(filters).some(Boolean);

  // Only what's on the shelf can be chosen.
  const options = useMemo(() => {
    const data = shelf.map((e) => e.data);
    const crs = CR_OPTIONS.filter((c) => data.some((m) => m?.cr?.base != null && String(m.cr.base) === c));
    return {
      cr: crs.map((c) => ({ value: c, label: c })),
      size: sortedUnique(data.flatMap((m) => asList(m?.size))).map((s) => ({ value: s, label: sizeName(s) })),
      movement: sortedUnique(data.flatMap((m) => getMonsterMovements(m))).map((s) => ({ value: s, label: s })),
      type: sortedUnique(data.map((m) => getMonsterType(m))).map((t) => ({ value: t, label: titleCase(t) })),
      environment: sortedUnique(data.flatMap((m) => asList(m?.environment))).map((e) => ({ value: e, label: titleCase(e) })),
    };
  }, [shelf]);

  const shown = useMemo(() => {
    const min = filters.crMin === ANY ? null : crToNumber(filters.crMin);
    const max = filters.crMax === ANY ? null : crToNumber(filters.crMax);
    return shelf
      .filter(({ data: m }) => {
        const cr = crOf(m);
        if (min != null && (cr == null || cr < min)) return false;
        if (max != null && (cr == null || cr > max)) return false;
        if (filters.size && !asList(m?.size).includes(filters.size)) return false;
        if (filters.movement && !getMonsterMovements(m).includes(filters.movement)) return false;
        if (filters.type && getMonsterType(m) !== filters.type) return false;
        if (filters.environment && !asList(m?.environment).includes(filters.environment)) return false;
        return true;
      })
      .sort((a, b) => String(a.data?.name).localeCompare(String(b.data?.name)));
  }, [shelf, filters]);

  // Already on the shelf? (by the catalogue entry it came from)
  const onShelf = (m) => shelf.some((e) => e.data?.catalogue?.name === m.name && e.data?.catalogue?.source === m.source);

  return (
    <CombatSection
      id="shelf"
      title="Monster shelf"
      summary={shelf.length ? `${shelf.length}` : undefined}
      right={
        <button type="button" onClick={() => setPicking((p) => !p)} className={addBtn}>
          {picking ? "close the bestiary" : "+ add from the bestiary"}
        </button>
      }
    >

      {picking && (
        <div className="mb-5 mt-2">
          <CatalogueMonsterPicker title="Put on the shelf" oneAtATime has={onShelf} onAdd={onAdd} onClose={() => setPicking(false)} />
        </div>
      )}

      {shelf.length === 0 ? (
        !picking && (
          <p className={`py-4 italic ${INK.faint}`}>
            {loading ? "Fetching…" : "Empty. Keep the monsters you use often here — tweak them if you like — and add them to encounters in a click."}
          </p>
        )
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <span className={`flex items-baseline gap-1.5 text-xs italic ${filters.crMin || filters.crMax ? INK.rubric : INK.faded}`}>
              CR
              <InkSelect value={filters.crMin} onChange={(e) => setFilter("crMin")(e.target.value)} aria-label="Lowest CR" className="h-6 text-sm">
                <option value={ANY}>any</option>
                {options.cr.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </InkSelect>
              to
              <InkSelect value={filters.crMax} onChange={(e) => setFilter("crMax")(e.target.value)} aria-label="Highest CR" className="h-6 text-sm">
                <option value={ANY}>any</option>
                {options.cr.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </InkSelect>
            </span>
            <Filter label="size" value={filters.size} onChange={setFilter("size")} options={options.size} />
            <Filter label="moves" value={filters.movement} onChange={setFilter("movement")} options={options.movement} />
            <Filter label="type" value={filters.type} onChange={setFilter("type")} options={options.type} />
            <Filter label="environment" value={filters.environment} onChange={setFilter("environment")} options={options.environment} />
            {filtering && <InkButton onClick={() => setFilters(NO_FILTERS)}>clear</InkButton>}
            <span className={`ml-auto text-xs italic ${INK.faint}`}>
              {filtering ? `${shown.length} of ${shelf.length} shown` : `${shelf.length} on the shelf`} · click to open · right-click for more
            </span>
          </div>

          {shown.length === 0 ? (
            <p className={`py-2 text-sm italic ${INK.faint}`}>Nothing on the shelf matches.</p>
          ) : (
            <div className="grid grid-cols-1 gap-x-10 @2xl:grid-cols-2 @5xl:grid-cols-3">
              {shown.map((entry) => (
                <div
                  key={entry.file}
                  className="flex items-baseline gap-2 py-[3px] text-[15px]"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onMenu({ x: e.clientX, y: e.clientY, entry, kind: "monster" });
                  }}
                >
                  <button type="button" onClick={() => onOpen(entry)} className="truncate text-left hover:underline hover:decoration-dotted hover:underline-offset-4" title="Open its statblock">
                    {entry.data?.name || entry.file}
                  </button>
                  <Leader />
                  <span className={`shrink-0 text-xs italic ${INK.faded}`}>
                    {[formatCR(entry.data?.cr), [asList(entry.data?.size).map(sizeName).join("/"), getMonsterType(entry.data)].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
                  </span>
                  <InkRemove onClick={() => onRemove(entry)} label={`Take ${entry.data?.name || entry.file} off the shelf`} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </CombatSection>
  );
}