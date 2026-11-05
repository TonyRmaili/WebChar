import React, { useState } from "react";
import useCharStore from "../../../../store/CharStore";
import { Pips } from "./PlayParts";
import {
  CONDITIONS,
  NO_DEATH_SAVES,
  activeSaveDcs,
  attackTotals,
  cap,
  concentrationDc,
  conditionsOf,
  deathSavesOf,
  effectiveMaxHp,
  exhaustionOf,
  healthOf,
  hitDiceList,
  hpTone,
  initiativeTotal,
  passivePerception,
  signedNum,
  speedSummary,
} from "./playHelpers";

/* Health section of the Play panel.

   Three blocks that sit side by side at full width and stack at half:
   Vitals (HP, damage/heal, death saves at 0 HP) ·
   Combat (AC, initiative, speed, passive perception, attacks, DCs) ·
   Status (toggles, concentration checks, conditions, exhaustion,
   hit dice, this character's rests).

   New character fields used here: death_saves {success, fail},
   conditions [names], exhaustion 0-6. */

const API = "http://localhost:8000";

// TODO (store pass): move these two calls into CharStore.
async function postCombat(path, body) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Token not found");
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Failed: ${res.status} ${payload ? JSON.stringify(payload) : ""}`);
  return payload;
}

/* ─── Small parts ────────────────────────────────────────────────── */

// A number field you can clear and retype: the value is applied on
// Enter or when leaving the field, not on every keystroke.
function NumberField({ value, onCommit, min, className = "", ariaLabel }) {
  const [draft, setDraft] = useState(null);
  const commit = () => {
    if (draft == null) return;
    const n = Math.trunc(Number(draft));
    if (String(draft).trim() !== "" && Number.isFinite(n)) {
      const v = min != null ? Math.max(min, n) : n;
      if (v !== value) onCommit(v);
    }
    setDraft(null);
  };
  return (
    <input
      type="number"
      inputMode="numeric"
      value={draft ?? value}
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

function Block({ title, children, className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-700/70 bg-slate-900/50 p-3 ${className}`}>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</div>
      {children}
    </div>
  );
}

function StatTile({ label, value, hint }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2" title={hint}>
      <span className="text-2xl font-semibold tabular-nums text-amber-200">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
    </div>
  );
}

function SmallField({ label, children, tone = "slate" }) {
  const ring = { slate: "border-slate-700", sky: "border-sky-800/80", violet: "border-violet-800/80" }[tone];
  return (
    <label className={`flex items-center gap-1.5 rounded-lg border ${ring} bg-slate-950/70 px-2 py-1`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const BAR = { emerald: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", slate: "bg-slate-600" };
const NUM = { emerald: "text-emerald-200", amber: "text-amber-200", red: "text-red-300", slate: "text-slate-400" };

const TOGGLES = [
  { field: "reaction", label: "Reaction" },
  { field: "concentration", label: "Concentration" },
  { field: "heroic_inspiration", label: "Heroic Inspiration" },
  { field: "bardic_inspiration", label: "Bardic Inspiration" },
];

// Three dots per row. Clicking the n-th dot sets the count to n, clicking
// the last filled dot again lowers it by one.
function SaveRow({ label, count, tone, onSet }) {
  const on = tone === "good" ? "bg-emerald-400 border-emerald-400" : "bg-red-500 border-red-500";
  const off = tone === "good" ? "border-emerald-800" : "border-red-900";
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-[11px] text-slate-400">{label}</span>
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSet(count === n ? n - 1 : n)}
          aria-label={`${label}: ${n}`}
          className={`h-4 w-4 rounded-full border transition hover:scale-110 ${n <= count ? on : off}`}
        />
      ))}
    </div>
  );
}

function DeathSaves({ saves, onChange }) {
  const status = saves.success >= 3 ? "Stable" : saves.fail >= 3 ? "Dead" : "Dying";
  const statusTone = { Stable: "text-emerald-300", Dead: "text-red-400", Dying: "text-amber-300" }[status];
  return (
    <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/20 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-300/80">Death Saves</span>
        <span className={`text-xs font-semibold ${statusTone}`}>{status}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <SaveRow label="Successes" count={saves.success} tone="good" onSet={(n) => onChange({ ...saves, success: n })} />
        <SaveRow label="Failures" count={saves.fail} tone="bad" onSet={(n) => onChange({ ...saves, fail: n })} />
        <button type="button" onClick={() => onChange(NO_DEATH_SAVES)} className="ml-auto text-[11px] text-slate-400 hover:text-amber-300">
          Reset
        </button>
      </div>
      <p className="mt-1.5 text-[10px] text-slate-500">Damage while at 0 HP adds a failure. Any healing clears these.</p>
    </div>
  );
}

