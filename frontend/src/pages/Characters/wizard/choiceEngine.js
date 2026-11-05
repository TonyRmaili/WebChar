/* ═══════════════════════════════════════════════════════════════════
   choiceEngine.js — one choice model, many sources.

   Races and backgrounds describe themselves with different schemas:

     RACE                                BACKGROUND
     abilities.fixed / .choose           ability_score_increase: [3 abils]
     proficiencies.skills.choose.options skill_proficiencies.choose.from
     proficiencies.tools / .languages    tool_ / language_proficiencies
     sub_races[]                         starting_equipment[] A/B branches
                                         feats[]

   Both are flattened into one Choice shape so the UI, the summary and
   the overlap detector never branch on where a choice came from.
   Adding classes later means writing one more adapter, nothing else.

   ── Choice ──────────────────────────────────────────────────────────
   {
     id       stable unique string, e.g. "bg.prof.tools"
     scope    "race" | "background"
     kind     "subrace" | "ability" | "asi" | "proficiency" | "equipment"
     family   "skills" | "tools" | "languages" | ... | null
     count    how many must be picked
     amount   ability bonus per pick (kind: "ability")
     options  [{ value, label, family }]
     owner    display name of the granting entity
     inferred true when promoted from a lossy `fixed` slot
     branches equipment only: [{ key, label, items }]
   }

   ── Selection ───────────────────────────────────────────────────────
   choiceSel[choice.id] is an array of option values, EXCEPT for
   kind:"asi" which is { mode: "2-1" | "1-1-1", picks: [] }.
   Use isResolved()/selectedValues() rather than touching it directly.
   ═══════════════════════════════════════════════════════════════════ */

import {
  TOOL_OPTIONS,
  WEAPON_OPTIONS,
  ARMOR_OPTIONS,
  PC_LANGUAGE_OPTIONS,
  TOOL_CATEGORY_TOKENS,
  LANGUAGE_CATEGORY_TOKENS,
  EQUIPMENT_GRANTED_KEY,
} from "../../../utils/Constants";

import {
  ALL_SKILL_KEYS,
  normSkill, skillLabel,
  normTool, toolLabel,
  normLang, langLabel,
  normWeapon, normArmor,
  titleCase, stripSource, formatGp, gpFromCp,
} from "./wizardHelpers";

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

const ABILITY_LABELS = {
  str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
};

/* ═══════════ token expansion ═══════════ */

export const opt = (value, label, family) => ({ value, label, family });

const skillPool = (keys = ALL_SKILL_KEYS) =>
  keys.map((k) => opt(normSkill(k), skillLabel(k), "skills"));
const toolPool = (list = TOOL_OPTIONS) =>
  list.map((t) => opt(normTool(t), toolLabel(t), "tools"));
const langPool = (list = PC_LANGUAGE_OPTIONS) =>
  list.map((l) => opt(normLang(l), langLabel(l), "languages"));
const weaponPool = () =>
  WEAPON_OPTIONS.map((w) => opt(normWeapon(w), titleCase(w), "weapons"));
const armorPool = () =>
  ARMOR_OPTIONS.map((a) => opt(normArmor(a), titleCase(a), "armor"));

const WHOLE_FAMILY = {
  skills: skillPool,
  tools: toolPool,
  languages: langPool,
  weapons: weaponPool,
  armor: armorPool,
};

const lower = (t) => String(t || "").toLowerCase().trim();

/**
 * True when `token` names a whole category rather than one concrete
 * proficiency. Used both to expand choose-pools and to detect a lossy
 * `fixed` slot — Carouser/ABH lists "gaming set" as always-granted when
 * its own text says "choose one kind of Gaming Set".
 */
export function isCategoryToken(token, family) {
  const t = lower(token);
  if (t.startsWith("any")) return true;
  if (t === "other") return true;
  if (family === "tools") return !!TOOL_CATEGORY_TOKENS[t];
  if (family === "languages") return !!LANGUAGE_CATEGORY_TOKENS[t];
  return false;
}

/**
 * Expand one token into concrete options.
 * `family` is the group the token was declared under, but cross-family
 * tokens ("any_tool" inside a skills group) win over it — that is how
 * Nephalia Human's "four skills or tools" is expressed.
 */
