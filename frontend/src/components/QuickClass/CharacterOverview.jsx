import React, { useState } from "react";

// ─── Helpers ───
const ABILITY_LABELS = {
  stre: "STR", str: "STR",
  dex: "DEX",
  con: "CON",
  inte: "INT", int: "INT",
  wis: "WIS",
  cha: "CHA",
};

const ABILITY_KEYS = ["stre", "dex", "con", "inte", "wis", "cha"];

const scoreToMod = (score) => {
  if (score == null) return null;
  return Math.floor((score - 10) / 2);
};

const formatMod = (mod) => {
  if (mod == null) return "—";
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

// ─── Section wrapper ───
function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/80 hover:bg-slate-700/60 transition-colors"
      >
        <h3 className="text-amber-400 font-semibold text-base tracking-wide">{title}</h3>
        <span className="text-slate-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="p-4 pt-2">{children}</div>}
    </div>
  );
}

// ─── Labeled field (read-only display) ───
function Field({ label, value, className = "" }) {
  const display = value != null && value !== "" ? value : "—";
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
      <span className="text-slate-100 text-sm">{display}</span>
    </div>
  );
}

// ─── Editable field ───
function EditableField({ label, value, onChange, type = "text", className = "" }) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <label className="text-xs text-slate-400 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
        className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-slate-100 text-sm
                   focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-colors"
      />
    </div>
  );
}

// ─── Editable textarea ───
function EditableTextArea({ label, value, onChange, rows = 3 }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs text-slate-400 uppercase tracking-wider">{label}</label>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-slate-100 text-sm
                   focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-colors resize-y"
      />
    </div>
  );
}

