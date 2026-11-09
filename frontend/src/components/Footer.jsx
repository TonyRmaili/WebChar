import React, { useMemo, useState } from "react";
import { usePopupStore } from "../store/PopupStore";
import { DeckPanel, DeckStacks, closeAll } from "./CardDeck";
import { DICE_WINDOW, toggleDiceTower } from "./dice/DiceTowerWindow";
import { deckCards } from "./popups/decks";
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
  "group relative flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-slate-800 hover:text-amber-400";

const ToolButton = ({ icon, label, onClick, active = false, badge, ...rest }) => (
  <button type="button" onClick={onClick} className={`${itemCls} ${active ? "bg-slate-800 text-amber-400" : ""}`} {...rest}>
    <Icon name={icon} className="h-[22px] w-[22px]" />
    <span className="text-[11px] font-medium tracking-wide">{label}</span>
    {badge ? (
      <span className="absolute right-1 top-0.5 min-w-[1.1rem] rounded-full bg-amber-500 px-1 text-center text-[10px] font-semibold leading-4 text-slate-900">{badge}</span>
    ) : null}
  </button>
);

/* ---------------- Footer ----------------
   Slides up when the mouse reaches the bottom edge. The DiceTower button
   opens the tower or puts it away — minimized, it waits behind the button
   rather than in a deck. Minimized cards sit in decks (CardDeck.jsx); the CardDeck button, or a deck, opens the
   deck panel above the footer, and the footer stays up while it's open.
   It sits above every card window (their z-index counts up from 100) and
   below right-click menus (100000). */
function Footer() {
  const [open, setOpen] = useState(false);
  const [deckPanel, setDeckPanel] = useState(null); // null | "all" | a deck id

  // The dice tower minimizes behind its own button, not into the deck.
  const allMinimized = usePopupStore((s) => s.minimized);
  const minimized = useMemo(() => deckCards(allMinimized), [allMinimized]);
  const hasMinimized = minimized.length > 0;
  const towerOpen = usePopupStore((s) => s.openPopups.some((p) => p.id === DICE_WINDOW));

  const showPanel = (panel) => {
    setDeckPanel(panel);
    if (panel) setOpen(true);
  };

  return (
    <>
      {/* hover trigger strip (always present so the footer is reachable) */}
      <div
        onMouseEnter={() => setOpen(true)}
        className="fixed inset-x-0 bottom-0 z-[89999] h-2.5"
      >
        <div className="mx-auto h-1 w-24 rounded-t-full bg-amber-400/40" />
      </div>

      <footer
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => !deckPanel && setOpen(false)}
        onFocusCapture={() => setOpen(true)}
        onBlurCapture={() => !deckPanel && setOpen(false)}
        className={`fixed inset-x-0 bottom-0 z-[90000] transition-transform duration-300 ease-out ${
          open || deckPanel ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <DeckPanel panel={deckPanel} setPanel={showPanel} />

        <div className="border-t border-slate-700/80 bg-slate-900/95 px-3 py-2 font-serif text-slate-300 backdrop-blur-md">
          {/* ---- controls row ---- */}
          <div className="flex h-14 items-center gap-3 justify-between">

            {/* tools (popups / features — wired later via PopupStore) */}
            <div className="flex items-center gap-1">
              <ToolButton icon="embedder" label="Embedder" onClick={() => {/* TODO: embedder prompt */}} />
              <ToolButton
                icon="dice"
                label="DiceTower"
                active={towerOpen}
                onClick={toggleDiceTower}
                title={towerOpen ? "Put the dice tower away (it keeps everything)" : "Open the dice tower"}
              />
              <ToolButton
                icon="cards"
                label="CardDeck"
                data-deck-toggle
                active={deckPanel === "all"}
                badge={minimized.length || null}
                onClick={() => showPanel(deckPanel === "all" ? null : "all")}
              />
            </div>

            {/* close every minimized card — only when there's something minimized */}
            {hasMinimized && (
              <>
                <div className="h-8 w-px bg-slate-700/80" />
                <button
                  type="button"
                  onClick={() => closeAll(minimized)}
                  title="Close every minimized card"
                  className="flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-red-300/90 transition-colors hover:bg-red-900/40 hover:text-red-200"
                >
                  <Icon name="trash" className="h-[22px] w-[22px]" />
                  <span className="text-[11px] font-medium tracking-wide">Clear all</span>
                </button>
              </>
            )}
           <OmniSearch />
          </div>

          {/* ---- minimized cards, one stack per deck ---- */}
          <DeckStacks panel={deckPanel} setPanel={showPanel} />
        </div>
      </footer>
    </>
  );
}

export default Footer;