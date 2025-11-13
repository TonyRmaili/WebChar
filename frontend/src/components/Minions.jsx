import React, { useEffect, useRef, useState, useCallback } from "react";
import useCharStore from "../store/CharStore";
import useMonsterStore from "../store/MonsterStore";
import { MinionEffects } from "../utils/MinionEffects";

const buttonStyle =
  "px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-amber-500";
const inputTextStyle =
  "border border-slate-600 bg-slate-800 text-slate-100 px-2 py-1 rounded";
const inputNumberStyle =
  "w-20 border border-slate-600 bg-slate-800 text-slate-100 px-2 py-1 rounded";

const box = "rounded-md border border-slate-700 bg-slate-900/70 p-2";
const label = "text-[11px] text-slate-400";
const num = "text-sm text-amber-300 tabular-nums";
const chip = "text-[10px] text-slate-300";
const inputNum = "w-16 px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-100";

const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
const modFrom = (score) => Math.floor((toInt(score) - 10) / 2);
const saveFrom = (score, prof, exp, pb) => modFrom(score) + (exp ? 2 * pb : prof ? pb : 0);
const toInt = (v) => {const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : 0;};

const DEFAULT_MINION_DATA = {
  name: "",
  amount: 0,
  ac: 0,
  max_hp: 0,
  cr: 0,
  pb: 0,
  size: "",
  alignment: "",
  monster_types: [],   // <— renamed from type
  speed: [],
  habitats: [],
  immunities: [],
  resistances: [],
  senses: [],
  languages: [],
  equipment: [],
  ability_scores: {},
  skills: [],

  traits: [],
  actions: [],
  bonus_actions: [],
  reactions: [],
  legendary_actions: [],
  mythic_actions: [],
  regional_effects: [],

  initiative: 0,
};


const SIZE_OPTIONS = [
  "Miniscule",
  "Tiny",
  "Small",
  "Medium",
  "Large",
  "Huge",
  "Gargantuan",
  "Titan"
]

const ALIGNMENT_OPTIONS = [
  "Lawful Good",
  "Lawful Neutral",
  "Lawful Evil",
  "Neutral Good",
  "True Neutral", 
  "Neutral Evil",
  "Chaotic Good",
  "Chaotic Neutral",
  "Chaotic Evil",
  "Unaligned"
]

const DAMAGE_TYPES = [
  "slashing",
  "piercing",
  "bludgeoning",
  "fire",
  "cold",
  "acid",
  "lightning",
  "thunder",
  "poison",
  "necrotic",
  "radiant",
  "psychic",
  "force",
];

const HABITAT_OPTIONS = [
  "Any",
  "None",
  "Artic",
  "Coastal",
  "Desert",
  "Forest",
  "Grassland",
  "Hill",
  "Mountain",
  "Planar",
  "Swamp",
  "Underdark",
  "Underwater",
  "Urban"
]

const TYPE_OPTIONS = [
  "Aberration",
  "Beast",
  "Celestial",
  "Construct",
  "Dragon",
  "Elemental",
  "Fey",
  "Fiend",
  "Giant",
  "Humanoid",
  "Monstrosity",
  "Ooze",
  "Plant",
  "Undead"
]

const CONDITION_OPTIONS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Disease",
  "Exhaustion",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious"
]

const SPEED_OPTIONS = [
  "walk",
  "fly",
  "swim",
  "climb",
  "burrow"
];

const SENSE_OPTIONS = [
  "blindsight",
  "tremorsense",
  "truesight",
  "darkvision"
];

const LANGUAGE_OPTIONS = [
  "Common",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
  "Abyssal",
  "Celestial",
  "Draconic",
  "Deep Speech",
  "Infernal",
  "Primordial",
  "Sylvan",
  "Undercommon",
  "Thieves' Cant",
  "Druidic",
  "Aarakocra",
  "Gith",
  "Gnoll",
  "Kuo-Toan",
  "Sahuagin",
  "Minotaur",
  "Modron",
  "Slaad",
  "Yuan-Ti",
  "Telepathy ",
  "Speechless",
  "None"
];

