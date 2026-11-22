import {
  pruneEmpty, labelFromId, titleCase, formatRarity, formatCurrency, nameFromId, formatValue, RESET_WORDS,
  ABILITY_NAMES, plural,
} from "../catalogueHelpers";
import { emptyHeaderForm, headerToForm, formToHeader, emptyGrantsForm, grantsToForm, formToGrants } from "../catalogueForms";

/* ═══════════════════════════════════════════════════════════════════
   itemHelpers — what only items need. The shared words are in
   ../catalogueHelpers, the shared form conversion in ../catalogueForms.

   Three kinds of record (final/items/<book>.json):
     item          a real object: a Longsword (`base: true`, a mundane base
                   item), a Wand of Fireballs, Blackrazor (`base_item`)
     item_variant  a template for base items: "+1 Weapon", "Flame Tongue";
                   `applies_to` lists the base items, `name_format` names
                   the result ("Flame Tongue {base}")
     item_group    a heading over complete items: Absorbing Tattoo → 10
                   tattoos (`members`)
   The list shows items, variants and groups; a group's members open from
   the group's card (or show in the list with the "members" filter).
   ═══════════════════════════════════════════════════════════════════ */

export const KINDS = {
  base: "Mundane base item",
  item: "Item",
  item_variant: "Variant (made from a base item)",
  item_group: "Group",
};

// "base" for mundane base items, else the record's kind.
export const kindOf = (it) => (it.kind === "item" && it.base ? "base" : it.kind);

const MODIFIER_WORDS = {
  ac: "AC", spell_attack: "spell attack rolls", spell_dc: "spell save DC", save: "saving throws",
  check: "ability checks", pb: "Proficiency Bonus", concentration: "Concentration saves",
  spell_damage: "spell damage", speed: "Speed", ...ABILITY_NAMES,
};
export const MODIFIER_TARGETS = Object.keys(MODIFIER_WORDS);
export const formatModifierTarget = (t) => MODIFIER_WORDS[t] || labelFromId(t);

// { target: "ac", add: 1 } → "+1 AC"; { target: "str", set: 19 } → "Strength becomes 19"
export const formatModifier = (m) => {
  const what = formatModifierTarget(m.target);
  if (m.add != null) return `${m.add >= 0 ? "+" : ""}${m.add} ${what}`;
  if (m.set != null) return `${what} becomes ${m.set}`;
  if (m.min != null) return `${what} at least ${m.min}`;
  return what;
};

/* ─── words for lists and cards ──────────────────────────────────── */

const attunementWords = (a) => (a?.required ? `requires attunement${a.note ? ` ${a.note}` : ""}` : "");

// "Wondrous Item, Rare (requires attunement by a wizard)"
export const itemSubtitle = (it) => {
  if (it.kind === "item_group") return `A group of ${plural(it.members?.length || 0, "item")}${it.rarity ? `, ${formatRarity(it.rarity)}` : ""}`;
  const types = (it.item_types || []).map(labelFromId).join(", ") 
    || (it.kind === "item_variant" ? "Variant" : it.item_tags?.includes("staff") ? "Staff" : "Item");
  const rarity = it.rarity && it.rarity !== "none" ? formatRarity(it.rarity) : null;
  const attune = attunementWords(it.attunement);
  return `${[types, rarity].filter(Boolean).join(", ")}${attune ? ` (${attune})` : ""}`;
};

// The short note on a row: "Rare · Wondrous Item", "Variant · Rare", "10 items".
export const itemRowMeta = (it) => {
  if (it.kind === "item_group") return plural(it.members?.length || 0, "item");
  const rarity = it.rarity && it.rarity !== "none" ? formatRarity(it.rarity) : null;
  const first = it.kind === "item_variant" ? "Variant" : labelFromId((it.item_types || [])[0] || "");
  return [rarity, first].filter(Boolean).join(" · ") || null;
};

const formatArmor = (a) => {
  if (a.category === "shield") return `+${a.base ?? 2}`;
  if (a.base == null) return "";
  if (a.dex_cap === 0) return String(a.base);
  return `${a.base} + Dex modifier${a.dex_cap != null ? ` (max ${a.dex_cap})` : ""}`;
};

