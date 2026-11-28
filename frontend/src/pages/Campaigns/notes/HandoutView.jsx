import React from "react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { Presentation, X } from "lucide-react";

/* A handout inside a note (the `handout` node, noteExtensions.js): a
   letter, a map, a wanted poster… something the players get to see.
   Its title sits on top; "show" opens it on its own as a clean card
   (HandoutCard) with nothing else of the note, ready to turn your screen
   toward the table or share that window. Click the "Handout" tag to pick
   it all (Delete removes it), or ✕ to remove it with what's in it. */

export default function HandoutView({ node, updateAttributes, editor, extension, getPos, deleteNode }) {
  const editable = editor.isEditable;
  return (
    <NodeViewWrapper className="note-handout" data-handout="">
      <div className="note-handout-head" contentEditable={false}>
        <span
          className="note-handout-tag"
          title={editable ? "Pick the whole handout (then Delete removes it)" : undefined}
          onMouseDown={(e) => {
            if (!editable) return;
            e.preventDefault();
            editor.chain().focus().setNodeSelection(getPos()).run();
          }}
        >
          Handout
        </span>
        {editable ? (
          <input
            className="note-handout-title"
            value={node.attrs.title}
            placeholder="Its title (the players see it)"
            onChange={(e) => updateAttributes({ title: e.target.value })}
          />
        ) : (
          <span className="note-handout-title">{node.attrs.title}</span>
        )}
        {editable && (
          <button type="button" className="note-handout-show" title="Show it on its own, for the players" onClick={() => extension.options.onShow?.(node)}>
            <Presentation size={14} /> show
          </button>
        )}
        {editable && (
          <button type="button" className="note-handout-show" title="Remove the handout, with what's in it (Ctrl+Z brings it back)" onClick={() => deleteNode()}>
            <X size={14} />
          </button>
        )}
      </div>
      <NodeViewContent className="note-handout-body" />
    </NodeViewWrapper>
  );
}
