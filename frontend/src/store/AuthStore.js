import { create } from "zustand";
import { api, clearToken, getToken, setToken, setUnauthorizedHandler } from "../utils/api";
import useCharStore from "./CharStore";
import useMinionStore from "./MinionStore";

/* Who is logged in.

     token        the login token (kept in localStorage by utils/api.js,
                  so a reload keeps you logged in)
     userData     /me: { id, name, email, selected_campaign,
                  characters: [{ id, name, active }] }. Memory only:
                  fetched at start-up (Layout) and after anything that
                  changes the character list.
     userStatus   "idle" | "loading" | "ready" | "error", so a page can
                  tell "still loading" from "the server is down"
     busy, error  for the log-in and create-account forms */

const useAuthStore = create((set, get) => ({
  token: getToken(),
  userData: null,
  userStatus: "idle",
  busy: false,
  error: "",

  setError: (error) => set({ error }),

  /* ── the logged-in user ── */

  fetchUser: async () => {
    if (!get().token) return null;
    set({ userStatus: "loading" });
    try {
      const userData = await api.get("/me");
      set({ userData, userStatus: "ready" });
      return userData;
    } catch (e) {
      // A 401 has already logged out (see the handler at the bottom).
      if (e.status !== 401) {
        console.error("Couldn't load the user:", e.message);
        set({ userStatus: "error" });
      }
      return null;
    }
  },

  // The campaign the server remembers as last opened (Campaigns page).
  // Only updates the copy in memory; the server is told by CampaignStore.
  setSelectedCampaign: (name) =>
    set((s) => (s.userData ? { userData: { ...s.userData, selected_campaign: name || null } } : {})),

  /* ── log in / out ── */

  logIn: async (name, password) => {
    set({ error: "", busy: true });

    const form = new FormData();
    form.append("username", name);
    form.append("password", password);

    try {
      const data = await api.post("/login", form, { auth: false });
      setToken(data.access_token);
      set({ token: data.access_token });
      await get().fetchUser();
      return true;
    } catch (e) {
      if (e.status === 400 || e.status === 401) set({ error: "That name and secret phrase don't match." });
      else if (e.status === 0) set({ error: "Can't reach the server." });
      else set({ error: "Log in failed — try again." });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  // `save: false` when the token is already dead (nothing could be saved).
  logout: async ({ save = true } = {}) => {
    if (save) await useCharStore.getState().flushSaves();
    clearToken();
    useCharStore.getState().reset();
    useMinionStore.getState().reset();
    set({ token: null, userData: null, userStatus: "idle" });
  },

  /* ── account ── */

  createAccount: async (formData) => {
    set({ error: "", busy: true });
    try {
      await api.post("/create_account", formData, { auth: false });
      return true;
    } catch (e) {
      set({ error: e.status === 0 ? "Can't reach the server." : "Couldn't create the account — that name may be taken." });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  deleteAccount: async () => {
    try {
      await api.del("/delete_account");
    } finally {
      await get().logout({ save: false });
    }
  },
}));

// Any logged-in request answered with 401: the token has expired or is
// wrong, so log out (without trying to save — it would fail the same way).
setUnauthorizedHandler(() => {
  if (useAuthStore.getState().token) useAuthStore.getState().logout({ save: false });
});

export default useAuthStore;