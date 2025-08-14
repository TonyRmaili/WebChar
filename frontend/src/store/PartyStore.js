import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";

const SERVER_URL = "http://localhost:8000/create_party";

const uid = () =>
  (crypto.randomUUID?.() || String(Date.now() + Math.random())).toString();

const emptyPlayer = () => ({
  id: uid(),
  name: "",
  initiative: 0,
  hp: 0,
  perception: 10,
  ac: 10,
});

export const PartyStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        players: [],
        status: "idle",
        lastSyncedAt: null,

        addPlayer: () => set((s) => ({ players: [...s.players, emptyPlayer()] })),
        removePlayer: (id) => set((s) => ({ players: s.players.filter((p) => p.id !== id) })),
        updatePlayer: (id, field, value) =>
          set((s) => ({
            players: s.players.map((p) =>
              p.id === id
                ? { ...p, [field]: field === "name" ? value : Number(value) }
                : p
            ),
          })),
        clearPlayers: () => set({ players: [] }),

        syncToServer: async () => {
          const { players } = get();
          try {
            set({ status: "syncing" });
            const token = localStorage.getItem("token");
            const res = await fetch(SERVER_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ players, updatedAt: new Date().toISOString() }),
              credentials: "include",
            });
            if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
            set({ status: "synced", lastSyncedAt: Date.now() });
          } catch (e) {
            console.error(e);
            set({ status: "error" });
          }
        },
      }),
      { name: "partyData", partialize: (s) => ({ players: s.players, lastSyncedAt: s.lastSyncedAt }) }
    )
  )
);

// ---- Debounced autosync subscription (call once, e.g., in App or your page) ----
let initialized = false;
export const initPartyAutosync = () => {
  if (initialized) return;
  initialized = true;

  const debounce = (fn, wait = 500) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  const debouncedSync = debounce(() => PartyStore.getState().syncToServer(), 500);

  let first = true;
  PartyStore.subscribe(
    (s) => s.players,
    () => {
      if (first) { first = false; return; } // skip hydration
      debouncedSync();
    },
    { fireImmediately: true } // fires once with current state; we skip it via `first`
  );
};
