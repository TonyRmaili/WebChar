import { create } from "zustand";

const API_BASE_CAMPAIGN = "http://localhost:8000/campaign";

// Recursively update a node's content in the tree by path
const patchNodeContent = (nodes, path, content) =>
  nodes.map((n) => {
    if (n.path === path) return { ...n, content };
    if (n.children) return { ...n, children: patchNodeContent(n.children, path, content) };
    return n;
  });


const ACTIVE_PROMPTS_KEY = (campaignName) => `activePrompts_${campaignName}`;

const loadActivePrompts = (campaignName) => {
  try {
    const raw = localStorage.getItem(ACTIVE_PROMPTS_KEY(campaignName));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveActivePrompts = (campaignName, paths) => {
  localStorage.setItem(ACTIVE_PROMPTS_KEY(campaignName), JSON.stringify(paths));
};

// Walk a tree to find a node by path and return its content
const findNodeContent = (nodes, path) => {
  for (const n of nodes) {
    if (n.path === path) return n.content ?? "";
    if (n.children) {
      const found = findNodeContent(n.children, path);
      if (found !== null) return found;
    }
  }
  return null;
};

// Collect all file paths from a tree (skips folders)
const collectFilePaths = (nodes) => {
  const paths = [];
  const walk = (arr) => {
    for (const n of arr) {
      if (n.type === "folder") {
        if (n.children) walk(n.children);
      } else {
        paths.push(n.path);
      }
    }
  };
  walk(nodes);
  return paths;
};

const useCampaignStore = create((set, get) => ({
  loading: false,
  error: null,
  campaignData: [],
  currentCampaignName: null,
  promptsData: [],
  activePrompts: [], // array of paths

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
      await Promise.all([get().refreshCampaignData(), get().refreshPromptsData()]);
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
      await Promise.all([get().refreshCampaignData(), get().refreshPromptsData()]);
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
      await Promise.all([get().refreshCampaignData(), get().refreshPromptsData()]);
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

      set({
        campaignData: patchNodeContent(get().campaignData, path, content),
        promptsData: patchNodeContent(get().promptsData, path, content),
      });

      return data;
    } catch (err) {
      set({ error: err.message || "Unknown error" });
    }
  },

  fetchPromptsData: async (campaignName) => {
    try {
      const url = `${API_BASE_CAMPAIGN}/prompts?campaign_name=${encodeURIComponent(campaignName)}`;
      const token = localStorage.getItem("token");
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to fetch prompts: ${res.status}`);
      const data = await res.json();

      // Prune active prompts that no longer exist on disk
      const existingPaths = new Set(collectFilePaths(data));
      const stored = loadActivePrompts(campaignName);
      const pruned = stored.filter((p) => existingPaths.has(p));
      if (pruned.length !== stored.length) {
        saveActivePrompts(campaignName, pruned);
      }

      set({
        promptsData: data,
        activePrompts: pruned,
      });
      return data;
    } catch (err) {
      set({ error: err.message || "Unknown error" });
    }
  },

  refreshPromptsData: async () => {
    const name = get().currentCampaignName;
    if (!name) return;
    await get().fetchPromptsData(name);
  },

  toggleActivePrompt: (path) => {
    const campaignName = get().currentCampaignName;
    if (!campaignName) return;

    const current = get().activePrompts;
    const next = current.includes(path)
      ? current.filter((p) => p !== path)
      : [...current, path];

    saveActivePrompts(campaignName, next);
    set({ activePrompts: next });
  },

  // Concatenate all active prompt contents — used later by the chat feature
  getActivePromptText: () => {
    const { promptsData, activePrompts } = get();
    const pieces = activePrompts
      .map((path) => findNodeContent(promptsData, path))
      .filter((c) => c !== null && c !== "");
    return pieces.join("\n\n---\n\n");
  },

  sendChat: async (chatInput, instructions, campaignName) => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_CAMPAIGN}/dm_assistant`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_input: chatInput,
          instructions: instructions,
          campaign_name: campaignName,
        }),
      });
      if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);
      const data = await res.json();
      set({ loading: false });
      return data;
    } catch (err) {
      set({ error: err.message || "Unknown error", loading: false });
    }
  },


}));

export default useCampaignStore;