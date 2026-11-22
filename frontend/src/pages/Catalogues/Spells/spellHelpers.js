import { titleCase, labelFromId, nameFromId, pruneEmpty } from "../catalogueHelpers";
import { headerToForm, formToHeader } from "../catalogueForms";

/* ═══════════════════════════════════════════════════════════════════
   spellHelpers — the Spells catalogue: the card's wording, the values
   its filters offer, and the record ↔ form conversion.

   A spell record (data-model §4d): the header and `text`, plus level,
   school, ritual, time[], range, components, duration[], classes (class
   ids), filters (5etools' search tags) and features (its numbers, from
   the LLM step; empty until that step has run).
   ═══════════════════════════════════════════════════════════════════ */

export const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
export const formatLevel = (l) => (l === 0 ? "Cantrip" : `Level ${l}`);

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// 2024: "Level 3 Evocation" · "Evocation Cantrip"; 2014: "3rd-level evocation" · "Evocation cantrip"
export const spellSubtitle = (sp) => {
  const school = titleCase(sp.school || "");
  const one = sp.edition !== "classic";
  const head = sp.level === 0
    ? `${school} ${one ? "Cantrip" : "cantrip"}`
    : one ? `Level ${sp.level} ${school}` : `${ordinal(sp.level)}-level ${school.toLowerCase()}`;
  return `${head.trim()}${sp.ritual ? (one ? " (Ritual)" : " (ritual)") : ""}`;
};

// The short note on a list row: "3 · Evocation" · "Cantrip · Evocation"
export const spellRowMeta = (sp) => [sp.level === 0 ? "Cantrip" : sp.level, titleCase(sp.school || "")].filter((x) => x !== "").join(" · ");

// ─── Card lines ────────────────────────────────────────────────────

export const TIME_UNITS = ["action", "bonus_action", "reaction", "minute", "hour"];
const TIME_WORDS = { action: "Action", bonus_action: "Bonus Action", reaction: "Reaction", minute: "Minute", hour: "Hour" };

// "1 Action or Ritual" · "1 Reaction, which you take when …" · "10 Minutes"
export const formatTime = (sp) =>
  (sp.time || [])
    .map((t) => {
      const word = TIME_WORDS[t.unit] || labelFromId(t.unit);
      const many = t.number > 1 && ["minute", "hour"].includes(t.unit);
      let s = `${t.number ?? 1} ${word}${many ? "s" : ""}`;
      if (t.note) s += ` (${t.note})`;
      if (t.trigger) s += `, ${t.trigger}`;
      return s;
    })
    .join(" or ") + (sp.ritual && sp.edition !== "classic" ? " or Ritual" : "");

export const RANGE_TYPES = ["feet", "miles", "self", "touch", "sight", "unlimited", "special"];
export const AREA_SHAPES = ["cone", "cube", "cylinder", "emanation", "hemisphere", "line", "radius", "sphere"];

// "150 feet" · "Self (15-foot Cone)" · "Touch" · "1 mile"
export const formatRange = (r) => {
  if (!r) return "";
  if (r.type === "feet") return `${r.amount} feet`;
  if (r.type === "miles") return `${r.amount} ${r.amount === 1 ? "mile" : "miles"}`;
  if (r.type === "self" && r.area) {
    const unit = r.area.unit === "miles" ? "mile" : "foot";
    return `Self (${r.area.size}-${unit} ${titleCase(r.area.shape)})`;
  }
  return titleCase(r.type || "");
};

// "V, S, M (a ball of bat guano and sulfur)" · "V, S, M (… worth 100+ GP, consumed)"
export const formatComponents = (c) => {
  if (!c) return "";
  const parts = [];
  if (c.v) parts.push("V");
  if (c.s) parts.push("S");
  if (c.r) parts.push("R");
  if (c.m) parts.push(`M (${typeof c.m === "string" ? c.m : c.m.text})`);
  return parts.join(", ");
};

const ENDS_WORDS = { dispel: "dispelled", trigger: "triggered", discharge: "discharged" };
export const DURATION_TYPES = ["instant", "timed", "permanent", "special"];
export const DURATION_UNITS = ["round", "minute", "hour", "day"];

// "Concentration, up to 1 minute" · "Instantaneous" · "Until dispelled or triggered"
export const formatDuration = (sp) =>
  (sp.duration || [])
    .map((d) => {
      if (d.type === "instant") return "Instantaneous";
      if (d.type === "special") return "Special";
      if (d.type === "permanent") {
        const ends = (d.ends || []).map((e) => ENDS_WORDS[e] || e);
        return ends.length ? `Until ${ends.join(" or ")}` : "Permanent";
      }
      const time = `${d.amount} ${d.unit}${d.amount === 1 ? "" : "s"}`;
      return d.concentration ? `Concentration, up to ${time}` : d.up_to ? `Up to ${time}` : time;
    })
    .join(" or ");

export const isConcentration = (sp) => (sp.duration || []).some((d) => d.concentration);

// "wizard-xphb" → "Wizard" (a class's own name, whichever book).
export const className = (id, index) => nameFromId(id, index);

// ─── Filters ───────────────────────────────────────────────────────
// Read from the spell's own fields and features as well as from the
// book's tags (`filters`), so a homebrew spell is found the same way.

const union = (...lists) => [...new Set(lists.flat().filter(Boolean))];

const allDamage = (sp) =>
  (sp.features || []).flatMap((f) => {
    const a = f.action || {};
    return [...(a.attack?.damage || []), ...(a.save?.damage || []), ...(a.damage || [])];
  });

