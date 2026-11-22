import React, { useMemo } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import { CardHeader, MechanicsSection, RichText } from "../catalogueParts";
import { buildNameIndex } from "../catalogueHelpers";
import { itemStats, itemSubtitle } from "./itemHelpers";

/* An item's card: its type, rarity and attunement; its statistics
   (weapon, armor, charges, bonuses, …); the book text; "What it gives".
   A group's card lists its members, each opening its own card. */
export default function ItemPopup({ item }) {
  const items = useCatalogueStore((s) => s.items);
  const spells = useCatalogueStore((s) => s.spells);
  const openPopup = usePopupStore((s) => s.open);
  const index = useMemo(() => buildNameIndex(items, spells), [items, spells]);
  const byId = useMemo(() => Object.fromEntries((items || []).map((it) => [it.id, it])), [items]);

  if (!item) return null;
  const stats = itemStats(item, index);
  const group = item.group ? byId[item.group] : null;

  return (
    <div className="wc-page h-full overflow-y-auto !rounded-none">
      <div className="px-5 py-4">
        <CardHeader entry={item} subtitle={itemSubtitle(item)} />
        {item._sheet && (
          <p className="-mt-2 mb-2 text-xs italic text-ink-faded">
            {item.item ? (item.edited ? "Your copy, changed by you" : "Your copy") : "Your own item"}
          </p>
        )}

        {group && (
          <p className="mb-2 text-xs italic text-ink-faded">
            One of the{" "}
            <button type="button" onClick={() => openPopup("item", group)} className="underline decoration-dotted underline-offset-2 hover:text-rubric">
              {group.name}
            </button>{" "}
            group.
          </p>
        )}

        {stats.length > 0 && (
          <div className="mb-3 space-y-0.5 border-b border-rule/40 pb-2">
            {stats.map((r, i) => (
              <div key={`${r.label}-${i}`} className="text-sm leading-snug">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faded">{r.label}: </span>
                <span className="text-ink">{r.value}</span>
              </div>
            ))}
          </div>
        )}

        {item.text ? <RichText text={item.text} /> : <p className="text-sm italic text-ink-faded">No description.</p>}

        {item.kind === "item_group" && (
          <div className="mt-4">
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-faded">
              Choose one · {item.members?.length || 0}
            </h3>
            <ul className="space-y-0.5 text-sm">
              {(item.members || []).map((id) => {
                const member = byId[id];
                return (
                  <li key={id}>
                    {member ? (
                      <button type="button" onClick={() => openPopup("item", member)}
                              className="text-left underline decoration-dotted underline-offset-2 hover:text-rubric">
                        {member.name}
                      </button>
                    ) : (
                      <span className="text-ink-faded">{index[id] || id}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <MechanicsSection entry={item} index={index} storageKey="catalogue.item.mechanics" />
      </div>
    </div>
  );
}
