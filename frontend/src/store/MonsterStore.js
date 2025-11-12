// src/store/monsterStore.js
import { create } from "zustand";

const API_BASE_MONSTERS = "http://localhost:8000/monsters";
const API_BASE_MINIONS = "http://localhost:8000/minions";

// 1) Read existing minions from localStorage on init
const storedMinions = (() => {
  try {
    const raw = localStorage.getItem("minionsData");
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
})();

const useMonsterStore = create((set, get) => ({
  minionsData: storedMinions,   // <-- start with what was in localStorage
  loading: false,
  error: null,

  // helpers
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  /* ---------- API actions ---------- */

  fetchMinions: async (charName) => {
    set({ loading: true, error: null });
    try {
      const url = `${API_BASE_MINIONS}?char_name=${encodeURIComponent(charName)}`;
      const token = localStorage.getItem("token");

      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`Failed to fetch minions: ${res.status}`);
      const data = await res.json();

      // 2) Update store + localStorage
      localStorage.setItem("minionsData", JSON.stringify(data));
      set({ minionsData: data, loading: false });
    } catch (err) {
      set({ error: err.message || "Unknown error", loading: false });
    }
  },

  createMinion: async (monsterPayload, charName) => {
    set({ loading: true, error: null });
    try {
      const url = `${API_BASE_MINIONS}?char_name=${encodeURIComponent(charName)}`;

      const token = localStorage.getItem("token");
      if (!token) throw new Error("Token not found in localStorage");

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(monsterPayload),
      });

      if (!res.ok) throw new Error(`Failed to create minion: ${res.status}`);

      const created = await res.json(); // e.g. a path or an object

      // Append to minionsData and sync to localStorage
      set((state) => {
        const next = [...state.minionsData, created];
        localStorage.setItem("minionsData", JSON.stringify(next));
        return { minionsData: next, loading: false };
      });

      return created;
    } catch (err) {
      set({ error: err.message || "Unknown error", loading: false });
      return null;
    }
  },

  updateMinion: async (minionData, charName) => {
  set({ loading: true, error: null });
  try {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("Token not found in localStorage");

    const url = `${API_BASE_MINIONS}?char_name=${encodeURIComponent(charName)}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(minionData),
    });

    if (!res.ok) {
      let details = "";
      try { details = JSON.stringify(await res.json()); } catch {}
      throw new Error(`Failed to update minion: ${res.status} ${details}`);
    }

    const data = await res.json(); // or null if your API returns nothing
    set({ loading: false });
    return data ?? true; // truthy on success
  } catch (err) {
    set({ error: err.message || "Unknown error", loading: false });
    return null;
  }
},


  deleteMinion: async (minionData, charName) => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Token not found in localStorage");

      const url = `${API_BASE_MINIONS}?char_name=${encodeURIComponent(charName)}`;
      const res = await fetch(url, {
        method: "DELETE", // if your backend disallows body on DELETE, switch to POST /minions/delete
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(minionData),
      });

      if (!res.ok) {
        let details = "";
        try { details = JSON.stringify(await res.json()); } catch {}
        throw new Error(`Failed to delete minion: ${res.status} ${details}`);
      }

      set({ loading: false });
      // optionally return server payload if any
      return true;
    } catch (err) {
      set({ error: err.message || "Unknown error", loading: false });
      return null;
    }
  },


}));

export default useMonsterStore;
