import React, { useState, useRef } from "react";
import ItemPopup from "./ItemPopup";

export function useItemPopups() {
  const [openPopups, setOpenPopups] = useState([]);
  const [minimized, setMinimized] = useState([]);
  const zCounter = useRef(100);

  const openItem = (item) => {
    const id = `${item.name}__${item.source}`;

    // If already minimized, restore it
    if (minimized.some((p) => p.id === id)) {
      restore(id);
      return;
    }
    // If already open, just focus
    if (openPopups.some((p) => p.id === id)) {
      focus(id);
      return;
    }

    const offset = openPopups.length * 30;
    zCounter.current += 1;

    setOpenPopups((prev) => [
      ...prev,
      {
        id,
        item,
        x: 120 + offset,
        y: 80 + offset,
        width: 480,
        height: 560,
        zIndex: zCounter.current,
      },
    ]);
  };

  const close = (id) => setOpenPopups((prev) => prev.filter((p) => p.id !== id));

  const minimize = (id) => {
    setOpenPopups((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) setMinimized((m) => [...m, target]);
      return prev.filter((p) => p.id !== id);
    });
  };

  const restore = (id) => {
    setMinimized((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) {
        zCounter.current += 1;
        setOpenPopups((o) => [...o, { ...target, zIndex: zCounter.current }]);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const focus = (id) => {
    zCounter.current += 1;
    const z = zCounter.current;
    setOpenPopups((prev) =>
      prev.map((p) => (p.id === id ? { ...p, zIndex: z } : p))
    );
  };

  const move = (id, x, y) =>
    setOpenPopups((prev) =>
      prev.map((p) => (p.id === id ? { ...p, x, y } : p))
    );

  const resize = (id, width, height) =>
    setOpenPopups((prev) =>
      prev.map((p) => (p.id === id ? { ...p, width, height } : p))
    );

  return {
    openPopups, minimized,
    openItem, close, minimize, restore, focus, move, resize,
  };
}

export default function ItemPopupLayer({ popups, minimized, onClose, onMinimize, onRestore, onFocus, onMove, onResize }) {
  const handleDragStart = (e, win) => {
    if (e.target.closest("button")) return;
    e.preventDefault();
    onFocus(win.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const originX = win.x;
    const originY = win.y;

    const onMouseMove = (ev) => {
      onMove(win.id, originX + (ev.clientX - startX), originY + (ev.clientY - startY));
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleResizeStart = (e, win) => {
    e.preventDefault();
    e.stopPropagation();
    onFocus(win.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const originW = win.width;
    const originH = win.height;

    const onMouseMove = (ev) => {
      onResize(
        win.id,
        Math.max(320, originW + (ev.clientX - startX)),
        Math.max(240, originH + (ev.clientY - startY))
      );
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <>
      {popups.map((win) => (
        <div
          key={win.id}
          onMouseDown={() => onFocus(win.id)}
          className="fixed border border-stone-400 rounded shadow-xl flex flex-col overflow-hidden"
          style={{
            left: win.x,
            top: win.y,
            width: win.width,
            height: win.height,
            zIndex: win.zIndex,
          }}
        >
          <div
            onMouseDown={(e) => handleDragStart(e, win)}
            className="flex items-center justify-between px-2 py-1 border-b border-stone-400 bg-stone-200 cursor-move select-none"
          >
            <span className="truncate text-stone-900 font-semibold text-sm">
              {win.item.name}
            </span>
            <div className="flex gap-1">
              <button
                className="px-2 hover:bg-stone-300 rounded text-stone-700"
                onClick={() => onMinimize(win.id)}
              >
                −
              </button>
              <button
                className="px-2 hover:bg-red-300 rounded text-stone-700"
                onClick={() => onClose(win.id)}
              >
                ×
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <ItemPopup item={win.item} />
          </div>

          <div
            onMouseDown={(e) => handleResizeStart(e, win)}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
            style={{
              background:
                "linear-gradient(135deg, transparent 50%, rgb(180 83 9) 50%, rgb(180 83 9) 70%, transparent 70%)",
            }}
          />
        </div>
      ))}

      <div className="fixed bottom-2 left-2 flex gap-2 z-[1000]">
        {minimized.map((win) => (
          <button
            key={win.id}
            onClick={() => onRestore(win.id)}
            className="px-3 py-1 bg-stone-200 text-stone-900 border border-stone-400 rounded text-sm hover:bg-stone-300"
          >
            {win.item.name}
          </button>
        ))}
      </div>
    </>
  );
}