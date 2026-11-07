import React, { useEffect, useState } from "react";
import useAuthStore from "../../store/AuthStore";
import useCharStore from "../../store/CharStore";
import useCampaignStore from "../../store/CampaignStore";
import { INK, InkButton, InkHeading, InkText, ParchmentSheet, Title } from "../../styles/parchment";
import ParchmentMenu from "../../styles/ParchmentMenu";
import BuildWizard from "./wizard/BuildWizard";
import CharacterToken from "./create/CharacterToken";

/* Characters › Create — your roster of characters and making new ones,
   on parchment.

   - Click a token: use that character on the Sheets page (or take them out).
   - Right-click a token (or its ⋯): send a copy to a campaign as a party
     member or an NPC, switch Sheets on/off, delete.
   - New character: Manual (just a name) or the Builder Wizard, both
     written on the same sheet. */

const METHODS = [
  {
    id: "manual",
    label: "Manual",
    blurb: "Name your character and start from a blank sheet. You fill in everything yourself on the Sheets page.",
  },
  {
    id: "builder",
    label: "Builder Wizard",
    blurb: "Step-by-step creation from the class, race and background catalogues.",
  },
];

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
  const createChar = useCharStore((s) => s.createChar);
  const toggleActiveChar = useCharStore((s) => s.toggleActiveChar);
  const campaignNames = useCampaignStore((s) => s.campaignNames);
  const loadingCampaigns = useCampaignStore((s) => s.loadingCampaignNames);
  const listCampaigns = useCampaignStore((s) => s.listCampaigns);
  const exportCharacter = useCampaignStore((s) => s.exportCharacter);

  const [createMode, setCreateMode] = useState(null); // "manual" | "builder" | null
  const [manualName, setManualName] = useState("");
  const [creating, setCreating] = useState(false);
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
    const campaignItems = (as) =>
      campaignNames.map((name) => ({ label: name, onSelect: () => sendTo(character, name, as) }));
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

  const createManual = async () => {
    const name = manualName.trim();
    if (!name || creating) return;
    try {
      setCreating(true);
      await createChar(name);
      await fetchUser();
      setManualName("");
      setNotice({ tone: "ok", text: `${name} was created. Click their token to use them in Sheets.` });
    } catch (e) {
      console.error("Failed to create character:", e);
      setNotice({ tone: "error", text: `Couldn't create ${name}.` });
    } finally {
      setCreating(false);
    }
  };

  /* ── page ── */

  return (
    <div className="mx-auto w-full max-w-6xl">
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
          <InkHeading right={<span className={`text-[11px] italic ${INK.faint}`}>click to use in Sheets · right-click for more</span>}>
            Your roster
          </InkHeading>

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
          <InkHeading>New character</InkHeading>
          <div className="grid grid-cols-1 gap-x-12 gap-y-4 @2xl:grid-cols-2">
            {METHODS.map((m) => {
              const on = createMode === m.id;
              return (
                <button key={m.id} type="button" onClick={() => setCreateMode(on ? null : m.id)} aria-pressed={on} className="group flex gap-3 text-left">
                  <span className="pt-1.5">
                    <span
                      className={`block h-2.5 w-2.5 rotate-45 border-[1.5px] transition ${
                        on ? "border-[#9a3412] bg-[#9a3412]" : "border-[#7b6346]/70 group-hover:border-[#3a2716]"
                      }`}
                    />
                  </span>
                  <span>
                    <span className={`block text-lg ${on ? INK.rubric : ""} group-hover:underline group-hover:decoration-dotted group-hover:underline-offset-4`}>{m.label}</span>
                    <span className={`mt-0.5 block text-sm italic leading-relaxed ${INK.faded}`}>{m.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {createMode === "manual" && (
            <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-2 pl-6">
              <span className={`text-sm italic ${INK.faded}`}>Their name is</span>
              <InkText
                value={manualName}
                autoFocus
                onChange={(e) => setManualName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createManual()}
                placeholder="e.g. Thaldrin Brightaxe"
                aria-label="Character name"
                className="h-9 w-full max-w-xs text-xl"
              />
              <InkButton onClick={createManual} active disabled={creating || !manualName.trim()}>
                {creating ? "creating…" : "create"}
              </InkButton>
            </div>
          )}
          {createMode === "builder" && (
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