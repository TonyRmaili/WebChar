import React from "react";

import Effects from "./define/EffectsDefine";
import Feats from "./define/FeatsDefine";
import MinionsDefine from "./minions/MinionsDefine";
import Spellbook from "./define/SpellbookDefine";
import Inventory from "./define/InventoryDefine";
import GeneralStats from "./define/GeneralDefine";
import AbilityScore from "./define/AbilitiesDefine";
import Biography from "./define/BiographyDefine";
import Lore from "./define/LoreDefine";

/* The define tabs, in display order. Adding a tab means one entry here:
   the tab strip, the rail icons and the panel body all read this list. */

const Icon = ({ children }) => (
  <svg
    className="h-[18px] w-[18px]"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const DEFINE_TABS = [
  {
    id: "effects",
    label: "Effects",
    Component: Effects,
    bare: true, // parchment style draws its own surface
    icon: (
      <Icon>
        <path d="M12 3l1.6 4.2a2 2 0 0 0 1.2 1.2L19 10l-4.2 1.6a2 2 0 0 0-1.2 1.2L12 17l-1.6-4.2a2 2 0 0 0-1.2-1.2L5 10l4.2-1.6a2 2 0 0 0 1.2-1.2z" />
      </Icon>
    ),
  },
  
  {
    id: "feats",
    label: "Feats",
    Component: Feats,
    bare: true, // parchment style draws its own surface
    icon: (
      <Icon>
        <circle cx="12" cy="9" r="5" />
        <path d="M9 13.5 7.5 21l4.5-2.5 4.5 2.5L15 13.5" />
      </Icon>
    ),
  },
  {
    id: "minions",
    label: "Minions",
    Component: MinionsDefine,
    bare: true, // parchment style draws its own surface
    icon: (
      <Icon>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <circle cx="17" cy="9" r="2.3" />
        <path d="M16 14.2a4.6 4.6 0 0 1 5 4.8" />
      </Icon>
    ),
  },
  {
    id: "spellbook",
    label: "Spellbook",
    Component: Spellbook,
    bare: true, // parchment style draws its own surface
    icon: (
      <Icon>
        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
        <path d="M4 19V5M19 19v2H6" />
        <path d="M12 7l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
      </Icon>
    ),
  },
  {
    id: "inventory",
    label: "Inventory",
    Component: Inventory,
    bare: true, // parchment style draws its own surface
    icon: (
      <Icon>
        <path d="M6 8h12l-1 12H7z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </Icon>
    ),
  },
  {
    id: "general",
    label: "General",
    Component: GeneralStats,
    bare: true, // parchment style draws its own surface
    icon: (
      <Icon>
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="18" cy="18" r="2" />
      </Icon>
    ),
  },
  {
    id: "abilities",
    label: "Abilities",
    Component: AbilityScore,
    bare: true, // parchment style draws its own surface
    icon: (
      <Icon>
        <path d="M12 2.5 4 7v10l8 4.5 8-4.5V7z" />
        <path d="M4 7l8 4.5L20 7M12 11.5V21.5" />
      </Icon>
    ),
  },
  {
    id: "bio",
    label: "Biography",
    Component: Biography,
    bare: true, // parchment style draws its own surface
    icon: (
      <Icon>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </Icon>
    ),
  },
  {
    id: "lore",
    label: "Lore",
    Component: Lore,
    bare: true, // parchment style draws its own surface
    icon: (
      <Icon>
        <path d="M7 4h11v13a3 3 0 0 1-3 3H6" />
        <path d="M7 4a2 2 0 0 0-2 2v2h2M6 20a2 2 0 0 0 2-2V4" />
        <path d="M11 9h4M11 13h4" />
      </Icon>
    ),
  },
];

export const DEFAULT_DEFINE_TAB = DEFINE_TABS[0].id;

export const findDefineTab = (id) =>
  DEFINE_TABS.find((t) => t.id === id) ?? DEFINE_TABS[0];