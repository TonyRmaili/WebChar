import React, { useState } from "react";
import useCharStore from "../../../../store/CharStore";
import { Pips, blankNumber, note, stamp } from "./PlayParts";
import { manualAdd, setManualAdd, useSheet } from "../sheetHelpers";
import { castingRows } from "../spellbookHelpers";
import {
  CONDITIONS,
  NO_DEATH_SAVES,
  cap,
  concentrationDc,
  conditionsOf,
  deathSavesOf,
  exhaustionOf,
  healthOf,
  hitDiceList,
  hpToStore,
  hpTone,
  signedNum,
  speedSummary,
  toStoredSaves,
} from "./healthHelpers";

/* Health section of the Play panel, written on the Play sheet
   (parchment): no boxes — each block is a small-caps heading with a
   hairline, numbers are inked large, blanks are dotted lines, buttons
   are inked outlines (damage in bad-red, healing in good-green).

   Three blocks that sit side by side at full width and stack at half:
   Vitals (HP, damage/heal, death saves at 0 HP) ·
   Combat (AC, initiative, speed, passive perception, attacks, DCs,
   resistances and immunities) ·
   Status (toggles, concentration checks, conditions, exhaustion,
   hit dice, this character's rests).

   Works on the character open in CharStore (version-2 file). The numbers
   come from utils/derive.js; live values sit in `state` (healthHelpers.js).
   Damage, healing and rests go through the server's rules; everything
   else is a change to `state`, saved by the store (patchChar). "Max ±"
   is the player's own hp_max modifier in the manual layer. */

/* ─── Small parts ────────────────────────────────────────────────── */

// A number field you can clear and retype: the value is applied on
// Enter or when leaving the field, not on every keystroke.
function NumberField({ value, onCommit, min, max, className = "", ariaLabel }) {
  const [draft, setDraft] = useState(null);

  const commit = () => {
    if (draft == null) return;

    const n = Math.trunc(Number(draft));

    if (String(draft).trim() !== "" && Number.isFinite(n)) {
      let v = n;

      if (min != null) v = Math.max(min, v);
      if (max != null) v = Math.min(max, v);

      if (v !== value) onCommit(v);
    }

    setDraft(null);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      value={draft ?? value}
      min={min}
      max={max}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
      aria-label={ariaLabel}
      className={`bg-transparent text-center tabular-nums focus:outline-none
                  [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${className}`}
    />
  );
}

// A small-caps label with a hairline running to the right.
function Label({ children, right, className = "" }) {
  return (
    <div className={`mb-1.5 flex items-baseline gap-2 ${className}`}>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faded">{children}</span>
      <span className="h-px flex-1 translate-y-[-3px] bg-rule/25" />
      {right}
    </div>
  );
}

function Block({ title, children, className = "" }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <Label>{title}</Label>
      {children}
    </div>
  );
}

// A big inked number with its name in small caps underneath.
function StatTile({ label, value, hint, roll = null }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-1.5" title={hint}>
      <span className="text-[1.7rem] font-semibold leading-tight tabular-nums text-ink">
        {value}
        {roll && <span className={`ml-1 text-xs italic ${roll === "adv" ? "text-rubric" : "text-ink-faded"}`} title={roll === "adv" ? "with advantage" : "with disadvantage"}>{roll}</span>}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faded">{label}</span>
    </div>
  );
}

// "TEMP 6" written on a dotted blank.
function SmallField({ label, children }) {
  return (
    <label className="flex items-baseline gap-1.5 border-b border-dotted border-rule/70 px-0.5 focus-within:border-solid focus-within:border-ink">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faded">{label}</span>
      {children}
    </label>
  );
}

// hpTone() names → theme slots
const BAR = { emerald: "bg-good", amber: "bg-warn", red: "bg-bad", slate: "bg-rule/50" };
const NUM = { emerald: "text-good", amber: "text-warn", red: "text-bad", slate: "text-ink-faded" };

// Buttons: stamp() (inked outlines) and note (margin notes) come from PlayParts.

const TOGGLES = [
  { field: "reaction", label: "Reaction" },
  { field: "concentration", label: "Concentration" },
  { field: "heroic_inspiration", label: "Heroic Inspiration" },
  { field: "bardic_inspiration", label: "Bardic Inspiration" },
];

