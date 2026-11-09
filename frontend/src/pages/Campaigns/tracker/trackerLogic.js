import { afterDamage } from "../../../components/dice/groupRollHelper";
import { CONDITION_OPTIONS } from "../../../utils/Constants";
import { effectiveMaxHp, healthOf, initiativeTotal } from "../../Characters/sheet/play/playHelpers";
import { CHARACTER_ACTIONS, characterView } from "../statblock/characterStatblock";
import { MONSTER_ACTIONS, hpCurOf, hpMaxOf, initiativeOf, monsterView } from "../statblock/monsterStatblock";
import { applyTemplates, givenTemplates, resolveTemplates } from "../templates/templateLogic";

/* ═══════════════════════════════════════════════════════════════════
   trackerLogic.js — the rules of a fight, with no screen or server.

   A fight lives on its encounter as `combat` (absent = not running):

     combat: {
       round: 1,
       turn:  "<key>" | null,            whose turn it is
       combatants: {
         "<key>": {
           initiative: 17 | null,
           conditions: ["prone", …],
           concentration: "Bless" | null,
           reaction: false,              true = used this round
         }
       }
     }

   Keys: "party:Mira.json", "npc:Captain Vos.json", "monster:<id>".
   Everyone in the encounter is in the fight; this only holds what the
   fight adds. HP, uses and slots stay on the creature itself (the
   campaign copy for party/NPCs, the encounter's copy for monsters).

   A combatant has two versions of its creature:
     base  what is saved (the creature's own statblock)
     data  what you see: base with its templates on (templateLogic)
   Reading uses `data`; every change is written onto `base`.
   ═══════════════════════════════════════════════════════════════════ */

const asList = (v) => (Array.isArray(v) ? v : []);
const toInt = (v, fallback = 0) => {
  if (v === "" || v == null) return fallback;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
};

export const CONDITIONS = CONDITION_OPTIONS.map((c) => c.toLowerCase());

export const memberKey = (m) => `${m.kind}:${m.file}`;
export const monsterKey = (m) => `monster:${m.id}`;

const KIND_ORDER = { party: 0, npc: 1, monster: 2 };

/* ─── who is in the fight ────────────────────────────────────────── */

// Everyone in the encounter, with their creature data and fight state.
//   copies:    { party: [{ file, data }], npc: [...] } from the campaign store
//   templates: every template this campaign can use (for `data`)
export function combatantsOf(encounter, copies, templates = [], groups = []) {
  const state = encounter?.combat?.combatants || {};
  const members = asList(encounter?.members).map((m) => {
    const copy = asList(copies[m.kind]).find((c) => c.file === m.file);
    return {
      key: memberKey(m),
      kind: m.kind,
      name: copy?.data?.name || m.file.replace(/\.json$/, ""),
      data: copy?.data,
      missing: !copy,
      card: { kind: m.kind, file: m.file },
      member: m,
    };
  });
  const monsters = asList(encounter?.monsters).map((m) => ({
    key: monsterKey(m),
    kind: "monster",
    name: m.name || "Monster",
    data: m,
    missing: false,
    card: { kind: "encounter", encounterId: encounter.id, monsterId: m.id },
  }));
  return [...members, ...monsters].map((c) => {
    const given = givenTemplates(c.data, c.member, groups);
    const data = c.data ? applyTemplates(c.kind, c.data, resolveTemplates(c.data, templates, given)) : c.data;
    return { ...c, base: c.data, data, given, name: data?.name || c.name, fight: { conditions: [], concentration: null, reaction: false, initiative: null, ...(state[c.key] || {}) } };
  });
}

/* ─── numbers we need from either kind of creature ───────────────── */

export const dexScore = (c) => toInt(c.data?.ability_scores?.dex?.score, 10);

export const initiativeBonus = (c) => (!c.data ? 0 : c.kind === "monster" ? initiativeOf(c.data) : initiativeTotal(c.data));

export function hpOf(c) {
  if (!c.data) return { cur: 0, max: 0, temp: 0 };
  if (c.kind === "monster") return { cur: hpCurOf(c.data), max: hpMaxOf(c.data), temp: toInt(c.data.hp_temp, 0) };
  const h = healthOf(c.data);
  return { cur: toInt(h.current_hp, 0), max: effectiveMaxHp(h), temp: toInt(h.temp_hp, 0) };
}

