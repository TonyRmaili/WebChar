import { create } from "zustand";

/* Encounters of a campaign (Campaign › Combat). Shape: see
   routers/encounters.py and claude/encounters-contract.md.

   encounters: { [campaignName]: [encounter, …] }

   Changes show at once and are written to the server a moment later
   (`update`), so typing notes or clicking use dots doesn't send a request
   per key. If the server refuses, the last saved version comes back. */

const API = "http://localhost:8000/campaign/encounters";
const WRITE_DELAY = 400; // ms

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const json = (body) => ({ headers: { ...auth(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
const detailOf = (body, status) => (typeof body?.detail === "string" && body.detail) || `server said ${status}`;
const asList = (v) => (Array.isArray(v) ? v : []);

async function call(url, opts = {}) {
  try {
    const res = await fetch(url, { ...opts, headers: { ...auth(), ...(opts.headers || {}) } });
    const body = await res.json().catch(() => null);
    return res.ok ? { ok: true, body } : { ok: false, message: detailOf(body, res.status) };
  } catch {
    return { ok: false, message: "couldn't reach the server" };
  }
}

// Writes waiting to go out, and the last version the server accepted.
const timers = {};
const saved = {};

const useEncounterStore = create((set, get) => {
  const setList = (campaignName, fn) => set((s) => ({ encounters: { ...s.encounters, [campaignName]: fn(asList(s.encounters[campaignName])) } }));
  const replaceOne = (campaignName, enc) => setList(campaignName, (list) => list.map((e) => (e.id === enc.id ? enc : e)));

  return {
    encounters: {},
    loading: false,
    problem: null, // last failed write, shown on the page

    fetchEncounters: async (campaignName) => {
      set({ loading: true });
      const res = await call(`${API}?campaign_name=${encodeURIComponent(campaignName)}`);
      set({ loading: false });
      if (!res.ok) return res;
      const list = asList(res.body);
      list.forEach((e) => (saved[e.id] = e));
      setList(campaignName, () => list);
      return { ok: true };
    },

    createEncounter: async (campaignName, name) => {
      const res = await call(API, { method: "POST", ...json({ campaign_name: campaignName, name }) });
      if (!res.ok) return res;
      saved[res.body.id] = res.body;
      setList(campaignName, (list) => [...list, res.body]);
      return { ok: true, encounter: res.body };
    },

    // Change an encounter: `change` gets the current one and returns the next.
    update: (campaignName, id, change) => {
      const current = asList(get().encounters[campaignName]).find((e) => e.id === id);
      if (!current) return;
      replaceOne(campaignName, change(current));
      clearTimeout(timers[id]);
      timers[id] = setTimeout(() => get().flush(campaignName, id), WRITE_DELAY);
    },

    // Send a waiting change now (also used by the timer).
    flush: async (campaignName, id) => {
      clearTimeout(timers[id]);
      delete timers[id];
      const enc = asList(get().encounters[campaignName]).find((e) => e.id === id);
      if (!enc) return { ok: true };
      const res = await call(`${API}/${id}`, { method: "PUT", ...json({ campaign_name: campaignName, data: enc }) });
      if (res.ok) {
        saved[id] = res.body;
        set({ problem: null });
        // Keep what's on screen if more changes came in while this one was out.
        if (!timers[id]) replaceOne(campaignName, { ...asList(get().encounters[campaignName]).find((e) => e.id === id), updated_at: res.body.updated_at });
      } else {
        set({ problem: `Couldn't save ${enc.name} — ${res.message}.` });
        if (saved[id] && !timers[id]) replaceOne(campaignName, saved[id]);
      }
      return res;
    },

    copyEncounter: async (campaignName, id) => {
      if (timers[id]) await get().flush(campaignName, id);
      const res = await call(`${API}/${id}/copy`, { method: "POST", ...json({ campaign_name: campaignName }) });
      if (!res.ok) return res;
      saved[res.body.id] = res.body;
      setList(campaignName, (list) => [...list, res.body]);
      return { ok: true, encounter: res.body };
    },

    deleteEncounter: async (campaignName, id) => {
      clearTimeout(timers[id]);
      delete timers[id];
      const res = await call(`${API}/${id}?campaign_name=${encodeURIComponent(campaignName)}`, { method: "DELETE" });
      if (!res.ok) return res;
      delete saved[id];
      setList(campaignName, (list) => list.filter((e) => e.id !== id));
      return { ok: true };
    },

    // A party member or NPC left the campaign; the server already took them
    // out of every encounter, so do the same on screen.
    dropMember: (campaignName, kind, file) =>
      setList(campaignName, (list) =>
        list.map((e) => {
          const members = asList(e.members).filter((m) => !(m.kind === kind && m.file === file));
          if (members.length === asList(e.members).length) return e;
          const next = { ...e, members };
          saved[e.id] = next;
          return next;
        })
      ),
  };
});

export default useEncounterStore;