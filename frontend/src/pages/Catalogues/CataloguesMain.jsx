import React, { useState } from "react";

import Items from "./Items/Items";
import Races from "./Races/Races";
import Classes from "./Classes/Classes";
import Feats from "./Feats/Feats";
import Backgrounds from "./Backgrounds/Backgrounds";
import Spells from "./Spells/Spells";
import OptionalFeatures from "./OptionalFeatures/OptionalFeatures";
import Monsters from "./Monsters/Monsters";

import { ParchmentSheet } from "../../styles/parchment";

/* The Catalogues page: a leather tab strip on the desk (the open
   catalogue is a parchment tab, like the sheet's Define tabs), and the
   open catalogue written on a parchment sheet below it. */

const TOOLS = [
  { id: "races", label: "Races" },
  { id: "items", label: "Items" },
  { id: "classes", label: "Classes" },
  { id: "feats", label: "Feats" },
  { id: "backgrounds", label: "Backgrounds" },
  { id: "spells", label: "Spells" },
  { id: "monsters", label: "Monsters" },
  { id: "optionalFeatures", label: "Optional Features" },
];

function CataloguesMain() {
  const [activeTool, setActiveTool] = useState("races");

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1800px] p-6 font-body">
      <h1 className="mb-4 text-center text-2xl tracking-wide text-desk-ink">Catalogues</h1>

      {/* Tab strip */}
      <div className="wc-desk mb-4 flex flex-wrap justify-center gap-1 rounded-xl border border-stitch/25 p-1.5" role="tablist" aria-label="Catalogues">
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTool(tool.id)}
              className={`h-8 rounded-md px-3 text-[15px] transition ${
                isActive ? "bg-page font-semibold text-ink shadow" : "text-desk-ink-faded hover:bg-desk-deep/50 hover:text-desk-accent"
              }`}
            >
              {tool.label}
            </button>
          );
        })}
      </div>

      {/* The open catalogue */}
      <ParchmentSheet>
        <div className="min-h-[700px]">
          {activeTool === "races" && <Races />}
          {activeTool === "items" && <Items />}
          {activeTool === "classes" && <Classes />}
          {activeTool === "feats" && <Feats />}
          {activeTool === "backgrounds" && <Backgrounds />}
          {activeTool === "spells" && <Spells />}
          {activeTool === "optionalFeatures" && <OptionalFeatures />}
          {activeTool === "monsters" && <Monsters />}
        </div>
      </ParchmentSheet>
    </div>
  );
}

export default CataloguesMain;