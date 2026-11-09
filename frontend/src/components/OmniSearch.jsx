import React, { useMemo, useRef, useState, useEffect } from "react";
import { useCatalogueStore } from "../store/CatalogueStore";
import { usePopupStore } from "../store/PopupStore";

/* label + ink colour per catalogue type (theme slots) */
const CATALOGUES = {
  spell:           { label: "Spell",      badge: "text-magic" },
  item:            { label: "Item",       badge: "text-warn" },
  race:            { label: "Race",       badge: "text-good" },
  feat:            { label: "Feat",       badge: "text-info" },
  background:      { label: "Background", badge: "text-rubric" },
  optionalFeature: { label: "Optional",   badge: "text-ink-faded" },
  monster:         { label: "Monster",    badge: "text-bad" },
};

// The results card: parchment with a thin leather edge, like the right-click menus.
const CARD_EDGE = "0 0 0 1px rgb(var(--c-desk) / 0.55), 0 12px 32px rgba(0,0,0,0.55)";

const MAX_RESULTS = 10;

export default function OmniSearch() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const loadedRef = useRef(false);

  const open = usePopupStore((s) => s.open);

  /* ---- data slices ---- */
  const items            = useCatalogueStore((s) => s.items);
  const races            = useCatalogueStore((s) => s.races);
  const feats            = useCatalogueStore((s) => s.featsData?.feats);
  const backgrounds      = useCatalogueStore((s) => s.backgroundsData?.backgrounds);
  const spells           = useCatalogueStore((s) => s.spellsData?.spells);
  const optionalFeatures = useCatalogueStore((s) => s.optionalFeaturesData?.features);
  const monstersData     = useCatalogueStore((s) => s.monstersData);

  /* ---- loaders (lazy, on first focus) ---- */
  const loadItems            = useCatalogueStore((s) => s.loadItems);
  const loadRaces            = useCatalogueStore((s) => s.loadRaces);
  const loadFeats            = useCatalogueStore((s) => s.loadFeats);
  const loadBackgrounds      = useCatalogueStore((s) => s.loadBackgrounds);
  const loadSpells           = useCatalogueStore((s) => s.loadSpells);
  const loadOptionalFeatures = useCatalogueStore((s) => s.loadOptionalFeatures);
  const loadMonsters         = useCatalogueStore((s) => s.loadMonsters);

  const ensureLoaded = () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadSpells(); loadItems(); loadRaces(); loadFeats();
    loadBackgrounds(); loadOptionalFeatures(); loadMonsters();
  };

  /* ---- flat search index across all catalogues ---- */
  const index = useMemo(() => {
    const out = [];
    const push = (type, arr) =>
      (Array.isArray(arr) ? arr : []).forEach((d) => {
        if (d && d.name) out.push({ type, name: d.name, source: d.source, data: d });
      });

    push("spell", spells);
    push("item", items);
    push("race", races);
    push("feat", feats);
    push("background", backgrounds);
    push("optionalFeature", optionalFeatures);

    const root = monstersData?.monsters;
    if (root && typeof root === "object") {
      for (const list of Object.values(root)) push("monster", list);
    }
    return out;
  }, [spells, items, races, feats, backgrounds, optionalFeatures, monstersData]);

  /* ---- filter + rank (prefix matches first), capped ---- */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored = [];
    for (const e of index) {
      const pos = e.name.toLowerCase().indexOf(q);
      if (pos === -1) continue;
      scored.push({ ...e, rank: pos === 0 ? 0 : 1 });
      if (scored.length > 200) break; // cheap guard for huge catalogues
    }
    scored.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
    return scored.slice(0, MAX_RESULTS);
  }, [index, query]);

  useEffect(() => setActive(0), [query]);

  const select = (entry) => {
    if (!entry) return;
    open(entry.type, entry.data); // store handles restore/focus/new + right-click minimize
    setQuery("");
    setActive(0);
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + results.length) % results.length); }
    else if (e.key === "Enter") { e.preventDefault(); select(results[active]); }
    else if (e.key === "Escape") { setQuery(""); inputRef.current?.blur(); }
  };

  const showDropdown = focused && query.trim().length > 0;

  return (
    <div className="relative ml-auto w-80">
      {/* results — open UPWARD so they're visible above the footer.
          Kept inside this element (a footer descendant) so hovering them
          doesn't trigger the footer's onMouseLeave. */}
      {showDropdown && (
        <div className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-[3px] bg-page font-body text-ink" style={{ boxShadow: CARD_EDGE }}>
          {results.length === 0 ? (
            <div className="px-3 py-2 text-sm italic text-ink-faded">No matches</div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((r, i) => {
                const cat = CATALOGUES[r.type];
                return (
                  <li key={`${r.type}-${r.name}-${r.source}-${i}`}>
                    <button
                      type="button"
                      // mouseDown (not click) + preventDefault keeps the input
                      // focused so the dropdown doesn't close before we open.
                      onMouseDown={(e) => { e.preventDefault(); select(r); }}
                      onMouseEnter={() => setActive(i)}
                      className={`flex w-full items-baseline gap-3 px-3 py-1.5 text-left transition-colors ${
                        i === active ? "bg-ink/[0.08]" : "hover:bg-ink/[0.05]"
                      }`}
                    >
                      <span className={`w-[4.5rem] shrink-0 text-[10px] font-semibold uppercase tracking-wider ${cat?.badge || "text-ink-faded"}`}>
                        {cat?.label || r.type}
                      </span>
                      <span className={`min-w-0 flex-1 truncate text-[15px] ${i === active ? "text-rubric" : ""}`}>{r.name}</span>
                      {r.source && (
                        <span className="shrink-0 text-[10px] uppercase tracking-wider text-ink-faded">{r.source}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* search icon */}
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-desk-ink-faded">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
      </span>

      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { setFocused(true); ensureLoaded(); }}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        placeholder="Omni-Search"
        className="w-full rounded-full border border-stitch/40 bg-desk-deep/60 py-1.5 pl-9 pr-3 font-body text-sm text-desk-ink placeholder:text-desk-ink-faded focus:border-desk-accent focus:outline-none"
      />
    </div>
  );
}