export const acOf = (c) => (!c.data ? null : c.kind === "monster" ? toInt(asList(c.data.ac)[0]?.value, null) : toInt(c.data.ac, null));

// Write HP back in the creature's own layout.
// `cur` is what you see; templates may add HP on top (`_hp_delta`), so the
// creature's own number is that much lower.
function withHp(c, { cur, temp }) {
  const base = c.base ?? c.data;
  const own = cur - toInt(c.data?._hp_delta, 0);
  if (c.kind === "monster") return { ...base, hp_current: own, hp_temp: temp };
  return { ...base, health: { ...healthOf(base), current_hp: own, temp_hp: temp } };
}

// Damage takes temporary HP first (afterDamage, shared with the dice
// tower's previews). Returns the new data and, if they were
// concentrating, the DC of the Constitution save they now need.
export function damage(c, amount) {
  const hp = hpOf(c);
  const next = afterDamage(hp, amount);
  return {
    data: withHp(c, next),
    concentrationDc: c.fight.concentration && amount > 0 ? Math.min(30, Math.max(10, Math.floor(amount / 2))) : null,
    dropped: hp.cur > 0 && next.cur === 0,
  };
}

export const heal = (c, amount) => {
  const hp = hpOf(c);
  return withHp(c, { cur: Math.min(hp.max || Infinity, hp.cur + amount), temp: hp.temp });
};

// Temporary HP don't stack: the higher number stays.
export const giveTemp = (c, amount) => {
  const hp = hpOf(c);
  return withHp(c, { cur: hp.cur, temp: Math.max(hp.temp, amount) });
};

// Back to full HP, no temporary HP.
export const fullHp = (c) => withHp(c, { cur: hpOf(c).max, temp: 0 });
// (hpOf reads `data`, so "full" includes HP that templates add.)

// Every use back: charges, legendary actions, spell uses, spell slots,
// sorcery points. Done through the statblock's own view and actions, so it
// refills exactly the dots the card shows (hidden rows included).
export function restoreUses(c) {
  const base = c.base ?? c.data;
  if (!base) return base;
  const [view, actions] = c.kind === "monster" ? [monsterView(base, { editing: true }), MONSTER_ACTIONS] : [characterView(base, { editing: true }), CHARACTER_ACTIONS];
  // Rows from templates keep their uses apart; forgetting them fills them.
  let out = { ...base, template_uses: {} };
  const fill = (ref, uses) => {
    if (ref && uses && uses.cur < uses.max) out = actions.setUses(out, ref, uses.max);
  };
  for (const s of asList(view.sections)) {
    asList(s.entries).forEach((e) => fill(e.ref, e.uses));
    if (s.pool) fill(s.pool.ref, s.pool);
  }
  const sc = view.spellcasting || {};
  if (sc.kind === "groups") {
    asList(sc.blocks).forEach((b) => asList(b.groups).forEach((g) => {
      fill(g.ref, g.uses);
      asList(g.spells).forEach((sp) => fill(sp.ref, sp.uses));
    }));
  } else {
    asList(sc.slots).forEach((sl) => fill(sl.ref, sl));
    if (sc.sorcery) fill({ list: "sorcery" }, sc.sorcery);
    asList(sc.lists).forEach((l) => asList(l.spells).forEach((sp) => fill(sp.ref, sp.uses)));
  }
  return out;
}

// "bloodied" at half HP or less, then "down" (people) or "dead" (monsters).
export function healthWord(c) {
  const { cur, max } = hpOf(c);
  if (!c.data) return "";
  if (cur <= 0) return c.kind === "monster" ? "dead" : "down";
  return max > 0 && cur <= max / 2 ? "bloodied" : "";
}

const isDead = (c) => c.kind === "monster" && c.data && hpOf(c).cur <= 0;

/* ─── initiative ─────────────────────────────────────────────────── */

const d = (sides) => 1 + Math.floor(Math.random() * sides);

// A d20 plus their bonus; monsters with advantage on initiative roll twice.
export function rollInitiative(c) {
  const adv = c.kind === "monster" && !!c.data?.initiative?.advantage;
  const die = adv ? Math.max(d(20), d(20)) : d(20);
  return die + initiativeBonus(c);
}

