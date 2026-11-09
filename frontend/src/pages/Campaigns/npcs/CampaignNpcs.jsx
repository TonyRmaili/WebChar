import React, { useEffect, useState } from "react";
import useCampaignStore, { copiesKey } from "../../../store/CampaignStore";
import useEncounterStore from "../../../store/EncounterStore";
import useGroupStore from "../../../store/GroupStore";
import useTemplateStore from "../../../store/TemplateStore";
import { INK, InkButton, ParchmentSheet } from "../../../styles/parchment";
import ParchmentMenu from "../../../styles/ParchmentMenu";
import CharacterToken from "../../Characters/create/CharacterToken";
import { monsterSummary } from "../../Catalogues/Monsters/catalogueMonsters";
import { closeStatblock, openStatblock } from "../statblock/StatblockWindow";
import { prepareMonster } from "../statblock/monsterStatblock";
import Encounters from "../encounters/Encounters";
import CombatSection from "../encounters/CombatSection";
import MonsterShelf from "../encounters/MonsterShelf";
import Groups from "../groups/Groups";
import Templates from "../templates/Templates";
import { applyTemplates, givenTemplates, memberIn, resolveTemplates } from "../templates/templateLogic";

/* Campaign › Combat — every creature the DM keeps for this campaign:
   the party, NPCs and monsters.

   Party members and NPCs arrive from Characters › Create (right-click a
   token → "Add to the party of …" / "Add as an NPC to …"). The monster
   shelf keeps catalogue monsters ready (tweaked if you like) to drop into
   encounters; the fights themselves get their own copies. Everything opens
   the same statblock card (a window you can move, resize and minimize to
   the footer). Right-click a token for more.

   Below them: templates (statblocks without a creature, ../templates/),
   groups (packs of creatures, ../groups/) and the encounters
   (../encounters/). Every section folds shut. */

const EMPTY = [];

const classSummary = (c) =>
  (Array.isArray(c?.classes) ? c.classes : [])
    .filter((k) => k?.class_name)
    .map((k) => `${k.class_name} ${k.level ?? ""}`.trim())
    .join(" / ");

// What each list is, and the words that go with it.
const GROUPS = {
  party: {
    summary: classSummary,
    copyNote: "e.g. another party member",
    removeLabel: "Remove from the party…",
    removeAsk: (name) => `Remove ${name} from this campaign's party? The player's own character is not touched.`,
  },
  npc: {
    summary: classSummary,
    copyNote: "e.g. a second guard",
    removeLabel: "Remove from NPCs…",
    removeAsk: (name) => `Remove ${name} from this campaign's NPCs? The player's own character is not touched.`,
  },
  monster: {
    summary: monsterSummary,
    copyNote: "e.g. a goblin archer variant",
    removeLabel: "Take off the shelf",
  },
};

function Tokens({ entries, kind, nameOf, onOpen, onMenu }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-4 pt-2">
      {entries.map((entry) => (
        <div key={entry.file} className="flex flex-col items-center">
          <CharacterToken
            character={{ ...entry.data, name: nameOf(entry) }}
            onClick={() => onOpen(entry)}
            onContextMenu={(e) => {
              e.preventDefault();
              onMenu({ x: e.clientX, y: e.clientY, entry, kind });
            }}
            onMenuButton={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              onMenu({ x: r.left, y: r.bottom + 4, entry, kind });
            }}
          />
          <span className={`-mt-3 max-w-[6rem] truncate text-[11px] italic ${INK.faded}`}>{GROUPS[kind].summary(entry.data)}</span>
        </div>
      ))}
    </div>
  );
}

