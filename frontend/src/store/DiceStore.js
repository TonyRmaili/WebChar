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


}));

export default useDiceStore;
