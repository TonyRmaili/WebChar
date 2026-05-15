// store/DndStore.js
import { create } from "zustand";
const API_BASE = "http://localhost:8000/5etools";

export const useDnDStore = create((set, get) => ({
  files: [],
  loadingFiles: false,
  selectedFile: "",
  spellNames: [],
  loadingSpellNames: false,
  selectedSpell: "",
  error: null,
  loadingSpell: false,
  spellData: JSON.parse(localStorage.getItem("spellData") || "{}"),

  items: [],
  loadingItems: false,
  races: [],
  loadingRaces: false,
  classes: [],
  loadingClasses: false,
  featsData: {},
  loadingFeats: false,
  backgrounds: [],
  loadingBackgrounds: false,



  loadRaces: async () => {
    set({ loadingRaces: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/races`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      set({ races: Array.isArray(data) ? data : [] });
    } catch (e) {
      console.error(e);
      set({ races: [], error: e.message });
    } finally {
      set({ loadingRaces: false });
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
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : [];
      set({ items: list });
    } catch (e) {
      console.error(e);
      set({ items: [], error: e.message });
    } finally {
      set({ loadingItems: false });
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

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      set({ featsData: data });

    } catch (e) {
      console.error(e);

      set({
        featsData: {
          feats: [],
          sources: [],
          categories: [],
        },
        error: e.message,
      });

    } finally {
      set({ loadingFeats: false });
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
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.backgrounds)
        ? data.backgrounds
        : [];
      set({ backgrounds: list });
    } catch (e) {
      console.error(e);
      set({ backgrounds: [], error: e.message });
    } finally {
      set({ loadingBackgrounds: false });
    }
  },



  loadFiles: async () => {
    set({ loadingFiles: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/5etools/spells/filenames`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      set({ files: Array.isArray(data) ? data : [] });
    } catch (e) {
      console.error(e);
      set({ files: [], error: e.message });
    } finally {
      set({ loadingFiles: false });
    }
  },


  onSelectFile: async (filename) => {
    set({ selectedFile: filename, spellNames: [], selectedSpell: "" });
    if (!filename) return;
    try {
      set({ loadingSpellNames: true, error: null });
      const url = `${API_BASE}/5etools/spells/load_spells/${encodeURIComponent(filename)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const names = await res.json();              // ["Fireball","Mage Armor",...]
      set({ spellNames: Array.isArray(names) ? names : [] });
    } catch (e) {
      console.error(e);
      set({ spellNames: [], error: e.message });
    } finally {
      set({ loadingSpellNames: false });
    }
  },

  
  onSelectSpell: async (name) => {
  const { selectedFile } = get(); 
  set({ selectedSpell: name });

  if (!name || !selectedFile) return;

  try {
    set({ loadingSpell: true, error: null });

    const res = await fetch(
      `${API_BASE}/5etools/spells/select_spell/${encodeURIComponent(selectedFile)}/${encodeURIComponent(name)}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const spellData = typeof data === "object" && data !== null ? data : {};

    set({ spellData });
    localStorage.setItem("spellData", JSON.stringify(spellData))

    console.log("Saved spellData:", spellData);

  } catch (e) {
    console.error(e);
    set({ spellData: {}, error: e.message });
  } finally {
    set({ loadingSpell: false });
  }
},


}));
