import React, { useEffect, useMemo } from "react";
import useCharStore from "../store/CharStore";
import OffenseCard from "./miniComp/OffenseCard";

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

const SPEED_TYPES = ["walk", "fly", "swim", "climb", "burrow"];

const calcPbStandard = (lvl) => {
  if (!Number.isFinite(lvl) || lvl <= 0) return 2;
  if (lvl <= 4) return 2;
  if (lvl <= 8) return 3;
  if (lvl <= 12) return 4;
  if (lvl <= 16) return 5;
  return 6;
};

// Helpers
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
  // --- ZUSTAND SELECTORS ---
  const charData = useCharStore((s) => s.charData);
  const updateCharField = useCharStore((s) => s.updateCharField);
  const postCharData = useCharStore((s) => s.postCharData);

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

  /* speed */
  const speeds = useMemo(
    () =>
      Array.isArray(charData?.speed)
        ? charData.speed
        : [{ type: "walk", value: 0, unit: "ft" }],
    [charData?.speed]
  );

  const normalizeSpeed = (arr) => {
    const unitized = arr.map((s) => ({ unit: "ft", ...s }));
    const hasWalk = unitized.some((s) => s.type === "walk");
    return hasWalk
      ? unitized
      : [{ type: "walk", value: 0, unit: "ft" }, ...unitized];
  };

  const upsertSpeed = (type) => {
    const exists = speeds.some((s) => s.type === type);
    const next = exists
      ? speeds
      : [
          ...speeds,
          { type, value: 0, unit: "ft", ...(type === "fly" ? { hover: false } : {}) },
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

  // ---------- UI ----------
  const classOptions = Object.values(HD_BY_CLASS).flat().sort();

  return (
    <div className="flex flex-col w-full max-w-3xl gap-6 border border-slate-700 rounded-xl p-4 bg-slate-800/40">
      {/* Core stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col">
          <label htmlFor="ac" className="mb-1 text-slate-300 text-xs font-semibold">
            Armor Class
          </label>
          <input
            type="number"
            id="ac"
            name="ac"
            value={charData?.ac ?? ""}
            onChange={(e) => {
              const num = e.target.value === "" ? 0 : Number(e.target.value);
              if (Number.isFinite(num)) {
                updateCharField("ac", num);
                postCharData();
              }
            }}
            className="px-2 py-1 border rounded text-slate-900"
            min={0}
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="max_hp" className="mb-1 text-slate-300 text-xs font-semibold">
            Max HP
          </label>
          <input
            type="number"
            id="max_hp"
            value={health.max_hp}
            onChange={onMaxHpChange}
            className="px-2 py-1 border rounded text-slate-900"
            min={0}
          />
        </div>

        {/* Speed editor */}
        <div className="col-span-1 sm:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <label className="text-slate-300 text-sm">Speed</label>
            <div className="flex gap-2">
              {SPEED_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => upsertSpeed(t)}
                  className="px-2 py-1 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 text-xs"
                >
                  Add {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {speeds.map((s, idx) => (
              <div
                key={`${s.type}_${idx}`}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3"
              >
                <span className="min-w-20 capitalize">{s.type}</span>

                <input
                  type="number"
                  min={0}
                  step={5}
                  value={Number(s.value ?? 0)}
                  onChange={(e) => editSpeed(idx, "value", e.target.value)}
                  className="w-24 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                  aria-label={`${s.type} speed`}
                />

                <select
                  value={s.unit || "ft"}
                  onChange={(e) => editSpeed(idx, "unit", e.target.value)}
                  className="px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                >
                  <option value="ft">ft</option>
                  <option value="m">m</option>
                </select>

                {s.type === "fly" && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!s.hover}
                      onChange={() => toggleHover(idx)}
                    />
                    hover
                  </label>
                )}

                <div className="ml-auto flex gap-2">
                  {s.type !== "walk" && (
                    <button
                      type="button"
                      onClick={() => removeSpeed(s.type)}
                      className="rounded-lg border border-red-700 bg-red-900/40 hover:bg-red-900/60 text-red-100"
                      title={`Remove ${s.type}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Offense block */}
      <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-3 space-y-2">
        <h3 className="text-sm font-semibold text-slate-200 mb-1">Offense</h3>
        <OffenseCard
          charData={charData}
          postCharData={postCharData}
          updateCharField={updateCharField}
        />
      </section>

     {/* Classes header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-5 gap-2">
            <h3 className="text-orange-300 font-semibold text-lg ml-6">Class</h3>
            <h3 className="text-orange-300 font-semibold text-lg">SubClass</h3>
            <h3 className="text-orange-300 font-semibold text-lg">Level</h3>
            <h3 className="text-orange-300 font-semibold text-lg">Hit Dice</h3>
            <span />
          </div>
          <button
            type="button"
            onClick={addClassRow}
            className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
          >
            Add class
          </button>
        </div>

        {/* Class rows */}
        <datalist id="classOptions">
          {classOptions.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>

        <div className="space-y-2">
          {classes.length === 0 && (
            <div className="text-slate-400 text-sm">No classes yet. Click “Add class”.</div>
          )}

          {classes.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-900/60 p-3 md:flex-row md:items-center"
            >
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-5 gap-2">
                {/* Class: default or custom. Input + datalist enables free text with suggestions */}
                <input
                  type="text"
                  list="classOptions"
                  placeholder="Class (pick or type custom)"
                  value={row.class_name ?? ""}
                  onChange={(e) => updateClassRow(row.id, "class_name", e.target.value)}
                  className="px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                />

                <input
                  type="text"
                  placeholder="Subclass"
                  value={row.subclass ?? ""}
                  onChange={(e) => updateClassRow(row.id, "subclass", e.target.value)}
                  className="px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                />

                <input
                  type="number"
                  min={1}
                  placeholder="Lvl"
                  value={row.level ?? ""}
                  onChange={(e) => updateClassRow(row.id, "level", e.target.value)}
                  className="w-14 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                />

                {/* Hit die: auto when default class, user can override or must set if custom */}
                <div className="flex items-center gap-2">
                  <select
                    value={row.hit_dice || ""}
                    onChange={(e) => updateClassRow(row.id, "hit_dice", e.target.value)}
                    className="px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                  >
                    <option value="">Select die</option>
                    {DIE_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center gap-1 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={!!row.hit_dice_overridden}
                      onChange={(e) =>
                        updateClassRow(row.id, "hit_dice_overridden", e.target.checked)
                      }
                    />
                    Custom die
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => removeClassRow(row.id)}
                  className="self-start md:self-auto px-1 py-1 rounded-lg border border-red-700 bg-red-900/40 hover:bg-red-900/60 text-red-100 text-xs"
                  title="Remove class"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* PB and Hit Dice totals */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border border-slate-700 rounded-lg p-3 bg-slate-900/40 text-sm">
          <div className="flex flex-col">
            <label className="mb-1 text-slate-300 text-xs font-semibold">Total Level</label>
            <input
              type="number"
              readOnly
              value={charData.total_level ?? totalLevel}
              className="w-full px-1.5 py-1 rounded border border-slate-600 bg-slate-800 text-slate-200 text-center"
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-slate-300 text-xs font-semibold">PB (standard)</label>
            <input
              type="number"
              readOnly
              value={pbObj.standard}
              className="w-full px-1.5 py-1 rounded border border-slate-600 bg-slate-800 text-slate-200 text-center"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="pb_mod" className="mb-1 text-slate-300 text-xs font-semibold">PB modifier</label>
            <input
              id="pb_mod"
              type="number"
              value={pbObj.modifier}
              onChange={(e) => {
                const val = e.target.value === "" ? 0 : Number(e.target.value);
                if (Number.isFinite(val)) setPbModifier(val);
              }}
              className="w-full px-1.5 py-1 rounded border border-slate-600 bg-white text-slate-900 text-center"
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-slate-300 text-xs font-semibold">PB (total)</label>
            <input
              type="number"
              readOnly
              value={pbObj.total}
              className="w-full px-1.5 py-1 rounded border border-slate-600 bg-slate-800 text-slate-200 text-center"
            />
          </div>

          {/* Read-only snapshot of hit dice totals */}
          <div className="flex flex-col sm:col-span-1">
            <label className="mb-1 text-slate-300 text-xs font-semibold">Hit Dice Totals</label>
            <div className="px-2 py-1 rounded border border-slate-600 bg-slate-800 text-slate-200">
              {(() => {
                const hd = charData?.hit_dice || summarizeHitDice(classes);
                const keys = Object.keys(hd);
                if (keys.length === 0) return <span className="text-slate-400">—</span>;
                return (
                  <span>
                    {keys
                      .sort((a, b) => DIE_OPTIONS.indexOf(a) - DIE_OPTIONS.indexOf(b))
                      .map((k, i) => (
                        <span key={k}>
                          {i > 0 ? ", " : null}
                          {hd[k]?.max}{k}
                        </span>
                      ))}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
