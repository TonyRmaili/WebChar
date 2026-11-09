import RacePopup            from "../../pages/Catalogues/Races/RacePopup";
import FeatPopup            from "../../pages/Catalogues/Feats/FeatPopup";
import MonsterPopup         from "../../pages/Catalogues/Monsters/MonsterPopup";
import SpellPopup           from "../../pages/Catalogues/Spells/SpellPopup";
import ItemPopup            from "../../pages/Catalogues/Items/ItemPopup";
import BackgroundPopup      from "../../pages/Catalogues/Backgrounds/BackgroundPopup";
import OptionalFeaturePopup from "../../pages/Catalogues/OptionalFeatures/OptionalFeaturePopup";
import StatblockWindow, { statblockWindowId } from "../../pages/Campaigns/statblock/StatblockWindow";
import TrackerWindow, { trackerWindowId } from "../../pages/Campaigns/tracker/TrackerWindow";
import TableWindow, { tableWindowId } from "../../pages/Campaigns/tables/TableWindow";
import DiceTowerWindow, { diceWindowId } from "../dice/DiceTowerWindow";
import useStatblockDrafts from "../../pages/Campaigns/statblock/statblockDrafts";

// Closing a card from the deck also drops its unsaved edits, if any.
const forgetDraft = (id) => useStatblockDrafts.getState().clearDraft(id);


// The campaign windows and the dice tower import the popup store, which
// imports this file, so they may still be loading when this file runs:
// their component and id are looked up when a window opens (`get
// component()`, `buildId: (d) => …`), not here.
//
// Every type says which deck its minimized cards go to (components/popups/decks.js):
// a deck id, or a function of the card's data — or null for a tool with a
// footer button of its own (the dice tower), which stays out of the deck.
// `forget(id)` (optional) runs when a minimized card is closed from the deck.
export const POPUP_REGISTRY = {
  feat: {
    deck: "feats",
    component: FeatPopup,
    propName: "feat",
    defaultWidth: 520,
    defaultHeight: 620,
  },
  monster: {
    deck: "monsters",
    component: MonsterPopup,
    propName: "monster",
    defaultWidth: 560,
    defaultHeight: 700,
  },
  race: {
    deck: "races",
    component: RacePopup,
    propName: "race",
    defaultWidth: 520,
    defaultHeight: 620,
  },
  spell: {
    deck: "spells",
    component: SpellPopup,
    propName: "spell",
    defaultWidth: 520,
    defaultHeight: 620,
  },
  item: {
    deck: "items",
    component: ItemPopup,
    propName: "item",
    defaultWidth: 520,
    defaultHeight: 620,
  },
  background: {
    deck: "backgrounds",
    component: BackgroundPopup,
    propName: "background",
    defaultWidth: 520,
    defaultHeight: 620,
  },
  optionalFeature: {
    deck: "optionalFeatures",
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
    // Templates open in the same window but have a deck of their own.
    deck: (data) => (data.kind === "template" ? "templates" : "statblocks"),
    get component() {
      return StatblockWindow;
    },
    propName: "statblock",
    defaultWidth: 1180,
    defaultHeight: 760,
    buildId: (d) => statblockWindowId(d),
    forget: forgetDraft,
  },
  // The initiative tracker for one encounter ({ name, campaignName,
  // encounterId }); openTracker() in TrackerWindow places it at the
  // standard size. One window per fight, so several can run at once.
  tracker: {
    deck: "trackers",
    get component() {
      return TrackerWindow;
    },
    propName: "tracker",
    defaultWidth: 1180,
    defaultHeight: 760,
    buildId: (d) => trackerWindowId(d),
  },
  // A table to roll on ({ name, campaignName, tableId }); openTable() in
  // TableWindow places it. One window per table.
  table: {
    deck: "tables",
    get component() {
      return TableWindow;
    },
    propName: "table",
    defaultWidth: 760,
    defaultHeight: 760,
    buildId: (d) => tableWindowId(d),
    forget: forgetDraft,
  },
  // The dice tower (one window); openDiceTower() in DiceTowerWindow places it.
  // No deck: minimized, it waits behind the footer's DiceTower button.
  dice: {
    deck: null,
    get component() {
      return DiceTowerWindow;
    },
    propName: "dice",
    defaultWidth: 1040,
    defaultHeight: 760,
    buildId: (d) => diceWindowId(d),
  },
};