export function expandToken(token, family) {
  const t = lower(token);

  // cross-family tokens — these ignore the declared group
  if (t === "any_skill") return skillPool();
  if (t === "any_tool") return toolPool();
  if (t === "any_weapon") return weaponPool();
  if (t === "any_armor") return armorPool();
  if (t === "any_standard") return langPool(LANGUAGE_CATEGORY_TOKENS.standard);
  if (t === "any_language") return langPool(PC_LANGUAGE_OPTIONS);

  // family-scoped category names
  if (family === "tools" && TOOL_CATEGORY_TOKENS[t]) return toolPool(TOOL_CATEGORY_TOKENS[t]);
  if (family === "languages" && LANGUAGE_CATEGORY_TOKENS[t]) return langPool(LANGUAGE_CATEGORY_TOKENS[t]);

  // bare "any"/"other" → the whole declared family
  if (t === "any" || t === "other") return (WHOLE_FAMILY[family] || skillPool)();

  // literal
  switch (family) {
    case "skills": return [opt(normSkill(t), skillLabel(t), "skills")];
    case "tools": return [opt(normTool(t), toolLabel(t), "tools")];
    case "languages": return [opt(normLang(t), langLabel(t), "languages")];
    case "weapons": return [opt(normWeapon(t), titleCase(t), "weapons")];
    case "armor": return [opt(normArmor(t), titleCase(t), "armor")];
    default: return [opt(t, titleCase(t), family || "misc")];
  }
}

/** Expand a token list into a de-duplicated option pool. */
export function expandTokens(tokens, family) {
  const list = tokens == null ? ["any"] : Array.isArray(tokens) ? tokens : [tokens];
  const out = [];
  const seen = new Set();
  for (const tok of list) {
    for (const o of expandToken(tok, family)) {
      const k = `${o.family}:${o.value}`;
      if (!seen.has(k)) { seen.add(k); out.push(o); }
    }
  }
  return out;
}

/* ═══════════ equipment parsing ═══════════ */

/**
 * One element of a starting_equipment branch. The data mixes six
 * shapes, and the old formatEquipment() in BackgroundPopup handled
 * only two of them — which is why XPHB backgrounds (the default
 * filter!) rendered an empty Equipment row.
 */
/* Placeholders that stand in for "an item of this category". Class kits use
   weaponMartial/weaponSimple; backgrounds use toolArtisan. */
export const EQUIPMENT_TYPE_LABELS = {
  toolArtisan: "Artisan's Tools (as chosen)",
  weaponMartial: "Martial Weapon (your choice)",
  weaponSimple: "Simple Weapon (your choice)",
  weaponMartialMelee: "Martial Melee Weapon (your choice)",
  instrumentMusical: "Musical Instrument (your choice)",
  setGaming: "Gaming Set (your choice)",
};

export function parseEquipItem(el) {
  if (el == null) return null;

  // "dagger|xphb"
  if (typeof el === "string") {
    const id = stripSource(el);
    return { id, label: titleCase(id), family: "equipment" };
  }

  // { value: 5000 } — raw coin, XPHB style
  if (el.value != null && el.item == null && el.special == null) {
    return { id: `gold:${el.value}`, label: formatGp(el.value), family: "equipment", gp: gpFromCp(el.value) };
  }

  // { equipmentType: "toolArtisan" } — a placeholder meaning "the thing you
  // chose above", or a category the player still has to pick from.
  if (el.equipmentType) {
    const qty = el.quantity && el.quantity > 1 ? ` ×${el.quantity}` : "";
    return {
      id: `type:${lower(el.equipmentType)}`,
      label: `${EQUIPMENT_TYPE_LABELS[el.equipmentType] || titleCase(el.equipmentType)}${qty}`,
      family: "equipment",
      linked: true,
      equipmentType: el.equipmentType,
      quantity: el.quantity ?? 1,
    };
  }

  // { item: "pouch|phb", containsValue: 1500 }
  if (el.item) {
    const id = stripSource(el.item);
    const qty = el.quantity && el.quantity > 1 ? ` ×${el.quantity}` : "";
    if (el.containsValue != null) {
      return {
        id, family: "equipment", gp: gpFromCp(el.containsValue),
        label: `${titleCase(el.displayName || id)} (${formatGp(el.containsValue)})`,
      };
    }
    return { id, family: "equipment", label: `${titleCase(el.displayName || id)}${qty}` };
  }

  // { special: "vestments", quantity: 5 }
  if (el.special) {
    const qty = el.quantity && el.quantity > 1 ? ` ×${el.quantity}` : "";
    return { id: `special:${lower(el.special)}`, family: "equipment", label: `${titleCase(el.special)}${qty}` };
  }

  return null;
}

