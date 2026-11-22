import { create } from "zustand";
const API_BASE = "http://localhost:8000/catalogue";

/* ═══════════════════════════════════════════════════════════════════
   Catalogue store.

   catalogueSlice() makes the same five things for any catalogue:
     <list>            the entries: originals, then public, then private
                       homebrew (homebrew tagged with `visibility`)
     loading<List>     true while it loads
     <list>Error       the last load / save / delete error
     saving<One>       true while a create or update is on its way
     load<List>()      GET    /catalogue/<path>
     create<One>(rec)  POST   /catalogue/<path>          → the saved record
     update<One>(id, rec) PUT /catalogue/<path>/<id>     → the saved record
     delete<One>(id)   DELETE /catalogue/<path>/<id>

   The GET answer is the same for every catalogue:
     { original: [...], public_homebrew: [...], private_homebrew: [...] }

   Every catalogue uses it: backgrounds, feats, races, optional features,
   items, monsters, spells, classes and subclasses (two catalogues: a
   subclass never changes its class).
   ═══════════════════════════════════════════════════════════════════ */

const authHeaders = (json = false) => {
  const token = localStorage.getItem("token");
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}/${path}`, {
    method,
    headers: authHeaders(body !== undefined),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.status === 204 ? null : res.json();
}

const tagged = (list, visibility) =>
  (Array.isArray(list) ? list : []).map((e) => ({ ...e, visibility }));

// list: "backgrounds" · one: "Background" · path: the URL part (default = list)
function catalogueSlice(set, { list, one, path = list }) {
  const List = list[0].toUpperCase() + list.slice(1);
  const loading = `loading${List}`;
  const error = `${list}Error`;
  const saving = `saving${one}`;
  // a saved homebrew record keeps the visibility it was saved with
  const withVisibility = (saved, record) => ({
    ...saved,
    visibility: saved?.visibility || record?.visibility || "private",
  });

  return {
    [list]: [],
    [loading]: false,
    [error]: null,
    [saving]: false,

    [`load${List}`]: async () => {
      set({ [loading]: true, [error]: null });
      try {
        const data = await request(path);
        set({
          [list]: [
            ...(Array.isArray(data?.original) ? data.original : []),
            ...tagged(data?.public_homebrew, "public"),
            ...tagged(data?.private_homebrew, "private"),
          ],
        });
      } catch (e) {
        console.error(`load${List} failed:`, e);
        set({ [list]: [], [error]: e.message });
      } finally {
        set({ [loading]: false });
      }
    },

    [`create${one}`]: async (record) => {
      set({ [saving]: true, [error]: null });
      try {
        const saved = withVisibility(await request(path, { method: "POST", body: record }), record);
        set((s) => ({ [list]: [...(s[list] || []), saved] }));
        return saved;
      } catch (e) {
        console.error(`create${one} failed:`, e);
        set({ [error]: e.message });
        throw e;
      } finally {
        set({ [saving]: false });
      }
    },

    [`update${one}`]: async (id, record) => {
      set({ [saving]: true, [error]: null });
      try {
        const saved = withVisibility(
          await request(`${path}/${encodeURIComponent(id)}`, { method: "PUT", body: record }),
          record
        );
        set((s) => ({ [list]: (s[list] || []).map((e) => (e.id === id ? saved : e)) }));
        return saved;
      } catch (e) {
        console.error(`update${one} failed:`, e);
        set({ [error]: e.message });
        throw e;
      } finally {
        set({ [saving]: false });
      }
    },

    [`delete${one}`]: async (id) => {
      try {
        await request(`${path}/${encodeURIComponent(id)}`, { method: "DELETE" });
        set((s) => ({ [list]: (s[list] || []).filter((e) => e.id !== id) }));
      } catch (e) {
        console.error(`delete${one} failed:`, e);
        set({ [error]: e.message });
        throw e;
      }
    },
  };
}

export const useCatalogueStore = create((set, get) => ({
  ...catalogueSlice(set, { list: "backgrounds", one: "Background" }),
  ...catalogueSlice(set, { list: "feats", one: "Feat" }),
  ...catalogueSlice(set, { list: "races", one: "Race" }),
  ...catalogueSlice(set, { list: "optionalFeatures", one: "OptionalFeature", path: "optionalfeatures" }),
  ...catalogueSlice(set, { list: "items", one: "Item" }),
  ...catalogueSlice(set, { list: "monsters", one: "Monster" }),
  ...catalogueSlice(set, { list: "spells", one: "Spell" }),
  ...catalogueSlice(set, { list: "classes", one: "Class" }),
  ...catalogueSlice(set, { list: "subclasses", one: "Subclass" }),
  ...catalogueSlice(set, { list: "rules", one: "Rules" }),
}));