// Three dots per row. Clicking the n-th dot sets the count to n, clicking
// the last filled dot again lowers it by one.
function SaveRow({ label, count, tone, onSet }) {
  const on = tone === "good" ? "bg-good border-good" : "bg-bad border-bad";
  const off = tone === "good" ? "border-good/40" : "border-bad/40";
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-xs text-ink-faded">{label}</span>
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSet(count === n ? n - 1 : n)}
          aria-label={`${label}: ${n}`}
          className={`h-4 w-4 rounded-full border-[1.5px] transition hover:scale-110 ${n <= count ? on : off}`}
        />
      ))}
    </div>
  );
}

function DeathSaves({ saves, onChange }) {
  const status = saves.success >= 3 ? "Stable" : saves.fail >= 3 ? "Dead" : "Dying";
  const statusTone = { Stable: "text-good", Dead: "text-bad", Dying: "text-warn" }[status];
  return (
    <div className="mt-3 border-l-2 border-bad/60 pl-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-bad">Death Saves</span>
        <span className={`text-sm font-semibold ${statusTone}`}>{status}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <SaveRow label="Successes" count={saves.success} tone="good" onSet={(n) => onChange({ ...saves, success: n })} />
        <SaveRow label="Failures" count={saves.fail} tone="bad" onSet={(n) => onChange({ ...saves, fail: n })} />
        <button type="button" onClick={() => onChange(NO_DEATH_SAVES)} className={`ml-auto ${note} text-ink-faded hover:text-rubric`}>
          reset
        </button>
      </div>
      <p className="mt-1.5 text-xs italic text-ink-faded">Damage while at 0 HP adds a failure. Any healing clears these.</p>
    </div>
  );
}

function ConcentrationChecks({ checks, onKept, onLost, bonus = null, roll = null }) {
  if (checks.length === 0) return null;
  const dc = checks[0];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-l-2 border-warn pl-2.5">
      <span className="text-sm text-ink">
        Concentration check: <span className="font-semibold text-warn">CON save DC {dc}</span>
        {bonus != null && <span className="text-ink-faded"> · you roll {signedNum(bonus)}{roll ? ` with ${roll === "adv" ? "advantage" : "disadvantage"}` : ""}</span>}
        {checks.length > 1 && <span className="italic text-ink-faded"> (+{checks.length - 1} more)</span>}
      </span>
      <div className="ml-auto flex gap-1.5">
        <button type="button" onClick={onKept} className={`h-7 px-2 text-xs ${stamp("good")}`}>
          Kept
        </button>
        <button type="button" onClick={onLost} className={`h-7 px-2 text-xs ${stamp("bad")}`}>
          Lost
        </button>
      </div>
    </div>
  );
}

