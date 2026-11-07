import { formatCR } from "./monsterHelpers";

/* The monster catalogue as one flat list, for anything that lets you pick
   a monster from it (minions on a character, monsters in a campaign).

   CatalogueStore.loadMonsters keeps monsters grouped by source book, and
   puts your homebrew (public and private) under "HOMEBREW", each tagged
   with `visibility`. */

const asList = (v) => (Array.isArray(v) ? v : []);

const isHomebrew = (m) => m?.source === "HOMEBREW";

// A key that tells two monsters apart. Homebrew monsters can share a name
// (yours and someone else's public one), so they go by id.
export const catalogueMonsterKey = (m) => (isHomebrew(m) && m?.id != null ? `HOMEBREW#${m.id}` : `${m?.name}|${m?.source}`);

// Every monster once. Your own public homebrew can come back in both the
// public and the private list; the private copy is kept.
export function allCatalogueMonsters(monstersData) {
  const root = monstersData?.monsters;
  if (!root || typeof root !== "object") return [];
  const byKey = new Map();
  for (const list of Object.values(root)) {
    for (const m of asList(list)) {
      if (!m?.name) continue;
      const key = catalogueMonsterKey(m);
      const seen = byKey.get(key);
      if (!seen || (seen.visibility !== "private" && m.visibility === "private")) byKey.set(key, m);
    }
  }
  return [...byKey.values()];
}

// Where a monster comes from, in words: "XMM", "your homebrew", "public homebrew".
export const monsterOrigin = (m) => (!isHomebrew(m) ? m?.source || "" : m?.visibility === "public" ? "public homebrew" : "your homebrew");

// "CR 1/4 · M undead" — a short line under a name.
export const monsterSummary = (m) => {
  const size = asList(m?.size).join("/");
  const type = typeof m?.type === "string" ? m.type : m?.type?.type || "";
  return [formatCR(m?.cr), [size, type].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
};