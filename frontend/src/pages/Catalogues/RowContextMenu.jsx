import React, { useEffect } from "react";
import { createPortal } from "react-dom";

/* Right-click menu for catalogue rows: a small parchment card with a
   thin leather edge, like the other right-click menus. `danger` items
   are written in rubric. */

const MENU_EDGE = "0 0 0 1px rgb(var(--c-desk) / 0.55), 0 12px 32px rgba(0,0,0,0.55)";

export default function RowContextMenu({ x, y, items, onClose }) {
  useEffect(() => {
    const onAnyClick = () => onClose();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onAnyClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onAnyClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed z-[3000] min-w-[160px] rounded-[3px] bg-page py-1.5 font-body text-ink"
      style={{ left: x, top: y, boxShadow: MENU_EDGE }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((it, i) => (
        <button
          key={i}
          onClick={() => {
            it.onClick();
            onClose();
          }}
          className={`block w-full px-3 py-1 text-left text-sm transition hover:bg-ink/[0.07] ${it.danger ? "text-rubric" : ""}`}
        >
          {it.label}
        </button>
      ))}
    </div>,
    document.body
  );
}