function Conditions({ active, onToggle }) {
  const [picking, setPicking] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {active.map((c) => (
          <button key={c} type="button" onClick={() => onToggle(c)} title="Click to remove" className="text-sm font-semibold text-bad hover:line-through">
            {c} <span className="text-xs font-normal">✕</span>
          </button>
        ))}
        <button type="button" onClick={() => setPicking((p) => !p)} className={`${note} text-rubric hover:text-rubric-deep`}>
          {picking ? "done" : active.length ? "+ condition" : "+ add condition"}
        </button>
      </div>
      {picking && (
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 border-l border-rule/30 pl-2.5 text-[13px]">
          {CONDITIONS.map((c, i) => {
            const on = active.includes(c);
            return (
              <React.Fragment key={c}>
                {i > 0 && <span className="text-ink-faint">·</span>}
                <button
                  type="button"
                  onClick={() => onToggle(c)}
                  aria-pressed={on}
                  className={`transition ${on ? "font-semibold text-bad underline decoration-dotted underline-offset-4" : "text-ink-faded hover:text-ink"}`}
                >
                  {c}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Resistances, immunities, vulnerabilities and condition immunities, one
// line each (only the kinds the character has). From Define → General,
// grants, items and switched-on features (derive's `defenses`).
const DEFENSE_LINES = [
  { key: "resist", label: "Resistant", tone: "text-ink" },
  { key: "immune", label: "Immune", tone: "font-semibold text-ink" },
  { key: "vulnerable", label: "Vulnerable", tone: "text-bad" },
  { key: "condition_immune", label: "Can't be", tone: "text-ink" },
];
const defenseWord = (id) => String(id).replace(/_/g, " ");
function Defenses({ defenses = {} }) {
  const lines = DEFENSE_LINES.filter((l) => (defenses[l.key] || []).length);
  return (
    <div className="mt-2 border-t border-rule/20 pt-2">
      {lines.length === 0 ? (
        <p className="text-xs italic text-ink-faded">No resistances or immunities.</p>
      ) : (
        lines.map((l) => (
          <div key={l.key} className="flex items-baseline gap-2 py-0.5">
            <span className="w-[5.5rem] shrink-0 text-[10px] font-semibold uppercase tracking-wider text-ink-faded">{l.label}</span>
            <span className={`min-w-0 text-sm ${l.tone}`}>{defenses[l.key].map(defenseWord).join(" · ")}</span>
          </div>
        ))
      )}
    </div>
  );
}

function Exhaustion({ level, onSet }) {
  return (
    <div
      className="flex items-center gap-2"
      title="2024 rules: each level gives −2 to d20 Tests and −5 ft speed. Level 6 is death."
    >
      <span className="w-20 text-xs text-ink-faded">Exhaustion</span>
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSet(level === n ? n - 1 : n)}
          aria-label={`Exhaustion level ${n}`}
          className={`h-4 w-4 rotate-45 scale-[0.8] border-[1.5px] transition hover:scale-95 ${
            n <= level ? (n === 6 ? "border-bad bg-bad" : "border-warn bg-warn") : "border-rule/60"
          }`}
        />
      ))}
      <span className={`ml-auto text-xs tabular-nums ${level ? "font-semibold text-warn" : "italic text-ink-faded"}`}>
        {level ? `Level ${level}` : "None"}
      </span>
    </div>
  );
}

/* ─── Section ────────────────────────────────────────────────────── */

export default function HealthPlay() {
  const { ch, d, patchChar } = useSheet();
  const applyHp = useCharStore((s) => s.changeHp);
  const restChar = useCharStore((s) => s.rest);

  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  // Concentration save DCs still to roll. Screen-only, never saved.
  const [concChecks, setConcChecks] = useState([]);

  if (!ch || !d) return null;

  const state = ch.state || {};
  const { max: maxHp, cur, temp, barrier } = healthOf(ch, d);
  const tone = hpTone(cur, maxHp);
  const pct = maxHp > 0 ? Math.min(100, (cur / maxHp) * 100) : 0;

  const hitDice = hitDiceList(d, ch);
  const speed = speedSummary(d);
  const deathSaves = deathSavesOf(ch);
  const conditions = conditionsOf(ch);
  const exhaustion = exhaustionOf(ch);
  const hasDeathSaves = deathSaves.success > 0 || deathSaves.fail > 0;
  const attacks = [
    { type: "melee", base: "str", total: d.attacks.melee },
    { type: "ranged", base: "dex", total: d.attacks.ranged },
  ];
  // Spellcasting: one line per ability (the classes that use it, or your own).
  const casting = castingRows(d);

  /* ---- writers ---- */

  // Every change here is a click or a finished number: save right away.
  // Always from the newest character, so a reply from the server in
  // between (damage, a rest) is never written over.
  const saveState = (patch) => {
    const latest = useCharStore.getState().charData || ch;
    return patchChar({ state: { ...(latest.state || {}), ...patch } }, { now: true });
  };
  const save = (patch) => patchChar(patch, { now: true });

  const setCurrent = (v) => {
    const patch = { hp_current: hpToStore(v, maxHp) };
    // Coming back above 0 HP clears the death saves.
    if (v > 0 && hasDeathSaves) patch.death_saves = toStoredSaves(NO_DEATH_SAVES);
    saveState(patch);
  };

  // Damage and healing go through the server, which applies the barrier
  // and temp HP rules and saves the file; the store shows the new state.
  const changeHp = async (delta) => {
    if (!delta || busy) return;
    const wasDown = cur <= 0;
    setBusy(true);
    setProblem(null);
    try {
      await applyHp(delta);
      if (delta < 0) {
        if (state.concentration) setConcChecks((list) => [...list, concentrationDc(delta)]);
        if (wasDown) saveState({ death_saves: toStoredSaves({ ...deathSaves, fail: Math.min(3, deathSaves.fail + 1) }) });
      }
    } catch (e) {
      setProblem(`Couldn't change HP — ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleCondition = (name) => saveState({ conditions: conditions.includes(name) ? conditions.filter((c) => c !== name) : [...conditions, name] });

  const resolveConcentration = (kept) => {
    setConcChecks((list) => (kept ? list.slice(1) : []));
    if (!kept) saveState({ concentration: null });
  };

  const applyAmount = (sign) => {
    const n = Math.trunc(Number(amount));
    if (!Number.isFinite(n) || n <= 0) return;
    changeHp(sign * n);
    setAmount("");
  };

  const rest = async (kind) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await restChar(kind);
      setConcChecks([]);
    } catch (e) {
      setProblem(`Couldn't rest — ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  // Spending a die raises the used count; the pips show what's left.
  const setHitDie = (die, left, max) =>
    saveState({ hit_dice_used: { ...(state.hit_dice_used || {}), [die]: Math.max(0, Math.min(max, max - left)) } });

  /* ---- render ---- */

  const quick = "h-7 min-w-[2.5rem] px-2 text-xs tabular-nums";

  return (
    <div className="@container">
      {problem && <p className="mb-3 text-sm italic text-bad">{problem}</p>}
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 @xl:grid-cols-2 @5xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {/* ── Vitals ── */}
        <Block title="Hit Points" className="@xl:col-span-2 @5xl:col-span-1">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <div className="flex items-baseline gap-1">
              <NumberField
                value={cur}
                min={0}
                max={maxHp}
                onCommit={setCurrent}
                ariaLabel="Current HP"
                className={`w-[4.5rem] rounded-sm text-[2.6rem] font-semibold leading-none hover:bg-ink/[0.05] focus:bg-ink/[0.07] ${NUM[tone]}`}
              />
              <span className="text-xl text-ink-faded">/ {maxHp}</span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 pb-1">
              <SmallField label="Temp">
                <NumberField value={temp} min={0} onCommit={(v) => saveState({ hp_temp: v })} ariaLabel="Temporary HP" className="w-10 text-[15px] font-semibold text-info" />
              </SmallField>
              <SmallField label="Barrier">
                <NumberField value={barrier} min={0} onCommit={(v) => saveState({ hp_barrier: v })} ariaLabel="Barrier" className="w-10 text-[15px] font-semibold text-magic" />
              </SmallField>
              <SmallField label="Max ±">
                <NumberField
                  value={manualAdd(ch, "hp_max")}
                  onCommit={(v) => save(setManualAdd(ch, "hp_max", v))}
                  ariaLabel="Max HP modifier"
                  className="w-10 text-[15px] text-ink"
                />
              </SmallField>
            </div>
          </div>

          {/* HP bar, with temp HP and barrier as thin bars underneath */}
          <div className="mt-2 space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-rule/20">
              <div className={`h-full rounded-full transition-all ${BAR[tone]}`} style={{ width: `${pct}%` }} />
            </div>
            {(temp > 0 || barrier > 0) && (
              <div className="flex gap-1">
                {temp > 0 && <div className="h-1 rounded-full bg-info" style={{ width: `${Math.min(100, (temp / Math.max(1, maxHp)) * 100)}%` }} />}
                {barrier > 0 && <div className="h-1 rounded-full bg-magic" style={{ width: `${Math.min(100, (barrier / Math.max(1, maxHp)) * 100)}%` }} />}
              </div>
            )}
          </div>

          {/* Damage / heal */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={amount}
              placeholder="Amount"
              onChange={(e) => setAmount(e.target.value)}
              aria-label="Damage or heal amount"
              className={`h-8 w-20 ${blankNumber}`}
            />
            <button type="button" onClick={() => applyAmount(-1)} disabled={busy} className={`h-8 px-3 text-sm ${stamp("bad")}`}>
              Damage
            </button>
            <button type="button" onClick={() => applyAmount(1)} disabled={busy} className={`h-8 px-3 text-sm ${stamp("good")}`}>
              Heal
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {[-10, -5, -1].map((v) => (
              <button key={v} type="button" onClick={() => changeHp(v)} disabled={busy} className={`${quick} ${stamp("bad", true)}`}>
                {v}
              </button>
            ))}
            <span className="mx-1 w-px self-stretch bg-rule/30" />
            {[1, 5, 10].map((v) => (
              <button key={v} type="button" onClick={() => changeHp(v)} disabled={busy} className={`${quick} ${stamp("good", true)}`}>
                +{v}
              </button>
            ))}
          </div>

          {maxHp > 0 && (cur <= 0 || hasDeathSaves) && <DeathSaves saves={deathSaves} onChange={(v) => saveState({ death_saves: toStoredSaves(v) })} />}
        </Block>

        {/* ── Combat ── */}
        <Block title="Combat">
          {/* 2 × 2, split by hairlines */}
          <div className="grid grid-cols-2 [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(odd)]:border-r [&>*]:border-rule/25">
            <StatTile label="Armor Class" value={d.ac} />
            <StatTile label="Initiative" value={signedNum(d.initiative)} hint="DEX modifier + any initiative bonus" roll={d.rolls?.initiative} />
            <StatTile label="Speed" value={speed.walk ? `${speed.walk} ft` : "—"} hint={speed.others.length ? speed.others.join(" · ") : "Walking speed"} />
            <StatTile label="Passive Perc." value={d.skills.perception?.passive ?? "—"} hint={`10 + Perception skill${d.skills.perception?.roll === "adv" ? " + 5 (advantage)" : d.skills.perception?.roll === "dis" ? " − 5 (disadvantage)" : ""}`} />
          </div>
          {speed.others.length > 0 && <div className="mt-1.5 text-center text-xs italic text-ink-faded">{speed.others.join(" · ")}</div>}

          <div className="mt-3">
            {attacks.map((a) => (
              <div key={a.type} className="flex items-baseline py-0.5">
                <span className="shrink-0 text-[15px]">
                  {cap(a.type)} attack <span className="text-[10px] uppercase tracking-wider text-ink-faded">{a.base}</span>
                </span>
                <span aria-hidden="true" className="mx-1.5 min-w-[1rem] flex-1 translate-y-[-4px] border-b-2 border-dotted border-rule/35" />
                <span className="shrink-0 font-semibold tabular-nums text-rubric">{signedNum(a.total)}</span>
              </div>
            ))}
          </div>

          {casting.length > 0 && (
            <div className="mt-2 border-t border-rule/20 pt-2">
              {casting.map((c) => (
                <div key={c.ability} className="flex items-baseline py-0.5 text-magic" title={`Spellcasting with ${c.ability.toUpperCase()}${c.names.length ? `: ${c.names.join(", ")}` : " (your own)"}`}>
                  <span className="shrink-0 text-[15px]">
                    Spells <span className="text-[10px] uppercase tracking-wider text-ink-faded">{c.ability}</span>
                    <span className="ml-1.5 text-[11px] italic text-ink-faded">{c.names.length ? c.names.join(", ") : "your own"}</span>
                  </span>
                  <span aria-hidden="true" className="mx-1.5 min-w-[1rem] flex-1 translate-y-[-4px] border-b-2 border-dotted border-rule/35" />
                  <span className="shrink-0 tabular-nums">
                    <span className="font-semibold">{signedNum(c.attack)}</span> · DC <span className="font-semibold">{c.dc}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <Defenses defenses={d.defenses} />
        </Block>

        {/* ── State ── */}
        <Block title="Status & Rest">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {TOGGLES.map((t) => {
              const on = Boolean(state[t.field]);
              return (
                <button
                  key={t.field}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    saveState({ [t.field]: on ? (t.field === "concentration" ? null : false) : true });
                    if (t.field === "concentration" && on) setConcChecks([]);
                  }}
                  className={`group inline-flex items-center gap-1.5 text-sm transition ${on ? "font-semibold text-rubric" : "text-ink-faded hover:text-ink"}`}
                >
                  {/* the diamond mark, filled when it's on */}
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 rotate-45 border-[1.5px] transition ${on ? "border-rubric bg-rubric" : "border-rule/70 group-hover:border-ink"}`}
                  />
                  {t.label}
                </button>
              );
            })}
          </div>

          <ConcentrationChecks checks={concChecks} onKept={() => resolveConcentration(true)} onLost={() => resolveConcentration(false)}
                               bonus={d.concentration} roll={d.rolls?.concentration} />

          <div className="mt-4 space-y-2">
            <Label className="!mb-1">Conditions</Label>
            <Conditions active={conditions} onToggle={toggleCondition} />
            <Exhaustion level={exhaustion} onSet={(n) => saveState({ exhaustion: n })} />
          </div>

          <div className="mt-4">
            <Label>Hit Dice</Label>
            {hitDice.length === 0 ? (
              <p className="text-xs italic text-ink-faded">No hit dice: the character has no class levels.</p>
            ) : (
              <div className="space-y-1">
                {hitDice.map((h) => (
                  <div key={h.die} className="flex items-center gap-2">
                    <span className="w-8 text-sm font-semibold text-ink">{h.die}</span>
                    <Pips
                      cur={h.cur}
                      max={h.max}
                      size="lg"
                      onSpend={() => setHitDie(h.die, h.cur - 1, h.max)}
                      onRestore={() => setHitDie(h.die, h.cur + 1, h.max)}
                      label="hit die"
                    />
                    <span className="ml-auto text-xs tabular-nums text-ink-faded">
                      {h.cur}/{h.max}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => rest("short")} disabled={busy} title={`Short rest for ${ch.name} only`} className={`h-8 flex-1 text-sm ${stamp("plain")}`}>
              Short Rest
            </button>
            <button type="button" onClick={() => rest("long")} disabled={busy} title={`Long rest for ${ch.name} only`} className={`h-8 flex-1 text-sm ${stamp("plain")}`}>
              Long Rest
            </button>
          </div>
        </Block>
      </div>
    </div>
  );
}