const formatLight = (l) =>
  (l || []).map((x) => [x.bright ? `bright light ${x.bright} ft.` : null, x.dim ? `dim light ${x.dim} ft.` : null].filter(Boolean).join(", ")).join("; ");

const listNames = (ids, index, max = 12) => {
  // The same base item from two books (longsword-phb, longsword-xphb) is named once.
  const names = [...new Set((ids || []).map((id) => nameFromId(id, index)))];
  return names.length > max ? `${names.slice(0, max).join(", ")} and ${names.length - max} more` : names.join(", ");
};

/* An item's statistics → rows { label, value } for its card. */
export const itemStats = (it, index) => {
  const rows = [];
  const add = (label, value) => value && rows.push({ label, value });
  const w = it.weapon;
  if (w) {
    const dmg = w.damage ? `${w.damage.dice} ${labelFromId(w.damage.type || "")}`.trim() : "";
    add("Weapon", [w.category && titleCase(w.category), w.kind].filter(Boolean).join(" "));
    add("Damage", `${dmg}${w.versatile ? ` (two-handed ${w.versatile})` : ""}`);
    if (w.range) add("Range", `${w.range.normal}${w.range.long ? `/${w.range.long}` : ""} ft.`);
    add("Properties", (w.properties || []).map((p) => labelFromId(p) + (w.property_notes?.[p] ? ` (${w.property_notes[p]})` : "")).join(", "));
    add("Mastery", (w.mastery || []).map(labelFromId).join(", "));
    if (w.ammo) add("Ammunition", nameFromId(w.ammo, index));
    if (w.bonus && (w.bonus.attack || w.bonus.damage)) {
      add("Bonus", w.bonus.attack === w.bonus.damage
        ? `+${w.bonus.attack} to attack and damage rolls`
        : [w.bonus.attack ? `+${w.bonus.attack} to attack rolls` : null, w.bonus.damage ? `+${w.bonus.damage} to damage rolls` : null].filter(Boolean).join(", "));
    }
    if (w.crit_at) add("Critical Hit", `on ${w.crit_at}–20`);
  }
  const a = it.armor;
  if (a) {
    add("Armor Class", formatArmor(a));
    if (a.strength) add("Strength", `${a.strength}+ needed`);
    if (a.stealth_disadvantage) add("Stealth", "Disadvantage");
  }
  if (it.modifiers?.length) add("While equipped", it.modifiers.map(formatModifier).join(", "));
  if (it.charges) {
    const reset = RESET_WORDS[it.charges.reset] || it.charges.reset;
    const regain = it.charges.regain === "all" ? "all" : formatValue(it.charges.regain);
    add("Charges", `${formatValue(it.charges.max)}${reset ? `, regains ${regain || "them"} at ${reset}` : ""}`);
  }
  if (it.focus) add("Spellcasting Focus", it.focus === true ? "yes" : it.focus.map(labelFromId).join(", "));
  if (it.light?.length) add("Light", formatLight(it.light));
  if (it.curse) add("Cursed", "yes");
  if (it.sentient) add("Sentient", "yes");
  if (it.weight != null) add("Weight", `${it.weight} lb.`);
  if (it.value) add("Value", it.value.formula ? `base item's ${it.value.formula.replace(/^base\s*/, "")}` : formatCurrency(it.value));
  if (it.extra?.contents?.length) add("Contains", it.extra.contents.map((c) => `${c.qty > 1 ? `${c.qty} ` : ""}${nameFromId(c.item, index)}`).join(", "));
  if (it.base_item) add("Made from", nameFromId(it.base_item, index));
  if (it.kind === "item_variant") {
    add("Name", it.name_format?.replace("{base}", "…"));
    add("Made from", listNames(it.applies_to, index));
    if (it.properties_add?.length) add("Adds", it.properties_add.map(labelFromId).join(", "));
  }
  return rows;
};