const parseBranch = (arr) => (Array.isArray(arr) ? arr.map(parseEquipItem).filter(Boolean) : []);

/**
 * starting_equipment is an array of GROUPS. A group keyed "_" is always
 * granted; any other key is one branch of a pick-one choice. Casing is
 * inconsistent across books (XPHB uses "A"/"B", EFA and ABH use
 * "a"/"b") and Charlatan/PHB has four branches a–d. Athlete/MOT has two
 * independent a/b groups, so groups are indexed, not merged.
 */
export function parseStartingEquipment(startingEquipment) {
  const granted = [];
  const choiceGroups = [];

  const groups = Array.isArray(startingEquipment) ? startingEquipment : [];
  groups.forEach((group, gi) => {
    if (!group || typeof group !== "object") return;
    const keys = Object.keys(group);

    for (const key of keys) {
      if (key === EQUIPMENT_GRANTED_KEY) {
        granted.push(...parseBranch(group[key]));
      }
    }

    const branchKeys = keys.filter((k) => k !== EQUIPMENT_GRANTED_KEY);
    if (branchKeys.length > 1) {
      choiceGroups.push({
        index: gi,
        branches: branchKeys
          .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
          .map((k) => ({
            key: k.toUpperCase(),
            items: parseBranch(group[k]),
          })),
      });
    } else if (branchKeys.length === 1) {
      // a single lettered branch with no alternative is just a grant
      granted.push(...parseBranch(group[branchKeys[0]]));
    }
  });

  return { granted, choiceGroups };
}

const branchSummary = (items) =>
  items.length ? items.map((i) => i.label).join(", ") : "Nothing";

/* ═══════════ adapters ═══════════ */

/**
 * RACE → choices.
 * Subrace resolves first; deeper choices are hidden until it is picked,
 * because a subrace can add its own ability and proficiency choices.
 */
export function raceChoices(race, subrace) {
  if (!race) return [];
  const out = [];
  const hasSub = Array.isArray(race.sub_races) && race.sub_races.length > 0;

  if (hasSub) {
    out.push({
      id: "race.subrace", scope: "race", kind: "subrace",
      family: null, count: 1, options: [], owner: race.name,
    });
    if (!subrace) return out;
  }

  const sources = subrace ? [race, subrace] : [race];
  sources.forEach((obj, i) => {
    const prefix = i === 1 ? "race.sub" : "race";
    const owner = obj?.display_name || obj?.name;

    if (obj?.abilities?.choose) {
      const c = obj.abilities.choose;
      const tokens = c.options && c.options !== "any"
        ? (Array.isArray(c.options) ? c.options : [c.options])
        : ABILITIES;
      out.push({
        id: `${prefix}.abilities`, scope: "race", kind: "ability", family: "abilities",
        count: c.count ?? 1, amount: c.amount ?? 1, owner,
        options: tokens.map((v) => opt(v, ABILITY_LABELS[v] || String(v).toUpperCase(), "abilities")),
      });
    }

    const prof = obj?.proficiencies || {};
    for (const [family, grp] of Object.entries(prof)) {
      if (!grp) continue;

      // lossy `fixed`: a category sitting where a concrete value belongs
      (grp.fixed || []).forEach((tok, fi) => {
        if (!isCategoryToken(tok, family)) return;
        out.push({
          id: `${prefix}.prof.${family}.inferred.${fi}`, scope: "race", kind: "proficiency",
          family, count: 1, owner, inferred: true, inferredFrom: tok,
          options: expandTokens([tok], family),
        });
      });

      if (grp.choose) {
        out.push({
          id: `${prefix}.prof.${family}`, scope: "race", kind: "proficiency",
          family, count: grp.choose.count ?? 1, owner,
          options: expandTokens(grp.choose.options, family),
        });
      }
    }
  });

  return out;
}

const BG_PROF_FAMILIES = [
  ["skill_proficiencies", "skills"],
  ["tool_proficiencies", "tools"],
  ["language_proficiencies", "languages"],
  ["weapon_proficiencies", "weapons"],
  ["armor_proficiencies", "armor"],
];

