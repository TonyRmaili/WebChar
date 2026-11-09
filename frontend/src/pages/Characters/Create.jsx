import React, { useEffect, useState } from "react";
import useAuthStore from "../../store/AuthStore";
import useCharStore from "../../store/CharStore";
import useCampaignStore from "../../store/CampaignStore";
import { INK, InkButton, InkHeading, ParchmentSheet, Title } from "../../styles/parchment";
import ParchmentMenu from "../../styles/ParchmentMenu";
import BuildWizard from "./wizard/BuildWizard";
import CharacterToken from "./create/CharacterToken";

/* Characters › Create — your roster and the builder.

   Click a token to use that character in Sheets; right-click for more
   (send a copy to a campaign, delete). New characters are made with the
   Builder Wizard, which sends them to the server itself. */

const EXPORT_KINDS = {
  party: { heading: "Add to the party of…", done: (c, n) => `${n} joined the party in ${c}.`, where: (c) => `the party in ${c}` },
  npc: { heading: "Add as an NPC to…", done: (c, n) => `${n} was added to the NPCs of ${c}.`, where: (c) => `the NPCs of ${c}` },
};

const sortCharacters = (list) =>
  [...(list ?? [])].sort((a, b) => (a.id != null && b.id != null ? a.id - b.id : String(a.name).localeCompare(String(b.name))));

export default function CreateCharacters() {
  const userData = useAuthStore((s) => s.userData);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const deleteChar = useCharStore((s) => s.deleteChar);
  const toggleActiveChar = useCharStore((s) => s.toggleActiveChar);
  const campaignNames = useCampaignStore((s) => s.campaignNames);
  const loadingCampaigns = useCampaignStore((s) => s.loadingCampaignNames);
  const listCampaigns = useCampaignStore((s) => s.listCampaigns);
  const exportCharacter = useCampaignStore((s) => s.exportCharacter);

  const [building, setBuilding] = useState(false);
  const [menu, setMenu] = useState(null); // { x, y, character }
  const [notice, setNotice] = useState(null); // { tone: "ok" | "error", text }

  // Campaign names for the right-click menu.
  useEffect(() => {
    listCampaigns();
  }, [listCampaigns]);

  const characters = sortCharacters(userData?.characters);
  const inSheets = characters.filter((c) => c.active).length;

  /* ── actions ── */

  const toggleSheets = async (character) => {
    await toggleActiveChar(character.id);
    await fetchUser();
  };

  const remove = async (character) => {
    if (!window.confirm(`Delete ${character.name}? This cannot be undone.`)) return;
    try {
      await deleteChar(character.name);
      await fetchUser();
      const current = JSON.parse(localStorage.getItem("charData") || "null");
      if (current?.name === character.name) localStorage.removeItem("charData");
    } catch (e) {
      console.error("Delete failed:", e);
      setNotice({ tone: "error", text: `Couldn't delete ${character.name}. Please try again.` });
    }
  };

  // Copy a character into a campaign. If the copy is already there, ask
  // before replacing it with a fresh one.
  const sendTo = async (character, campaignName, as) => {
    const kind = EXPORT_KINDS[as];
    const args = { campaignName, characterId: character.id, characterName: character.name, as };
    setNotice({ tone: "ok", text: `Sending ${character.name} to ${kind.where(campaignName)}…` });

    let res = await exportCharacter(args);
    if (!res.ok && res.conflict) {
      const replace = window.confirm(
        `${character.name} is already in ${kind.where(campaignName)}.\n\nReplace that copy with a fresh one from this character?`
      );
      if (!replace) return setNotice(null);
      res = await exportCharacter({ ...args, overwrite: true });
    }

    setNotice(
      res.ok
        ? { tone: "ok", text: kind.done(campaignName, character.name) }
        : { tone: "error", text: `Couldn't add ${character.name} to ${kind.where(campaignName)} — ${res.message}.` }
    );
  };

  const openMenu = (character, x, y) => {
    if (!campaignNames.length) listCampaigns();
    setMenu({ character, x, y });
  };

  const menuGroups = (character) => {
    const campaignItems = (as) => campaignNames.map((name) => ({ label: name, onSelect: () => sendTo(character, name, as) }));
    const empty = loadingCampaigns ? "Fetching campaigns…" : "No campaigns yet";
    return [
      { heading: EXPORT_KINDS.party.heading, items: campaignItems("party"), empty },
      { heading: EXPORT_KINDS.npc.heading, items: campaignItems("npc"), empty },
      {
        items: [
          { label: character.active ? "Remove from Sheets" : "Use in Sheets", onSelect: () => toggleSheets(character) },
          { label: "Delete…", onSelect: () => remove(character), danger: true },
        ],
      },
    ];
  };

  /* ── page ── */

  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <ParchmentSheet>
        <Title
          after={
            <span className={`text-sm italic ${INK.faded}`}>
              {characters.length} {characters.length === 1 ? "character" : "characters"}
              {inSheets > 0 && <> · {inSheets} in Sheets</>}
            </span>
          }
        >
          Characters
        </Title>

        {/* Roster */}
        <section className="mb-10">
          <InkHeading right={<span className={`text-[11px] italic ${INK.faint}`}>click to use in Sheets · right-click for more</span>}>Your roster</InkHeading>

          {characters.length === 0 ? (
            <p className={`py-6 text-center italic ${INK.faint}`}>No characters yet — create one below to begin.</p>
          ) : (
            <div className="flex flex-wrap gap-x-6 gap-y-4 pt-2">
              {characters.map((character) => (
                <CharacterToken
                  key={character.id ?? character.name}
                  character={character}
                  active={!!character.active}
                  onClick={() => toggleSheets(character)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openMenu(character, e.clientX, e.clientY);
                  }}
                  onMenuButton={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    openMenu(character, r.left, r.bottom + 4);
                  }}
                />
              ))}
            </div>
          )}

          {notice && (
            <p className={`mt-4 flex flex-wrap items-baseline gap-x-3 text-sm italic ${notice.tone === "error" ? INK.rubric : INK.faded}`} role="status">
              {notice.text}
              <InkButton onClick={() => setNotice(null)}>dismiss</InkButton>
            </p>
          )}
        </section>

        {/* New character */}
        <section>
          <button type="button" onClick={() => setBuilding((b) => !b)} aria-expanded={building} className="group flex gap-3 text-left">
            <span className="pt-1.5">
              <span
                className={`block h-2.5 w-2.5 rotate-45 border-[1.5px] transition ${
                  building ? "border-[#9a3412] bg-[#9a3412]" : "border-[#7b6346]/70 group-hover:border-[#3a2716]"
                }`}
              />
            </span>
            <span>
              <span className={`block text-lg ${building ? INK.rubric : ""} group-hover:underline group-hover:decoration-dotted group-hover:underline-offset-4`}>
                Builder Wizard
              </span>
              <span className={`mt-0.5 block text-sm italic leading-relaxed ${INK.faded}`}>
                Step-by-step creation from the class, race and background catalogues. For an empty sheet, turn off random and create right away.
              </span>
            </span>
          </button>

          {building && (
            <div className="mt-8">
              <BuildWizard onCreated={(name) => setNotice({ tone: "ok", text: `${name || "Your character"} was created. Click their token to use them in Sheets.` })} />
            </div>
          )}
        </section>
      </ParchmentSheet>

      {menu && (
        <ParchmentMenu
          x={menu.x}
          y={menu.y}
          title={menu.character.name}
          subtitle={menu.character.active ? "in Sheets" : undefined}
          groups={menuGroups(menu.character)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}