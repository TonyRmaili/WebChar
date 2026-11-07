import React, { useMemo } from "react";
import { ABILITIES_ORDER } from "../../utils/Constants";
import { INK, InkButton, InkChoice, InkNumber, InkSelect, Line } from "../../styles/parchment";

/* Ability scores for the Builder, on parchment: pick a method, then the
   six scores are written in a row, each with its modifier under it and
   the control that sets it (a list, − / +, or a blank to write in). */

/* ───────── config ───────── */
const SCORE_RULES = [
  { value: "standard", label: "Standard array" },
  { value: "pointBuy", label: "Point buy" },
  { value: "random", label: "Roll 3d6" },
  { value: "custom", label: "Custom" },
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

/* ───────── small pieces ───────── */

// "15 · 14 · 12" — numbers still to hand out.
function Pool({ values }) {
  if (!values.length) return <span className={`text-sm italic ${INK.rubric}`}>all assigned</span>;
  return <span className="text-lg tabular-nums tracking-wide">{values.join(" · ")}</span>;
}

// One ability: label, the score large, its modifier, then its control.
function Ability({ label, score, children }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${INK.faded}`}>{label}</span>
      <span className={`mt-1 text-4xl leading-none tabular-nums ${score == null ? INK.faint : ""}`}>{score == null ? "—" : score}</span>
      <span className={`mt-1 text-sm italic tabular-nums ${INK.faded}`}>{fmtMod(modOf(score))}</span>
      {children && <div className="mt-2 flex h-8 w-full items-center justify-center">{children}</div>}
    </div>
  );
}

const stepBtn = `w-7 text-xl leading-none transition ${INK.faded} hover:text-[#3a2716] disabled:opacity-30`;

/* ───────── main (controlled) component ───────── */
export default function AbilityScoreBoxes({ method, scores, pool, onMethodChange, onScoresChange, onRoll }) {
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

  const activePool = method === "standard" ? STANDARD_ARRAY : method === "random" ? pool : [];
  const poolReady = method === "standard" || (method === "random" && pool.length > 0);
  const unassigned = poolReady ? poolRemaining(activePool, scores, null) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className={`text-sm italic ${INK.faded}`}>Method</span>
        <InkChoice label="Ability score method" value={method} onChange={onMethodChange} options={SCORE_RULES} />
      </div>

      {/* what's left to hand out — adapts to the method */}
      <div className="max-w-md">
        {method === "pointBuy" && (
          <Line label="Points left">
            <span className={`text-xl tabular-nums ${pointsRemaining < 0 ? INK.rubric : ""}`}>{pointsRemaining}</span>
            <span className={`text-sm ${INK.faint}`}>of {POINT_BUY_BUDGET}</span>
          </Line>
        )}
        {method === "standard" && (
          <Line label="Still to assign">
            <Pool values={unassigned} />
          </Line>
        )}
        {method === "random" &&
          (pool.length === 0 ? (
            <p className={`text-sm italic ${INK.faded}`}>
              <InkButton active onClick={onRoll} className="text-sm">
                roll 3d6 six times
              </InkButton>{" "}
              — then hand the numbers out below.
            </p>
          ) : (
            <Line label={<InkButton onClick={onRoll}>roll again</InkButton>}>
              <Pool values={unassigned} />
            </Line>
          ))}
        {method === "custom" && <p className={`text-sm italic ${INK.faint}`}>Write any score from 1 to 30.</p>}
      </div>

      <div className="grid grid-cols-3 gap-x-4 gap-y-6 @2xl:grid-cols-6">
        {ABILITIES_ORDER.map(({ key, label }) => {
          /* standard + random: hand out numbers from the pool */
          if (method === "standard" || method === "random") {
            const opts = [...(scores[key] != null ? [scores[key]] : []), ...poolRemaining(activePool, scores, key)].sort((a, b) => b - a);
            return (
              <Ability key={key} label={label} score={scores[key]}>
                <InkSelect
                  value={scores[key] ?? ""}
                  disabled={!poolReady}
                  onChange={(e) => setScore(key, e.target.value === "" ? null : Number(e.target.value))}
                  aria-label={`${label} score`}
                  className="h-7 w-16 text-center text-sm disabled:opacity-40"
                >
                  <option value="">—</option>
                  {opts.map((v, i) => (
                    <option key={i} value={v}>
                      {v}
                    </option>
                  ))}
                </InkSelect>
              </Ability>
            );
          }

          /* point buy: − / + */
          if (method === "pointBuy") {
            const cur = scores[key] ?? 8;
            const nextCost = cur < 15 ? POINT_BUY_COST[cur + 1] - POINT_BUY_COST[cur] : Infinity;
            return (
              <Ability key={key} label={label} score={cur}>
                <button type="button" className={stepBtn} onClick={() => dec(key)} disabled={cur <= 8} aria-label={`Lower ${label}`}>
                  −
                </button>
                <span className={`w-10 text-center text-[10px] italic ${INK.faint}`}>{cur < 15 ? `${nextCost} pt` : "max"}</span>
                <button
                  type="button"
                  className={stepBtn}
                  onClick={() => inc(key)}
                  disabled={cur >= 15 || pointsRemaining < nextCost}
                  aria-label={`Raise ${label}`}
                >
                  +
                </button>
              </Ability>
            );
          }

          /* custom: write it in */
          return (
            <Ability key={key} label={label} score={scores[key]}>
              <InkNumber value={scores[key]} onChange={(n) => setScore(key, n)} min={1} max={30} aria-label={`${label} score`} className="h-7 w-14 text-base" />
            </Ability>
          );
        })}
      </div>
    </div>
  );
}