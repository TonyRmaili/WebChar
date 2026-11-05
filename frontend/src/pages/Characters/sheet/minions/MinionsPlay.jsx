import React, { useMemo, useRef, useState } from "react";
import useMinionStore from "../../../../store/MinionStore";
import MinionPlayCard from "./MinionPlayCard";
import { changeHp, setUnitHp } from "./minionHelpers";

/* Play section for minions.
   Selection lives here, on screen only (it is never saved). The bar on
   top applies damage, healing or an exact HP value to every selected
   unit, across all groups, in one save per group. */

const selKey = (minionId, unitId) => `${minionId}:${unitId}`;

export default function MinionsPlay() {
  const minions = useMinionStore((s) => s.minions);
  const saveMinion = useMinionStore((s) => s.saveMinion);
  const saveMany = useMinionStore((s) => s.saveMany);

  const [selected, setSelected] = useState(() => new Set());
  const [amount, setAmount] = useState("");
  const lastClick = useRef(null); // { minionId, index } for shift-click ranges

  // Drop selections that point at units which no longer exist.
  const liveSelected = useMemo(() => {
    const exists = new Set();
    for (const m of minions) for (const u of m.units || []) exists.add(selKey(m.id, u.id));
    return new Set([...selected].filter((k) => exists.has(k)));
  }, [selected, minions]);

  const count = liveSelected.size;
  const amountNum = Math.trunc(Number(amount));
  const amountOk = Number.isFinite(amountNum) && amountNum >= 0 && String(amount).trim() !== "";

  /* ---- selection ---- */

  const onUnitClick = (minion, unitId, index, shift) => {
    const next = new Set(liveSelected);
    const last = lastClick.current;

    if (shift && last && last.minionId === minion.id) {
      const [from, to] = [Math.min(last.index, index), Math.max(last.index, index)];
      (minion.units || []).slice(from, to + 1).forEach((u) => next.add(selKey(minion.id, u.id)));
    } else {
      const k = selKey(minion.id, unitId);
      next.has(k) ? next.delete(k) : next.add(k);
    }

    lastClick.current = { minionId: minion.id, index };
    setSelected(next);
  };

  const onSelectGroup = (minion, on) => {
    const next = new Set(liveSelected);
    (minion.units || []).forEach((u) => {
      const k = selKey(minion.id, u.id);
      on ? next.add(k) : next.delete(k);
    });
    setSelected(next);
  };

  const selectStanding = () => {
    const next = new Set();
    for (const m of minions) for (const u of m.units || []) if (u.hp > 0) next.add(selKey(m.id, u.id));
    setSelected(next);
  };

  /* ---- applying HP changes ---- */

  const apply = (mode) => {
    if (!amountOk || count === 0) return;

    const changed = [];
    for (const m of minions) {
      const ids = (m.units || []).filter((u) => liveSelected.has(selKey(m.id, u.id))).map((u) => u.id);
      if (ids.length === 0) continue;

      let next = m;
      if (mode === "damage") next = changeHp(m, ids, -amountNum);
      else if (mode === "heal") next = changeHp(m, ids, amountNum);
      else ids.forEach((id) => (next = setUnitHp(next, id, amountNum)));
      changed.push(next);
    }
    saveMany(changed);
  };

  if (minions.length === 0) return null;

  const barBtn =
    "h-9 rounded-lg border px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="@container space-y-3">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 p-2">
        <span className="px-1 text-sm text-slate-300">
          <span className={`font-semibold tabular-nums ${count ? "text-amber-300" : "text-slate-500"}`}>{count}</span>{" "}
          selected
        </span>

        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={amount}
          placeholder="HP"
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Amount"
          className="h-9 w-20 rounded-lg border border-slate-600 bg-slate-950 text-center text-sm text-amber-200
                     placeholder:text-slate-600 focus:border-amber-500/70 focus:outline-none"
        />

        <button
          type="button"
          onClick={() => apply("damage")}
          disabled={!amountOk || !count}
          className={`${barBtn} border-red-700 bg-red-900/40 text-red-100 hover:bg-red-900/60`}
        >
          Damage
        </button>
        <button
          type="button"
          onClick={() => apply("heal")}
          disabled={!amountOk || !count}
          className={`${barBtn} border-emerald-700 bg-emerald-900/40 text-emerald-100 hover:bg-emerald-900/60`}
        >
          Heal
        </button>
        <button
          type="button"
          onClick={() => apply("set")}
          disabled={!amountOk || !count}
          title="Set selected units to exactly this HP"
          className={`${barBtn} border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800`}
        >
          Set
        </button>

        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={selectStanding}
            className="h-9 rounded-lg px-2.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-amber-300"
          >
            Select standing
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={!count}
            className="h-9 rounded-lg px-2.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-amber-300 disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Groups: one column at half width on most screens, more when wide */}
      <div className="grid grid-cols-1 items-start gap-3 @3xl:grid-cols-2 @6xl:grid-cols-3">
        {minions.map((m) => (
          <MinionPlayCard
            key={m.id}
            minion={m}
            isSelected={(unitId) => liveSelected.has(selKey(m.id, unitId))}
            onUnitClick={(unitId, index, shift) => onUnitClick(m, unitId, index, shift)}
            onSelectGroup={(on) => onSelectGroup(m, on)}
            onChange={saveMinion}
          />
        ))}
      </div>
    </div>
  );
}