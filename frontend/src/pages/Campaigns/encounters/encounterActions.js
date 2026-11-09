import useCampaignStore, { copiesKey } from "../../../store/CampaignStore";
import useEncounterStore from "../../../store/EncounterStore";
import useGroupStore from "../../../store/GroupStore";
import useTemplateStore from "../../../store/TemplateStore";
import { closeStatblock } from "../statblock/StatblockWindow";
import { monstersFor, nextNames } from "./encounterHelpers";
import { blankFight, combatantsOf, fullHp, memberKey, monsterKey, nextTurn, ordered, previousTurn, restoreUses, rollInitiative, startOfTurn } from "../tracker/trackerLogic";

/* ═══════════════════════════════════════════════════════════════════
   encounterActions.js — changes to encounters that the encounter editor
   and the initiative tracker both make. They read the stores directly
   (no hooks), so any component can call them.

   Rules kept here:
   • A party member or NPC is in one encounter at a time. Adding them to
     another moves them; their HP and uses come along by themselves (they
     live on the campaign copy), and so do their conditions and
     concentration if both fights are running.
   • Anyone added while a fight is running rolls initiative at once.
   • Shapes: claude/encounters-contract.md, trackerLogic.js (combat).
   ═══════════════════════════════════════════════════════════════════ */

const asList = (v) => (Array.isArray(v) ? v : []);
const enc = () => useEncounterStore.getState();
const listOf = (campaignName) => asList(enc().encounters[campaignName]);
const findEncounter = (campaignName, id) => listOf(campaignName).find((e) => e.id === id);
const change = (campaignName, id, fn) => enc().update(campaignName, id, fn);

// The campaign's party and NPC copies, for names, stats and HP.
export const copiesFor = (campaignName) => {
  const all = useCampaignStore.getState().campaignCharacters;
  return { party: asList(all[copiesKey(campaignName, "party")]), npc: asList(all[copiesKey(campaignName, "npc")]) };
};

const templatesFor = (campaignName) => asList(useTemplateStore.getState().records[campaignName]);
const groupsFor = (campaignName) => asList(useGroupStore.getState().records[campaignName]);
const combatantsIn = (campaignName, e) => combatantsOf(e, copiesFor(campaignName), templatesFor(campaignName), groupsFor(campaignName));

// Give the new ones a fight entry with a fresh roll (only while running).
function joinFight(campaignName, e, keys, carried = {}) {
  if (!e.combat) return e;
  const all = combatantsIn(campaignName, e);
  const combatants = { ...e.combat.combatants };
  for (const key of keys) {
    const c = all.find((x) => x.key === key);
    if (!c) continue;
    combatants[key] = { ...blankFight(), ...(carried[key] || {}), initiative: rollInitiative(c), reaction: false };
  }
  const next = { ...e, combat: { ...e.combat, combatants } };
  if (!next.combat.turn) next.combat.turn = ordered(combatantsIn(campaignName, next))[0]?.key ?? null;
  return next;
}

/* ─── who's in it ────────────────────────────────────────────────── */

// A member may carry `groups: [id, …]` — the groups it came in with, whose
// templates it has while it is in this encounter. Joining again through
// another group only adds that group (it is never in twice).
export function addMembers(campaignName, encounterId, members) {
  const carried = {};
  // Take them out of every other encounter first (keeping their fight state).
  for (const other of listOf(campaignName)) {
    if (other.id === encounterId) continue;
    const leaving = asList(other.members).filter((m) => members.some((x) => x.kind === m.kind && x.file === m.file));
    if (!leaving.length) continue;
    leaving.forEach((m) => {
      const state = other.combat?.combatants?.[memberKey(m)];
      if (state) carried[memberKey(m)] = { conditions: state.conditions, concentration: state.concentration };
    });
    change(campaignName, other.id, (e) => withoutKeys(campaignName, { ...e, members: asList(e.members).filter((m) => !leaving.some((x) => x.kind === m.kind && x.file === m.file)) }, leaving.map(memberKey)));
  }
  change(campaignName, encounterId, (e) => {
    const same = (a, b) => a.kind === b.kind && a.file === b.file;
    const fresh = members.filter((m) => !asList(e.members).some((x) => same(x, m)));
    const kept = asList(e.members).map((x) => {
      const again = members.find((m) => same(x, m));
      const more = asList(again?.groups).filter((g) => !asList(x.groups).includes(g));
      return more.length ? { ...x, groups: [...asList(x.groups), ...more] } : x;
    });
    return joinFight(campaignName, { ...e, members: [...kept, ...fresh] }, fresh.map(memberKey), carried);
  });
}

