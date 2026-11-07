import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import { INK } from "../../../styles/parchment";
import { Hint, NumberInput, PickerRow, PickerShell, Tag, addBtn } from "../../../styles/parchmentForm";
import { formatSource } from "./monsterHelpers";
import { allCatalogueMonsters, catalogueMonsterKey, monsterOrigin, monsterSummary } from "./catalogueMonsters";

/* Search the monster catalogue (the official books and your homebrew)
   and add a monster from it. Used by a character's Minions tab and by a
   campaign's NPCs › Monsters; `title` and `addLabel` set the words, and
   `maxCount` caps "how many", and `onAdd(monster, count)` decides where it goes (return true when it
   worked, so the line clears for the next one).

   Click a name to read its statblock, "pick" it, choose how many and
   add. The list stays open so several can be added. Parchment style. */

const MAX_RESULTS = 60;

export default function CatalogueMonsterPicker({ onAdd, onClose, title = "Add a monster", addLabel = "add", maxCount = 99 }) {
  const monstersData = useCatalogueStore((s) => s.monstersData);
  const loading = useCatalogueStore((s) => s.loadingMonsters);
  const loadMonsters = useCatalogueStore((s) => s.loadMonsters);
  const openPopup = usePopupStore((s) => s.open);

  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(null);
  const [count, setCount] = useState(1);
  const [adding, setAdding] = useState(false);

  // The catalogue is large, so it's only fetched when first needed.
  useEffect(() => {
    if (!monstersData?.monsters && !loading) loadMonsters();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const all = useMemo(() => allCatalogueMonsters(monstersData), [monstersData]);

  // Names starting with the search come first, then names containing it.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const starts = [];
    const contains = [];
    for (const m of all) {
      const name = String(m?.name || "").toLowerCase();
      const pos = name.indexOf(q);
      if (pos === 0) starts.push(m);
      else if (pos > 0) contains.push(m);
    }
    const byName = (a, b) => a.name.localeCompare(b.name) || monsterOrigin(a).localeCompare(monsterOrigin(b));
    return [...starts.sort(byName), ...contains.sort(byName)].slice(0, MAX_RESULTS);
  }, [all, query]);

  const handleAdd = async () => {
    if (!picked || adding) return;
    setAdding(true);
    const ok = await onAdd(picked, count);
    setAdding(false);
    if (ok) {
      setPicked(null);
      setCount(1);
    }
  };

  return (
    <div className="space-y-3">
      <PickerShell title={title} query={query} onQuery={setQuery} placeholder="search monsters by name…" onClose={onClose}>
        {loading && all.length === 0 ? (
          <Hint className="py-3">Fetching the bestiary…</Hint>
        ) : !query.trim() ? (
          <Hint className="py-3">Type a name to search {all.length.toLocaleString()} monsters, homebrew included.</Hint>
        ) : results.length === 0 ? (
          <Hint className="py-3">No monster matches “{query}”.</Hint>
        ) : (
          results.map((m) => {
            const key = catalogueMonsterKey(m);
            const isPicked = picked && catalogueMonsterKey(picked) === key;
            const origin = monsterOrigin(m);
            return (
              <PickerRow
                key={key}
                name={m.name}
                onOpen={() => openPopup("monster", m)}
                meta={<Tag className="hidden normal-case italic tracking-normal @md:inline">{monsterSummary(m)}</Tag>}
                source={m.source === "HOMEBREW" ? <span className="italic">{origin}</span> : <span title={formatSource(m.source)}>{m.source}</span>}
                highlight={isPicked}
                action={{ label: isPicked ? "picked" : "pick", onClick: () => setPicked(isPicked ? null : m) }}
              />
            );
          })
        )}
      </PickerShell>

      {/* Add line */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[15px]">
        {picked ? (
          <>
            <span className={`italic ${INK.faded}`}>add</span>
            <NumberInput value={Number(count) || 1} min={1} max={maxCount} fallback={1} onChange={(v) => setCount(v ?? 1)} aria-label="How many" className="w-10" />
            <span className="font-semibold">{picked.name}</span>
            {picked.source === "HOMEBREW" && <span className={`text-sm italic ${INK.faint}`}>{monsterOrigin(picked)}</span>}
            <button type="button" onClick={handleAdd} disabled={adding} className={addBtn}>
              {adding ? "adding…" : addLabel}
            </button>
          </>
        ) : (
          <Hint>Pick a monster above.</Hint>
        )}
      </div>
    </div>
  );
}