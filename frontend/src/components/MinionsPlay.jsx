import React, { useState, useRef, useCallback } from "react";
import useMonsterStore from "../store/MonsterStore";
import MinionPopup from "../utils/MinionPopup";

export function MinionsPlay() {
  const minionsData = useMonsterStore((s) => s.minionsData) || [];

  // We allow multiple popups; each entry tracks which minion index it shows
  const [openItems, setOpenItems] = useState([]); // [{ popupId, index }]

  const open = (index) => {
    const popupId = crypto.randomUUID();
    setOpenItems((prev) => [...prev, { popupId, index }]);
  };

  const close = (popupId) => {
    setOpenItems((prev) => prev.filter((p) => p.popupId !== popupId));
  };

  function EffectList({ effects }) {
    if (!effects || effects.length === 0) return null;
    return effects.map((effect) => (
      <p key={effect.id || effect.name}>{effect.name}</p>
    ));
  }

  return (
    <div>
      {/* Minions grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {minionsData.map((item, index) => (
          <button
            key={index}
            onClick={() => open(index)}
            className="border border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100 px-2 py-2 rounded text-left"
          >
            <div className="flex flex-col">
              <div className="flex justify-between">
                <p className="text-amber-400 font-medium">{item.name}</p>
                <p>#{item.amount}</p>
              </div>
              <div className="flex gap-2 text-sm text-amber-700">
                <p>HP: {item.max_hp}</p>
                <p>AC: {item.ac}</p>
              </div>
              <EffectList effects={item.actions} />
              <EffectList effects={item.bonus_actions} />
              <EffectList effects={item.reactions} />
            </div>
          </button>
        ))}
      </div>

      {/* Floating draggable popups */}
      {openItems.map(({ popupId, index }) => {
        const item = minionsData[index];
        if (!item) return null; // if minion removed or list changed

        return (
          <DraggableMinionPopup
            key={popupId}
            item={item}
            onClose={() => close(popupId)}
          />
        );
      })}
    </div>
  );
}

/* ------------ Draggable wrapper ------------- */



function DraggableMinionPopup({ item, onClose }) {
  // Initial position; you can tweak these or randomize a bit if you like
  const [position, setPosition] = useState({ x: 200, y: 120 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e) => {
    dragging.current = true;
    offset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [position.x, position.y]); // used only once at drag start, so this is fine

  const handleMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    setPosition({
      x: e.clientX - offset.current.x,
      y: e.clientY - offset.current.y,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  // Render a fixed-position box, no backdrop, no outside-click closing
  return (
    <div
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 50, // always on top of the main page; last opened is on top visually
      }}
      className="w-[520px] max-w-[95vw] max-h-[90vh] overflow-auto rounded-lg border border-slate-700 bg-slate-950 shadow-xl"
    >
      <MinionPopup
        item={item}
        onClose={onClose}
        onDragStart={handleMouseDown}
      />
    </div>
  );
}