// ─── Badge / pill ───
function Badge({ children, color = "slate" }) {
  const colors = {
    slate: "bg-slate-700 text-slate-200",
    amber: "bg-amber-900/60 text-amber-300",
    blue: "bg-blue-900/50 text-blue-300",
    green: "bg-emerald-900/50 text-emerald-300",
    purple: "bg-purple-900/50 text-purple-300",
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.slate}`}>
      {children}
    </span>
  );
}


// ══════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════
export default function CharacterOverview({ data, onChange }) {
  if (!data) return null;

  const { classes, general, ability_scores, skills, biography, inventory, feats } = data;

  // Deep-update helper
  const update = (section, key, value) => {
    onChange({
      ...data,
      [section]: { ...data[section], [key]: value },
    });
  };

  const updateNested = (section, subsection, key, value) => {
    onChange({
      ...data,
      [section]: {
        ...data[section],
        [subsection]: { ...data[section][subsection], [key]: value },
      },
    });
  };

  // ─── Class update helpers ───
  const updateClass = (index, key, value) => {
    const updated = classes.map((cls, i) => (i === index ? { ...cls, [key]: value } : cls));
    onChange({ ...data, classes: updated });
  };

  // ─── Total level ───
  const totalLevel = (classes || []).reduce((sum, c) => sum + (c.level || 0), 0);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 pb-8">

      {/* ══ HEADER BAR ══ */}
      <div className="rounded-xl border border-amber-600/40 bg-gradient-to-r from-slate-800 via-slate-800/90 to-slate-800 p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <EditableField
            label="Character Name"
            value={general?.character_name}
            onChange={(v) => update("general", "character_name", v)}
            className="col-span-2 sm:col-span-1"
          />
          <EditableField
            label="Race"
            value={general?.race}
            onChange={(v) => update("general", "race", v)}
          />
          <EditableField
            label="Background"
            value={general?.background}
            onChange={(v) => update("general", "background", v)}
          />
          <EditableField
            label="Max HP"
            value={general?.max_hp}
            onChange={(v) => update("general", "max_hp", v)}
            type="number"
          />
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
          <span>Total Level: <span className="text-amber-400 font-bold text-sm">{totalLevel}</span></span>
          {general?.subrace && <span>Subrace: <span className="text-slate-200">{general.subrace}</span></span>}
        </div>
      </div>

      {/* ══ CLASSES ══ */}
      <Section title="Classes">
        <div className="flex flex-col gap-3">
          {(classes || []).map((cls, i) => (
            <div
              key={i}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-700/50"
            >
              <EditableField
                label="Class"
                value={cls.name}
                onChange={(v) => updateClass(i, "name", v)}
              />
              <EditableField
                label="Subclass"
                value={cls.sub_class}
                onChange={(v) => updateClass(i, "sub_class", v)}
              />
              <EditableField
                label="Level"
                value={cls.level}
                onChange={(v) => updateClass(i, "level", v)}
                type="number"
              />
              <div className="flex flex-col gap-0.5 justify-center">
                <span className="text-xs text-slate-400 uppercase tracking-wider">First Class</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cls.first_class || false}
                    onChange={(e) => updateClass(i, "first_class", e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                  <span className="text-slate-300 text-sm">{cls.first_class ? "Yes" : "No"}</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ══ ABILITY SCORES ══ */}
      <Section title="Ability Scores">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {ABILITY_KEYS.map((key) => {
            const score = ability_scores?.[key];
            const mod = scoreToMod(score);
            return (
              <div
                key={key}
                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-slate-900/60 border border-slate-700/50"
              >
                <span className="text-xs text-amber-400 font-bold tracking-widest">
                  {ABILITY_LABELS[key]}
                </span>
                <input
                  type="number"
                  value={score ?? ""}
                  onChange={(e) => {
                    const val = e.target.value === "" ? null : Number(e.target.value);
                    onChange({
                      ...data,
                      ability_scores: { ...ability_scores, [key]: val },
                    });
                  }}
                  className="w-14 text-center bg-slate-800 border border-slate-600 rounded-md px-1 py-1 text-slate-100 text-lg font-semibold
                             focus:outline-none focus:border-amber-500/60"
                />
                <span className={`text-sm font-medium ${mod != null && mod >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatMod(mod)}
                </span>
              </div>
            );
          })}
        </div>
        {ability_scores?.score_prio?.length > 0 && (
          <div className="mt-3">
            <span className="text-xs text-slate-400 uppercase tracking-wider">Score Priority: </span>
            <span className="text-slate-200 text-sm">
              {ability_scores.score_prio.map((s) => ABILITY_LABELS[s] || s.toUpperCase()).join(" → ")}
            </span>
          </div>
        )}
      </Section>

      {/* ══ SKILLS ══ */}
      <Section title="Skills">
        {(!skills || skills.length === 0) ? (
          <p className="text-slate-500 text-sm italic">No skills assigned yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map((s, i) => (
              <Badge key={i} color={s.expertise ? "purple" : "blue"}>
                {s.skill || s}{s.expertise && " ★"}
              </Badge>
            ))}
          </div>
        )}
      </Section>

      {/* ══ FEATS ══ */}
      <Section title="Feats">
        {(!feats || feats.length === 0) ? (
          <p className="text-slate-500 text-sm italic">No feats selected</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {feats.map((f, i) => (
              <Badge key={i} color="amber">
                {typeof f === "string" ? f : f.name || "Unknown"}
              </Badge>
            ))}
          </div>
        )}
      </Section>

      {/* ══ BIOGRAPHY ══ */}
      <Section title="Biography" defaultOpen={false}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <EditableField
              label="Alignment"
              value={biography?.alignment}
              onChange={(v) => update("biography", "alignment", v)}
            />
            <EditableField
              label="Age"
              value={biography?.age}
              onChange={(v) => update("biography", "age", v)}
              type="number"
            />
            <EditableField
              label="Height (cm)"
              value={biography?.height}
              onChange={(v) => update("biography", "height", v)}
              type="number"
            />
            <EditableField
              label="Weight (kg)"
              value={biography?.weight}
              onChange={(v) => update("biography", "weight", v)}
              type="number"
            />
          </div>

          <EditableTextArea
            label="Backstory"
            value={biography?.backstory}
            onChange={(v) => update("biography", "backstory", v)}
            rows={4}
          />

          <EditableTextArea
            label="Description"
            value={biography?.description}
            onChange={(v) => update("biography", "description", v)}
            rows={3}
          />

          {/* Personality traits */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">Personality Traits</span>
            {(biography?.personality_traits || []).length === 0 ? (
              <p className="text-slate-500 text-sm italic">None</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {biography.personality_traits.map((trait, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <input
                      type="text"
                      value={trait}
                      onChange={(e) => {
                        const updated = [...biography.personality_traits];
                        updated[i] = e.target.value;
                        update("biography", "personality_traits", updated);
                      }}
                      className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-slate-100 text-sm
                                 focus:outline-none focus:border-amber-500/60"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>

      {/* ══ INVENTORY ══ */}
      <Section title="Inventory" defaultOpen={false}>
        {/* Treasure */}
        <div className="mb-4">
          <span className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Treasure</span>
          <div className="grid grid-cols-5 gap-2">
            {["cp", "sp", "ep", "gp", "pp"].map((coin) => (
              <div key={coin} className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-amber-400/80 font-bold uppercase">{coin}</span>
                <input
                  type="number"
                  value={inventory?.treasure?.[coin] ?? 0}
                  onChange={(e) =>
                    updateNested("inventory", "treasure", coin, Number(e.target.value) || 0)
                  }
                  className="w-full text-center bg-slate-900 border border-slate-600 rounded-md px-1 py-1 text-slate-100 text-sm
                             focus:outline-none focus:border-amber-500/60"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Gear */}
        {["mundane", "magical"].map((gearType) => {
          const items = inventory?.gear?.[gearType] || [];
          if (items.length === 0) return null;
          return (
            <div key={gearType} className="mb-3">
              <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">
                {gearType === "mundane" ? "Mundane Gear" : "Magical Gear"}
              </span>
              <div className="flex flex-col gap-1">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-200">
                    <Badge color={gearType === "magical" ? "purple" : "slate"}>
                      {item.amount > 1 ? `${item.amount}×` : ""} {item.name}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {(!inventory?.gear?.mundane?.length && !inventory?.gear?.magical?.length) && (
          <p className="text-slate-500 text-sm italic">No gear</p>
        )}
      </Section>
    </div>
  );
}
