import React from 'react';

function SkillField({ skill, handleSkillChange, handleToggleSkill, skills }) {
  return (
    <div className="text-orange-400 mt-10 flex justify-between items-center gap-4">
      <label className="font-semibold text-xl" htmlFor={skill}>
      {skills[skill].label}
      </label>
      <input
        type="number"
        id={skill}
        name={skill}
        onChange={(e) => handleSkillChange(e, skill)}
        className="w-20 text-center font-bold rounded"
      />
      <input
        onChange={() => handleToggleSkill(skill)}
        checked={skills[skill].isChecked}
        type="checkbox"
        name={skill}
      />
    </div>
  );
}

export default SkillField;
