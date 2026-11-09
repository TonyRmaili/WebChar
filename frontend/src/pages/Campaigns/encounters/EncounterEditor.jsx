import React, { useState } from "react";
import useEncounterStore from "../../../store/EncounterStore";
import useGroupStore from "../../../store/GroupStore";
import useTemplateStore from "../../../store/TemplateStore";
import { INK, InkButton, InkRemove, InkText, InkTextArea, Leader, SubHeading } from "../../../styles/parchment";
import { addBtn } from "../../../styles/parchmentForm";
import { openStatblock } from "../statblock/StatblockWindow";
import { openTracker } from "../tracker/TrackerWindow";
import { groupSummary } from "../groups/Groups";
import { applyTemplates, givenTemplates, resolveTemplates } from "../templates/templateLogic";
import { AddGroups, AddMembers, AddMonsters } from "./AddCreatures";
import EncounterRewards from "./EncounterRewards";
import { addGroup, addMembers, addMonsters, removeMember, removeMonster, startFight } from "./encounterActions";
import { characterLine, monsterLine } from "./encounterHelpers";

/* One encounter, opened under its row on the Combat page. Everything
   saves by itself a moment after you change it.

     Party & NPCs   pointers to the campaign's copies (shared state); one
                    encounter at a time — adding moves them here
     Monsters       the encounter's own copies — from the shelf or the bestiary
     Rewards        XP (worked out, can be overridden) and loot
     Notes          anything the DM wants to remember */

const asList = (v) => (Array.isArray(v) ? v : []);

// Name ........ details  ✕  — one creature in the encounter.
function CreatureRow({ name, line, missing, onOpen, onRemove }) {
  return (
    <div className="flex items-baseline gap-2 py-[3px] text-[15px]">
      {missing ? (
        <span className={`italic ${INK.faint}`}>{name}</span>
      ) : (
        <button type="button" onClick={onOpen} className="truncate text-left font-semibold italic hover:underline hover:decoration-dotted hover:underline-offset-4" title="Open its statblock">
          {name}
        </button>
      )}
      <Leader />
      <span className={`shrink-0 text-xs italic ${INK.faded}`}>{missing ? "no longer in the campaign" : line}</span>
      <InkRemove onClick={onRemove} label={`Take ${name} out of this encounter`} />
    </div>
  );
}

export default function EncounterEditor({ campaignName, encounter, encounters, party, npcs, shelf }) {
  const update = useEncounterStore((s) => s.update);
  const change = (fn) => update(campaignName, encounter.id, fn);
  const patch = (p) => change((e) => ({ ...e, ...p }));

  const [adding, setAdding] = useState(null); // "members" | "monsters" | "groups" | null
  const groups = useGroupStore((s) => s.records[campaignName]) || [];
  const templates = useTemplateStore((s) => s.records[campaignName]);
  // Lines show the creature as it is with its templates on — its own and its groups' (member: its entry here).
  const seen = (kind, raw, member) => (raw ? applyTemplates(kind, raw, resolveTemplates(raw, templates, givenTemplates(raw, member, groups))) : raw);

  const members = asList(encounter.members);
  const monsters = asList(encounter.monsters);
  const copyOf = (m) => (m.kind === "party" ? party : npcs).find((c) => c.file === m.file);

  // Which other encounter someone is in (they'd move here if picked).
  const elsewhere = (kind, file) => encounters.find((e) => e.id !== encounter.id && asList(e.members).some((m) => m.kind === kind && m.file === file))?.name || null;

  const run = () => {
    if (!encounter.combat) startFight(campaignName, encounter.id);
    openTracker({ name: encounter.name, campaignName, encounterId: encounter.id });
  };

  const toggle = (what) => setAdding((a) => (a === what ? null : what));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <InkText value={encounter.name} onChange={(e) => patch({ name: e.target.value })} aria-label="Encounter name" className="h-9 w-full max-w-md text-2xl" />
        <InkButton active onClick={run}>
          {encounter.combat ? `open the fight · round ${encounter.combat.round}` : "run this encounter"}
        </InkButton>
      </div>

      <div className="grid grid-cols-1 gap-x-12 gap-y-6 @4xl:grid-cols-2">
        {/* who's in it */}
        <div className="space-y-5">
          <div>
            <SubHeading count={members.length}>Party & NPCs</SubHeading>
            {members.map((m) => {
              const copy = copyOf(m);
              const data = seen(m.kind, copy?.data, m);
              const name = data?.name || m.file.replace(/\.json$/, "");
              return (
                <CreatureRow
                  key={`${m.kind}:${m.file}`}
                  name={name}
                  line={characterLine(data)}
                  missing={!copy}
                  onOpen={() => openStatblock({ name, campaignName, kind: m.kind, file: m.file })}
                  onRemove={() => removeMember(campaignName, encounter.id, m)}
                />
              );
            })}
            <div className="mt-1.5">
              <button type="button" onClick={() => toggle("members")} className={addBtn}>
                {adding === "members" ? "done" : "+ party & NPCs"}
              </button>
              {adding === "members" && (
                <div className="mt-2">
                  <AddMembers party={party} npcs={npcs} members={members} elsewhere={elsewhere} onAdd={(list) => addMembers(campaignName, encounter.id, list)} />
                </div>
              )}
            </div>
          </div>

          <div>
            <SubHeading count={monsters.length}>Monsters</SubHeading>
            {monsters.map((m) => {
              const data = seen("monster", m);
              return (
                <CreatureRow
                  key={m.id}
                  name={data.name}
                  line={[monsterLine(data), m.group].filter(Boolean).join(" · ")}
                  onOpen={() => openStatblock({ name: data.name, campaignName, kind: "encounter", encounterId: encounter.id, monsterId: m.id })}
                  onRemove={() => removeMonster(campaignName, encounter.id, m)}
                />
              );
            })}
            <div className="mt-1.5 flex flex-wrap gap-x-4">
              <button type="button" onClick={() => toggle("monsters")} className={addBtn}>
                {adding === "monsters" ? "done" : "+ monsters"}
              </button>
              <button type="button" onClick={() => toggle("groups")} className={addBtn}>
                {adding === "groups" ? "done" : "+ group"}
              </button>
            </div>
            {adding === "monsters" && (
              <div className="mt-2">
                <AddMonsters shelf={shelf} onAdd={(source, count, from) => addMonsters(campaignName, encounter.id, source, count, from)} />
              </div>
            )}
            {adding === "groups" && (
              <div className="mt-2">
                <AddGroups groups={groups} summary={(g) => groupSummary(g, shelf, npcs, templates)} onAdd={(g) => addGroup(campaignName, encounter.id, g)} />
              </div>
            )}
          </div>
        </div>

        {/* rewards */}
        <EncounterRewards encounter={encounter} change={change} />
      </div>

      <div>
        <SubHeading>Notes</SubHeading>
        <InkTextArea
          value={encounter.notes || ""}
          onChange={(e) => patch({ notes: e.target.value })}
          rows={4}
          placeholder="What happens, how they fight, what to read aloud, what if the party runs…"
          aria-label="Encounter notes"
        />
      </div>
    </div>
  );
}