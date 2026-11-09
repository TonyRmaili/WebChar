import React, { useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import { INK, InkButton, InkNumber, InkRemove, InkTextArea, Leader, Line, SubHeading } from "../../../styles/parchment";
import { addBtn } from "../../../styles/parchmentForm";
import CataloguePicker from "../statblock/CataloguePicker";
import { fmt, totalXp, withLootItem } from "./encounterHelpers";

/* An encounter's rewards: XP and loot. Only a record for the DM — nothing
   is handed to anyone.

     xp.override      null = the monsters' total; a number = the DM's own
     loot.items[]     { id, name, source, quantity } from the item catalogue
     loot.coins       { cp, sp, ep, gp, pp }
     loot.notes       anything else (a map, a favour, a secret) */

const asList = (v) => (Array.isArray(v) ? v : []);
const COINS = ["pp", "gp", "ep", "sp", "cp"];

export default function EncounterRewards({ encounter, change }) {
  const openPopup = usePopupStore((s) => s.open);
  const [picking, setPicking] = useState(false);

  const total = totalXp(encounter);
  const override = encounter.xp?.override ?? null;
  // Typing the calculated number (or clearing the box) goes back to it.
  const setXp = (v) => change((e) => ({ ...e, xp: { ...(e.xp || {}), override: v == null || v === total ? null : v } }));

  const loot = encounter.loot || {};
  const items = asList(loot.items);
  const setLoot = (p) => change((e) => ({ ...e, loot: { ...(e.loot || {}), ...p } }));

  const addItem = (entry) => change((e) => withLootItem(e, entry));

  // The loot only keeps name + source, so find the item to show its card.
  const viewItem = async (it) => {
    const find = () => asList(useCatalogueStore.getState().items).find((e) => e?.name === it.name && (e?.source ?? null) === (it.source ?? null));
    let full = find();
    if (!full) {
      await useCatalogueStore.getState().loadItems?.();
      full = find();
    }
    openPopup("item", full || { name: it.name, source: it.source });
  };

  return (
    <div className="space-y-5">
      <div>
        <SubHeading>Experience</SubHeading>
        <Line label="The monsters are worth">
          <InkNumber value={override ?? total} onChange={setXp} min={0} aria-label="XP for this encounter" className={`h-7 w-24 text-lg ${override != null ? INK.rubric : ""}`} />
          <span className={`text-sm ${INK.faded}`}>XP</span>
        </Line>
        {override != null && (
          <p className={`flex flex-wrap items-baseline gap-x-3 text-sm italic ${INK.faded}`}>
            Changed from the calculated {fmt(total)} XP.
            <InkButton onClick={() => setXp(null)}>back to {fmt(total)}</InkButton>
          </p>
        )}
      </div>

      <div>
        <SubHeading count={items.length || null}>Loot</SubHeading>
        {items.map((it) => (
          <div key={it.id} className="flex items-baseline gap-2 py-[3px] text-[15px]">
            <button type="button" onClick={() => viewItem(it)} className="truncate text-left hover:underline hover:decoration-dotted hover:underline-offset-4" title="Read its card">
              {it.name}
            </button>
            <Leader />
            <InkNumber
              value={it.quantity}
              onChange={(v) => setLoot({ items: items.map((x) => (x.id === it.id ? { ...x, quantity: Math.max(1, v ?? 1) } : x)) })}
              min={1}
              fallback={1}
              aria-label={`How many ${it.name}`}
              className="h-6 w-10 text-sm"
            />
            <InkRemove onClick={() => setLoot({ items: items.filter((x) => x.id !== it.id) })} label={`Remove ${it.name}`} />
          </div>
        ))}
        <button type="button" onClick={() => setPicking((p) => !p)} className={`${addBtn} mt-1`}>
          {picking ? "done" : "+ item"}
        </button>
        {picking && (
          <div className="mt-2">
            <CataloguePicker
              kind="item"
              has={(entry) => items.some((it) => it.name === entry.name && it.source === entry.source)}
              onAdd={addItem}
              onView={(type, entry) => openPopup(type, entry)}
              onClose={() => setPicking(false)}
            />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {COINS.map((c) => (
            <span key={c} className="flex items-baseline gap-1">
              <InkNumber
                value={loot.coins?.[c] ?? null}
                onChange={(v) => setLoot({ coins: { ...(loot.coins || {}), [c]: v ?? undefined } })}
                min={0}
                placeholder="0"
                aria-label={c}
                className="h-6 w-14 text-sm"
              />
              <span className={`text-xs uppercase ${INK.faded}`}>{c}</span>
            </span>
          ))}
        </div>

        <InkTextArea
          value={loot.notes || ""}
          onChange={(e) => setLoot({ notes: e.target.value })}
          rows={2}
          placeholder="Anything else — a map, a favour owed, a secret…"
          aria-label="Loot notes"
          className="mt-2"
        />
      </div>
    </div>
  );
}