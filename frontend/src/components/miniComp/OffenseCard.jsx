import React, { useMemo } from "react";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

const toInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
};

export default function OffenseCard({ charData, updateCharField, postCharData }) {
  const pb = charData.pb?.total ?? 0;
  const scores = charData.ability_scores || {};
 

  // ---------- normalize offense ----------
  const offense = useMemo(() => {
    const base = typeof charData.offense === "object" ? charData.offense : {};

    const rawSaveDcs =
      base.save_dcs && typeof base.save_dcs === "object" ? base.save_dcs : {};

    const normalizedSaveDcs = {};
    for (const ab of ABILITIES) {
      const key = `save_${ab}`;
      const row = rawSaveDcs[key] || {};
      normalizedSaveDcs[key] = {
        base: row.base || ab,
        mod: toInt(row.mod ?? 0),
        total: toInt(row.total ?? 0),
        active: !!row.active,
      };
    }

    const normalized = {
      melee: {
        base: "str",
        mod: 0,
        total: 0,
        ...(base.melee || {}),
      },
      ranged: {
        base: "dex",
        mod: 0,
        total: 0,
        ...(base.ranged || {}),
      },
      spell: {
        base: "cha",
        mod: 0,
        total: 0,
        ...(base.spell || {}),
      },
      save_dcs: normalizedSaveDcs,
    };

    return normalized;
  }, [charData.offense]);

  
  
  // ---------- helpers ----------
  const abilMod = (a) => toInt(scores?.[a]?.mod ?? 0);

  const atkTotal = (row) => pb + toInt(row.mod) + abilMod(row.base);
  const saveTotal = (row) => 8 + pb + toInt(row.mod) + abilMod(row.base);

  // recompute totals before writing offense to charData
  const withTotals = (raw) => {
    const result = { ...raw };

    const calcAttack = (kind) => {
      const row = result[kind] || {};
      const defaultBase =
        kind === "ranged" ? "dex" : kind === "spell" ? "cha" : "str";
      const base = row.base || defaultBase;
      const mod = toInt(row.mod ?? 0);
      const total = pb + mod + abilMod(base);
      result[kind] = { ...row, base, mod, total };
    };

    calcAttack("melee");
    calcAttack("ranged");
    calcAttack("spell");

    const newSaveDcs = {};
    for (const ab of ABILITIES) {
      const key = `save_${ab}`;
      const row = (result.save_dcs && result.save_dcs[key]) || {};
      const base = row.base || ab;
      const mod = toInt(row.mod ?? 0);
      const active = !!row.active;
      const total = 8 + pb + mod + abilMod(base);
      newSaveDcs[key] = { ...row, base, mod, active, total };
    }
    result.save_dcs = newSaveDcs;

    return result;
  };

  const writeOffense = (next) => {
    const nextWithTotals = withTotals(next);
    updateCharField("offense", nextWithTotals);
    postCharData();
  };

  const setAttack = (kind, key, val) => {
    const next = {
      ...offense,
      [kind]: {
        ...offense[kind],
        [key]: key === "mod" ? toInt(val) : val,
      },
    };
    writeOffense(next);
  };

  const setSaveRow = (saveKey, field, val) => {
    const currentSaves = offense.save_dcs || {};
    const existing = currentSaves[saveKey] || {};

    let nextValue = val;
    if (field === "mod") nextValue = toInt(val);
    if (field === "active") nextValue = !!val;

    const next = {
      ...offense,
      save_dcs: {
        ...currentSaves,
        [saveKey]: {
          ...existing,
          [field]: nextValue,
        },
      },
    };
    writeOffense(next);
  };

  

  return (
    <div className="flex flex-col gap-2 text-slate-100 text-xs">
      {/* Top row: Attacks + Save DC + Initiative */}
      <div className="flex gap-2 items-start">
        {/* Attacks */}
        <div className="flex flex-col gap-1">
          {/* Melee */}
          <div className="flex items-center gap-1">
            <p className="w-10 text-xs text-slate-300 text-right">Melee</p>
            <select
              value={offense.melee.base}
              onChange={(e) => setAttack("melee", "base", e.target.value)}
              className="text-slate-700 rounded border border-slate-600 w-16 px-1 py-0.5 text-xs"
            >
              {ABILITIES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="1"
              value={offense.melee.mod}
              onChange={(e) => setAttack("melee", "mod", e.target.value)}
              className="text-slate-700 rounded border border-slate-600 w-10 px-1 py-0.5 text-xs"
            />
            <p>=</p>
            <input
              type="number"
              value={atkTotal(offense.melee)}
              disabled
              className="rounded border border-amber-500 w-10 px-1 py-0.5 bg-amber-300 text-slate-900 text-xs font-semibold"
            />
          </div>

          {/* Ranged */}
          <div className="flex items-center gap-1">
            <p className="w-10 text-xs text-slate-300 text-right">Ranged</p>
            <select
              value={offense.ranged.base}
              onChange={(e) => setAttack("ranged", "base", e.target.value)}
              className="text-slate-700 rounded border border-slate-600 w-16 px-1 py-0.5 text-xs"
            >
              {ABILITIES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="1"
              value={offense.ranged.mod}
              onChange={(e) => setAttack("ranged", "mod", e.target.value)}
              className="text-slate-700 rounded border border-slate-600 w-10 px-1 py-0.5 text-xs"
            />
            <p>=</p>
            <input
              type="number"
              value={atkTotal(offense.ranged)}
              disabled
              className="rounded border border-amber-500 w-10 px-1 py-0.5 bg-amber-300 text-slate-900 text-xs font-semibold"
            />
          </div>

          {/* Spell */}
          <div className="flex items-center gap-1">
            <p className="w-10 text-xs text-slate-300 text-right">Spell</p>
            <select
              value={offense.spell.base}
              onChange={(e) => setAttack("spell", "base", e.target.value)}
              className="text-slate-700 rounded border border-slate-600 w-16 px-1 py-0.5 text-xs"
            >
              {ABILITIES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="1"
              value={offense.spell.mod}
              onChange={(e) => setAttack("spell", "mod", e.target.value)}
              className="text-slate-700 rounded border border-slate-600 w-10 px-1 py-0.5 text-xs"
            />
            <p>=</p>
            <input
              type="number"
              value={atkTotal(offense.spell)}
              disabled
              className="rounded border border-amber-500 w-10 px-1 py-0.5 bg-amber-300 text-slate-900 text-xs font-semibold"
            />
          </div>
        </div>

        {/* vertical divider between Attacks and Save */}
        <div className="self-stretch w-px bg-amber-700/70 mx-1" />

        {/* Save DCs: 2 columns x 3 rows */}
        <div className="flex flex-col gap-1">          
          <div className="grid grid-cols-2 gap-1">
            {ABILITIES.map((ab) => {
              const key = `save_${ab}`;
              const row =
                offense.save_dcs[key] || {
                  base: ab,
                  mod: 0,
                  total: 0,
                  active: false,
                };
              const labelBase =
                ab.charAt(0).toUpperCase() + ab.slice(1); // str -> Str

              return (
                <div
                  key={key}
                  className="flex items-center gap-1 rounded border border-slate-600 bg-slate-900/60 px-1 py-0.5"
                >
                  <input
                    type="checkbox"
                    className="h-3 w-3"
                    checked={!!row.active}
                    onChange={(e) => setSaveRow(key, "active", e.target.checked)}
                  />
                  <div className="flex-1 flex flex-col gap-0.5">
                    <div className="text-[10px]">
                      <span className="text-amber-500 font-semibold">
                        {labelBase}
                      </span>
                      <span className="ml-0.5 text-slate-200">SaveDC</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        readOnly
                        value={saveTotal(row)}
                        className="w-10 px-1 py-0.5 rounded border border-amber-500 bg-amber-300 text-slate-900 text-[10px] font-semibold text-center"
                      />
                      <input
                        type="number"
                        value={row.mod}
                        onChange={(e) =>
                          setSaveRow(key, "mod", e.target.value)
                        }
                        className="w-10 px-1 py-0.5 rounded border border-slate-600 bg-white text-slate-900 text-[10px] text-center"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* vertical divider between Save and Init */}
        <div className="self-stretch w-px bg-amber-700/70 mx-1" />

       

      </div>
    </div>
  );
}
