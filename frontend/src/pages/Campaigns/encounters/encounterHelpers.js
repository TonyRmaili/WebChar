import { crStats, formatCR } from "../../Catalogues/Monsters/monsterHelpers";
import { newId } from "../../../utils/featureRuntime";
import { currentHp, derivedOf } from "../../../utils/derive";
import { prepareMonster } from "../statblock/monsterStatblock";

/* Pure logic for encounters: the creatures in them and their XP. Shape: claude/encounters-contract.md in the project. */

const asList = (v) => (Array.isArray(v) ? v : []);
const toInt = (v, fallback = 0) => {
  if (v === "" || v == null) return fallback;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
};

/* ─── monsters in an encounter ───────────────────────────────────── */

// A monster ready for a fight: full HP, every use back, nothing left from
// an earlier fight. Hidden rows and the DM's notes on it are kept.
// (No uses_left anywhere means every use is there.)
function freshForFight(m) {
  const out = {
    ...m,
    features: asList(m.features).map(({ uses_left, ...f }) => f),
    hp_current: Math.max(0, toInt(m.hp?.average, 0)),
    hp_temp: 0,
    template_uses: {},
  };
  if (asList(m.spellcasting).length) {
    out.spellcasting = m.spellcasting.map((b) => ({
      ...b,
      groups: asList(b.groups).map(({ uses_left, ...g }) => ({ ...g, spells: asList(g.spells).map(({ uses_left: _u, ...s }) => s) })),
    }));
  }
  if (m.legendary_actions?.uses) out.legendary_actions = { ...m.legendary_actions, left: m.legendary_actions.uses };
  return out;
}

// Names for new creatures, so three goblins become "Goblin 1", "Goblin 2"…
// A single one keeps the plain name unless that name is already taken.
// If a plain "Goblin" is already there, the numbers start at 2.
export function nextNames(taken, base, count) {
  const used = new Set(taken);
  const hasNumbered = [...used].some((n) => n.startsWith(`${base} `) && /^\d+$/.test(n.slice(base.length + 1)));
  if (count === 1 && !used.has(base) && !hasNumbered) return [base];
  const out = [];
  let n = used.has(base) ? 2 : 1;
  while (out.length < count) {
    const name = `${base} ${n}`;
    if (!used.has(name)) out.push(name);
    n += 1;
  }
  return out;
}

// `count` new monsters for an encounter, from a shelf entry ({ file, data })
// or straight from the catalogue (a catalogue entry).
export function monstersFor(encounter, source, count, from) {
  const base = from === "shelf" ? freshForFight(stripCampaignBits(source.data)) : prepareMonster(source);
  const names = nextNames(asList(encounter.monsters).map((m) => m.name), base.name || "Monster", count);
  return names.map((name) => ({
    ...structuredClone(base),
    id: newId(),
    name,
    shelf: from === "shelf" ? source.file : null,
  }));
}

const stripCampaignBits = ({ _added, ...rest }) => rest;

/* ─── XP and difficulty ──────────────────────────────────────────── */

export const monsterXp = (m) => {
  const xp = toInt(m?.cr?.xp, NaN);
  return Number.isFinite(xp) ? xp : crStats(m?.cr?.cr)?.xp ?? 0;
};

export const totalXp = (encounter) => asList(encounter.monsters).reduce((sum, m) => sum + monsterXp(m), 0);

// What the DM gives out: the monsters' total, unless they set their own.
export const awardedXp = (encounter) => {
  const o = encounter?.xp?.override;
  return o == null || o === "" ? totalXp(encounter) : toInt(o, 0);
};

/* ─── short lines ────────────────────────────────────────────────── */

// A character (version-2 file): its numbers are worked out, never stored.
export const characterLine = (c) => {
  const d = derivedOf(c);
  if (!d) return "";
  const classes = d.classes.map((k) => `${k.name} ${k.level}`).join(" / ");
  return [classes, `HP ${currentHp(c, d.hp_max)}/${d.hp_max}`, `AC ${d.ac}`].filter(Boolean).join(" · ");
};

export const monsterLine = (m) => {
  const ac = toInt(asList(m?.ac)[0]?.value, NaN);
  return [formatCR(m), `HP ${toInt(m?.hp_current, toInt(m?.hp?.average, 0))}/${toInt(m?.hp?.average, 0)}`, Number.isFinite(ac) ? `AC ${ac}` : ""].filter(Boolean).join(" · ");
};

// The start of the notes, for the encounter's line in the list.
export const notesSnippet = (encounter, length = 120) => {
  const text = String(encounter?.notes || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
};

export const fmt = (n) => new Intl.NumberFormat("en-US").format(n);

/* ─── loot ───────────────────────────────────────────────────────── */

// The encounter with one more of a catalogue item ({ name, source }) in its
// loot: the same item again only counts up. Used by the rewards and by
// tables ("Add to the loot of …").
export function withLootItem(encounter, entry) {
  const loot = encounter.loot || {};
  const items = asList(loot.items);
  const same = items.find((it) => it.name === entry.name && (it.source ?? null) === (entry.source ?? null));
  return {
    ...encounter,
    loot: {
      ...loot,
      items: same
        ? items.map((it) => (it === same ? { ...it, quantity: (Number(it.quantity) || 1) + 1 } : it))
        : [...items, { id: newId(), name: entry.name, source: entry.source ?? null, quantity: 1 }],
    },
  };
}