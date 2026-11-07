import { formatCategory } from "../../../Catalogues/Feats/featsHelpers";
import { newEffect } from "./effectEditor";

/* Data helpers for the Feats tab.

   A feat on the character is stored in the same shape as an effect row
   (see effectEditor.jsx), plus a few fields from the catalogue:

     { …effect row, trait: "feat",
       source: "XPHB" | null,      // null = written by the player
       category: "origin" | null,  // null on classic feats (they have none)
       prerequisite, repeatable } */

export const asList = (v) => (Array.isArray(v) ? v : []);
export const squash = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/* One D&D feats are the ones with a `category` (classic feats have none),
   the same test the backend uses. */
export const featEdition = (feat) => (feat?.category ? "one" : "classic");

export const sameFeat = (a, b) => squash(a?.name) === squash(b?.name) && (a?.source || null) === (b?.source || null);

/* A catalogue feat → a row on the character. The feat's text becomes the
   notes; how it is used in Play (action type, uses) is the player's call,
   since the catalogue has no structured data for that. */
export const featFromCatalogue = (feat) => ({
  ...newEffect("passive"),
  name: feat.name,
  trait: "feat",
  source: feat.source ?? null,
  category: feat.category ?? null,
  prerequisite: feat.prerequisite ?? null,
  repeatable: !!feat.repeatable,
  notes: typeof feat.entries === "string" ? feat.entries : "",
});

export const ownFeat = () => ({ ...newEffect("passive"), trait: "feat", source: null, category: null });

/* ── Groups on the tab ──
   One D&D feats by their category, then classic feats, then the ones
   the player wrote. */
const CATEGORY_ORDER = ["origin", "general", "fighting_style", "epic_boon"];

export const groupKey = (row) => (!row.source ? "own" : row.category || "classic");

export const groupTitle = (key) =>
  key === "own" ? "Your own" : key === "classic" ? "Classic feats" : `${formatCategory(key)} feats`;

export const sortGroups = (keys) => {
  const rank = (k) => {
    const i = CATEGORY_ORDER.indexOf(k);
    if (i !== -1) return i;
    if (k === "classic") return 100;
    if (k === "own") return 101;
    return 50; // any other category, between the known ones and classic
  };
  return [...keys].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
};