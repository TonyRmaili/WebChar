import { create } from "zustand";

const API_BASE_CAMPAIGN = "http://localhost:8000/campaign";


const useCampaignStore = create((set, get) => ({
  loading: false,
  error: null,

  // helpers
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  

  fetchCampaigns: async () => {
    set({ loading: true, error: null });
    try {
      const url = `${API_BASE_CAMPAIGN}`;
      const token = localStorage.getItem("token");

      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`Failed to fetch campaigns: ${res.status}`);
      const data = await res.json();
      return data

    } catch (err) {
      set({ error: err.message || "Unknown error", loading: false });
    }
  },

  createCampaign: async (campaignName) => {
    set({ loading: true, error: null });

    try {
      
      const url = `${API_BASE_CAMPAIGN}?campaign_name=${encodeURIComponent(campaignName)}`
      const token = localStorage.getItem("token");

      const res = await fetch(url, {
        method: "POST",
        headers: {
        Authorization: `Bearer ${token}`,
      },
      });

      if (!res.ok) {
        throw new Error(`Failed to create campaign: ${res.status}`);
      }

      const data = await res.json();

      set({ loading: false });
      return data;
    } catch (err) {
      set({
        error: err.message || "Unknown error",
        loading: false,
      });
    }
  },
  
  selectCampaign: async (campaignName) => {

    set({ loading: true, error: null });

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE_CAMPAIGN}?campaign_name=${encodeURIComponent(campaignName)}`, {
        method: "PUT",
        headers: {
        Authorization: `Bearer ${token}`,
      },
  
      });

      if (!res.ok) {
        throw new Error(`Failed to select campaign: ${res.status}`);
      }

      const data = await res.json();

      set({ loading: false });
      return data;
    } catch (err) {
      set({
        error: err.message || "Unknown error",
        loading: false,
      });
    }
},

 
}));

export default useCampaignStore;
