import React, { useState } from "react";
import { INK, InkRemove } from "../../../../styles/parchment";
import { Hint, NumberInput, PickerRow, PickerShell, Segmented, Switch, Tag, chipBtn, inputSm } from "../../../../styles/parchmentForm";

/* ---------- ids & helpers ---------- */

const newId = () =>
  globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const asList = (v) => (Array.isArray(v) ? v : []);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

export const spellKey = (s) => `${s.name}|${s.source}`;

// Kept for callers that still import it; same look as the shared filter chips.
export const chipCls = chipBtn;

/* ---------- stored shape ----------
   One shape for the page and the adjuster. Every field is filled in and
   clamped here, so nothing else has to guess.

   prepared  true when the player prepared it, or when innate/at_will
             (those are always prepared). Only manual prepares count
             toward the prepared limit.
   innate    always prepared; `uses` is set only when the uses are limited.
   at_will   always prepared; costs no spell slot. Never has `uses`.
   uses      { max, current, reset: "short" | "long" | null } or null.
   granted_by and available_at come from the adjuster; both are null
   for a spell the player added. */

function normalizeUses(u) {
  if (!u || typeof u !== "object") return null;
  const max = Math.max(0, Number(u.max) || 0);
  const current = Math.min(max, Math.max(0, Number(u.current ?? max) || 0));
  const reset = u.reset === "long" || u.reset === "short" ? u.reset : null;
  return { max, current, reset };
}

export function normalizeSpell(r = {}) {
  const innate = !!r.innate;
  const atWill = !innate && !!r.at_will;
  const level = Number(r.level ?? 0) || 0;
  const manualPrepared = level >= 1 && !innate && !atWill && !!r.prepared;

  return {
    id: r.id || newId(),
    name: r.name ?? "",
    source: r.source ?? "",
    level,
    school: r.school ?? "",
    concentration: !!r.concentration,
    ritual: !!r.ritual,
    time: asList(r.time),
    range: r.range ?? null,
    duration: asList(r.duration),
    components: {
      v: !!r.components?.v,
      s: !!r.components?.s,
      m: !!r.components?.m,
      material: r.components?.material ?? "",
    },
    granted_by: r.granted_by ?? null,
    available_at: r.available_at ?? null,
    prepared: innate || atWill || manualPrepared,
    innate,
    at_will: atWill,
    uses: innate ? normalizeUses(r.uses) : null,
  };
}

/* A catalogue entry (from useCatalogueStore) turned into a known spell.
   Time, range and duration are copied as they are in the catalogue.
   Components are trimmed to v / s / m plus the material text. */
export function spellFromCatalogue(entry) {
  const c = entry.components ?? {};
  return normalizeSpell({
    name: entry.name,
    source: entry.source,
    level: entry.level,
    school: entry.school,
    ritual: entry.ritual,
    concentration: entry.concentration ?? asList(entry.duration)[0]?.concentration,
    time: entry.time,
    range: entry.range,
    duration: entry.duration,
    components: {
      v: c.v,
      s: c.s,
      m: !!c.m,
      material: typeof c.m === "string" ? c.m : "",
    },
  });
}

/* ---------- labels ---------- */

