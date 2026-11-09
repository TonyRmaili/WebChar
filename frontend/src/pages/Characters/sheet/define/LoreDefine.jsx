import React, { useCallback, useMemo, useRef, useState } from "react";
import useCharStore from "../../../../store/CharStore";
import { INK, InkButton, InkSelect, InkText, ParchmentSheet, Title } from "../../../../styles/parchment";
import { Field, Segmented, TextBlock, chipBtn, inputCls } from "../../../../styles/parchmentForm";
import { KINDS, kindOf, matchesQuery, metaLine, newNote, notesOf, sortNotes, wordCount } from "./loreHelpers";

/* Define tab: Lore — the character's journal, on parchment.

   Notes are session recaps, NPCs, places, quests or anything else. Each
   is written as a journal entry with a short preview; click it to edit.
   Pinned notes stay on top, finished quests sink and are struck through.
   At full width entries sit in two columns and an open one spans both. */

function NoteEntry({ note, open, onToggle, onPatch, onRemove }) {
  const kind = kindOf(note);
  const isQuest = kind.value === "quest";
  const meta = metaLine(note);

  return (
    <article className={`group ${open ? "col-span-full" : ""} ${note.done ? "opacity-60" : ""}`}>
      {/* Entry */}
      <div className="flex gap-3">
        <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <div className="flex items-baseline gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
            <span className={kind.text}>{kind.label}</span>
            {meta && <span className={`truncate font-normal normal-case italic tracking-normal ${INK.faded}`}>{meta}</span>}
          </div>
          <h4
            className={`mt-0.5 truncate text-[17px] leading-snug group-hover:underline group-hover:decoration-dotted group-hover:underline-offset-4 ${
              note.title ? "" : `italic ${INK.faint}`
            } ${note.done ? "line-through" : ""}`}
          >
            {note.title || "untitled note"}
          </h4>
          {!open && note.body && <p className={`mt-1 line-clamp-3 whitespace-pre-line text-[13px] italic leading-relaxed ${INK.faded}`}>{note.body}</p>}
        </button>

        <div className="flex shrink-0 items-start gap-3 pt-0.5">
          {isQuest && (
            <InkButton onClick={() => onPatch({ done: !note.done })} active={!note.done} title={note.done ? "Mark as still open" : "Mark as done"}>
              {note.done ? "done" : "open"}
            </InkButton>
          )}
          <button
            type="button"
            onClick={() => onPatch({ pinned: !note.pinned })}
            title={note.pinned ? "Unpin" : "Pin to the top"}
            aria-label={note.pinned ? "Unpin" : "Pin to the top"}
            aria-pressed={!!note.pinned}
            className={`text-sm leading-none transition ${note.pinned ? INK.rubric : `${INK.faint} opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-ink`}`}
          >
            {note.pinned ? "✦" : "✧"}
          </button>
        </div>
      </div>

      {/* Editor */}
      {open && (
        <div className="@container mt-3 space-y-3 border-l-2 border-rubric/40 pl-4">
          <div className="grid grid-cols-2 gap-x-5 gap-y-3 @xl:grid-cols-[minmax(0,1fr)_5rem_9.5rem]">
            <Field label="Title" className="col-span-2 @xl:col-span-1">
              <input
                type="text"
                value={note.title ?? ""}
                autoFocus={!note.title}
                onChange={(e) => onPatch({ title: e.target.value })}
                placeholder={kind.value === "npc" ? "e.g. Mirela, the ferry woman" : kind.value === "quest" ? "e.g. Find the missing caravan" : "e.g. Ambush at the old mill"}
                className={`${inputCls} text-[17px]`}
              />
            </Field>
            <Field label="Session">
              <input type="text" inputMode="numeric" value={note.session_id ?? ""} onChange={(e) => onPatch({ session_id: e.target.value })} placeholder="—" className={`${inputCls} text-center`} />
            </Field>
            <Field label="Date">
              <input type="date" value={note.date ?? ""} onChange={(e) => onPatch({ date: e.target.value })} className={inputCls} />
            </Field>
          </div>

          <Field label="Kind">
            <Segmented options={KINDS.map((k) => ({ value: k.value, label: k.label }))} value={kind.value} onChange={(v) => onPatch({ kind: v })} />
          </Field>

          <TextBlock
            value={note.body}
            onChange={(e) => onPatch({ body: e.target.value })}
            minRows={6}
            placeholder="What happened, who you met, what you learned, what to follow up on…"
            aria-label="Notes"
          />

          <div className="flex flex-wrap items-baseline gap-x-4">
            <span className={`text-[11px] italic ${INK.faint}`}>{wordCount(note.body)} words</span>
            <InkButton onClick={onRemove} className="ml-auto">
              delete
            </InkButton>
            <InkButton onClick={onToggle} active>
              close
            </InkButton>
          </div>
        </div>
      )}
    </article>
  );
}

