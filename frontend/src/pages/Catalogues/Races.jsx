import React, { useEffect, useMemo, useState } from "react";
import { useDnDStore } from "../../store/DndStore";
import RaceRow from "./RaceRow";
import RacePopupLayer, { useRacePopups } from "./RacePopupManager";
import { collectUnique, cap, SIZE_LABELS } from "./raceHelpers";

const SIZE_ORDER = ["tiny", "small", "medium", "large"];

export default function Races() {
  const races = useDnDStore((s) => s.races);
  const loading = useDnDStore((s) => s.loadingRaces);
  const error = useDnDStore((s) => s.error);
  const loadRaces = useDnDStore((s) => s.loadRaces);

  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [creatureType, setCreatureType] = useState("");
  const [size, setSize] = useState("");

  const popups = useRacePopups();

  useEffect(() => { loadRaces(); }, [loadRaces]);

  // Derived option lists
  const sources = useMemo(() => collectUnique(races, "source"), [races]);
  const creatureTypes = useMemo(() => collectUnique(races, "creature_type"), [races]);
  const sizes = useMemo(() => {
    const present = collectUnique(races, "sizes");
    return SIZE_ORDER.filter((s) => present.includes(s));
  }, [races]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (races || []).filter((r) => {
      if (q) {
        const subNames = (r.sub_races || [])
          .map((sr) => sr.display_name || sr.name)
          .filter(Boolean).join(" ");
        const hay = [r?.name, r?.creature_type, r?.source, subNames]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (source && r.source !== source) return false;
      if (creatureType && r.creature_type !== creatureType) return false;
      if (size && !(r.sizes || []).includes(size)) return false;
      return true;
    });
  }, [races, query, source, creatureType, size]);

  const clearFilters = () => {
    setQuery(""); setSource(""); setCreatureType(""); setSize("");
  };

  const anyFilter = query || source || creatureType || size;

  return (
    <div className="w-full bg-slate-900/40 border border-slate-700 rounded-lg p-4 min-h-[640px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div>
          <h3 className="text-amber-400 text-xl font-semibold">Races</h3>
          <p className="text-xs text-slate-400">
            {loading
              ? "Loading…"
              : `${filtered.length} of ${races.length} race${races.length === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="relative w-full sm:max-w-sm">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search races…"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm
                       focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
        <Select label="Source" value={source} onChange={setSource} options={sources} />
        <Select
          label="Creature Type"
          value={creatureType}
          onChange={setCreatureType}
          options={creatureTypes}
          renderOption={cap}
        />
        <Select
          label="Size"
          value={size}
          onChange={setSize}
          options={sizes}
          renderOption={(s) => SIZE_LABELS[s] || cap(s)}
        />
      </div>

      {anyFilter && (
        <button
          onClick={clearFilters}
          className="mb-3 text-xs text-amber-400 hover:text-amber-300 underline"
        >
          Clear filters
        </button>
      )}

      {error && (
        <div className="mb-3 p-2 rounded border border-red-700 bg-red-900/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Rows */}
      {!loading && filtered.length === 0 && !error ? (
        <div className="px-3 py-8 text-center text-sm text-slate-500">
          No races match your filters.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {filtered.map((r, idx) => (
            <RaceRow
              key={`${r?.name}-${r?.source}-${idx}`}
              race={r}
              onOpen={popups.openRace}
            />
          ))}
        </div>
      )}

      {/* Popups */}
      <RacePopupLayer
        popups={popups.openPopups}
        minimized={popups.minimized}
        onClose={popups.close}
        onMinimize={popups.minimize}
        onRestore={popups.restore}
        onFocus={popups.focus}
        onMove={popups.move}
        onResize={popups.resize}
      />
    </div>
  );
}

function Select({ label, value, onChange, options, renderOption = (x) => x }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-slate-100 text-sm
                   focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition"
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o} value={o}>{renderOption(o)}</option>
        ))}
      </select>
    </label>
  );
}