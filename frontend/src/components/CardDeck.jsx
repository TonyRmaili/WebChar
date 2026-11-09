import React, { useEffect, useMemo, useRef, useState } from "react";
import { POPUP_REGISTRY } from "./popups/popupRegistry";
import { PARTS, cardLine, deckCards, sortIntoDecks } from "./popups/decks";
import { usePopupStore } from "../store/PopupStore";

/* ═══════════════════════════════════════════════════════════════════
   CardDeck — the footer's home for minimized cards.

   Minimized cards land in decks by kind (popups/decks.js): Spells,
   Monsters, … Statblocks, Templates, Combat trackers, Tables.

     DeckStacks  a row of little card stacks in the footer, one per deck
                 that has cards. A deck with one card restores it on a
                 click; a bigger one opens the panel on that deck.
     DeckPanel   opens above the footer (from a stack, or the footer's
                 CardDeck button): every deck with its cards — click a
                 card to bring it back, ✕ to close it, or open / close a
                 whole deck at once. Esc or a click outside closes it.

   `panel` is null (closed), "all", or a deck id; the Footer holds it so
   it can stay open while the panel is. Cards may keep unsaved edits
   (statblocks, tables): closing a card from here forgets them, through
   the popup type's `forget(id)` in popupRegistry.js.
   ═══════════════════════════════════════════════════════════════════ */

const EMPTY = [];

// Bring cards back, or close them for good.
export const restoreAll = (cards) => cards.forEach((c) => usePopupStore.getState().restore(c.id));
export function closeAll(cards) {
  const ids = new Set(cards.map((c) => c.id));
  usePopupStore.setState((s) => ({ minimized: s.minimized.filter((p) => !ids.has(p.id)) }));
  cards.forEach((c) => POPUP_REGISTRY[c.type]?.forget?.(c.id));
}

const linkCls = "text-[11px] italic text-slate-400 underline decoration-dotted underline-offset-4 transition-colors hover:text-amber-400";

/* ─── the stacks in the footer ───────────────────────────────────── */

