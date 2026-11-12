// Minions of the character open on the sheet. Shape: claude/minion-contract.md
import { create } from "zustand";
import { api } from "../utils/api";

/* Minions belong to a character, found by its database id
   (/minions?char_id=<id>). Memory only: they are fetched when a sheet
   opens, and every change is sent to the server a moment later. */

const SAVE_DELAY_MS = 400;

const path = (minionId) => (minionId ? `/minions/${minionId}` : "/minions");

// Pending saves, one per minion id. Rapid changes (typing, clicking
// damage several times) collapse into a single request.
const pending = new Map(); // id -> { timer, run }

// A selected unit: "<minion id>:<unit id>".
export const selKey = (minionId, unitId) => `${minionId}:${unitId}`;

const useMinionStore = create((set, get) => ({
  charId: null,
  // The character's name, for display only (the dice tower's Minions tab).
  // Minions are always found by charId.
  charName: "",
  minions: [],
  loading: false,
  error: null,

  // Which units are selected — screen state only, never saved. Shared by
  // the sheet's Play section and the dice tower's Minions tab.
  selected: [],
  setSelected: (keys) => set({ selected: [...new Set(keys)] }),

  clearError: () => set({ error: null }),

  // Load a character's minions. Answers for a character that is no longer
  // open are ignored, so fast tab switching can't mix characters.
  loadMinions: async (charId, charName = "") => {
    if (!charId) return;
    // Waiting saves go out first, so the reload can't overwrite them.
    await get().flushSaves();

    if (get().charId !== charId) set({ charId, minions: [], selected: [] });
    set({ charName, loading: true, error: null });

    try {
      const data = await api.get(path(), { query: { char_id: charId } });
      if (get().charId !== charId) return;
      set({ minions: Array.isArray(data) ? data : [] });
    } catch (e) {
      if (get().charId === charId) set({ error: e.message });
    } finally {
      if (get().charId === charId) set({ loading: false });
    }
  },

  addMinion: async (draft) => {
    const charId = get().charId;
    if (!charId) return null;
    set({ error: null });
    try {
      const created = await api.post(path(), draft, { query: { char_id: charId } });
      if (get().charId === charId) {
        set((s) => ({ minions: [...s.minions, created] }));
      }
      return created;
    } catch (e) {
      set({ error: e.message });
      return null;
    }
  },

  // Show the change right away, send it a moment later.
  saveMinion: (minion) => {
    const charId = get().charId;
    if (!charId || !minion?.id) return;

    set((s) => ({ minions: s.minions.map((m) => (m.id === minion.id ? minion : m)) }));

    const prev = pending.get(minion.id);
    if (prev) clearTimeout(prev.timer);

    const run = async () => {
      pending.delete(minion.id);
      try {
        await api.put(path(minion.id), minion, { query: { char_id: charId } });
      } catch (e) {
        set({ error: e.message });
        // Show what is really saved instead of the change that failed.
        if (get().charId === charId) get().loadMinions(charId);
      }
    };
    pending.set(minion.id, { timer: setTimeout(run, SAVE_DELAY_MS), run });
  },

  saveMany: (list) => list.forEach((m) => get().saveMinion(m)),

  // Send every waiting save now (before reloading or switching character).
  flushSaves: () => {
    const runs = [...pending.values()].map(({ timer, run }) => {
      clearTimeout(timer);
      return run();
    });
    return Promise.all(runs);
  },

  removeMinion: async (id) => {
    const charId = get().charId;
    if (!charId) return;

    const prev = pending.get(id);
    if (prev) {
      clearTimeout(prev.timer);
      pending.delete(id);
    }

    set((s) => ({ minions: s.minions.filter((m) => m.id !== id), error: null }));
    try {
      await api.del(path(id), { query: { char_id: charId } });
    } catch (e) {
      set({ error: e.message });
      if (get().charId === charId) get().loadMinions(charId);
    }
  },

  // Logout or a deleted character: forget everything, unsaved changes too.
  reset: () => {
    for (const { timer } of pending.values()) clearTimeout(timer);
    pending.clear();
    set({ charId: null, charName: "", minions: [], loading: false, error: null, selected: [] });
  },
}));

export default useMinionStore;