import React from "react";
import { formatSpeed, formatSenses } from "../Catalogues/Races/raceHelpers";
import { ABILITIES_ORDER } from "../../utils/Constants";
import { labelFor, formatFeatTag } from "./wizard/wizardHelpers";
import { selectedValues, isResolved } from "./wizard/choiceEngine";
import { classDisplayName } from "./wizard/classEngine";

const METHOD_LABELS = {
  standard: "Standard Array",
  pointBuy: "Point Buy",
  random: "Rolled (3d6)",
  custom: "Custom",
};

const ABIL = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };
const fmtMod = (m) => (m == null ? "" : m >= 0 ? `+${m}` : `${m}`);

/* Collapse duplicate grants for display while remembering every owner,
   so a clash renders as one chip flagged with both sources rather than
   as two identical chips. */
function dedupe(entries = []) {
  const map = new Map();
  for (const e of entries) {
    const k = `${e.family}:${e.value}`;
    if (!map.has(k)) map.set(k, { ...e, owners: [] });
    const row = map.get(k);
    if (e.owner && !row.owners.includes(e.owner)) row.owners.push(e.owner);
  }
  return [...map.values()];
}

export default function Summary({
  editions,
  selectedRace,
  subrace,
  selectedBackground,
  classEntries = [],
  classes,
  stats,
  optionalFeatures = [],
  maxHp,
  grants,
  choices = [],
  choiceSel = {},
  overlap,
  choiceTitle,
  valueLabel,
  abilityMethod,
  abilityScores,
}) {
  const hasAnyScore =
    abilityScores && Object.values(abilityScores).some((v) => v != null);

  const g = grants || {};
  const skills = dedupe(g.skills);
  const tools = dedupe(g.tools);
  const languages = dedupe(g.languages);
  const weapons = dedupe(g.weapons);
  const armor = dedupe(g.armor);
  const feats = dedupe(g.feats);
  const classFeats = classEntries.flatMap((e) =>
    (e.feats || []).map((f) => ({ ...f, owner: classDisplayName(classes, e.key, e.edition) }))
  );

  const goldTotal = (g.equipment || []).reduce((sum, e) => sum + (e.gp || 0), 0);
  const gear = (g.equipment || []).filter((e) => !String(e.value).startsWith("gold:"));

  const pending = choices.filter(
    (c) => c.kind !== "subrace" && !isResolved(c, choiceSel[c.id], subrace)
  );

  return (
    <aside className="lg:flex-[1] shrink-0">
      <div className="sticky top-4 rounded-lg border border-slate-700 bg-slate-900/60 p-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-2">Summary</div>

        <div className="mt-0.5 mb-3">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 border border-slate-600/40 rounded px-1.5 py-0.5">
            {editions.length === 2
              ? "One D&D + Classic"
              : editions.includes("one")
              ? "One D&D"
              : "Classic"}
          </span>
        </div>

        {/* ───────── ability scores ───────── */}
        {abilityScores && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[10px] uppercase tracking-wider text-amber-400">
                Ability Scores
              </div>
              <span className="text-[10px] text-slate-500">
                {METHOD_LABELS[abilityMethod] || ""}
              </span>
            </div>

            {hasAnyScore ? (
              <div className="grid grid-cols-3 gap-1.5">
                {ABILITIES_ORDER.map(({ key, label }) => {
                  const base = abilityScores[key];
                  const bonus = g.abilities?.[key] || 0;
                  const total = base == null ? null : base + bonus;
                  const mod = total == null ? null : Math.floor((total - 10) / 2);

                  return (
                    <div
                      key={key}
                      className="rounded-lg border border-slate-700/70 bg-slate-800/40 px-1 py-1.5 text-center"
                    >
                      <div className="text-[9px] font-bold uppercase tracking-wider text-amber-400/80">
                        {label}
                      </div>
                      <div
                        className={`text-lg font-bold leading-tight tabular-nums ${
                          total == null ? "text-slate-600" : "text-amber-50"
                        }`}
                      >
                        {total == null ? "—" : total}
                      </div>
                      <div className="text-[9px] tabular-nums text-slate-400">
                        {fmtMod(mod)}
                        {bonus ? (
                          <span className="text-amber-300/70">
                            {" "}({base}{bonus >= 0 ? "+" : ""}{bonus})
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No scores assigned yet.</p>
            )}
          </div>
        )}

        {/* ───────── overlap warnings ───────── */}
        {overlap?.collisions?.length > 0 && (
          <div className="mb-3 rounded border border-rose-500/40 bg-rose-500/10 p-2">
            <div className="text-[10px] uppercase tracking-wider text-rose-300 mb-1">
              Overlapping grants
            </div>
            <ul className="space-y-1">
              {overlap.collisions.map((c) => (
                <li key={`${c.family}:${c.value}`} className="text-[11px] text-rose-200/90 leading-snug">
                  <span className="font-semibold">{c.label}</span>{" "}
                  <span className="text-rose-300/70">
                    from {c.owners.join(" + ")}
                    {c.resolvable ? " — pick something else" : " — duplicated"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!selectedRace && !selectedBackground && classEntries.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Nothing selected yet.</p>
        ) : (
          <div className="space-y-3 text-sm border-t border-slate-700/60 pt-3">
            {classEntries.length > 0 && (
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    {classEntries.length > 1 ? "Classes" : "Class"}
                  </div>
                  <span className="text-[10px] text-amber-300/80">
                    Level {stats?.totalLevel ?? 0}
                    {stats?.proficiencyBonus != null && ` · PB +${stats.proficiencyBonus}`}
                  </span>
                </div>

                <div className="space-y-0.5">
                  {classEntries.map((e) => (
                    <div key={e.key} className="text-slate-200 text-[13px]">
                      {classDisplayName(classes, e.key, e.edition)}{" "}
                      <span className="tabular-nums text-amber-200">{e.level}</span>
                      {e.subclass && (
                        <span className="text-cyan-300/90"> · {e.subclass}</span>
                      )}
                      <span className="text-[10px] text-slate-500">
                        {" "}({e.edition === "one" ? "One" : "Classic"})
                      </span>
                    </div>
                  ))}
                </div>

                {stats?.hitDice?.length > 0 && (
                  <div className="mt-1 text-[11px] text-slate-400">
                    Hit dice: {stats.hitDice.map((h) => h.label).join(" + ")}
                    {maxHp > 0 && (
                      <span className="text-amber-300/80"> · {maxHp} HP</span>
                    )}
                  </div>
                )}

                {stats?.saves?.length > 0 && (
                  <div className="text-[11px] text-slate-400">
                    Saves: {stats.saves.map((s) => ABIL[s] || s.toUpperCase()).join(", ")}
                  </div>
                )}
              </div>
            )}

            {stats?.spellSlots && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                  Spell Slots
                </div>
                <div className="flex flex-wrap gap-1">
                  {stats.spellSlots.map((n, i) =>
                    n > 0 ? (
                      <span
                        key={i}
                        className="text-[11px] tabular-nums bg-slate-800 border border-slate-700
                                   rounded px-1.5 py-0.5 text-slate-200"
                      >
                        <span className="text-slate-500">{i + 1}º</span> {n}
                      </span>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {stats?.spellNote && (
              <p className="text-[11px] text-amber-300/80 italic">{stats.spellNote}</p>
            )}

            {optionalFeatures.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                  Feature Choices
                </div>
                {optionalFeatures.map((f, i) => (
                  <div key={i} className="text-[11px] text-slate-400">
                    {f.name}
                    <span className="text-amber-300/70"> ×{f.count}</span>
                    <span className="text-slate-600 italic"> · not pickable yet</span>
                  </div>
                ))}
              </div>
            )}

            {selectedRace && (
              <SummaryRow label="Race" value={`${selectedRace.name} · ${selectedRace.source}`} />
            )}
            {subrace && (
              <SummaryRow label="Subrace" value={subrace.display_name || subrace.name} />
            )}
            {selectedBackground && (
              <SummaryRow
                label="Background"
                value={`${selectedBackground.name} · ${selectedBackground.source}`}
              />
            )}

            {Object.keys(g.abilities || {}).length > 0 && (
              <SummaryChips
                label="Ability Bonuses"
                items={Object.entries(g.abilities).map(
                  ([k, v]) => `${ABIL[k] || k.toUpperCase()} ${v >= 0 ? "+" : ""}${v}`
                )}
              />
            )}

            {formatSpeed(g.speed) && <SummaryRow label="Speed" value={formatSpeed(g.speed)} />}
            {formatSenses(g.senses) && <SummaryRow label="Senses" value={formatSenses(g.senses)} />}

            <GrantChips label="Skills" entries={skills} />
            <GrantChips label="Tools" entries={tools} />
            <GrantChips label="Languages" entries={languages} />
            <GrantChips label="Weapons" entries={weapons} />
            <GrantChips label="Armor" entries={armor} />

            {feats.length > 0 && (
              <SummaryChips label="Origin Feats" items={feats.map((f) => formatFeatTag(f.value))} />
            )}

            {classFeats.length > 0 && (
              <SummaryChips label="Class Feats" items={classFeats.map((f) => f.name)} />
            )}

            {(gear.length > 0 || goldTotal > 0) && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                  Equipment
                  {goldTotal > 0 && (
                    <span className="ml-1.5 text-amber-300/80 normal-case">{goldTotal} GP</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {gear.map((e, i) => (
                    <span
                      key={`${e.value}-${i}`}
                      className="text-[11px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200"
                    >
                      {e.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {g.traits?.length > 0 && (
              <SummaryRow
                label="Traits"
                value={`${g.traits.length} trait${g.traits.length > 1 ? "s" : ""}`}
              />
            )}

            {/* ───────── outstanding choices ───────── */}
            {pending.length > 0 && (
              <div className="pt-2 border-t border-slate-700/60">
                <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1.5">
                  Still to choose
                </div>
                <div className="space-y-1.5">
                  {pending.map((c) => {
                    const sel = selectedValues(c, choiceSel[c.id]);
                    return (
                      <div key={c.id} className="text-xs">
                        <span className="text-slate-400">{choiceTitle(c)}:</span>{" "}
                        {sel.length ? (
                          <span className="text-amber-200">
                            {sel.map((v) => valueLabel(c, v)).join(", ")}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">pending ({c.count})</span>
                        )}
                        <span className="text-slate-600 italic"> · {c.owner}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-slate-200">{value}</div>
    </div>
  );
}

function SummaryChips({ label, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((it, i) => (
          <span
            key={i}
            className="text-[11px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200"
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

/* Chips that carry their owner in a tooltip and turn red when more
   than one source granted the same thing. */
function GrantChips({ label, entries }) {
  if (!entries?.length) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {entries.map((e) => {
          const clash = e.owners.length > 1;
          return (
            <span
              key={`${e.family}:${e.value}`}
              title={`${clash ? "Granted twice by " : "From "}${e.owners.join(", ")}`}
              className={`text-[11px] rounded px-1.5 py-0.5 border ${
                clash
                  ? "bg-rose-500/10 border-rose-500/50 text-rose-200"
                  : "bg-slate-800 border-slate-700 text-slate-200"
              }`}
            >
              {labelFor(e.value, e.family)}
              {clash && <span className="ml-1 opacity-70">⚠</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}