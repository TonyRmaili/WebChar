// ── String helpers ────────────────────────────────────────────────────────────

export const capitalize = (str) =>
  typeof str === "string" && str.length > 0
    ? str.charAt(0).toUpperCase() + str.slice(1)
    : "";

export const capitalizeWords = (str) =>
  typeof str === "string"
    ? str.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : "";

// Strips 5etools {@tag name|source|display} notation.
// 3-part → display (parts[2]); otherwise → name (parts[0]).
export const stripAtNotation = (str) => {
  if (typeof str !== "string") return str;
  return str.replace(/\{@\w+\s([^}]+)\}/g, (_, inner) => {
    const parts = inner.split("|");
    return parts.length >= 3 ? parts[2] : parts[0];
  });
};

export const splitCamelAfterAny = (key) =>
  key.replace(/^any/, "").replace(/([A-Z])/g, " $1").trim();

export const humanizeKey = (key) =>
  typeof key === "string"
    ? key.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : "";

export const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Normalize an extras / spell-slot cell value for the progression table.
export const formatExtra = (v) => {
  if (v === 0 || v == null) return "—";
  if (typeof v === "object") {
    if (v.type === "bonus" && v.value != null) return `+${v.value}`;
    return v.value != null ? v.value : "—";
  }
  return v;
};

// ── Proficiency formatters ────────────────────────────────────────────────────

export const formatPrimaryAbility = (primaryAbility) => {
  if (!primaryAbility || !Array.isArray(primaryAbility)) return [];
  return primaryAbility.map((group) =>
    Object.keys(group).filter((key) => group[key])
  );
};

export const formatArmor = (armor) => {
  if (!armor?.length) return [];
  return armor
    .map((a) => {
      if (typeof a === "string") return { label: capitalize(a), note: null };
      if (a.proficiency) return { label: capitalize(a.proficiency), note: a.full ?? null };
      return null;
    })
    .filter(Boolean);
};

export const formatWeapons = (weapons) => {
  if (!weapons?.length) return [];
  return weapons.map((w) => {
    if (typeof w === "string")
      return { label: capitalize(stripAtNotation(w)), optional: false };
    return { label: capitalize(w.proficiency), optional: !!w.optional };
  });
};

export const formatToolProficiencies = (toolProfs) => {
  if (!toolProfs?.length) return [];
  const result = [];
  for (const group of toolProfs) {
    for (const [key, val] of Object.entries(group)) {
      if (key.startsWith("any") && typeof val === "number") {
        result.push({ label: `Any ${splitCamelAfterAny(key)}`, count: val, isChoice: true });
      } else if (val === true) {
        result.push({ label: capitalizeWords(key), isChoice: false });
      }
    }
  }
  return result;
};

export const formatSkills = (skills) => {
  if (!skills?.length) return [];
  return skills
    .map((entry) => {
      if (entry.choose) {
        const { from, count } = entry.choose;
        return { count, from: from.map(capitalizeWords) };
      }
      return null;
    })
    .filter(Boolean);
};

// Shared builder for both startingProficiencies and multiclassing.proficienciesGained.
export const buildProfs = (raw) => {
  if (!raw) return null;
  return {
    armor:   formatArmor(raw.armor),
    weapons: formatWeapons(raw.weapons),
    tools:   formatToolProficiencies(raw.toolProficiencies),
    skills:  formatSkills(raw.skills),
  };
};

export const hasAnyProfs = (profs) =>
  !!profs && (
    profs.armor.length || profs.weapons.length ||
    profs.tools.length || profs.skills.length
  );

// ── Multiclassing requirements ────────────────────────────────────────────────

// Normalizes the three known 5etools multiclass requirement shapes into one form.
//   { wis: 13 }                               → { connector: "and", pairs: [["wis", 13]] }
//   { str: 13, cha: 13 }   (paladin classic)  → { connector: "and", pairs: [["str", 13], ["cha", 13]] }
//   { or: [{ str: 13, dex: 13 }] } (fighter)  → { connector: "or",  pairs: [["str", 13], ["dex", 13]] }
export const normalizeMulticlassRequirements = (req) => {
  if (!req || typeof req !== "object") return null;

  if (Array.isArray(req.or)) {
    const pairs = [];
    for (const entry of req.or) {
      if (entry && typeof entry === "object") {
        for (const [ability, score] of Object.entries(entry)) {
          if (typeof score === "number") pairs.push([ability, score]);
        }
      }
    }
    return pairs.length ? { connector: "or", pairs } : null;
  }

  const pairs = Object.entries(req).filter(([, v]) => typeof v === "number");
  return pairs.length ? { connector: "and", pairs } : null;
};

// ── Feature description parsing ───────────────────────────────────────────────

// "## Heading" lines → heading blocks; everything else → paragraph blocks.
export const parseDescription = (description) => {
  if (typeof description !== "string" || !description.trim()) return null;
  return description
    .split(/\n\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) =>
      chunk.startsWith("##")
        ? { type: "heading", text: chunk.replace(/^#+\s*/, "") }
        : { type: "paragraph", text: chunk }
    );
};