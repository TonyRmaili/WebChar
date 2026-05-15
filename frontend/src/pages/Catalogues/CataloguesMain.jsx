import React, { useState } from "react";

import Items from "./Items/Items";
import Races from "./Races/Races";
import Classes from "./Classes/Classes";
import Feats from "./Feats/Feats";

import Backgrounds from "./Backgrounds/Backgrounds";
// import Spells from "./Spells/Spells";

const TOOLS = [
  { id: "races", label: "Races" },
  { id: "items", label: "Items" },
  { id: "classes", label: "Classes" },
  { id: "feats", label: "Feats" },
  { id: "backgrounds", label: "Backgrounds" },
  { id: "spells", label: "Spells" },
];

function CataloguesMain() {
  const [activeTool, setActiveTool] = useState("races");

  return (
    <div className="w-full min-h-screen p-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="flex justify-center text-2xl font-bold text-white">Catalogues</h1>
      </div>

      {/* Tab Strip */}
      <div className="mb-4 flex justify-center gap-1 border-b border-slate-700">
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.id;

          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`px-4 h-9 text-sm font-medium rounded-t-md -mb-px border-b-2 transition-colors ${
                isActive
                  ? "text-amber-400 border-amber-500 bg-slate-900/40"
                  : "text-slate-400 hover:text-amber-400 border-transparent"
              }`}
            >
              {tool.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-4 min-h-[700px]">
        {activeTool === "races" && <Races />}

        {activeTool === "items" && <Items />}

        {activeTool === "classes" && <Classes />}

        {activeTool === "feats" && <Feats />}

        {activeTool === "backgrounds" && <Backgrounds />}

        {activeTool === "spells" && (
          <div className="text-slate-500 italic">
            Spells catalogue coming soon
          </div>
        )}
      </div>
    </div>
  );
}

export default CataloguesMain;