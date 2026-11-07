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
const ACTIVE_FILES_KEY = (campaignName) => `activeFiles_${campaignName}`;

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

const loadActiveFiles = (campaignName) => {
  try {
    const raw = localStorage.getItem(ACTIVE_FILES_KEY(campaignName));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveActiveFiles = (campaignName, paths) => {
  localStorage.setItem(ACTIVE_FILES_KEY(campaignName), JSON.stringify(paths));
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

/* ── campaign copies (Party / NPCs) ── */

// One list per campaign and kind: campaignCharacters["Saltmarsh|npc"].
export const copiesKey = (campaignName, kind) => `${campaignName}|${kind}`;

const setCopies = (set, campaignName, kind, update) =>
  set((s) => {
    const key = copiesKey(campaignName, kind);
    return { campaignCharacters: { ...s.campaignCharacters, [key]: update(s.campaignCharacters[key] || []) } };
  });

const detailOf = (body, status) => (typeof body?.detail === "string" && body.detail) || `server said ${status}`;

const useCampaignStore = create((set, get) => ({
  loading: false,
  error: null,
  campaignData: [],
  currentCampaignName: null,
  promptsData: [],
  activePrompts: [],
  activeFiles: [],

  // Names of the user's campaigns, for pickers outside the campaign page
  // (e.g. "Add to the party of…" on the Characters page). Has its own
  // loading flag so it never touches the campaign page's spinner/errors.
  campaignNames: [],
  loadingCampaignNames: false,

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
      set({ loading: false, campaignNames: Array.isArray(data) ? data : [] });
      return data;
    } catch (err) {
      set({ error: err.message || "Unknown error", loading: false });
    }
  },

  // Quiet version of fetchCampaigns: only fills campaignNames.
  listCampaigns: async () => {
    if (get().loadingCampaignNames) return get().campaignNames;
    set({ loadingCampaignNames: true });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(API_BASE_CAMPAIGN, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Failed to list campaigns: ${res.status}`);
      const data = await res.json();
      const names = Array.isArray(data) ? data : [];
      set({ campaignNames: names, loadingCampaignNames: false });
      return names;
    } catch (err) {
      console.error(err);
      set({ loadingCampaignNames: false });
      return get().campaignNames;
    }
  },

  /* Copy one of the user's characters into a campaign, as a party member
     or as an NPC. The backend reads the character file it already has, so
     only the reference travels. See claude/campaign-export-contract.md.

     Returns { ok: true, data } on success, or
             { ok: false, conflict, status, message } when it didn't work.
     conflict = the copy already exists; send again with overwrite: true
     to replace it with a fresh copy. Never sets the store's error, so the
     campaign page isn't disturbed by a failed export elsewhere. */
  exportCharacter: async ({ campaignName, characterId, characterName, as, overwrite = false }) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_CAMPAIGN}/export_character`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaign_name: campaignName,
          character_id: characterId ?? null,
          character_name: characterName,
          as,
          overwrite,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = typeof data?.detail === "string" ? data.detail : null;
        return { ok: false, conflict: res.status === 409, status: res.status, message: detail || `server said ${res.status}` };
      }
      return { ok: true, data };
    } catch (err) {
      return { ok: false, conflict: false, status: 0, message: "couldn't reach the server" };
    }
  },

  /* ── Campaign copies (Campaign › Party / NPCs) ──
     Characters exported into a campaign, and monsters added from the
     catalogue. `kind` is "party", "npc" or "monster".
     Lists are kept per campaign AND kind — key them with copiesKey() —
     so cards from two campaigns can be open at once. Each entry is
     { file, data }: `file` is the copy's file name in the campaign (what
     the backend needs to save it back), `data` the full JSON. Errors are
     returned as { ok, message }, never put in the global `error`. */
  campaignCharacters: {},
  loadingCampaignCharacters: false,

  fetchCampaignCharacters: async (campaignName, kind) => {
    set({ loadingCampaignCharacters: true });
    try {
      const token = localStorage.getItem("token");
      const url = `${API_BASE_CAMPAIGN}/characters?campaign_name=${encodeURIComponent(campaignName)}&kind=${encodeURIComponent(kind)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, message: detailOf(data, res.status) };
      setCopies(set, campaignName, kind, () => (Array.isArray(data) ? data : []));
      return { ok: true };
    } catch {
      return { ok: false, message: "couldn't reach the server" };
    } finally {
      set({ loadingCampaignCharacters: false });
    }
  },

  // Updates the list straight away (so quick clicks on use dots build on
  // each other), and puts the old copy back if the server refuses.
  saveCampaignCharacter: async (campaignName, kind, file, data) => {
    const before = (get().campaignCharacters[copiesKey(campaignName, kind)] || []).find((c) => c.file === file);
    const put = (d) => setCopies(set, campaignName, kind, (rows) => rows.map((c) => (c.file === file ? { file, data: d } : c)));
    put(data);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_CAMPAIGN}/characters`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_name: campaignName, kind, file, data }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (before) put(before.data);
        return { ok: false, message: detailOf(body, res.status) };
      }
      return { ok: true };
    } catch {
      if (before) put(before.data);
      return { ok: false, message: "couldn't reach the server" };
    }
  },

  // A second copy next to the first ("Thorin (copy)"), e.g. for a group of guards.
  copyCampaignCharacter: async (campaignName, kind, file) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_CAMPAIGN}/characters/copy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_name: campaignName, kind, file }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, message: detailOf(body, res.status) };
      setCopies(set, campaignName, kind, (rows) => [...rows, body].sort((a, b) => a.file.localeCompare(b.file)));
      return { ok: true, entry: body };
    } catch {
      return { ok: false, message: "couldn't reach the server" };
    }
  },

  // Monsters from the catalogue: `monster` is already made ready for the
  // campaign (prepareMonster in statblock/monsterStatblock.js). `count`
  // copies are added, each its own file ("Goblin", "Goblin (1)", …).
  addCampaignMonsters: async (campaignName, monster, count = 1) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_CAMPAIGN}/monsters`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_name: campaignName, monster, count }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, message: detailOf(body, res.status) };
      const added = Array.isArray(body) ? body : [];
      setCopies(set, campaignName, "monster", (rows) => [...rows, ...added].sort((a, b) => a.file.localeCompare(b.file)));
      return { ok: true, added };
    } catch {
      return { ok: false, message: "couldn't reach the server" };
    }
  },

  removeCampaignCharacter: async (campaignName, kind, file) => {
    try {
      const token = localStorage.getItem("token");
      const url = `${API_BASE_CAMPAIGN}/characters?campaign_name=${encodeURIComponent(campaignName)}&kind=${encodeURIComponent(kind)}&file=${encodeURIComponent(file)}`;
      const res = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, message: detailOf(body, res.status) };
      setCopies(set, campaignName, kind, (rows) => rows.filter((c) => c.file !== file));
      return { ok: true };
    } catch {
      return { ok: false, message: "couldn't reach the server" };
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

      // Prune active files that no longer exist on disk
      const existingPaths = new Set(collectFilePaths(data));
      const stored = loadActiveFiles(campaignName);
      const pruned = stored.filter((p) => existingPaths.has(p));
      if (pruned.length !== stored.length) {
        saveActiveFiles(campaignName, pruned);
      }

      set({
        campaignData: data,
        currentCampaignName: campaignName,
        activeFiles: pruned,
        loading: false,
      });
      return data;
    } catch (err) {
      set({ error: err.message || "Unknown error", loading: false });
    }
  },

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

  toggleActivePrompt: (paths) => {
    const campaignName = get().currentCampaignName;
    if (!campaignName) return;

    const current = get().activePrompts;
    const next = new Set(current);
    const allActive = paths.length > 0 && paths.every((p) => next.has(p));
    if (allActive) paths.forEach((p) => next.delete(p));
    else paths.forEach((p) => next.add(p));

    const arr = Array.from(next);
    saveActivePrompts(campaignName, arr);
    set({ activePrompts: arr });
  },

  toggleActiveFiles: (paths) => {
    const campaignName = get().currentCampaignName;
    if (!campaignName) return;

    const current = get().activeFiles;
    const next = new Set(current);
    const allActive = paths.length > 0 && paths.every((p) => next.has(p));
    if (allActive) paths.forEach((p) => next.delete(p));
    else paths.forEach((p) => next.add(p));

    const arr = Array.from(next);
    saveActiveFiles(campaignName, arr);
    set({ activeFiles: arr });
  },

  // Concatenate all active prompt contents — used later by the chat feature
  getActivePromptText: () => {
    const { promptsData, activePrompts } = get();
    const pieces = activePrompts
      .map((path) => findNodeContent(promptsData, path))
      .filter((c) => c !== null && c !== "");
    return pieces.join("\n\n---\n\n");
  },

  sendChat: async (messages, instructions, campaignName) => {
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
          messages,
          instructions,
          campaign_name: campaignName,
          active_files: get().activeFiles,
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

  renameNode: async (path, newName) => {
    set({ error: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_CAMPAIGN}/rename`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path, new_name: newName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Rename failed: ${res.status}`);
      }
      const data = await res.json();
      await Promise.all([get().refreshCampaignData(), get().refreshPromptsData()]);
      return data;
    } catch (err) {
      set({ error: err.message || "Unknown error" });
    }
  },

  moveNode: async (sourcePath, targetFolder) => {
    set({ error: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_CAMPAIGN}/move`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source_path: sourcePath, target_folder: targetFolder }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Move failed: ${res.status}`);
      }
      const data = await res.json();
      await Promise.all([get().refreshCampaignData(), get().refreshPromptsData()]);
      return data;
    } catch (err) {
      set({ error: err.message || "Unknown error" });
    }
  },

  copyNode: async (path) => {
    set({ error: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_CAMPAIGN}/copy`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Copy failed: ${res.status}`);
      }
      const data = await res.json();
      await Promise.all([get().refreshCampaignData(), get().refreshPromptsData()]);
      return data;
    } catch (err) {
      set({ error: err.message || "Unknown error" });
    }
  },

  saveResponse: async (campaignName, content, fileName, folderPath = "") => {
    set({ error: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_CAMPAIGN}/save_response`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaign_name: campaignName,
          content,
          file_name: fileName,
          folder_path: folderPath,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Save failed: ${res.status}`);
      }
      const data = await res.json();
      await get().refreshCampaignData();
      return data;
    } catch (err) {
      set({ error: err.message || "Unknown error" });
    }
  },
}));

export default useCampaignStore;