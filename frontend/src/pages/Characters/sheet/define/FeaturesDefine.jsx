import React, { useMemo, useState } from "react";
import { INK, InkSelect, InkText, ParchmentSheet, Title } from "../../../../styles/parchment";
import { DefineSection, Hint, addBtn } from "../../../../styles/parchmentForm";
import { useSheet } from "../sheetHelpers";
import { turnIntoPool } from "../resourceHelpers";
import { CATEGORIES, SOURCE_GROUPS, addOwnFeature, featureRows, newOwnFeature, patchFeature, removeOwnFeature, resourceRows, setFeatureFlag, isOptionFeature } from "../featureHelpers";
import { FeatureEditor, FeatureLine } from "./FeatureRow";

/* Define tab: Features — every feature the character has, grouped by
   where it comes from (race, background, class levels, feats, equipped
   items, your own), on parchment.

   Each is a ledger line with the numbers Play shows (worked out for this
   character); the diamond shows or hides it in Play; click the name to
   open its editor. Editing changes the character's own copy, never the
   catalogue. Your own features live in the manual layer and can be
   removed; the others can be hidden. Feats are also on their own tab. */

// Shown on their own tabs now: race and background traits (Biography),
// class and subclass features (Class), feats (Feats), items' features
// (Inventory). What's left here is the player's own.
const MOVED = ["race", "background", "class", "feat", "item"];

export default function FeaturesDefine() {
  const { ch, d, patchChar } = useSheet();
  const [openKey, setOpenKey] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const rows = useMemo(() => featureRows(ch, d).filter((r) => !MOVED.includes(r.kind) && !r.feature.feat && !isOptionFeature(r.feature)), [ch, d]);
  if (!ch || !d) return null;

  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) => (!q || String(r.feature.name || "").toLowerCase().includes(q)) && (!category || r.category === category));
  const filtered = q !== "" || category !== "";

  // Typing saves a moment later; switches and adding save right away.
  const patch = (r, p) => patchChar(patchFeature(ch, r.from, r.feature.id, p));
  const setActive = (r, v) => patchChar(setFeatureFlag(ch, r.from, r.feature.id, "active", v), { now: true });
  const addOwn = () => {
    const f = newOwnFeature("actions");
    patchChar(addOwnFeature(ch, f), { now: true });
    setOpenKey(`manual#${f.id}`);
  };
  const removeOwn = (r) => {
    if (!window.confirm(`Delete "${r.feature.name || "this feature"}"?`)) return;
    patchChar(removeOwnFeature(ch, r.feature.id), { now: true });
    setOpenKey(null);
  };

  const shown = rows.filter((r) => r.active).length;

  return (
    <ParchmentSheet>
      <Title
        after={
          <span className={`text-sm italic ${INK.faded}`}>
            {shown} of {rows.length} shown in Play
          </span>
        }
        right={
          <>
            <InkText value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search…" aria-label="Search features" className="h-7 w-32 text-sm" />
            <InkSelect value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by use" className="h-7 text-sm">
              <option value="">all uses</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.title}
                </option>
              ))}
            </InkSelect>
          </>
        }
      >
        Custom
      </Title>
      <p className={`-mt-4 mb-6 text-xs italic ${INK.faint}`}>◆ = shown in Play · click a name to read or change it</p>

      <div className="space-y-8">
        {SOURCE_GROUPS.map((g) => {
          const list = visible.filter((r) => r.kind === g.key);
          const own = g.key === "manual";
          if (!list.length && !own) return null;
          return (
            <DefineSection
              key={g.key}
              title={g.title}
              count={filtered ? `${list.length} shown` : list.length}
              storageKey={`define.features.${g.key}`}
              actions={
                own
                  ? (setOpen) => (
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(true);
                          addOwn();
                        }}
                        className={addBtn}
                      >
                        + write your own
                      </button>
                    )
                  : undefined
              }
            >
              {list.length === 0 ? (
                <Hint>{filtered ? "Nothing matches." : "None yet: write one for anything the book doesn't cover."}</Hint>
              ) : (
                <div className="grid grid-cols-1 items-start gap-x-10 @5xl:grid-cols-2">
                  {list.map((r) => {
                    const open = openKey === r.key;
                    return (
                      <div key={r.key} className={open ? "col-span-full" : ""}>
                        <FeatureLine row={r} open={open} onToggle={() => setOpenKey(open ? null : r.key)} onActive={(v) => setActive(r, v)} />
                        {open && <FeatureEditor row={r} pools={resourceRows(ch, d)} onTurnIntoPool={() => patchChar(turnIntoPool(ch, d, r), { now: true })} onPatch={(p) => patch(r, p)} onRemove={own ? () => removeOwn(r) : null} onDone={() => setOpenKey(null)} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </DefineSection>
          );
        })}
      </div>
    </ParchmentSheet>
  );
}
