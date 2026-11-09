import React, { useState } from "react";
import { INK, InkButton } from "../../../styles/parchment";
import { NumberInput, addBtn } from "../../../styles/parchmentForm";
import CatalogueMonsterPicker from "../../Catalogues/Monsters/CatalogueMonsterPicker";
import { monsterSummary } from "../../Catalogues/Monsters/catalogueMonsters";

/* Adding to an encounter — used by the encounter editor and, mid-fight,
   by the initiative tracker.

   AddMembers   the campaign's party and NPCs. Someone already in another
                encounter says where; picking them moves them here.
   AddMonsters  from the shelf (with how many) or the whole bestiary.
   AddGroups    a saved group, templates and all. */

const label = `text-[10px] font-semibold uppercase tracking-[0.18em] ${INK.faded}`;

// `elsewhere(kind, file)` → the name of the other encounter they're in, or null.
export function AddMembers({ party, npcs, members, elsewhere, onAdd }) {
  const inIt = (kind, file) => members.some((m) => m.kind === kind && m.file === file);
  const freeParty = party.filter((p) => !inIt("party", p.file));
  const freeNpcs = npcs.filter((n) => !inIt("npc", n.file));

  const pick = (kind, entry) => {
    const where = elsewhere?.(kind, entry.file);
    return (
      <button
        key={`${kind}:${entry.file}`}
        type="button"
        onClick={() => onAdd([{ kind, file: entry.file }])}
        title={where ? `In ${where} now — picking moves them here` : undefined}
        className={`text-[15px] italic ${INK.faded} hover:text-[#3a2716]`}
      >
        {entry.data?.name || entry.file}
        {where && <span className={`ml-1 text-xs ${INK.faint}`}>(in {where})</span>}
      </button>
    );
  };

  if (!freeParty.length && !freeNpcs.length) return <p className={`text-sm italic ${INK.faint}`}>Everyone is already in it.</p>;
  return (
    <div className="space-y-1 text-sm">
      {freeParty.length > 0 && (
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={label}>Party</span>
          {freeParty.map((p) => pick("party", p))}
          {freeParty.length > 1 && (
            <button type="button" onClick={() => onAdd(freeParty.map((p) => ({ kind: "party", file: p.file })))} className={addBtn}>
              all of them
            </button>
          )}
        </p>
      )}
      {freeNpcs.length > 0 && (
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={label}>NPCs</span>
          {freeNpcs.map((n) => pick("npc", n))}
        </p>
      )}
    </div>
  );
}

// onAdd(source, count, "shelf" | "catalogue")
export function AddMonsters({ shelf, onAdd }) {
  const [count, setCount] = useState(1);
  const [searching, setSearching] = useState(!shelf.length);
  return (
    <div className="space-y-3">
      {shelf.length > 0 && (
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
            <span className={label}>From your shelf</span>
            <span className={`flex items-baseline gap-1.5 italic ${INK.faded}`}>
              how many
              <NumberInput value={count} min={1} max={20} fallback={1} onChange={(v) => setCount(v ?? 1)} aria-label="How many" className="w-10" />
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
            {shelf.map((entry) => (
              <button key={entry.file} type="button" onClick={() => onAdd(entry, count, "shelf")} className="group text-left text-[15px]" title={`Add ${count}`}>
                <span className="group-hover:underline group-hover:decoration-dotted group-hover:underline-offset-4">{entry.data?.name || entry.file}</span>
                <span className={`ml-1.5 text-xs italic ${INK.faint}`}>{monsterSummary(entry.data)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {searching ? (
        <CatalogueMonsterPicker
          title="From the bestiary"
          addLabel="add"
          maxCount={20}
          onAdd={(monster, n) => {
            onAdd(monster, n, "catalogue");
            return true;
          }}
          onClose={() => setSearching(false)}
        />
      ) : (
        <InkButton onClick={() => setSearching(true)}>or search the whole bestiary</InkButton>
      )}
    </div>
  );
}

// onAdd(group). `summary(group)` is the short line to show next to it.
export function AddGroups({ groups, summary, onAdd }) {
  if (!groups.length) return <p className={`text-sm italic ${INK.faint}`}>No groups yet — make one on the Combat page.</p>;
  return (
    <div className="space-y-0.5">
      {groups.map((g) => (
        <button key={g.id} type="button" onClick={() => onAdd(g)} className="group block text-left text-[15px]" title="Bring the whole group in">
          <span className="group-hover:underline group-hover:decoration-dotted group-hover:underline-offset-4">{g.name}</span>
          <span className={`ml-2 text-xs italic ${INK.faint}`}>{summary(g)}</span>
        </button>
      ))}
    </div>
  );
}