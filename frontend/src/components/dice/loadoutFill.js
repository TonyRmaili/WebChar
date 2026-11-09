import { ABILITIES } from "./groupRollHelper";

/* ═══════════════════════════════════════════════════════════════════
   loadoutFill.js — loadouts ⇄ the save / attack forms (GroupRoll).

   A loadout is a named set of rolls you keep using. Besides the rolls it
   may carry what a save or an attack needs — every part is optional:

     { name,
       rolls:  [{ id, label, expression, times, mode, against,
                  type }],              type: a damage type ("fire") or null
       attack: { toHit, count, critOn },          any of them null
       save:   { ability, dc, onSuccess, damageRoll } }

   fillFrom(loadout, kind) takes what fits the form and says what it
   couldn't find, so you type only the rest. It doesn't have to be a
   perfect match: an attack can use a save loadout's damage, and a plain
   "1d20+5" roll gives an attack its to-hit.

   loadoutFrom(form) goes the other way: the form you filled in, kept as
   a loadout.
   ═══════════════════════════════════════════════════════════════════ */

const asList = (v) => (Array.isArray(v) ? v : []);
const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Math.trunc(Number(v)));
const ABILITY_KEYS = ABILITIES.map((a) => a.key);

// "1d20+5", "d20 - 1", "1d20" → the bonus; anything else → null
export function d20Bonus(expression) {
  const m = /^\s*1?d20\s*(?:([+-])\s*(\d+))?\s*$/i.exec(String(expression || ""));
  if (!m) return null;
  return m[1] ? (m[1] === "-" ? -1 : 1) * Number(m[2]) : 0;
}

const isD20 = (line) => d20Bonus(line.expression) != null;

// The rolls that are damage: the ones with a damage type — or, when none
// has a type, every roll that isn't a d20.
export function damageLines(loadout) {
  const lines = asList(loadout?.rolls).filter((r) => String(r.expression || "").trim());
  const typed = lines.filter((r) => r.type);
  return typed.length ? typed : lines.filter((r) => !isD20(r));
}

/* → { form: { label, rows, ability, dc, onSuccess, damageRoll, toHit,
               count, critOn, mode }   (only what the loadout has),
       missing: ["DC", …] }  */
export function fillFrom(loadout, kind) {
  const form = {};
  const missing = [];
  if (loadout?.name) form.label = loadout.name;

  const dmg = damageLines(loadout);
  if (dmg.length) {
    form.rows = dmg.map((r) => ({ id: crypto.randomUUID(), dice: String(r.expression).trim(), type: r.type || null, given: null }));
    if (dmg.some((r) => !r.type)) missing.push("damage type");
  } else missing.push("damage");

  if (kind === "save") {
    const s = loadout?.save || {};
    if (ABILITY_KEYS.includes(s.ability)) form.ability = s.ability;
    else missing.push("ability");
    if (num(s.dc) != null) form.dc = num(s.dc);
    else missing.push("DC");
    if (s.onSuccess === "half" || s.onSuccess === "none") form.onSuccess = s.onSuccess;
    if (s.damageRoll === "once" || s.damageRoll === "each") form.damageRoll = s.damageRoll;
  } else {
    const a = loadout?.attack || {};
    const d20 = asList(loadout?.rolls).find(isD20);
    const toHit = num(a.toHit) ?? (d20 ? d20Bonus(d20.expression) : null);
    if (toHit != null) form.toHit = toHit;
    else missing.push("to hit");
    if (num(a.count) != null) form.count = Math.max(1, num(a.count));
    if (num(a.critOn) != null) form.critOn = Math.min(20, Math.max(2, num(a.critOn)));
    if (d20 && d20.mode && d20.mode !== "normal") form.mode = d20.mode; // advantage for everyone
  }
  return { form, missing };
}

// A loadout's save / attack parts in words: "attack +5 · 2 each" / "DEX save DC 15 · half"
export function loadoutWords(loadout) {
  const out = [];
  const a = loadout?.attack || {};
  if (num(a.toHit) != null || num(a.count) != null || num(a.critOn) != null) {
    out.push(
      [
        num(a.toHit) != null ? `attack ${a.toHit >= 0 ? "+" : ""}${num(a.toHit)}` : "attack",
        num(a.count) > 1 ? `${num(a.count)} each` : "",
        num(a.critOn) != null && num(a.critOn) < 20 ? `crit on ${num(a.critOn)}` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    );
  }
  const s = loadout?.save || {};
  if (s.ability || num(s.dc) != null || s.onSuccess) {
    const ab = ABILITIES.find((x) => x.key === s.ability)?.label;
    out.push(
      [
        `${ab ? `${ab} ` : ""}save${num(s.dc) != null ? ` DC ${num(s.dc)}` : ""}`,
        s.onSuccess === "half" ? "half on a success" : s.onSuccess === "none" ? "nothing on a success" : "",
        s.damageRoll === "each" ? "a roll each" : "",
      ]
        .filter(Boolean)
        .join(" · ")
    );
  }
  return out;
}

// The form → a new loadout's data. Rows typed in "rolled at the table" are left out.
export function loadoutFrom({ kind, label, rows, ability, dc, onSuccess, damageRoll, toHit, count, critOn, mode }) {
  const line = (patch) => ({ id: crypto.randomUUID(), label: "", expression: "", times: 1, mode: "normal", against: null, type: null, ...patch });
  const damage = asList(rows)
    .filter((r) => String(r.dice || "").trim())
    .map((r) => line({ label: r.type ? `${r.type[0].toUpperCase()}${r.type.slice(1)}` : "Damage", expression: String(r.dice).trim(), type: r.type || null }));
  const base = { name: String(label || "").trim() || (kind === "save" ? "Save" : "Attack") };
  if (kind === "save") return { ...base, rolls: damage, save: { ability, dc, onSuccess, damageRoll } };
  const toHitLine = line({ label: "To hit", expression: `1d20${toHit >= 0 ? "+" : ""}${toHit}`, mode: mode || "normal" });
  return { ...base, rolls: [toHitLine, ...damage], attack: { toHit, count, critOn } };
}