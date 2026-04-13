import { create } from "zustand";

const API_BASE_CAMPAIGN = "http://localhost:8000/campaign";

// Recursively update a node's content in the tree by path
const patchNodeContent = (nodes, path, content) =>
  nodes.map((n) => {
    if (n.path === path) return { ...n, content };
    if (n.children) return { ...n, children: patchNodeContent(n.children, path, content) };
    return n;
  });

const useCampaignStore = create((set, get) => ({
  loading: false,
  error: null,
  campaignData: [],
  currentCampaignName: null,

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
      set({ loading: false });
      return data;
    } catch (err) {
      set({ error: err.message || "Unknown error", loading: false });
    }
  },

  createCampaign: async (campaignName) => {
    set({ loading: true, error: null });
    try {
      const url = `${API_BASE_CAMPAIGN}?campaign_name=${encodeURIComponent(campaignName)}`;
      const token = localStorage.getItem("token");
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to create campaign: ${res.status}`);
      const data = await res.json();
      set({ loading: false });
      return data;
    } catch (err) {
      set({ error: err.message || "Unknown error", loading: false });
    }
  },

  selectCampaign: async (campaignName) => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_BASE_CAMPAIGN}?campaign_name=${encodeURIComponent(campaignName)}`,
        { method: "PUT", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`Failed to select campaign: ${res.status}`);
      const data = await res.json();
      set({ loading: false });
      return data;
    } catch (err) {
      set({ error: err.message || "Unknown error", loading: false });
    }
  },

  deleteCampaign: async (campaignName) => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_BASE_CAMPAIGN}?campaign_name=${encodeURIComponent(campaignName)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`Failed to delete campaign: ${res.status}`);
      set({ loading: false });
    } catch (err) {
      set({ error: err.message || "Unknown error", loading: false });
    }
  },

  fetchCampaignData: async (campaignName) => {
    set({ loading: true, error: null });
    try {
      const url = `${API_BASE_CAMPAIGN}/data?campaign_name=${encodeURIComponent(campaignName)}`;
      const token = localStorage.getItem("token");
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to fetch campaign data: ${res.status}`);
      const data = await res.json();
      set({
        campaignData: data,
        currentCampaignName: campaignName,
        loading: false,
      });
      return data;
    } catch (err) {
      set({ error: err.message || "Unknown error", loading: false });
    }
  },

  // Re-fetch the tree for whatever campaign is currently loaded
  refreshCampaignData: async () => {
    const name = get().currentCampaignName;
    if (!name) return;
    await get().fetchCampaignData(name);
  },

  createFile: async (fileName, campaignName, path) => {
    set({ error: null });
    try {
      const url = `${API_BASE_CAMPAIGN}/create_file`;
      const token = localStorage.getItem("token");
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaign_name: campaignName,
          file_name: fileName,
          path: path,
        }),
      });
      if (!res.ok) throw new Error(`Failed to create file: ${res.status}`);
      const data = await res.json();
      await get().refreshCampaignData();
      return data;
    } catch (err) {
      set({ error: err.message || "Unknown error" });
    }
  },

  createFolder: async (folderName, campaignName, path) => {
    set({ error: null });
    try {
      const url = `${API_BASE_CAMPAIGN}/create_folder`;
      const token = localStorage.getItem("token");
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaign_name: campaignName,
          file_name: folderName,
          path: path,
        }),
      });
      if (!res.ok) throw new Error(`Failed to create folder: ${res.status}`);
      const data = await res.json();
      await get().refreshCampaignData();
      return data;
    } catch (err) {
      set({ error: err.message || "Unknown error" });
    }
  },

  deleteFile: async (fileName, path) => {
    set({ error: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_CAMPAIGN}/delete_file`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ file_name: fileName, path: path }),
      });
      if (!res.ok) throw new Error(`Failed to delete file: ${res.status}`);
      await get().refreshCampaignData();
    } catch (err) {
      set({ error: err.message || "Unknown error" });
    }
  },

  saveFile: async (path, content) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_CAMPAIGN}/update_file`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path, content }),
      });
      if (!res.ok) throw new Error(`Failed to save file: ${res.status}`);
      const data = await res.json();

      // Sync the in-memory tree with what we just wrote to disk,
      // so reopening the file shows the latest content.
      set({
        campaignData: patchNodeContent(get().campaignData, path, content),
      });

      return data;
    } catch (err) {
      set({ error: err.message || "Unknown error" });
    }
  },
}));

export default useCampaignStore;