// What an item has, for the "Has" filter.
export const HAS_LABELS = {
  charges: "Charges", spells: "Casts spells", ac: "AC bonus", saves: "Save or check bonus",
  spellcasting: "Spell attack / DC bonus", ability: "Sets or raises an ability", resistances: "Resistances",
  weapon_bonus: "Attack / damage bonus", focus: "Spellcasting focus", light: "Sheds light", curse: "Cursed",
  sentient: "Sentient", attunement: "Requires attunement",
};
export const itemHas = (it) => {
  const out = [];
  const targets = new Set((it.modifiers || []).map((m) => m.target));
  if (it.charges) out.push("charges");
  if (it.grants?.spells?.length) out.push("spells");
  if (targets.has("ac")) out.push("ac");
  if (targets.has("save") || targets.has("check")) out.push("saves");
  if (targets.has("spell_attack") || targets.has("spell_dc")) out.push("spellcasting");
  if (Object.keys(ABILITY_NAMES).some((a) => targets.has(a)) || it.grants?.ability) out.push("ability");
  if (it.grants?.defenses) out.push("resistances");
  if (it.weapon?.bonus) out.push("weapon_bonus");
  if (it.focus) out.push("focus");
  if (it.light?.length) out.push("light");
  if (it.curse) out.push("curse");
  if (it.sentient) out.push("sentient");
  if (it.attunement?.required) out.push("attunement");
  return out;
};

/* ─── record ↔ form ──────────────────────────────────────────────── */

const emptyWeapon = () => ({
  on: false, category: "simple", kind: "melee", dice: "", type: "", versatile: "", normal: null, long: null,
  properties: [], mastery: [], attack: 0, damage: 0, rest: {},
});
const emptyArmor = () => ({ on: false, category: "light", base: null, dexCap: null, strength: null, stealth: false });

export const emptyItemForm = () => ({
  ...emptyHeaderForm(),
  kind: "item",
  itemTypes: [],
  rarity: "none",
  tier: "",
  weight: null,
  value: {},
  attunement: { required: false, note: "", rest: {} },
  charges: { on: false, max: null, reset: "dawn", regain: "" },
  modifiers: [],                 // [{ target, op: add|min|set, value }]
  curse: false,
  sentient: false,
  focus: [],                     // classes; focusAny: any spellcaster
  focusAny: false,
  itemTags: [],
  weapon: emptyWeapon(),
  armor: emptyArmor(),
  base: false,                   // a mundane base item variants build on
  baseItem: "",                  // a unique item built on a base item
  appliesTo: [],                 // variant: base item ids
  nameFormat: "{base}",
  nameRemove: "",
  propertiesAdd: [],
  members: [],                   // group: item ids
  hiddenMembers: false,
  grants: emptyGrantsForm(),
  features: [],
  rest: {},                      // keys the form has no field for
});

const HANDLED = new Set([
  "id", "kind", "name", "source", "edition", "visibility", "created_by", "text", "aliases", "tags", "srd", "reprinted_as",
  "item_types", "rarity", "tier", "weight", "value", "attunement", "charges", "modifiers", "curse", "sentient", "focus",
  "item_tags", "weapon", "armor", "base", "base_item", "applies_to", "name_format", "name_remove", "properties_add",
  "members", "hidden_members", "grants", "choices", "features",
]);

export function itemToForm(it, { copy = false } = {}) {
  const w = it.weapon;
  const a = it.armor;
  const { required, note, ...attRest } = it.attunement || {};
  const { category, kind, damage, versatile, range, properties, mastery, bonus, ...weaponRest } = w || {};
  return {
    ...headerToForm(it, { copy }),
    kind: it.kind || "item",
    itemTypes: it.item_types || [],
    rarity: it.rarity || "none",
    tier: it.tier || "",
    weight: it.weight ?? null,
    value: it.value || {},
    attunement: { required: !!required, note: note || "", rest: attRest },
    charges: it.charges
      ? { on: true, max: it.charges.max, reset: it.charges.reset || "", regain: it.charges.regain ?? "" }
      : { on: false, max: null, reset: "dawn", regain: "" },
    modifiers: (it.modifiers || []).map((m) => {
      const op = ["add", "min", "set"].find((k) => m[k] != null) || "add";
      return { target: m.target, op, value: m[op] };
    }),
    curse: !!it.curse,
    sentient: !!it.sentient,
    focus: Array.isArray(it.focus) ? it.focus : [],
    focusAny: it.focus === true,
    itemTags: it.item_tags || [],
    weapon: w
      ? {
          on: true,
          category: category || "",
          kind: kind || "",
          dice: damage?.dice || "",
          type: damage?.type || "",
          versatile: versatile || "",
          normal: range?.normal ?? null,
          long: range?.long ?? null,
          properties: properties || [],
          mastery: mastery || [],
          attack: bonus?.attack || 0,
          damage: bonus?.damage || 0,
          rest: weaponRest,
        }
      : emptyWeapon(),
    armor: a
      ? { on: true, category: a.category, base: a.base ?? null, dexCap: a.dex_cap ?? null, strength: a.strength ?? null, stealth: !!a.stealth_disadvantage }
      : emptyArmor(),
    base: !!it.base,
    baseItem: it.base_item || "",
    appliesTo: it.applies_to || [],
    nameFormat: it.name_format || "{base}",
    nameRemove: it.name_remove || "",
    propertiesAdd: it.properties_add || [],
    members: it.members || [],
    hiddenMembers: !!it.hidden_members,
    grants: grantsToForm(it.grants, it.choices),
    features: it.features || [],
    rest: Object.fromEntries(Object.entries(it).filter(([k]) => !HANDLED.has(k))),
  };
}

