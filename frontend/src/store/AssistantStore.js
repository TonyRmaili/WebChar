import { create } from "zustand";
import useCampaignStore from "./CampaignStore";
import { useAiStore } from "./AiStore";
import {
  askAssistant,
  fetchAssistantSettings,
  fetchChat,
  paintPicture,
  pickCampaign,
  saveChat,
  saveInstructions,
} from "../components/assistant/assistantApi";

/* ═══════════════════════════════════════════════════════════════════
   AssistantStore — the footer's Assistant window (components/assistant).

   Kept here rather than in the window, so an answer keeps streaming in
   and nothing typed is lost while the window is put away.

   campaign       the one it's on: a name, or "" for no campaign (then no
                  notes search, no "save as note", your own instructions)
   pageCampaign   the campaign the Campaigns page has open, for "use it?"
   chatFor        which campaign `chats` belong to (null while loading)
   chats          two threads, like two tabs: words and pictures
   drafts         what's half typed in each tab's box
   busy           a tab waiting for its answer or picture

   Messages: { role, content }, plus
     a picture asked for:  { role: "user", content, picture: true }
     a picture made:       { role: "assistant", content: "[Picture: …]", image: { file, prompt } }
     it didn't work:       { role: "assistant", content: <why>, failed: true }
     edited / saved:       edited: true, saved: true
     the notes it read:    sources: [{ note, path, sections, score, words }]
                           notes: "all" | "search" | "none" | "failed", search_error
     being written:        streaming: true (the answer grows as it streams)
     cut short:            stopped: "stopped" or what broke
   The model gets the words tab as { role, content }, failures left out.

   The chat is saved on the server a moment after each change
   (backend routers/assistant.py), one per campaign and one without.
   ═══════════════════════════════════════════════════════════════════ */

const EMPTY = { words: [], pictures: [] };
const NO_DRAFTS = { words: "", pictures: "" };
const SAVE_AFTER = 800; // ms

let saveTimer = null;
let stopper = null; // the AbortController of the answer being written
let started = false; // load() ran

