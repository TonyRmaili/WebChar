import RacePopup            from "../../pages/Catalogues/Races/RacePopup";
import FeatPopup            from "../../pages/Catalogues/Feats/FeatPopup";
import MonsterPopup         from "../../pages/Catalogues/Monsters/MonsterPopup";
import SpellPopup           from "../../pages/Catalogues/Spells/SpellPopup";
import ItemPopup            from "../../pages/Catalogues/Items/ItemPopup";
import BackgroundPopup      from "../../pages/Catalogues/Backgrounds/BackgroundPopup";
import OptionalFeaturePopup from "../../pages/Catalogues/OptionalFeatures/OptionalFeaturePopup";
import StatblockWindow, { statblockWindowId } from "../../pages/Campaigns/statblock/StatblockWindow";


export const POPUP_REGISTRY = {
  feat: {
    component: FeatPopup,
    propName: "feat",
    defaultWidth: 520,
    defaultHeight: 620,
  },
  monster: {
    component: MonsterPopup,
    propName: "monster",
    defaultWidth: 560,
    defaultHeight: 700,
  },
  race: {
    component: RacePopup,
    propName: "race",
    defaultWidth: 520,
    defaultHeight: 620,
  },
  spell: {
    component: SpellPopup,
    propName: "spell",
    defaultWidth: 520,
    defaultHeight: 620,
  },
  item: {
    component: ItemPopup,
    propName: "item",
    defaultWidth: 520,
    defaultHeight: 620,
  },
  background: {
    component: BackgroundPopup,
    propName: "background",
    defaultWidth: 520,
    defaultHeight: 620,
  },
  optionalFeature: {
    component: OptionalFeaturePopup,
    propName: "feature",
    defaultWidth: 520,
    defaultHeight: 620,
    // Disambiguate features with same name+source across feature types.
    buildId: (d) => `optionalFeature__${d.name}__${d.source}__${d.feature_type}`,
  },
  // A campaign copy's statblock (Campaign › NPCs). The data is only a
  // reference { name, campaignName, kind, file }; openStatblock() in
  // StatblockWindow places it at its standard size when first opened.
  statblock: {
    component: StatblockWindow,
    propName: "statblock",
    defaultWidth: 1180,
    defaultHeight: 760,
    buildId: statblockWindowId,
  },
};