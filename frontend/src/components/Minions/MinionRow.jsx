import React, { useState } from "react";
import { MinionEffects } from "./MinionEffects";
import { toInt2, modFrom, fmt } from "../../utils/HelperFunctions";
import {
  DEFAULT_MINION_DATA,
  SIZE_OPTIONS,
  ALIGNMENT_OPTIONS,
  HABITAT_OPTIONS,
  TYPE_OPTIONS,
  CONDITION_OPTIONS,
  SPEED_OPTIONS,
  SENSE_OPTIONS,
  LANGUAGE_OPTIONS,
  SKILL_OPTIONS,
  DAMAGE_TYPES,
} from "../../utils/Constants";

import {
  buttonStyle,
  inputTextStyle,
  inputNumberStyle,
  box,
  label,
  num,
  chip,
  inputNum,
} from "./MinionStyle";



export function MinionRow({
  index,
  minion,
  isOpen,
  onToggle,
  onFieldChange,
  onDelete,
}) {
  const safe = { ...DEFAULT_MINION_DATA, ...minion };
  const ch = (field) => (e) => {
    const v =
      e.target.type === "number" ? Number(e.target.value || 0) : e.target.value;
    onFieldChange(index, field, v);
  };

  const [pending, setPending] = useState({ habitats: "", monster_types: "" });

  const addArrayItem = (field) => {
    const v = (pending[field] || "").trim();
    if (!v) return;
    const prev = Array.isArray(safe[field]) ? safe[field] : [];
    const exists = prev.some(
      (x) => String(x).toLowerCase() === v.toLowerCase()
    );
    if (exists) return;
    onFieldChange(index, field, [...prev, v]);
    setPending((p) => ({ ...p, [field]: "" }));
  };

  const removeArrayItem = (field, item) => {
    const prev = Array.isArray(safe[field]) ? safe[field] : [];
    onFieldChange(
      index,
      field,
      prev.filter((x) => x !== item)
    );
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
      onFieldChange(
        index,
        field,
        prev.filter((_, i) => i !== idx)
      );
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
            value={pending.value ?? ""} // always a string
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
              <span>
                {it.type} {it.value} ft
              </span>
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

  function LanguagePicker({
    value = [],
    onChange,
    options,
    inputTextStyle,
    buttonStyle,
  }) {
    const [sel, setSel] = useState("");
    const [custom, setCustom] = useState("");

    const add = (raw) => {
      const v = String(raw || "").trim();
      if (!v) return;
      const exists = (value || []).some(
        (x) => x.toLowerCase() === v.toLowerCase()
      );
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
              <option key={opt} value={opt}>
                {opt}
              </option>
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
    const pb = Number(minion.pb ?? 0) || 0;
    const as = normalize(minion.ability_scores, pb);

    const patchAbility = (k, patch) => {
      const current = as[k] || {};
      const merged = { ...current, ...patch };

      const score = toInt2(merged.score);
      const proficient = !!merged.proficient;
      const expertise = !!merged.expertise;

      const mod = modFrom(score);
      // save = mod, or mod + pb, or mod + 2*pb depending on prof / expertise
      let save = mod;
      if (proficient || expertise) {
        const mult = expertise ? 2 : 1;
        save = mod + pb * mult;
      }

      const next = {
        ...as,
        [k]: {
          ...merged,
          score,
          proficient,
          expertise,
          mod,
          save,
        },
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
                const save = (() => {
                  const m = mod;
                  if (row.expertise) return m + 2 * pb;
                  if (row.proficient) return m + pb;
                  return m;
                })();

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
                            patchAbility(k, { score: toInt2(e.target.value) })
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
    selected = [],
    onChange,
    options,
    abilities,
    pb = 0,
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

    const scoreFor = (abilityKey) => abilities?.[abilityKey]?.score ?? 10;

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
            const total = mod + (toInt2(pb) || 0); // proficient => +pb
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

  function normalize(raw, pb = 0) {
    const base = {
      str: { score: 10, proficient: false, expertise: false },
      dex: { score: 10, proficient: false, expertise: false },
      con: { score: 10, proficient: false, expertise: false },
      int: { score: 10, proficient: false, expertise: false },
      wis: { score: 10, proficient: false, expertise: false },
      cha: { score: 10, proficient: false, expertise: false },
    };

    const out = {};

    for (const k of Object.keys(base)) {
      const r = raw && typeof raw === "object" ? raw[k] || {} : {};
      const score = Number.isFinite(r.score)
        ? Math.trunc(r.score)
        : base[k].score;

      const proficient =
        typeof r.proficient === "boolean" ? r.proficient : base[k].proficient;

      const expertise =
        typeof r.expertise === "boolean" ? r.expertise : base[k].expertise;

      const fallbackMod = modFrom(score);
      const mod = Number.isFinite(r.mod) ? Math.trunc(r.mod) : fallbackMod;

      let save;
      if (Number.isFinite(r.save)) {
        save = Math.trunc(r.save);
      } else {
        // same rule: save = mod, mod+pb, or mod+2*pb
        if (expertise) {
          save = mod + 2 * pb;
        } else if (proficient) {
          save = mod + pb;
        } else {
          save = mod;
        }
      }

      out[k] = { score, proficient, expertise, mod, save };
    }

    return out;
  }

  return (
    <div className="mb-3 rounded-lg border border-slate-700 bg-slate-900">
      {/* header */}
      <div className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-slate-100">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2"
        >
          <span className="text-amber-400">{isOpen ? "▾" : "▸"}</span>
          <span className="font-semibold">
            {safe.name || `Minion ${index + 1}`}
          </span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-300">
            HP: {safe.max_hp ?? 0}
          </span>
          <span className="text-[11px] text-slate-300">AC: {safe.ac ?? 0}</span>
          {safe.amount > 0 && (
            <span className="text-[11px] text-slate-300">x{safe.amount}</span>
          )}
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
          <AbilityScores
            minion={safe}
            index={index}
            onFieldChange={onFieldChange}
          />
          <div className="px-3 py-2 grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs text-slate-100">
            {/* Name removed (immutable) */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">Amount</label>
              <input
                type="number"
                className={inputNumberStyle}
                value={safe.amount}
                onChange={ch("amount")}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">Max HP</label>
              <input
                type="number"
                className={inputNumberStyle}
                value={safe.max_hp}
                onChange={ch("max_hp")}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">AC</label>
              <input
                type="number"
                className={inputNumberStyle}
                value={safe.ac}
                onChange={ch("ac")}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">PB</label>
              <input
                type="number"
                className={inputNumberStyle}
                value={safe.pb}
                onChange={ch("pb")}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">Initiative</label>
              <input
                type="number"
                className={inputNumberStyle}
                value={safe.initiative}
                onChange={ch("initiative")}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">CR</label>
              <input
                type="text"
                className={inputNumberStyle}
                value={safe.cr}
                onChange={ch("cr")}
              />
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

            <ArrayPicker
              label="Habitats"
              field="habitats"
              options={HABITAT_OPTIONS}
            />
            <ArrayPicker
              label="Types"
              field="monster_types"
              options={TYPE_OPTIONS}
            />
            <ArrayPicker
              label="Resistances"
              field="resistances"
              options={DAMAGE_TYPES}
            />
            <ArrayPicker
              label="Vulnerabilities"
              field="vulnerabilities"
              options={DAMAGE_TYPES}
            />
            <ArrayPicker
              label="Immunities"
              field="immunities"
              options={[...DAMAGE_TYPES, ...CONDITION_OPTIONS]}
            />

            <PairPicker label="Speed" field="speed" options={SPEED_OPTIONS} />
            <PairPicker label="Senses" field="senses" options={SENSE_OPTIONS} />

            <LanguagePicker
              value={safe.languages || []}
              onChange={(next) => onFieldChange(index, "languages", next)}
              options={LANGUAGE_OPTIONS}
              inputTextStyle={inputTextStyle}
              buttonStyle={buttonStyle}
            />

            <TextListPicker
              label="Gear"
              value={safe.gear || []}
              onChange={(next) => onFieldChange(index, "gear", next)}
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