export const useAssistantStore = create((set, get) => {
  // Save what's there now (and stop waiting to).
  const flushChat = async () => {
    clearTimeout(saveTimer);
    saveTimer = null;
    const { chatFor, chats, drafts } = get();
    if (chatFor !== null) await saveChat(chatFor, chats, drafts);
  };
  const saveSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushChat, SAVE_AFTER);
  };
  const changeChats = (fn) => {
    set((s) => ({ chats: fn(s.chats) }));
    saveSoon();
  };
  const patch = (thread, i, change) => changeChats((c) => ({ ...c, [thread]: c[thread].map((m, idx) => (idx === i ? { ...m, ...change } : m)) }));
  const setBusy = (thread, on) => set((s) => ({ busy: { ...s.busy, [thread]: on } }));
  const takeDraft = (thread) => {
    const text = get().drafts[thread];
    set((s) => ({ drafts: { ...s.drafts, [thread]: "" } }));
    return text;
  };

  const openChat = async (campaign) => {
    set({ chatFor: null, chats: EMPTY, drafts: NO_DRAFTS });
    const r = await fetchChat(campaign);
    if (get().campaign !== campaign) return; // picked another meanwhile
    set({
      chatFor: campaign,
      chats: r.ok ? { words: r.words || [], pictures: r.pictures || [] } : EMPTY,
      drafts: r.ok ? { words: r.drafts?.words || "", pictures: r.drafts?.pictures || "" } : NO_DRAFTS,
      problem: r.ok ? null : `The chat couldn't be opened: ${r.message}`,
    });
  };

  return {
    ready: false,
    campaign: "",
    campaigns: [],
    instructions: "",
    ownInstructions: false,
    pageCampaign: null,
    chatFor: null,
    chats: EMPTY,
    drafts: NO_DRAFTS,
    busy: { words: false, pictures: false },
    mode: "words",
    problem: null,

    // Once, when the window first opens: which campaign, then its chat.
    load: async () => {
      if (started) return;
      started = true;
      const r = await get().refreshSettings();
      if (r.ok) await openChat(get().campaign);
      else started = false; // "try again" may
    },

    // The campaigns to pick from (and the instructions, for Settings).
    refreshSettings: async () => {
      const r = await fetchAssistantSettings();
      if (!r.ok) {
        set({ problem: `The assistant couldn't start: ${r.message}` });
        return r;
      }
      set((s) => ({
        ready: true,
        campaign: s.ready ? s.campaign : r.campaign,
        campaigns: r.campaigns,
        instructions: r.instructions,
        ownInstructions: r.own_instructions,
      }));
      return r;
    },

    // Switch campaign ("" = none): the old chat is saved, the new one opened.
    // Not while something is being written.
    pick: async (campaign) => {
      const { busy, campaign: now } = get();
      if (busy.words || busy.pictures || campaign === now) return;
      await flushChat();
      set({ campaign, problem: null });
      const r = await pickCampaign(campaign);
      if (!r.ok) set({ problem: `That campaign couldn't be picked: ${r.message}` });
      await openChat(campaign);
    },

    setPageCampaign: (name) => set({ pageCampaign: name || null }),
    setMode: (mode) => set({ mode }),
    clearProblem: () => set({ problem: null }),

    setDraft: (thread, text) => {
      set((s) => ({ drafts: { ...s.drafts, [thread]: text } }));
      saveSoon();
    },

    clear: (thread) => {
      if (get().busy[thread]) return;
      changeChats((c) => ({ ...c, [thread]: [] }));
    },

    // An answer changed by hand: that's what the model remembers from now on.
    edit: (i, content) => patch("words", i, { content, edited: true, saved: false }),
    markSaved: (thread, i) => patch(thread, i, { saved: true }),

    /* ---------- asking ---------- */

    // The answer streams in: an empty answer goes in at once and grows as the
    // pieces arrive. stop() cuts it short; what came so far stays.
    ask: async () => {
      const { campaign, chats, busy, drafts } = get();
      if (!drafts.words.trim() || busy.words || useAiStore.getState().usage?.left === 0) return;
      const userMessage = { role: "user", content: takeDraft("words") };
      const asked = [...chats.words, userMessage];
      const at = asked.length; // where the answer goes
      changeChats((c) => ({ ...c, words: [...c.words, userMessage, { role: "assistant", content: "", streaming: true }] }));
      setBusy("words", true);
      const stop = new AbortController();
      stopper = stop;

      try {
        // A campaign's ticked prompts; without one the server uses your instructions.
        const instructions = campaign ? await useCampaignStore.getState().promptTextFor(campaign) : "";
        let r;
        if (instructions === null) {
          r = { ok: false, message: "The campaign's prompts couldn't be read, so nothing was asked." };
        } else {
          const words = asked.filter((m) => !m.failed).map(({ role, content }) => ({ role, content }));
          r = await askAssistant(words, instructions, campaign, {
            signal: stop.signal,
            onNotes: ({ notes, sources, why }) =>
              patch("words", at, { sources: sources || [], ...(notes === "failed" || notes === "all" ? { notes } : {}), ...(why ? { search_error: why } : {}) }),
            onText: (piece) => set((s) => ({ chats: { ...s.chats, words: s.chats.words.map((m, idx) => (idx === at ? { ...m, content: m.content + piece } : m)) } })),
          });
        }
        changeChats((c) => ({
          ...c,
          words: c.words.map((m, idx) => {
            if (idx !== at) return m;
            const { streaming, ...done } = m;
            if (r.ok) return done;
            // Nothing came at all: the reason is the answer. Some came: keep it, say why it stops there.
            if (!done.content) return { ...done, content: r.stopped ? "Stopped before it began." : r.message, failed: true };
            return { ...done, stopped: r.message };
          }),
        }));
      } finally {
        stopper = null;
        setBusy("words", false);
        useAiStore.getState().refresh();
      }
    },

    stop: () => stopper?.abort(),

    paint: async () => {
      const { campaign, busy, drafts } = get();
      if (!drafts.pictures.trim() || busy.pictures || useAiStore.getState().usage?.left === 0) return;
      const prompt = takeDraft("pictures").trim();
      changeChats((c) => ({ ...c, pictures: [...c.pictures, { role: "user", content: prompt, picture: true }] }));
      setBusy("pictures", true);
      try {
        const r = await paintPicture(campaign, prompt);
        const msg = r.ok ? { role: "assistant", content: `[Picture: ${prompt}]`, image: { file: r.file, prompt } } : { role: "assistant", content: r.message, failed: true };
        changeChats((c) => ({ ...c, pictures: [...c.pictures, msg] }));
      } finally {
        setBusy("pictures", false);
        useAiStore.getState().refresh();
      }
    },

    /* ---------- Settings → AI ---------- */

    // "" = back to the default. → { ok, message? }
    setInstructions: async (text) => {
      const r = await saveInstructions(text);
      if (r.ok) set({ instructions: r.instructions, ownInstructions: r.own_instructions });
      return r;
    },
  };
});
