import { create } from "zustand";

/* A store for things the server keeps one file per record, per campaign
   (groups, templates). Used by GroupStore.js and TemplateStore.js.

   records: { [campaignName]: [record, …] }

   Changes show at once and are written a moment later (`update`), so
   typing doesn't send a request per key. If the server refuses, the last
   saved version comes back and `problem` says why.

   Records that carry a `scope` (templates: "campaign" or "all") send it
   along on every call, so the server knows where the file is. */

const WRITE_DELAY = 400; // ms

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const asList = (v) => (Array.isArray(v) ? v : []);
const detailOf = (body, status) => (typeof body?.detail === "string" && body.detail) || `server said ${status}`;

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

export function createRecordStore(api) {
  const timers = {};
  const saved = {};
  const scopeOf = (r) => (r?.scope ? { scope: r.scope } : {});
  const query = (campaignName, r) => `campaign_name=${encodeURIComponent(campaignName)}${r?.scope ? `&scope=${r.scope}` : ""}`;

  return create((set, get) => {
    const setList = (campaignName, fn) => set((s) => ({ records: { ...s.records, [campaignName]: fn(asList(s.records[campaignName])) } }));
    const one = (campaignName, id) => asList(get().records[campaignName]).find((r) => r.id === id);
    const replaceOne = (campaignName, rec) => setList(campaignName, (list) => list.map((r) => (r.id === rec.id ? rec : r)));
    const added = (campaignName, rec) => {
      saved[rec.id] = rec;
      setList(campaignName, (list) => [...list, rec]);
      return { ok: true, record: rec };
    };

    return {
      records: {},
      loading: false,
      problem: null,

      fetch: async (campaignName) => {
        set({ loading: true });
        const res = await call(`${api}?${query(campaignName)}`);
        set({ loading: false });
        if (!res.ok) return res;
        asList(res.body).forEach((r) => (saved[r.id] = r));
        setList(campaignName, () => asList(res.body));
        return { ok: true };
      },

      // `body` is sent as is with the campaign name (e.g. { name } or { scope, data }).
      create: async (campaignName, body) => {
        const res = await call(api, { method: "POST", body: { campaign_name: campaignName, ...body } });
        return res.ok ? added(campaignName, res.body) : res;
      },

      update: (campaignName, id, change) => {
        const current = one(campaignName, id);
        if (!current) return;
        replaceOne(campaignName, change(current));
        clearTimeout(timers[id]);
        timers[id] = setTimeout(() => get().flush(campaignName, id), WRITE_DELAY);
      },

      flush: async (campaignName, id) => {
        clearTimeout(timers[id]);
        delete timers[id];
        const rec = one(campaignName, id);
        if (!rec) return { ok: true };
        const res = await call(`${api}/${id}`, { method: "PUT", body: { campaign_name: campaignName, ...scopeOf(rec), data: rec } });
        if (res.ok) {
          saved[id] = res.body;
          set({ problem: null });
        } else {
          set({ problem: `Couldn't save ${rec.name || "it"} — ${res.message}.` });
          if (saved[id] && !timers[id]) replaceOne(campaignName, saved[id]);
        }
        return res;
      },

      // A new record with the same contents; `extra` e.g. { to_scope: "all" }.
      copy: async (campaignName, id, extra = {}) => {
        if (timers[id]) await get().flush(campaignName, id);
        const rec = one(campaignName, id);
        const res = await call(`${api}/${id}/copy`, { method: "POST", body: { campaign_name: campaignName, ...scopeOf(rec), ...extra } });
        return res.ok ? added(campaignName, res.body) : res;
      },

      // Templates only: the same record kept in the other place.
      move: async (campaignName, id, toScope) => {
        if (timers[id]) await get().flush(campaignName, id);
        const rec = one(campaignName, id);
        const res = await call(`${api}/${id}/move`, { method: "POST", body: { campaign_name: campaignName, ...scopeOf(rec), to_scope: toScope } });
        if (!res.ok) return res;
        saved[id] = res.body;
        replaceOne(campaignName, res.body);
        return { ok: true, record: res.body };
      },

      remove: async (campaignName, id) => {
        clearTimeout(timers[id]);
        delete timers[id];
        const rec = one(campaignName, id);
        const res = await call(`${api}/${id}?${query(campaignName, rec)}`, { method: "DELETE" });
        if (!res.ok) return res;
        delete saved[id];
        setList(campaignName, (list) => list.filter((r) => r.id !== id));
        return { ok: true };
      },
    };
  });
}