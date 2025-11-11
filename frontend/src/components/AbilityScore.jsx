import React, { useMemo, useState, useEffect } from "react";
import useCharStore from "../store/CharStore";

import AbilityScoreCard from "./miniComp/AbilityScoreCard";
import SkillCard from "./miniComp/SkillCard";

/* ---------- Constants ---------- */
const DEFAULT_SKILLS = {
  acrobatics:     { value: null, proficient: false, expertise: false, label: "Acrobatics",      ability: "Dexterity"    },
  animalHandling: { value: null, proficient: false, expertise: false, label: "Animal Handling", ability: "Wisdom"       },
  arcana:         { value: null, proficient: false, expertise: false, label: "Arcana",          ability: "Intelligence" },
  athletics:      { value: null, proficient: false, expertise: false, label: "Athletics",       ability: "Strength"     },
  deception:      { value: null, proficient: false, expertise: false, label: "Deception",       ability: "Charisma"     },
  history:        { value: null, proficient: false, expertise: false, label: "History",         ability: "Intelligence" },
  insight:        { value: null, proficient: false, expertise: false, label: "Insight",         ability: "Wisdom"       },
  intimidation:   { value: null, proficient: false, expertise: false, label: "Intimidation",    ability: "Charisma"     },
  investigation:  { value: null, proficient: false, expertise: false, label: "Investigation",   ability: "Intelligence" },
  medicine:       { value: null, proficient: false, expertise: false, label: "Medicine",        ability: "Wisdom"       },
  nature:         { value: null, proficient: false, expertise: false, label: "Nature",          ability: "Intelligence" },
  perception:     { value: null, proficient: false, expertise: false, label: "Perception",      ability: "Wisdom"       },
  performance:    { value: null, proficient: false, expertise: false, label: "Performance",     ability: "Charisma"     },
  persuasion:     { value: null, proficient: false, expertise: false, label: "Persuasion",      ability: "Charisma"     },
  religion:       { value: null, proficient: false, expertise: false, label: "Religion",        ability: "Intelligence" },
  sleightOfHand:  { value: null, proficient: false, expertise: false, label: "Sleight of Hand", ability: "Dexterity"    },
  stealth:        { value: null, proficient: false, expertise: false, label: "Stealth",         ability: "Dexterity"    },
  survival:       { value: null, proficient: false, expertise: false, label: "Survival",        ability: "Wisdom"       },
};

const ABILITIES_ORDER = [
  { key: "str", label: "Strength" },
  { key: "dex", label: "Dexterity" },
  { key: "con", label: "Constitution" },
  { key: "int", label: "Intelligence" },
  { key: "wis", label: "Wisdom" },
  { key: "cha", label: "Charisma" },
];

const SKILLS_ORDER = [
  { key: "wis", label: "Wisdom" },
  { key: "dex", label: "Dexterity" },
  { key: "int", label: "Intelligence" },
  { key: "cha", label: "Charisma" },
  { key: "str", label: "Strength" },
  { key: "con", label: "Constitution" },
];

const DEFAULT_ABILITY_SCORES = {
  str: { value: null, mod: null, check_mod: 0, save_mod: 0, proficient: false, expertise: false, label: "Strength" },
  dex: { value: null, mod: null, check_mod: 0, save_mod: 0, proficient: false, expertise: false, label: "Dexterity" },
  con: { value: null, mod: null, check_mod: 0, save_mod: 0, proficient: false, expertise: false, label: "Constitution" },
  int: { value: null, mod: null, check_mod: 0, save_mod: 0, proficient: false, expertise: false, label: "Intelligence" },
  wis: { value: null, mod: null, check_mod: 0, save_mod: 0, proficient: false, expertise: false, label: "Wisdom" },
  cha: { value: null, mod: null, check_mod: 0, save_mod: 0, proficient: false, expertise: false, label: "Charisma" },
};


/* ---------- Helpers ---------- */
const scoreToMod = (score) =>
  typeof score === "number" && Number.isFinite(score)
    ? Math.floor((score - 10) / 2)
    : null;

const toKey = (name) => {
  const cleaned = name.replace(/[^a-zA-Z0-9 ]+/g, " ").trim();
  const camel = cleaned
    .split(/\s+/)
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()
    )
    .join("");
  return camel || "customSkill";
};

