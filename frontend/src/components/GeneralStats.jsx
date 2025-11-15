import React, { useEffect, useMemo, useState } from "react";
import useCharStore from "../store/CharStore";
import OffenseCard from "../Cards/OffenseCard"

import { SPEED_TYPES, SENSE_TYPES } from "../utils/Constants";
import { toInt } from "../utils/HelperFunctions";

/* ---------- Hit dice defaults ---------- */
const DIE_OPTIONS = ["d4", "d6", "d8", "d10", "d12", "d20"];

// Category-first for quick listing, plus a lookup map for O(1) resolution.
const HD_BY_CLASS = Object.freeze({
  d6: ["Wizard", "Sorcerer"],
  d8: ["Artificer", "Warlock", "Druid", "Cleric", "Rogue", "Bard", "Monk"],
  d10: ["Fighter", "Ranger", "Paladin"],
  d12: ["Barbarian"],
});

// Canonical class→die map
const CLASS_TO_DIE = Object.freeze(
  Object.entries(HD_BY_CLASS).reduce((acc, [die, arr]) => {
    arr.forEach((name) => (acc[name.toLowerCase()] = die));
    return acc;
  }, {})
);


const calcPbStandard = (lvl) => {
  if (!Number.isFinite(lvl) || lvl <= 0) return 2;
  if (lvl <= 4) return 2;
  if (lvl <= 8) return 3;
  if (lvl <= 12) return 4;
  if (lvl <= 16) return 5;
  return 6;
};


const canon = (s) => (typeof s === "string" ? s.trim().toLowerCase() : "");

const isValidDie = (d) =>
  typeof d === "string" && /^d(4|6|8|10|12|20)$/i.test(d);

/** Auto-fill hit_dice from class unless the row is overridden or user set a custom class */
const autofillDieForClass = (row) => {
  const out = { ...row };
  const key = canon(out.class_name);
  if (!out.hit_dice_overridden) {
    const def = CLASS_TO_DIE[key];
    if (def) out.hit_dice = def; // default class
  }
  return out;
};

/** Summarize totals like { d8: 5, d10: 4 } */
const summarizeHitDice = (rows) => {
  const totals = {};
  for (const r of rows) {
    const lvl = Number(r.level) || 0;
    const die = r.hit_dice ? r.hit_dice.toLowerCase() : "";
    if (!lvl || !isValidDie(die)) continue;
    const max = (totals[die]?.max || 0) + lvl;
    totals[die] = { max, current: max }; // initialize current = max
  }
  return totals; // e.g. { d8: {max:5,current:5}, d10:{max:4,current:4} }
};

