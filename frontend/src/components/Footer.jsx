import React, { useState } from "react";
import { usePopupStore } from "../store/PopupStore";
import OmniSearch from "./OmniSearch";

/* ---------------- Inline icon set ---------------- */
const Icon = ({ name, className = "h-5 w-5" }) => {
  const p = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    xmlns: "http://www.w3.org/2000/svg",
  };
  switch (name) {
    case "embedder": // sparkles
      return (<svg {...p}>
        <path d="M12 3l1.6 4.2a2 2 0 0 0 1.2 1.2L19 10l-4.2 1.6a2 2 0 0 0-1.2 1.2L12 17l-1.6-4.2a2 2 0 0 0-1.2-1.2L5 10l4.2-1.6a2 2 0 0 0 1.2-1.2z" />
        <path d="M18.5 14l.5 1.6 1.6.5-1.6.5-.5 1.6-.5-1.6-1.6-.5 1.6-.5z" />
      </svg>);
    case "dice": // faceted die
      return (<svg {...p}><path d="M12 2.5 4 7v10l8 4.5 8-4.5V7z" /><path d="M4 7l8 4.5L20 7M12 11.5V22" /></svg>);
    case "cards": // stacked cards
      return (<svg {...p}><rect x="8" y="3" width="12" height="16" rx="2" /><path d="M5 7v11a2 2 0 0 0 2 2h9" /></svg>);
    case "trash":
      return (<svg {...p}><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>);
    default:
      return null;
  }
};

/* ---------------- Reusable items ---------------- */
const itemCls =
  "group flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-slate-800 hover:text-amber-400";

const ToolButton = ({ icon, label, onClick }) => (
  <button type="button" onClick={onClick} className={itemCls}>
    <Icon name={icon} className="h-[22px] w-[22px]" />
    <span className="text-[11px] font-medium tracking-wide">{label}</span>
  </button>
);

/* ---------------- Footer ---------------- */
function Footer() {
  const [open, setOpen] = useState(false);
  
  const minimized = usePopupStore((s) => s.minimized);
  const restore = usePopupStore((s) => s.restore);
  const clearMinimized = usePopupStore((s) => s.clearMinimized);

  const hasMinimized = minimized.length > 0;

  return (
    <>
      {/* hover trigger strip (always present so the footer is reachable) */}
      <div
        onMouseEnter={() => setOpen(true)}
        className="fixed inset-x-0 bottom-0 z-40 h-2.5"
      >
        <div className="mx-auto h-1 w-24 rounded-t-full bg-amber-400/40" />
      </div>

      <footer
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocusCapture={() => setOpen(true)}
        onBlurCapture={() => setOpen(false)}
        className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="border-t border-slate-700/80 bg-slate-900/95 px-3 py-2 font-serif text-slate-300 backdrop-blur-md">
          {/* ---- controls row ---- */}
          <div className="flex h-14 items-center gap-3 justify-between">
            

            {/* tools (popups / features — wired later via PopupStore) */}
            <div className="flex items-center gap-1">
              <ToolButton icon="embedder" label="Embedder" onClick={() => {/* TODO: embedder prompt */}} />
              <ToolButton icon="dice" label="DiceTower" onClick={() => {/* TODO: open dice tower popup */}} />
              <ToolButton icon="cards" label="CardDeck" onClick={() => {/* TODO: open card deck */}} />
            </div>

            
            {/* clear all — only when there's something minimized */}
            {hasMinimized && (
              <>
                <div className="h-8 w-px bg-slate-700/80" />
                <button
                  type="button"
                  onClick={clearMinimized}
                  title="Clear all minimized"
                  className="flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-red-300/90 transition-colors hover:bg-red-900/40 hover:text-red-200"
                >
                  <Icon name="trash" className="h-[22px] w-[22px]" />
                  <span className="text-[11px] font-medium tracking-wide">Clear all</span>
                </button>
              </>
            )}
           <OmniSearch />
          </div>

          {/* ---- minimized popups row (wraps onto new lines below the buttons) ---- */}
          {hasMinimized && (
            <div className="mt-1 flex flex-wrap gap-2 border-t border-slate-700/50 pt-2">
              {minimized.map((win) => (
                <button
                  key={win.id}
                  onClick={() => restore(win.id)}
                  title={win.data.name}
                  className="max-w-[200px] truncate rounded border border-stone-400 bg-stone-200 px-3 py-1 text-sm text-stone-900 transition-colors hover:bg-stone-300"
                >
                  {win.data.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </footer>
    </>
  );
}

export default Footer;