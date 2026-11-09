import { create } from "zustand";

/* The dice tower's store. Every roll in WebChar goes through here to the
   backend (routers/dice.py → app/dice/engine.py); nothing is rolled in
   the browser.

     roll(lines, source)          free rolls: [{ label, expression, times, mode }]
     saves(request, meta)         many targets save against one effect
     attacks(request, meta)       volleys of attacks against an AC

   Each answer also lands in `log` (newest first), with where it came from
   ("Dice tower", "Tracker · Bridge ambush", …). The log lives only while
   the app is open — a reload starts it empty.

   loadouts: your saved sets of rolls (null until fetched). The tower edits
   a draft and saves it whole with saveLoadout() when you press done, so
   a half-typed "1d" is never checked. */

const API = "http://localhost:8000/dice";
const LOG_SIZE = 200;

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const asList = (v) => (Array.isArray(v) ? v : []);
const detailOf = (body, status) => (typeof body?.detail === "string" && body.detail) || (Array.isArray(body?.detail) && body.detail[0]?.msg) || `server said ${status}`;

async function call(url, { method = "GET", body } = {}) {
  try {
    const res = await fetch(url, {
      method,
      headers: { ...auth(), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return res.ok ? { ok: true, body: data } : { ok: false, message: detailOf(data, res.status) };
  } catch {
    return { ok: false, message: "couldn't reach the server" };
  }
}

let nextId = 1;

const useDiceStore = create((set) => {
  // Every answer is kept in the log: { id, at, kind, source, label, request, result }.
  const logged = (kind, { source = "Dice tower", label = "" } = {}, request, result) => {
    const entry = { id: nextId++, at: Date.now(), kind, source, label, request, result };
    set((s) => ({ log: [entry, ...s.log].slice(0, LOG_SIZE) }));
    return entry;
  };

  const ask = async (path, request, kind, meta) => {
    const res = await call(`${API}/${path}`, { method: "POST", body: request });
    if (!res.ok) return res;
    return { ok: true, result: res.body, entry: logged(kind, meta, request, res.body) };
  };

  const failed = (res, what) => {
    set({ problem: `${what} — ${res.message}.` });
    return res;
  };

  return {
    log: [],
    loadouts: null,
    problem: null,
    tab: "roll", // the tower's open tab: "roll" | "minions"
    setTab: (tab) => set({ tab }),

    /* ── rolling ── */
    roll: (lines, meta) => ask("roll", { rolls: lines }, "roll", meta),
    saves: (request, meta) => ask("saves", request, "saves", meta),
    attacks: (request, meta) => ask("attacks", request, "attacks", meta),
    clearLog: () => set({ log: [] }),

    /* ── loadouts ── */
    // A problem fetching, making or deleting one lands in `problem`.
    fetchLoadouts: async () => {
      const res = await call(`${API}/loadouts`);
      if (!res.ok) return failed(res, "Couldn't fetch your loadouts");
      set({ problem: null, loadouts: asList(res.body).sort((a, b) => String(a.name).localeCompare(String(b.name))) });
      return { ok: true };
    },

    createLoadout: async (data) => {
      const res = await call(`${API}/loadouts`, { method: "POST", body: { data } });
      if (!res.ok) return failed(res, "Couldn't make the loadout");
      set((s) => ({ problem: null, loadouts: [...asList(s.loadouts), res.body] }));
      return { ok: true, loadout: res.body };
    },

    // Save a whole loadout now (the tower's "done"). A problem is only
    // returned — the tower keeps its draft so you can fix the line.
    saveLoadout: async (rec) => {
      const res = await call(`${API}/loadouts/${rec.id}`, { method: "PUT", body: { data: rec } });
      if (!res.ok) return res;
      set((s) => ({ problem: null, loadouts: asList(s.loadouts).map((l) => (l.id === rec.id ? res.body : l)) }));
      return { ok: true, loadout: res.body };
    },

    removeLoadout: async (id) => {
      const res = await call(`${API}/loadouts/${id}`, { method: "DELETE" });
      if (!res.ok) return failed(res, "Couldn't delete the loadout");
      set((s) => ({ problem: null, loadouts: asList(s.loadouts).filter((l) => l.id !== id) }));
      return { ok: true };
    },
  };
});

export default useDiceStore;