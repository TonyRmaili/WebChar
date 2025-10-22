// store/DndStore.js
import { create } from "zustand";
const API_BASE = "http://localhost:8000";

export const useDnDStore = create((set, get) => ({
  files: [],
  loadingFiles: false,
  selectedFile: "",
  spellNames: [],
  loadingSpellNames: false,
  selectedSpell: "",
  error: null,

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

  onSelectSpell: (name) => set({ selectedSpell: name }),
}));
