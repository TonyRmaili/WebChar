import React, { useEffect, useState } from "react";
import useEncounterStore from "../../../store/EncounterStore";
import { INK, InkButton } from "../../../styles/parchment";
import { addBtn } from "../../../styles/parchmentForm";
import ParchmentMenu from "../../../styles/ParchmentMenu";
import { closeStatblock } from "../statblock/StatblockWindow";
import { closeTracker, openTracker } from "../tracker/TrackerWindow";
import CombatSection from "./CombatSection";
import EncounterEditor from "./EncounterEditor";
import { mergeEncounters, startFight } from "./encounterActions";
import { awardedXp, fmt, notesSnippet } from "./encounterHelpers";

/* Campaign › Combat › Encounters — the fights the DM has prepared.

   A list; click one to open it underneath (one at a time), right-click
   for copy and delete. What's inside an encounter: EncounterEditor.
   `party`, `npcs` and `shelf` are the campaign's copies ({ file, data }),
   passed down from the Combat page. */

const EMPTY = [];
const openKey = (campaignName) => `encounters.open.${campaignName}`;

function useOpenEncounter(campaignName) {
  const [openId, setOpenId] = useState(() => {
    try {
      return localStorage.getItem(openKey(campaignName));
    } catch {
      return null;
    }
  });
  const set = (id) => {
    setOpenId(id);
    try {
      if (id) localStorage.setItem(openKey(campaignName), id);
      else localStorage.removeItem(openKey(campaignName));
    } catch {
      /* fine without it */
    }
  };
  return [openId, set];
}

