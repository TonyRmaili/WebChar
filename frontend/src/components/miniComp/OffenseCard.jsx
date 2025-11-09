import React, { useMemo } from "react";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

const toInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
};

export default function OffenseCard({ charData, updateCharField, postCharData }) {
  const pb = charData.pb?.total ?? 0;
  const scores = charData.ability_scores || {};
  const dexMod = toInt(charData.ability_scores?.dex?.mod ?? 0);

  // ---------- normalize offense ----------
  const offense = useMemo(() => {
    const base = typeof charData.offense === "object" ? charData.offense : {};

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
      save_dcs: {},
    };

    const rawSaveDcs =
      base.save_dcs && typeof base.save_dcs === "object" ? base.save_dcs : {};

    const entries = Object.entries(rawSaveDcs);
    if (entries.length === 0) {
      normalized.save_dcs.save_1 = { base: "cha", mod: 0, total: 0 };
    } else {
      for (const [k, v] of entries) {
        normalized.save_dcs[k] = {
          base: v?.base ?? "cha",
          mod: toInt(v?.mod ?? 0),
          total: toInt(v?.total ?? 0),
        };
      }
    }

    return normalized;
  }, [charData.offense]);

  // ---------- normalize initiative ----------
  const initiative = useMemo(() => {
    const base = typeof charData.initiative === "object" ? charData.initiative : {};
    const mod = toInt(base.mod ?? 0);
    const total = dexMod + mod;
    return { mod, total };
  }, [charData.initiative, dexMod]);

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

    const rawSaveDcs =
      result.save_dcs && typeof result.save_dcs === "object"
        ? result.save_dcs
        : {};

    const newSaveDcs = {};
    for (const [key, row] of Object.entries(rawSaveDcs)) {
      const base = row?.base ?? "cha";
      const mod = toInt(row?.mod ?? 0);
      const total = 8 + pb + mod + abilMod(base);
      newSaveDcs[key] = { ...row, base, mod, total };
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

  const setSaveRow = (saveKey, key, val) => {
    const currentSaves = offense.save_dcs || {};
    const next = {
      ...offense,
      save_dcs: {
        ...currentSaves,
        [saveKey]: {
          ...currentSaves[saveKey],
          [key]: key === "mod" ? toInt(val) : val,
        },
      },
    };
    writeOffense(next);
  };

  const addSaveDc = () => {
    const currentSaves = offense.save_dcs || {};
    const nums = Object.keys(currentSaves)
      .filter((k) => /^save_\d+$/.test(k))
      .map((k) => Number(k.split("_").pop()));
    const nextIdx = nums.length ? Math.max(...nums) + 1 : 1;
    const saveKey = `save_${nextIdx}`;
    const next = {
      ...offense,
      save_dcs: {
        ...currentSaves,
        [saveKey]: { base: "cha", mod: 0, total: 0 },
      },
    };
    writeOffense(next);
  };

  const removeSaveDc = (saveKey) => {
    const currentSaves = offense.save_dcs || {};
    const keys = Object.keys(currentSaves);
    if (keys.length <= 1) return;
    const { [saveKey]: _, ...rest } = currentSaves;
    const next = {
      ...offense,
      save_dcs: rest,
    };
    writeOffense(next);
  };

  const setInitiativeMod = (val) => {
    const mod = toInt(val);
    const total = dexMod + mod;
    updateCharField("initiative", { mod, total });
    postCharData();
  };

  const saveKeys = useMemo(
    () =>
      Object.keys(offense.save_dcs || {})
        .filter((k) => /^save_\d+$/.test(k))
        .sort((a, b) => Number(a.split("_").pop()) - Number(b.split("_").pop())),
    [offense.save_dcs]
  );

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

        {/* Save DCs */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <button
              onClick={addSaveDc}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px]"
            >
              + Save DC
            </button>
          </div>

          {saveKeys.map((key) => {
            const row = offense.save_dcs[key];
            return (
              <div key={key} className="flex items-center gap-1">
                <select
                  value={row.base}
                  onChange={(e) => setSaveRow(key, "base", e.target.value)}
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
                  value={row.mod}
                  onChange={(e) => setSaveRow(key, "mod", e.target.value)}
                  className="text-slate-700 rounded border border-slate-600 w-10 px-1 py-0.5 text-xs"
                />
                <p>=</p>
                <input
                  type="number"
                  value={saveTotal(row)}
                  disabled
                  className="rounded border border-amber-500 w-10 px-1 py-0.5 bg-amber-300 text-slate-900 text-xs font-semibold"
                />
                <button
                  onClick={() => removeSaveDc(key)}
                  className="rounded border border-slate-600 px-1.5 py-0.5 text-[10px]"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {/* vertical divider between Save and Init */}
        <div className="self-stretch w-px bg-amber-700/70 mx-1" />

        {/* Initiative */}
        <div className="flex items-center gap-1 text-xs">
          <span className="w-10 text-xs text-slate-300 text-right">Init</span>
          <input
            type="number"
            step="1"
            value={initiative.mod}
            onChange={(e) => setInitiativeMod(e.target.value)}
            className="text-slate-700 rounded border border-slate-600 w-10 px-1 py-0.5"
          />
          <span className="px-1 text-[10px] text-slate-400">=</span>
          <input
            type="number"
            disabled
            value={initiative.total}
            className="rounded border border-amber-500 w-10 px-1 py-0.5 bg-amber-300 text-slate-900 text-xs font-semibold"
          />
        </div>
      </div>
    </div>
  );
}
