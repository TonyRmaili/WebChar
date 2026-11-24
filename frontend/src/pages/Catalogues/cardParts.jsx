import React, { useState } from "react";
import { BareSections } from "./FilterSection";
import { PartPopup } from "./catalogueStyle";
import { FeatureFields, GrantsEditor, KeptSection } from "./catalogueParts";
import { describeChoice, describeFeature, describeGrants, featureText, riderOf } from "./catalogueHelpers";
import { formToGrants } from "./catalogueForms";

/* ═══════════════════════════════════════════════════════════════════
   cardParts — the pieces of a card form (the item card, the feat card,
   and the other categories as they move to cards): an entry is made on
   its own card, drawn the way the catalogue shows it, and every line
   opens a small window to change it.

     AddRow        "+ weapon  + charges  + spells" — what can still go on
     StatLine      one of the card's lines ("DAMAGE: 1d6 bludgeoning")
     LineGroup     lines that open the same window, with ✕ to take it off
     CardText      the description, typed on the card
     CardFeatures  "Name. text" + small words; each opens the feature
                   window (FeatureFields); "+ feature"
     GivesBlock    "What it gives": the grants and picks, each line opens
                   that part's window (GrantsEditor only=[part]); "+ …"
                   for the parts it hasn't got
   ═══════════════════════════════════════════════════════════════════ */

export const lineBtn = "group block w-full rounded-sm text-left transition hover:bg-rubric/5";
export const addLink = "italic text-ink-faded underline decoration-dotted underline-offset-2 hover:text-rubric";
export const sectionHead = "mb-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-faded";
export const plural = (n, one) => `${n} ${one}${n === 1 ? "" : "s"}`;

export function AddRow({ items }) {
  const shown = (items || []).filter(Boolean);
  if (!shown.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
      {shown.map((it) => (
        <button key={it.label} type="button" onClick={it.onClick} className={addLink} title={it.hint}>
          + {it.label}
        </button>
      ))}
    </div>
  );
}

export function StatLine({ label, value, onClick }) {
  return (
    <button type="button" onClick={onClick} className={lineBtn} title="Click to change">
      <span className="text-sm leading-snug">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faded">{label}: </span>
        <span className="text-ink group-hover:text-rubric">{value}</span>
      </span>
    </button>
  );
}

export function LineGroup({ rows, onOpen, onRemove, removeLabel }) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1 space-y-0.5">
        {rows.map((r, i) => <StatLine key={`${r.label}-${i}`} label={r.label} value={r.value} onClick={onOpen} />)}
      </div>
      {onRemove && (
        <button type="button" onClick={onRemove} className="pt-0.5 text-[10px] text-ink-faint hover:text-bad" title={`Take off: ${removeLabel}`} aria-label={`Take off: ${removeLabel}`}>
          ✕
        </button>
      )}
    </div>
  );
}

// A textarea that grows with its text and looks like the card's own writing.
export function CardText({ value, onChange, placeholder, label = "Description" }) {
  const rows = Math.max(3, String(value || "").split("\n").length + 1);
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} aria-label={label}
              className="w-full resize-none rounded-sm border border-transparent bg-transparent px-1 py-0.5 text-[15px] leading-relaxed text-ink outline-none transition placeholder:italic placeholder:text-ink-faint hover:border-dotted hover:border-rule/50 focus:border-dotted focus:border-rule/60" />
  );
}

/* ─── features ───────────────────────────────────────────────────── */

const isRider = (f) => !!riderOf(f);
const onCharges = (f) => f?.consumes?.resource === "charges";

/* The card's features: "Name. text" with what it does in small words;
   click → the feature window, ✕ takes it off, "+ feature" adds one.
   `text`: the entry's description (a feature's own text may sit there as
   a **Name.** paragraph). `fieldProps`: passed to FeatureFields
   (itemCharges, categories…). */