const SKILL_OPTIONS = {
  acrobatics:     { value: null,  label: "Acrobatics",      ability: "dex" },
  animalHandling: { value: null,  label: "Animal Handling", ability: "wis" },
  arcana:         { value: null,  label: "Arcana",          ability: "int" },
  athletics:      { value: null,  label: "Athletics",       ability: "str" },
  deception:      { value: null,  label: "Deception",       ability: "cha" },
  history:        { value: null,  label: "History",         ability: "int" },
  insight:        { value: null,  label: "Insight",         ability: "wis" },
  intimidation:   { value: null,  label: "Intimidation",    ability: "cha" },
  investigation:  { value: null,  label: "Investigation",   ability: "int" },
  medicine:       { value: null,  label: "Medicine",        ability: "wis" },
  nature:         { value: null,  label: "Nature",          ability: "int" },
  perception:     { value: null,  label: "Perception",      ability: "wis" },
  performance:    { value: null,  label: "Performance",     ability: "cha" },
  persuasion:     { value: null,  label: "Persuasion",      ability: "cha" },
  religion:       { value: null,  label: "Religion",        ability: "int" },
  sleightOfHand:  { value: null,  label: "Sleight of Hand", ability: "dex" },
  stealth:        { value: null,  label: "Stealth",         ability: "dex" },
  survival:       { value: null,  label: "Survival",        ability: "wis" },
};


