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

export default function FeatureList({ rows, ch, d, patchChar, empty = "None.", twoColumns = true, openKey: outerKey, setOpenKey: setOuterKey, extra, hideOwner = false, restorable = true }) {
  const openPopup = usePopupStore((s) => s.open);
  const [innerKey, setInnerKey] = useState(null);
  const openKey = setOuterKey ? outerKey : innerKey;
  const setOpenKey = setOuterKey || setInnerKey;
  if (!rows.length) return <Hint>{empty}</Hint>;
  const now = (patch) => patchChar(patch, { now: true });
  const groups = withParts(rows);
  const anyOpen = (g) => g.some(({ r }) => r.key === openKey);
  return (
    <div className={`grid grid-cols-1 items-start gap-x-10 ${twoColumns ? "@5xl:grid-cols-2" : ""}`}>
      {groups.map((g) => (
        <div key={g[0].r.key} className={anyOpen(g) ? "col-span-full" : ""}>
          {g.map(({ r, depth }) => renderRow(r, depth))}
        </div>
      ))}
    </div>
  );

  function renderRow(r, depth) {
        const open = openKey === r.key;
        const own = isOwnRow(r);
        return (
          <div key={r.key} style={depth ? { marginLeft: `${depth * 1.4}rem` } : undefined}>
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
                pb={d?.pb}
                onPatch={(p) => patchChar(patchFeature(ch, r.from, r.feature.id, p))}
                onTurnIntoPool={() => now(turnIntoPool(ch, d, r))}
                onRestore={() => now(restoreFeature(ch, r.from, r.feature.id))}
                onRemove={() => {
                  const name = r.feature.name || "this feature";
                  if (!window.confirm(own ? `Delete "${name}"?` : `Take "${name}" off the sheet?${restorable ? ` You can bring it back under "taken off".` : ""}`)) return;
                  now(!own ? setFeatureRemoved(ch, r.from, r.feature.id, true) : r.kind === "manual" ? removeOwnFeature(ch, r.feature.id) : removeLayerFeature(ch, r.from, r.feature.id));
                  setOpenKey(null);
                }}
                onDone={() => setOpenKey(null)}
              />
            )}
          </div>
        );
  }
}

/* The rows grouped so a feature's parts (Bladesong → Agility, Bladework,
   Focus; Monk's Focus → Flurry of Blows…) sit right under it, indented:
   [[{ r, depth }]] — one group per top feature. A part whose feature
   isn't in the list stands on its own. */
function withParts(rows) {
  const byId = new Map(rows.map((r) => [`${r.from}#${r.feature.id}`, r]));
  const parentOf = (r) => (r.feature.parent ? byId.get(`${r.from}#${r.feature.parent}`) : null);
  const kids = new Map();
  for (const r of rows) {
    const p = parentOf(r);
    if (p) kids.set(p.key, [...(kids.get(p.key) || []), r]);
  }
  const out = [];
  const walk = (r, depth, group, seen) => {
    if (seen.has(r.key)) return;
    seen.add(r.key);
    group.push({ r, depth });
    for (const k of kids.get(r.key) || []) walk(k, depth + 1, group, seen);
  };
  const seen = new Set();
  for (const r of rows) {
    if (parentOf(r)) continue;
    const group = [];
    walk(r, 0, group, seen);
    out.push(group);
  }
  for (const r of rows) if (!seen.has(r.key)) out.push([{ r, depth: 0 }]); // a loop of parents: shown flat
  return out;
}

/* The features of some layers that were taken off the sheet, each a
   button that brings it back; folded away until opened ("taken off (3)").
   test(from, feature) picks the layers. Only the Biography and Class tabs
   use it: a race's or a class's feature is tedious to get back otherwise. */
export function TakenOff({ ch, patchChar, test }) {
  const [open, setOpen] = useState(false);
  const gone = takenOffFeatures(ch, test);
  if (!gone.length) return null;
  return (
    <p className={`mt-2 flex flex-wrap items-baseline gap-x-3 text-xs italic ${INK.faded}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="italic hover:text-ink">
        <span className={`mr-1 inline-block text-[9px] transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        taken off ({gone.length})
      </button>
      {open && gone.map((g) => (
        <InkButton key={`${g.from}#${g.feature.id}`} onClick={() => patchChar(setFeatureRemoved(ch, g.from, g.feature.id, false), { now: true })} title={`From ${g.owner}. Bring it back`}>
          {g.feature.name || "unnamed"}
        </InkButton>
      ))}
    </p>
  );
}