export function DeckStacks({ panel, setPanel }) {
  const minimized = usePopupStore((s) => s.minimized) || EMPTY;
  const decks = useMemo(() => sortIntoDecks(minimized), [minimized]);
  if (!decks.length) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-700/50 px-1 pb-1 pt-3">
      {decks.map(({ deck, cards }) => {
        const one = cards.length === 1;
        const active = panel === deck.id;
        return (
          <button
            key={deck.id}
            type="button"
            data-deck-toggle
            onClick={() => (one ? restoreAll(cards) : setPanel(active ? null : deck.id))}
            title={one ? `Bring back ${cards[0].data?.name}` : `${cards.length} ${deck.label.toLowerCase()} — show them`}
            className="group relative isolate"
          >
            {/* the cards underneath, peeking out */}
            {cards.length > 1 && <span aria-hidden="true" className="absolute inset-0 -z-10 translate-x-[3px] -translate-y-[3px] rounded border border-stone-500 bg-stone-300" />}
            {cards.length > 2 && <span aria-hidden="true" className="absolute inset-0 -z-20 translate-x-[6px] -translate-y-[6px] rounded border border-stone-500 bg-stone-400" />}
            <span
              className={`flex max-w-[220px] items-baseline gap-2 rounded border px-3 py-1 text-sm transition-colors ${
                active ? "border-amber-500 bg-amber-100 text-stone-900" : "border-stone-400 bg-stone-200 text-stone-900 group-hover:bg-stone-300"
              }`}
            >
              <span className="truncate">{one ? cards[0].data?.name : deck.label}</span>
              <span className="shrink-0 text-xs text-stone-500">{one ? deck.label : cards.length}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── the panel ──────────────────────────────────────────────────── */

function DeckColumn({ deck, cards, words, onPicked, alone }) {
  const shown = words ? cards.filter((c) => `${c.data?.name} ${cardLine(c)}`.toLowerCase().includes(words)) : cards;
  if (!shown.length) return null;
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline gap-2">
        {/* the panel's title already names a deck shown on its own */}
        {!alone && (
          <>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400/90">{deck.label}</h4>
            <span className="text-xs text-slate-500">{cards.length}</span>
          </>
        )}
        <span className="ml-auto flex gap-3">
          {cards.length > 1 && (
            <button
              type="button"
              onClick={() => {
                restoreAll(cards);
                onPicked();
              }}
              className={linkCls}
            >
              open all
            </button>
          )}
          <button type="button" onClick={() => closeAll(cards)} className={linkCls}>
            close all
          </button>
        </span>
      </div>
      <ul>
        {shown.map((card) => (
          <li key={card.id} className="group flex items-baseline gap-2 rounded px-1.5 py-1 hover:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                usePopupStore.getState().restore(card.id);
                onPicked();
              }}
              className="min-w-0 flex-1 text-left"
              title="Bring it back"
            >
              <span className="block truncate text-[15px] text-slate-200 group-hover:text-amber-300">{card.data?.name || "Unnamed"}</span>
              {cardLine(card) && <span className="block truncate text-xs italic text-slate-500">{cardLine(card)}</span>}
            </button>
            <button
              type="button"
              onClick={() => closeAll([card])}
              aria-label={`Close ${card.data?.name}`}
              title="Close it"
              className="shrink-0 px-1 text-slate-500 opacity-0 transition hover:text-red-300 focus:opacity-100 group-hover:opacity-100"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DeckPanel({ panel, setPanel }) {
  const all = usePopupStore((s) => s.minimized) || EMPTY;
  const minimized = useMemo(() => deckCards(all), [all]);
  const decks = useMemo(() => sortIntoDecks(minimized), [minimized]);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const words = query.trim().toLowerCase();

  // Esc, or a click anywhere else (but the stacks / CardDeck button), closes it.
  useEffect(() => {
    if (!panel) return undefined;
    const onKey = (e) => e.key === "Escape" && setPanel(null);
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || e.target.closest?.("[data-deck-toggle]")) return;
      setPanel(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [panel, setPanel]);

  useEffect(() => setQuery(""), [panel]);

  if (!panel) return null;
  const shown = panel === "all" ? decks : decks.filter((d) => d.deck.id === panel);
  const focused = panel !== "all" ? decks.find((d) => d.deck.id === panel) : null;
  const total = minimized.length;
  const close = () => setPanel(null);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-full mb-2 flex justify-center px-3">
      <div ref={ref} role="dialog" aria-label="Card deck" className="pointer-events-auto max-h-[60vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/[0.98] p-4 font-serif text-slate-300 shadow-2xl">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h3 className="text-lg text-amber-400">{focused ? focused.deck.label : "Card deck"}</h3>
          <span className="text-sm text-slate-500">{focused ? focused.cards.length : total} minimized</span>
          {focused && (
            <button type="button" onClick={() => setPanel("all")} className={linkCls}>
              all decks
            </button>
          )}
          {total > 8 && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="find a card…"
              aria-label="Find a card"
              className="h-7 w-48 rounded border border-slate-700 bg-slate-800 px-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500/60 focus:outline-none"
            />
          )}
          <span className="ml-auto flex items-baseline gap-4">
            {total > 0 && !focused && (
              <button type="button" onClick={() => closeAll(minimized)} className={`${linkCls} hover:!text-red-300`}>
                close every card
              </button>
            )}
            <button type="button" onClick={close} aria-label="Close the deck" className="text-slate-500 hover:text-amber-400">
              ✕
            </button>
          </span>
        </div>

        {shown.length === 0 ? (
          <p className="py-4 text-sm italic text-slate-500">
            {total ? "Nothing in this deck any more." : "No minimized cards. Minimize a card (−) and it lands in its deck here."}
          </p>
        ) : (
          PARTS.map((part) => {
            const inPart = shown.filter((d) => d.deck.part === part.id);
            if (!inPart.length) return null;
            return (
              <section key={part.id} className="mb-4 last:mb-0">
                {!focused && <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">{part.label}</p>}
                <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  {inPart.map(({ deck, cards }) => (
                    <DeckColumn key={deck.id} deck={deck} cards={cards} words={words} onPicked={close} alone={Boolean(focused)} />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}