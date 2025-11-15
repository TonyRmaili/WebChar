import React, { memo } from "react";

const PlayerCard = ({ index, player, onRemove, onUpdate }) => {
  // Helpers so parent only needs (field, value)
  const onText = (field) => (e) => onUpdate(field, e.target.value);
  const onNumber = (field) => (e) => onUpdate(field, Number(e.target.value));

  return (
    <li className="rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium">Player {index + 1}</h2>
        <button
          onClick={onRemove}
          className="text-sm rounded-lg px-2 py-1 bg-rose-100 text-rose-700 hover:bg-rose-200"
        >
          Remove
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col">
          {/* note: `text-slate-1600` was a typo; Tailwind maxes at 950. */}
          <label className="text-sm text-slate-1600 mb-1">Name</label>
          <input
            type="text"
            value={player.name}
            onChange={onText("name")}
            placeholder="e.g., Thoriak"
            className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col">
            <label className="text-sm text-slate-1600 mb-1">Initiative</label>
            <input
              type="number"
              inputMode="numeric"
              value={player.initiative}
              onChange={onNumber("initiative")}
              className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-slate-1600 mb-1">HP</label>
            <input
              type="number"
              inputMode="numeric"
              value={player.hp}
              onChange={onNumber("hp")}
              className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col">
            <label className="text-sm text-slate-1600 mb-1">Perception</label>
            <input
              type="number"
              inputMode="numeric"
              value={player.perception}
              onChange={onNumber("perception")}
              className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-slate-1600 mb-1">AC</label>
            <input
              type="number"
              inputMode="numeric"
              value={player.ac}
              onChange={onNumber("ac")}
              className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </li>
  );
};

export default memo(PlayerCard);
