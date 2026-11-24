import React, { useMemo, useState } from "react";
import { INK, InkText, ParchmentSheet, Title } from "../../../../styles/parchment";
import { DefineSection, Hint, addBtn } from "../../../../styles/parchmentForm";
import { useSheet } from "../sheetHelpers";
import { turnIntoPool } from "../resourceHelpers";
import { CATEGORIES, addOwnFeature, featureRows, newOwnFeature, patchFeature, removeOwnFeature, resourceRows, setFeatureFlag, isOptionFeature } from "../featureHelpers";
import { FeatureEditor, FeatureLine } from "./FeatureRow";
import { featureCardOf } from "./FeatureList";
import { usePopupStore } from "../../../../store/PopupStore";

/* Define tab: Custom — the player's own features (the manual layer),
   sectioned by when they're used: Actions, Bonus Actions, Reactions,
   Passives. Race, background, class, feat and item features live on their
   own tabs.

   Each is a ledger line with the numbers Play shows (worked out for this
   character); the diamond shows or hides it in Play; click the name to
   open its editor. "+ write your own" in a section starts one used that way. */

// Shown on their own tabs now: race and background traits (Biography),
// class and subclass features (Class), feats (Feats), items' features
// (Inventory). What's left here is the player's own.
const MOVED = ["race", "background", "class", "feat", "item"];

export default function FeaturesDefine() {
  const { ch, d, patchChar } = useSheet();
  const [openKey, setOpenKey] = useState(null);
  const [query, setQuery] = useState("");
  const openPopup = usePopupStore((s) => s.open);

  const rows = useMemo(() => featureRows(ch, d).filter((r) => !MOVED.includes(r.kind) && !isOptionFeature(r.feature)), [ch, d]);
  if (!ch || !d) return null;

  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) => !q || String(r.feature.name || "").toLowerCase().includes(q));
  const filtered = q !== "";

  // Typing saves a moment later; switches and adding save right away.
  const patch = (r, p) => patchChar(patchFeature(ch, r.from, r.feature.id, p));
  const setActive = (r, v) => patchChar(setFeatureFlag(ch, r.from, r.feature.id, "active", v), { now: true });
  const addOwn = (category) => {
    const f = newOwnFeature(category);
    patchChar(addOwnFeature(ch, f), { now: true });
    setOpenKey(`manual#${f.id}`);
  };
  // ✕ on the line: gone at once.
  const removeOwn = (r) => {
    patchChar(removeOwnFeature(ch, r.feature.id), { now: true });
    if (openKey === r.key) setOpenKey(null);
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
          </>
        }
      >
        Custom
      </Title>
      <p className={`-mt-4 mb-6 text-xs italic ${INK.faint}`}>◆ = shown in Play · click a name for its card · "edit" changes it · ✕ deletes it</p>

      <div className="space-y-8">
        {CATEGORIES.map((c) => {
          const list = visible.filter((r) => r.category === c.value);
          return (
            <DefineSection
              key={c.value}
              title={c.title}
              count={filtered ? `${list.length} shown` : list.length}
              storageKey={`define.custom.${c.value}`}
              actions={(setOpen) => (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(true);
                    addOwn(c.value);
                  }}
                  className={addBtn}
                >
                  + write your own
                </button>
              )}
            >
              {list.length === 0 ? (
                <Hint>{filtered ? "Nothing matches." : "None yet: write one for anything the book doesn't cover."}</Hint>
              ) : (
                <div className="grid grid-cols-1 items-start gap-x-10 @5xl:grid-cols-2">
                  {list.map((r) => {
                    const open = openKey === r.key;
                    return (
                      <div key={r.key} className={open ? "col-span-full" : ""}>
                        <FeatureLine
                          row={r}
                          open={open}
                          hideOwner
                          onView={() => openPopup("feature", featureCardOf(r))}
                          onToggle={() => setOpenKey(open ? null : r.key)}
                          onActive={(v) => setActive(r, v)}
                          onRemove={r.kind === "manual" ? () => removeOwn(r) : undefined}
                        />
                        {open && (
                          <FeatureEditor
                            row={r}
                            pools={resourceRows(ch, d)}
                            pb={d?.pb}
                            onTurnIntoPool={() => patchChar(turnIntoPool(ch, d, r), { now: true })}
                            onPatch={(p) => patch(r, p)}
                            onRemove={r.kind === "manual" ? () => removeOwn(r) : null}
                            onDone={() => setOpenKey(null)}
                          />
                        )}
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
