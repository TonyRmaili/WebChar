import React from 'react';

function AbilityScoreField({ ability, handleChange, handleToggleChange, abilityScores }) {
  return (
    <div className="text-orange-400 mt-10 flex justify-between items-center gap-4">
      <label className="font-semibold text-xl" htmlFor={ability}>
      {abilityScores[ability].label}
      </label>
      <input
        type="number"
        id={ability}
        name={ability}
        onChange={(e) => handleChange(e, ability)}
        className="w-20 text-center font-bold rounded"
      />
      <input
        onChange={() => handleToggleChange(ability)}
        checked={abilityScores[ability].isChecked}
        type="checkbox"
        name={ability}
      />
    </div>
  );
}

export default AbilityScoreField;