/** BACKGROUND → choices. */
export function backgroundChoices(background) {
  if (!background) return [];
  const out = [];
  const owner = background.name;

  // ability score increase — 2024 backgrounds list three abilities and
  // the player takes +2/+1 across two of them, or +1 to all three.
  const asi = Array.isArray(background.ability_score_increase)
    ? background.ability_score_increase.filter(Boolean)
    : [];
  if (asi.length) {
    out.push({
      id: "bg.asi", scope: "background", kind: "asi", family: "abilities",
      count: 2, owner,
      options: asi.map((a) => opt(lower(a), ABILITY_LABELS[lower(a)] || String(a).toUpperCase(), "abilities")),
    });
  }

  for (const [key, family] of BG_PROF_FAMILIES) {
    const grp = background[key];
    if (!grp) continue;

    (grp.fixed || []).forEach((tok, fi) => {
      if (!isCategoryToken(tok, family)) return;
      out.push({
        id: `bg.prof.${family}.inferred.${fi}`, scope: "background", kind: "proficiency",
        family, count: 1, owner, inferred: true, inferredFrom: tok,
        options: expandTokens([tok], family),
      });
    });

    if (grp.choose) {
      out.push({
        id: `bg.prof.${family}`, scope: "background", kind: "proficiency",
        family, count: grp.choose.count ?? 1, owner,
        options: expandTokens(grp.choose.from ?? grp.choose.options, family),
      });
    }
  }

  const { choiceGroups } = parseStartingEquipment(background.starting_equipment);
  choiceGroups.forEach((g) => {
    out.push({
      id: `bg.equipment.${g.index}`, scope: "background", kind: "equipment",
      family: "equipment", count: 1, owner,
      branches: g.branches.map((b) => ({ ...b, summary: branchSummary(b.items) })),
      options: g.branches.map((b) => opt(b.key, `${b.key}: ${branchSummary(b.items)}`, "equipment")),
    });
  });

  return out;
}

/* ═══════════ selection state ═══════════ */

export const DEFAULT_ASI_MODE = "2-1";

export const emptySelection = (choice) =>
  choice.kind === "asi" ? { mode: DEFAULT_ASI_MODE, picks: [] } : [];

/* ASI picks are positional — [ +2 ability, +1 ability ] — and a slot
   may be null while the other is filled, so never trust `.length`. */
const asiPicks = (sel) => (sel?.picks || []).filter(Boolean);

/** Values the player has actually committed to, as a flat array. */
export function selectedValues(choice, sel) {
  if (!choice) return [];
  if (choice.kind === "asi") {
    const s = sel || emptySelection(choice);
    return s.mode === "1-1-1" ? choice.options.map((o) => o.value) : asiPicks(s);
  }
  return Array.isArray(sel) ? sel : [];
}

export function isResolved(choice, sel, subrace) {
  if (!choice) return true;
  if (choice.kind === "subrace") return !!subrace;
  // Subclass lives on the class entry, not in choiceSel — the adapter only
  // emits this choice once the class level has reached the unlock level, and
  // stamps `satisfied` when a subclass is already picked.
  if (choice.kind === "subclass") return !!choice.satisfied;
  if (choice.kind === "asi") {
    const s = sel || emptySelection(choice);
    return s.mode === "1-1-1" ? true : asiPicks(s).length === 2;
  }
  return selectedValues(choice, sel).length >= choice.count;
}

export function remainingFor(choice, sel) {
  if (choice.kind === "asi") {
    const s = sel || emptySelection(choice);
    return s.mode === "1-1-1" ? 0 : Math.max(0, 2 - asiPicks(s).length);
  }
  return Math.max(0, choice.count - selectedValues(choice, sel).length);
}

/** Ability deltas produced by a resolved ASI choice. */
export function asiBonuses(choice, sel) {
  const s = sel || emptySelection(choice);
  const out = {};
  if (s.mode === "1-1-1") {
    choice.options.forEach((o) => { out[o.value] = (out[o.value] || 0) + 1; });
    return out;
  }
  const [first, second] = s.picks || [];
  if (first) out[first] = (out[first] || 0) + 2;
  if (second) out[second] = (out[second] || 0) + 1;
  return out;
}

/* ═══════════ grants ═══════════ */

const emptyGrants = () => ({
  abilities: {},
  skills: [], tools: [], languages: [], weapons: [], armor: [],
  feats: [], equipment: [], traits: [],
  speed: null, senses: null,
});

const pushGrant = (list, value, family, owner, scope, viaChoice = null) => {
  list.push({ value, family, owner, scope, viaChoice });
};

/**
 * Everything the character has actually been given — fixed grants plus
 * resolved choices — from every source, tagged with who granted it.
 * The owner tags are what make overlap detection possible.
 */
