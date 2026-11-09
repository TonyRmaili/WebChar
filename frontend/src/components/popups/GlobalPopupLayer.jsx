import React, { Component } from "react";
import { usePopupStore } from "../../store/PopupStore";
import { POPUP_REGISTRY } from "./popupRegistry";

/* The card windows. Each has a leather title bar (drag it to move,
   right-click anywhere to minimize) and a gold corner to resize. What's
   inside is the popup type's own component. Colours are theme slots. */

class PopupErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("PopupBody crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="wc-page h-full overflow-auto p-4 text-sm">
          <div className="mb-2 font-bold text-bad">This card couldn't be shown</div>
          <div className="whitespace-pre-wrap text-xs text-ink-faded">{String(this.state.error)}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function GlobalPopupLayer() {
  const openPopups = usePopupStore((s) => s.openPopups);
  const close = usePopupStore((s) => s.close);
  const minimize = usePopupStore((s) => s.minimize);
  const focus = usePopupStore((s) => s.focus);
  const move = usePopupStore((s) => s.move);
  const resize = usePopupStore((s) => s.resize);

  return (
    <>
      {openPopups.map((win) => (
        <PopupFrame key={win.id} win={win} onClose={close} onMinimize={minimize} onFocus={focus} onMove={move} onResize={resize} />
      ))}
    </>
  );
}

const barBtn = "rounded px-2 leading-6 text-desk-ink-faded transition-colors hover:bg-desk-deep/60 hover:text-desk-accent";

function PopupFrame({ win, onClose, onMinimize, onFocus, onMove, onResize }) {
  const entry = POPUP_REGISTRY[win.type];
  if (!entry) return null;

  const Body = entry.component;
  const bodyProps = { [entry.propName]: win.data };

  const beginDrag = (e) => {
    if (e.target.closest("button")) return;
    if (e.button !== 0) return;
    e.preventDefault();
    onFocus(win.id);

    const startX = e.clientX,
      startY = e.clientY;
    const originX = win.x,
      originY = win.y;

    const onMouseMove = (ev) => onMove(win.id, originX + (ev.clientX - startX), Math.max(0, originY + (ev.clientY - startY)));
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const beginResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onFocus(win.id);

    const startX = e.clientX,
      startY = e.clientY;
    const originW = win.width,
      originH = win.height;

    const onMouseMove = (ev) => onResize(win.id, Math.max(320, originW + (ev.clientX - startX)), Math.max(240, originH + (ev.clientY - startY)));
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Right-click anywhere on the card minimizes it. Buttons (close /
  // minimize) and the resize corner stop propagation so their own clicks
  // aren't hijacked.
  const handleContextMenu = (e) => {
    e.preventDefault();
    onMinimize(win.id);
  };

  return (
    <div
      onMouseDown={() => onFocus(win.id)}
      onContextMenu={handleContextMenu}
      className="fixed flex flex-col overflow-hidden rounded-md bg-desk-deep shadow-2xl ring-1 ring-desk"
      style={{ left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.zIndex }}
    >
      <div onMouseDown={beginDrag} className="wc-desk flex cursor-move select-none items-center justify-between border-b border-stitch/30 px-2 py-1 font-body">
        <span className="truncate text-sm font-semibold tracking-wide text-desk-ink">{win.data.name}</span>
        <div className="flex gap-1">
          <button className={barBtn} onClick={() => onMinimize(win.id)} title="Minimize">
            −
          </button>
          <button className={`${barBtn} hover:!bg-bad/70 hover:!text-desk-ink`} onClick={() => onClose(win.id)} title="Close">
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <PopupErrorBoundary>
          <Body {...bodyProps} />
        </PopupErrorBoundary>
      </div>

      <div onMouseDown={beginDrag} className="absolute bottom-0 left-0 top-0 w-1.5 cursor-move" />
      <div onMouseDown={beginDrag} className="absolute bottom-4 right-0 top-0 w-1.5 cursor-move" />
      <div onMouseDown={beginDrag} className="absolute bottom-0 left-0 right-4 h-1.5 cursor-move" />

      <div
        onMouseDown={beginResize}
        className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
        style={{
          background: "linear-gradient(135deg, transparent 50%, rgb(var(--c-desk-accent)) 50%, rgb(var(--c-desk-accent)) 70%, transparent 70%)",
        }}
      />
    </div>
  );
}