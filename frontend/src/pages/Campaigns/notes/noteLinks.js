import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useCampaignStore, { copiesKey } from "../../../store/CampaignStore";
import { openStatblock } from "../statblock/StatblockWindow";
import { openCampaignFile } from "./fileCards";
import { fetchFilesTree } from "./notesApi";

/* ═══════════════════════════════════════════════════════════════════
   noteLinks.js — links inside notes (the `mention` node, noteExtensions.js).

     @Name    a catalogue entry (spell, monster, item…): opens its card
     //Name   a party member or NPC of the campaign: opens their statblock
     [[Name]] another note or picture of the campaign: opens its card

   A link keeps { id, label, kind, slice }:
     notes / pictures:  id = the file's path, kind = "note" / "image"
     party / NPCs:      id = the copy's file in the campaign ("Thorin.json"),
                        kind = "party" / "npc"
     catalogue:         id = the entry's id, kind = its card type,
                        slice = which catalogue list it is in
   Something renamed or moved since is found again by its name.
   ═══════════════════════════════════════════════════════════════════ */

// Every catalogue a note can link to: its list in CatalogueStore, the card
// type it opens as, and its ink (theme slots, as in the Omni-Search).
export const CATALOGUE_LINKS = [
  { list: "monsters", type: "monster", label: "Monster", badge: "text-bad" },
  { list: "spells", type: "spell", label: "Spell", badge: "text-magic" },
  { list: "items", type: "item", label: "Item", badge: "text-warn" },
  { list: "races", type: "race", label: "Race", badge: "text-good" },
  { list: "feats", type: "feat", label: "Feat", badge: "text-info" },
  { list: "backgrounds", type: "background", label: "Background", badge: "text-rubric" },
  { list: "optionalFeatures", type: "optionalFeature", label: "Optional", badge: "text-ink-faded" },
  { list: "rules", type: "reference", label: "Rule", badge: "text-ink" },
  { list: "lore", type: "reference", label: "Lore", badge: "text-ink" },
  { list: "toolkit", type: "reference", label: "Toolkit", badge: "text-ink" },
];

const loaderOf = (list) => `load${list[0].toUpperCase()}${list.slice(1)}`;

// The catalogues are big, so they load the first time someone types "@".
// The menu waits for them (a name typed before they're in would find
// nothing, and Enter would leave plain text instead of a link).
let loading = null;
export function ensureCatalogues() {
  if (!loading) {
    const s = useCatalogueStore.getState();
    loading = Promise.all(CATALOGUE_LINKS.map(({ list }) => (s[list]?.length ? null : s[loaderOf(list)]?.())));
  }
  return loading;
}

// Catalogue entries whose name holds the words; names starting with them first.
export function findCatalogue(query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const s = useCatalogueStore.getState();
  const found = [];
  for (const c of CATALOGUE_LINKS) {
    for (const e of s[c.list] || []) {
      const pos = e?.name ? e.name.toLowerCase().indexOf(q) : -1;
      if (pos < 0) continue;
      found.push({ rank: pos === 0 ? 0 : 1, item: { id: e.id ?? e.name, label: e.name, kind: c.type, slice: c.list, source: e.source, badge: c.label } });
      if (found.length > 300) break;
    }
  }
  found.sort((a, b) => a.rank - b.rank || a.item.label.localeCompare(b.item.label));
  return found.slice(0, limit).map((f) => f.item);
}

/* ─── the campaign's party and NPCs ───
   The copies imported from character creation (Campaign › NPCs). They
   aren't in any catalogue; the campaign page keeps them in CampaignStore,
   and they're fetched from there (again after a short while, so a new NPC
   shows up). */

export const CAMPAIGN_COPIES = [
  { kind: "party", label: "Party" },
  { kind: "npc", label: "NPC" },
];

const copiesAsked = new Map(); // "<campaign>|<kind>" → { at, promise }
function ensureCopies(campaignName) {
  return Promise.all(
    CAMPAIGN_COPIES.map(({ kind }) => {
      const key = copiesKey(campaignName, kind);
      const kept = copiesAsked.get(key);
      if (kept && Date.now() - kept.at < 30_000) return kept.promise;
      const promise = useCampaignStore.getState().fetchCampaignCharacters(campaignName, kind);
      copiesAsked.set(key, { at: Date.now(), promise });
      return promise;
    }),
  );
}

const copiesOf = (campaignName, kind) => useCampaignStore.getState().campaignCharacters[copiesKey(campaignName, kind)] || [];
const copyName = (entry) => entry.data?.name || entry.file.replace(/\.json$/i, "");

