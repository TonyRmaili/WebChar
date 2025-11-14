import React, { useState } from "react";
import Selecto from "react-selecto";

function SelectorTest({ userData }) {
  const characters = userData?.characters ?? [
    { id: 1, name: "Alice the Wizard" },
    { id: 2, name: "Borin the Fighter" },
    { id: 3, name: "Cira the Rogue" },
    { id: 4, name: "Dorin the Cleric" },
  ];

  const [selectedTargets, setSelectedTargets] = useState([]);

  return (
    <div className="p-2 text-slate-100">
      <h2 className="mb-2 text-sm font-semibold">
        DiceTower – drag a box to select checkboxes
      </h2>

      {/* This class is used as the selection area */}
      <div className="select-container relative border border-slate-700 rounded-lg p-3 bg-slate-900/80">
        <div className="flex flex-col gap-2">
          {characters.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-2 text-slate-100 cursor-pointer"
            >
              {/* Each selectable element has .selectable */}
              <span
                className={
                  "selectable inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-700 bg-slate-800" +
                  (selectedTargets.some((el) => el.dataset.id === String(c.id))
                    ? " ring-2 ring-amber-500"
                    : "")
                }
                data-id={c.id}
              >
                <input type="checkbox" readOnly />
                <span className="text-xs">{c.name}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Selecto: use CSS selectors, no refs, no Moveable yet */}
      <Selecto
        // Area where the selection box is drawn
        container={".select-container"}
        // Which elements can be selected
        selectableTargets={[".selectable"]}
        selectByClick={true}
        selectFromInside={false}
        toggleContinueSelect={"shift"} // hold Shift to multi-select
        hitRate={0}
        ratio={0}
        onSelect={(e) => {
          setSelectedTargets(e.selected);
        }}
      />

      <pre className="mt-3 text-xs text-slate-400 bg-slate-900/80 p-2 rounded border border-slate-700">
        Selected IDs:{" "}
        {selectedTargets.map((el) => el.dataset.id).join(", ") || "none"}
      </pre>
    </div>
  );
}

export default SelectorTest;