export default function CampaignNpcs({ campaignName }) {
  const party = useCampaignStore((s) => s.campaignCharacters[copiesKey(campaignName, "party")]) || EMPTY;
  const npcs = useCampaignStore((s) => s.campaignCharacters[copiesKey(campaignName, "npc")]) || EMPTY;
  const monsters = useCampaignStore((s) => s.campaignCharacters[copiesKey(campaignName, "monster")]) || EMPTY;
  const loading = useCampaignStore((s) => s.loadingCampaignCharacters);
  const fetchCampaignCharacters = useCampaignStore((s) => s.fetchCampaignCharacters);
  const copyCampaignCharacter = useCampaignStore((s) => s.copyCampaignCharacter);
  const removeCampaignCharacter = useCampaignStore((s) => s.removeCampaignCharacter);
  const addCampaignMonsters = useCampaignStore((s) => s.addCampaignMonsters);
  const encounters = useEncounterStore((s) => s.encounters[campaignName]) || EMPTY;
  const dropMember = useEncounterStore((s) => s.dropMember);
  const templates = useTemplateStore((s) => s.records[campaignName]);
  const groups = useGroupStore((s) => s.records[campaignName]);

  const [menu, setMenu] = useState(null); // { x, y, entry, kind }
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    fetchCampaignCharacters(campaignName, "party").then((res) => !res.ok && setNotice(`Couldn't fetch the party — ${res.message}.`));
    fetchCampaignCharacters(campaignName, "npc").then((res) => !res.ok && setNotice(`Couldn't fetch the NPCs — ${res.message}.`));
    fetchCampaignCharacters(campaignName, "monster").then((res) => !res.ok && setNotice(`Couldn't fetch the monsters — ${res.message}.`));
  }, [campaignName, fetchCampaignCharacters]);

  const nameOf = (entry) => entry.data?.name || entry.file;
  // The token's name with templates on ("Ghostly Thorin"), from its own and
  // — while it's in an encounter through a group — that group's.
  const shownName = (kind) => (entry) => {
    const given = givenTemplates(entry.data, memberIn(encounters, kind, entry.file), groups);
    const list = resolveTemplates(entry.data, templates, given);
    return (list.length ? applyTemplates(kind, entry.data, list)?.name : null) || nameOf(entry);
  };
  const open = (kind) => (entry) => openStatblock({ name: shownName(kind)(entry), campaignName, kind, file: entry.file });

  const copy = async (kind, entry) => {
    const res = await copyCampaignCharacter(campaignName, kind, entry.file);
    setNotice(res.ok ? `${res.entry.data?.name || res.entry.file} was added.` : `Couldn't copy ${nameOf(entry)} — ${res.message}.`);
  };

  // Shelf monsters go without asking (encounters have their own copies).
  // Party members and NPCs are shared with the encounters they're in, so
  // ask first: those encounters lose them too (the server takes them out).
  const remove = async (kind, entry) => {
    if (kind !== "monster") {
      const usedIn = encounters.filter((e) => (e.members || []).some((m) => m.kind === kind && m.file === entry.file)).length;
      const also = usedIn ? `\n\n${nameOf(entry)} is in ${usedIn === 1 ? "1 encounter" : `${usedIn} encounters`} — they'll lose them too.` : "";
      if (!window.confirm(GROUPS[kind].removeAsk(nameOf(entry)) + also)) return;
    }
    const res = await removeCampaignCharacter(campaignName, kind, entry.file);
    if (res.ok) {
      closeStatblock({ campaignName, kind, file: entry.file });
      if (kind !== "monster") dropMember(campaignName, kind, entry.file);
    }
    setNotice(res.ok ? `${nameOf(entry)} was removed.` : `Couldn't remove it — ${res.message}.`);
  };

  // From the shelf's bestiary search: one at a time.
  const addMonsters = async (monster) => {
    const res = await addCampaignMonsters(campaignName, prepareMonster(monster), 1);
    if (!res.ok) {
      setNotice(`Couldn't add ${monster.name} — ${res.message}.`);
      return false;
    }
    setNotice(`${res.added[0]?.data?.name || monster.name} is on the shelf.`);
    return true;
  };

  return (
    <ParchmentSheet>
      <CombatSection id="party" title="Party" summary={party.length ? `${party.length}` : undefined} right={<span className={`text-[11px] italic ${INK.faint}`}>click to open · right-click for more</span>}>
        {party.length === 0 ? (
          <p className={`py-4 italic ${INK.faint}`}>
            {loading ? "Fetching…" : "None yet. On Characters › Create, right-click a character and choose “Add to the party of …” to bring a copy here."}
          </p>
        ) : (
          <Tokens entries={party} kind="party" nameOf={shownName("party")} onOpen={open("party")} onMenu={setMenu} />
        )}
      </CombatSection>

      <CombatSection id="npcs" title="NPCs" summary={npcs.length ? `${npcs.length}` : undefined}>
        {npcs.length === 0 ? (
          <p className={`py-4 italic ${INK.faint}`}>
            {loading ? "Fetching…" : "None yet. On Characters › Create, right-click a character and choose “Add as an NPC to …” to bring a copy here."}
          </p>
        ) : (
          <Tokens entries={npcs} kind="npc" nameOf={shownName("npc")} onOpen={open("npc")} onMenu={setMenu} />
        )}
      </CombatSection>

      <MonsterShelf
        shelf={monsters}
        loading={loading}
        onAdd={addMonsters}
        onOpen={open("monster")}
        onRemove={(entry) => remove("monster", entry)}
        onMenu={setMenu}
      />

      <Templates campaignName={campaignName} />

      <Groups campaignName={campaignName} shelf={monsters} npcs={npcs} />

      <Encounters campaignName={campaignName} party={party} npcs={npcs} shelf={monsters} />

      {notice && (
        <p className={`mt-6 flex flex-wrap items-baseline gap-x-3 text-sm italic ${INK.faded}`} role="status">
          {notice}
          <InkButton onClick={() => setNotice(null)}>dismiss</InkButton>
        </p>
      )}

      {menu && (
        <ParchmentMenu
          x={menu.x}
          y={menu.y}
          title={nameOf(menu.entry)}
          subtitle={GROUPS[menu.kind].summary(menu.entry.data) || undefined}
          groups={[
            {
              items: [
                { label: "Open statblock", onSelect: () => open(menu.kind)(menu.entry) },
                { label: "Make a copy", onSelect: () => copy(menu.kind, menu.entry), note: GROUPS[menu.kind].copyNote },
              ],
            },
            { items: [{ label: GROUPS[menu.kind].removeLabel, onSelect: () => remove(menu.kind, menu.entry), danger: true }] },
          ]}
          onClose={() => setMenu(null)}
        />
      )}
    </ParchmentSheet>
  );
}