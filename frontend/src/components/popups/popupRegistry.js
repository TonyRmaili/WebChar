import RacePopup            from "../../pages/Catalogues/Races/RacePopup";
import FeatPopup            from "../../pages/Catalogues/Feats/FeatPopup";
import MonsterPopup         from "../../pages/Catalogues/Monsters/MonsterPopup";
import SpellPopup           from "../../pages/Catalogues/Spells/SpellPopup";
import ItemPopup            from "../../pages/Catalogues/Items/ItemPopup";
import BackgroundPopup      from "../../pages/Catalogues/Backgrounds/BackgroundPopup";
import OptionalFeaturePopup from "../../pages/Catalogues/OptionalFeatures/OptionalFeaturePopup";
import ReferencePopup       from "../../pages/Catalogues/Reference/ReferencePopup";
import { catalogueOf }      from "../../pages/Catalogues/Reference/referenceHelpers";
import FeatureCardPopup     from "../../pages/Characters/sheet/FeatureCardPopup";
import StatblockWindow, { statblockWindowId } from "../../pages/Campaigns/statblock/StatblockWindow";
import TrackerWindow, { trackerWindowId } from "../../pages/Campaigns/tracker/TrackerWindow";
import TableWindow, { tableWindowId } from "../../pages/Campaigns/tables/TableWindow";
import DiceTowerWindow, { diceWindowId } from "../dice/DiceTowerWindow";
import AssistantWindow, { assistantWindowId } from "../assistant/AssistantWindow";
import NoteCard from "../../pages/Campaigns/notes/NoteCard";
import PictureCard from "../../pages/Campaigns/notes/PictureCard";
import PromptCard from "../../pages/Campaigns/notes/PromptCard";
import HandoutCard from "../../pages/Campaigns/notes/HandoutCard";
import { fileCardId, handoutId } from "../../pages/Campaigns/notes/fileCards";
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
// footer button of its own (the dice tower, the assistant), which stays out of the deck.
// `forget(id)` (optional) runs when a minimized card is closed from the deck.
export const POPUP_REGISTRY = {
  feat: {
    deck: "feats",
    component: FeatPopup,
    propName: "feat",
    defaultWidth: 520,
    defaultHeight: 620,
  },
  // Rules, Lore and Toolkit entries: one card type, each catalogue its own deck.
  reference: {
    deck: (d) => catalogueOf(d),
    component: ReferencePopup,
    propName: "entry",
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
    // A character's own copy (`_sheet`, keyed by its layer) is its own card.
    buildId: (d) => (d._sheet ? `spell__sheet__${d._key}` : `spell__${d.name}__${d.source}`),
  },
  item: {
    deck: "items",
    component: ItemPopup,
    propName: "item",
    defaultWidth: 520,
    defaultHeight: 620,
    // A character's own copy (`_sheet`) is its own card, next to the
    // catalogue's card of the same item.
    buildId: (d) => (d._sheet ? `item__sheet__${d.id}` : `item__${d.name}__${d.source}`),
  },
  // A feature of a character (a racial trait, a class feature): its own
  // copy, from the sheet. data: { key, name, owner, text, … } (_sheet).
  feature: {
    deck: "features",
    component: FeatureCardPopup,
    propName: "feature",
    defaultWidth: 460,
    defaultHeight: 520,
    buildId: (d) => `feature__${d.key}`,
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
    buildId: (d) => `optionalFeature__${d.id}`,
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
  // A campaign's files ({ name, path, campaignName }); openCampaignFile()
  // in notes/fileCards.js opens them. A note is a document, a picture is
  // just the picture, a prompt is plain text for the assistant.
  note: {
    deck: "notes",
    get component() {
      return NoteCard;
    },
    propName: "note",
    defaultWidth: 820,
    defaultHeight: 720,
    buildId: (d) => fileCardId("note", d),
  },
  picture: {
    deck: "pictures",
    get component() {
      return PictureCard;
    },
    propName: "picture",
    defaultWidth: 720,
    defaultHeight: 560,
    buildId: (d) => fileCardId("picture", d),
  },
  prompt: {
    deck: "notes",
    get component() {
      return PromptCard;
    },
    propName: "prompt",
    defaultWidth: 620,
    defaultHeight: 560,
    buildId: (d) => fileCardId("prompt", d),
  },
  // A note's handout on its own ({ name, campaignName, notePath, content });
  // fileCards.showHandout() opens it.
  handout: {
    deck: "notes",
    get component() {
      return HandoutCard;
    },
    propName: "handout",
    defaultWidth: 680,
    defaultHeight: 760,
    buildId: handoutId,
  },
  // The dice tower (one window); openDiceTower() in DiceTowerWindow places it.
  // A footer window: no deck. ×, a right-click or its footer button puts it
  // away behind that button (it keeps its place); there's no − to minimize.
  dice: {
    deck: null,
    footer: true,
    get component() {
      return DiceTowerWindow;
    },
    propName: "dice",
    defaultWidth: 1040,
    defaultHeight: 760,
    buildId: (d) => diceWindowId(d),
  },
  // The assistant (one window), a footer window like the dice tower;
  // openAssistant() in AssistantWindow places it.
  assistant: {
    deck: null,
    footer: true,
    get component() {
      return AssistantWindow;
    },
    propName: "assistant",
    defaultWidth: 760,
    defaultHeight: 760,
    buildId: () => assistantWindowId(),
  },
};