// "fighting · round 3 · 2 characters · 4 monsters · 1,950 XP"
function summary(encounter) {
  const members = (encounter.members || []).length;
  const monsters = (encounter.monsters || []).length;
  const xp = awardedXp(encounter);
  return [
    encounter.combat ? `fighting · round ${encounter.combat.round}` : "",
    members ? `${members} ${members === 1 ? "character" : "characters"}` : "",
    `${monsters} ${monsters === 1 ? "monster" : "monsters"}`,
    xp ? `${fmt(xp)} XP` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function Encounters({ campaignName, party, npcs, shelf }) {
  const encounters = useEncounterStore((s) => s.encounters[campaignName]) || EMPTY;
  const loading = useEncounterStore((s) => s.loading);
  const problem = useEncounterStore((s) => s.problem);
  const fetchEncounters = useEncounterStore((s) => s.fetchEncounters);
  const createEncounter = useEncounterStore((s) => s.createEncounter);
  const copyEncounter = useEncounterStore((s) => s.copyEncounter);
  const deleteEncounter = useEncounterStore((s) => s.deleteEncounter);

  const [openId, setOpenId] = useOpenEncounter(campaignName);
  const [menu, setMenu] = useState(null); // { x, y, encounter }
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    fetchEncounters(campaignName).then((res) => !res.ok && setNotice(`Couldn't fetch the encounters — ${res.message}.`));
  }, [campaignName, fetchEncounters]);

  const create = async () => {
    const res = await createEncounter(campaignName, `Encounter ${encounters.length + 1}`);
    if (res.ok) setOpenId(res.encounter.id);
    else setNotice(`Couldn't make an encounter — ${res.message}.`);
  };

  const copy = async (enc) => {
    const res = await copyEncounter(campaignName, enc.id);
    if (res.ok) setOpenId(res.encounter.id);
    setNotice(res.ok ? `${res.encounter.name} was made.` : `Couldn't copy ${enc.name} — ${res.message}.`);
  };

  const run = (enc) => {
    if (!enc.combat) startFight(campaignName, enc.id);
    openTracker({ name: enc.name, campaignName, encounterId: enc.id });
  };

  const merge = async (into, from) => {
    if (!window.confirm(`Move everything in ${from.name} into ${into.name}? ${from.name} is deleted afterwards.`)) return;
    closeTracker({ campaignName, encounterId: from.id });
    const res = await mergeEncounters(campaignName, into.id, from.id);
    setNotice(res.ok ? `${from.name} was merged into ${into.name}.` : `Couldn't merge — ${res.message}.`);
  };

  const remove = async (enc) => {
    if (!window.confirm(`Delete ${enc.name}? Its monsters, notes and loot go with it.`)) return;
    const res = await deleteEncounter(campaignName, enc.id);
    if (!res.ok) return setNotice(`Couldn't delete ${enc.name} — ${res.message}.`);
    (enc.monsters || []).forEach((m) => closeStatblock({ campaignName, kind: "encounter", encounterId: enc.id, monsterId: m.id }));
    closeTracker({ campaignName, encounterId: enc.id });
    if (openId === enc.id) setOpenId(null);
    setNotice(`${enc.name} was deleted.`);
  };

  return (
    <CombatSection
      id="encounters"
      title="Encounters"
      summary={encounters.length ? `${encounters.length}${encounters.some((e) => e.combat) ? " · a fight is running" : ""}` : undefined}
      right={
        <button type="button" onClick={create} className={addBtn}>
          + new encounter
        </button>
      }
    >

      {problem && <p className={`mb-2 text-sm italic ${INK.rubric}`}>{problem}</p>}

      {encounters.length === 0 ? (
        <p className={`py-4 italic ${INK.faint}`}>{loading ? "Fetching…" : "None yet. Make one, then fill it with the party, NPCs and monsters."}</p>
      ) : (
        <div>
          {encounters.map((enc) => {
            const open = enc.id === openId;
            return (
              <div key={enc.id} className="border-b border-rule/20 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : enc.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ x: e.clientX, y: e.clientY, encounter: enc });
                  }}
                  aria-expanded={open}
                  className="group flex w-full items-baseline gap-3 py-2 text-left"
                >
                  <span className="self-center">
                    <span className={`block h-2.5 w-2.5 rotate-45 border-[1.5px] transition ${open ? "border-rubric bg-rubric" : "border-rule/70 group-hover:border-ink"}`} />
                  </span>
                  <span className={`text-lg ${open ? INK.rubric : ""} group-hover:underline group-hover:decoration-dotted group-hover:underline-offset-4`}>{enc.name || "Unnamed"}</span>
                  <span className={`shrink-0 text-sm italic ${INK.faded}`}>{summary(enc)}</span>
                  {notesSnippet(enc) && <span className={`min-w-0 truncate text-sm italic ${INK.faint}`}>— {notesSnippet(enc)}</span>}
                </button>
                {open && (
                  <div className="pb-6 pl-[22px]">
                    <EncounterEditor campaignName={campaignName} encounter={enc} encounters={encounters} party={party} npcs={npcs} shelf={shelf} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {notice && (
        <p className={`mt-4 flex flex-wrap items-baseline gap-x-3 text-sm italic ${INK.faded}`} role="status">
          {notice}
          <InkButton onClick={() => setNotice(null)}>dismiss</InkButton>
        </p>
      )}

      {menu && (
        <ParchmentMenu
          x={menu.x}
          y={menu.y}
          title={menu.encounter.name}
          subtitle={summary(menu.encounter) || undefined}
          groups={[
            {
              items: [
                { label: menu.encounter.combat ? "Open the fight" : "Run this encounter", onSelect: () => run(menu.encounter) },
                { label: menu.encounter.id === openId ? "Close" : "Open", onSelect: () => setOpenId(menu.encounter.id === openId ? null : menu.encounter.id) },
                { label: "Make a copy", onSelect: () => copy(menu.encounter), note: "same creatures, notes and loot" },
              ],
            },
            {
              heading: "Merge into…",
              items: encounters.filter((e) => e.id !== menu.encounter.id).map((e) => ({ label: e.name || "Unnamed", onSelect: () => merge(e, menu.encounter) })),
              empty: "No other encounters",
            },
            { items: [{ label: "Delete…", onSelect: () => remove(menu.encounter), danger: true }] },
          ]}
          onClose={() => setMenu(null)}
        />
      )}
    </CombatSection>
  );
}