export default function GeneralStats() {
  const charData = useCharStore((s) => s.charData);
  const updateCharField = useCharStore((s) => s.updateCharField);
  const postCharData = useCharStore((s) => s.postCharData);

  const [expDelta, setExpDelta] = useState(100);

  if (!charData) return null;

  /* classes */
  const classes = Array.isArray(charData?.classes) ? charData.classes : [];

  // Total level
  const totalLevel = useMemo(
    () =>
      classes.reduce(
        (sum, r) =>
          sum + (Number.isFinite(Number(r.level)) ? Number(r.level) : 0),
        0
      ),
    [classes]
  );

  
  const dexMod = toInt(charData.ability_scores?.dex?.mod ?? 0);

  const initiative = useMemo(() => {
    const base =
      typeof charData.initiative === "object" ? charData.initiative : {};
    const mod = toInt(base.mod ?? 0);
    const total = dexMod + mod;
    return { mod, total };
  }, [charData.initiative, dexMod]);

  const setInitiativeMod = (val) => {
    const mod = toInt(val);
    const total = dexMod + mod;
    updateCharField("initiative", { mod, total });
    postCharData();
  };

  

  useEffect(() => {
    if (charData.total_level !== totalLevel) {
      updateCharField("total_level", totalLevel);
      postCharData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalLevel]);

  /* PB */
  const pbObj = useMemo(() => {
    const base =
      charData?.pb && typeof charData.pb === "object"
        ? charData.pb
        : { standard: 2, modifier: 0, total: 2 };
    const standard = calcPbStandard(totalLevel);
    const modifier = base.modifier ?? 0;
    return { standard, modifier, total: standard + modifier };
  }, [charData?.pb, totalLevel]);

  useEffect(() => {
    updateCharField("pb", pbObj);
    postCharData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pbObj.standard, pbObj.modifier, pbObj.total]);

  const setPbModifier = (val) => {
    const mod = Number.isFinite(val) ? val : 0;
    const standard = calcPbStandard(totalLevel);
    updateCharField("pb", { standard, modifier: mod, total: standard + mod });
    postCharData();
  };

  /* health */
  const health = useMemo(
    () => ({
      current_hp: 0,
      max_hp: 0,
      temp_hp: 0,
      barrier: 0,
      ...(charData.health || {}),
    }),
    [charData?.health]
  );

  const onMaxHpChange = (e) => {
    const v = e.target.value === "" ? 0 : Number(e.target.value);
    if (Number.isFinite(v)) {
      updateCharField("health", { ...health, max_hp: v });
      postCharData();
    }
  };

  /* speed: stored as [{ type, value, hover? }] with implicit ft */
  const speeds = useMemo(
    () =>
      Array.isArray(charData?.speed) && charData.speed.length
        ? charData.speed.map((s) => ({
            type: s.type || "walk",
            value: Number.isFinite(Number(s.value)) ? Number(s.value) : 0,
            ...(s.type === "fly" ? { hover: !!s.hover } : {}),
          }))
        : [{ type: "walk", value: 0 }],
    [charData?.speed]
  );

  const normalizeSpeed = (arr) => {
    const cleaned = arr.map((s) => ({
      type: s.type || "walk",
      value: Number.isFinite(Number(s.value)) ? Number(s.value) : 0,
      ...(s.type === "fly" ? { hover: !!s.hover } : {}),
    }));
    const hasWalk = cleaned.some((s) => s.type === "walk");
    return hasWalk ? cleaned : [{ type: "walk", value: 0 }, ...cleaned];
  };

  const upsertSpeed = (type) => {
    const exists = speeds.some((s) => s.type === type);
    const next = exists
      ? speeds
      : [
          ...speeds,
          { type, value: 0, ...(type === "fly" ? { hover: false } : {}) },
        ];
    updateCharField("speed", normalizeSpeed(next));
    postCharData();
  };

  const removeSpeed = (type) => {
    if (type === "walk") return;
    const next = speeds.filter((s) => s.type !== type);
    updateCharField("speed", normalizeSpeed(next));
    postCharData();
  };

  const editSpeed = (idx, key, val) => {
    const next = speeds.map((s, i) =>
      i === idx ? { ...s, [key]: key === "value" ? Number(val || 0) : val } : s
    );
    updateCharField("speed", normalizeSpeed(next));
    postCharData();
  };

  const toggleHover = (idx) => {
    const next = speeds.map((s, i) =>
      i === idx ? { ...s, hover: !s.hover } : s
    );
    updateCharField("speed", normalizeSpeed(next));
    postCharData();
  };

  /* senses: devilsight only on darkvision */
  const senses = useMemo(() => {
    const raw = Array.isArray(charData?.senses) ? charData.senses : [];
    return raw.map((s) => {
      const type = s.type || "";
      const base = {
        type,
        value: Number.isFinite(Number(s.value)) ? Number(s.value) : 0,
      };
      if (canon(type) === "darkvision") {
        base.devilsight = !!s.devilsight;
      }
      return base;
    });
  }, [charData?.senses]);

  const normalizeSenses = (arr) =>
    arr
      .filter((s) => s.type)
      .map((s) => {
        const type = s.type;
        const base = {
          type,
          value: Number.isFinite(Number(s.value)) ? Number(s.value) : 0,
        };
        if (canon(type) === "darkvision") {
          base.devilsight = !!s.devilsight;
        }
        return base;
      });

  const upsertSense = (type) => {
    const exists = senses.some((s) => s.type === type);
    const next = exists
      ? senses
      : [
          ...senses,
          {
            type,
            value: 0,
            ...(canon(type) === "darkvision" ? { devilsight: false } : {}),
          },
        ];
    updateCharField("senses", normalizeSenses(next));
    postCharData();
  };

  const removeSense = (type) => {
    const next = senses.filter((s) => s.type !== type);
    updateCharField("senses", normalizeSenses(next));
    postCharData();
  };

  const editSense = (idx, val) => {
    const next = senses.map((s, i) =>
      i === idx ? { ...s, value: Number(val || 0) } : s
    );
    updateCharField("senses", normalizeSenses(next));
    postCharData();
  };

  /* classes CRUD */
  const addClassRow = () => {
    const newRow = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      class_name: "",
      subclass: "",
      level: "",
      hit_dice: "",
      hit_dice_overridden: false,
    };
    updateCharField("classes", [...classes, newRow]);
    postCharData();
  };

  const removeClassRow = (id) => {
    updateCharField("classes", classes.filter((r) => r.id !== id));
    postCharData();
  };

  const updateClassRow = (id, key, value) => {
    const next = classes.map((r) => {
      if (r.id !== id) return r;
      if (key === "level") {
        return { ...r, level: value === "" ? "" : Number(value) };
      }
      if (key === "class_name") {
        const updated = { ...r, class_name: value };
        return autofillDieForClass(updated);
      }
      if (key === "hit_dice") {
        const v = value.trim();
        return {
          ...r,
          hit_dice: v,
          hit_dice_overridden: true,
        };
      }
      if (key === "hit_dice_overridden") {
        const out = { ...r, hit_dice_overridden: !!value };
        return value ? out : autofillDieForClass({ ...out, hit_dice: "" });
      }
      return { ...r, [key]: value };
    });
    updateCharField("classes", next);
    postCharData();
  };

  // Compute and persist hit_dice totals whenever classes change
  useEffect(() => {
    const totals = summarizeHitDice(classes);
    const prev = charData?.hit_dice || {};
    const changed = JSON.stringify(prev) !== JSON.stringify(totals);
    if (changed) {
      updateCharField("hit_dice", totals); // e.g. { d8: 5, d10: 4 }
      postCharData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes]);

  // Experience
  const exp = Number.isFinite(Number(charData.exp))
    ? Number(charData.exp)
    : 0;

  const setExp = (val) => {
    const num = val === "" ? 0 : Number(val);
    if (!Number.isFinite(num)) return;
    updateCharField("exp", num);
    postCharData();
  };

  const applyExpDelta = (sign) => {
    const delta = Number(expDelta) || 0;
    const next = sign === "+" ? exp + delta : exp - delta;
    setExp(next);
  };

  // ---------- UI ----------
  const classOptions = Object.values(HD_BY_CLASS).flat().sort();

  return (
    <div className="flex flex-col w-full max-w-3xl gap-6 border border-slate-800 rounded-xl p-4 bg-slate-950/70 shadow-lg shadow-black/40">
      {/* --- Section 1: Core stats (AC / Max HP / Initiative) --- */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200 mb-1">Core Stats</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* AC */}
          <div className="flex flex-col">
            <label
              htmlFor="ac"
              className="mb-1 text-slate-300 text-xs font-semibold tracking-wide"
            >
              Armor Class
            </label>
            <input
              type="number"
              id="ac"
              name="ac"
              value={charData?.ac ?? ""}
              onChange={(e) => {
                const num =
                  e.target.value === "" ? 0 : Number(e.target.value);
                if (Number.isFinite(num)) {
                  updateCharField("ac", num);
                  postCharData();
                }
              }}
              className="w-16 px-2 py-1 border border-slate-700 rounded bg-slate-900 text-amber-200 text-center text-sm"
              min={0}
            />
          </div>

          {/* Max HP */}
          <div className="flex flex-col">
            <label
              htmlFor="max_hp"
              className="mb-1 text-slate-300 text-xs font-semibold tracking-wide"
            >
              Max HP
            </label>
            <input
              type="number"
              id="max_hp"
              value={health.max_hp}
              onChange={onMaxHpChange}
              className="w-20 px-2 py-1 border border-slate-700 rounded bg-slate-900 text-amber-200 text-center text-sm"
              min={0}
            />
          </div>

          {/* Initiative */}
          <div className="flex flex-col">
            <label className="mb-1 text-slate-300 text-xs font-semibold tracking-wide">
              Initiative
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="1"
                value={initiative.mod}
                onChange={(e) => setInitiativeMod(e.target.value)}
                className="w-14 px-2 py-1 rounded border border-slate-700 bg-slate-900 text-amber-200 text-center text-sm"
              />
              <span className="px-1 text-xs text-slate-400">=</span>
              <input
                type="number"
                disabled
                value={initiative.total}
                className="w-16 px-2 py-1 rounded border border-amber-500 bg-amber-300 text-slate-900 text-center text-xs font-semibold"
              />
            </div>
          </div>
        </div>
      </section>

      {/* --- Section 2: Speed & Senses --- */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 space-y-4">
        {/* Speed editor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-slate-300 text-sm font-semibold tracking-wide">
              Speed
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SPEED_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => upsertSpeed(t)}
                  className="px-2 py-0.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-100"
                >
                  Add {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {speeds.map((s, idx) => (
              <div
                key={`${s.type}_${idx}`}
                className="rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1.5 flex flex-col gap-1"
              >
                {/* row 1: label + value + ft + remove */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="min-w-[3.5rem] capitalize text-slate-100 text-xs">
                    {s.type}
                  </span>

                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={Number(s.value ?? 0)}
                      onChange={(e) =>
                        editSpeed(idx, "value", e.target.value)
                      }
                      className="w-16 px-1.5 py-0.5 rounded border border-slate-700 bg-slate-950 text-amber-200 text-center text-xs"
                      aria-label={`${s.type} speed`}
                    />
                    <span className="text-[10px] text-slate-300">ft</span>
                  </div>

                  <div className="ml-auto flex gap-1">
                    {s.type !== "walk" && (
                      <button
                        type="button"
                        onClick={() => removeSpeed(s.type)}
                        className="w-5 h-5 flex items-center justify-center rounded-full border border-red-800 bg-red-950/60 hover:bg-red-900/70 text-red-100 text-[9px]"
                        title={`Remove ${s.type}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* row 2: hover toggle only */}
                {s.type === "fly" && (
                  <label className="flex items-center gap-1 text-[11px] text-amber-100">
                    <input
                      type="checkbox"
                      checked={!!s.hover}
                      onChange={() => toggleHover(idx)}
                    />
                    hover
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Senses editor */}
        <div>
          <div className="flex items-center justify-between mb-2 mt-1">
            <label className="text-slate-300 text-sm font-semibold tracking-wide">
              Senses
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SENSE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => upsertSense(t)}
                  className="px-2 py-0.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-100"
                >
                  Add {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {senses.length === 0 && (
              <p className="text-xs text-slate-500 italic col-span-full">
                No special senses set.
              </p>
            )}

            {senses.map((s, idx) => (
              <div
                key={`${s.type}_${idx}`}
                className="rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1.5 flex flex-col gap-1"
              >
                {/* row 1: label + value + ft + remove */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="min-w-[4rem] capitalize text-slate-100 text-xs">
                    {s.type}
                  </span>

                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={Number(s.value ?? 0)}
                      onChange={(e) => editSense(idx, e.target.value)}
                      className="w-16 px-1.5 py-0.5 rounded border border-slate-700 bg-slate-950 text-amber-200 text-center text-xs"
                      aria-label={`${s.type} range`}
                    />
                    <span className="text-[10px] text-slate-300">ft</span>
                  </div>

                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      onClick={() => removeSense(s.type)}
                      className="w-5 h-5 flex items-center justify-center rounded-full border border-red-800 bg-red-950/60 hover:bg-red-900/70 text-red-100 text-[9px]"
                      title={`Remove ${s.type}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* row 2: devilsight toggle only for darkvision */}
                {canon(s.type) === "darkvision" && (
                  <label className="flex items-center gap-1 text-[11px] text-amber-200">
                    <input
                      type="checkbox"
                      checked={!!s.devilsight}
                      onChange={() => {
                        const next = senses.map((row, i) =>
                          i === idx
                            ? { ...row, devilsight: !row.devilsight }
                            : row
                        );
                        updateCharField("senses", normalizeSenses(next));
                        postCharData();
                      }}
                    />
                    devilsight
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Section 3: Offense (unchanged OffenseCard) --- */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
        <h3 className="text-sm font-semibold text-slate-200 mb-1">Offense</h3>
        <OffenseCard
          charData={charData}
          postCharData={postCharData}
          updateCharField={updateCharField}
        />
      </section>

      {/* --- Section 4: Classes + PB / Hit Dice + Experience --- */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 space-y-3">
        {/* Experience + add class button */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-end gap-2">
            <div className="flex flex-col">
              <label className="mb-1 text-slate-300 text-xs font-semibold">
                Experience
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyExpDelta("-")}
                  className="px-2 py-0.5 rounded border border-slate-700 bg-slate-950 text-xs text-slate-100"
                >
                  −
                </button>
                <input
                  type="number"
                  value={exp}
                  onChange={(e) => setExp(e.target.value)}
                  className="w-24 px-2 py-0.5 rounded border border-slate-700 bg-slate-950 text-amber-200 text-center text-xs"
                />
                <button
                  type="button"
                  onClick={() => applyExpDelta("+")}
                  className="px-2 py-0.5 rounded border border-slate-700 bg-slate-950 text-xs text-slate-100"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex flex-col">
              <label className="mb-1 text-slate-300 text-[10px] font-semibold">
                Step
              </label>
              <input
                type="number"
                value={expDelta}
                onChange={(e) => setExpDelta(e.target.value)}
                className="w-20 px-2 py-0.5 rounded border border-slate-700 bg-slate-950 text-slate-200 text-center text-[11px]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={addClassRow}
            className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition text-sm text-slate-100"
          >
            Add class
          </button>
        </div>

        {/* Column labels */}
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px] font-semibold text-orange-300 px-0.5">
          <div className="flex items-center">Class</div>
          <div className="flex items-center">SubClass</div>
          <div className="flex items-center">Level</div>
          <div className="flex items-center">Hit Dice</div>
        </div>

        {/* Class rows */}
        <datalist id="classOptions">
          {classOptions.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>

        <div className="space-y-2">
          {classes.length === 0 && (
            <div className="text-slate-400 text-sm">
              No classes yet. Click “Add class”.
            </div>
          )}

          {classes.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-2 md:flex-row md:items-center"
            >
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-1.5">
                {/* Class */}
                <input
                  type="text"
                  list="classOptions"
                  placeholder="Class"
                  value={row.class_name ?? ""}
                  onChange={(e) =>
                    updateClassRow(row.id, "class_name", e.target.value)
                  }
                  className="w-full max-w-[9rem] px-2 py-1 rounded border border-slate-700 bg-slate-950 text-slate-100 text-sm"
                />

                {/* Subclass */}
                <input
                  type="text"
                  placeholder="Subclass"
                  value={row.subclass ?? ""}
                  onChange={(e) =>
                    updateClassRow(row.id, "subclass", e.target.value)
                  }
                  className="w-full max-w-[9rem] px-2 py-1 rounded border border-slate-700 bg-slate-950 text-slate-100 text-sm"
                />

                {/* Level */}
                <input
                  type="number"
                  min={1}
                  placeholder="Lvl"
                  value={row.level ?? ""}
                  onChange={(e) =>
                    updateClassRow(row.id, "level", e.target.value)
                  }
                  className="w-16 px-2 py-1 rounded border border-slate-700 bg-slate-950 text-amber-200 text-center text-sm"
                />

                {/* Hit die + custom + remove in same cell */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <select
                    value={row.hit_dice || ""}
                    onChange={(e) =>
                      updateClassRow(row.id, "hit_dice", e.target.value)
                    }
                    className="px-2 py-1 rounded border border-slate-700 bg-slate-950 text-slate-100 text-sm"
                  >
                    <option value="">Select</option>
                    {DIE_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center gap-1 text-[10px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={!!row.hit_dice_overridden}
                      onChange={(e) =>
                        updateClassRow(
                          row.id,
                          "hit_dice_overridden",
                          e.target.checked
                        )
                      }
                    />
                    Custom
                  </label>

                  <button
                    type="button"
                    onClick={() => removeClassRow(row.id)}
                    className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-red-800 bg-red-950/70 hover:bg-red-900/80 text-red-100 text-[9px] leading-none"
                    title="Remove class"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* PB and Hit Dice totals */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border border-slate-800 rounded-lg p-3 bg-slate-950/80 text-sm">
          <div className="flex flex-col items-start">
            <label className="mb-1 text-slate-300 text-xs font-semibold">
              Total Level
            </label>
            <input
              type="number"
              readOnly
              value={charData.total_level ?? totalLevel}
              className="w-20 px-1.5 py-1 rounded border border-slate-700 bg-slate-950 text-slate-200 text-center text-sm"
            />
          </div>

          <div className="flex flex-col items-start">
            <label className="mb-1 text-slate-300 text-xs font-semibold">
              PB (standard)
            </label>
            <input
              type="number"
              readOnly
              value={pbObj.standard}
              className="w-20 px-1.5 py-1 rounded border border-slate-700 bg-slate-950 text-slate-200 text-center text-sm"
            />
          </div>

          <div className="flex flex-col items-start">
            <label
              htmlFor="pb_mod"
              className="mb-1 text-slate-300 text-xs font-semibold"
            >
              PB modifier
            </label>
            <input
              id="pb_mod"
              type="number"
              value={pbObj.modifier}
              onChange={(e) => {
                const val =
                  e.target.value === "" ? 0 : Number(e.target.value);
                if (Number.isFinite(val)) setPbModifier(val);
              }}
              className="w-20 px-1.5 py-1 rounded border border-slate-700 bg-slate-950 text-amber-200 text-center text-sm"
            />
          </div>

          <div className="flex flex-col items-start">
            <label className="mb-1 text-slate-300 text-xs font-semibold">
              PB (total)
            </label>
            <input
              type="number"
              readOnly
              value={pbObj.total}
              className="w-20 px-1.5 py-1 rounded border border-slate-700 bg-slate-950 text-slate-200 text-center text-sm"
            />
          </div>

          {/* Hit dice totals */}
          <div className="flex flex-col sm:col-span-1">
            <label className="mb-1 text-slate-300 text-xs font-semibold">
              Hit Dice Totals
            </label>
            <div className="px-2 py-1 rounded border border-slate-700 bg-slate-950 text-slate-200 text-sm">
              {(() => {
                const hd = charData?.hit_dice || summarizeHitDice(classes);
                const keys = Object.keys(hd);
                if (keys.length === 0)
                  return (
                    <span className="text-slate-400 text-xs">—</span>
                  );
                return (
                  <span>
                    {keys
                      .sort(
                        (a, b) =>
                          DIE_OPTIONS.indexOf(a) - DIE_OPTIONS.indexOf(b)
                      )
                      .map((k, i) => (
                        <span key={k}>
                          {i > 0 ? ", " : null}
                          {hd[k]?.max}
                          {k}
                        </span>
                      ))}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