export const spellClasses = (sp) => union((sp.classes || []).map((id) => className(id)));
export const spellDamage = (sp) => union(sp.filters?.damage, allDamage(sp).map((d) => d.type));
export const spellSaves = (sp) => union(sp.filters?.saves, (sp.features || []).map((f) => f.action?.save?.ability));
export const spellConditions = (sp) => union(sp.filters?.conditions, (sp.features || []).flatMap((f) => f.action?.save?.conditions || []));
export const spellAttack = (sp) =>
  union(sp.filters?.attack, (sp.features || []).map((f) => f.action?.attack?.kind).filter((k) => k === "melee" || k === "ranged"));
export const spellArea = (sp) => union(sp.filters?.area, sp.range?.area?.shape);
export const spellTimes = (sp) => union((sp.time || []).map((t) => t.unit));

export const CASTING_LABELS = { concentration: "Concentration", ritual: "Ritual", instant: "Instantaneous", upcast: "Better at higher levels" };
export const spellCasting = (sp) => {
  const out = [];
  if (isConcentration(sp)) out.push("concentration");
  if (sp.ritual) out.push("ritual");
  if ((sp.duration || []).some((d) => d.type === "instant")) out.push("instant");
  if (/\*\*(Using a Higher-Level Spell Slot|At Higher Levels|Cantrip Upgrade)\.\*\*/.test(sp.text || "")) out.push("upcast");
  return out;
};

export const CONSUMED_OPTIONS = [
  { value: false, label: "kept" },
  { value: true, label: "consumed" },
  { value: "optional", label: "consumed if you choose" },
];

export const COMPONENT_LABELS = { v: "Verbal", s: "Somatic", m: "Material", cost: "Material with a cost", consumed: "Material consumed", none_m: "No material" };
export const spellComponents = (sp) => {
  const c = sp.components || {};
  const out = ["v", "s", "m"].filter((k) => c[k]);
  if (!c.m) out.push("none_m");
  if (c.m?.cost) out.push("cost");
  if (c.m?.consumed === true) out.push("consumed");
  return out;
};

export const GIVES_LABELS = { gives_resist: "Resistance", gives_immune: "Immunity", gives_condition_immune: "Condition immunity", gives_vulnerable: "Vulnerability" };
export const spellGives = (sp) => Object.keys(GIVES_LABELS).filter((k) => sp.filters?.[k]?.length);

// ─── Form ──────────────────────────────────────────────────────────
// Everything the form has no field for (srd, reprinted_as, filters,
// extra_grants…) is kept in `rest`; time, duration and features are
// edited in their record shape.

const HANDLED = new Set([
  "id", "kind", "name", "source", "edition", "visibility", "text", "aliases", "tags", "created_by",
  "level", "school", "ritual", "time", "range", "components", "duration", "classes", "features",
]);

export const emptySpellForm = () => ({
  name: "", edition: "one", visibility: "private", text: "",
  level: 1, school: "evocation", ritual: false,
  time: [{ number: 1, unit: "action" }],
  range: { type: "feet", amount: 60 },
  components: { v: true, s: true, r: false, mText: "", mCost: {}, mConsumed: false, mIsObject: false },
  duration: [{ type: "instant", concentration: false }],
  classes: [],
  features: [],
  rest: {},
});

export function spellToForm(sp, { copy = false } = {}) {
  const c = sp.components || {};
  const m = c.m;
  return {
    ...headerToForm(sp, { copy }),
    level: sp.level ?? 0,
    school: sp.school || "",
    ritual: !!sp.ritual,
    time: (sp.time || []).map((t) => ({ ...t })),
    range: { ...(sp.range || { type: "special" }), area: sp.range?.area ? { ...sp.range.area } : undefined },
    components: {
      v: !!c.v, s: !!c.s, r: !!c.r,
      mText: typeof m === "string" ? m : m?.text || "",
      mCost: m?.cost || {},
      mConsumed: m?.consumed ?? false, // true · false · "optional"
      mIsObject: !!m && typeof m === "object",
    },
    duration: (sp.duration || []).map((d) => ({ ...d })),
    classes: sp.classes || [],
    features: (sp.features || []).map((f) => ({ ...f })),
    rest: Object.fromEntries(Object.entries(sp).filter(([k]) => !HANDLED.has(k))),
  };
}

// A material is written as plain words unless it has a cost or is used up.
const materialOf = (c) => {
  const text = c.mText.trim();
  if (!text) return undefined;
  const cost = pruneEmpty(c.mCost);
  if (!cost && !c.mConsumed && !c.mIsObject) return text;
  return { text, cost, consumed: c.mConsumed };
};

const slug = (s) => String(s || "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// New features get an id from their name, unique within the spell.
const withIds = (features) => {
  const used = new Set(features.map((f) => f.id).filter(Boolean));
  return features.map((f) => {
    if (f.id) return f;
    const base = slug(f.name) || "effect";
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    return { ...f, id };
  });
};

export function formToSpell(form, original) {
  const f = form;
  const c = f.components;
  const r = f.range;
  const range = { type: r.type };
  if (r.type === "feet" || r.type === "miles") range.amount = r.amount;
  if (r.type === "self" && r.area?.shape) range.area = r.area;
  const record = {
    ...formToHeader(f, "spell", original),
    ...f.rest,
    level: f.level,
    school: f.school,
    ritual: f.ritual,
    time: f.time,
    range,
    components: { v: c.v, s: c.s, r: c.r || undefined, m: materialOf(c) },
    duration: f.duration.map((d) => {
      const out = { ...d, concentration: !!d.concentration };
      if (d.type !== "timed") {
        delete out.amount;
        delete out.unit;
        delete out.up_to;
      }
      if (d.type !== "permanent") delete out.ends;
      return out;
    }),
    classes: f.classes,
    features: withIds(f.features),
  };
  // pruneEmpty keeps false, so ritual, v/s and concentration survive.
  return pruneEmpty(record);
}