function castTimeLabel(time) {
  const t = asList(time)[0];
  if (!t) return "";
  const n = t.number ?? 1;
  const unit = t.unit ?? "";
  if (n === 1 && ["action", "bonus", "reaction"].includes(unit)) return cap(unit);
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

function rangeLabel(range) {
  if (!range) return "";
  const d = range.distance;
  if (!d) return cap(range.type ?? "");
  if (d.type === "self") return "Self";
  if (d.type === "touch") return "Touch";
  if (d.type === "feet") return `${d.amount} ft`;
  if (d.type === "miles") return `${d.amount} mi`;
  return cap(d.type ?? "");
}

function durationLabel(duration) {
  const d = asList(duration)[0];
  if (!d) return "";
  if (d.type === "timed" && d.duration) {
    const { amount, type } = d.duration;
    return `${amount} ${type}${amount === 1 ? "" : "s"}`;
  }
  return cap(d.type ?? "");
}

/* ---------- filtering ----------
   Tokens look like "state:prepared" or "lvl:3". Tokens in the same
   group combine with OR, and different groups combine with AND.
   No tokens means everything is shown. */

export function matchesFilters(spell, tokens) {
  if (!tokens.length) return true;
  const groups = {};
  for (const t of tokens) {
    const [group] = t.split(":");
    if (!groups[group]) groups[group] = [];
    groups[group].push(t);
  }
  return Object.values(groups).every((list) => list.some((t) => tokenMatches(spell, t)));
}

function tokenMatches(spell, token) {
  const [group, value] = token.split(":");
  switch (group) {
    case "state":
      if (value === "prepared") return spell.prepared;
      if (value === "unprepared") return !spell.prepared;
      if (value === "innate") return spell.innate;
      if (value === "at_will") return spell.at_will;
      return false;
    case "prop":
      if (value === "ritual") return spell.ritual;
      if (value === "concentration") return spell.concentration;
      return false;
    case "comp":
      return !!spell.components?.[value];
    case "lvl":
      return String(spell.level) === value;
    case "school":
      return spell.school === value;
    default:
      return false;
  }
}

/* ---------- known-spell card ----------
   Top half opens the catalogue card in a popup. The controls underneath
   only change this spell's own fields. */

const MODES = [
  { value: "normal", label: "Normal", hint: "Uses spell slots; can be prepared" },
  { value: "innate", label: "Innate", hint: "Always prepared; optionally limited uses" },
  { value: "at_will", label: "At will", hint: "Always prepared; costs no slot" },
];

// Written like a spellbook entry: the name (opens the card) with its
// school, casting details and components on one line; how you have the
// spell — normal / innate / at will, prepared, limited uses — on the next.
export function SpellCard({ spell, onOpen, onSetMode, onTogglePrepared, onChangeUses, onSetLimited, onRemove }) {
  const mode = spell.innate ? "innate" : spell.at_will ? "at_will" : "normal";
  const canPrepare = mode === "normal" && spell.level >= 1;
  const comps = ["v", "s", "m"].filter((k) => spell.components?.[k]).map((k) => k.toUpperCase());
  const meta = [castTimeLabel(spell.time), rangeLabel(spell.range), durationLabel(spell.duration)].filter(Boolean);
  const dim = canPrepare && !spell.prepared;

  return (
    <div className="group py-1.5">
      <div className="flex items-baseline gap-1.5">
        <span className="w-5 shrink-0 self-center">
          {canPrepare && <Switch checked={spell.prepared} onChange={() => onTogglePrepared(spell)} label={spell.prepared ? "Prepared" : "Not prepared"} />}
        </span>
        <button
          type="button"
          onClick={onOpen}
          title="Open the spell card"
          className={`truncate text-left text-[15px] hover:underline hover:decoration-dotted hover:underline-offset-4 ${dim ? INK.faded : ""}`}
        >
          {spell.name}
        </button>
        {spell.school && <span className={`shrink-0 text-xs italic ${INK.faint}`}>{cap(spell.school)}</span>}
        <span aria-hidden="true" className="mx-1 min-w-[0.75rem] flex-1 translate-y-[-4px] border-b-2 border-dotted border-rule/35" />
        <span className={`hidden shrink-0 text-xs italic @lg:inline ${INK.faded}`}>{meta.join(" · ")}</span>
        <span className={`shrink-0 text-[10px] font-semibold tracking-wider ${INK.rubric}`}>
          {[...comps, spell.concentration ? "C" : null, spell.ritual ? "R" : null].filter(Boolean).join(" ")}
        </span>
        <span className="opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <InkRemove onClick={() => window.confirm(`Remove ${spell.name} from the spellbook?`) && onRemove(spell)} label={`Remove ${spell.name}`} />
        </span>
      </div>

      <div className="ml-[26px] flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Segmented size="sm" options={MODES} value={mode} onChange={(m) => onSetMode(spell, m)} />

        {mode === "innate" && (
          <span className={`inline-flex items-baseline gap-1.5 text-[13px] ${INK.faded}`}>
            <span className="self-center">
              <Switch checked={!!spell.uses} onChange={(on) => onSetLimited(spell, on)} label="Limited uses" />
            </span>
            {spell.uses ? (
              <>
                <NumberInput value={spell.uses.max} min={1} max={20} fallback={1} onChange={(v) => onChangeUses(spell, { max: v })} size="sm" className="w-7" aria-label="Uses per rest" />
                <span>per</span>
                <select value={spell.uses.reset ?? ""} onChange={(e) => onChangeUses(spell, { reset: e.target.value || null })} className={`${inputSm} cursor-pointer`} aria-label="Uses come back on">
                  <option value="long">long rest</option>
                  <option value="short">short rest</option>
                  <option value="">never</option>
                </select>
              </>
            ) : (
              <span className="italic">limited uses</span>
            )}
          </span>
        )}

        {(spell.granted_by || spell.available_at != null) && (
          <span className={`text-xs italic ${INK.faded}`}>
            {spell.granted_by && <>from {spell.granted_by}</>}
            {spell.available_at != null && <> · gained at level {spell.available_at}</>}
          </span>
        )}
        {canPrepare && <span className={`text-[11px] italic ${spell.prepared ? INK.rubric : INK.faint}`}>{spell.prepared ? "prepared" : "not prepared"}</span>}
      </div>
    </div>
  );
}

/* ---------- catalogue picker ----------
   Search by name or source. Click a name to open its card; Add picks the
   spell and the list stays open so several can be added. */

const MAX_ROWS = 80;

export function SpellPicker({ entries, knownKeys, onOpen, onAdd, onClose }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const all = asList(entries).filter((e) => e?.name);
  const rows = all
    .filter((e) => !q || e.name.toLowerCase().includes(q) || String(e.source || "").toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PickerShell
      title="Add spells"
      query={query}
      onQuery={setQuery}
      placeholder="search spells by name or source…"
      onClose={onClose}
      footer={`${rows.length > MAX_ROWS ? `first ${MAX_ROWS} of ${rows.length} — type to narrow` : `${rows.length} of ${all.length}`} · click a name to view its card`}
    >
      {rows.length === 0 && <Hint className="py-2">{all.length ? "Nothing matches." : "Fetching the catalogue…"}</Hint>}
      {rows.slice(0, MAX_ROWS).map((entry) => {
        const known = knownKeys.has(spellKey(entry));
        return (
          <PickerRow
            key={spellKey(entry)}
            name={entry.name}
            onOpen={() => onOpen(entry)}
            meta={
              <>
                <Tag>{Number(entry.level) === 0 ? "cantrip" : `lvl ${entry.level}`}</Tag>
                {entry.school && <Tag className="hidden @lg:inline">{entry.school}</Tag>}
              </>
            }
            source={entry.source}
            highlight={known}
            action={{ label: known ? "added" : "add", disabled: known, onClick: () => onAdd(entry) }}
          />
        );
      })}
    </PickerShell>
  );
}