// Party members and NPCs whose name holds the words (all of them for "//" alone).
export async function findCopies(campaignName, query, limit = 8) {
  await ensureCopies(campaignName);
  const q = query.trim().toLowerCase();
  return CAMPAIGN_COPIES.flatMap(({ kind, label }) =>
    copiesOf(campaignName, kind)
      .filter((e) => copyName(e).toLowerCase().includes(q))
      .map((e) => ({ id: e.file, label: copyName(e), kind, slice: "campaign", badge: label })),
  )
    .sort((a, b) => a.label.toLowerCase().indexOf(q) - b.label.toLowerCase().indexOf(q) || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/* ─── the campaign's notes and pictures ─── */

const stemOf = (name) => name.replace(/\.[^.]+$/, "");

function flatFiles(nodes, out = []) {
  for (const n of nodes || []) {
    if (n.type === "folder") flatFiles(n.children, out);
    else if (n.kind === "note" || n.kind === "image") out.push({ id: n.path, label: n.kind === "note" ? stemOf(n.name) : n.name, kind: n.kind });
  }
  return out;
}

// The campaign page's tree when it's this campaign; else asked for (and
// kept a short while, so typing doesn't ask on every letter).
const fetched = new Map(); // campaign → { at, files }
async function filesOf(campaignName) {
  const store = useCampaignStore.getState();
  if (store.currentCampaignName === campaignName && store.campaignData.length) return flatFiles(store.campaignData);
  const kept = fetched.get(campaignName);
  if (kept && Date.now() - kept.at < 30_000) return kept.files;
  const r = await fetchFilesTree(campaignName);
  const files = r.ok ? flatFiles(r.children) : [];
  fetched.set(campaignName, { at: Date.now(), files });
  return files;
}

export async function findFiles(campaignName, query, limit = 8) {
  const q = query.trim().toLowerCase();
  const files = await filesOf(campaignName);
  return files
    .filter((f) => f.label.toLowerCase().includes(q))
    .sort((a, b) => (a.kind === b.kind ? a.label.localeCompare(b.label) : a.kind === "note" ? -1 : 1))
    .slice(0, limit)
    .map((f) => ({ ...f, badge: f.kind === "note" ? "Note" : "Picture" }));
}

/* ─── following a link ─── */

const baseName = (path) => path.split(/[/\\]/).pop();

// Opens what a link points at. Returns a sentence when it can't.
export async function openLink({ id, label, kind, slice }, campaignName) {
  const copy = CAMPAIGN_COPIES.find((c) => c.kind === kind);
  if (copy) {
    await ensureCopies(campaignName);
    const list = copiesOf(campaignName, kind);
    const entry = list.find((e) => e.file === id) || list.find((e) => copyName(e) === label);
    if (!entry) return `"${label}" isn't among this campaign's ${kind === "party" ? "party" : "NPCs"} any more`;
    openStatblock({ name: copyName(entry), campaignName, kind, file: entry.file });
    return null;
  }
  if (kind === "note" || kind === "image") {
    let path = id;
    const files = await filesOf(campaignName);
    if (files.length && !files.some((f) => f.id === path)) {
      const same = files.find((f) => f.kind === kind && f.label === label);
      if (!same) return `"${label}" isn't in this campaign's files any more`;
      path = same.id;
    }
    openCampaignFile({ kind, name: baseName(path), path }, campaignName);
    return null;
  }
  const c = CATALOGUE_LINKS.find((x) => x.list === slice);
  if (!c) return `"${label}" can't be opened`;
  if (!useCatalogueStore.getState()[c.list]?.length) await useCatalogueStore.getState()[loaderOf(c.list)]?.();
  const list = useCatalogueStore.getState()[c.list] || [];
  const entry = list.find((e) => (e.id ?? e.name) === id) || list.find((e) => e.name === label);
  if (!entry) return `"${label}" isn't in the ${c.label.toLowerCase()} catalogue any more`;
  usePopupStore.getState().open(c.type, entry);
  return null;
}

// A click inside a note: on a link, open it. `say` hears why it couldn't.
export function clickedLink(e, campaignName, say) {
  const el = e.target.closest?.('[data-type="mention"]');
  if (!el) return false;
  e.preventDefault();
  const link = { id: el.getAttribute("data-id"), label: el.getAttribute("data-label"), kind: el.getAttribute("data-kind"), slice: el.getAttribute("data-slice") };
  openLink(link, campaignName).then((problem) => problem && say?.(problem));
  return true;
}
