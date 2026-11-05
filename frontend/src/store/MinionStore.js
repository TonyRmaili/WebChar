// Minions of the character open on the sheet. Shape: claude/minion-contract.md
import { create } from "zustand";

const API = "http://localhost:8000/minions";
const SAVE_DELAY_MS = 400;

// The old store cached minions in the browser, which showed the previous
// character's minions on load. Remove that leftover once.
try {
  localStorage.removeItem("minionsData");
} catch {
  /* storage blocked: nothing to clean */
}

const authHeaders = (json = false) => {
  const token = localStorage.getItem("token");
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const url = (charName, id = "") =>
  `${API}${id ? `/${id}` : ""}?char_name=${encodeURIComponent(charName)}`;

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: authHeaders(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
  }
  return res.status === 204 ? null : res.json();
}

// Pending saves, one per minion id. Rapid changes (typing, clicking
// damage several times) collapse into a single request.
const pending = new Map(); // id -> { timer, run }

const useMinionStore = create((set, get) => ({
  charName: null,
  minions: [],
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  // Load a character's minions. Answers for a character that is no longer
  // open are ignored, so fast tab switching can't mix characters.
  loadMinions: async (charName) => {
    if (!charName) return;
    // Waiting saves go out first, so the reload can't overwrite them.
    await get().flushSaves();

    if (get().charName !== charName) set({ charName, minions: [] });
    set({ loading: true, error: null });

    try {
      const data = await request("GET", url(charName));
      if (get().charName !== charName) return;
      set({ minions: Array.isArray(data) ? data : [] });
    } catch (e) {
      if (get().charName === charName) set({ error: e.message });
    } finally {
      if (get().charName === charName) set({ loading: false });
    }
  },

  addMinion: async (draft) => {
    const charName = get().charName;
    if (!charName) return null;
    set({ error: null });
    try {
      const created = await request("POST", url(charName), draft);
      if (get().charName === charName) {
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
    const charName = get().charName;
    if (!charName || !minion?.id) return;

    set((s) => ({ minions: s.minions.map((m) => (m.id === minion.id ? minion : m)) }));

    const prev = pending.get(minion.id);
    if (prev) clearTimeout(prev.timer);

    const run = async () => {
      pending.delete(minion.id);
      try {
        await request("PUT", url(charName, minion.id), minion);
      } catch (e) {
        set({ error: e.message });
        // Show what is really saved instead of the change that failed.
        if (get().charName === charName) get().loadMinions(charName);
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
    const charName = get().charName;
    if (!charName) return;

    const prev = pending.get(id);
    if (prev) {
      clearTimeout(prev.timer);
      pending.delete(id);
    }

    set((s) => ({ minions: s.minions.filter((m) => m.id !== id), error: null }));
    try {
      await request("DELETE", url(charName, id));
    } catch (e) {
      set({ error: e.message });
      if (get().charName === charName) get().loadMinions(charName);
    }
  },
}));

export default useMinionStore;