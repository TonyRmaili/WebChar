import { call, flushNoteSaves } from "../../pages/Campaigns/notes/notesApi";

/* ═══════════════════════════════════════════════════════════════════
   assistantApi.js — talking to the server about the assistant
   (backend: routers/assistant.py).

   Every call says which campaign it's for: its name, or "" for none.
   With a campaign the assistant searches its notes and its pictures go in
   its note_images; without one, nothing of a campaign is touched and
   pictures go in save_files/<user>.
   ═══════════════════════════════════════════════════════════════════ */

const API = "http://localhost:8000/assistant";
const json = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/* ─── the window's settings ─── */

// { ok, campaign ("" = none), campaigns: [names], instructions, own_instructions }
export const fetchAssistantSettings = () => call(`${API}/settings`);

export const pickCampaign = (campaign) => call(`${API}/campaign`, json("PUT", { campaign }));

// The instructions without a campaign; "" = back to the default. → { ok, instructions, own_instructions }
export const saveInstructions = (instructions) => call(`${API}/instructions`, json("PUT", { instructions }));

/* ─── the chat, kept on the server ─── */

// { ok, words, pictures, drafts }
export const fetchChat = (campaign) => call(`${API}/chat?campaign_name=${encodeURIComponent(campaign)}`);

export const saveChat = (campaign, chats, drafts) =>
  call(`${API}/chat`, json("PUT", { campaign_name: campaign, words: chats.words, pictures: chats.pictures, drafts }));

/* ─── asking ─── */

// The answer is streamed: lines of JSON arrive while the model writes, and
// each is handed on as it comes:
//   onNotes({ notes, sources, why })  first: which notes it reads
//   onText(piece)                     many times: the next bit of the answer
// `signal` (an AbortController's) stops it: stop was pressed.
// `instructions`: a campaign's ticked prompts (without one the server uses yours).
// Resolves to { ok: true } | { ok: false, message, stopped? }.
export async function askAssistant(messages, instructions, campaign, { onNotes, onText, signal } = {}) {
  try {
    await flushNoteSaves(); // the assistant reads the notes as they are now
    const res = await fetch(`${API}/ask`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages, instructions, campaign_name: campaign }),
      signal,
    });
    if (!res.ok) {
      // The server's own reason (tokens used up, the model refused…) when it gives one.
      const body = await res.json().catch(() => null);
      return { ok: false, message: typeof body?.detail === "string" ? body.detail : `Chat request failed: ${res.status}` };
    }

    // Read the stream: bytes → text → whole lines → events.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    let broke = null;
    const handle = (line) => {
      if (!line.trim()) return;
      const ev = JSON.parse(line);
      if (ev.type === "notes") onNotes?.(ev);
      else if (ev.type === "text") onText?.(ev.text);
      else if (ev.type === "error") broke = ev.message;
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = pending.indexOf("\n")) >= 0) {
        handle(pending.slice(0, nl));
        pending = pending.slice(nl + 1);
      }
    }
    handle(pending + decoder.decode());
    return broke ? { ok: false, message: broke } : { ok: true };
  } catch (err) {
    if (err?.name === "AbortError") return { ok: false, stopped: true, message: "stopped" };
    return { ok: false, message: err?.message || "couldn't reach the server" };
  }
}

/* ─── pictures ─── */

// The words go to the image model as they are → { ok, file } (a name the
// server picked). With a campaign it lands in its note_images, so "paint a
// picture here" in a note uses this too. Slow: a picture can take a minute.
export const paintPicture = (campaign, prompt) => call(`${API}/paint`, json("POST", { campaign_name: campaign, prompt }));

// For useImageUrl (notesApi): it fetches with the login.
export const pictureUrl = (campaign, file) => `${API}/picture/${encodeURIComponent(file)}?campaign_name=${encodeURIComponent(campaign)}`;

// A painted picture as a file of its own → { ok, name }: into a folder of
// the campaign's Files, or without a campaign into your pictures.
export const savePicture = (campaign, file, fileName = "", folderPath = "") =>
  call(`${API}/save_picture`, json("POST", { campaign_name: campaign, file, file_name: fileName, folder_path: folderPath }));
