import React, { useEffect, useState } from "react";
import useCharStore from "../store/CharStore";
import AbilityScoreField from "./AbilityScoreField";
import SkillField from "./miniComp/SkillField";

function AbilityScore() {
  const { charData, setCharData } = useCharStore();
  const [abilityScores, setAbilityScores] = useState({
    stre: { value: null, isChecked: false, label: "Strength" },
    dex: { value: null, isChecked: false, label: "Dexterity" },
    con: { value: null, isChecked: false, label: "Constitution" },
    int: { value: null, isChecked: false, label: "Intelligence" },
    wis: { value: null, isChecked: false, label: "Wisdom" },
    char: { value: null, isChecked: false, label: "Charisma" }
  });

  const [skills, setSkills] = useState({
    acrobatics: { value: null, isChecked: false, label: "Acrobatics" },
    animalHandling: { value: null, isChecked: false, label: "Animal Handling" },
    arcana: { value: null, isChecked: false, label: "Arcana" },
    athletics: { value: null, isChecked: false, label: "Athletics" },
    deception: { value: null, isChecked: false, label: "Deception" },
    history: { value: null, isChecked: false, label: "History" },
    insight: { value: null, isChecked: false, label: "Insight" },
    intimidation: { value: null, isChecked: false, label: "Intimidation" },
    investigation: { value: null, isChecked: false, label: "Investigation" },
    medicine: { value: null, isChecked: false, label: "Medicine" },
    nature: { value: null, isChecked: false, label: "Nature" },
    perception: { value: null, isChecked: false, label: "Perception" },
    performance: { value: null, isChecked: false, label: "Performance" },
    persuasion: { value: null, isChecked: false, label: "Persuasion" },
    religion: { value: null, isChecked: false, label: "Religion" },
    sleightOfHand: { value: null, isChecked: false, label: "Sleight of Hand" },
    stealth: { value: null, isChecked: false, label: "Stealth" },
    survival: { value: null, isChecked: false, label: "Survival" }
  });


  

  const handleToggleAbility = (ability) => {
    setAbilityScores((prevAbilityScores) => ({
      ...prevAbilityScores,
      [ability]: {
        ...prevAbilityScores[ability],
        isChecked: !prevAbilityScores[ability].isChecked,
      },
    }));
  };

  const handleToggleSkill = (skill) => {
    setSkills((prevSkills) => ({
      ...prevSkills,
      [skill]: {
        ...prevSkills[skill],
        isChecked: !prevSkills[skill].isChecked,
      },
    }));
  };

  function handleAbilityChange(e, ability) {
    const { value } = e.target;
    setAbilityScores((prevAbilityScores) => ({
      ...prevAbilityScores,
      [ability]: {
        ...prevAbilityScores[ability],
        value: Number(value),
      },
    }));
  }


  function handleSkillChange(e, skill){
    const { value } = e.target;
    setSkills((prevSkills) => ({
      ...prevSkills,
      [skill]: {
        ...prevSkills[skill],
        value: Number(value),
      },
    }));
  }

  useEffect(() => {
    setCharData({
      ...charData,
      ability_scores: abilityScores,
      skills: skills
    });
  }, [abilityScores]);


  useEffect(() => {
    console.log(charData);
  }, [charData]);

  return (
    <>
    <p className="flex ml-48 text-orange-500 font-semibold text-lg">
      Saving Throw Profficiency
    </p>

    <div className="flex gap-20 px-4">
      <div className="w-72">
        <div className="flex flex-col border">
          {Object.keys(abilityScores).map((ability) => (
            <AbilityScoreField
              key={ability}
              ability={ability}
              handleChange={handleAbilityChange}
              handleToggleChange={handleToggleAbility}
              abilityScores={abilityScores}
            />
          ))}
        </div>
      </div>
        <div className="w-72">
          <div className="flex flex-col border">
            {Object.keys(skills).map((skill) => (
              <SkillField
                key={skill}
                skill={skill}
                handleSkillChange={handleSkillChange}
                handleToggleSkill={handleToggleSkill}
                skills={skills}
              />
            ))}
          </div>
        </div>
    </div>
  </>
  );
}

export default AbilityScore;