export default function LoreDefine() {
  const charData = useCharStore((s) => s.charData);
  const updateCharField = useCharStore((s) => s.updateCharField);
  const postCharData = useCharStore((s) => s.postCharData);

  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const timer = useRef(null);
  // Session/date of the open note when it was opened, so the entry doesn't
  // jump around the list while you type them.
  const frozen = useRef(null);

  const notes = useMemo(() => notesOf(charData), [charData?.lore]);

  // Typing saves a moment later; adding/removing saves right away.
  const persist = useCallback(
    (nextNotes, immediate = false) => {
      updateCharField("lore", { ...(charData?.lore || {}), notes: nextNotes });
      clearTimeout(timer.current);
      if (immediate) postCharData();
      else timer.current = setTimeout(() => postCharData(), 400);
    },
    [charData?.lore, updateCharField, postCharData]
  );

  if (!charData) return null;

  const q = query.trim().toLowerCase();
  const byId = new Map(notes.map((n) => [n.id, n]));
  const visible = sortNotes(
    notes
      .filter((n) => n.id === openId || (matchesQuery(n, q) && (!kindFilter || kindOf(n).value === kindFilter)))
      .map((n) => (n.id === openId && frozen.current ? { ...n, ...frozen.current } : n)),
    newestFirst
  ).map((n) => byId.get(n.id));

  const toggle = (note) => {
    const opening = openId !== note.id;
    frozen.current = opening ? { session_id: note.session_id, date: note.date } : null;
    setOpenId(opening ? note.id : null);
  };
  const counts = Object.fromEntries(KINDS.map((k) => [k.value, notes.filter((n) => kindOf(n).value === k.value).length]));
  const openQuests = notes.filter((n) => kindOf(n).value === "quest" && !n.done).length;

  const add = (kind) => {
    const note = newNote(notes, kind);
    persist([...notes, note], true);
    frozen.current = { session_id: note.session_id, date: note.date };
    setOpenId(note.id);
    setKindFilter("");
    setQuery("");
  };

  const patch = (id, p) => persist(notes.map((n) => (n.id === id ? { ...n, ...p } : n)), "pinned" in p || "done" in p);

  const remove = (note) => {
    if (!window.confirm(`Delete "${note.title || "untitled note"}"?`)) return;
    persist(notes.filter((n) => n.id !== note.id), true);
    if (openId === note.id) setOpenId(null);
  };

  return (
    <ParchmentSheet>
      <Title
        after={
          <span className={`text-sm italic ${INK.faded}`}>
            {notes.length} {notes.length === 1 ? "note" : "notes"}
            {openQuests > 0 && (
              <span className={INK.rubric}>
                {" "}
                · {openQuests} open {openQuests === 1 ? "quest" : "quests"}
              </span>
            )}
          </span>
        }
        right={
          <>
            <InkText value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search…" aria-label="Search notes" className="h-7 w-32 text-sm" />
            <InkButton onClick={() => add("session")} active title="Starts the next session number with today's date">
              + session
            </InkButton>
            <InkSelect value="" onChange={(e) => e.target.value && add(e.target.value)} aria-label="Add another kind of note" className="h-7 text-xs italic">
              <option value="">+ other…</option>
              {KINDS.filter((k) => k.value !== "session").map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </InkSelect>
          </>
        }
      >
        Lore
      </Title>

      {/* Filters */}
      {notes.length > 0 && (
        <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-rule/25 pb-2">
          <button type="button" className={chipBtn(kindFilter === "")} onClick={() => setKindFilter("")}>
            all {notes.length}
          </button>
          {KINDS.filter((k) => counts[k.value] > 0).map((k) => (
            <button key={k.value} type="button" className={chipBtn(kindFilter === k.value)} onClick={() => setKindFilter((f) => (f === k.value ? "" : k.value))}>
              <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${k.dot}`} />
              {k.label.toLowerCase()} {counts[k.value]}
            </button>
          ))}
          <InkButton onClick={() => setNewestFirst((v) => !v)} className="ml-auto">
            {newestFirst ? "newest first" : "oldest first"}
          </InkButton>
        </div>
      )}

      {/* Entries */}
      {notes.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[17px] italic">The journal is empty.</p>
          <p className={`mt-1 text-sm italic ${INK.faded}`}>Write down what happened each session, the people you meet, the places and the open quests.</p>
          <InkButton onClick={() => add("session")} active className="mt-4">
            write the first entry
          </InkButton>
        </div>
      ) : visible.length === 0 ? (
        <p className={`text-sm italic ${INK.faint}`}>Nothing matches.</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-12 gap-y-6 @4xl:grid-cols-2">
          {visible.map((note) => (
            <NoteEntry key={note.id} note={note} open={openId === note.id} onToggle={() => toggle(note)} onPatch={(p) => patch(note.id, p)} onRemove={() => remove(note)} />
          ))}
        </div>
      )}
    </ParchmentSheet>
  );
}