// `count` new monsters, from a shelf entry or straight from the catalogue.
export function addMonsters(campaignName, encounterId, source, count, from) {
  change(campaignName, encounterId, (e) => {
    const added = monstersFor(e, source, count, from);
    return joinFight(campaignName, { ...e, monsters: [...asList(e.monsters), ...added] }, added.map(monsterKey));
  });
}

// Drop fight entries for these keys; if one of them had the turn, it passes on.
function withoutKeys(campaignName, e, keys) {
  if (!e.combat) return e;
  const combatants = { ...e.combat.combatants };
  keys.forEach((k) => delete combatants[k]);
  let { turn, round } = e.combat;
  if (keys.includes(turn)) {
    const before = ordered(combatantsIn(campaignName, { ...e, combat: e.combat }));
    const stay = before.filter((c) => !keys.includes(c.key));
    const at = before.findIndex((c) => c.key === turn);
    const after = before.slice(at + 1).find((c) => !keys.includes(c.key));
    turn = (after || stay[0])?.key ?? null;
    if (!after && stay.length) round += 1;
  }
  return { ...e, combat: { ...e.combat, turn, round, combatants } };
}

export function removeMember(campaignName, encounterId, member) {
  change(campaignName, encounterId, (e) =>
    withoutKeys(campaignName, { ...e, members: asList(e.members).filter((m) => !(m.kind === member.kind && m.file === member.file)) }, [memberKey(member)])
  );
}

export function removeMonster(campaignName, encounterId, monster) {
  change(campaignName, encounterId, (e) => withoutKeys(campaignName, { ...e, monsters: asList(e.monsters).filter((m) => m.id !== monster.id) }, [monsterKey(monster)]));
  closeStatblock({ campaignName, kind: "encounter", encounterId, monsterId: monster.id });
}

/* ─── groups ─────────────────────────────────────────────────────── */

// A whole group joins: fresh numbered copies of its shelf monsters, and
// its NPCs (who move here, as always). Nothing of the group's templates is
// written onto anyone — monsters remember the group (`group`, `group_id`
// "<group id>#<when>", each arrival its own pack) and NPCs get the group's
// id on their encounter entry, and the group's templates reach them live
// from there (templateLogic.givenTemplates).
export function addGroup(campaignName, encounterId, group) {
  const all = useCampaignStore.getState().campaignCharacters;
  const shelf = asList(all[copiesKey(campaignName, "monster")]);
  const npcs = asList(all[copiesKey(campaignName, "npc")]);
  const pack = `${group.id}#${Date.now().toString(36)}`;

  change(campaignName, encounterId, (e) => {
    let next = e;
    const keys = [];
    for (const { shelf: file, count } of asList(group.monsters)) {
      const entry = shelf.find((x) => x.file === file);
      if (!entry) continue;
      const made = monstersFor(next, entry, Math.max(1, count || 1), "shelf").map((m) => ({ ...m, group: group.name, group_id: pack }));
      next = { ...next, monsters: [...asList(next.monsters), ...made] };
      keys.push(...made.map(monsterKey));
    }
    return joinFight(campaignName, next, keys);
  });

  const people = asList(group.npcs).filter((n) => npcs.some((x) => x.file === n.file));
  if (people.length) addMembers(campaignName, encounterId, people.map((n) => ({ kind: "npc", file: n.file, groups: [group.id] })));
  return { ok: true };
}

