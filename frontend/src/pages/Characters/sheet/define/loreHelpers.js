/* Pure logic for the Lore Define tab.

   Data shape (unchanged; kind, pinned and done are new and optional):
     lore: { notes: [{ id, title, session_id, date, body, kind?, pinned?, done? }] }
   Old notes have no kind and count as session notes. */

export const asList = (v) => (Array.isArray(v) ? v : []);

export const newId = () =>
  globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// Ink colours that read on parchment.
export const KINDS = [
  { value: "session", label: "Session", dot: "bg-[#9a3412]", text: "text-[#9a3412]" },
  { value: "npc", label: "NPC", dot: "bg-[#1e3a8a]", text: "text-[#1e3a8a]" },
  { value: "location", label: "Place", dot: "bg-[#3f6212]", text: "text-[#3f6212]" },
  { value: "quest", label: "Quest", dot: "bg-[#7f1d1d]", text: "text-[#7f1d1d]" },
  { value: "other", label: "Other", dot: "bg-[#7b6346]", text: "text-[#7b6346]" },
];

export const kindOf = (note) => KINDS.find((k) => k.value === note?.kind) ?? KINDS[0];

export const notesOf = (charData) => asList(charData?.lore?.notes);

// Session numbers are free text in old data ("5", "5b"); the leading number sorts.
export const sessionNumber = (note) => {
  const m = String(note?.session_id ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
};

export const lastSession = (notes) =>
  asList(notes).reduce((max, n) => Math.max(max, sessionNumber(n) ?? 0), 0);

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// A new session note continues the numbering; other kinds reuse the latest session.
export const newNote = (notes, kind = "session") => {
  const last = lastSession(notes);
  const session = kind === "session" ? last + 1 : last || "";
  return { id: newId(), title: "", session_id: session === "" ? "" : String(session), date: todayIso(), body: "", kind, pinned: false };
};

export const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export const metaLine = (note) =>
  [note.session_id !== "" && note.session_id != null ? `Session ${note.session_id}` : "", formatDate(note.date)]
    .filter(Boolean)
    .join(" · ");

// Pinned first, open quests before done ones, then by session and date.
export const sortNotes = (notes, newestFirst = true) => {
  const dir = newestFirst ? -1 : 1;
  return asList(notes)
    .map((n, i) => ({ n, i }))
    .sort((a, b) => {
      if (!!a.n.pinned !== !!b.n.pinned) return a.n.pinned ? -1 : 1;
      if (!!a.n.done !== !!b.n.done) return a.n.done ? 1 : -1;
      const sa = sessionNumber(a.n) ?? -1;
      const sb = sessionNumber(b.n) ?? -1;
      if (sa !== sb) return (sa - sb) * dir;
      const da = a.n.date || "";
      const db = b.n.date || "";
      if (da !== db) return (da < db ? -1 : 1) * dir;
      return (a.i - b.i) * dir;
    })
    .map(({ n }) => n);
};

export const matchesQuery = (note, q) =>
  !q || [note.title, note.body, note.session_id].some((v) => String(v ?? "").toLowerCase().includes(q));

export const wordCount = (text) => (String(text || "").trim().match(/\S+/g) || []).length;