export function CardFeatures({ features, onChange, text = "", title = "What it does", index, fieldProps = {} }) {
  const [open, setOpen] = useState(null);
  const list = features || [];
  const patch = (i, key, v) =>
    onChange(list.map((f, j) => {
      if (j !== i) return f;
      const p = typeof key === "object" ? key : { [key]: v };
      const next = { ...f, ...p };
      for (const [k, x] of Object.entries(p)) if (x === undefined) delete next[k];
      return next;
    }));
  const add = () => {
    onChange([...list, { name: "", category: "actions", text: "" }]);
    setOpen(list.length);
  };
  const cur = open != null ? list[open] : null;
  return (
    <div>
      {list.length > 0 && <div className={sectionHead}>{title}</div>}
      <div className="space-y-1.5">
        {list.map((f, i) => {
          const words = describeFeature(f);
          const own = typeof f.text === "string" && f.text.trim() ? f.text : featureText(text, f.name) || "";
          return (
            <div key={f.id || `new-${i}`} className={`flex items-start gap-2 ${f.parent ? "ml-5" : ""}`}>
              <button type="button" onClick={() => setOpen(i)} className={`${lineBtn} min-w-0 flex-1`} title="Click to change">
                <span className="text-[15px] leading-snug">
                  <span className="font-semibold italic text-ink group-hover:text-rubric">{f.name || "Unnamed"}.</span>{" "}
                  <span className="text-ink">{own.replace(/^\*\*[^*]+\*\*\s*/, "").slice(0, 220) || <span className="italic text-ink-faint">no text yet</span>}</span>
                </span>
                {(words.length > 0 || isRider(f) || onCharges(f)) && (
                  <span className="block text-xs italic text-ink-faded">
                    {[
                      isRider(f) ? "rider" : "",
                      onCharges(f) ? plural(f.consumes.amount ?? 1, "charge") : "",
                      ...words.filter((x) => !isRider(f) || x !== "On an attack you make"),
                    ].filter(Boolean).join(" · ")}
                  </span>
                )}
              </button>
              <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className="pt-1 text-[10px] text-ink-faint hover:text-bad"
                      title="Take this off" aria-label={`Take off ${f.name || "this feature"}`}>
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <AddRow items={[{ label: "feature", hint: "Something it does: an action, a bonus action, a reaction, a rider, or always", onClick: add }]} />
      {cur && (
        <PartPopup title={cur.name || "New feature"} onClose={() => setOpen(null)}
                   hint="What the sheet shows and counts: its text, uses, what it does (an attack, a save, damage with no roll, a rider on your attacks, a heal), its numbers and its switch.">
          <FeatureFields f={cur} patch={(key, v) => patch(open, key, v)} withText index={index} {...fieldProps} />
        </PartPopup>
      )}
    </div>
  );
}

/* ─── what it gives ──────────────────────────────────────────────── */

// Which part of the grants form a line of "What it gives" belongs to.
const ROW_PART = {
  "Ability Scores": "ability", Feats: "feats", Spells: "spells", Equipment: "equipment", "Optional Features": "other",
  Skills: "proficiencies", Expertise: "proficiencies", "Saving Throws": "proficiencies", Tools: "proficiencies",
  Languages: "proficiencies", Weapons: "proficiencies", Armor: "proficiencies",
  Speed: "traits", Senses: "traits", Resistances: "traits", Immunities: "traits", Vulnerabilities: "traits", "Condition Immunities": "traits",
};
const PROFS = new Set(["skills", "expertise", "tools", "languages", "saves", "weapons", "armor"]);
const choicePart = (c) => {
  if (c.type === "ability") return "ability";
  if (c.type === "bundle") return "equipment";
  const g = Array.isArray(c.grant) ? c.grant[0] : c.grant;
  if (PROFS.has(g)) return "proficiencies";
  if (g === "feats") return "feats";
  if (g === "spells" || g === "spell_ability") return "spells";
  return "other";
};
export const PART_LABELS = {
  ability: "ability scores", traits: "traits", proficiencies: "proficiencies", spells: "spells", feats: "a feat", equipment: "equipment", other: "kept from the book",
};
const PART_TITLES = {
  ability: "Ability scores", traits: "Traits", proficiencies: "Proficiencies", spells: "Spells", feats: "Feat", equipment: "Equipment", other: "Kept from the book",
};
const PART_HINTS = {
  ability: "Fixed bonuses (+1 Str) and the player's choice (+2 / +1 among Str, Dex, Con).",
  traits: "Speed, senses, resistances and immunities.",
  proficiencies: "Skills, expertise, tools, languages, saving throws, weapons and armor: fixed, or a pick.",
  spells: "Spells it gives (and how they're cast), spells the player picks, and the spellcasting ability.",
  feats: "A feat it gives, or one the player picks.",
  equipment: "Items and coins it gives, or a choice of packs.",
  other: "Picks and grants from the book the form has no place for; they're saved as they are.",
};

/* "What it gives": the grants form's lines (fixed and picks), grouped by
   part; each opens that part's window. value / onChange: the grants form
   (catalogueForms.emptyGrantsForm). parts: what "+ …" offers; skip:
   parts shown elsewhere on the card (an item's spells are its "Casts").
   extraRows: more lines kept outside the grants form ({ label, value, part },
   a background's equipment pick); partExtra: more in a part's window
   ({ equipment: <BundleOptionsEditor …/> }). */
export function GivesBlock({ value, onChange, parts, skip = [], catalogues, index, title = "What it gives", border = true, extraRows = [], partExtra = {} }) {
  const [open, setOpen] = useState(null);
  const { grants, choices } = formToGrants(value);
  const rows = [
    ...describeGrants(grants, index).map((r) => ({ ...r, part: ROW_PART[r.label] || "other" })),
    ...(choices || []).map((c) => {
      const d = describeChoice(c, index);
      if (!d) return null;
      const opts = d.options ? ` ${d.options.map((o) => o.label).join(" · ")}` : "";
      return { label: d.label, value: `${d.value}${opts}`, part: choicePart(c) };
    }).filter(Boolean),
    ...extraRows,
  ].filter((r) => !skip.includes(r.part));
  const has = new Set(rows.map((r) => r.part));
  return (
    <div className={border ? "border-t border-rule/40 pt-2" : ""}>
      {rows.length > 0 && <div className={sectionHead}>{title}</div>}
      <div className="space-y-0.5">
        {rows.map((r, i) => <StatLine key={`${r.label}-${i}`} label={r.label} value={r.value} onClick={() => setOpen(r.part)} />)}
      </div>
      <AddRow items={parts.filter((p) => !has.has(p)).map((p) => ({ label: PART_LABELS[p], onClick: () => setOpen(p) }))} />
      {open && (
        <PartPopup title={`${title}: ${PART_TITLES[open].toLowerCase()}`} hint={PART_HINTS[open]} onClose={() => setOpen(null)}>
          {open === "other" ? (
            <KeptSection choices={value.extraChoices} onChoices={(v) => onChange({ ...value, extraChoices: v })} grants={value.extraGrants} index={index} />
          ) : (
            <BareSections.Provider value>
              <GrantsEditor value={value} onChange={onChange} catalogues={catalogues} index={index} only={[open]}
                            equipmentExtra={open === "equipment" ? partExtra.equipment : undefined} />
            </BareSections.Provider>
          )}
        </PartPopup>
      )}
    </div>
  );
}
