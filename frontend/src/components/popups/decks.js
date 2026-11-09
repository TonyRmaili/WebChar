import { POPUP_REGISTRY } from "./popupRegistry";

/* ═══════════════════════════════════════════════════════════════════
   decks.js — where minimized cards go.

   Every card that is minimized lands in a deck, by what kind of card it
   is. Each popup type in popupRegistry.js says its deck (`deck: "spells"`,
   or a function of the card's data when one window type covers two decks,
   like statblocks and templates). The footer's CardDeck shows the decks.

   To add a deck (e.g. campaign notes later): add it to DECKS here and give
   the popup type `deck: "<id>"` in the registry. A tool with its own
   footer button (the dice tower) has `deck: null`: minimized, it simply
   waits for its button and never shows in the deck.
   ═══════════════════════════════════════════════════════════════════ */

export const DECKS = [
  // Cards from the catalogue
  { id: "spells", label: "Spells", part: "catalogue" },
  { id: "monsters", label: "Monsters", part: "catalogue" },
  { id: "feats", label: "Feats", part: "catalogue" },
  { id: "backgrounds", label: "Backgrounds", part: "catalogue" },
  { id: "items", label: "Items", part: "catalogue" },
  { id: "races", label: "Races", part: "catalogue" },
  { id: "optionalFeatures", label: "Optional features", part: "catalogue" },
  // Cards from campaigns
  { id: "statblocks", label: "Statblocks", part: "campaign" },
  { id: "templates", label: "Templates", part: "campaign" },
  { id: "trackers", label: "Combat trackers", part: "campaign" },
  { id: "tables", label: "Tables", part: "campaign" },
];

export const PARTS = [
  { id: "catalogue", label: "Catalogue" },
  { id: "campaign", label: "Campaign" },
];

const OTHER = { id: "other", label: "Other", part: "campaign" };

// Tools with a footer button of their own (registry `deck: null`) are
// minimized out of sight and left out of the deck.
export const inDeck = (card) => POPUP_REGISTRY[card.type]?.deck !== null;
export const deckCards = (minimized) => minimized.filter(inDeck);

// The deck a card ({ type, data }) belongs to.
export function deckOf(card) {
  const rule = POPUP_REGISTRY[card.type]?.deck;
  const id = typeof rule === "function" ? rule(card.data || {}) : rule;
  return DECKS.find((d) => d.id === id) || OTHER;
}

const STATBLOCK_KIND = { party: "party", npc: "NPC", monster: "monster shelf", encounter: "in an encounter" };

// A short line under a card's name: where it's from.
export function cardLine(card) {
  const d = card.data || {};
  if (card.type === "statblock") return [STATBLOCK_KIND[d.kind] || (d.kind === "template" ? "" : d.kind), d.campaignName].filter(Boolean).join(" · ");
  if (card.type === "tracker" || card.type === "table") return d.campaignName || "";
  return d.source || "";
}

// Minimized cards sorted into decks, in DECKS order, empty decks left out:
// [{ deck, cards: [card, …] }, …]
export function sortIntoDecks(cards) {
  const byDeck = new Map();
  for (const card of deckCards(cards)) {
    const deck = deckOf(card);
    if (!byDeck.has(deck.id)) byDeck.set(deck.id, { deck, cards: [] });
    byDeck.get(deck.id).cards.push(card);
  }
  return [...DECKS, OTHER].map((d) => byDeck.get(d.id)).filter(Boolean);
}