/* ─── merging ────────────────────────────────────────────────────── */

// Everything in `fromId` moves into `intoId`, then `fromId` is deleted.
// Monster names that clash are renumbered; a running fight keeps going
// (the joining side keeps its rolls, or rolls now if it wasn't fighting).
export async function mergeEncounters(campaignName, intoId, fromId) {
  const into = findEncounter(campaignName, intoId);
  const from = findEncounter(campaignName, fromId);
  if (!into || !from) return { ok: false, message: "that encounter is gone" };

  const taken = asList(into.monsters).map((m) => m.name);
  const monsters = asList(from.monsters).map((m) => {
    if (!taken.includes(m.name)) {
      taken.push(m.name);
      return m;
    }
    const base = String(m.name).replace(/\s+\d+$/, "");
    const [name] = nextNames(taken, base, 1);
    taken.push(name);
    return { ...m, name };
  });
  const members = asList(from.members).filter((m) => !asList(into.members).some((x) => x.kind === m.kind && x.file === m.file));
  const coins = { ...(into.loot?.coins || {}) };
  for (const [k, v] of Object.entries(from.loot?.coins || {})) coins[k] = (Number(coins[k]) || 0) + (Number(v) || 0);
  const notes = [into.notes, from.notes ? `— from ${from.name} —\n${from.notes}` : ""].filter(Boolean).join("\n\n");

  let merged = {
    ...into,
    notes,
    members: [...asList(into.members), ...members],
    monsters: [...asList(into.monsters), ...monsters],
    xp: { override: null },
    loot: {
      items: [...asList(into.loot?.items), ...asList(from.loot?.items)],
      coins,
      notes: [into.loot?.notes, from.loot?.notes].filter(Boolean).join("\n"),
    },
  };

  const joining = [...members.map(memberKey), ...monsters.map(monsterKey)];
  if (into.combat || from.combat) {
    const base = into.combat || { round: from.combat.round, turn: from.combat.turn, combatants: {} };
    merged.combat = { ...base, combatants: { ...base.combatants } };
    const rolledBefore = from.combat?.combatants || {};
    const needRoll = joining.filter((k) => rolledBefore[k]?.initiative == null);
    joining.forEach((k) => rolledBefore[k] && (merged.combat.combatants[k] = rolledBefore[k]));
    if (!into.combat) asList(into.members).map(memberKey).concat(asList(into.monsters).map(monsterKey)).forEach((k) => needRoll.push(k));
    merged = joinFight(campaignName, merged, needRoll);
  }

  change(campaignName, intoId, () => merged);
  const saved = await enc().flush(campaignName, intoId);
  if (!saved.ok) return saved;
  asList(from.monsters).forEach((m) => closeStatblock({ campaignName, kind: "encounter", encounterId: fromId, monsterId: m.id }));
  return enc().deleteEncounter(campaignName, fromId);
}

/* ─── the fight ──────────────────────────────────────────────────── */

const setCombat = (campaignName, id, fn) => change(campaignName, id, (e) => (e.combat ? { ...e, combat: fn(e.combat, e) } : e));

// Everyone rolls; the highest goes first.
export function startFight(campaignName, encounterId) {
  change(campaignName, encounterId, (e) => {
    if (e.combat) return e;
    const all = combatantsIn(campaignName, e);
    const combatants = Object.fromEntries(all.map((c) => [c.key, { ...blankFight(), initiative: rollInitiative(c) }]));
    const withFight = { ...e, combat: { round: 1, turn: null, combatants } };
    const first = ordered(combatantsIn(campaignName, withFight))[0];
    return beginTurnOf(campaignName, { ...withFight, combat: { ...withFight.combat, turn: first?.key ?? null } }, first?.key);
  });
}

export function endFight(campaignName, encounterId) {
  change(campaignName, encounterId, ({ combat, ...e }) => e);
}

export function setFight(campaignName, encounterId, key, patch) {
  setCombat(campaignName, encounterId, (combat) => ({
    ...combat,
    combatants: { ...combat.combatants, [key]: { ...blankFight(), ...(combat.combatants[key] || {}), ...patch } },
  }));
}

