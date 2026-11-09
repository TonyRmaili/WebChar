import React, { useMemo, useRef, useState } from "react";
import CompGroupRoll from "../../../../components/dice/GroupRoll";
import { MODES, damageWords } from "../../../../components/dice/diceWords";
import useDiceStore from "../../../../store/DiceStore";
import useMinionStore, { selKey } from "../../../../store/MinionStore";
import { INK, InkButton, InkNumber, InkRemove, InkSelect } from "../../../../styles/parchment";
import { chipBtn } from "../../../../styles/parchmentForm";
import { DAMAGE_TYPES } from "../../../../utils/Constants";
import { displayName, hpMaxOf } from "./minionHelpers";
import { applyToUnits, effectLine, rollingEffects, selectedByGroup, spendUses, unitTargets, usesLeft } from "./minionDice";

/* ═══════════════════════════════════════════════════════════════════
   MinionDicePanel — the dice tower's Minions tab, for the character open
   on the sheet (useMinionStore).

   Units are picked here or on the sheet — it's the same selection.

     They attack        each group with selected units rolls one of its
                        statblock's attacks or saves (already filled in),
                        N times per unit, at a target's AC or save bonus.
                        Limited uses are spent for every unit that used it.
     They save          incoming area damage (GroupRoll)
     They're attacked   incoming attacks (GroupRoll)

   Results land in the tower's roll log too.
   ═══════════════════════════════════════════════════════════════════ */

const EMPTY = [];
const TYPES = DAMAGE_TYPES.map((t) => t.toLowerCase());
const smallCaps = `text-[10px] font-semibold uppercase tracking-[0.18em] ${INK.faded}`;
const MODES_OF_PANEL = [
  { value: "attack", label: "They attack" },
  { value: "save", label: "They save" },
  { value: "attacked", label: "They're attacked" },
];

/* ─── picking units ──────────────────────────────────────────────── */

