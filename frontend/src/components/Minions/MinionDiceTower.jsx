import React, { useState } from "react";
import useDiceStore from "../../store/DiceStore";
import { DICE_TYPES, DAMAGE_TYPES, ROLL_TYPES } from "../../utils/Constants";

const makeRow = () => ({
  amount: 1,
  dice_type: "d4",
  mod: 0,
  damage_type: DAMAGE_TYPES[0].toLowerCase(),
});

function MinionDiceTower({ minions }) {
  const postDice = useDiceStore((s) => s.postDice);
  const postMinionEffects = useDiceStore((s) => s.postMinionEffects);

  const [targetAC, setTargetAC] = useState(10);
  const [targetSaveMod, setTargetSaveMod] = useState(5);

  const [targetRollType, setTargetRollType] = useState("normal");
  const [minionsRollType, setMinionsRollType] = useState("normal");

  const [outputData, setOutputData] = useState("");

  const [rows, setRows] = useState([]);
 
  const [selectedEffects, setSelectedEffects] = useState({}); 


  function updateRow(index, field, value) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
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

    console.log("Selected effects:", selectedEffects);
    console.log("Dice:", diceInstances);

    // const conclusion = await postDice(diceInstances);
    // console.log(conclusion);
  }

  function formatBackendResult(conclusion) {
    // If backend already returns the formatted text
    if (typeof conclusion === "string") {
      let text = conclusion;

      // Strip wrapping quotes if present
      if (text.startsWith('"') && text.endsWith('"')) {
        text = text.slice(1, -1);
      }

      // Turn literal "\n" into real newlines
      text = text.replace(/\\n/g, "\n");

      return text;
    }

    // Fallback for when you send structured JSON instead of text
    return JSON.stringify(conclusion, null, 2);
  }


  async function onSendMinions() {
  const payloadMinions = Object.values(selectedEffects); 
  
  const conclusion = await postMinionEffects(
    payloadMinions,
    targetAC,
    targetSaveMod,
    targetRollType,
    minionsRollType
  );
  setOutputData(formatBackendResult(conclusion));
}

  function toggleEffect(minion, category, effect) {
  const minionKey = minion.file_path || minion.name;

  setSelectedEffects((prev) => {
    const existingGroup =
      prev[minionKey] || {
        minion_name: minion.name,
        minion_path: minion.file_path,
        units: minion.units || [],
        effects_by_category: {},
      };

    const currentForCategory =
      existingGroup.effects_by_category[category] || [];

    const exists = currentForCategory.some((e) => e.id === effect.id);

    // Toggle effect in this category
    const newCategoryList = exists
      ? currentForCategory.filter((e) => e.id !== effect.id)
      : [...currentForCategory, effect];

    const newEffectsByCategory = {
      ...existingGroup.effects_by_category,
    };

    if (newCategoryList.length === 0) {
      delete newEffectsByCategory[category];
    } else {
      newEffectsByCategory[category] = newCategoryList;
    }

    const hasAnyEffects = Object.keys(newEffectsByCategory).length > 0;

    const next = { ...prev };
    if (!hasAnyEffects) {
      // no effects left for this minion → remove minion group
      delete next[minionKey];
    } else {
      next[minionKey] = {
        ...existingGroup,
        units: minion.units || existingGroup.units,
        effects_by_category: newEffectsByCategory,
      };
    }

    return next;
  });
}