function MinionRow({index,minion,isOpen,onToggle,onFieldChange,onDelete,}){
  const safe = { ...DEFAULT_MINION_DATA, ...minion };
  const ch = (field) => (e) => {
    const v = e.target.type === "number" ? Number(e.target.value || 0) : e.target.value;
    onFieldChange(index, field, v);
  };
  
  const [pending, setPending] = useState({ habitats: "", monster_types: "" });

  const addArrayItem = (field) => {
    const v = (pending[field] || "").trim();
    if (!v) return;
    const prev = Array.isArray(safe[field]) ? safe[field] : [];
    const exists = prev.some((x) => String(x).toLowerCase() === v.toLowerCase());
    if (exists) return;
    onFieldChange(index, field, [...prev, v]);
    setPending((p) => ({ ...p, [field]: "" }));
  };

  const removeArrayItem = (field, item) => {
    const prev = Array.isArray(safe[field]) ? safe[field] : [];
    onFieldChange(index, field, prev.filter((x) => x !== item));
  };

  function ArrayPicker({ label, field, options }) {
    const value = pending[field] || "";
    const list = Array.isArray(safe[field]) ? safe[field] : [];

    return (
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-[11px] text-slate-400">{label}</label>

        <div className="flex items-center gap-2">
          <select
            className={`${inputTextStyle} cursor-pointer`}
            value={value}
            onChange={(e) =>
              setPending((p) => ({ ...p, [field]: e.target.value }))
            }
          >
            <option value="">Select {label.toLowerCase()}</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => addArrayItem(field)}
            className={buttonStyle}
            disabled={!value}
          >
            Add
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {list.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-slate-100 text-xs"
            >
              {item}
              <button
                type="button"
                onClick={() => removeArrayItem(field, item)}
                className="ml-1 rounded px-1 border border-slate-600 hover:bg-slate-700"
                aria-label={`Remove ${item}`}
                title="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
    );
}

  const [pendingPair, setPendingPair] = useState({
    speed: { type: "", value: "" },
    senses: { type: "", value: "" },
  });

  
  function PairPicker({ label, field, options }) {
    // keep pending.value as string for smooth typing
    const pending = pendingPair[field] || { type: "", value: "" };
    const list = Array.isArray(safe[field]) ? safe[field] : [];

    const setPendingType = (v) =>
      setPendingPair((p) => ({ ...p, [field]: { ...p[field], type: v } }));
    const setPendingValue = (v) =>
      setPendingPair((p) => ({ ...p, [field]: { ...p[field], value: v } }));

    const add = () => {
      const t = pending.type;
      const vStr = String(pending.value).trim();
      if (!t || vStr === "") return;
      const v = Number(vStr);
      if (!Number.isFinite(v) || v < 0) return;

      const prev = Array.isArray(safe[field]) ? safe[field] : [];
      if (prev.some((x) => x.type === t)) return; // unique by type

      onFieldChange(index, field, [...prev, { type: t, value: v }]);
      setPendingPair((p) => ({ ...p, [field]: { type: "", value: "" } }));
    };

    const remove = (idx) => {
      const prev = Array.isArray(safe[field]) ? safe[field] : [];
      onFieldChange(index, field, prev.filter((_, i) => i !== idx));
    };

    return (
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-[11px] text-slate-400">{label}</label>

        {/* Add row */}
        <div className="flex items-center gap-2">
          <select
            className={`${inputTextStyle} cursor-pointer`}
            value={pending.type}
            onChange={(e) => setPendingType(e.target.value)}
          >
            <option value="">{`Select ${label.toLowerCase()}`}</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="ft"
              className={inputNumberStyle}
              value={pending.value ?? ""}           // always a string
              onChange={(e) => setPendingValue(e.target.value)}
            />
            
          <button
            type="button"
            className={buttonStyle}
            onClick={add}
            disabled={!pending.type || String(pending.value).trim() === ""}
          >
            Add
          </button>
        </div>

        {/* Existing entries as chips, 3 per row */}
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {list.map((it, idx) => (
            <span
              key={`${it.type}-${idx}`}
              className="inline-flex items-center justify-between gap-1 px-1 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-slate-100 text-xs"
            >
              {/* one label */}
              <span>{it.type} {it.value} ft</span>
              {/* inline remove */}
              <button
                type="button"
                onClick={() => remove(idx)}
                className="h-5 w-5 leading-none text-slate-300 border border-slate-600 rounded hover:bg-slate-700"
                aria-label={`Remove ${it.type}`}
                title="Remove"
              >
                ×
              </button>
            </span>
          ))}
          {list.length === 0 && (
            <p className="text-[11px] text-slate-400 col-span-full">
              No {label.toLowerCase()} added.
            </p>
          )}
        </div>
      </div>
    );
  }

  function LanguagePicker({ value = [], onChange, options, inputTextStyle, buttonStyle }) {
  const [sel, setSel] = useState("");
  const [custom, setCustom] = useState("");

  const add = (raw) => {
    const v = String(raw || "").trim();
    if (!v) return;
    const exists = (value || []).some((x) => x.toLowerCase() === v.toLowerCase());
    if (exists) return;
    onChange([...(value || []), v]);
    setCustom("");
    setSel("");
  };

  const remove = (lang) => {
    onChange((value || []).filter((x) => x !== lang));
  };

  return (
    <div className="flex flex-col gap-1 sm:col-span-2">
      <label className="text-[11px] text-slate-400">Languages</label>

      {/* Select + custom + Add */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={`${inputTextStyle} cursor-pointer`}
          value={sel}
          onChange={(e) => setSel(e.target.value)}
        >
          <option value="">Select language</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        <input
          type="text"
          className={`${inputTextStyle} w-56`}
          placeholder="Custom (e.g., Thieves’ Cant)"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(custom || sel);
            }
          }}
        />

        <button
          type="button"
          className={buttonStyle}
          onClick={() => add(custom || sel)}
          disabled={!custom.trim() && !sel}
        >
          Add
        </button>
      </div>

      {/* Chips, 3 per row */}
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
        {(value || []).map((lang) => (
          <span
            key={lang}
            className="inline-flex items-center justify-between gap-1 px-1 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-slate-100 text-xs whitespace-nowrap"
            title={lang}
          >
            <span className="whitespace-nowrap">{lang}</span>
            <button
              type="button"
              onClick={() => remove(lang)}
              className="ml-1 h-4 w-4 leading-none border border-slate-600 rounded hover:bg-slate-700 text-[11px] flex items-center justify-center"
              aria-label={`Remove ${lang}`}
              title="Remove"
            >
              ×
            </button>
          </span>
        ))}
        {(value || []).length === 0 && (
          <p className="text-[11px] text-slate-400 col-span-full">
            No languages added.
          </p>
        )}
      </div>
    </div>
  );
}

  function TextListPicker({
    label = "Items",
    value = [],
    onChange,
    placeholder = "Add item",
    allowDuplicates = false,
    normalize = (s) => s.trim(),
    inputTextStyle,
    buttonStyle,
  }) {
    const [text, setText] = useState("");

    const add = () => {
      const raw = normalize(text || "");
      if (!raw) return;

      if (!allowDuplicates) {
        const exists = (value || []).some(
          (x) => normalize(String(x)).toLowerCase() === raw.toLowerCase()
        );
        if (exists) return;
      }

      onChange([...(value || []), raw]);
      setText("");
    };

    const remove = (item) => {
      onChange((value || []).filter((x) => x !== item));
    };

    return (
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-[11px] text-slate-400">{label}</label>

        <div className="flex items-center gap-2">
          <input
            type="text"
            className={`${inputTextStyle} w-64`}
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <button
            type="button"
            className={buttonStyle}
            onClick={add}
            disabled={!text.trim()}
          >
            Add
          </button>
        </div>

        {/* Chips, 3 per row */}
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(value || []).map((item) => (
            <span
              key={item}
              className="inline-flex items-center justify-between gap-1 px-1 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-slate-100 text-xs"
              title={item}
            >
              <span className="whitespace-nowrap">{item}</span>
              <button
                type="button"
                onClick={() => remove(item)}
                className="ml-1 h-4 w-4 leading-none border border-slate-600 rounded hover:bg-slate-700 text-[11px] flex items-center justify-center"
                aria-label={`Remove ${item}`}
                title="Remove"
              >
                ×
              </button>
            </span>
          ))}
          {(value || []).length === 0 && (
            <p className="text-[11px] text-slate-400 col-span-full">
              No {label.toLowerCase()} added.
            </p>
          )}
        </div>
      </div>
    );
  }

  const ABILITIES = [
    { k: "str", L: "STR" },
    { k: "int", L: "INT" },
    { k: "dex", L: "DEX" },
    { k: "wis", L: "WIS" },
    { k: "con", L: "CON" },
    { k: "cha", L: "CHA" },
  ];

  function AbilityScores({ minion, index, onFieldChange }) {
    const as = normalize(minion.ability_scores);
    const pb = Number(minion.pb ?? 0) || 0;

    const patchAbility = (k, patch) => {
      const next = {
        ...as,
        [k]: { ...as[k], ...patch },
      };
      onFieldChange(index, "ability_scores", next);
    };

    // layout: 3 columns, 2 abilities per column (to match your screenshot)
    const cols = [
      ["str", "int"],
      ["dex", "wis"],
      ["con", "cha"],
    ];

    return (
      <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {cols.map((pair) => (
            <div key={pair.join("-")} className="space-y-3">
              {pair.map((k) => {
                const L = ABILITIES.find((a) => a.k === k).L;
                const row = as[k];
                const mod = modFrom(row.score);
                const save = saveFrom(row.score, row.proficient, row.expertise, pb);

                return (
                  <div key={k} className={box}>
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-slate-100">{L}</div>

                      <div className="flex flex-col gap-1">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-orange-500"
                            checked={!!row.proficient}
                            onChange={(e) =>
                              patchAbility(k, {
                                proficient: e.target.checked,
                                // optional rule: if expertise was on and prof off, keep expertise true
                                // or auto-enable prof when expertise is checked (handled below)
                              })
                            }
                          />
                          <span className={chip}>prof</span>
                        </label>

                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-orange-500"
                            checked={!!row.expertise}
                            onChange={(e) => {
                              const ex = e.target.checked;
                              patchAbility(k, {
                                expertise: ex,
                                // expertise implies proficiency
                                proficient: ex ? true : row.proficient,
                              });
                            }}
                          />
                          <span className={chip}>exp</span>
                        </label>
                      </div>

                      <div className="flex flex-col">
                        <label className={label}>Score</label>
                        <input
                          type="number"
                          min={0}
                          className={inputNum}
                          value={row.score ?? 0}
                          onChange={(e) =>
                            patchAbility(k, { score: toInt(e.target.value) })
                          }
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div>
                          <div className={label}>MOD</div>
                          <div className={num}>{fmt(mod)}</div>
                        </div>
                        <div>
                          <div className={label}>SAVE</div>
                          <div className={num}>{fmt(save)}</div>
                        </div>
                      </div>                                    
                    </div>             
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    );
  }

  function SkillPicker({
    label = "Skills",
    selected = [],                // array of skill keys, e.g. ["perception","stealth"]
    onChange,                     // (next: string[]) => void
    options,                      // SKILL_OPTIONS
    abilities,                    // minion.ability_scores
    pb = 0,                       // minion.pb
    inputTextStyle,
    buttonStyle,
  }) {
    const [sel, setSel] = React.useState("");

    const add = () => {
      const key = sel;
      if (!key) return;
      if (selected.includes(key)) return;
      onChange([...selected, key]);
      setSel("");
    };

    const remove = (key) => onChange(selected.filter((k) => k !== key));

    const scoreFor = (abilityKey) =>
      abilities?.[abilityKey]?.score ?? 10;

    return (
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-[11px] text-slate-400">{label}</label>

        <div className="flex items-center gap-2">
          <select
            className={`${inputTextStyle} cursor-pointer`}
            value={sel}
            onChange={(e) => setSel(e.target.value)}
          >
            <option value="">Select skill</option>
            {Object.entries(options).map(([key, def]) => (
              <option key={key} value={key}>
                {def.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={buttonStyle}
            onClick={add}
            disabled={!sel}
          >
            Add
          </button>
        </div>

        {/* Chips 3 per row: "Perception +5" */}
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {selected.map((key) => {
            const def = options[key];
            if (!def) return null;
            const mod = modFrom(scoreFor(def.ability));
            const total = mod + (toInt(pb) || 0); // proficient => +pb
            return (
              <span
                key={key}
                className="inline-flex items-center justify-between gap-1 px-1 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-slate-100 text-xs"
                title={`${def.label} ${fmt(total)}`}
              >
                <span className="whitespace-nowrap">
                  {def.label} {fmt(total)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(key)}
                  className="ml-1 h-4 w-4 leading-none border border-slate-600 rounded hover:bg-slate-700 text-[11px] flex items-center justify-center"
                  aria-label={`Remove ${def.label}`}
                  title="Remove"
                >
                  ×
                </button>
              </span>
            );
          })}
          {selected.length === 0 && (
            <p className="text-[11px] text-slate-400 col-span-full">
              No skills selected.
            </p>
          )}
        </div>
      </div>
    );
  }

  function normalize(raw) {
    const base = {
      str: { score: 10, proficient: false, expertise: false },
      dex: { score: 10, proficient: false, expertise: false },
      con: { score: 10, proficient: false, expertise: false },
      int: { score: 10, proficient: false, expertise: false },
      wis: { score: 10, proficient: false, expertise: false },
      cha: { score: 10, proficient: false, expertise: false },
    };
    if (!raw || typeof raw !== "object") return base;
    const out = { ...base };
    for (const k of Object.keys(base)) {
      const r = raw[k] || {};
      out[k] = {
        score: Number.isFinite(r.score) ? Math.trunc(r.score) : base[k].score,
        proficient: !!r.proficient,
        expertise: !!r.expertise,
      };
    }
    return out;
  }

  return (
    <div className="mb-3 rounded-lg border border-slate-700 bg-slate-900">
      {/* header */}
      <div className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-slate-100">
        <button type="button" onClick={onToggle} className="flex items-center gap-2">
          <span className="text-amber-400">{isOpen ? "▾" : "▸"}</span>
          <span className="font-semibold">{safe.name || `Minion ${index + 1}`}</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-300">HP: {safe.max_hp ?? 0}</span>
          <span className="text-[11px] text-slate-300">AC: {safe.ac ?? 0}</span>
          {safe.amount > 0 && <span className="text-[11px] text-slate-300">x{safe.amount}</span>}
          {!isOpen && (
            <button
              type="button"
              onClick={onDelete}
              className="px-2 py-0.5 rounded border border-red-800 text-red-300 hover:bg-red-900/30"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {isOpen && (
      <div>
        <AbilityScores minion={safe} index={index} onFieldChange={onFieldChange} />
        <div className="px-3 py-2 grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs text-slate-100">
          {/* Name removed (immutable) */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400">Amount</label>
            <input type="number" className={inputNumberStyle} value={safe.amount} onChange={ch("amount")} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400">Max HP</label>
            <input type="number" className={inputNumberStyle} value={safe.max_hp} onChange={ch("max_hp")} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400">AC</label>
            <input type="number" className={inputNumberStyle} value={safe.ac} onChange={ch("ac")} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400">PB</label>
            <input type="number" className={inputNumberStyle} value={safe.pb} onChange={ch("pb")} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400">CR</label>
            <input type="text" className={inputNumberStyle} value={safe.cr} onChange={ch("cr")} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400">Size</label>
            <select
              className={`${inputTextStyle} cursor-pointer`}
              value={safe.size}
              onChange={ch("size")}
            >
              <option value="">Select size</option>
              {SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400">Alignment</label>
            <select
              className={`${inputTextStyle} cursor-pointer`}
              value={safe.alignment}
              onChange={ch("alignment")}
            >
              <option value="">Select Alignment</option>
              {ALIGNMENT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <ArrayPicker label="Habitats" field="habitats" options={HABITAT_OPTIONS} />
          <ArrayPicker label="Types" field="monster_types" options={TYPE_OPTIONS} />
          <ArrayPicker label="Resistances" field="resistances" options={DAMAGE_TYPES} />
          <ArrayPicker label="Immunities" field="immunities" options={[...DAMAGE_TYPES, ...CONDITION_OPTIONS]} />

          <PairPicker label="Speed"   field="speed"   options={SPEED_OPTIONS} />
          <PairPicker label="Senses"  field="senses"  options={SENSE_OPTIONS} />

          <LanguagePicker
            value={safe.languages || []}
            onChange={(next) => onFieldChange(index, "languages", next)}
            options={LANGUAGE_OPTIONS}            
            inputTextStyle={inputTextStyle}
            buttonStyle={buttonStyle}
          />

          <TextListPicker
            label="Equipment"
            value={safe.equipment || []}
            onChange={(next) => onFieldChange(index, "equipment", next)}
            inputTextStyle={inputTextStyle}
            buttonStyle={buttonStyle}
          />

          <SkillPicker
            label="Proficient Skills"
            selected={Array.isArray(safe.skills) ? safe.skills : []}
            onChange={(next) => onFieldChange(index, "skills", next)}
            options={SKILL_OPTIONS}
            abilities={safe.ability_scores}
            pb={safe.pb ?? 0}
            inputTextStyle={inputTextStyle}
            buttonStyle={buttonStyle}
          />

      </div>
       <MinionEffects
          buttonStyle={buttonStyle}
          minion={safe}                 
          index={index}                 
          onFieldChange={onFieldChange} 
        />

      </div>
    )}
    </div>
  );
}


export default function Minions() {
  const charData = useCharStore((s) => s.charData);

  const fetchMinions = useMonsterStore((s) => s.fetchMinions);
  const createMinion = useMonsterStore((s) => s.createMinion);
  const updateMinion = useMonsterStore((s) => s.updateMinion);
  const deleteMinion = useMonsterStore((s) => s.deleteMinion);

  const minionsData = useMonsterStore((s) => s.minionsData);
  const loading = useMonsterStore((s) => s.loading);
  const error = useMonsterStore((s) => s.error);

  // local drafts for smooth typing (optimistic UI)
  const [drafts, setDrafts] = useState([]);
  useEffect(() => setDrafts(minionsData || []), [minionsData]);

  // collapse state
  const [openIndices, setOpenIndices] = useState({});
  const toggleOpen = useCallback(
    (idx) => setOpenIndices((p) => ({ ...p, [idx]: !p[idx] })),
    []
  );

  // create form
  const [newName, setNewName] = useState("");

  // load on character change
  useEffect(() => {
    if (charData?.name) fetchMinions(charData.name);
  }, [charData?.name, fetchMinions]);

  // shared debounce per (index:field)
  const timersRef = useRef({});
  const debouncedSave = useCallback(
    (index, fullMinion) => {
      const key = String(index);
      clearTimeout(timersRef.current[key]);
      timersRef.current[key] = setTimeout(async () => {
        if (!charData?.name) return;
        await updateMinion(fullMinion, charData.name);
        await fetchMinions(charData.name); // sync back from server
        delete timersRef.current[key];
      }, 400);
    },
    [updateMinion, fetchMinions, charData?.name]
  );



  // field change: update draft immediately, then debounce API call
  const handleFieldChange = (index, field, value) => {
    setDrafts((prev) => {
      const next = [...prev];
      const base = { ...DEFAULT_MINION_DATA, ...(next[index] || {}) };
      const updated = { ...base, [field]: value };
      next[index] = updated;
      // debounce save with full object
      debouncedSave(index, updated);
      return next;
    });
  };

  const onCreateMinion = async () => {
    const name = newName.trim();
    if (!name || !charData?.name) return;
    const payload = { ...DEFAULT_MINION_DATA, name };
    const created = await createMinion(payload, charData.name);
    if (created) {
      setNewName("");
      await fetchMinions(charData.name);
    }
  };

  const onDeleteMinion = async (index) => {
    const m = drafts[index];
    if (!m || !charData?.name) return;
    // const ok = window.confirm(`Delete ${m.name || "this minion"}?`);
    // if (!ok) return;
    const res = await deleteMinion(m, charData.name);
    if (res !== null) {
      await fetchMinions(charData.name);
    }
  };

  return (
    <div className="p-4">
      {/* Create row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          className={`${inputTextStyle} flex-1`}
          placeholder="Minion name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button onClick={onCreateMinion} className={buttonStyle} disabled={!newName.trim()}>
          Create Minion
        </button>
      </div>

      <div className="mt-4">
        {loading && <p className="text-slate-300 text-xs">Loading minions…</p>}
        {error && <p className="text-red-400 text-xs">Error: {error}</p>}
        {!loading && !error && (!drafts || drafts.length === 0) && (
          <p className="text-slate-500 text-xs">No minions yet.</p>
        )}

        {drafts?.map((m, i) => (
          <MinionRow
            key={m.id || m._file || i}
            index={i}
            minion={m}
            isOpen={!!openIndices[i]}
            onToggle={() => toggleOpen(i)}
            onFieldChange={handleFieldChange}
            onDelete={() => onDeleteMinion(i)}
          />
        ))}
      </div>
    </div>
  );
}
