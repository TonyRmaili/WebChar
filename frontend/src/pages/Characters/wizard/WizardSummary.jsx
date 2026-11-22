import React, { useMemo } from "react";
import { INK } from "../../../styles/parchment";
import { ABILITY_SHORT, labelFromId } from "../../Catalogues/catalogueHelpers";

/* ═══════════════════════════════════════════════════════════════════
   WizardSummary — the margin beside the wizard: what the picks add up
   to so far, straight from the server's preview (the same rules the
   saved character will use). Nothing here is worked out on its own.
   ═══════════════════════════════════════════════════════════════════ */

const signed = (n) => (n == null ? "—" : n >= 0 ? `+${n}` : `${n}`);
const ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

const PROFS = [
  ["saves", "Saving throws", (v) => ABILITY_SHORT[v] || v],
  ["skills", "Skills"],
  ["expertise", "Expertise"],
  ["armor", "Armour"],
  ["weapons", "Weapons"],
  ["tools", "Tools"],
  ["languages", "Languages"],
];

function Line({ label, children }) {
  if (!children || (Array.isArray(children) && !children.length)) return null;
  return (
    <div className="text-sm leading-snug">
      <span className={`text-[11px] font-semibold uppercase tracking-[0.15em] ${INK.faded}`}>{label} </span>
      <span>{children}</span>
    </div>
  );
}

export default function WizardSummary({ preview, loading, error }) {
  const merged = useMemo(() => {
    const out = {};
    for (const l of preview?.layers || []) {
      for (const [k, v] of Object.entries(l.grants || {})) {
        if (Array.isArray(v) && v.every((x) => typeof x === "string")) out[k] = [...new Set([...(out[k] || []), ...v])];
        else if (["speed", "senses"].includes(k)) out[k] = { ...(out[k] || {}), ...v };
        else if (k === "defenses") for (const [d, list] of Object.entries(v || {})) out[`def_${d}`] = [...new Set([...(out[`def_${d}`] || []), ...(list || [])])];
      }
    }
    return out;
  }, [preview]);

  if (!preview) return <p className={`text-sm italic ${INK.faint}`}>{error ? `The preview isn't available: ${error}` : loading ? "Working it out…" : ""}</p>;

  const d = preview.derived || {};
  const feats = (preview.layers || []).filter((l) => l.from.startsWith("feat:"));
  const subclassLabel = Object.fromEntries(
    (preview.choices || []).filter((c) => c.grant === "subclass").flatMap((c) => (c.options || []).map((o) => [o.value, o.label]))
  );
  const subclasses = (preview.layers || []).map((l) => l.grants?.subclass).filter(Boolean);
  const spellsByLevel = {};
  for (const s of preview.spells || []) (spellsByLevel[s.level ?? 0] ||= []).push(s.name);
  const open = (preview.choices || []).filter((c) => c.missing > 0).length;
  const slots = d.spell_slots || {};

  return (
    <div className={`space-y-3 ${loading ? "opacity-70" : ""}`}>
      <div className="flex items-baseline justify-between">
        <span className={`text-[11px] font-semibold uppercase tracking-[0.25em] ${INK.rubric}`}>So far</span>
        {loading && <span className={`text-xs italic ${INK.faint}`}>updating…</span>}
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[["Level", d.level], ["HP", d.hp_max], ["AC", d.ac], ["PB", signed(d.pb)]].map(([k, v]) => (
          <div key={k}>
            <div className="text-2xl tabular-nums">{v ?? "—"}</div>
            <div className={`text-[10px] uppercase tracking-wider ${INK.faint}`}>{k}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-6 gap-1 border-y border-rule/25 py-2 text-center">
        {Object.entries(d.abilities || {}).map(([a, v]) => (
          <div key={a}>
            <div className={`text-[10px] uppercase tracking-wider ${INK.faded}`}>{ABILITY_SHORT[a]}</div>
            <div className="text-lg tabular-nums">{v.score}</div>
            <div className={`text-xs ${INK.faint}`}>{signed(v.mod)}</div>
          </div>
        ))}
      </div>

      {subclasses.length > 0 && <Line label="Subclass">{subclasses.map((s) => subclassLabel[s] || labelFromId(s.split(":").pop())).join(", ")}</Line>}
      {PROFS.map(([key, label, fmt]) => (
        <Line key={key} label={label}>
          {(merged[key] || []).map((v) => (fmt ? fmt(v) : labelFromId(v))).join(", ")}
        </Line>
      ))}
      <Line label="Speed">{Object.entries(merged.speed || {}).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(", ")}</Line>
      <Line label="Senses">{Object.entries(merged.senses || {}).filter(([, v]) => typeof v === "number").map(([k, v]) => `${k} ${v} ft`).join(", ")}</Line>
      <Line label="Resists">{(merged.def_resist || []).join(", ")}</Line>
      <Line label="Feats">{feats.map((f) => f.label || labelFromId(f.from.slice(5))).join(", ")}</Line>

      {(slots.slots?.length > 0 || slots.pact?.length > 0) && (
        <Line label="Slots">
          {[...(slots.slots || []).map((n, i) => (n ? `${ORDINAL[i + 1]} ${n}` : null)), ...(slots.pact || []).map((p) => `pact ${p.count} × ${ORDINAL[p.level]}`)]
            .filter(Boolean)
            .join(" · ")}
        </Line>
      )}
      {Object.keys(spellsByLevel).length > 0 && (
        <div className="space-y-0.5">
          {Object.entries(spellsByLevel).map(([lv, names]) => (
            <Line key={lv} label={Number(lv) === 0 ? "Cantrips" : `${ORDINAL[lv]} level`}>
              {names.join(", ")}
            </Line>
          ))}
        </div>
      )}

      <Line label="Gear">
        {(preview.items || []).map((i) => `${i.qty > 1 ? `${i.qty} ` : ""}${i.name}${i.equipped ? " (worn)" : ""}`).join(", ")}
      </Line>
      <Line label="Money">{Object.entries(preview.currency || {}).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(", ")}</Line>

      <p className={`border-t border-rule/25 pt-2 text-sm italic ${open ? INK.rubric : INK.faint}`}>
        {open ? `${open} choice${open > 1 ? "s" : ""} still open` : "Every choice is made."}
      </p>
      {(preview.problems || []).length > 0 && (
        <ul className={`space-y-0.5 text-xs italic ${INK.rubric}`}>
          {preview.problems.map((p, i) => (
            <li key={i}>
              {p.from}: {p.problem}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
