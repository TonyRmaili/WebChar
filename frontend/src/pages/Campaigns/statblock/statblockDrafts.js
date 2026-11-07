import { create } from "zustand";

/* Unsaved edits of open statblock cards, keyed by the card's window id.

   Kept outside the card so minimizing it (which unmounts it) doesn't throw
   your changes away: restore the card and you're still editing where you
   left off. Lives in memory only — a page reload starts clean. */

const useStatblockDrafts = create((set) => ({
  drafts: {},
  setDraft: (id, draft) => set((s) => ({ drafts: { ...s.drafts, [id]: draft } })),
  clearDraft: (id) =>
    set((s) => {
      const next = { ...s.drafts };
      delete next[id];
      return { drafts: next };
    }),
}));

export default useStatblockDrafts;