import React, { useMemo } from "react";
import { ABILITIES_ORDER } from "../../utils/Constants";

/* ───────── config ───────── */
const SCORE_RULES = [
  { id: "standard", label: "Standard" },
  { id: "pointBuy", label: "Point Buy" },
  { id: "random", label: "Roll 3d6" },
  { id: "custom", label: "Custom" },
];

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const POINT_BUY_BUDGET = 27;

const ABILITY_KEYS = ABILITIES_ORDER.map((a) => a.key);

/* ───────── shared helpers (also used by BuildWizard / Summary) ───────── */
const emptyScores = () => ABILITY_KEYS.reduce((acc, k) => ((acc[k] = null), acc), {});
const filledScores = (v) => ABILITY_KEYS.reduce((acc, k) => ((acc[k] = v), acc), {});

export function defaultsFor(method) {
  if (method === "pointBuy") return filledScores(8); // point buy baseline
  if (method === "custom") return filledScores(10); // neutral start, editable
  return emptyScores(); // standard + random start unassigned
}

const d6 = () => 1 + Math.floor(Math.random() * 6);
const rollAbility = () => d6() + d6() + d6(); // 3d6 → 3..18
export const rollPool = () => Array.from({ length: 6 }, rollAbility); // 6 abilities

export const modOf = (s) => (s == null ? null : Math.floor((s - 10) / 2));
export const fmtMod = (m) => (m == null ? "—" : m >= 0 ? `+${m}` : `${m}`);

/* multiset-aware: pool values still free (correctly handles duplicate rolls) */
function poolRemaining(pool, scores, exceptKey) {
  const rem = [...pool];
  for (const k of ABILITY_KEYS) {
    if (k === exceptKey) continue;
    const v = scores[k];
    if (v == null) continue;
    const i = rem.indexOf(v);
    if (i !== -1) rem.splice(i, 1);
  }
  return rem;
}

