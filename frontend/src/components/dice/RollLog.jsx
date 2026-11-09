import React, { useState } from "react";
import { INK, InkButton } from "../../styles/parchment";
import { DICE_LIMIT_SHOWN, RESULT_WORD, d20Words, damageWords, diceCount, facesOf, modeWord, naturalD20, reachCount, signed, total } from "./diceWords";

/* RollLog — the dice tower's history, newest first. One entry per answer
   from the backend (DiceStore.log): a free roll, a round of saves, or a
   round of attacks. Big entries fold their details away. */

const asList = (v) => (Array.isArray(v) ? v : []);
const time = (at) => new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const smallCaps = `text-[10px] font-semibold uppercase tracking-[0.18em] ${INK.faded}`;

/* ─── one die, kept or dropped ───────────────────────────────────── */

function Die({ value, sides, kept = true }) {
  const edge = value === sides ? "border-rubric text-rubric" : value === 1 ? "border-rule/60 text-ink-faded" : "border-rule/50";
  return (
    <span
      className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-[3px] border px-1 text-sm tabular-nums ${edge} ${kept ? "" : "line-through opacity-40"}`}
      title={`d${sides}${kept ? "" : " — dropped"}`}
    >
      {value}
    </span>
  );
}

function Terms({ result }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {asList(result.terms).map((t, i) =>
        t.kind === "flat" ? (
          <span key={i} className={`text-sm ${INK.faded}`}>
            {signed(t.subtotal)}
          </span>
        ) : (
          <span key={i} className="inline-flex flex-wrap items-center gap-1">
            {i > 0 && <span className={`text-sm ${INK.faded}`}>{t.subtotal < 0 ? "−" : "+"}</span>}
            {asList(t.rolls).map((v, j) => (
              <Die key={j} value={v} sides={t.sides} kept={t.kept?.[j] !== false} />
            ))}
          </span>
        )
      )}
    </span>
  );
}

/* ─── free rolls ─────────────────────────────────────────────────── */

// Many results in a row: one small box each (natural 20s and 1s stand out).
function Totals({ line }) {
  return (
    <p className="mt-1 flex flex-wrap gap-1">
      {asList(line.results).map((r, i) => {
        const nat = naturalD20(r);
        const reached = line.against != null && (nat === 20 || (nat !== 1 && r.total >= line.against));
        const tone = nat === 20 ? "border-rubric text-rubric" : nat === 1 ? "border-rule/40 text-ink-faint" : line.against != null && !reached ? "border-rule/30 text-ink-faint" : "border-rule/50";
        return (
          <span key={i} className={`inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-[3px] border px-1 text-sm tabular-nums ${tone}`} title={nat ? `rolled ${nat}` : undefined}>
            {r.total}
          </span>
        );
      })}
    </p>
  );
}

const MANY_TIMES = 6;

function RollLine({ line }) {
  const many = diceCount(line) > DICE_LIMIT_SHOWN;
  const totals = asList(line.results).map((r) => r.total);
  const vs = line.against != null ? reachCount(line) : null;
  return (
    <div className="py-1">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-[15px]">{line.label || line.expression}</span>
        {line.label && <span className={`text-xs italic ${INK.faded}`}>{line.expression}</span>}
        {line.times > 1 && <span className={`text-xs italic ${INK.faded}`}>× {line.times}</span>}
        {modeWord(line.mode) && <span className={`text-xs italic ${INK.rubric}`}>{modeWord(line.mode)}</span>}
        {vs ? (
          <span className="ml-auto text-right">
            <span className="text-2xl tabular-nums">{vs.reached}</span>
            <span className={`ml-1 text-sm ${INK.faded}`}>
              of {vs.of} reach {line.against}
            </span>
          </span>
        ) : (
          <span className="ml-auto text-2xl tabular-nums">{line.total}</span>
        )}
      </div>
      {vs && (vs.twenties > 0 || vs.ones > 0) && (
        <p className={`text-xs italic ${INK.faded}`}>
          {[vs.twenties ? `${vs.twenties} natural 20${vs.twenties === 1 ? "" : "s"}` : "", vs.ones ? `${vs.ones} natural 1${vs.ones === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")}
        </p>
      )}
      {line.times > MANY_TIMES ? (
        <>
          <Totals line={line} />
          <p className={`mt-0.5 text-xs italic ${INK.faded}`}>
            lowest {Math.min(...totals)}, highest {Math.max(...totals)}, average {(line.total / line.times).toFixed(1)}
            {vs ? ` · all added up ${line.total}` : ""}
          </p>
        </>
      ) : many ? (
        <p className="mt-1 flex flex-wrap gap-x-3 text-sm">
          {facesOf(line).map(({ face, n }) => (
            <span key={face} className="tabular-nums">
              <span className={INK.faded}>{face}</span>×{n}
            </span>
          ))}
        </p>
      ) : (
        <div className="mt-1 space-y-1">
          {asList(line.results).map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Terms result={r} />
              {line.times > 1 && <span className="ml-auto text-sm tabular-nums">= {r.total}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── saves ──────────────────────────────────────────────────────── */

function SavesEntry({ entry }) {
  const [open, setOpen] = useState(false);
  const r = entry.result;
  const shared = r.damage;
  return (
    <div className="py-1">
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-[15px]">{entry.label || "Saves"}</span>
        <span className={`text-sm italic ${INK.faded}`}>
          DC {r.dc} · <span className={INK.rubric}>{r.failed} failed</span>, {r.passed} passed
          {shared ? ` · ${damageWords(shared.by_type) || "no damage"}${shared.parts.some((p) => p.given) ? " (rolled at the table)" : ""}` : ""}
        </span>
        <InkButton onClick={() => setOpen((o) => !o)}>{open ? "hide" : "each"}</InkButton>
      </p>
      {open && (
        <div className="mt-1 text-sm">
          {asList(r.targets).map((t) => {
            const took = t.passed ? t.if_passed : t.if_failed;
            return (
              <p key={t.key} className="flex flex-wrap items-baseline gap-x-3 border-b border-rule/10 py-0.5 last:border-b-0">
                <span className="w-40 truncate">{t.name}</span>
                <span className={`tabular-nums ${INK.faded}`}>
                  {d20Words(t.d20)} {signed(t.bonus)} = {t.total}
                </span>
                <span className={t.passed ? "" : INK.rubric}>{t.passed ? "passed" : "failed"}</span>
                <span className="ml-auto tabular-nums">{took.total} {took.notes.length ? <span className={`text-xs italic ${INK.faded}`}>({took.notes.join(", ")})</span> : null}</span>
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── attacks ────────────────────────────────────────────────────── */

function VolleyLine({ v, showName }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-3 text-sm">
        {showName && <span className="w-40 truncate text-[15px]">{v.name}</span>}
        <span className={INK.faded}>
          {v.attacks.length} × {signed(v.to_hit)} vs AC {v.ac}
          {modeWord(v.mode) ? ` · ${modeWord(v.mode)}` : ""}
        </span>
        <span>
          {v.hits} {v.hits === 1 ? "hit" : "hits"}
          {v.crits ? ` (${v.crits} crit${v.crits === 1 ? "" : "s"})` : ""} · {v.misses} {v.misses === 1 ? "miss" : "misses"}
          {v.fumbles ? ` (${v.fumbles} natural 1)` : ""}
        </span>
        <span className="ml-auto tabular-nums">{damageWords(v.taken) || "no damage"}</span>
        <InkButton onClick={() => setOpen((o) => !o)}>{open ? "hide" : "each"}</InkButton>
      </p>
      {open && (
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 pl-2 text-sm">
          {v.attacks.map((a, i) => (
            <span key={i} className={a.result === "crit" ? INK.rubric : a.result === "hit" ? "" : INK.faint} title={RESULT_WORD[a.result]}>
              <span className="tabular-nums">{d20Words(a.d20)}</span>
              {a.result === "crit" ? "!" : ""} → {a.taken ? total(a.taken.by_type) : "—"}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function AttacksEntry({ entry }) {
  const volleys = asList(entry.result?.volleys);
  const all = volleys.reduce((n, v) => n + v.total, 0);
  return (
    <div className="py-1">
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-[15px]">{entry.label || "Attacks"}</span>
        {volleys.length > 1 && <span className={`text-sm italic ${INK.faded}`}>{volleys.length} targets · {all} damage in all</span>}
      </p>
      <div className="mt-0.5 space-y-0.5">
        {volleys.map((v, i) => (
          <VolleyLine key={i} v={v} showName={volleys.length > 1} />
        ))}
      </div>
    </div>
  );
}

/* ─── the log ────────────────────────────────────────────────────── */

export default function RollLog({ log, onAgain }) {
  if (!log.length) return <p className={`py-3 text-sm italic ${INK.faint}`}>Nothing rolled yet. Rolls stay here while the app is open.</p>;
  return (
    <div>
      {log.map((entry) => (
        <div key={entry.id} className="border-b border-rule/20 py-2 last:border-b-0">
          <p className={`flex items-baseline gap-2 ${smallCaps}`}>
            <span>{entry.source}</span>
            <span className={`font-normal normal-case tracking-normal ${INK.faint}`}>{time(entry.at)}</span>
            {entry.kind === "roll" && onAgain && (
              <span className="ml-auto font-normal normal-case tracking-normal">
                <InkButton onClick={() => onAgain(entry)}>again</InkButton>
              </span>
            )}
          </p>
          {entry.kind === "roll" && asList(entry.result?.rolls).map((line, i) => <RollLine key={i} line={line} />)}
          {entry.kind === "saves" && <SavesEntry entry={entry} />}
          {entry.kind === "attacks" && <AttacksEntry entry={entry} />}
        </div>
      ))}
    </div>
  );
}