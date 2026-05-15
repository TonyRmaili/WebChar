import React, { useEffect, useState, useMemo } from "react";
import { useDnDStore } from "../../../store/DndStore";

export default function Backgrounds() {
  const backgrounds = useDnDStore((s) => s.backgrounds);
  const loading = useDnDStore((s) => s.loadingBackgrounds);
  const error = useDnDStore((s) => s.error);
  const loadBackgrounds = useDnDStore((s) => s.loadBackgrounds);

  useEffect(() => {
    loadBackgrounds();
  }, [loadBackgrounds]);

  return (
    <div className="text-amber-400">
      {loading && <p>Loading backgrounds...</p>}
      {error && <p>{error}</p>}

      {!loading && backgrounds && (
        <>
          {backgrounds.map((bg) => (
            <div key={bg.id || bg.name}>
              {bg.name} | {bg.source}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
