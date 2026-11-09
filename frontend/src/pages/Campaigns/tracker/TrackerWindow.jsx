import React, { useEffect, useMemo, useRef, useState } from "react";
import useCampaignStore, { copiesKey } from "../../../store/CampaignStore";
import useEncounterStore from "../../../store/EncounterStore";
import { usePopupStore } from "../../../store/PopupStore";
import useTemplateStore from "../../../store/TemplateStore";
import { INK, InkButton, ParchmentSheet } from "../../../styles/parchment";
import { addBtn } from "../../../styles/parchmentForm";
import ParchmentMenu from "../../../styles/ParchmentMenu";
import StatblockWindow, { openStatblock, standardFrame } from "../statblock/StatblockWindow";
import useGroupStore from "../../../store/GroupStore";
import { AddGroups, AddMembers, AddMonsters } from "../encounters/AddCreatures";
import { groupSummary } from "../groups/Groups";
import {
  addGroup,
  addMembers,
  addMonsters,
  endFight,
  giveTurn,
  mergeEncounters,
  moveTurn,
  removeMember,
  removeMonster,
  reroll,
  resetCreature,
  rerollAll,
  saveCreature,
  setFight,
  startFight,
} from "../encounters/encounterActions";
import { addTemplate, templateMenuGroups } from "../templates/templateLogic";
import CombatantRow from "./CombatantRow";
import GroupRoll from "../../../components/dice/GroupRoll";
import { toTargets } from "./trackerDice";
import { combatantsOf, damage, giveTemp, heal, ordered, tiedKeys } from "./trackerLogic";

/* ═══════════════════════════════════════════════════════════════════
   TrackerWindow — the initiative tracker for one encounter, as a card
   window (popup type "tracker"): movable, resizable, minimized to the
   footer. Several can be open at once, one per running fight.

   Left:  the order, highest first (ties: DEX, then party › NPC › monster).
          Each line: initiative (type it), name (opens the
          card), HP, AC, conditions… The arrow opens HP / conditions /
          reaction / concentration controls; the one whose turn it is
          opens by itself.
   Right: the statblock card of whoever's turn it is — or, with some
          creatures selected, "Make them save…" / "Attack them…" (GroupRoll,
          the bridge to the dice tower).

   Selecting: the square at the start of a line, Ctrl/⌘-click a line to
   add it, Shift-click to take everyone in between; or right-click for
   "select the whole group", "select every monster"…

   Right-click the order for: next / previous turn, add creatures, merge
   another encounter in, roll everyone again, end the fight. Right-click a
   line for: their card, roll again, make it their turn, reset (all, HP,
   uses, conditions), take out of the fight.

   The fight itself is saved on the encounter (combat, see trackerLogic).
   ═══════════════════════════════════════════════════════════════════ */

const EMPTY = [];
const asList = (v) => (Array.isArray(v) ? v : []);

export const trackerWindowId = (d) => `tracker__${d.campaignName}__${d.encounterId}`;

export function openTracker(data) {
  const store = usePopupStore.getState();
  const id = trackerWindowId(data);
  const known = store.openPopups.some((p) => p.id === id) || store.minimized.some((p) => p.id === id);
  store.open("tracker", data);
  if (!known) {
    const f = standardFrame();
    usePopupStore.getState().resize(id, f.width, f.height);
    usePopupStore.getState().move(id, f.x, f.y);
  }
}

export function closeTracker(data) {
  const id = trackerWindowId(data);
  usePopupStore.setState((s) => ({ openPopups: s.openPopups.filter((p) => p.id !== id), minimized: s.minimized.filter((p) => p.id !== id) }));
}

