import React, { Component } from "react";
import { usePopupStore } from "../../store/PopupStore";
import { POPUP_REGISTRY } from "./popupRegistry";


class PopupErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("PopupBody crashed:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-sm text-red-300 bg-red-900/40 h-full overflow-auto">
          <div className="font-bold mb-2">Popup failed to render</div>
          <div className="text-xs whitespace-pre-wrap">{String(this.state.error)}</div>
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
        <PopupFrame
          key={win.id}
          win={win}
          onClose={close}
          onMinimize={minimize}
          onFocus={focus}
          onMove={move}
          onResize={resize}
        />
      ))}
      
    </>
  );
}


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

    const startX = e.clientX, startY = e.clientY;
    const originX = win.x, originY = win.y;

    const onMouseMove = (ev) =>
      onMove(
        win.id,
        originX + (ev.clientX - startX),
        Math.max(0, originY + (ev.clientY - startY))
      );
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

    const startX = e.clientX, startY = e.clientY;
    const originW = win.width, originH = win.height;

    const onMouseMove = (ev) =>
      onResize(
        win.id,
        Math.max(320, originW + (ev.clientX - startX)),
        Math.max(240, originH + (ev.clientY - startY))
      );
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Right-click anywhere on the card minimizes it.
  // Buttons (close/minimize) and the resize corner stop propagation so their
  // own clicks aren't hijacked.
  const handleContextMenu = (e) => {
    e.preventDefault();
    onMinimize(win.id);
  };

  return (
    <div
      onMouseDown={() => onFocus(win.id)}
      onContextMenu={handleContextMenu}
      className="fixed border border-stone-400 rounded shadow-xl flex flex-col overflow-hidden"
      style={{ left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.zIndex }}
    >
      <div
        onMouseDown={beginDrag}
        className="flex items-center justify-between px-2 py-1 border-b border-stone-400 bg-stone-200 cursor-move select-none"
      >
        <span className="truncate text-stone-900 font-semibold text-sm">
          {win.data.name}
        </span>
        <div className="flex gap-1">
          <button
            className="px-2 hover:bg-stone-300 rounded text-stone-700"
            onClick={() => onMinimize(win.id)}
            title="Minimize"
          >
            −
          </button>
          <button
            className="px-2 hover:bg-red-300 rounded text-stone-700"
            onClick={() => onClose(win.id)}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <PopupErrorBoundary>
          <Body {...bodyProps} />
        </PopupErrorBoundary>
      </div>

      <div
        onMouseDown={beginDrag}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-move"
      />
      <div
        onMouseDown={beginDrag}
        className="absolute right-0 top-0 bottom-4 w-1.5 cursor-move"
      />
      <div
        onMouseDown={beginDrag}
        className="absolute left-0 right-4 bottom-0 h-1.5 cursor-move"
      />

      <div
        onMouseDown={beginResize}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        style={{
          background:
            "linear-gradient(135deg, transparent 50%, rgb(180 83 9) 50%, rgb(180 83 9) 70%, transparent 70%)",
        }}
      />
    </div>
  );
}

