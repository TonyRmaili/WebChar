import { useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════
   notesApi.js — talking to the server about campaign notes and pictures
   (backend: routers/campaigns.py, "notes" and "pictures").

   A note is { doc, text }: `doc` is the editor's document, `text` the
   same note as plain text, which the server makes on every save.

   Pictures need the login token like every other request, so an <img>
   can't fetch them by itself. useImageUrl() fetches the picture with the
   token and hands back a "blob URL": a short local address for bytes the
   page already holds.
   ═══════════════════════════════════════════════════════════════════ */

const API = "http://localhost:8000/campaign";
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const detailOf = (body, status) => (typeof body?.detail === "string" && body.detail) || `server said ${status}`;

// { ok: true, …the answer } or { ok: false, message } — never throws.
// (components/assistant/assistantApi.js uses it too.)
export async function call(url, options = {}) {
  try {
    const res = await fetch(url, { ...options, headers: { ...auth(), ...(options.headers || {}) } });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, message: detailOf(body, res.status) };
    return { ok: true, ...body };
  } catch {
    return { ok: false, message: "couldn't reach the server" };
  }
}

/* ─── notes ─── */

export const fetchNote = (path) => call(`${API}/note?path=${encodeURIComponent(path)}`);

export const saveNote = (path, doc) =>
  call(`${API}/note`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, doc }) });

/* ─── the Files tree, and searching it ─── */

// { ok, root, children } — the same tree the campaign page shows.
export const fetchFilesTree = (campaignName) => call(`${API}/data?campaign_name=${encodeURIComponent(campaignName)}`);

// { ok, matches: [{ path, snippet }] } — notes whose name or text holds q,
// pictures whose name does; snippet is the text around the first hit.
export const searchFiles = (campaignName, q) =>
  call(`${API}/search?campaign_name=${encodeURIComponent(campaignName)}&q=${encodeURIComponent(q)}`);

/* ─── prompts (plain text) ─── */

export const fetchPrompt = (path) => call(`${API}/prompt?path=${encodeURIComponent(path)}`);

export const savePrompt = (path, content) =>
  call(`${API}/update_file`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, content }) });

/* ─── pictures ─── */

export const PICTURE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
export const MAX_PICTURE_BYTES = 10 * 1024 * 1024;

// Checked here too, so the DM hears at once; the server checks the bytes again.
export function pictureProblem(file) {
  if (!PICTURE_TYPES.includes(file.type)) return `"${file.name}" is not a PNG, JPEG, GIF or WebP picture`;
  if (file.size > MAX_PICTURE_BYTES) return `"${file.name}" is bigger than 10 MB`;
  return null;
}

function upload(url, fields, file) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  form.append("file", file);
  return call(url, { method: "POST", body: form });
}

// A picture inside a note → { ok, file } (the name the server gave it).
export const uploadNoteImage = (campaignName, file) => upload(`${API}/note_images`, { campaign_name: campaignName }, file);

// A picture as a file of its own in the tree → { ok, path, name }.
export const uploadImageFile = (campaignName, file, folder = "") =>
  upload(`${API}/image_file`, { campaign_name: campaignName, folder }, file);

export const noteImageUrl = (campaignName, file) => `${API}/note_images/${encodeURIComponent(file)}?campaign_name=${encodeURIComponent(campaignName)}`;
export const imageFileUrl = (path) => `${API}/image_file?path=${encodeURIComponent(path)}`;

// url → Promise of a blob URL. Kept for the session, so a picture shown in
// two notes, or opened again, is fetched once.
const blobs = new Map();

function blobUrl(url) {
  if (!blobs.has(url)) {
    const p = fetch(url, { headers: auth() }).then((res) => {
      if (!res.ok) throw new Error(`server said ${res.status}`);
      return res.blob().then((b) => URL.createObjectURL(b));
    });
    p.catch(() => blobs.delete(url)); // try again next time
    blobs.set(url, p);
  }
  return blobs.get(url);
}

// A file in the tree can be replaced under the same path; forget it then.
export function forgetImage(url) {
  const p = blobs.get(url);
  blobs.delete(url);
  p?.then((u) => URL.revokeObjectURL(u)).catch(() => {});
}

// { src, error } for a picture's server address (null → nothing yet).
export function useImageUrl(url) {
  const [state, setState] = useState({ src: null, error: null });
  useEffect(() => {
    if (!url) return undefined;
    let live = true;
    setState({ src: null, error: null });
    blobUrl(url).then(
      (src) => live && setState({ src, error: null }),
      () => live && setState({ src: null, error: "This picture couldn't be loaded" }),
    );
    return () => {
      live = false;
    };
  }, [url]);
  return state;
}

/* ─── saves still waiting ───
   Each open note puts a "save now" function here while it has changes
   the server hasn't got yet. Before anything reads or moves notes on the
   server (the assistant, rename, move, copy) the store calls
   flushNoteSaves(), so it never works on an old version. */

const pending = new Map(); // path → save now

export function setPendingSave(path, saveNow) {
  if (saveNow) pending.set(path, saveNow);
  else pending.delete(path);
}

export const pendingSaveOf = (path) => pending.get(path);

export async function flushNoteSaves() {
  const saves = [...pending.values()];
  pending.clear();
  await Promise.all(saves.map((s) => s()));
}

// The note (or a folder of notes) is being deleted: its changes go nowhere.
export function dropNoteSaves(path) {
  for (const p of [...pending.keys()]) if (isUnder(p, path)) pending.delete(p);
}

// A path is the folder itself or inside it (Windows or / separators).
export const isUnder = (path, root) => path === root || path.startsWith(`${root}\\`) || path.startsWith(`${root}/`);
