import React from "react";
import { usePopupStore } from "../../../../store/PopupStore";
import {
  PLAY_SECTIONS,
  chargeKey,
  changeUse,
  displayName,
  effectChips,
  hpMaxOf,
  itemMaxUses,
  monsterAc,
  rechargeLabel,
  restoreAll,
} from "./minionHelpers";

/* One minion group at the table: unit HP tokens on top, the group's
   actions below. Selection is passed in from MinionsPlay so damage and
   healing can hit units across several groups at once. */

const hpTone = (hp, max) => {
  if (hp <= 0) return { bar: "bg-slate-600", text: "text-slate-500" };
  const pct = hp / max;
  if (pct <= 0.25) return { bar: "bg-red-500", text: "text-red-300" };
  if (pct <= 0.5) return { bar: "bg-amber-500", text: "text-amber-200" };
  return { bar: "bg-emerald-500", text: "text-emerald-200" };
};

function UnitToken({ index, unit, max, selected, onClick }) {
  const tone = hpTone(unit.hp, max);
  const down = unit.hp <= 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={`Unit ${index + 1}: ${unit.hp}/${max} HP${down ? " (down)" : ""}\nClick to select · Shift-click to select a range`}
      className={`relative flex w-[4.5rem] flex-col gap-1 overflow-hidden rounded-lg border px-2 pb-1.5 pt-1 text-left transition ${
        selected
          ? "border-amber-400 bg-amber-500/15 ring-1 ring-amber-400/60"
          : "border-slate-700 bg-slate-950/70 hover:border-slate-500"
      } ${down ? "opacity-60" : ""}`}
    >
      <span className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold text-slate-500">{index + 1}</span>
        <span className={`text-sm font-semibold tabular-nums ${tone.text}`}>
          {down ? "down" : unit.hp}
        </span>
      </span>
      <span className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
        <span
          className={`block h-full rounded-full ${tone.bar}`}
          style={{ width: `${Math.max(0, Math.min(100, (unit.hp / max) * 100))}%` }}
        />
      </span>
    </button>
  );
}

const CHIP_TONE = {
  hit: "border-sky-700/70 text-sky-200",
  save: "border-violet-700/70 text-violet-200",
  range: "border-slate-600 text-slate-300",
  damage: "border-rose-800/70 text-rose-200",
};

function EffectRow({ sectionKey, item, minion, onChange }) {
  const max = itemMaxUses(item);
  const key = chargeKey(sectionKey, item);
  const units = minion.units || [];
  const chips = effectChips(item);
  const recharge = rechargeLabel(item.charges);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-2.5 py-1.5" title={item.notes || ""}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium text-slate-100">{item.name}</span>
        {chips.map((c, i) => (
          <span key={i} className={`rounded-full border px-1.5 py-px text-[10px] ${CHIP_TONE[c.kind]}`}>
            {c.text}
          </span>
        ))}
      </div>

      {max != null && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {recharge && <span className="mr-1 text-[10px] text-slate-500">{recharge}</span>}
          {units.map((u, i) => {
            const cur = Math.max(0, Math.min(max, Number(u.charges?.[key] ?? max)));
            const empty = cur <= 0;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => !empty && onChange(changeUse(minion, u.id, key, max, -1))}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (cur < max) onChange(changeUse(minion, u.id, key, max, +1));
                }}
                title={`Unit ${i + 1}: ${cur}/${max} uses\nClick to use · right-click to restore one`}
                className={`rounded border px-1.5 py-px text-[10px] tabular-nums transition ${
                  empty
                    ? "border-slate-800 text-slate-600"
                    : "border-amber-600/60 text-amber-200 hover:bg-amber-500/15"
                }`}
              >
                {units.length > 1 ? `U${i + 1} ` : ""}
                {cur}/{max}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MinionPlayCard({ minion, isSelected, onUnitClick, onSelectGroup, onChange }) {
  const openPopup = usePopupStore((s) => s.open);

  const m = minion.monster || {};
  const units = minion.units || [];
  const max = hpMaxOf(minion);
  const ac = monsterAc(m);
  const alive = units.filter((u) => u.hp > 0).length;
  const allSelected = units.length > 0 && units.every((u) => isSelected(u.id));

  const sections = PLAY_SECTIONS.map(({ key, title }) => ({
    key,
    title,
    items: m.effects?.[key]?.items || [],
  })).filter((s) => s.items.length > 0);

  const onRestore = () => {
    if (window.confirm(`Restore ${displayName(minion)}: full HP and all uses for every unit?`)) {
      onChange(restoreAll(minion));
    }
  };

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
      {/* Header */}
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-semibold text-amber-200">
            {displayName(minion)}
            <span className="ml-1.5 text-sm font-normal text-slate-400">×{units.length}</span>
          </h4>
          <p className="text-[11px] text-slate-400">
            {ac != null && <>AC <span className="text-slate-200">{ac}</span> · </>}
            HP <span className="text-slate-200">{max}</span> each ·{" "}
            <span className={alive < units.length ? "text-amber-300" : ""}>{alive} standing</span>
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => openPopup("monster", m)}
            className="h-7 rounded-md border border-slate-600 px-2 text-[11px] text-slate-300 hover:border-amber-500/50 hover:text-amber-300"
          >
            Statblock
          </button>
          <button
            type="button"
            onClick={onRestore}
            title="Full HP and all uses"
            className="h-7 rounded-md border border-slate-600 px-2 text-[11px] text-slate-300 hover:border-teal-500/50 hover:text-teal-300"
          >
            Restore
          </button>
        </div>
      </header>

      {/* Units */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Units</span>
          <button
            type="button"
            onClick={() => onSelectGroup(!allSelected)}
            className="text-[11px] text-slate-400 hover:text-amber-300"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {units.map((u, i) => (
            <UnitToken
              key={u.id}
              index={i}
              unit={u}
              max={max}
              selected={isSelected(u.id)}
              onClick={(e) => onUnitClick(u.id, i, e.shiftKey)}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      {sections.length > 0 && (
        <div className="space-y-2">
          {sections.map((s) => (
            <div key={s.key} className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{s.title}</div>
              {s.items.map((item, i) => (
                <EffectRow
                  key={`${s.key}-${item.name}-${i}`}
                  sectionKey={s.key}
                  item={item}
                  minion={minion}
                  onChange={onChange}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}