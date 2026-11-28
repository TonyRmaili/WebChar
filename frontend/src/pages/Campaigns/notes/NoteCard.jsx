import React, { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import DragHandle from "@tiptap/extension-drag-handle-react";
import { GripVertical } from "lucide-react";
import NoteToolbar from "./NoteToolbar";
import ParchmentMenu from "../../../styles/ParchmentMenu";
import { useAiStore } from "../../../store/AiStore";
import { noteExtensions } from "./noteExtensions";
import { fetchNote, pendingSaveOf, pictureProblem, saveNote, setPendingSave, uploadNoteImage } from "./notesApi";
import { paintPicture } from "../../../components/assistant/assistantApi";
import { showHandout } from "./fileCards";
import { clickedLink } from "./noteLinks";
import "./note.css";

/* ═══════════════════════════════════════════════════════════════════
   NoteCard — a campaign note as a card (popup type "note"; data
   { name, path, campaignName }, see fileCards.js).

   The note is fetched when the card opens and saved a second after you
   stop typing, when the card closes or is minimized, and before anything
   else reads notes on the server (the assistant, rename, move…).
   Right-click inside the note: a quick menu of the toolbar's bigger tools
   (links, table, columns, paint…); Shift + right-click gives the
   browser's own menu (spelling, paste). Right-click the title bar to
   minimize. Click a link (@… or [[…]]) to open what it points at.
   ═══════════════════════════════════════════════════════════════════ */

const SAVE_AFTER = 1000; // ms after the last change

export default function NoteCard({ note: ref }) {
  const { path, campaignName } = ref;
  const [loaded, setLoaded] = useState(null); // { doc } | { error }

  useEffect(() => {
    let live = true;
    setLoaded(null);
    fetchNote(path).then((r) => live && setLoaded(r.ok ? { doc: r.doc } : { error: r.message }));
    return () => {
      live = false;
    };
  }, [path]);

  if (!loaded || loaded.error) {
    return (
      <div className="wc-page flex h-full items-center justify-center !rounded-none p-6 text-sm italic">
        {loaded ? <span className="text-bad">{loaded.error}</span> : <span className="text-ink-faded">Opening the note…</span>}
      </div>
    );
  }
  return <NoteEditor key={path} path={path} campaignName={campaignName} initial={loaded.doc} />;
}

const STATUS_WORDS = { saved: "Saved", unsaved: "Not saved yet", saving: "Saving…" };

function NoteEditor({ path, campaignName, initial }) {
  const [status, setStatus] = useState("saved");
  const [problem, setProblem] = useState(null);
  const [uploading, setUploading] = useState(0);
  const [painting, setPainting] = useState(0);
  const [paintOpen, setPaintOpen] = useState(false);
  const [menu, setMenu] = useState(null); // { x, y } of a right-click
  const latest = useRef(initial);
  const dirty = useRef(false);
  const timer = useRef(null);
  const queue = useRef(Promise.resolve()); // saves go one after another
  const picker = useRef(null);

  const saveNow = useCallback(() => {
    clearTimeout(timer.current);
    if (!dirty.current) return queue.current;
    dirty.current = false;
    setPendingSave(path, null);
    const doc = latest.current;
    setStatus("saving");
    queue.current = queue.current.then(async () => {
      const r = await saveNote(path, doc);
      if (r.ok) {
        setProblem(null);
        setStatus(dirty.current ? "unsaved" : "saved");
      } else {
        dirty.current = true;
        setPendingSave(path, saveNow);
        setProblem(`Not saved: ${r.message}`);
        setStatus("unsaved");
      }
    });
    return queue.current;
  }, [path]);

  const changed = useCallback(
    (editor) => {
      latest.current = editor.getJSON();
      dirty.current = true;
      setPendingSave(path, saveNow);
      setStatus("unsaved");
      clearTimeout(timer.current);
      timer.current = setTimeout(saveNow, SAVE_AFTER);
    },
    [path, saveNow],
  );

  // Closing or minimizing the card saves what's left — unless the note
  // was deleted (fileCards.closeFileCards dropped its save).
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pendingSaveOf(path) === saveNow) saveNow();
    },
    [path, saveNow],
  );

  // Pictures pasted, dropped or picked: each goes to the server first,
  // then into the note where it was dropped (or at the cursor).
  const editorRef = useRef(null);
  const addPictures = useCallback(
    async (files, pos) => {
      const editor = editorRef.current;
      if (!editor) return;
      let at = pos;
      for (const file of files) {
        const bad = pictureProblem(file);
        if (bad) {
          setProblem(bad);
          continue;
        }
        setUploading((n) => n + 1);
        const r = await uploadNoteImage(campaignName, file);
        setUploading((n) => n - 1);
        if (editor.isDestroyed) return;
        if (!r.ok) {
          setProblem(`"${file.name}": ${r.message}`);
          continue;
        }
        const alt = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
        editor.chain().focus().insertNoteImage({ file: r.file, alt, align: "center" }, at).run();
        if (at != null) at = editor.state.selection.to;
      }
    },
    [campaignName],
  );
  const filesRef = useRef(addPictures);
  filesRef.current = addPictures;

  // A painted picture goes where the cursor was when you asked. Painting
  // takes a while; the spot moves along with whatever is written meanwhile.
  const paint = useCallback(
    async (prompt) => {
      const editor = editorRef.current;
      if (!editor) return;
      let at = editor.state.selection.to;
      const follow = ({ transaction }) => {
        at = transaction.mapping.map(at);
      };
      editor.on("transaction", follow);
      setPainting((n) => n + 1);
      const r = await paintPicture(campaignName, prompt);
      setPainting((n) => n - 1);
      editor.off("transaction", follow);
      useAiStore.getState().refresh(); // the assistant's token meter
      if (editor.isDestroyed) return;
      if (!r.ok) {
        setProblem(r.message);
        return;
      }
      editor.chain().insertNoteImage({ file: r.file, alt: prompt, align: "center" }, at).run();
    },
    [campaignName],
  );

  const showRef = useRef(null);
  showRef.current = (node) =>
    showHandout({ name: node.attrs.title.trim() || "Handout", campaignName, notePath: path, content: node.toJSON().content || [] });

  const editor = useEditor({
    extensions: noteExtensions({
      campaignName,
      onFiles: (files, pos) => filesRef.current(files, pos),
      onShowHandout: (node) => showRef.current(node),
    }),
    content: initial,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: { class: "wc-note-doc", spellcheck: "true" } },
    onUpdate: ({ editor: e }) => changed(e),
  });
  editorRef.current = editor;

  // Right-click: the cursor goes where you clicked (unless that's inside
  // the picked text), then the quick menu opens there.
  const openMenu = (e) => {
    if (e.shiftKey || !editor) return; // the browser's own menu
    e.preventDefault();
    const at = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
    const { from, to } = editor.state.selection;
    if (at && (at.pos < from || at.pos > to)) editor.commands.setTextSelection(at.pos);
    setMenu({ x: e.clientX, y: e.clientY });
  };

  // "@" / "[[" typed for you: the link menu opens as if you had.
  const startLink = (trigger) => {
    const { $from } = editor.state.selection;
    const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset);
    editor.chain().focus().insertContent(before && !/\s/.test(before) ? ` ${trigger}` : trigger).run();
  };

  const menuGroups = editor
    ? [
        {
          heading: "Link",
          items: [
            { label: "🔗  A catalogue entry…", note: "@", hint: "A monster, spell, item… opens its card when clicked", onSelect: () => startLink("@") },
            { label: "🧝  A party member or NPC…", note: "//", hint: "Someone of this campaign: opens their statblock when clicked", onSelect: () => startLink("//") },
            { label: "📄  A note or picture…", note: "[[", hint: "Another note or picture of this campaign", onSelect: () => startLink("[[") },
          ],
        },
        {
          heading: "Add here",
          items: [
            { label: "▦  Table", onSelect: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), disabled: editor.isActive("table") },
            editor.isActive("details")
              ? { label: "▸  Undo the folding section", onSelect: () => editor.chain().focus().unsetDetails().run() }
              : { label: "▸  Folding section", onSelect: () => editor.chain().focus().setDetails().run() },
            editor.isActive("columns")
              ? { label: "◫  Back to one column", onSelect: () => editor.chain().focus().removeColumns().run() }
              : { label: "◫  Two columns", onSelect: () => editor.chain().focus().insertColumns().run() },
            { label: "🪄  Paint a picture here…", onSelect: () => setPaintOpen(true) },
          ],
        },
        {
          heading: "For the players",
          items: [
            { label: editor.isActive("readAloud") ? "📖  Undo the read-aloud box" : "📖  Read-aloud box", onSelect: () => editor.chain().focus().toggleReadAloud().run() },
            editor.isActive("handout")
              ? { label: "📜  Undo the handout", onSelect: () => editor.chain().focus().unsetHandout().run() }
              : { label: "📜  Handout", onSelect: () => editor.chain().focus().setHandout().run() },
          ],
        },
      ]
    : [];

  const statusWord = painting ? "Painting…" : uploading ? "Adding picture…" : STATUS_WORDS[status];

  return (
    <div className="wc-page flex h-full flex-col !rounded-none" onContextMenu={(e) => e.stopPropagation()}>
      {editor && <NoteToolbar editor={editor} status={statusWord} onPickImages={() => picker.current?.click()} onPaint={paint} paintOpen={paintOpen} setPaintOpen={setPaintOpen} />}
      {problem && (
        <div className="flex shrink-0 items-center gap-2 border-b border-rule/30 px-3 py-1 text-xs italic text-bad">
          <span className="flex-1">{problem}</span>
          <button type="button" className="text-ink-faded underline decoration-dotted underline-offset-4 hover:text-ink" onClick={() => setProblem(null)}>
            ok
          </button>
        </div>
      )}
      <div className="relative min-h-0 flex-1 overflow-y-auto" onClick={(e) => clickedLink(e, campaignName, setProblem)} onContextMenu={openMenu}>
        {editor && (
          <DragHandle editor={editor}>
            <div className="note-grip" title="Drag to move this block">
              <GripVertical size={14} />
            </div>
          </DragHandle>
        )}
        <EditorContent editor={editor} className="h-full" />
      </div>
      {menu && (
        <ParchmentMenu
          x={menu.x}
          y={menu.y}
          groups={[...menuGroups, { items: [], empty: "Shift + right-click: the browser's menu (spelling, paste)" }]}
          onClose={() => setMenu(null)}
        />
      )}
      <input
        ref={picker}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files || [])];
          e.target.value = "";
          if (files.length) addPictures(files, null);
        }}
      />
    </div>
  );
}
