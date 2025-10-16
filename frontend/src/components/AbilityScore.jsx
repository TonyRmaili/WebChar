import React, { useEffect, useMemo } from "react";
import useCharStore from "../store/CharStore";
import AbilityScoreField from "./AbilityScoreField";
import SkillField from "./miniComp/SkillField";

const defaultAbilityScores = {
  stre: { value: null, proficient: false, expertise: false, label: "Strength" },
  dex:  { value: null, proficient: false, expertise: false, label: "Dexterity" },
  con:  { value: null, proficient: false, expertise: false, label: "Constitution" },
  int:  { value: null, proficient: false, expertise: false, label: "Intelligence" },
  wis:  { value: null, proficient: false, expertise: false, label: "Wisdom" },
  char: { value: null, proficient: false, expertise: false, label: "Charisma" },
};

const defaultSkills = {
  acrobatics:      { value: null, proficient: false, expertise: false, label: "Acrobatics" },
  animalHandling:  { value: null, proficient: false, expertise: false, label: "Animal Handling" },
  arcana:          { value: null, proficient: false, expertise: false, label: "Arcana" },
  athletics:       { value: null, proficient: false, expertise: false, label: "Athletics" },
  deception:       { value: null, proficient: false, expertise: false, label: "Deception" },
  history:         { value: null, proficient: false, expertise: false, label: "History" },
  insight:         { value: null, proficient: false, expertise: false, label: "Insight" },
  intimidation:    { value: null, proficient: false, expertise: false, label: "Intimidation" },
  investigation:   { value: null, proficient: false, expertise: false, label: "Investigation" },
  medicine:        { value: null, proficient: false, expertise: false, label: "Medicine" },
  nature:          { value: null, proficient: false, expertise: false, label: "Nature" },
  perception:      { value: null, proficient: false, expertise: false, label: "Perception" },
  performance:     { value: null, proficient: false, expertise: false, label: "Performance" },
  persuasion:      { value: null, proficient: false, expertise: false, label: "Persuasion" },
  religion:        { value: null, proficient: false, expertise: false, label: "Religion" },
  sleightOfHand:   { value: null, proficient: false, expertise: false, label: "Sleight of Hand" },
  stealth:         { value: null, proficient: false, expertise: false, label: "Stealth" },
  survival:        { value: null, proficient: false, expertise: false, label: "Survival" },
};

function AbilityScore() {
  const { charData, updateCharField, postCharData } = useCharStore();

  // Guard
  if (!charData) return null;

  // Safe views with defaults if backend hasn’t set them yet
  const abilityScores = useMemo(
    () => ({ ...defaultAbilityScores, ...(charData.ability_scores || {}) }),
    [charData?.ability_scores]
  );
  const skills = useMemo(
    () => ({ ...defaultSkills, ...(charData.skills || {}) }),
    [charData?.skills]
  );

  // ---- Handlers: Abilities ----
  const handleAbilityValueChange = (ability, raw) => {
    const value = raw === "" ? "" : Number(raw);
    if (value !== "" && Number.isNaN(value)) return;

    const next = {
      ...abilityScores,
      [ability]: { ...abilityScores[ability], value },
    };
    updateCharField("ability_scores", next);
    postCharData();
  };

  const toggleAbilityFlag = (ability, flag) => {
    const row = abilityScores[ability] || defaultAbilityScores[ability];
    const nextRow = { ...row, [flag]: !row[flag] };

    // Enforce rule
    if (flag === "expertise" && nextRow.expertise) nextRow.proficient = true;
    if (flag === "proficient" && !nextRow.proficient) nextRow.expertise = false;

    const next = { ...abilityScores, [ability]: nextRow };
    updateCharField("ability_scores", next);
    postCharData();
  };

  // ---- Handlers: Skills ----
  const handleSkillValueChange = (skill, raw) => {
    const value = raw === "" ? "" : Number(raw);
    if (value !== "" && Number.isNaN(value)) return;

    const next = {
      ...skills,
      [skill]: { ...skills[skill], value },
    };
    updateCharField("skills", next);
    postCharData();
  };

  const toggleSkillFlag = (skill, flag) => {
    const row = skills[skill] || defaultSkills[skill];
    const nextRow = { ...row, [flag]: !row[flag] };

    // Enforce rule
    if (flag === "expertise" && nextRow.expertise) nextRow.proficient = true;
    if (flag === "proficient" && !nextRow.proficient) nextRow.expertise = false;

    const next = { ...skills, [skill]: nextRow };
    updateCharField("skills", next);
    postCharData();
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="mb-4">
        <h2 className="text-orange-400 font-semibold text-xl tracking-wide">
          Saving Throw Proficiency & Expertise
        </h2>
        <p className="text-slate-400 text-sm">
          Checking <span className="text-orange-300">Expertise</span> will auto-check{" "}
          <span className="text-orange-300">Proficiency</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Abilities */}
        <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
          <header className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-orange-300">Abilities</h3>
            <div className="text-xs text-slate-400 flex gap-6 pr-1">
              <span>Score</span>
              <span>Prof.</span>
              <span>Exp.</span>
            </div>
          </header>

          <div className="divide-y divide-slate-700">
            {Object.keys(defaultAbilityScores).map((ability) => (
              <AbilityScoreField
                key={ability}
                ability={ability}
                row={abilityScores[ability]}
                onValueChange={(v) => handleAbilityValueChange(ability, v)}
                onToggleProficient={() => toggleAbilityFlag(ability, "proficient")}
                onToggleExpertise={() => toggleAbilityFlag(ability, "expertise")}
              />
            ))}
          </div>
        </section>

        {/* Skills */}
        <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
          <header className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-orange-300">Skills</h3>
            <div className="text-xs text-slate-400 flex gap-6 pr-1">
              <span>Bonus</span>
              <span>Prof.</span>
              <span>Exp.</span>
            </div>
          </header>

          <div className="h-[560px] overflow-auto pr-1 divide-y divide-slate-700">
            {Object.keys(defaultSkills).map((skill) => (
              <SkillField
                key={skill}
                skill={skill}
                row={skills[skill]}
                onValueChange={(v) => handleSkillValueChange(skill, v)}
                onToggleProficient={() => toggleSkillFlag(skill, "proficient")}
                onToggleExpertise={() => toggleSkillFlag(skill, "expertise")}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default AbilityScore;