const num = (v) => (v === "" || v == null ? undefined : Number(v));

export function formToItem(form, original) {
  const f = form;
  const header = formToHeader(f, f.kind, original);

  if (f.kind === "item_group") {
    return pruneEmpty({ ...header, members: f.members, rarity: f.rarity, hidden_members: f.hiddenMembers || undefined }) ;
  }

  const w = f.weapon;
  const weapon = w.on
    ? {
        ...w.rest,
        category: w.category || undefined,
        kind: w.kind || undefined,
        damage: w.dice ? { dice: w.dice.trim(), type: w.type || undefined } : undefined,
        versatile: w.versatile.trim() || undefined,
        range: w.normal ? { normal: Number(w.normal), long: num(w.long) } : undefined,
        properties: w.properties,
        mastery: w.mastery,
        bonus: w.attack || w.damage ? { attack: Number(w.attack) || 0, damage: Number(w.damage) || 0 } : undefined,
      }
    : undefined;
  const a = f.armor;
  const armor = a.on
    ? { category: a.category, base: num(a.base), dex_cap: num(a.dexCap), strength: num(a.strength), stealth_disadvantage: a.stealth || undefined }
    : undefined;
  const { grants, choices } = formToGrants(f.grants);

  const record = pruneEmpty({
    ...f.rest,
    ...header,
    item_types: f.itemTypes,
    rarity: f.rarity,
    tier: f.tier || undefined,
    weight: num(f.weight),
    value: f.value,
    attunement: f.attunement.required || f.attunement.note.trim()
      ? { ...f.attunement.rest, required: f.attunement.required, note: f.attunement.note.trim() || undefined }
      : undefined,
    charges: f.charges.on && f.charges.max != null && f.charges.max !== ""
      ? {
          max: isNaN(Number(f.charges.max)) ? f.charges.max : Number(f.charges.max),
          reset: f.charges.reset || undefined,
          regain: f.charges.regain === "" ? undefined : isNaN(Number(f.charges.regain)) ? f.charges.regain : Number(f.charges.regain),
        }
      : undefined,
    modifiers: f.modifiers.filter((m) => m.target && m.value !== "" && m.value != null).map((m) => ({ target: m.target, [m.op]: Number(m.value) })),
    curse: f.curse || undefined,
    sentient: f.sentient || undefined,
    focus: f.focusAny ? true : f.focus,
    item_tags: f.itemTags,
    weapon,
    armor,
    features: f.features,
    ...(f.kind === "item"
      ? { base: f.base || undefined, base_item: f.baseItem || undefined }
      : {
          applies_to: f.appliesTo,
          name_format: f.nameFormat.trim() || "{base}",
          name_remove: f.nameRemove || undefined,
          properties_add: f.propertiesAdd,
        }),
  });
  return { ...record, grants, choices };
}

export const ITEM_KIND_OPTIONS = [
  { value: "item", label: "Item" },
  { value: "item_variant", label: "Variant" },
  { value: "item_group", label: "Group" },
];
