import React, { useMemo } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { CardHeader, MechanicsSection, RichText } from "../catalogueParts";
import { buildNameIndex, formatSource } from "../catalogueHelpers";

/* A background's card: the book text, then "What it gives" — the
   grants, choices and features the builder reads from the data. Names
   of feats, items and spells come from whichever catalogues are loaded,
   otherwise from their ids. */
export default function BackgroundPopup({ background }) {
  const feats = useCatalogueStore((s) => s.feats);
  const items = useCatalogueStore((s) => s.items);
  const spells = useCatalogueStore((s) => s.spells);
  const index = useMemo(() => buildNameIndex(feats, items, spells), [feats, items, spells]);

  if (!background) return null;

  return (
    <div className="wc-page h-full overflow-y-auto !rounded-none">
      <div className="px-5 py-4">
        <CardHeader entry={background} subtitle={background.source === "HOMEBREW" ? "Homebrew" : formatSource(background.source)} />
        {background.text ? (
          <RichText text={background.text} />
        ) : (
          <p className="text-sm italic text-ink-faded">No description.</p>
        )}
        <MechanicsSection entry={background} index={index} storageKey="catalogue.background.mechanics" />
      </div>
    </div>
  );
}
