import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export default function RowContextMenu({ x, y, items, onClose }) {
  useEffect(() => {
    const onAnyClick = () => onClose();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("mousedown", onAnyClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onAnyClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed z-[3000] min-w-[140px] py-1 rounded shadow-xl
                 bg-slate-800 border border-slate-600"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((it, i) => (
        <button
          key={i}
          onClick={() => { it.onClick(); onClose(); }}
          className={`block w-full text-left text-xs px-3 py-1.5 transition
                      ${it.danger
                        ? "text-red-300 hover:bg-red-900/40"
                        : "text-slate-200 hover:bg-slate-700"}`}
        >
          {it.label}
        </button>
      ))}
    </div>,
    document.body
  );
}