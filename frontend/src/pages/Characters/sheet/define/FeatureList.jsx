import React, { useState } from "react";
import { usePopupStore } from "../../../../store/PopupStore";
import { Hint } from "../../../../styles/parchmentForm";
import { INK, InkButton } from "../../../../styles/parchment";
import { isOwnRow, patchFeature, removeLayerFeature, removeOwnFeature, resourceRows, restoreFeature, setFeatureFlag, setFeatureRemoved, takenOffFeatures } from "../featureHelpers";
import { turnIntoPool } from "../resourceHelpers";
import { FeatureEditor, FeatureLine } from "./FeatureRow";

/* A list of features, the same everywhere on the sheet: one ledger line
   each (◆ shown in Play, the name, its numbers), click the name to open
   the editor under it. Every feature is the character's own copy, so any
   of them can be changed here; a changed one says "edited" and has
   "back to the book's". Your own (the manual layer's, or one you added to
   a race or background) are deleted by "remove"; one the book gave is
   taken off the sheet and listed under "taken off" (TakenOff) to bring back.

   rows: featureHelpers.featureRows(ch, d), filtered by the tab.
   openKey / setOpenKey: pass them to open a row from outside (a feature
   just added); otherwise the list keeps its own.
   extra(row): more controls shown above the editor when a row is open
   (the Class tab's level and core/subclass for your own).
   hideOwner: leave out each line's "from" tag (the list already says it).

   Clicking a name opens the feature's card (FeatureCardPopup, the copy
   as it is now); "edit" opens the editor under the line. */

// The card's data: the copy as the sheet works it out.
export const featureCardOf = (r) => ({
  _sheet: true,
  key: r.key,
  name: r.feature.name,
  source: r.owner,
  owner: r.owner,
  level: r.feature.level,
  category: r.category,
  text: typeof r.feature.text === "string" ? r.feature.text : "",
  uses: r.uses,
  usesRaw: r.feature.uses,
  spends: r.consumes && !r.consumes.missing ? `${r.consumes.amount} ${r.consumes.name}` : null,
  action: r.action,
  toggle: r.isToggle,
  on: r.on,
  edited: !!r.feature.edited,
  own: !!r.feature.own || r.kind === "manual",
});

export default function FeatureList({ rows, ch, d, patchChar, empty = "None.", twoColumns = true, openKey: outerKey, setOpenKey: setOuterKey, extra, hideOwner = false }) {
  const openPopup = usePopupStore((s) => s.open);
  const [innerKey, setInnerKey] = useState(null);
  const openKey = setOuterKey ? outerKey : innerKey;
  const setOpenKey = setOuterKey || setInnerKey;
  if (!rows.length) return <Hint>{empty}</Hint>;
  const now = (patch) => patchChar(patch, { now: true });
  return (
    <div className={`grid grid-cols-1 items-start gap-x-10 ${twoColumns ? "@5xl:grid-cols-2" : ""}`}>
      {rows.map((r) => {
        const open = openKey === r.key;
        const own = isOwnRow(r);
        return (
          <div key={r.key} className={open ? "col-span-full" : ""}>
            <FeatureLine
              row={r}
              open={open}
              hideOwner={hideOwner}
              onView={() => openPopup("feature", featureCardOf(r))}
              onToggle={() => setOpenKey(open ? null : r.key)}
              onActive={(v) => now(setFeatureFlag(ch, r.from, r.feature.id, "active", v))}
            />
            {open && extra?.(r)}
            {open && (
              <FeatureEditor
                row={r}
                pools={resourceRows(ch, d)}
                onPatch={(p) => patchChar(patchFeature(ch, r.from, r.feature.id, p))}
                onTurnIntoPool={() => now(turnIntoPool(ch, d, r))}
                onRestore={() => now(restoreFeature(ch, r.from, r.feature.id))}
                onRemove={() => {
                  const name = r.feature.name || "this feature";
                  if (!window.confirm(own ? `Delete "${name}"?` : `Take "${name}" off the sheet? You can bring it back under "taken off".`)) return;
                  now(!own ? setFeatureRemoved(ch, r.from, r.feature.id, true) : r.kind === "manual" ? removeOwnFeature(ch, r.feature.id) : removeLayerFeature(ch, r.from, r.feature.id));
                  setOpenKey(null);
                }}
                onDone={() => setOpenKey(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* The features of some layers that were taken off the sheet, each a
   button that brings it back. test(from, feature) picks the layers. */
export function TakenOff({ ch, patchChar, test }) {
  const gone = takenOffFeatures(ch, test);
  if (!gone.length) return null;
  return (
    <p className={`mt-2 flex flex-wrap items-baseline gap-x-3 text-xs italic ${INK.faded}`}>
      taken off:
      {gone.map((g) => (
        <InkButton key={`${g.from}#${g.feature.id}`} onClick={() => patchChar(setFeatureRemoved(ch, g.from, g.feature.id, false), { now: true })} title={`From ${g.owner}. Bring it back`}>
          {g.feature.name || "unnamed"}
        </InkButton>
      ))}
    </p>
  );
}
