import { create } from "zustand";
const API_BASE = "http://localhost:8000/catalogue";

export const useCatalogueStore = create((set, get) => ({
  items: [],
  loadingItems: false,

  races: [],
  loadingRaces: false,

  classes: [],
  loadingClasses: false,

  featsData: {},
  loadingFeats: false,

  backgroundsData: [],
  loadingBackgrounds: false,

  spellsData: [],
  loadingSpells: false,

  optionalFeaturesData: [],
  loadingOptionalFeatures: false,

  monstersData: [],
  loadingMonsters: false,

  creatingRace: false,
  createError: null,

  creatingItem: false,
  createItemError: null,

  creatingFeat: false,
  createFeatError: null,

  creatingBackground: false,
  createBackgroundError: null,

  creatingOptionalFeature: false,
  createOptionalFeatureError: null,

  creatingMonster: false,
  createMonsterError: null,




  loadRaces: async () => {
    set({ loadingRaces: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/races`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const original = Array.isArray(data?.original) ? data.original : [];
      const publicHomebrew = Array.isArray(data?.public_homebrew) ? data.public_homebrew : [];
      const privateHomebrew = Array.isArray(data?.private_homebrew) ? data.private_homebrew : [];
      set({ races: [...original, ...publicHomebrew, ...privateHomebrew] });
    } catch (e) {
      console.error(e);
      set({ races: [], error: e.message });
    } finally {
      set({ loadingRaces: false });
    }
  },

  createRace: async (payload) => {
    set({ creatingRace: true, createError: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/races`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      const created = await res.json();
      set((s) => ({ races: [...(s.races || []), created] }));
      return created;
    } catch (e) {
      console.error("createRace failed:", e);
      set({ createError: e.message });
      throw e;
    } finally {
      set({ creatingRace: false });
    }
  },

  updateRace: async (id, payload) => {
    set({ creatingRace: true, createError: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/races/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      const updated = await res.json();
      set((s) => ({
        races: (s.races || []).map((r) => (r.id === id ? updated : r)),
      }));
      return updated;
    } catch (e) {
      console.error("updateRace failed:", e);
      set({ createError: e.message });
      throw e;
    } finally {
      set({ creatingRace: false });
    }
  },

  deleteRace: async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/races/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      set((s) => ({ races: (s.races || []).filter((r) => r.id !== id) }));
    } catch (e) {
      console.error("deleteRace failed:", e);
      set({ error: e.message });
      throw e;
    }
  },



  loadItems: async () => {
    set({ loadingItems: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/items`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const original = Array.isArray(data?.original) ? data.original : [];
      const publicHomebrew = (Array.isArray(data?.public_homebrew) ? data.public_homebrew : [])
        .map((it) => ({ ...it, visibility: "public" }));
      const privateHomebrew = (Array.isArray(data?.private_homebrew) ? data.private_homebrew : [])
        .map((it) => ({ ...it, visibility: "private" }));
      set({ items: [...original, ...publicHomebrew, ...privateHomebrew] });
    } catch (e) {
      console.error(e);
      set({ items: [], error: e.message });
    } finally {
      set({ loadingItems: false });
    }
  },

  createItem: async (payload) => {
    set({ creatingItem: true, createItemError: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      const created = await res.json();
      set((s) => ({ items: [...(s.items || []), created] }));
      return created;
    } catch (e) {
      console.error("createItem failed:", e);
      set({ createItemError: e.message });
      throw e;
    } finally {
      set({ creatingItem: false });
    }
  },

  updateItem: async (id, payload) => {
    set({ creatingItem: true, createItemError: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/items/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      const updated = await res.json();
      set((s) => ({
        items: (s.items || []).map((it) => (it.id === id ? updated : it)),
      }));
      return updated;
    } catch (e) {
      console.error("updateItem failed:", e);
      set({ createItemError: e.message });
      throw e;
    } finally {
      set({ creatingItem: false });
    }
  },

  deleteItem: async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/items/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      set((s) => ({ items: (s.items || []).filter((it) => it.id !== id) }));
    } catch (e) {
      console.error("deleteItem failed:", e);
      set({ error: e.message });
      throw e;
    }
  },

  loadClasses: async () => {
    set({ loadingClasses: true, error: null });

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/classes`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      set({ classes: data });

    } catch (e) {
      console.error(e);

      set({
        classes: {},
        error: e.message,
      });

    } finally {
      set({ loadingClasses: false });
    }
  },

  loadFeats: async () => {
    set({ loadingFeats: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/feats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const og = Array.isArray(data?.feats) ? data.feats : [];
      const publicHB = (Array.isArray(data?.public_feats) ? data.public_feats : [])
        .map((f) => ({ ...f, visibility: "public" }));
      const privateHB = (Array.isArray(data?.private_feats) ? data.private_feats : [])
        .map((f) => ({ ...f, visibility: "private" }));

      set({
        featsData: {
          ...data,
          feats: [...og, ...publicHB, ...privateHB],
        },
      });
    } catch (e) {
      console.error(e);
      set({
        featsData: {
          feats: [],
          public_feats: [],
          private_feats: [],
          sources: [],
          categories: [],
        },
        error: e.message,
      });
    } finally {
      set({ loadingFeats: false });
    }
  },

  createFeat: async (payload) => {
    set({ creatingFeat: true, createFeatError: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/feats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      const created = await res.json();
      set((s) => ({
        featsData: {
          ...s.featsData,
          feats: [...(s.featsData?.feats || []), created],
        },
      }));
      return created;
    } catch (e) {
      console.error("createFeat failed:", e);
      set({ createFeatError: e.message });
      throw e;
    } finally {
      set({ creatingFeat: false });
    }
  },

  updateFeat: async (id, payload) => {
    set({ creatingFeat: true, createFeatError: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/feats/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      const updated = await res.json();
      set((s) => ({
        featsData: {
          ...s.featsData,
          feats: (s.featsData?.feats || []).map((f) => (f.id === id ? updated : f)),
        },
      }));
      return updated;
    } catch (e) {
      console.error("updateFeat failed:", e);
      set({ createFeatError: e.message });
      throw e;
    } finally {
      set({ creatingFeat: false });
    }
  },

  deleteFeat: async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/feats/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      set((s) => ({
        featsData: {
          ...s.featsData,
          feats: (s.featsData?.feats || []).filter((f) => f.id !== id),
        },
      }));
    } catch (e) {
      console.error("deleteFeat failed:", e);
      set({ error: e.message });
      throw e;
    }
  },





  loadBackgrounds: async () => {
    set({ loadingBackgrounds: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/backgrounds`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const og = Array.isArray(data?.backgrounds) ? data.backgrounds : [];
      const publicHB = (Array.isArray(data?.public_backgrounds) ? data.public_backgrounds : [])
        .map((b) => ({ ...b, visibility: "public" }));
      const privateHB = (Array.isArray(data?.private_backgrounds) ? data.private_backgrounds : [])
        .map((b) => ({ ...b, visibility: "private" }));

      set({
        backgroundsData: {
          ...data,
          backgrounds: [...og, ...publicHB, ...privateHB],
        },
      });
    } catch (e) {
      console.error(e);
      set({
        backgroundsData: { backgrounds: [], public_backgrounds: [], private_backgrounds: [], feats: [], sources: [] },
        error: e.message,
      });
    } finally {
      set({ loadingBackgrounds: false });
    }
  },

  createBackground: async (payload) => {
    set({ creatingBackground: true, createBackgroundError: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/backgrounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      const created = await res.json();
      set((s) => ({
        backgroundsData: {
          ...s.backgroundsData,
          backgrounds: [...(s.backgroundsData?.backgrounds || []), created],
        },
      }));
      return created;
    } catch (e) {
      console.error("createBackground failed:", e);
      set({ createBackgroundError: e.message });
      throw e;
    } finally {
      set({ creatingBackground: false });
    }
  },

  updateBackground: async (id, payload) => {
    set({ creatingBackground: true, createBackgroundError: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/backgrounds/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      const updated = await res.json();
      set((s) => ({
        backgroundsData: {
          ...s.backgroundsData,
          backgrounds: (s.backgroundsData?.backgrounds || []).map((b) => (b.id === id ? updated : b)),
        },
      }));
      return updated;
    } catch (e) {
      console.error("updateBackground failed:", e);
      set({ createBackgroundError: e.message });
      throw e;
    } finally {
      set({ creatingBackground: false });
    }
  },

  deleteBackground: async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/backgrounds/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      set((s) => ({
        backgroundsData: {
          ...s.backgroundsData,
          backgrounds: (s.backgroundsData?.backgrounds || []).filter((b) => b.id !== id),
        },
      }));
    } catch (e) {
      console.error("deleteBackground failed:", e);
      set({ error: e.message });
      throw e;
    }
  },

  


  loadSpells: async () => {
    set({ loadingSpells: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/spells`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      set({ spellsData: data });

     } catch (e) {
      console.error(e);

      set({
        spellsData: {
          area_tags: [],
          schools: [],
          sources: [],
          spells: [],
          class_list: {}
        },
        error: e.message,
      });

    } finally {
      set({ loadingSpells: false });
    }
  },

  loadOptionalFeatures: async () => {
    set({ loadingOptionalFeatures: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/optional_features`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const og = Array.isArray(data?.features) ? data.features : [];
      const publicHB = (Array.isArray(data?.public_features) ? data.public_features : [])
        .map((f) => ({ ...f, visibility: "public" }));
      const privateHB = (Array.isArray(data?.private_features) ? data.private_features : [])
        .map((f) => ({ ...f, visibility: "private" }));

      set({
        optionalFeaturesData: {
          ...data,
          features: [...og, ...publicHB, ...privateHB],
        },
      });
    } catch (e) {
      console.error(e);
      set({ optionalFeaturesData: { features: [] }, error: e.message });
    } finally {
      set({ loadingOptionalFeatures: false });
    }
  },

  createOptionalFeature: async (payload) => {
    set({ creatingOptionalFeature: true, createOptionalFeatureError: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/optional_features`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      const created = await res.json();
      set((s) => ({
        optionalFeaturesData: {
          ...s.optionalFeaturesData,
          features: [...(s.optionalFeaturesData?.features || []), created],
        },
      }));
      return created;
    } catch (e) {
      console.error("createOptionalFeature failed:", e);
      set({ createOptionalFeatureError: e.message });
      throw e;
    } finally {
      set({ creatingOptionalFeature: false });
    }
  },

  updateOptionalFeature: async (id, payload) => {
    set({ creatingOptionalFeature: true, createOptionalFeatureError: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/optional_features/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      const updated = await res.json();
      set((s) => ({
        optionalFeaturesData: {
          ...s.optionalFeaturesData,
          features: (s.optionalFeaturesData?.features || []).map((f) => (f.id === id ? updated : f)),
        },
      }));
      return updated;
    } catch (e) {
      console.error("updateOptionalFeature failed:", e);
      set({ createOptionalFeatureError: e.message });
      throw e;
    } finally {
      set({ creatingOptionalFeature: false });
    }
  },

  deleteOptionalFeature: async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/optional_features/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      set((s) => ({
        optionalFeaturesData: {
          ...s.optionalFeaturesData,
          features: (s.optionalFeaturesData?.features || []).filter((f) => f.id !== id),
        },
      }));
    } catch (e) {
      console.error("deleteOptionalFeature failed:", e);
      set({ error: e.message });
      throw e;
    }
  },

  loadMonsters: async () => {
    set({ loadingMonsters: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/monsters`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      // Tag homebrew with visibility; backend returns these two arrays like feats/items.
      const tag = (arr, v) =>
        (Array.isArray(arr) ? arr : []).map((m) => ({ ...m, visibility: v }));
      const homebrew = [
        ...tag(data?.public_monsters, "public"),
        ...tag(data?.private_monsters, "private"),
      ];

      const root =
        data && typeof data.monsters === "object" && data.monsters ? data.monsters : {};
      const monsters = homebrew.length
        ? {
            ...root,
            HOMEBREW: [
              ...(Array.isArray(root.HOMEBREW) ? root.HOMEBREW : []),
              ...homebrew,
            ],
          }
        : root;

      set({ monstersData: { ...data, monsters } });
    } catch (e) {
      console.error(e);
      set({ monstersData: [], error: e.message });
    } finally {
      set({ loadingMonsters: false });
    }
  },

  createMonster: async (payload) => {
    set({ creatingMonster: true, createMonsterError: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/monsters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      const created = await res.json();
      const tagged = { ...created, visibility: created.visibility || payload.visibility || "private" };
      set((s) => {
        const root = s.monstersData?.monsters || {};
        const hb = Array.isArray(root.HOMEBREW) ? root.HOMEBREW : [];
        return {
          monstersData: {
            ...s.monstersData,
            monsters: { ...root, HOMEBREW: [...hb, tagged] },
          },
        };
      });
      return created;
    } catch (e) {
      console.error("createMonster failed:", e);
      set({ createMonsterError: e.message });
      throw e;
    } finally {
      set({ creatingMonster: false });
    }
  },

  updateMonster: async (id, payload) => {
    set({ creatingMonster: true, createMonsterError: null });
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/monsters/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      const updated = await res.json();
      const tagged = { ...updated, visibility: updated.visibility || payload.visibility || "private" };
      set((s) => {
        const root = s.monstersData?.monsters || {};
        const hb = (Array.isArray(root.HOMEBREW) ? root.HOMEBREW : []).map((m) =>
          m.id === id ? tagged : m
        );
        return {
          monstersData: {
            ...s.monstersData,
            monsters: { ...root, HOMEBREW: hb },
          },
        };
      });
      return updated;
    } catch (e) {
      console.error("updateMonster failed:", e);
      set({ createMonsterError: e.message });
      throw e;
    } finally {
      set({ creatingMonster: false });
    }
  },

  deleteMonster: async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/monsters/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }
      set((s) => {
        const root = s.monstersData?.monsters || {};
        const hb = (Array.isArray(root.HOMEBREW) ? root.HOMEBREW : []).filter(
          (m) => m.id !== id
        );
        return {
          monstersData: {
            ...s.monstersData,
            monsters: { ...root, HOMEBREW: hb },
          },
        };
      });
    } catch (e) {
      console.error("deleteMonster failed:", e);
      set({ error: e.message });
      throw e;
    }
  },


}));
