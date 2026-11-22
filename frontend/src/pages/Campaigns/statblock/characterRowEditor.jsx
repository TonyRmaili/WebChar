import React from "react";
import { FeatureEditor } from "../../Characters/sheet/define/FeatureRow";

/* The editor that opens under a character's trait or action on the
   statblock card: the same feature editor as the sheet's Features tab,
   on this copy of the character. `entry.featureRow` comes from
   characterView; `row` is the feature as it is now. The player's own
   features (the manual layer) can be removed; a layer's feature is
   hidden instead (the ✕ on the line). */

export default function CharacterRowEditor({ entry, row, onPatch, onRemove, onDone }) {
  if (!entry?.featureRow || !row) return null;
  const own = entry.featureRow.kind === "manual";
  return <FeatureEditor row={{ ...entry.featureRow, feature: row }} pools={entry.pools || []} onPatch={onPatch} onRemove={own ? onRemove : null} onDone={onDone} />;
}
