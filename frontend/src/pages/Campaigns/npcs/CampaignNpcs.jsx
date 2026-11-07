import React, { useEffect, useState } from "react";
import useCampaignStore, { copiesKey } from "../../../store/CampaignStore";
import { INK, InkButton, InkHeading, ParchmentSheet, Title } from "../../../styles/parchment";
import { addBtn } from "../../../styles/parchmentForm";
import ParchmentMenu from "../../../styles/ParchmentMenu";
import CharacterToken from "../../Characters/create/CharacterToken";
import CatalogueMonsterPicker from "../../Catalogues/Monsters/CatalogueMonsterPicker";
import { monsterSummary } from "../../Catalogues/Monsters/catalogueMonsters";
import { closeStatblock, openStatblock } from "../statblock/StatblockWindow";
import { prepareMonster } from "../statblock/monsterStatblock";

/* Campaign › NPCs — the creatures the DM keeps for this campaign.

   Characters arrive here from Characters › Create (right-click a token →
   "Add as an NPC to …"). Monsters are added from the catalogue right
   here. Either way the campaign keeps its own copy. Click a token to open
   its statblock card (a window you can move, resize and minimize to the
   footer); right-click for more. */

const EMPTY = [];

const classSummary = (c) =>
  (Array.isArray(c?.classes) ? c.classes : [])
    .filter((k) => k?.class_name)
    .map((k) => `${k.class_name} ${k.level ?? ""}`.trim())
    .join(" / ");

// What each list is, and the words that go with it.
const GROUPS = {
  npc: {
    summary: classSummary,
    copyNote: "e.g. a second guard",
    removeLabel: "Remove from NPCs…",
    removeAsk: (name) => `Remove ${name} from this campaign's NPCs? The player's own character is not touched.`,
  },
  monster: {
    summary: monsterSummary,
    copyNote: "e.g. another goblin",
    removeLabel: "Remove from the campaign…",
    removeAsk: (name) => `Remove ${name} from this campaign? The catalogue monster is not touched.`,
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
  const characters = useCampaignStore((s) => s.campaignCharacters[copiesKey(campaignName, "npc")]) || EMPTY;
  const monsters = useCampaignStore((s) => s.campaignCharacters[copiesKey(campaignName, "monster")]) || EMPTY;
  const loading = useCampaignStore((s) => s.loadingCampaignCharacters);
  const fetchCampaignCharacters = useCampaignStore((s) => s.fetchCampaignCharacters);
  const copyCampaignCharacter = useCampaignStore((s) => s.copyCampaignCharacter);
  const removeCampaignCharacter = useCampaignStore((s) => s.removeCampaignCharacter);
  const addCampaignMonsters = useCampaignStore((s) => s.addCampaignMonsters);

  const [menu, setMenu] = useState(null); // { x, y, entry, kind }
  const [notice, setNotice] = useState(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    fetchCampaignCharacters(campaignName, "npc").then((res) => !res.ok && setNotice(`Couldn't fetch the NPCs — ${res.message}.`));
    fetchCampaignCharacters(campaignName, "monster").then((res) => !res.ok && setNotice(`Couldn't fetch the monsters — ${res.message}.`));
  }, [campaignName, fetchCampaignCharacters]);

  const nameOf = (entry) => entry.data?.name || entry.file;
  const open = (kind) => (entry) => openStatblock({ name: nameOf(entry), campaignName, kind, file: entry.file });

  const copy = async (kind, entry) => {
    const res = await copyCampaignCharacter(campaignName, kind, entry.file);
    setNotice(res.ok ? `${res.entry.data?.name || res.entry.file} was added.` : `Couldn't copy ${nameOf(entry)} — ${res.message}.`);
  };

  const remove = async (kind, entry) => {
    if (!window.confirm(GROUPS[kind].removeAsk(nameOf(entry)))) return;
    const res = await removeCampaignCharacter(campaignName, kind, entry.file);
    if (res.ok) closeStatblock({ campaignName, kind, file: entry.file });
    setNotice(res.ok ? `${nameOf(entry)} was removed.` : `Couldn't remove it — ${res.message}.`);
  };

  // From the monster picker: true keeps the picker open for the next one.
  const addMonsters = async (monster, count) => {
    const res = await addCampaignMonsters(campaignName, prepareMonster(monster), count);
    if (!res.ok) {
      setNotice(`Couldn't add ${monster.name} — ${res.message}.`);
      return false;
    }
    setNotice(`${res.added.map((a) => a.data?.name || a.file).join(", ")} ${res.added.length === 1 ? "was" : "were"} added.`);
    return true;
  };

  const total = characters.length + monsters.length;

  return (
    <ParchmentSheet>
      <Title after={<span className={`text-sm italic ${INK.faded}`}>{total === 1 ? "1 creature" : `${total} creatures`}</span>}>NPCs</Title>

      <section className="mb-10">
        <InkHeading right={<span className={`text-[11px] italic ${INK.faint}`}>click to open · right-click for more</span>}>Characters</InkHeading>
        {characters.length === 0 ? (
          <p className={`py-4 italic ${INK.faint}`}>
            {loading ? "Fetching…" : "None yet. On Characters › Create, right-click a character and choose “Add as an NPC to …” to bring a copy here."}
          </p>
        ) : (
          <Tokens entries={characters} kind="npc" nameOf={nameOf} onOpen={open("npc")} onMenu={setMenu} />
        )}
      </section>

      <section>
        <InkHeading
          right={
            <button type="button" onClick={() => setPicking((p) => !p)} className={addBtn}>
              {picking ? "close the bestiary" : "+ add from the bestiary"}
            </button>
          }
        >
          Monsters
        </InkHeading>
        {picking && (
          <div className="mb-5 mt-2">
            <CatalogueMonsterPicker title="Add monsters" addLabel="add" maxCount={20} onAdd={addMonsters} onClose={() => setPicking(false)} />
          </div>
        )}
        {monsters.length === 0 ? (
          !picking && <p className={`py-4 italic ${INK.faint}`}>{loading ? "Fetching…" : "None yet. Add some from the bestiary — each one gets its own statblock you can change."}</p>
        ) : (
          <Tokens entries={monsters} kind="monster" nameOf={nameOf} onOpen={open("monster")} onMenu={setMenu} />
        )}
      </section>

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