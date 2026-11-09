import React, { useMemo, useRef, useState } from "react";
import { openDiceTower } from "../../../../components/dice/DiceTowerWindow";
import useMinionStore, { selKey } from "../../../../store/MinionStore";
import MinionPlayCard from "./MinionPlayCard";
import { blankNumber, note, stamp } from "../play/PlayParts";
import { changeHp, setUnitHp } from "./minionHelpers";

/* Play section for minions.
   Which units are selected is screen state (never saved), kept in the
   minion store so the dice tower's Minions tab sees the same selection.
   The bar on top applies damage, healing or an exact HP value to every
   selected unit, across all groups, in one save per group; "Dice tower"
   opens the tower on its Minions tab for attacks and saves.
   Written on the Play sheet: the bar is a line with a hairline under it,
   the groups are headings, no boxes. */

export default function MinionsPlay() {
  const minions = useMinionStore((s) => s.minions);
  const saveMinion = useMinionStore((s) => s.saveMinion);
  const saveMany = useMinionStore((s) => s.saveMany);
  const selectedKeys = useMinionStore((s) => s.selected);
  const setSelectedKeys = useMinionStore((s) => s.setSelected);

  const selected = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const setSelected = (next) => setSelectedKeys([...next]);
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

  const barBtn = "h-8 px-3 text-sm";
  const quietNote = `${note} text-ink-faded hover:text-rubric`;

  return (
    <div className="@container space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-rule/25 pb-3">
        <span className="pr-1 text-sm text-ink-faded">
          <span className={`font-semibold tabular-nums ${count ? "text-rubric" : "text-ink-faded"}`}>{count}</span> selected
        </span>

        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={amount}
          placeholder="HP"
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Amount"
          className={`h-8 w-16 ${blankNumber}`}
        />

        <button
          type="button"
          onClick={() => apply("damage")}
          disabled={!amountOk || !count}
          className={`${barBtn} ${stamp("bad")}`}
        >
          Damage
        </button>
        <button
          type="button"
          onClick={() => apply("heal")}
          disabled={!amountOk || !count}
          className={`${barBtn} ${stamp("good")}`}
        >
          Heal
        </button>
        <button
          type="button"
          onClick={() => apply("set")}
          disabled={!amountOk || !count}
          title="Set selected units to exactly this HP"
          className={`${barBtn} ${stamp("plain")}`}
        >
          Set
        </button>

        <div className="ml-auto flex items-baseline gap-4">
          <button type="button" onClick={() => openDiceTower("minions")} title="Attacks and saves for the selected units" className={`${note} text-rubric hover:text-rubric-deep`}>
            dice tower
          </button>
          <button type="button" onClick={selectStanding} className={quietNote}>
            select standing
          </button>
          <button type="button" onClick={() => setSelected(new Set())} disabled={!count} className={quietNote}>
            clear
          </button>
        </div>
      </div>

      {/* Groups: one column at half width on most screens, more when wide */}
      <div className="grid grid-cols-1 items-start gap-x-8 gap-y-6 @3xl:grid-cols-2 @6xl:grid-cols-3">
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