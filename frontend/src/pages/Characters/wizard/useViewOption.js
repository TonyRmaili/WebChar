import { useCallback } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";

/* Right-click on a pick: open the option's card (spell, feat, optional
   feature, item) in a popup, without picking it and without leaving the
   page. The catalogue it needs is loaded the first time it's asked for.

   const view = useViewOption();
   view("spells", "fireball-xphb")   → opens the Fireball card */

const CARDS = {
  spells: { list: "spells", load: "loadSpells", popup: "spell" },
  feats: { list: "feats", load: "loadFeats", popup: "feat" },
  optional_features: { list: "optionalFeatures", load: "loadOptionalFeatures", popup: "optionalFeature" },
  items: { list: "items", load: "loadItems", popup: "item" },
};

export const hasCard = (grant) => !!CARDS[grant];

export default function useViewOption() {
  const openPopup = usePopupStore((s) => s.open);
  return useCallback(
    async (grant, value) => {
      const card = CARDS[grant];
      if (!card || !value) return false;
      const store = useCatalogueStore.getState();
      if (!store[card.list]?.length) await store[card.load]();
      const rec = (useCatalogueStore.getState()[card.list] || []).find((e) => e.id === value);
      if (rec) openPopup(card.popup, rec);
      return !!rec;
    },
    [openPopup]
  );
}
