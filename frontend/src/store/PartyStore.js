import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";

const SERVER_BASE = "http://localhost:8000/create_party";

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
        parties: {
          // [id]: { id, name, players: [], updatedAt }
        },
        currentPartyId: null,
        status: "idle",
        lastSyncedAt: null,
        
       
         
        // ---- Party actions ----
        createParty: async (name) => {
          const id = uid();
          set((s) => ({
            parties: {
              ...s.parties,
              [id]: { id, name: name?.trim() || `Party ${Object.keys(s.parties).length + 1}`, players: [], updatedAt: Date.now() },
            },
            currentPartyId: id,
          }));

          // Optional API create:
          try {
            const token = localStorage.getItem("token");
            await fetch(`${SERVER_BASE}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ id, name }),
              credentials: "include",
            });
          } catch (_) {}
        },

        selectParty: (id) => set({ currentPartyId: id }),

        removeParty: (id) => {
          set((s) => {
            const { [id]: _, ...rest } = s.parties;
            return {
              parties: rest,
              currentPartyId: s.currentPartyId === id ? null : s.currentPartyId,
            };
          });
        },

        renameParty: (id, name) =>
          set((s) => ({
            parties: {
              ...s.parties,
              [id]: { ...s.parties[id], name, updatedAt: Date.now() },
            },
          })),

        // ---- Player actions (scoped to current party) ----
        addPlayer: () =>
          set((s) => {
            const id = s.currentPartyId;
            if (!id) return {};
            const party = s.parties[id];
            return {
              parties: {
                ...s.parties,
                [id]: {
                  ...party,
                  players: [...party.players, emptyPlayer()],
                  updatedAt: Date.now(),
                },
              },
            };
          }),

        clearPlayers: () =>
          set((s) => {
            const id = s.currentPartyId;
            if (!id) return {};
            const party = s.parties[id];
            return {
              parties: {
                ...s.parties,
                [id]: { ...party, players: [], updatedAt: Date.now() },
              },
            };
          }),

        removePlayer: (playerId) =>
          set((s) => {
            const id = s.currentPartyId;
            if (!id) return {};
            const party = s.parties[id];
            return {
              parties: {
                ...s.parties,
                [id]: {
                  ...party,
                  players: party.players.filter((p) => p.id !== playerId),
                  updatedAt: Date.now(),
                },
              },
            };
          }),

        updatePlayer: (playerId, field, value) =>
          set((s) => {
            const id = s.currentPartyId;
            if (!id) return {};
            const party = s.parties[id];
            return {
              parties: {
                ...s.parties,
                [id]: {
                  ...party,
                  players: party.players.map((p) =>
                    p.id === playerId
                      ? { ...p, [field]: field === "name" ? value : Number(value) }
                      : p
                  ),
                  updatedAt: Date.now(),
                },
              },
            };
          }),

        async deletePartyOnServer(partyName) {
          const token = localStorage.getItem("token");
          const res = await fetch(
            `http://localhost:8000/parties/${encodeURIComponent(partyName)}`,
            {
              method: "DELETE",
              headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              credentials: "include", // only if you use cookies/sessions
            }
          );
          if (!res.ok && res.status !== 204) {
            const txt = await res.text();
            throw new Error(`Delete failed ${res.status}: ${txt}`);
          }
        },

       fetchParty: async () => {
        const token = localStorage.getItem("token");
        if (!token) return;

        try {
          const res = await fetch("http://localhost:8000/party", {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          });
          if (res.status !== 200) {
            console.error("Failed to fetch party:", res.status);
            return;
          }

          /** Backend returns: Party[] */
          const payload = await res.json();
          const list = Array.isArray(payload) ? payload : [];

          // normalize -> { [id]: {id, name, players, updatedAt} }
          const normalizeNum = (n, fallback = 0) =>
            Number.isFinite(Number(n)) ? Number(n) : fallback;

          const normalized = {};
          for (const p of list) {
            if (!p) continue;
            const id = p.id || uid();

            const players = Array.isArray(p.players)
              ? p.players.map((pl) => ({
                  id: pl.id || uid(),
                  name: String(pl.name ?? ""),
                  initiative: normalizeNum(pl.initiative, 0),
                  hp: normalizeNum(pl.hp, 0),
                  perception: normalizeNum(pl.perception, 10),
                  ac: normalizeNum(pl.ac, 10),
                }))
              : [];

            normalized[id] = {
              id,
              name: String(p.name ?? `Party ${Object.keys(normalized).length + 1}`),
              players,
              // keep server timestamp if present
              updatedAt: p.updatedAt ?? new Date().toISOString(),
            };
          }

          // pick currentPartyId: keep existing if still present, else first in new list
          const prevId = PartyStore.getState().currentPartyId;
          const newIds = Object.keys(normalized);
          const nextId = prevId && normalized[prevId] ? prevId : newIds[0] ?? null;

          set({
            parties: normalized,
            currentPartyId: nextId,
            status: "synced",
            lastSyncedAt: Date.now(),
          });
        } catch (e) {
          console.error("Error fetching party:", e);
        }
      },


        // ---- Sync current party to server ----
        syncParty: async (partyId) => {
          const { parties } = get();
          const party = parties[partyId];
          if (!party) return;

          try {
            set({ status: "syncing" });
            const token = localStorage.getItem("token");
            const res = await fetch(`${SERVER_BASE}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                id: party.id,
                name: party.name,
                players: party.players,
                updatedAt: new Date().toISOString(),
              }),
              credentials: "include",
            });
            if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
            set({ status: "synced", lastSyncedAt: Date.now() });
          } catch (e) {
            console.error("syncParty error:", e);
            set({ status: "error" });
          }
        },
      }),
      {
        name: "partyData",
        partialize: (s) => ({
          parties: s.parties,
          currentPartyId: s.currentPartyId,
          lastSyncedAt: s.lastSyncedAt,
        }),
      }
    )
  )
);

// ---- Debounced autosync based on partyId + players reference ----
let initialized = false;
export const initPartyAutosync = () => {
  if (initialized) return;
  initialized = true;

  const debounce = (fn, wait = 700) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  const debouncedSync = debounce((id) => PartyStore.getState().syncParty(id), 700);
  let first = true;

  PartyStore.subscribe(
    (s) => [
      s.currentPartyId,
      s.currentPartyId ? s.parties[s.currentPartyId]?.players : null, // reference only
    ],
    ([id], [prevId]) => {
      if (!id) return;
      // Optional: avoid syncing immediately on party switch:
      if (first || id !== prevId) { first = false; return; }
      debouncedSync(id);
    },
    {
      fireImmediately: true,
      // Only run listener when id OR players reference actually changes
      equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1],
    }
  );
};
