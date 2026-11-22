import { HOMEBREW } from "../catalogueHelpers";
import { formatCR, monsterTypes } from "./monsterHelpers";

/* The monster catalogue for anything that lets you pick a monster from it
   (minions on a character, monsters in a campaign). The store keeps one
   flat list: the books, then public and private homebrew (tagged with
   `visibility`). */

const isHomebrew = (m) => m?.source === HOMEBREW;

// A key that tells two monsters apart: every monster has an id.
export const catalogueMonsterKey = (m) => (isHomebrew(m) ? `${HOMEBREW}#${m?.id}` : m?.id);

// Every monster once. Your own public homebrew comes back in both the
// public and the private list; the private copy is kept.
export function allCatalogueMonsters(monsters) {
  const byKey = new Map();
  for (const m of Array.isArray(monsters) ? monsters : []) {
    if (!m?.name) continue;
    const key = catalogueMonsterKey(m);
    const seen = byKey.get(key);
    if (!seen || (seen.visibility !== "private" && m.visibility === "private")) byKey.set(key, m);
  }
  return [...byKey.values()];
}

// Where a monster comes from, in words: "XMM", "your homebrew", "public homebrew".
export const monsterOrigin = (m) => (!isHomebrew(m) ? m?.source || "" : m?.visibility === "public" ? "public homebrew" : "your homebrew");

// "CR 1/4 · Medium Undead" — a short line under a name.
export const monsterSummary = (m) => {
  const size = (m?.size || []).map((s) => s[0].toUpperCase() + s.slice(1)).join("/");
  const type = monsterTypes(m).join("/");
  return [formatCR(m), [size, type].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
};
