import React, { useState } from "react";

import useCharStore from "../store/CharStore";
import useMonsterStore from "../store/MonsterStore";
import useAuthStore from "../store/AuthStore";
import useDiceStore from "../store/DiceStore";

import { DICE_TYPES, DAMAGE_TYPES } from "../utils/Constants";

const makeRow = () => ({
  amount: 1,
  dice_type: "d4",
  mod: 0,
  damage_type: DAMAGE_TYPES[0].toLowerCase(),
});

function DiceTower({ units }) {
  const userData = useAuthStore((s) => s.userData);
  const charData = useCharStore((s) => s.charData);
  const minionsData = useMonsterStore((s) => s.minionsData);
  const postDice = useDiceStore((s) => s.postDice);

  const [rows, setRows] = useState([]);

  function updateRow(index, field, value) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      )
    );
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow()]);
  }

  function removeRow(index) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSendDice() {
    const diceInstances = rows.map((row) => ({
      amount: Number(row.amount) || 0,
      dice_type: row.dice_type,
      mod: Number(row.mod) || 0,
      damage_type: row.damage_type,
    }));

    console.log(diceInstances)

    const conclusion = await postDice(diceInstances); // now sending an array
    console.log(conclusion);
  }

  return (
    <div className="p-2 bg-stone-600 text-black flex flex-col gap-2">
      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={addRow}
          className="text-amber-300 text-xs bg-slate-900 rounded-lg px-3 py-1 border border-slate-700 hover:bg-slate-800"
        >
          + Add dice
        </button>

        <button
          className="text-amber-500 bg-red-950 rounded-lg px-3 py-1 border border-red-700 hover:bg-red-900 text-xs"
          onClick={onSendDice}
        >
          SEND
        </button>
      </div>
      {rows.map((row, index) => (
        <div
          key={index}
          className="flex gap-4 items-end bg-stone-700/60 rounded-lg px-2 py-2"
        >
          <div className="flex flex-col">
            <label className="text-xs text-amber-200 flex justify-center">
              Amount
            </label>
            <input
              type="number"
              min={1}
              value={row.amount}
              onChange={(e) =>
                updateRow(index, "amount", Number(e.target.value) || 0)
              }
              className="text-red-100 w-16 bg-slate-800 rounded-lg px-2 py-1"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-amber-200 flex justify-center">
              Dice
            </label>
            <select
              value={row.dice_type}
              onChange={(e) => updateRow(index, "dice_type", e.target.value)}
              className="text-red-100 w-20 bg-slate-800 rounded-lg px-2 py-1"
            >
              {DICE_TYPES.map((c) => (
                <option key={c} value={c.toLowerCase()}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-amber-200 flex justify-center">
              Mod
            </label>
            <input
              type="number"
              value={row.mod}
              onChange={(e) =>
                updateRow(index, "mod", Number(e.target.value) || 0)
              }
              className="text-red-100 w-16 bg-slate-800 rounded-lg px-2 py-1"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-amber-200 flex justify-center">
              Damage
            </label>
            <select
              value={row.damage_type}
              onChange={(e) =>
                updateRow(index, "damage_type", e.target.value)
              }
              className="text-red-100 w-32 bg-slate-800 rounded-lg px-2 py-1"
            >
              {DAMAGE_TYPES.map((c) => (
                <option key={c} value={c.toLowerCase()}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => removeRow(index)}
            className="text-xs text-red-200 border border-red-500/60 px-2 py-1 rounded-lg bg-red-950/70 hover:bg-red-900"
          >
            Remove
          </button>
        </div>
      ))}

      <div className="text-black font-semibold flex border justify-between px-12">

        <div>
          <p>Characters</p>
        </div>

        <div>
          <p>Minions</p>  
        </div>
      </div>


      <label className="text-amber-300 flex justify-center">
        Output
      </label>
      <textarea
        value=""
        readOnly
        className="w-full h-32 bg-slate-800 text-slate-100 p-2 rounded"
      ></textarea>

    </div>
  );
}

export default DiceTower;
