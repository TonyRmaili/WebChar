import { create } from "zustand";

const API_BASE = "http://localhost:8000/dice";

const useDiceStore = create((set, get) => ({
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  /* ---------- API actions ---------- */

  postDice: async (dice) => {
    set({ loading: true, error: null });
    try {
      const url = `${API_BASE}`;

      const token = localStorage.getItem("token");
      if (!token) throw new Error("Token not found in localStorage");

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dice),
      });

      if (!res.ok) throw new Error(`Failed to post dice: ${res.status}`);

      const conclusion = await res.json(); 
      
      return conclusion;

    } catch (err) {
      set({ error: err.message || "Unknown error", loading: false });
      return null;
    }
  },

  postMinionEffects: async (minionEffects,targetAC,targetSaveMod,targetRollType,minionsRollType) => {
    set({ loading: true, error: null });
    try {
      const url = `${API_BASE}/minion_effects`;

      const token = localStorage.getItem("token");
      if (!token) throw new Error("Token not found in localStorage");
      
      const payload = {
        minion_effects: minionEffects,  
        target_ac: targetAC,
        target_save_mod: targetSaveMod,
        target_roll_type: targetRollType,
        minions_roll_type: minionsRollType,
      };

      console.log(payload)
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Failed to post effects: ${res.status}`);

      const conclusion = await res.json(); 
      set({ loading: false });
      return conclusion;

    } catch (err) {
      set({ error: err.message || "Unknown error", loading: false });
      return null;
    }
  },


}));

export default useDiceStore;