// Highest first. Ties: higher DEX score, then party before NPCs before
// monsters, then by name so the order never jumps around.
export function ordered(combatants) {
  return [...combatants].sort((a, b) => {
    const ai = a.fight.initiative;
    const bi = b.fight.initiative;
    if (ai == null || bi == null) {
      if (ai == null && bi == null) return a.name.localeCompare(b.name);
      return ai == null ? 1 : -1;
    }
    return bi - ai || dexScore(b) - dexScore(a) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name);
  });
}

// Two or more on the same number, decided by the tie rules above.
export function tiedKeys(list) {
  const out = new Set();
  list.forEach((c, i) => {
    const n = list[i + 1];
    if (n && c.fight.initiative != null && c.fight.initiative === n.fight.initiative) {
      out.add(c.key);
      out.add(n.key);
    }
  });
  return out;
}

/* ─── turns ──────────────────────────────────────────────────────── */

// The next one in order who can act (dead monsters are skipped); going
// past the bottom starts a new round.
export function nextTurn(list, turn, round) {
  const alive = list.filter((c) => !isDead(c));
  if (!alive.length) return { turn: null, round };
  const at = list.findIndex((c) => c.key === turn);
  for (let i = 1; i <= list.length; i += 1) {
    const idx = at + i;
    const c = list[idx % list.length];
    if (!isDead(c)) return { turn: c.key, round: round + (at === -1 ? 0 : Math.floor(idx / list.length)) };
  }
  return { turn: alive[0].key, round };
}

export function previousTurn(list, turn, round) {
  const at = list.findIndex((c) => c.key === turn);
  if (at === -1) return { turn: list[0]?.key ?? null, round };
  for (let i = 1; i <= list.length; i += 1) {
    const idx = at - i;
    const c = list[(idx + list.length * 2) % list.length];
    if (!isDead(c)) return { turn: c.key, round: Math.max(1, round - (idx < 0 ? 1 : 0)) };
  }
  return { turn, round };
}

// What happens to a monster as its turn starts: legendary actions come
// back, and each "Recharge 5–6" that is spent rolls a d6.
// Returns { data, notes: ["Fire Breath recharged (rolled 6)", …] }.
// (Rows a template gives recharge too; their uses live in template_uses.)
export function startOfTurn(c) {
  const base = c.base ?? c.data;
  if (c.kind !== "monster" || !base) return { data: base, notes: [] };
  const notes = [];
  const templateUses = { ...(base.template_uses || {}) };
  for (const block of Object.values(c.data.effects || {})) {
    for (const it of asList(block?.items)) {
      const ch = it?.charges;
      if (!it?.from_template || !ch || ch.reset_type !== "recharge_dice") continue;
      const max = toInt(ch.max_charges ?? 1, 1);
      if (toInt(ch.current_charges, max) >= max) continue;
      const roll = d(6);
      if (roll < toInt(ch.recharge_dice, 6)) notes.push(`${it.name} didn't recharge (rolled ${roll})`);
      else {
        notes.push(`${it.name} recharged (rolled ${roll})`);
        delete templateUses[it.id];
      }
    }
  }
  const effects = {};
  for (const [key, block] of Object.entries(base.effects || {})) {
    effects[key] = {
      ...block,
      items: asList(block?.items).map((it) => {
        const ch = it?.charges;
        if (!ch || ch.reset_type !== "recharge_dice") return it;
        const max = toInt(ch.max_charges ?? 1, 1);
        if (toInt(ch.current_charges, max) >= max) return it;
        const roll = d(6);
        const need = toInt(ch.recharge_dice, 6);
        if (roll < need) {
          notes.push(`${it.name} didn't recharge (rolled ${roll})`);
          return it;
        }
        notes.push(`${it.name} recharged (rolled ${roll})`);
        return { ...it, charges: { ...ch, current_charges: max } };
      }),
    };
  }
  const data = { ...base, effects, template_uses: templateUses };
  const lap = base.legendary_action_points;
  if (lap?.legendary_actions != null) data.legendary_action_points = { ...lap, current: toInt(lap.legendary_actions, 0) };
  return { data, notes };
}

export const blankFight = () => ({ conditions: [], concentration: null, reaction: false, initiative: null });