function DisplayEffects({ minion }) {
  const effectsObj = minion.effects || {};
  const totalUnits = minion.units?.length ?? 0;
  const selectedUnits = minion.units?.filter((u) => u.selected).length ?? 0;
  const minionKey = minion.file_path || minion.name;

  return (
    <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900/60">
      <header className="text-amber-400 text-sm font-semibold border-b border-blue-900 px-2 py-1">
        <span>{minion.name} </span>
        <span className=" text-slate-400">
          {selectedUnits}/{totalUnits}
        </span>
      </header>

      <div className="p-1 space-y-1">
        {Object.entries(effectsObj).map(([category, list]) => {
          if (!Array.isArray(list) || list.length === 0) return null;

          return (
            <div key={category} className="space-y-0.5">
              <div className="text-[10px] uppercase tracking-wide text-slate-400 px-1">
                {category.replace("_", " ")}
              </div>

              <div className="flex flex-wrap gap-1 px-1">
                {list.map((effect) => {
                  const group = selectedEffects[minionKey];
                  const catList =
                    group?.effects_by_category?.[category] || [];
                  const isSelected = catList.some(
                    (e) => e.id === effect.id
                  );

                  return (
                    <button
                      key={effect.id}
                      type="button"
                      onClick={() => toggleEffect(minion, category, effect)}
                      className={[
                        "px-2 py-0.5 rounded border text-[10px] leading-tight",
                        "transition",
                        isSelected
                          ? "border-amber-400 bg-amber-500/10 text-amber-300"
                          : "border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200",
                      ].join(" ")}
                    >
                      {effect.name || "(unnamed)"}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Map tags like [HIT], [MISS], [PIERCING] to Tailwind classes
const TAG_STYLES = {
  "[HIT]": "text-green-400",
  "[MISS]": "text-red-400",
  "[CRIT]": "text-fuchsia-400",
  "[CRIT MISS]": "text-red-500 font-bold",
  "[SAVE]": "text-emerald-300",
  "[SAVE (HALF)]": "text-yellow-300",
  "[FAIL]": "text-red-300",

  "[BLUDGEONING]": "text-slate-200",
  "[PIERCING]": "text-yellow-300",
  "[SLASHING]": "text-cyan-300",
  "[FIRE]": "text-red-400",
  "[COLD]": "text-cyan-400",
  "[LIGHTNING]": "text-blue-400",
  "[ACID]": "text-green-400",
  "[POISON]": "text-lime-400",
  "[NECROTIC]": "text-fuchsia-300",
  "[RADIANT]": "text-amber-300",
  "[PSYCHIC]": "text-purple-300",
};

// Regex to capture tags like [HIT], [CRIT MISS], [BLUDGEONING] etc.
const TAG_REGEX =
  /(\[CRIT MISS\]|\[SAVE \(HALF\)\]|\[HIT\]|\[MISS\]|\[CRIT\]|\[SAVE\]|\[FAIL\]|\[[A-Z]+\])/g;

function renderColoredOutput(text) {
  if (!text) return null;

  // Split into parts, keeping the tags as separate items
  const parts = text.split(TAG_REGEX);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (TAG_STYLES[part]) {
      return (
        <span key={idx} className={TAG_STYLES[part]}>
          {part}
        </span>
      );
    }

    // Normal text
    return <span key={idx}>{part}</span>;
  });
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
              onChange={(e) => updateRow(index, "damage_type", e.target.value)}
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

      {minions.map((minion) => (
        <DisplayEffects key={minion.id || minion.name} minion={minion} />
      ))}

      {/* Roll config */}
      <div className="flex gap-2 text-sm text-amber-400">
        <div className="flex flex-col">
          <label>Target AC</label>
          <input
            className="text-red-100 w-16 bg-slate-800 rounded-lg px-2 py-1"
            type="number"
            min={0}
            value={targetAC}
            onChange={(e) => setTargetAC(Number(e.target.value) || 10)}
          />
        </div>

        <div className="flex flex-col">
          <label>Target SaveMod</label>
          <input
            className="text-red-100 w-28 bg-slate-800 rounded-lg px-2 py-1"
            type="number"
            min={0}
            value={targetSaveMod}
            onChange={(e) => setTargetSaveMod(Number(e.target.value) || 5)}
          />
        </div>

        <div className="flex flex-col">
          <label>Target Roll Type</label>
          <select
            className="text-red-100 w-32 bg-slate-800 rounded-lg px-2 py-1"
            value={targetRollType}
            onChange={(e) => setTargetRollType(e.target.value)}
          >
            {ROLL_TYPES.map((c) => (
              <option key={c} value={c.toLowerCase()}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label>Minions Roll Type</label>
          <select
            className="text-red-100 w-32 bg-slate-800 rounded-lg px-2 py-1"
            value={minionsRollType}
            onChange={(e) => setMinionsRollType(e.target.value)}
          >
            {ROLL_TYPES.map((c) => (
              <option key={c} value={c.toLowerCase()}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <button
          className="text-amber-500 bg-red-950 rounded-lg px-3 py-1 border border-red-700 hover:bg-red-900 text-xs h-7 mt-5"
          onClick={onSendMinions}
        >
          Send Minions!
        </button>
      </div>

      <label className="text-amber-300 flex justify-center">Output</label>
      <pre className="w-full h-64 bg-slate-800 text-slate-100 p-2 rounded overflow-auto whitespace-pre-wrap font-mono text-xs">
        {renderColoredOutput(outputData)}
      </pre>

    </div>
  );
}

export default MinionDiceTower;