function UnitPicker({ minions, selected, setSelected }) {
  const last = useRef(null); // { minionId, index } for Shift ranges
  const keys = new Set(selected);

  const click = (m, index, e) => {
    const units = m.units || [];
    const k = selKey(m.id, units[index].id);
    if (e.shiftKey && last.current?.minionId === m.id) {
      const [a, b] = [last.current.index, index].sort((x, y) => x - y);
      setSelected([...selected, ...units.slice(a, b + 1).map((u) => selKey(m.id, u.id))]);
    } else {
      setSelected(keys.has(k) ? selected.filter((x) => x !== k) : [...selected, k]);
    }
    last.current = { minionId: m.id, index };
  };
  const setGroup = (m, which) => {
    const groupKeys = (m.units || []).map((u) => selKey(m.id, u.id));
    const others = selected.filter((k) => !groupKeys.includes(k));
    const pick = which === "standing" ? (m.units || []).filter((u) => u.hp > 0).map((u) => selKey(m.id, u.id)) : which === "all" ? groupKeys : [];
    setSelected([...others, ...pick]);
  };

  return (
    <div className="space-y-2">
      {minions.map((m) => {
        const units = m.units || [];
        const max = hpMaxOf(m);
        const picked = units.filter((u) => keys.has(selKey(m.id, u.id))).length;
        return (
          <div key={m.id}>
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-[15px]">{displayName(m)}</span>
              <span className={`text-xs italic ${INK.faded}`}>
                {picked} of {units.length} selected
              </span>
              <span className="ml-auto flex gap-x-3">
                <InkButton onClick={() => setGroup(m, "standing")}>standing</InkButton>
                <InkButton onClick={() => setGroup(m, "all")}>all</InkButton>
                {picked > 0 && <InkButton onClick={() => setGroup(m, "none")}>none</InkButton>}
              </span>
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {units.map((u, i) => {
                const on = keys.has(selKey(m.id, u.id));
                const down = u.hp <= 0;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={(e) => click(m, i, e)}
                    aria-pressed={on}
                    title={`${displayName(m)} ${i + 1}: ${u.hp}/${max} HP${down ? " — down" : ""} · Shift-click: everyone in between`}
                    className={`flex h-8 min-w-[2.6rem] flex-col items-center justify-center rounded-[3px] border px-1 leading-none transition ${
                      on ? "border-[#9a3412] bg-[#9a3412]/10" : "border-[#7b6346]/40 hover:border-[#3a2716]"
                    } ${down ? "opacity-45" : ""}`}
                  >
                    <span className={`text-[9px] ${INK.faint}`}>{i + 1}</span>
                    <span className={`text-[13px] tabular-nums ${down ? "line-through" : u.hp < max / 2 ? INK.rubric : ""}`}>{u.hp}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── a target's defenses (optional) ─────────────────────────────── */

const DEFENSE_KINDS = [
  { key: "resistances", label: "resists" },
  { key: "immunities", label: "immune to" },
  { key: "vulnerabilities", label: "vulnerable to" },
];

function DefensePicker({ value, onChange }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      {DEFENSE_KINDS.map(({ key, label }) => (
        <span key={key} className={`flex flex-wrap items-baseline gap-x-1.5 text-sm italic ${INK.faded}`}>
          {label}
          {value[key].map((t) => (
            <span key={t} className="inline-flex items-baseline not-italic text-[#3a2716]">
              {t}
              <InkRemove onClick={() => onChange({ ...value, [key]: value[key].filter((x) => x !== t) })} label={`Not ${label} ${t}`} />
            </span>
          ))}
          <InkSelect value="" onChange={(e) => e.target.value && onChange({ ...value, [key]: [...value[key], e.target.value] })} aria-label={`Target ${label}`} className="h-6 text-sm">
            <option value="">+</option>
            {TYPES.filter((t) => !value[key].includes(t)).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </InkSelect>
        </span>
      ))}
    </span>
  );
}

/* ─── they attack ────────────────────────────────────────────────── */

function GroupAttack({ group, config, setConfig }) {
  const { minion, units } = group;
  const effects = rollingEffects(minion);
  const effect = effects.find((e) => e.id === config.effectId) || effects[0];
  const standing = units.filter(({ unit }) => unit.hp > 0);
  const able = effect ? standing.filter(({ unit }) => usesLeft(unit, effect) > 0) : [];
  const down = units.length - standing.length;

  return (
    <div className="border-b border-[#7b6346]/15 py-2 last:border-b-0">
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-[15px]">{displayName(minion)}</span>
        <span className={`text-sm italic ${INK.faded}`}>
          × {able.length}
          {down ? ` · ${down} down, left out` : ""}
          {effect?.maxUses != null && able.length < standing.length ? ` · ${standing.length - able.length} have no use left` : ""}
        </span>
      </p>
      {effects.length === 0 ? (
        <p className={`text-sm italic ${INK.faint}`}>Nothing to roll — its statblock has no attacks or saves.</p>
      ) : (
        <>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {effects.map((e) => (
              <button key={e.id} type="button" onClick={() => setConfig({ ...config, effectId: e.id })} className={`text-left text-sm ${e.id === effect.id ? INK.rubric : INK.faded} hover:text-[#3a2716]`}>
                <span className={e.id === effect.id ? "underline decoration-dotted underline-offset-4" : ""}>{e.name}</span>
                <span className={`ml-1.5 text-xs italic ${INK.faint}`}>{effectLine(e)}</span>
                {e.maxUses != null && <span className={`ml-1 text-xs italic ${INK.faint}`}>({e.maxUses} use{e.maxUses === 1 ? "" : "s"})</span>}
              </button>
            ))}
          </div>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-4 text-sm">
            <span className={`flex items-baseline gap-1.5 italic ${INK.faded}`}>
              {effect.kind === "attack" ? "attacks each" : "uses each"}
              <InkNumber value={config.each} min={1} max={20} fallback={1} onChange={(v) => setConfig({ ...config, each: v ?? 1 })} aria-label={`${displayName(minion)}: times each`} className="h-6 w-9" />
            </span>
            {effect.kind === "attack" && (
              <InkSelect value={config.mode} onChange={(e) => setConfig({ ...config, mode: e.target.value })} aria-label={`${displayName(minion)}: advantage`} className="h-6 text-sm">
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </InkSelect>
            )}
            <span className={`italic ${INK.faint}`}>
              {able.length * config.each} {effect.kind === "attack" ? "attacks" : `${effect.ability.toUpperCase()} saves`}
            </span>
          </p>
        </>
      )}
    </div>
  );
}

function TheyAttack({ minions, selected, source }) {
  const groups = useMemo(() => selectedByGroup(minions, selected), [minions, selected]);
  const [configs, setConfigs] = useState({}); // minion id → { effectId, each, mode }
  const [target, setTarget] = useState({ ac: 15, save: 2, saveMode: "normal", defenses: { resistances: [], immunities: [], vulnerabilities: [] } });
  const [critRule, setCritRule] = useState("double_dice");
  const [results, setResults] = useState(null); // [{ name, line, byType }]
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  const configOf = (m) => configs[m.id] || { effectId: rollingEffects(m)[0]?.id, each: 1, mode: "normal" };
  const setAll = (mode) => setConfigs(Object.fromEntries(groups.map((g) => [g.minion.id, { ...configOf(g.minion), mode }])));

  // Who rolls what: [{ minion, effect, unitIds, times, mode }]
  const plans = groups
    .map(({ minion, units }) => {
      const cfg = configOf(minion);
      const effect = rollingEffects(minion).find((e) => e.id === cfg.effectId) || rollingEffects(minion)[0];
      if (!effect) return null;
      const unitIds = units.filter(({ unit }) => unit.hp > 0 && usesLeft(unit, effect) > 0).map(({ unit }) => unit.id);
      return unitIds.length ? { minion, effect, unitIds, each: cfg.each, times: unitIds.length * cfg.each, mode: cfg.mode } : null;
    })
    .filter(Boolean);
  const hasSaves = plans.some((p) => p.effect.kind === "save");

  const roll = async () => {
    setBusy(true);
    setProblem(null);
    const dice = useDiceStore.getState();
    const out = [];
    const attacks = plans.filter((p) => p.effect.kind === "attack");

    if (attacks.length) {
      const res = await dice.attacks(
        {
          crit_rule: critRule,
          volleys: attacks.map((p) => ({
            key: p.minion.id,
            name: `${displayName(p.minion)} · ${p.effect.name}`,
            count: p.times,
            to_hit: p.effect.toHit,
            mode: p.mode,
            crit_on: 20,
            damage: p.effect.damage,
            ac: target.ac ?? 10,
            defenses: target.defenses,
          })),
        },
        { source, label: `Minions attack · AC ${target.ac}` }
      );
      if (!res.ok) {
        setBusy(false);
        return setProblem(res.message);
      }
      res.result.volleys.forEach((v) => {
        out.push({
          name: v.name,
          line: `${v.hits} of ${v.attacks.length} hit${v.crits ? ` (${v.crits} crit${v.crits === 1 ? "" : "s"})` : ""}${v.fumbles ? ` · ${v.fumbles} natural 1${v.fumbles === 1 ? "" : "s"}` : ""}`,
          byType: v.taken,
        });
      });
    }

    // A save effect: the target saves once against each use of it.
    for (const p of plans.filter((x) => x.effect.kind === "save")) {
      const res = await dice.saves(
        {
          dc: p.effect.dc,
          on_success: p.effect.half ? "half" : "none",
          damage: p.effect.damage,
          damage_roll: "each",
          targets: Array.from({ length: p.times }, (_, i) => ({ key: `${p.minion.id}#${i}`, name: `Target vs ${displayName(p.minion)} ${i + 1}`, save_bonus: target.save ?? 0, mode: target.saveMode, defenses: target.defenses })),
        },
        { source, label: `${displayName(p.minion)} · ${p.effect.name}` }
      );
      if (!res.ok) {
        setProblem(res.message);
        continue;
      }
      const byType = {};
      for (const t of res.result.targets) {
        const took = t.passed ? t.if_passed : t.if_failed;
        for (const [k, n] of Object.entries(took.by_type)) byType[k] = (byType[k] || 0) + n;
      }
      out.push({ name: `${displayName(p.minion)} · ${p.effect.name}`, line: `the target failed ${res.result.failed}, saved ${res.result.passed}`, byType });
    }

    // Uses are spent by every unit that rolled a limited effect.
    const spent = plans.filter((p) => p.effect.maxUses != null).map((p) => spendUses(p.minion, p.unitIds, p.effect, p.each));
    if (spent.length) useMinionStore.getState().saveMany(spent);

    setResults(out);
    setBusy(false);
  };

  const all = {};
  for (const r of results || EMPTY) for (const [k, n] of Object.entries(r.byType || {})) all[k] = (all[k] || 0) + n;
  const total = Object.values(all).reduce((a, b) => a + b, 0);

  if (!groups.length) return <p className={`py-2 text-sm italic ${INK.faint}`}>Select the units that act — above, or on the sheet.</p>;

  return (
    <div className="space-y-3">
      <div>
        {groups.map((g) => (
          <GroupAttack key={g.minion.id} group={g} config={configOf(g.minion)} setConfig={(cfg) => setConfigs({ ...configs, [g.minion.id]: cfg })} />
        ))}
      </div>

      <div className="space-y-2 text-sm">
        <p className={smallCaps}>The target</p>
        <p className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className={`flex items-baseline gap-1.5 italic ${INK.faded}`}>
            AC
            <InkNumber value={target.ac} min={0} max={40} fallback={10} onChange={(v) => setTarget({ ...target, ac: v ?? 10 })} aria-label="Target AC" className="h-7 w-10 text-lg" />
          </span>
          {hasSaves && (
            <>
              <span className={`flex items-baseline gap-1.5 italic ${INK.faded}`}>
                save
                <InkNumber value={target.save} min={-10} max={30} fallback={0} onChange={(v) => setTarget({ ...target, save: v ?? 0 })} aria-label="Target save bonus" className="h-7 w-10 text-lg" />
              </span>
              <InkSelect value={target.saveMode} onChange={(e) => setTarget({ ...target, saveMode: e.target.value })} aria-label="Target saves with" className="h-6 text-sm">
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    saves {m.label}
                  </option>
                ))}
              </InkSelect>
            </>
          )}
          <span className="flex items-baseline gap-x-2">
            <span className={`italic ${INK.faded}`}>everyone rolls</span>
            {MODES.map((m) => (
              <button key={m.value} type="button" onClick={() => setAll(m.value)} className={chipBtn(plans.length > 0 && plans.every((p) => p.effect.kind !== "attack" || p.mode === m.value))}>
                {m.label}
              </button>
            ))}
          </span>
        </p>
        <DefensePicker value={target.defenses} onChange={(defenses) => setTarget({ ...target, defenses })} />
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className={`italic ${INK.faded}`}>a crit</span>
          <button type="button" onClick={() => setCritRule("double_dice")} className={chipBtn(critRule === "double_dice")}>
            doubles the dice
          </button>
          <button type="button" onClick={() => setCritRule("max_plus_roll")} className={chipBtn(critRule === "max_plus_roll")}>
            max + a roll
          </button>
        </p>
      </div>

      {problem && <p className={`text-sm italic ${INK.rubric}`}>{problem}</p>}
      <p className="flex items-baseline gap-x-4">
        <InkButton active onClick={roll} disabled={busy || !plans.length}>
          {busy ? "rolling…" : plans.length ? `roll for ${plans.reduce((n, p) => n + p.unitIds.length, 0)} units` : "no one can act"}
        </InkButton>
      </p>

      {results && (
        <div className="border-t border-[#7b6346]/30 pt-2">
          {results.map((r, i) => (
            <p key={i} className="flex flex-wrap items-baseline gap-x-3 py-0.5 text-sm">
              <span className="text-[15px]">{r.name}</span>
              <span className={INK.faded}>{r.line}</span>
              <span className="ml-auto tabular-nums">{damageWords(r.byType) || "no damage"}</span>
            </p>
          ))}
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <span className={smallCaps}>In all</span>
            <span className="text-2xl tabular-nums">{total}</span>
            <span className={`text-sm ${INK.faded}`}>{damageWords(all)}</span>
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── the tab ────────────────────────────────────────────────────── */

export default function MinionDicePanel() {
  const charName = useMinionStore((s) => s.charName);
  const minions = useMinionStore((s) => s.minions) || EMPTY;
  const selected = useMinionStore((s) => s.selected) || EMPTY;
  const setSelected = useMinionStore((s) => s.setSelected);
  const [mode, setMode] = useState("attack");

  const targets = useMemo(() => unitTargets(minions, selected), [minions, selected]);
  const source = `Minions · ${charName}`;

  if (!charName || !minions.length) {
    return <p className={`py-3 text-sm italic ${INK.faint}`}>Open a character with minions on the sheet, and they show up here.</p>;
  }

  const apply = (lines) => {
    useMinionStore.getState().saveMany(applyToUnits(useMinionStore.getState().minions, lines));
    setMode("attack");
  };

  return (
    <div className="space-y-4">
      <p className={`text-sm italic ${INK.faded}`}>{charName}'s minions · {selected.length} selected</p>
      <UnitPicker minions={minions} selected={selected} setSelected={setSelected} />

      <p className="flex flex-wrap items-baseline gap-x-3 border-t border-[#7b6346]/30 pt-3">
        {MODES_OF_PANEL.map((m) => (
          <button key={m.value} type="button" onClick={() => setMode(m.value)} className={`text-lg ${mode === m.value ? `${INK.rubric} underline decoration-dotted underline-offset-4` : `${INK.faded} hover:text-[#3a2716]`}`}>
            {m.label}
          </button>
        ))}
      </p>

      {mode === "attack" ? (
        <TheyAttack minions={minions} selected={selected} source={source} />
      ) : targets.length === 0 ? (
        <p className={`py-2 text-sm italic ${INK.faint}`}>Select the units that are hit — above, or on the sheet.</p>
      ) : (
        <CompGroupRoll key={`${mode}:${targets.map((t) => t.key).join(",")}`} kind={mode === "save" ? "save" : "attack"} targets={targets} source={source} onApply={apply} bare />
      )}
    </div>
  );
}