export default function TrackerWindow({ tracker }) {
  const { campaignName, encounterId } = tracker;
  const id = trackerWindowId(tracker);

  const encounters = useEncounterStore((s) => s.encounters[campaignName]);
  const encounter = asList(encounters).find((e) => e.id === encounterId);
  const party = useCampaignStore((s) => s.campaignCharacters[copiesKey(campaignName, "party")]);
  const npcs = useCampaignStore((s) => s.campaignCharacters[copiesKey(campaignName, "npc")]);
  const shelf = useCampaignStore((s) => s.campaignCharacters[copiesKey(campaignName, "monster")]);
  const templates = useTemplateStore((s) => s.records[campaignName]);
  const groups = useGroupStore((s) => s.records[campaignName]);

  const [openKey, setOpenKey] = useState(null);
  const [adding, setAdding] = useState(null); // "members" | "monsters" | null
  const [notes, setNotes] = useState([]); // what happened as the turn started
  const [alerts, setAlerts] = useState({}); // { key: "Concentration: DC 12 CON save" }
  const [menu, setMenu] = useState(null); // { x, y, c? }
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState([]); // keys
  const [groupRoll, setGroupRoll] = useState(null); // null | "save" | "attack"
  const lastPicked = useRef(null);

  // Restored from the footer after a reload: fetch what isn't there yet.
  useEffect(() => {
    const jobs = [];
    if (!encounters) jobs.push(useEncounterStore.getState().fetchEncounters(campaignName));
    const fetchCopies = useCampaignStore.getState().fetchCampaignCharacters;
    if (!party) jobs.push(fetchCopies(campaignName, "party"));
    if (!npcs) jobs.push(fetchCopies(campaignName, "npc"));
    if (!shelf) jobs.push(fetchCopies(campaignName, "monster"));
    if (!templates) jobs.push(useTemplateStore.getState().fetch(campaignName));
    if (!groups) jobs.push(useGroupStore.getState().fetch(campaignName));
    Promise.all(jobs).then(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const list = useMemo(
    () => (encounter ? ordered(combatantsOf(encounter, { party: party || EMPTY, npc: npcs || EMPTY }, templates || EMPTY, groups || EMPTY)) : []),
    [encounter, party, npcs, templates, groups]
  );
  const ties = useMemo(() => tiedKeys(list), [list]);
  // Only who is still in the fight stays selected.
  const picked = useMemo(() => list.filter((c) => selected.includes(c.key) && c.data), [list, selected]);
  const combat = encounter?.combat;
  const turn = combat?.turn ?? null;
  const current = list.find((c) => c.key === turn);

  // The one whose turn it is opens by itself.
  useEffect(() => {
    if (turn) setOpenKey(turn);
  }, [turn]);

  if (!encounter) {
    return (
      <div className="h-full overflow-y-auto bg-desk-deep p-2">
        <ParchmentSheet>
          <p className={`py-6 text-center italic ${INK.faint}`}>{loaded || encounters ? `${tracker.name} isn't in ${campaignName} any more.` : "Fetching…"}</p>
        </ParchmentSheet>
      </div>
    );
  }

  /* ── actions ── */

  const next = () => {
    setNotes(moveTurn(campaignName, encounterId, 1));
    setAlerts({});
  };
  const back = () => {
    moveTurn(campaignName, encounterId, -1);
    setNotes([]);
  };

  const onHp = async (c, how, amount) => {
    if (!c.data) return;
    if (how === "damage") {
      const res = damage(c, amount);
      await saveCreature(campaignName, encounterId, c, res.data);
      const words = [];
      if (res.dropped && c.fight.concentration != null) {
        setFight(campaignName, encounterId, c.key, { concentration: null });
        words.push("drops to 0 — concentration ends");
      } else if (res.dropped) words.push(c.kind === "monster" ? "drops to 0" : "drops to 0 — death saves");
      else if (res.concentrationDc) words.push(`Concentration: DC ${res.concentrationDc} Constitution save`);
      setAlerts((a) => ({ ...a, [c.key]: words.join(" · ") || null }));
    } else {
      await saveCreature(campaignName, encounterId, c, how === "heal" ? heal(c, amount) : giveTemp(c, amount));
      setAlerts((a) => ({ ...a, [c.key]: null }));
    }
  };

  /* ── selecting ── */

  const select = (keys, on = true) => setSelected((s) => (on ? [...new Set([...s, ...keys])] : s.filter((k) => !keys.includes(k))));
  // The square (or Ctrl/⌘-click) adds or takes one; Shift-click takes everyone between.
  const pick = (c, e) => {
    if (e?.shiftKey && lastPicked.current) {
      const keys = list.map((x) => x.key);
      const [a, b] = [keys.indexOf(lastPicked.current), keys.indexOf(c.key)].sort((x, y) => x - y);
      if (a >= 0) return select(keys.slice(a, b + 1));
    }
    lastPicked.current = c.key;
    select([c.key], !selected.includes(c.key));
  };

  // The damage from a GroupRoll, put on everyone ticked: [{ key, amount }].
  const applyRoll = async (lines, what) => {
    const said = {};
    for (const line of lines) {
      const c = list.find((x) => x.key === line.key);
      if (!c?.data) continue;
      const res = damage(c, line.amount);
      await saveCreature(campaignName, encounterId, c, res.data);
      const words = [`${what}: ${line.amount} damage`];
      if (res.dropped && c.fight.concentration != null) {
        setFight(campaignName, encounterId, c.key, { concentration: null });
        words.push("drops to 0 — concentration ends");
      } else if (res.dropped) words.push(c.kind === "monster" ? "drops to 0" : "drops to 0 — death saves");
      else if (res.concentrationDc) words.push(`Concentration: DC ${res.concentrationDc} Constitution save`);
      said[c.key] = words.join(" · ");
    }
    setAlerts((a) => ({ ...a, ...said }));
    setGroupRoll(null);
  };

  const remove = (c) => {
    if (c.kind === "monster") removeMonster(campaignName, encounterId, c.base);
    else removeMember(campaignName, encounterId, { kind: c.kind, file: c.card.file });
  };

  const end = () => {
    if (!window.confirm(`End the fight in ${encounter.name}? Initiative, conditions and the round count are cleared; HP and uses stay as they are.`)) return;
    endFight(campaignName, encounterId);
    setNotes([]);
    setAlerts({});
  };

  const merge = async (other) => {
    if (!window.confirm(`Bring everyone in ${other.name} into this fight? ${other.name} is deleted afterwards.`)) return;
    closeTracker({ campaignName, encounterId: other.id });
    const res = await mergeEncounters(campaignName, encounterId, other.id);
    if (!res.ok) window.alert(`Couldn't merge — ${res.message}.`);
  };

  const openCard = (c) => openStatblock({ name: c.name, campaignName, ...c.card });

  // Someone in another encounter right now (they'd move here if picked).
  const elsewhere = (kind, file) => asList(encounters).find((e) => e.id !== encounterId && asList(e.members).some((m) => m.kind === kind && m.file === file))?.name || null;

  const others = asList(encounters).filter((e) => e.id !== encounterId);

  // Templates on one creature, or on every monster that came in with it
  // (this pack only; its group's own templates reach them anyway).
  const changeTemplates = (c) => (fn) => c.base && saveCreature(campaignName, encounterId, c, fn(c.base));
  const groupMates = (c) => (c?.base?.group_id ? list.filter((x) => x.kind === "monster" && x.base?.group_id === c.base.group_id) : []);
  const giveGroup = (c, templateId) => groupMates(c).forEach((x) => saveCreature(campaignName, encounterId, x, addTemplate(x.base, templateId)));

  const menuGroups = menu?.c
    ? [
        {
          items: [
            { label: "Open their card", onSelect: () => openCard(menu.c) },
            { label: "Roll initiative again", onSelect: () => reroll(campaignName, encounterId, menu.c.key) },
            { label: "Make it their turn", onSelect: () => giveTurn(campaignName, encounterId, menu.c.key) },
          ],
        },
        {
          heading: "Select",
          items: [
            selected.includes(menu.c.key)
              ? { label: "Unselect them", onSelect: () => select([menu.c.key], false) }
              : { label: "Select them", onSelect: () => select([menu.c.key]) },
            ...(groupMates(menu.c).length > 1 ? [{ label: `Select the whole ${menu.c.base.group || "group"}`, onSelect: () => select(groupMates(menu.c).map((x) => x.key)) }] : []),
            ...(selected.length ? [{ label: "Select no one", onSelect: () => setSelected([]) }] : []),
          ],
        },
        ...templateMenuGroups(menu.c.base, templates, changeTemplates(menu.c), menu.c.given),
        ...(groupMates(menu.c).length > 1
          ? [
              {
                heading: `Give the whole ${menu.c.base.group || "group"} a template`,
                items: asList(templates)
                  .filter((t) => !asList(menu.c.given).some((g) => g.id === t.id))
                  .map((t) => ({ label: t.name, onSelect: () => giveGroup(menu.c, t.id) })),
                empty: "No other templates",
              },
            ]
          : []),
        {
          heading: "Reset",
          items: [
            { label: "Everything", note: "HP, uses, conditions", onSelect: () => resetCreature(campaignName, encounterId, menu.c) },
            { label: "HP to full", onSelect: () => resetCreature(campaignName, encounterId, menu.c, { hp: true }) },
            { label: "Uses", note: "charges, slots, legendary", onSelect: () => resetCreature(campaignName, encounterId, menu.c, { uses: true }) },
            { label: "Conditions & concentration", onSelect: () => resetCreature(campaignName, encounterId, menu.c, { fight: true }) },
          ],
        },
        { items: [{ label: "Take out of the fight", onSelect: () => remove(menu.c), danger: true }] },
      ]
    : [
        {
          items: [
            { label: "Next turn", onSelect: next },
            { label: "Previous turn", onSelect: back },
            { label: "Roll everyone again", onSelect: () => rerollAll(campaignName, encounterId) },
          ],
        },
        {
          heading: "Select",
          items: [
            { label: "Every monster", onSelect: () => setSelected(list.filter((c) => c.kind === "monster").map((c) => c.key)) },
            { label: "Everyone", onSelect: () => setSelected(list.map((c) => c.key)) },
            ...(selected.length ? [{ label: "No one", onSelect: () => setSelected([]) }] : []),
          ],
        },
        ...(picked.length
          ? [
              {
                heading: `The ${picked.length} selected`,
                items: [
                  { label: "Make them save…", onSelect: () => setGroupRoll("save") },
                  { label: "Attack them…", onSelect: () => setGroupRoll("attack") },
                ],
              },
            ]
          : []),
        {
          items: [
            { label: "Add party & NPCs", onSelect: () => setAdding("members") },
            { label: "Add monsters", onSelect: () => setAdding("monsters") },
            { label: "Add a group", onSelect: () => setAdding("groups") },
          ],
        },
        { heading: "Bring in another encounter…", items: others.map((e) => ({ label: e.name || "Unnamed", onSelect: () => merge(e) })), empty: "No other encounters" },
        {
          items: [
            { label: "Minimize", onSelect: () => usePopupStore.getState().minimize(id) },
            { label: "End the fight…", onSelect: end, danger: true },
          ],
        },
      ];

  return (
    <div className="@container h-full overflow-y-auto bg-desk-deep">
      <div className="flex flex-col gap-2 p-2 @4xl:h-full @4xl:flex-row">
        {/* ── the order ── */}
        <div
          className="shrink-0 @4xl:w-[46%] @4xl:overflow-y-auto"
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenu({ x: e.clientX, y: e.clientY });
          }}
        >
          <ParchmentSheet>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="text-2xl tracking-wide">{encounter.name}</h2>
              {combat && <span className={`text-lg ${INK.rubric}`}>Round {combat.round}</span>}
              {combat && (
                <span className="ml-auto flex items-baseline gap-x-4">
                  <InkButton onClick={back} title="Back to the one before">
                    ← back
                  </InkButton>
                  <InkButton active onClick={next}>
                    next turn →
                  </InkButton>
                </span>
              )}
            </div>

            {!combat ? (
              <div className="py-4">
                <p className={`mb-3 italic ${INK.faded}`}>This fight isn't running. Starting rolls initiative for everyone in it — type over any roll your players tell you.</p>
                <InkButton active onClick={() => startFight(campaignName, encounterId)}>
                  start the fight
                </InkButton>
              </div>
            ) : (
              <>
                {current && (
                  <p className={`mb-2 text-sm italic ${INK.faded}`}>
                    {current.name}'s turn{notes.length ? ` — ${notes.join(" · ")}` : ""}
                  </p>
                )}

                {picked.length > 0 && (
                  <p className="mb-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-y border-rubric/30 py-1.5 text-sm">
                    <span className={INK.rubric}>{picked.length} selected</span>
                    <InkButton active={groupRoll === "save"} onClick={() => setGroupRoll("save")}>
                      make them save…
                    </InkButton>
                    <InkButton active={groupRoll === "attack"} onClick={() => setGroupRoll("attack")}>
                      attack them…
                    </InkButton>
                    <span className="ml-auto">
                      <InkButton onClick={() => setSelected([])}>select no one</InkButton>
                    </span>
                  </p>
                )}

                {list.length === 0 ? (
                  <p className={`py-4 italic ${INK.faint}`}>No one is in this fight yet — add some below.</p>
                ) : (
                  list.map((c) => (
                    <CombatantRow
                      key={c.key}
                      c={c}
                      isTurn={c.key === turn}
                      tied={ties.has(c.key)}
                      open={openKey === c.key}
                      alert={alerts[c.key]}
                      onToggle={() => setOpenKey((k) => (k === c.key ? null : c.key))}
                      onOpenCard={() => openCard(c)}
                      onInitiative={(v) => setFight(campaignName, encounterId, c.key, { initiative: v })}
                      onHp={(how, amount) => onHp(c, how, amount)}
                      onFight={(patch) => setFight(campaignName, encounterId, c.key, patch)}
                      onRemove={() => remove(c)}
                      onMenu={setMenu}
                      selected={selected.includes(c.key)}
                      onSelect={(e) => pick(c, e)}
                    />
                  ))
                )}

                {/* adding mid-fight */}
                <div className="mt-3 flex flex-wrap items-baseline gap-x-4">
                  <button type="button" onClick={() => setAdding((a) => (a === "members" ? null : "members"))} className={addBtn}>
                    {adding === "members" ? "done" : "+ party & NPCs"}
                  </button>
                  <button type="button" onClick={() => setAdding((a) => (a === "monsters" ? null : "monsters"))} className={addBtn}>
                    {adding === "monsters" ? "done" : "+ monsters"}
                  </button>
                  <button type="button" onClick={() => setAdding((a) => (a === "groups" ? null : "groups"))} className={addBtn}>
                    {adding === "groups" ? "done" : "+ group"}
                  </button>
                  <span className={`ml-auto text-xs italic ${INK.faint}`}>right-click for more</span>
                </div>
                {adding === "members" && (
                  <div className="mt-2">
                    <AddMembers party={party || EMPTY} npcs={npcs || EMPTY} members={asList(encounter.members)} elsewhere={elsewhere} onAdd={(m) => addMembers(campaignName, encounterId, m)} />
                  </div>
                )}
                {adding === "monsters" && (
                  <div className="mt-2">
                    <AddMonsters shelf={shelf || EMPTY} onAdd={(source, count, from) => addMonsters(campaignName, encounterId, source, count, from)} />
                  </div>
                )}
                {adding === "groups" && (
                  <div className="mt-2">
                    <AddGroups groups={groups || EMPTY} summary={(g) => groupSummary(g, shelf || EMPTY, npcs || EMPTY, templates)} onAdd={(g) => addGroup(campaignName, encounterId, g)} />
                  </div>
                )}
              </>
            )}
          </ParchmentSheet>
        </div>

        {/* ── whoever's turn it is ── */}
        <div className="min-h-[24rem] min-w-0 flex-1 @4xl:min-h-0">
          {groupRoll && picked.length > 0 ? (
            <GroupRoll
              key={`${groupRoll}:${picked.map((c) => c.key).join(",")}`}
              kind={groupRoll}
              targets={toTargets(picked)}
              source={`Tracker · ${encounter.name}`}
              onApply={applyRoll}
              onClose={() => setGroupRoll(null)}
            />
          ) : current && !current.missing ? (
            <StatblockWindow key={current.key} statblock={{ name: current.name, campaignName, ...current.card }} embedded />
          ) : (
            <ParchmentSheet>
              <p className={`py-6 text-center italic ${INK.faint}`}>{combat ? "No one's turn yet." : "Their card shows here once the fight starts."}</p>
            </ParchmentSheet>
          )}
        </div>
      </div>

      {menu && (
        <ParchmentMenu
          x={menu.x}
          y={menu.y}
          title={menu.c ? menu.c.name : encounter.name}
          subtitle={menu.c ? undefined : combat ? `round ${combat.round}` : "not running"}
          groups={combat || menu.c ? menuGroups : [{ items: [{ label: "Start the fight", onSelect: () => startFight(campaignName, encounterId) }] }]}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}