function ConcentrationChecks({ checks, onKept, onLost }) {
  if (checks.length === 0) return null;
  const dc = checks[0];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-600/60 bg-amber-950/30 px-2.5 py-2">
      <span className="text-xs text-amber-100">
        Concentration check: <span className="font-semibold">CON save DC {dc}</span>
        {checks.length > 1 && <span className="text-amber-300/70"> (+{checks.length - 1} more)</span>}
      </span>
      <div className="ml-auto flex gap-1">
        <button type="button" onClick={onKept} className="h-7 rounded-md border border-emerald-700 px-2 text-[11px] text-emerald-200 hover:bg-emerald-900/40">
          Kept
        </button>
        <button type="button" onClick={onLost} className="h-7 rounded-md border border-red-800 px-2 text-[11px] text-red-200 hover:bg-red-900/40">
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
      <div className="flex flex-wrap items-center gap-1">
        {active.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onToggle(c)}
            title="Click to remove"
            className="h-7 rounded-full border border-rose-700/70 bg-rose-950/40 px-2.5 text-[11px] text-rose-200 hover:border-rose-500"
          >
            {c} ✕
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          className="h-7 rounded-full border border-dashed border-slate-600 px-2.5 text-[11px] text-slate-400 hover:border-slate-400 hover:text-slate-200"
        >
          {picking ? "Done" : active.length ? "+ Condition" : "+ Add condition"}
        </button>
      </div>
      {picking && (
        <div className="mt-2 flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
          {CONDITIONS.map((c) => {
            const on = active.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => onToggle(c)}
                className={`h-7 rounded-full border px-2.5 text-[11px] transition ${
                  on ? "border-rose-600 bg-rose-900/40 text-rose-100" : "border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
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
      <span className="w-20 text-[11px] text-slate-400">Exhaustion</span>
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSet(level === n ? n - 1 : n)}
          aria-label={`Exhaustion level ${n}`}
          className={`h-4 w-4 rounded-sm border transition hover:scale-110 ${
            n <= level ? (n === 6 ? "border-red-500 bg-red-600" : "border-orange-400 bg-orange-500") : "border-slate-600"
          }`}
        />
      ))}
      <span className={`ml-auto text-[11px] tabular-nums ${level ? "text-orange-300" : "text-slate-500"}`}>
        {level ? `Level ${level}` : "None"}
      </span>
    </div>
  );
}

/* ─── Section ────────────────────────────────────────────────────── */

export default function HealthPlay({ id }) {
  const charData = useCharStore((s) => s.charData);
  const updateCharField = useCharStore((s) => s.updateCharField);
  const postCharData = useCharStore((s) => s.postCharData);
  const fetchChar = useCharStore((s) => s.fetchChar);

  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  // Concentration save DCs still to roll. Screen-only, never saved.
  const [concChecks, setConcChecks] = useState([]);

  if (!charData) return null;

  const health = healthOf(charData);
  const maxHp = effectiveMaxHp(health);
  const cur = Math.max(0, Number(health.current_hp) || 0);
  const temp = Math.max(0, Number(health.temp_hp) || 0);
  const barrier = Math.max(0, Number(health.barrier) || 0);
  const tone = hpTone(cur, maxHp);
  const pct = maxHp > 0 ? Math.min(100, (cur / maxHp) * 100) : 0;

  const ac = Number.isFinite(Number(charData.ac)) ? Number(charData.ac) : "—";
  const init = initiativeTotal(charData);
  const attacks = attackTotals(charData);
  const dcs = activeSaveDcs(charData);
  const hitDice = hitDiceList(charData.hit_dice);
  const speed = speedSummary(charData);
  const passive = passivePerception(charData);
  const deathSaves = deathSavesOf(charData);
  const conditions = conditionsOf(charData);
  const exhaustion = exhaustionOf(charData);
  const hasDeathSaves = deathSaves.success > 0 || deathSaves.fail > 0;

  /* ---- writers ---- */

  const save = (field, value) => {
    updateCharField(field, value);
    postCharData();
  };

  const patchHealth = (patch) => {
    // Coming back above 0 HP clears the death saves.
    if (patch.current_hp > 0 && hasDeathSaves) updateCharField("death_saves", NO_DEATH_SAVES);
    save("health", { ...health, ...patch });
  };

  // Damage/heal goes through the server, which applies temp HP and
  // barrier rules and saves the file. Only the local copy is updated
  // here, unless death saves change too.
  const changeHp = async (delta) => {
    if (!delta || busy || !charData.name) return;
    const wasDown = cur <= 0;
    setBusy(true);
    try {
      const payload = await postCombat("/combat/health", { value: delta, name: charData.name });
      if (payload?.health && typeof payload.health === "object") {
        updateCharField("health", { ...health, ...payload.health });
      }

      if (delta < 0) {
        if (charData.concentration) setConcChecks((list) => [...list, concentrationDc(delta)]);
        if (wasDown) save("death_saves", { ...deathSaves, fail: Math.min(3, deathSaves.fail + 1) });
      } else if (Number(payload?.health?.current_hp) > 0 && hasDeathSaves) {
        save("death_saves", NO_DEATH_SAVES);
      }
    } catch (e) {
      console.error("health error:", e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleCondition = (name) =>
    save("conditions", conditions.includes(name) ? conditions.filter((c) => c !== name) : [...conditions, name]);

  const resolveConcentration = (kept) => {
    setConcChecks((list) => (kept ? list.slice(1) : []));
    if (!kept) save("concentration", false);
  };

  const applyAmount = (sign) => {
    const n = Math.trunc(Number(amount));
    if (!Number.isFinite(n) || n <= 0) return;
    changeHp(sign * n);
    setAmount("");
  };

  const rest = async (rest_type) => {
    if (busy || !charData.name) return;
    setBusy(true);
    try {
      await postCombat("/combat/rest", { rest_type, name: charData.name });
      await fetchChar(id);
    } catch (e) {
      console.error("rest error:", e.message);
    } finally {
      setBusy(false);
    }
  };

  const setHitDie = (die, value) => {
    const row = charData.hit_dice?.[die] || {};
    save("hit_dice", { ...charData.hit_dice, [die]: { ...row, current: value } });
  };

  /* ---- render ---- */

  const quick = "h-8 min-w-[2.5rem] rounded-md border px-2 text-xs tabular-nums transition disabled:opacity-40";

  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @5xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {/* ── Vitals ── */}
        <Block title="Hit Points" className="@xl:col-span-2 @5xl:col-span-1">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <div className="flex items-baseline gap-1">
              <NumberField
                value={cur}
                min={0}
                onCommit={(v) => patchHealth({ current_hp: v })}
                ariaLabel="Current HP"
                className={`w-[4.5rem] rounded-md text-4xl font-bold leading-none hover:bg-slate-800/60 focus:bg-slate-800 ${NUM[tone]}`}
              />
              <span className="text-xl text-slate-500">/ {maxHp}</span>
            </div>

            <div className="flex flex-wrap gap-1.5 pb-1">
              <SmallField label="Temp" tone="sky">
                <NumberField value={temp} min={0} onCommit={(v) => patchHealth({ temp_hp: v })} ariaLabel="Temporary HP" className="w-10 text-sm text-sky-200" />
              </SmallField>
              <SmallField label="Barrier" tone="violet">
                <NumberField value={barrier} min={0} onCommit={(v) => patchHealth({ barrier: v })} ariaLabel="Barrier" className="w-10 text-sm text-violet-200" />
              </SmallField>
              <SmallField label="Max ±">
                <NumberField
                  value={Number(health.max_hp_mod) || 0}
                  onCommit={(v) => patchHealth({ max_hp_mod: v })}
                  ariaLabel="Max HP modifier"
                  className="w-10 text-sm text-slate-200"
                />
              </SmallField>
            </div>
          </div>

          {/* HP bar, with temp HP and barrier as thin bars underneath */}
          <div className="mt-2 space-y-1">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div className={`h-full rounded-full transition-all ${BAR[tone]}`} style={{ width: `${pct}%` }} />
            </div>
            {(temp > 0 || barrier > 0) && (
              <div className="flex gap-1">
                {temp > 0 && <div className="h-1 rounded-full bg-sky-400" style={{ width: `${Math.min(100, (temp / Math.max(1, maxHp)) * 100)}%` }} />}
                {barrier > 0 && <div className="h-1 rounded-full bg-violet-400" style={{ width: `${Math.min(100, (barrier / Math.max(1, maxHp)) * 100)}%` }} />}
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
              className="h-9 w-24 rounded-lg border border-slate-600 bg-slate-950 text-center text-sm text-amber-200 placeholder:text-slate-600 focus:border-amber-500/70 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => applyAmount(-1)}
              disabled={busy}
              className="h-9 rounded-lg border border-red-700 bg-red-900/40 px-3 text-sm text-red-100 transition hover:bg-red-900/60 disabled:opacity-40"
            >
              Damage
            </button>
            <button
              type="button"
              onClick={() => applyAmount(1)}
              disabled={busy}
              className="h-9 rounded-lg border border-emerald-700 bg-emerald-900/40 px-3 text-sm text-emerald-100 transition hover:bg-emerald-900/60 disabled:opacity-40"
            >
              Heal
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {[-10, -5, -1].map((v) => (
              <button key={v} type="button" onClick={() => changeHp(v)} disabled={busy}
                className={`${quick} border-red-900/70 text-red-200 hover:bg-red-950/60`}>
                {v}
              </button>
            ))}
            <span className="mx-1 w-px self-stretch bg-slate-700" />
            {[1, 5, 10].map((v) => (
              <button key={v} type="button" onClick={() => changeHp(v)} disabled={busy}
                className={`${quick} border-emerald-900/70 text-emerald-200 hover:bg-emerald-950/60`}>
                +{v}
              </button>
            ))}
          </div>

          {maxHp > 0 && (cur <= 0 || hasDeathSaves) && (
            <DeathSaves saves={deathSaves} onChange={(v) => save("death_saves", v)} />
          )}
        </Block>

        {/* ── Combat ── */}
        <Block title="Combat">
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Armor Class" value={ac} />
            <StatTile label="Initiative" value={signedNum(init)} hint="DEX modifier + initiative modifier" />
            <StatTile
              label="Speed"
              value={speed.walk ? `${speed.walk} ft` : "—"}
              hint={speed.others.length ? speed.others.join(" · ") : "Walking speed"}
            />
            <StatTile label="Passive Perc." value={passive} hint="10 + Perception skill" />
          </div>
          {speed.others.length > 0 && (
            <div className="mt-1.5 text-center text-[11px] text-slate-500">{speed.others.join(" · ")}</div>
          )}

          <div className="mt-3 space-y-1 text-sm">
            {attacks.map((a) => (
              <div key={a.type} className="flex items-baseline justify-between gap-2">
                <span className="text-slate-400">
                  {cap(a.type)} attack <span className="text-[10px] uppercase text-slate-600">{a.base}</span>
                </span>
                <span className="font-semibold tabular-nums text-amber-200">{signedNum(a.total)}</span>
              </div>
            ))}
          </div>

          {dcs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-800 pt-2">
              {dcs.map((d) => (
                <span key={d.base} className="rounded-full border border-violet-700/70 px-2 py-0.5 text-[11px] text-violet-200">
                  {d.base.toUpperCase()} save DC <span className="font-semibold">{d.dc}</span>
                </span>
              ))}
            </div>
          )}
        </Block>

        {/* ── State ── */}
        <Block title="Status & Rest">
          <div className="flex flex-wrap gap-1.5">
            {TOGGLES.map((t) => {
              const on = Boolean(charData[t.field]);
              return (
                <button
                  key={t.field}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    save(t.field, !on);
                    if (t.field === "concentration" && on) setConcChecks([]);
                  }}
                  className={`h-8 rounded-full border px-3 text-xs transition ${
                    on
                      ? "border-amber-500/70 bg-amber-500/15 text-amber-200"
                      : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                  }`}
                >
                  {on ? "● " : "○ "}
                  {t.label}
                </button>
              );
            })}
          </div>

          <ConcentrationChecks
            checks={concChecks}
            onKept={() => resolveConcentration(true)}
            onLost={() => resolveConcentration(false)}
          />

          <div className="mt-3 space-y-2 border-t border-slate-800 pt-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Conditions</div>
            <Conditions active={conditions} onToggle={toggleCondition} />
            <Exhaustion level={exhaustion} onSet={(n) => save("exhaustion", n)} />
          </div>

          <div className="mt-3 border-t border-slate-800 pt-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Hit Dice</div>
            {hitDice.length === 0 ? (
              <p className="text-xs text-slate-500">No hit dice. Set classes in General.</p>
            ) : (
              <div className="space-y-1">
                {hitDice.map((d) => (
                  <div key={d.die} className="flex items-center gap-2">
                    <span className="w-8 text-xs font-semibold text-slate-300">{d.die}</span>
                    <Pips
                      cur={d.cur}
                      max={d.max}
                      size="lg"
                      onSpend={() => setHitDie(d.die, d.cur - 1)}
                      onRestore={() => setHitDie(d.die, d.cur + 1)}
                      label="hit die"
                    />
                    <span className="ml-auto text-[11px] tabular-nums text-slate-500">
                      {d.cur}/{d.max}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 flex gap-2 border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={() => rest("short")}
              disabled={busy}
              title={`Short rest for ${charData.name} only`}
              className="h-8 flex-1 rounded-lg border border-amber-600/70 bg-amber-900/30 text-xs text-amber-100 transition hover:bg-amber-800/50 disabled:opacity-40"
            >
              Short Rest
            </button>
            <button
              type="button"
              onClick={() => rest("long")}
              disabled={busy}
              title={`Long rest for ${charData.name} only`}
              className="h-8 flex-1 rounded-lg border border-teal-600/70 bg-teal-900/30 text-xs text-teal-100 transition hover:bg-teal-800/50 disabled:opacity-40"
            >
              Long Rest
            </button>
          </div>
        </Block>
      </div>
    </div>
  );
}