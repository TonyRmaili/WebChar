import React, { useMemo } from "react";
import useCharStore from "../store/CharStore";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

const toInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
};

export default function OffensePlay() {
  const { charData, updateCharField, postCharData } = useCharStore();
  if (!charData) return null;

  const pb = charData.pb?.total ?? 0;
  const scores = charData.ability_scores || {};
  const dexMod = toInt(charData.ability_scores?.dex?.mod ?? 0);

  // ---------- normalize offense ----------
  const offense = useMemo(() => {
    const base = typeof charData.offense === "object" ? charData.offense : {};
    const normalized = {
      melee: { base: "str", mod: 0, ...(base.melee || {}) },
      ranged: { base: "dex", mod: 0, ...(base.ranged || {}) },
      spell: { base: "cha", mod: 0, ...(base.spell || {}) },
    };

    const saveEntries = Object.entries(base)
      .filter(([k]) => /^save_dc_\d+$/.test(k))
      .sort(([a], [b]) => Number(a.split("_").pop()) - Number(b.split("_").pop()));

    if (saveEntries.length === 0) {
      normalized.save_dc_1 = { base: "cha", mod: 0 };
    } else {
      for (const [k, v] of saveEntries) {
        normalized[k] = { base: "cha", mod: 0, ...(v || {}) };
      }
    }
    return normalized;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charData.offense]);

  // ---------- normalize initiative ----------
  const initiative = useMemo(() => {
    const base = typeof charData.initiative === "object" ? charData.initiative : {};
    const mod = toInt(base.mod ?? 0);
    const total = dexMod + mod;
    return { mod, total };
  }, [charData.initiative, dexMod]);

  // helpers
  const abilMod = (a) => toInt(scores?.[a]?.mod ?? 0);
  const atkTotal = (row) => pb + toInt(row.mod) + abilMod(row.base);
  const saveTotal = (row) => 8 + pb + toInt(row.mod) + abilMod(row.base);

  const writeOffense = (next) => {
    updateCharField("offense", next);
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
    const next = {
      ...offense,
      [saveKey]: {
        ...offense[saveKey],
        [key]: key === "mod" ? toInt(val) : val,
      },
    };
    writeOffense(next);
  };

  const addSaveDc = () => {
    const nums = Object.keys(offense)
      .filter((k) => /^save_dc_\d+$/.test(k))
      .map((k) => Number(k.split("_").pop()));
    const nextIdx = nums.length ? Math.max(...nums) + 1 : 1;
    const saveKey = `save_dc_${nextIdx}`;
    writeOffense({ ...offense, [saveKey]: { base: "cha", mod: 0 } });
  };

  const removeSaveDc = (saveKey) => {
    const keys = Object.keys(offense).filter((k) => /^save_dc_\d+$/.test(k));
    if (keys.length <= 1) return;
    const { [saveKey]: _, ...rest } = offense;
    writeOffense(rest);
  };

  const setInitiativeMod = (val) => {
    const mod = toInt(val);
    const total = dexMod + mod;
    updateCharField("initiative", { mod, total });
    postCharData();
  };

  const saveKeys = useMemo(
    () =>
      Object.keys(offense)
        .filter((k) => /^save_dc_\d+$/.test(k))
        .sort((a, b) => Number(a.split("_").pop()) - Number(b.split("_").pop())),
    [offense]
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

    {/* Save DCs, compact, no labels */}
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
        const row = offense[key];
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

    {/* Initiative, all on one row */}
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
