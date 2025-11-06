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

  // ---------- normalize offense from charData or defaults ----------
  const offense = useMemo(() => {
    const base = typeof charData.offense === "object" ? charData.offense : {};
    const normalized = {
      melee: { base: "str", mod: 0, ...(base.melee || {}) },
      ranged: { base: "dex", mod: 0, ...(base.ranged || {}) },
      spell: { base: "cha", mod: 0, ...(base.spell || {}) },
    };
    // collect existing save_dc_N entries
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

  // helpers
  const abilMod = (a) => toInt(scores?.[a]?.mod ?? 0);
  const atkTotal = (row) => pb + toInt(row.mod) + abilMod(row.base);
  const saveTotal = (row) => 8 + pb + toInt(row.mod) + abilMod(row.base);

  const writeOffense = (next) => {
    updateCharField("offense", next);
    postCharData();
  };

  const setAttack = (kind, key, val) => {
    const next = { ...offense, [kind]: { ...offense[kind], [key]: key === "mod" ? toInt(val) : val } };
    writeOffense(next);
  };

  const setSaveRow = (saveKey, key, val) => {
    const next = { ...offense, [saveKey]: { ...offense[saveKey], [key]: key === "mod" ? toInt(val) : val } };
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
    // keep at least one
    const keys = Object.keys(offense).filter((k) => /^save_dc_\d+$/.test(k));
    if (keys.length <= 1) return;
    const { [saveKey]: _, ...rest } = offense;
    writeOffense(rest);
  };

  // derive ordered save keys for rendering
  const saveKeys = useMemo(
    () =>
      Object.keys(offense)
        .filter((k) => /^save_dc_\d+$/.test(k))
        .sort((a, b) => Number(a.split("_").pop()) - Number(b.split("_").pop())),
    [offense]
  );

  return (
    <div className="flex flex-col gap-4 text-slate-100">
      {/* Attacks */}
      <div className="flex flex-col gap-2">
        {/* Melee */}
        <div className="flex items-center gap-2">
          <p className="w-24">Melee atk:</p>
          <select
            value={offense.melee.base}
            onChange={(e) => setAttack("melee", "base", e.target.value)}
            className="text-slate-700 rounded-md border border-slate-600 w-20 px-2 py-1"
          >
            {ABILITIES.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <input
            type="number"
            step="1"
            value={offense.melee.mod}
            onChange={(e) => setAttack("melee", "mod", e.target.value)}
            className="text-slate-700 rounded-md border border-slate-600 w-16 px-2 py-1"
          />
          <input
            type="number"
            value={atkTotal(offense.melee)}
            disabled
            className="rounded-md border border-slate-600 w-14 px-2 py-1 bg-slate-200 text-slate-800"
          />
        </div>

        {/* Ranged */}
        <div className="flex items-center gap-2">
          <p className="w-24">Ranged atk:</p>
          <select
            value={offense.ranged.base}
            onChange={(e) => setAttack("ranged", "base", e.target.value)}
            className="text-slate-700 rounded-md border border-slate-600 w-20 px-2 py-1"
          >
            {ABILITIES.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <input
            type="number"
            step="1"
            value={offense.ranged.mod}
            onChange={(e) => setAttack("ranged", "mod", e.target.value)}
            className="text-slate-700 rounded-md border border-slate-600 w-16 px-2 py-1"
          />
          <input
            type="number"
            value={atkTotal(offense.ranged)}
            disabled
            className="rounded-md border border-slate-600 w-14 px-2 py-1 bg-slate-200 text-slate-800"
          />
        </div>

        {/* Spell */}
        <div className="flex items-center gap-2">
          <p className="w-24">Spell atk:</p>
          <select
            value={offense.spell.base}
            onChange={(e) => setAttack("spell", "base", e.target.value)}
            className="text-slate-700 rounded-md border border-slate-600 w-20 px-2 py-1"
          >
            {ABILITIES.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <input
            type="number"
            step="1"
            value={offense.spell.mod}
            onChange={(e) => setAttack("spell", "mod", e.target.value)}
            className="text-slate-700 rounded-md border border-slate-600 w-16 px-2 py-1"
          />
          <input
            type="number"
            value={atkTotal(offense.spell)}
            disabled
            className="rounded-md border border-slate-600 w-14 px-2 py-1 bg-slate-200 text-slate-800"
          />
        </div>
      </div>

      {/* Save DCs */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="font-medium">Save DCs</p>
          <button
            onClick={addSaveDc}
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1 text-sm"
          >
            Add Save DC
          </button>
        </div>

        {saveKeys.map((key) => {
          const row = offense[key];
          return (
            <div key={key} className="flex items-center gap-2">
              <p className="w-24">{key.replace("_", " ")}:</p>
              <select
                value={row.base}
                onChange={(e) => setSaveRow(key, "base", e.target.value)}
                className="text-slate-700 rounded-md border border-slate-600 w-20 px-2 py-1"
              >
                {ABILITIES.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <input
                type="number"
                step="1"
                value={row.mod}
                onChange={(e) => setSaveRow(key, "mod", e.target.value)}
                className="text-slate-700 rounded-md border border-slate-600 w-16 px-2 py-1"
              />
              <input
                type="number"
                value={saveTotal(row)}
                disabled
                className="rounded-md border border-slate-600 w-16 px-2 py-1 bg-slate-200 text-slate-800"
              />
              <button
                onClick={() => removeSaveDc(key)}
                className="ml-2 rounded-md border border-slate-600 px-2 py-1 text-sm"
                title="Remove"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