export default function AbilityScore() {
  // --- Zustand selectors ---
  const charData = useCharStore((s) => s.charData);
  const updateCharField = useCharStore((s) => s.updateCharField);
  const postCharData = useCharStore((s) => s.postCharData);

  if (!charData) return null;

  const pb = Number(charData?.pb?.total ?? 0);

  const abilityScores = useMemo(
    () => ({ ...DEFAULT_ABILITY_SCORES, ...(charData.ability_scores || {}) }),
    [charData?.ability_scores]
  );

  const skills = useMemo(
    () => ({ ...DEFAULT_SKILLS, ...(charData.skills || {}) }),
    [charData?.skills]
  );

  // Backfill/repair missing or stale mods once per mismatch
  useEffect(() => {
    const next = { ...abilityScores };
    let changed = false;

    Object.entries(abilityScores).forEach(([k, row]) => {
      const v = row?.value;
      const expected = scoreToMod(typeof v === "string" ? Number(v) : v);
      const current = Number.isFinite(row?.mod) ? row.mod : row?.mod ?? null;

      if (expected !== current) {
        next[k] = { ...row, mod: expected };
        changed = true;
      }
    });

    if (changed) {
      updateCharField("ability_scores", next);
      postCharData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charData?.ability_scores]); // runs when ability scores change

  // Build groups from current skills and hide empty ones
  const groupedSkills = useMemo(() => {
    const base = {
      Strength: [],
      Dexterity: [],
      Constitution: [],
      Intelligence: [],
      Wisdom: [],
      Charisma: [],
    };
    Object.entries(skills)
      .sort(([, a], [, b]) => (a?.label || "").localeCompare(b?.label || ""))
      .forEach(([key, meta]) => {
        if (meta?.ability && base[meta.ability]) base[meta.ability].push(key);
      });
    return base;
  }, [skills]);

  /* ------- Ability handlers ------- */

  const handleAbilityValueChange = (ability, raw) => {
    const value = raw === "" ? "" : Number(raw);
    if (value !== "" && Number.isNaN(value)) return;

    const mod = value === "" ? null : Math.floor((Number(value) - 10) / 2);
    const nextRow = { ...abilityScores[ability], value, mod };
    const next = { ...abilityScores, [ability]: nextRow };
    updateCharField("ability_scores", next);
    postCharData();
  };

  const handleCheckModChange = (ability, delta) => {
    const nextRow = { ...abilityScores[ability], check_mod: delta };
    const next = { ...abilityScores, [ability]: nextRow };
    updateCharField("ability_scores", next);
    postCharData();
  };

  const handleSaveModChange = (ability, delta) => {
    const nextRow = { ...abilityScores[ability], save_mod: delta };
    const next = { ...abilityScores, [ability]: nextRow };
    updateCharField("ability_scores", next);
    postCharData();
  };

  const toggleAbilityFlag = (ability, flag) => {
    const row = abilityScores[ability] || DEFAULT_ABILITY_SCORES[ability];
    const nextRow = { ...row, [flag]: !row[flag] };
    if (flag === "expertise" && nextRow.expertise) nextRow.proficient = true;
    if (flag === "proficient" && !nextRow.proficient) nextRow.expertise = false;
    const next = { ...abilityScores, [ability]: nextRow };
    updateCharField("ability_scores", next);
    postCharData();
  };

  /* ------- Skill handlers ------- */
  const handleSkillValueChange = (skill, raw) => {
    const value = raw === "" ? "" : Number(raw);
    if (value !== "" && Number.isNaN(value)) return;
    const next = { ...skills, [skill]: { ...skills[skill], value } };
    updateCharField("skills", next);
    postCharData();
  };

  const toggleSkillFlag = (skill, flag) => {
    const row = skills[skill] || DEFAULT_SKILLS[skill];
    const nextRow = { ...row, [flag]: !row[flag] };
    if (flag === "expertise" && nextRow.expertise) nextRow.proficient = true;
    if (flag === "proficient" && !nextRow.proficient) nextRow.expertise = false;
    const next = { ...skills, [skill]: nextRow };
    updateCharField("skills", next);
    postCharData();
  };

  /* ------- Add custom skill ------- */
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAbility, setNewAbility] = useState("Strength");

  const addCustomSkill = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    let key = toKey(trimmed);
    let i = 1;
    while (skills[key]) {
      key = `${toKey(trimmed)}${++i}`;
    }

    const next = {
      ...skills,
      [key]: {
        value: null,
        proficient: false,
        expertise: false,
        label: trimmed,
        ability: newAbility,
      },
    };
    updateCharField("skills", next);
    postCharData();
    setAddOpen(false);
    setNewName("");
    setNewAbility("Strength");
  };

  return (
    <div className="w-full max-w-6xl mx-auto grid gap-10">
      {/* Ability Scores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ABILITIES_ORDER.map(({ key }) => (
          <AbilityScoreCard
            key={key}
            ability={key}
            row={abilityScores[key]}
            onValueChange={(v) => handleAbilityValueChange(key, v)}
            onCheckModChange={(v) => handleCheckModChange(key, v)}
            onSaveModChange={(v) => handleSaveModChange(key, v)}
            onToggle={(flag) => toggleAbilityFlag(key, flag)}
            pb={pb}
          />
        ))}
      </div>

      {/* Skills */}
      <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
        <header className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-orange-300">Skills</h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              className="px-3 py-1 text-sm rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800"
            >
              + Add skill
            </button>
          </div>
        </header>

        {addOpen && (
          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr,200px,auto] grid-cols-1">
            <input
              placeholder="Skill name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100"
            />
            <select
              value={newAbility}
              onChange={(e) => setNewAbility(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100"
            >
              {SKILLS_ORDER.map((a) => (
                <option key={a.label} value={a.label}>
                  {a.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addCustomSkill}
                className="px-3 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddOpen(false);
                  setNewName("");
                  setNewAbility("Strength");
                }}
                className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {SKILLS_ORDER.map(({ key, label }) => {
            const list = groupedSkills[label] || [];
            if (list.length === 0) return null;

            return (
              <div
                key={label}
                className="rounded-xl border border-slate-700/60 bg-slate-900/40"
              >
                <div className="sticky top-0 z-[1] flex items-center justify-between px-3 py-2 rounded-t-xl border-b border-slate-700/60 bg-slate-900/70 backdrop-blur">
                  <div className="text-sm font-semibold text-slate-200">
                    {label}
                  </div>
                </div>

                <div className="divide-y divide-slate-700/60">
                  {list.map((skillKey) => (
                    <SkillCard
                      key={skillKey}
                      skill={skillKey}
                      row={skills[skillKey]}
                      governingMod={abilityScores[key]?.mod ?? 0}
                      pb={pb}
                      onOffsetChange={(v) =>
                        handleSkillValueChange(skillKey, v)
                      }
                      onToggleProficient={() =>
                        toggleSkillFlag(skillKey, "proficient")
                      }
                      onToggleExpertise={() =>
                        toggleSkillFlag(skillKey, "expertise")
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