export function collectGrants({
  race, subrace, background,
  choices = [], choiceSel = {},
  /* Pre-normalized grant entries from sources this module doesn't know how to
     read — currently classes. Keeps the dependency one-way: classEngine
     imports from here, never the reverse. */
  extraFixed = [],
}) {
  const g = emptyGrants();

  for (const e of extraFixed) {
    const bucket = g[e.family];
    if (Array.isArray(bucket)) bucket.push(e);
    else if (e.family === "abilities") g.abilities[e.value] = (g.abilities[e.value] || 0) + (e.amount || 0);
  }

  /* ── race + subrace fixed ── */
  const raceSources = [
    race ? { obj: race, owner: race.name } : null,
    subrace ? { obj: subrace, owner: subrace.display_name || subrace.name } : null,
  ].filter(Boolean);

  for (const { obj, owner } of raceSources) {
    if (obj.abilities?.fixed) {
      for (const [k, v] of Object.entries(obj.abilities.fixed)) {
        if (v != null) g.abilities[k] = (g.abilities[k] || 0) + v;
      }
    }
    const prof = obj.proficiencies || {};
    for (const [family, grp] of Object.entries(prof)) {
      if (!grp || !g[family]) continue;
      (grp.fixed || []).forEach((tok) => {
        if (isCategoryToken(tok, family)) return; // promoted to a choice instead
        const [o] = expandToken(tok, family);
        if (o) pushGrant(g[o.family] || g[family], o.value, o.family, owner, "race");
      });
    }
    (obj.traits || []).forEach((t) => g.traits.push({ ...t, owner }));
    if (obj.speed) g.speed = obj.speed;
    if (obj.senses) g.senses = obj.senses;
  }

  /* ── background fixed ── */
  if (background) {
    const owner = background.name;
    for (const [key, family] of BG_PROF_FAMILIES) {
      const grp = background[key];
      if (!grp) continue;
      (grp.fixed || []).forEach((tok) => {
        if (isCategoryToken(tok, family)) return;
        const [o] = expandToken(tok, family);
        if (o) pushGrant(g[o.family] || g[family], o.value, o.family, owner, "background");
      });
    }
    (background.feats || []).forEach((f) =>
      pushGrant(g.feats, String(f).toLowerCase(), "feats", owner, "background")
    );
    const { granted } = parseStartingEquipment(background.starting_equipment);
    granted.forEach((item) =>
      g.equipment.push({ value: item.id, family: "equipment", owner, scope: "background", label: item.label, gp: item.gp })
    );
  }

  /* ── resolved choices ── */
  for (const c of choices) {
    const sel = choiceSel[c.id];
    if (c.kind === "subrace" || c.kind === "subclass") continue;

    if (c.kind === "asi") {
      for (const [k, v] of Object.entries(asiBonuses(c, sel))) {
        g.abilities[k] = (g.abilities[k] || 0) + v;
      }
      continue;
    }

    if (c.kind === "ability") {
      selectedValues(c, sel).forEach((v) => {
        g.abilities[v] = (g.abilities[v] || 0) + (c.amount ?? 1);
      });
      continue;
    }

    if (c.kind === "equipment") {
      const key = selectedValues(c, sel)[0];
      const branch = (c.branches || []).find((b) => b.key === key);
      (branch?.items || []).forEach((item) =>
        g.equipment.push({ value: item.id, family: "equipment", owner: c.owner, scope: c.scope, label: item.label, gp: item.gp, viaChoice: c.id })
      );
      continue;
    }

    // proficiency
    selectedValues(c, sel).forEach((v) => {
      const o = (c.options || []).find((x) => x.value === v);
      const family = o?.family || c.family;
      if (!g[family]) return;
      pushGrant(g[family], v, family, c.owner, c.scope, c.id);
    });
  }

  return g;
}

/* ═══════════ labels ═══════════ */

const FAMILY_TITLES = {
  skills: "Skills", tools: "Tools", languages: "Languages",
  weapons: "Weapons", armor: "Armor", abilities: "Ability Scores",
};

export function choiceTitle(choice) {
  switch (choice.kind) {
    case "subrace": return "Subrace";
    case "subclass": return choice.subclassLabel || "Subclass";
    case "asi": return "Ability Scores";
    case "ability": return "Ability Scores";
    case "equipment": return "Starting Equipment";
    default: return FAMILY_TITLES[choice.family] || titleCase(choice.family);
  }
}

export function valueLabel(choice, value) {
  const o = (choice.options || []).find((x) => x.value === value);
  if (o) return choice.kind === "equipment" ? o.value : o.label;
  return titleCase(value);
}

export { ABILITY_LABELS };