export function reroll(campaignName, encounterId, key) {
  const e = findEncounter(campaignName, encounterId);
  const c = e && combatantsIn(campaignName, e).find((x) => x.key === key);
  if (c) setFight(campaignName, encounterId, key, { initiative: rollInitiative(c) });
}

export function rerollAll(campaignName, encounterId) {
  change(campaignName, encounterId, (e) => {
    if (!e.combat) return e;
    const combatants = { ...e.combat.combatants };
    combatantsIn(campaignName, e).forEach((c) => (combatants[c.key] = { ...blankFight(), ...(combatants[c.key] || {}), initiative: rollInitiative(c) }));
    return { ...e, combat: { ...e.combat, combatants } };
  });
}

// Start of someone's turn: their reaction comes back; a monster also gets
// its legendary actions back and rolls for spent recharges.
let lastNotes = [];
function beginTurnOf(campaignName, e, key) {
  lastNotes = [];
  if (!key || !e.combat) return e;
  const c = combatantsIn(campaignName, e).find((x) => x.key === key);
  if (!c) return e;
  let next = { ...e, combat: { ...e.combat, combatants: { ...e.combat.combatants, [key]: { ...blankFight(), ...(e.combat.combatants[key] || {}), reaction: false } } } };
  if (c.kind === "monster") {
    const { data, notes } = startOfTurn(c);
    lastNotes = notes;
    next = { ...next, monsters: asList(next.monsters).map((m) => (m.id === c.base.id ? data : m)) };
  }
  return next;
}

// Move the turn on (or back). Returns what happened at the start of the
// new turn, e.g. ["Fire Breath recharged (rolled 6)"].
export function moveTurn(campaignName, encounterId, direction = 1) {
  let notes = [];
  change(campaignName, encounterId, (e) => {
    if (!e.combat) return e;
    const list = ordered(combatantsIn(campaignName, e));
    const step = direction > 0 ? nextTurn(list, e.combat.turn, e.combat.round) : previousTurn(list, e.combat.turn, e.combat.round);
    const moved = { ...e, combat: { ...e.combat, ...step } };
    if (direction < 0) return moved;
    const out = beginTurnOf(campaignName, moved, step.turn);
    notes = lastNotes;
    return out;
  });
  return notes;
}

// Jump the turn to someone (e.g. a turn was skipped by mistake).
export function giveTurn(campaignName, encounterId, key) {
  change(campaignName, encounterId, (e) => (e.combat ? beginTurnOf(campaignName, { ...e, combat: { ...e.combat, turn: key } }, key) : e));
}

// Put someone back as they were before the fight. `parts` picks what:
//   hp     full HP, no temporary HP
//   uses   every charge, slot and legendary action back
//   fight  no conditions, not concentrating, reaction back
// Their initiative stays.
export async function resetCreature(campaignName, encounterId, c, parts = { hp: true, uses: true, fight: true }) {
  if (parts.fight) setFight(campaignName, encounterId, c.key, { conditions: [], concentration: null, reaction: false });
  if (!c.base || (!parts.hp && !parts.uses)) return { ok: true };
  let base = c.base;
  if (parts.hp) base = fullHp(c);
  if (parts.uses) base = restoreUses({ ...c, base });
  return saveCreature(campaignName, encounterId, c, base);
}

// A creature's own statblock changed (HP, uses, templates…): monsters
// live in the encounter, party members and NPCs in the campaign.
// `data` is always the creature's own (base) version, never the one with
// templates worked in.
export async function saveCreature(campaignName, encounterId, combatant, data) {
  if (combatant.kind === "monster") {
    change(campaignName, encounterId, (e) => ({ ...e, monsters: asList(e.monsters).map((m) => (m.id === combatant.base.id ? data : m)) }));
    return { ok: true };
  }
  return useCampaignStore.getState().saveCampaignCharacter(campaignName, combatant.kind, combatant.card.file, data);
}