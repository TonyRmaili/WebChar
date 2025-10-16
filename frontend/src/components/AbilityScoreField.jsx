import React from "react";

function AbilityScoreField({ ability, row, onValueChange, onToggleProficient, onToggleExpertise }) {
  const value = row?.value ?? "";
  const proficient = !!row?.proficient;
  const expertise = !!row?.expertise;
  const label = row?.label ?? ability;

  return (
    <div className="py-3 flex items-center justify-between gap-4">
      <label className="font-medium text-slate-100" htmlFor={`${ability}-value`}>
        {label}
      </label>

      <div className="flex items-center gap-6">
        <input
          type="number"
          id={`${ability}-value`}
          name={`${ability}-value`}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className="w-20 text-center font-bold rounded border border-slate-700 bg-slate-900 text-slate-100"
          min={0}
        />

        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={proficient}
            onChange={onToggleProficient}
            className="h-4 w-4 accent-orange-500"
          />
          <span className="text-slate-200 text-sm">Prof.</span>
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={expertise}
            onChange={onToggleExpertise}
            className="h-4 w-4 accent-orange-500"
          />
          <span className="text-slate-200 text-sm">Exp.</span>
        </label>
      </div>
    </div>
  );
}

export default AbilityScoreField;
