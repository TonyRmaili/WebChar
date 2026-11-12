import { create } from "zustand";
import { api } from "../utils/api";

/* The character open on the sheet. Lives in memory only: the server's
   file is the truth, and this store is the copy on screen.

     charId, charData        the open character (by its database id)
     loadChar(id)            open a character (or reload the open one)
     patchChar(patch, opts)  change top-level fields: shown at once, saved
                             a moment later; { now: true } saves right away
     flushSaves()            send waiting changes now

   Saving: only the changed top-level keys go to the server
   (PATCH /character/{id} { changes }), 400 ms after the last change, so
   typing doesn't send a request per key. Waiting changes are sent before
   another character opens and before every combat call, so they can't be
   lost or overwrite each other. Saves go out one after another, in order.
   If a save fails, `saveError` says why and the saved version is loaded
   back.

   Combat goes through the server's rules (barrier and temp HP, rests…):
   changeHp, rest, restAll, grantExperience.

   Characters list, create, delete and "show in Sheets": createChar,
   deleteChar, toggleActive. They don't refresh the user's character list
   themselves; call AuthStore's fetchUser() after them. */

const SAVE_DELAY_MS = 400;

// Waiting changes: the keys that changed (their values are read from
// charData when they are sent, so the latest typing goes out), and the
// character they belong to.
let pendingKeys = new Set();
let pendingFor = null;
let timer = null;
// The last save sent; the next one waits for it, so they arrive in order.
let inFlight = Promise.resolve();

const pick = (obj, keys) => {
  const out = {};
  for (const k of keys) out[k] = obj?.[k];
  return out;
};

const useCharStore = create((set, get) => {
  // A fresh copy from the server, with any changes still waiting to be
  // sent laid on top, so a reload never wipes out what was just typed.
  const withPending = (fresh) => (pendingKeys.size ? { ...fresh, ...pick(get().charData, pendingKeys) } : fresh);

  return {
    charId: null,
    charData: null,
    loading: false,
    error: null, // couldn't load the character
    saveError: null, // the last save failed

    clearSaveError: () => set({ saveError: null }),

    /* ── open a character ── */

    // Answers for a character that is no longer open are ignored, so fast
    // switching between characters can't mix them up.
    loadChar: async (id) => {
      if (!id) return;
      // flushSaves takes the waiting changes right away, before the switch
      // below, so they can only ever go to the character they were made on.
      const saving = get().flushSaves();

      if (get().charId !== id) set({ charId: id, charData: null, saveError: null });
      set({ loading: true, error: null });
      await saving;

      try {
        const data = await api.get(`/character/${id}`);
        if (get().charId === id) set({ charData: withPending(data) });
      } catch (e) {
        if (get().charId === id) set({ error: e.message });
      } finally {
        if (get().charId === id) set({ loading: false });
      }
    },

    reloadChar: () => get().loadChar(get().charId),

    /* ── change and save ── */

    patchChar: (patch, { now = false } = {}) => {
      const { charId, charData } = get();
      if (!charId || !charData || !patch) return Promise.resolve();

      set({ charData: { ...charData, ...patch } });
      for (const key of Object.keys(patch)) pendingKeys.add(key);
      pendingFor = charId;

      clearTimeout(timer);
      if (now) return get().flushSaves();
      timer = setTimeout(() => get().flushSaves(), SAVE_DELAY_MS);
      return Promise.resolve();
    },

    // `keepalive` lets the last save finish even while the page is closing.
    flushSaves: ({ keepalive = false } = {}) => {
      clearTimeout(timer);
      timer = null;
      if (!pendingKeys.size || !pendingFor) return inFlight;

      const id = pendingFor;
      const changes = pick(get().charData, pendingKeys);
      pendingKeys = new Set();

      const send = async () => {
        try {
          await api.patch(`/character/${id}`, { changes }, { keepalive });
          if (get().charId === id) set({ saveError: null });
        } catch (e) {
          if (get().charId !== id) return;
          set({ saveError: e.message });
          // Show what is really saved instead of the change that failed.
          try {
            const fresh = await api.get(`/character/${id}`);
            if (get().charId === id) set({ charData: withPending(fresh) });
          } catch {
            /* the error above is already shown */
          }
        }
      };

      inFlight = inFlight.then(send);
      return inFlight;
    },

    /* ── combat (the server applies the rules and saves) ── */

    // delta < 0 is damage, > 0 is healing. Returns the new health block.
    changeHp: async (delta) => {
      const id = get().charId;
      if (!id || !delta) return null;
      await get().flushSaves();
      const { health } = await api.post("/combat/health", { char_id: id, value: delta });
      if (get().charId === id) set((s) => ({ charData: { ...s.charData, health } }));
      return health;
    },

    // This character only (the Health section's rest buttons).
    rest: async (restType) => {
      const id = get().charId;
      if (!id) return;
      await get().flushSaves();
      const data = await api.post("/combat/rest", { char_id: id, rest_type: restType });
      if (get().charId === id) set({ charData: withPending(data) });
    },

    // Every character in `ids` (the party bar's rest buttons).
    restAll: async (restType, ids) => {
      if (!ids?.length) return;
      await get().flushSaves();
      await api.post("/combat/rest_all", { char_ids: ids, rest_type: restType });
      if (ids.includes(get().charId)) await get().reloadChar();
    },

    // Known bug (backend): this gives the XP to every character of the user.
    grantExperience: async (delta) => {
      if (!delta) return;
      await get().flushSaves();
      await api.post("/combat/experience", { delta });
      if (get().charId) await get().reloadChar();
    },

    /* ── the character list ── */

    // The Builder Wizard's payload. Returns { id, name }.
    createChar: (payload) => api.post("/character", payload),

    deleteChar: async (id) => {
      if (get().charId === id) get().reset();
      await api.del(`/character/${id}`);
    },

    // Shows or hides the character in Sheets. Returns { id, active }.
    toggleActive: (id) => api.post(`/character/${id}/active`),

    /* ── logout / deleted character ── */

    // Forget the open character, and any changes still waiting with it.
    reset: () => {
      clearTimeout(timer);
      timer = null;
      pendingKeys = new Set();
      pendingFor = null;
      set({ charId: null, charData: null, loading: false, error: null, saveError: null });
    },
  };
});

// Closing or reloading the tab: send what is still waiting.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => useCharStore.getState().flushSaves({ keepalive: true }));
}

export default useCharStore;