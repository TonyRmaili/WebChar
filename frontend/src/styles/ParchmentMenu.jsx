import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { INK } from "./parchment";

/* Right-click menu in the parchment style.

   <ParchmentMenu x={…} y={…} title="Thorin" onClose={close} groups={[
     { heading: "Add to the party of…", items: [{ label: "Saltmarsh", onSelect }] , empty: "No campaigns yet" },
     { items: [{ label: "Delete…", onSelect, danger: true }] },
   ]} />

   - Opens at x/y (page coordinates from the mouse event) and moves itself
     back inside the window if it would spill over an edge.
   - Closes on a click outside, Escape, scrolling or resizing.
   - Arrow keys move between items, Enter picks one.
   Rendered into <body> (a "portal") so no parent's overflow can clip it,
   and layered above card windows (their z-index counts up from 100). */

// A thin leather-coloured edge and a drop shadow (the desk slot, so it follows the theme).
const LEATHER_EDGE = "0 0 0 1px rgb(var(--c-desk) / 0.55), 0 12px 32px rgba(0,0,0,0.55)";

export default function ParchmentMenu({ x, y, title, subtitle, groups, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Keep the menu inside the window.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const pad = 8;
    setPos({
      left: Math.max(pad, Math.min(x, window.innerWidth - width - pad)),
      top: Math.max(pad, Math.min(y, window.innerHeight - height - pad)),
    });
  }, [x, y]);

  // Close on outside click, Escape, scroll or resize.
  useEffect(() => {
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  // Focus the first item so the keyboard works straight away.
  useEffect(() => {
    ref.current?.querySelector("button:not([disabled])")?.focus({ preventScroll: true });
  }, []);

  const onKeyDown = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...ref.current.querySelectorAll("button:not([disabled])")];
    const i = items.indexOf(document.activeElement);
    const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      className={`fixed z-[100000] max-h-[70vh] min-w-[13rem] max-w-[18rem] overflow-y-auto rounded-[3px] bg-page py-2 font-body ${INK.ink}`}
      style={{ left: pos.left, top: pos.top, boxShadow: LEATHER_EDGE }}
    >
      {title && (
        <div className="px-3 pb-1.5">
          <div className="truncate text-[15px] font-semibold">{title}</div>
          {subtitle && <div className={`truncate text-[11px] italic ${INK.faded}`}>{subtitle}</div>}
        </div>
      )}
      {groups.map((g, gi) => (
        <div key={gi} className={gi > 0 || title ? "mt-1 border-t border-rule/25 pt-1" : ""}>
          {g.heading && <div className={`px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${INK.faded}`}>{g.heading}</div>}
          {g.items.length === 0 && g.empty && <div className={`px-3 py-1 text-xs italic ${INK.faint}`}>{g.empty}</div>}
          {g.items.map((item, ii) => (
            <button
              key={ii}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.hint}
              onClick={() => {
                onClose();
                item.onSelect();
              }}
              className={`flex w-full items-baseline gap-2 px-3 py-1 text-left text-sm outline-none transition hover:bg-ink/[0.07] focus:bg-ink/[0.09] disabled:cursor-default disabled:opacity-40 ${
                item.danger ? INK.rubric : ""
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.note && <span className={`shrink-0 text-[11px] italic ${INK.faint}`}>{item.note}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>,
    document.body
  );
}