/* ───────── small UI atoms ───────── */
function StepBtn({ children, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-600 bg-slate-800/70
                 text-lg font-bold leading-none text-amber-200 transition
                 hover:border-amber-500/60 hover:bg-slate-700/70
                 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function PoolChip({ children }) {
  return (
    <span className="rounded border border-slate-600/70 bg-slate-800/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-200">
      {children}
    </span>
  );
}

function AbilityCard({ label, score, children }) {
  const m = modOf(score);
  return (
    <div className="relative flex flex-col items-center rounded-xl border border-slate-700/80
                    bg-gradient-to-b from-slate-800/50 to-slate-900/70 px-2 py-3 shadow-inner">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400/90">
        {label}
      </span>
      <span
        className={`mt-1 text-3xl font-bold leading-none tabular-nums ${
          score == null ? "text-slate-600" : "text-amber-50"
        }`}
      >
        {score == null ? "—" : score}
      </span>
      <span className="mt-1 rounded-full border border-slate-600/70 bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-300">
        {fmtMod(m)}
      </span>
      {children && <div className="mt-2.5 w-full">{children}</div>}
    </div>
  );
}

/* ───────── main (controlled) component ───────── */
export default function AbilityScoreBoxes({
  method,
  scores,
  pool,
  onMethodChange,
  onScoresChange,
  onRoll,
}) {
  const setScore = (key, value) => onScoresChange({ ...scores, [key]: value });

  const pointsSpent = useMemo(
    () => ABILITY_KEYS.reduce((sum, k) => sum + (POINT_BUY_COST[scores[k] ?? 8] ?? 0), 0),
    [scores]
  );
  const pointsRemaining = POINT_BUY_BUDGET - pointsSpent;

  const inc = (key) => {
    const cur = scores[key] ?? 8;
    if (cur >= 15) return;
    const cost = POINT_BUY_COST[cur + 1] - POINT_BUY_COST[cur];
    if (pointsRemaining < cost) return;
    setScore(key, cur + 1);
  };
  const dec = (key) => {
    const cur = scores[key] ?? 8;
    if (cur <= 8) return;
    setScore(key, cur - 1);
  };

  const activePool =
    method === "standard" ? STANDARD_ARRAY : method === "random" ? pool : [];
  const poolReady = method === "standard" || (method === "random" && pool.length > 0);
  const unassigned = poolReady ? poolRemaining(activePool, scores, null) : [];

  return (
    <div className="space-y-4 text-amber-100">
      {/* method tabs */}
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-700 bg-slate-900/50 p-1">
        {SCORE_RULES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onMethodChange(r.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              method === r.id
                ? "bg-amber-500/20 text-amber-200 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.4)]"
                : "text-slate-400 hover:text-amber-300"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* context bar (adapts to method) */}
      {method === "pointBuy" && (
        <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
          <span className="text-[11px] uppercase tracking-wider text-slate-400">Points</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700/60">
            <div
              className="h-full rounded-full bg-amber-500/70 transition-all"
              style={{ width: `${Math.min(100, (pointsSpent / POINT_BUY_BUDGET) * 100)}%` }}
            />
          </div>
          <span
            className={`text-sm font-bold tabular-nums ${
              pointsRemaining < 0 ? "text-red-400" : "text-amber-200"
            }`}
          >
            {pointsRemaining}
          </span>
          <span className="text-[11px] text-slate-500">left</span>
        </div>
      )}

      {method === "random" && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
          <button
            type="button"
            onClick={onRoll}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-900 bg-gradient-to-r from-amber-900 to-amber-700
                       px-3 py-1.5 text-xs font-semibold text-amber-100 shadow-[0_0_8px_rgba(245,158,11,0.25)]
                       transition hover:from-amber-800 hover:to-amber-600"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8" cy="8" r="1.2" /><circle cx="16" cy="8" r="1.2" />
              <circle cx="12" cy="12" r="1.2" />
              <circle cx="8" cy="16" r="1.2" /><circle cx="16" cy="16" r="1.2" />
            </svg>
            {pool.length ? "Reroll" : "Roll 3d6 ×6"}
          </button>

          {pool.length === 0 ? (
            <span className="text-[11px] italic text-slate-500">
              Roll to generate six scores, then assign them below.
            </span>
          ) : (
            <>
              <span className="ml-1 text-[11px] uppercase tracking-wider text-slate-400">Unassigned</span>
              <div className="flex flex-wrap gap-1">
                {unassigned.length ? (
                  unassigned.map((v, i) => <PoolChip key={i}>{v}</PoolChip>)
                ) : (
                  <span className="text-[11px] font-semibold text-amber-300">all assigned ✓</span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {method === "standard" && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
          <span className="text-[11px] uppercase tracking-wider text-slate-400">Remaining</span>
          <div className="flex flex-wrap gap-1">
            {unassigned.length ? (
              unassigned.map((v, i) => <PoolChip key={i}>{v}</PoolChip>)
            ) : (
              <span className="text-[11px] font-semibold text-amber-300">all assigned ✓</span>
            )}
          </div>
        </div>
      )}

      {method === "custom" && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
          <span className="text-[11px] italic text-slate-500">
            Enter any value from 1–30 for each ability.
          </span>
        </div>
      )}

      {/* ability grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {ABILITIES_ORDER.map(({ key, label }) => {
          /* assignment methods: standard + random */
          if (method === "standard" || method === "random") {
            const opts = [
              ...(scores[key] != null ? [scores[key]] : []),
              ...poolRemaining(activePool, scores, key),
            ].sort((a, b) => b - a);

            return (
              <AbilityCard key={key} label={label} score={scores[key]}>
                <select
                  value={scores[key] ?? ""}
                  disabled={!poolReady}
                  onChange={(e) => setScore(key, e.target.value === "" ? null : Number(e.target.value))}
                  className="w-full rounded-md border border-slate-600 bg-slate-800/70 px-1 py-1 text-center text-sm
                             text-amber-100 outline-none transition focus:border-amber-500/60 disabled:opacity-40"
                >
                  <option value="">—</option>
                  {opts.map((v, i) => (
                    <option key={i} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </AbilityCard>
            );
          }

          /* point buy: steppers */
          if (method === "pointBuy") {
            const cur = scores[key] ?? 8;
            const nextCost = cur < 15 ? POINT_BUY_COST[cur + 1] - POINT_BUY_COST[cur] : Infinity;
            return (
              <AbilityCard key={key} label={label} score={cur}>
                <div className="flex items-center justify-center gap-3">
                  <StepBtn onClick={() => dec(key)} disabled={cur <= 8}>−</StepBtn>
                  <StepBtn onClick={() => inc(key)} disabled={cur >= 15 || pointsRemaining < nextCost}>+</StepBtn>
                </div>
              </AbilityCard>
            );
          }

          /* custom: free entry */
          return (
            <AbilityCard key={key} label={label} score={scores[key]}>
              <input
                type="number"
                min={1}
                max={30}
                value={scores[key] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setScore(key, v === "" ? null : Math.min(30, Number(v)));
                }}
                className="w-full rounded-md border border-slate-600 bg-slate-800/70 px-1 py-1 text-center text-sm
                           text-amber-100 outline-none transition focus:border-amber-500/60
                           [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
            </AbilityCard>
          );
        })}
      </div>
    </div>
  );
}