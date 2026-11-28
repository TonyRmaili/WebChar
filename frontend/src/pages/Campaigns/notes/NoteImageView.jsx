import React, { useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { AlignCenter, PanelLeft, PanelRight, Scan } from "lucide-react";
import { noteImageUrl, useImageUrl } from "./notesApi";

/* A picture inside a note (the noteImage node in noteExtensions.js).
   Click it to pick it: a small bar shows where it sits (text flows round
   it on the left or right, or it stands alone in the middle), "fit"
   (back to its own size) and a line to describe it — the DM Assistant
   reads that line, since it can't see pictures yet. Drag the gold corner
   to resize. */

const MIN_WIDTH = 60;

const barBtn = (on) =>
  `inline-flex h-6 w-6 items-center justify-center rounded transition ${on ? "bg-rubric/15 text-rubric" : "text-ink-faded hover:bg-ink/[0.07] hover:text-ink"}`;

export default function NoteImageView({ node, updateAttributes, selected, extension, editor }) {
  const { file, alt, width, align } = node.attrs;
  const { src, error } = useImageUrl(file ? noteImageUrl(extension.options.campaignName, file) : null);
  const box = useRef(null);
  // While the corner is dragged the width lives here; the note changes once, on release.
  const [dragWidth, setDragWidth] = useState(null);
  const editable = editor.isEditable;

  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = box.current?.offsetWidth || 300;
    const maxW = editor.view.dom.clientWidth || 2000;
    // A picture on the right grows to the left.
    const dir = align === "right" ? -1 : 1;
    let w = startW;
    const onMove = (ev) => {
      w = Math.round(Math.max(MIN_WIDTH, Math.min(maxW, startW + dir * (ev.clientX - startX))));
      setDragWidth(w);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setDragWidth(null);
      updateAttributes({ width: w });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const shown = dragWidth ?? width;

  return (
    <NodeViewWrapper
      ref={box}
      className={`note-image note-image--${align} ${selected ? "is-selected" : ""}`}
      style={shown ? { width: `${shown}px` } : undefined}
      data-drag-handle=""
    >
      {src ? (
        <img src={src} alt={alt || ""} draggable={false} />
      ) : (
        <div className="note-image-missing">{error || "Loading picture…"}</div>
      )}

      {selected && editable && (
        <>
          <div className="note-image-bar" contentEditable={false}>
            <button type="button" className={barBtn(align === "left")} title="On the left, text flows round it" onClick={() => updateAttributes({ align: "left" })}>
              <PanelLeft size={14} />
            </button>
            <button type="button" className={barBtn(align === "center")} title="In the middle, on its own" onClick={() => updateAttributes({ align: "center" })}>
              <AlignCenter size={14} />
            </button>
            <button type="button" className={barBtn(align === "right")} title="On the right, text flows round it" onClick={() => updateAttributes({ align: "right" })}>
              <PanelRight size={14} />
            </button>
            <button type="button" className={barBtn(false)} title="Its own size" onClick={() => updateAttributes({ width: null })}>
              <Scan size={14} />
            </button>
            <input
              className="note-image-alt"
              value={alt}
              placeholder="Describe it (the assistant reads this)"
              onChange={(e) => updateAttributes({ alt: e.target.value })}
            />
          </div>
          <span className="note-image-resize" onMouseDown={startResize} title="Drag to resize" contentEditable={false} />
        </>
      )}
    </NodeViewWrapper>
  );
}
