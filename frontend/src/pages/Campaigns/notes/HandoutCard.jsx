import React, { useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { noteExtensions } from "./noteExtensions";
import { clickedLink } from "./noteLinks";
import "./note.css";

/* ═══════════════════════════════════════════════════════════════════
   HandoutCard — a note's handout on its own (popup type "handout"; data
   { name, campaignName, notePath, content }, see fileCards.showHandout).

   Only the handout, larger and without tools, to show the players: turn
   the screen, or share just this window. It is what the handout said when
   "show" was clicked; click "show" again after changing it.
   ═══════════════════════════════════════════════════════════════════ */

const nothing = () => {};

export default function HandoutCard({ handout }) {
  const { campaignName, content } = handout;
  const [problem, setProblem] = useState(null);
  const editor = useEditor({
    editable: false,
    extensions: noteExtensions({ campaignName, onFiles: nothing, onShowHandout: nothing }),
    content: { type: "doc", content: content?.length ? content : [{ type: "paragraph" }] },
    immediatelyRender: true,
    editorProps: { attributes: { class: "wc-note-doc wc-note-doc--handout" } },
  });

  return (
    <div
      className="wc-page flex h-full flex-col !rounded-none"
      onContextMenu={(e) => e.stopPropagation()}
      onClick={(e) => clickedLink(e, campaignName, setProblem)}
    >
      {problem && <div className="shrink-0 border-b border-rule/30 px-3 py-1 text-xs italic text-bad">{problem}</div>}
      <div className="note-handout-sheet min-h-0 flex-1 overflow-y-auto">
        {handout.name && <h1 className="note-handout-sheet-title">{handout.name}</h1>}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
