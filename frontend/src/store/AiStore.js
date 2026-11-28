import { create } from "zustand";

/* ═══════════════════════════════════════════════════════════════════
   AiStore — today's AI tokens (backend: routers/ai.py, app/ai_usage.py).

   usage = { daily_limit (null = none), used, words, pictures, search,
             left, resets_in_minutes }

   "Today" is the user's own day: every refresh tells the server this
   browser's clock, and the count starts again at midnight here.
   The assistant panel, the notes' Paint and Settings refresh it after
   anything that spends tokens.
   ═══════════════════════════════════════════════════════════════════ */

const API = "http://localhost:8000/ai";
const auth = (json = false) => ({
  ...(json ? { "Content-Type": "application/json" } : {}),
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export const useAiStore = create((set) => ({
  usage: null,
  error: null,

  refresh: async () => {
    try {
      const res = await fetch(`${API}/usage?utc_offset=${new Date().getTimezoneOffset()}`, { headers: auth() });
      if (!res.ok) throw new Error(`server said ${res.status}`);
      set({ usage: await res.json(), error: null });
    } catch (e) {
      set({ error: "couldn't read today's tokens" });
    }
  },

  // A whole number of tokens a day, or null for no limit. → { ok, message? }
  setLimit: async (dailyLimit) => {
    try {
      const res = await fetch(`${API}/limit`, { method: "PUT", headers: auth(true), body: JSON.stringify({ daily_limit: dailyLimit }) });
      const body = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, message: typeof body?.detail === "string" ? body.detail : "That limit couldn't be saved" };
      set({ usage: body, error: null });
      return { ok: true };
    } catch {
      return { ok: false, message: "couldn't reach the server" };
    }
  },
}));

export const tokens = (n) => Number(n || 0).toLocaleString();
// 12,340 → "12.3k", 2,500,000 → "2.5M"
export const shortTokens = (n) => {
  const v = Number(n || 0);
  if (v >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (v >= 1e4) return `${Math.round(v / 1e3)}k`;
  if (v >= 1e3) return `${+(v / 1e3).toFixed(1)}k`;
  return String(v);
};
export const untilMidnight = (minutes) => {
  const h = Math.floor((minutes || 0) / 60);
  const m = (minutes || 0) % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
};
