import React, { useEffect } from "react";
import { createPortal } from "react-dom";

/* Right-click menu for a file or folder in the campaign tree: a small
   parchment card with a thin leather edge (like the catalogue's row menu),
   headed by the node's name. Delete is written in rubric. */

const MENU_EDGE = "0 0 0 1px rgb(var(--c-desk) / 0.55), 0 12px 32px rgba(0,0,0,0.55)";

function CampaignContextMenu({ x, y, node, onAction, onClose }) {
  useEffect(() => {
    const handleClick = () => onClose();
    const handleKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const isFolder = node.type === "folder";

  const items = [
    { label: "Rename", action: "rename" },
    { label: "Move to…", action: "move" },
    ...(isFolder ? [] : [{ label: "Copy", action: "copy" }]),
    { label: "Delete", action: "delete", danger: true },
  ];

  return createPortal(
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className="fixed z-[3000] min-w-[160px] rounded-[3px] bg-page py-1.5 font-body text-ink"
      style={{ left: x, top: y, boxShadow: MENU_EDGE }}
    >
      <div className="mx-3 mb-1 truncate border-b border-rule/30 pb-1 text-xs italic text-ink-faded">{node.name}</div>
      {items.map((item) => (
        <button
          key={item.action}
          onClick={() => {
            onAction(item.action, node);
            onClose();
          }}
          className={`block w-full px-3 py-1 text-left text-sm transition hover:bg-ink/[0.07] ${item.danger ? "text-rubric" : ""}`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
}

export default CampaignContextMenu;