import React from "react";
import { usePopupStore } from "../../../../store/PopupStore";
import { note } from "../play/PlayParts";
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
   healing can hit units across several groups at once.
   On the Play sheet: the group is a heading, units are small parchment
   tokens (ringed in rubric when selected), actions are rows marked by a
   rule down their left edge. */

const hpTone = (hp, max) => {
  if (hp <= 0) return { bar: "bg-rule/40", text: "text-ink-faded" };
  const pct = hp / max;
  if (pct <= 0.25) return { bar: "bg-bad", text: "text-bad" };
  if (pct <= 0.5) return { bar: "bg-warn", text: "text-warn" };
  return { bar: "bg-good", text: "text-good" };
};

const smallCaps = "text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faded";

function UnitToken({ index, unit, max, selected, onClick }) {
  const tone = hpTone(unit.hp, max);
  const down = unit.hp <= 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={`Unit ${index + 1}: ${unit.hp}/${max} HP${down ? " (down)" : ""}\nClick to select · Shift-click to select a range`}
      className={`relative flex w-[4.5rem] flex-col gap-1 overflow-hidden rounded-md border px-2 pb-1.5 pt-1 text-left transition ${
        selected ? "border-rubric bg-rubric/[0.07] ring-1 ring-rubric" : "border-rule/40 bg-page-light/60 hover:border-ink"
      } ${down ? "opacity-60" : ""}`}
    >
      <span className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold text-ink-faded">{index + 1}</span>
        <span className={`text-sm font-semibold tabular-nums ${tone.text}`}>
          {down ? "down" : unit.hp}
        </span>
      </span>
      <span className="h-1 w-full overflow-hidden rounded-full bg-rule/20">
        <span
          className={`block h-full rounded-full ${tone.bar}`}
          style={{ width: `${Math.max(0, Math.min(100, (unit.hp / max) * 100))}%` }}
        />
      </span>
    </button>
  );
}

const CHIP_TONE = {
  hit: "text-info",
  save: "text-magic",
  range: "text-ink-faded",
  damage: "text-bad",
};

function EffectRow({ sectionKey, item, minion, onChange }) {
  const max = itemMaxUses(item);
  const key = chargeKey(sectionKey, item);
  const units = minion.units || [];
  const chips = effectChips(item);
  const recharge = rechargeLabel(item.charges);

  return (
    <div className="border-l-2 border-rule/40 py-1 pl-2.5" title={item.notes || ""}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="text-[15px] font-semibold text-ink">{item.name}</span>
        {chips.map((c, i) => (
          <span key={i} className={`text-[10px] font-semibold uppercase tracking-wider ${CHIP_TONE[c.kind] || CHIP_TONE.range}`}>
            {c.text}
          </span>
        ))}
      </div>

      {max != null && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {recharge && <span className="mr-1 text-xs italic text-ink-faded">{recharge}</span>}
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
                className={`rounded-sm border px-1.5 py-px text-[11px] tabular-nums transition ${
                  empty ? "border-rule/20 text-ink-faint" : "border-warn/50 text-warn hover:bg-warn/10"
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
    <article className="flex flex-col gap-3">
      {/* Header */}
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-lg tracking-wide text-ink">
            {displayName(minion)}
            <span className="ml-1.5 text-sm text-ink-faded">×{units.length}</span>
          </h4>
          <p className="text-xs italic text-ink-faded">
            {ac != null && <>AC <span className="font-semibold not-italic text-ink">{ac}</span> · </>}
            HP <span className="font-semibold not-italic text-ink">{max}</span> each ·{" "}
            <span className={alive < units.length ? "font-semibold text-warn" : ""}>{alive} standing</span>
          </p>
        </div>
        <div className="flex shrink-0 items-baseline gap-3 pt-1">
          <button type="button" onClick={() => openPopup("monster", m)} className={`${note} text-ink-faded hover:text-rubric`}>
            statblock
          </button>
          <button type="button" onClick={onRestore} title="Full HP and all uses" className={`${note} text-ink-faded hover:text-good`}>
            restore
          </button>
        </div>
      </header>

      {/* Units */}
      <div>
        <div className="mb-1.5 flex items-baseline gap-2">
          <span className={smallCaps}>Units</span>
          <span className="h-px flex-1 translate-y-[-3px] bg-rule/20" />
          <button type="button" onClick={() => onSelectGroup(!allSelected)} className={`${note} text-ink-faded hover:text-rubric`}>
            {allSelected ? "deselect all" : "select all"}
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
              <div className={smallCaps}>{s.title}</div>
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