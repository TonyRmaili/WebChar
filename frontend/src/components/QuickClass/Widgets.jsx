import React , { useState }from "react";
import { fmt, scoreToMod } from "../../utils/HelperFunctions";
import { ABILITY_LABELS } from "../../utils/Constants";

export function InputBlock({ label, value, onChange, type }) {
  return (
    <div className="relative">
      <input
        type= {type}
        value={value ?? ""}
        onChange={onChange}
        placeholder=" "
        className="
          peer w-full
          bg-zinc-950 border border-stone-700
          px-3 pt-5 pb-2
          text-red-300
          outline-none
          focus:border-red-700
        "
      />

      <label
        className="
          absolute left-3 top-2
          text-xs text-stone-500
          transition-all
          peer-placeholder-shown:top-3
          peer-placeholder-shown:text-sm
          peer-placeholder-shown:text-stone-600
          peer-focus:top-2
          peer-focus:text-xs
          peer-focus:text-red-400
        "
      >
        {label}
      </label>
    </div>
  );
}

export function AbilityStat({ label, data, onChange }) {
  function handleChange(field, value) {
    onChange(field, value);
  }

  const mod = scoreToMod(data.score);

  return (
    <div className="relative rounded-md bg-gradient-to-b from-stone-600 to-black p-[2px]">
      <div className="rounded-md border border-stone-800 bg-zinc-950 px-3 py-4 shadow-[inset_0_0_12px_rgba(0,0,0,0.7)]">
        <p className="mb-2 text-center text-xs uppercase tracking-[0.25em] text-red-400">
          {label}
        </p>

        <input
          type="number"
          value={data.score ?? ""}
          onChange={(e) => handleChange("score", Number(e.target.value))}
          className="
            mb-2 w-full border-b border-stone-700
            bg-transparent text-center text-3xl font-bold text-stone-100
            outline-none focus:border-red-700
          "
        />

        <div className="mb-3 text-center">
          <p className="text-[10px] uppercase text-stone-500">Mod</p>
          <p className="text-lg font-bold text-red-300">
            {fmt(mod)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-stone-800 bg-black/30 p-2">
            <label className="mb-1 block text-center text-[10px] uppercase tracking-[0.15em] text-stone-500">
              Save
            </label>
            <input
              type="number"
              value={data.save ?? ""}
              onChange={(e) => handleChange("save", Number(e.target.value))}
              className="
                w-full bg-transparent text-center text-sm text-stone-200
                outline-none
              "
            />
          </div>

          <div className="rounded border border-stone-800 bg-black/30 p-2">
            <label className="mb-1 block text-center text-[10px] uppercase tracking-[0.15em] text-stone-500">
              Check
            </label>
            <input
              type="number"
              value={data.check ?? ""}
              onChange={(e) => handleChange("check", Number(e.target.value))}
              className="
                w-full bg-transparent text-center text-sm text-stone-200
                outline-none
              "
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Collapsible({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-stone-800 rounded-md bg-zinc-950">
      
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="
          w-full flex items-center justify-between
          px-4 py-3
          text-left
          border-b border-stone-800
          text-red-400 uppercase tracking-[0.2em] text-sm
          hover:bg-black/30
        "
      >
        <span>{title}</span>

        <span className="text-stone-500">
          {open ? "−" : "+"}
        </span>
      </button>

      {/* Content */}
      {open && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
}

export function SkillCard({ skillName, data, onToggle, onCheckChange }) {
  return (
    <div className="rounded-md border border-stone-800 bg-gradient-to-b from-zinc-950 to-black p-3 shadow-[inset_0_0_10px_rgba(0,0,0,0.6)]">
      <div className="mb-3">
        <p className="text-sm font-medium text-stone-200">
          {skillName}
        </p>
      </div>

      <div className="mb-3 rounded-md border border-stone-700 bg-black/30 px-3 py-2 text-center">
        <p className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
          Check
        </p>
        <input
          type="number"
          value={data.check ?? ""}
          onChange={(e) => onCheckChange(Number(e.target.value))}
          className="
            w-full bg-transparent text-center text-lg font-bold text-red-300
            outline-none
          "
        />
        <p className="mt-1 text-xs text-stone-400">
          {fmt(data.check)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onToggle("proficient", !data.proficient)}
          className={`
            rounded-md border px-2 py-2 text-[10px] uppercase tracking-[0.15em] transition
            ${
              data.proficient
                ? "border-red-700 bg-red-950/50 text-red-300"
                : "border-stone-700 bg-zinc-900 text-stone-400 hover:border-red-900"
            }
          `}
        >
          Prof
        </button>

        <button
          type="button"
          onClick={() => onToggle("expertise", !data.expertise)}
          className={`
            rounded-md border px-2 py-2 text-[10px] uppercase tracking-[0.15em] transition
            ${
              data.expertise
                ? "border-amber-700 bg-amber-950/40 text-amber-300"
                : "border-stone-700 bg-zinc-900 text-stone-400 hover:border-amber-900"
            }
          `}
        >
          Exp
        </button>
      </div>
    </div>
  );
}

export function SkillsBlock({ skills, setResponse, response }) {
  function updateSkill(abilityKey, skillName, field, value) {
    setResponse({
      ...response,
      skills: {
        ...response.skills,
        [abilityKey]: {
          ...response.skills[abilityKey],
          [skillName]: {
            ...response.skills[abilityKey][skillName],
            [field]: value,
          },
        },
      },
    });
  }

  return (
    <Collapsible title="Skills">
      <div className="flex flex-col gap-3">
        {Object.entries(skills).map(([abilityKey, abilitySkills]) => (
          <Collapsible
            key={abilityKey}
            title={
              <div className="flex items-baseline gap-2">
                <span className="text-red-400 font-semibold tracking-[0.2em]">
                  {ABILITY_LABELS[abilityKey] ?? abilityKey.toUpperCase()}
                </span>
                <span className="text-stone-500 text-xs uppercase tracking-[0.15em]">
                  Skills
                </span>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(abilitySkills).map(([skillName, skillData]) => (
                <SkillCard
                  key={`${abilityKey}-${skillName}`}
                  skillName={skillName}
                  data={skillData}
                  onToggle={(field, value) =>
                    updateSkill(abilityKey, skillName, field, value)
                  }
                  onCheckChange={(value) =>
                    updateSkill(abilityKey, skillName, "check", value)
                  }
                />
              ))}
            </div>
          </Collapsible>
        ))}
      </div>
    </Collapsible>
  );
}