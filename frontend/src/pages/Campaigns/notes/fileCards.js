import { usePopupStore } from "../../../store/PopupStore";
import { dropNoteSaves, isUnder } from "./notesApi";

/* ═══════════════════════════════════════════════════════════════════
   fileCards.js — the campaign's files open as cards (popupRegistry):

     a note    → "note"     (NoteCard: the document editor)
     a picture → "picture"  (PictureCard)
     a prompt  → "prompt"   (PromptCard: plain text for the assistant)
     a note's handout → "handout" (HandoutCard: just the handout, to show)

   A card's data is { name, path, campaignName }. The card is known by its
   path, so when a file or a folder above it is renamed, moved or deleted,
   the cards follow (retargetFileCards / closeFileCards).
   ═══════════════════════════════════════════════════════════════════ */

const TYPE_OF_KIND = { note: "note", image: "picture", prompt: "prompt" };
export const FILE_CARD_TYPES = Object.values(TYPE_OF_KIND);

export const fileCardId = (type, d) => `${type}__${d.path}`;

const baseName = (path) => path.split(/[/\\]/).pop();
// Notes and prompts show without ".json" / ".md"; pictures keep theirs.
const titleOf = (type, fileName) => (type === "picture" ? fileName : fileName.replace(/\.[^.]+$/, ""));

export function openCampaignFile(node, campaignName) {
  const type = TYPE_OF_KIND[node.kind];
  if (!type) return;
  usePopupStore.getState().open(type, { name: titleOf(type, node.name), path: node.path, campaignName });
}

const isFileCard = (card) => FILE_CARD_TYPES.includes(card.type);

// A file or folder went from oldPath to newPath: cards on it, or inside
// it, now point at the new place.
export function retargetFileCards(oldPath, newPath) {
  if (!oldPath || !newPath || oldPath === newPath) return;
  const fix = (list) =>
    list.map((card) => {
      if (!isFileCard(card) || !isUnder(card.data.path, oldPath)) return card;
      const path = newPath + card.data.path.slice(oldPath.length);
      const data = { ...card.data, path, name: titleOf(card.type, baseName(path)) };
      return { ...card, id: fileCardId(card.type, data), data };
    });
  usePopupStore.setState((s) => ({ openPopups: fix(s.openPopups), minimized: fix(s.minimized) }));
}

// A file or folder is being deleted: its cards close, unsaved changes and all.
export function closeFileCards(path) {
  dropNoteSaves(path);
  const keep = (list) => list.filter((card) => !(isFileCard(card) && isUnder(card.data.path, path)));
  usePopupStore.setState((s) => ({ openPopups: keep(s.openPopups), minimized: keep(s.minimized) }));
}

// A handout of a note, on its own. Showing the same handout again brings
// what it says now (the card keeps what it said when it was shown).
export const handoutId = (d) => `handout__${d.notePath}__${d.name}`;

export function showHandout(data) {
  const id = handoutId(data);
  const fresh = (list) => list.map((card) => (card.id === id ? { ...card, data } : card));
  usePopupStore.setState((s) => ({ openPopups: fresh(s.openPopups), minimized: fresh(s.minimized) }));
  usePopupStore.getState().open("handout", data);
}
