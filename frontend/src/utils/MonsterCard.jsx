import React, { useMemo, useState } from "react";

/**
 * MonsterCard – extended, editable D&D monster card (JSX, no TS)
 * Sections: Header (Name, AC, HP), Ability Scores, Speeds, Saves & Skills,
 * Senses & Languages, Damage/Condition (resist/immune/vulnerable), Actions,
 * Legendary Traits (Legendary Resistance), Legendary Actions, Spellcasting.
 *
 * TailwindCSS styling. Emits onChange with full monster object when edited.
 */
export default function MonsterCard({ value, onChange }) {
  const [monster, setMonster] = useState(
    value || sampleGreenDragon()
  );

  const update = (patch) => {
    const next = { ...monster, ...patch };
    setMonster(next);
    if (onChange) onChange(next);
  };

  const setAbility = (key, val) =>
    update({ abilities: { ...monster.abilities, [key]: clampInt(val, 1, 30) } });

  const abilityMods = useMemo(() => {
    const mods = {};
    for (const [k, v] of Object.entries(monster.abilities)) {
      mods[k] = Math.floor((Number(v || 0) - 10) / 2);
    }
    return mods;
  }, [monster.abilities]);

  /* ----- ACTIONS CRUD ----- */
  const addAction = () =>
    update({ actions: [...monster.actions, newAction()] });
  const updateAction = (id, patch) =>
    update({ actions: monster.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  const removeAction = (id) =>
    update({ actions: monster.actions.filter((a) => a.id !== id) });

  /* ----- LEGENDARY ACTIONS CRUD ----- */
  const addLegendary = () =>
    update({ legendaryActions: [...monster.legendaryActions, newLegendary()] });
  const updateLegendary = (id, patch) =>
    update({ legendaryActions: monster.legendaryActions.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  const removeLegendary = (id) =>
    update({ legendaryActions: monster.legendaryActions.filter((a) => a.id !== id) });

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-xl">
        {/* HEADER */}
        <div className="flex flex-col gap-4 border-b border-slate-700 p-4 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <Label>Name</Label>
            <Input
              value={monster.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Monster name"
              className="text-lg font-semibold"
            />
          </div>
          <div className="grid w-full grid-cols-2 gap-3 md:w-auto">
            <StatBox label="AC">
              <Input
                value={monster.ac}
                onChange={(e) => update({ ac: toInt(e.target.value, 10) })}
                inputMode="numeric"
                className="text-center w-20"
              />
            </StatBox>
            <StatBox label="HP Avg">
              <Input
                value={monster.hp.average}
                onChange={(e) => update({ hp: { ...monster.hp, average: toInt(e.target.value, 0) } })}
                inputMode="numeric"
                className="text-center w-24"
              />
            </StatBox>
          </div>
        </div>

        {/* SECONDARY HEADER */}
        <div className="grid gap-3 border-b border-slate-700 p-4 md:grid-cols-3">
          <div>
            <Label>HP Formula</Label>
            <Input
              value={monster.hp.formula}
              onChange={(e) => update({ hp: { ...monster.hp, formula: e.target.value } })}
              placeholder="e.g., 18d12 + 90"
            />
          </div>
          <div>
            <Label>Challenge Rating</Label>
            <Input
              value={monster.cr}
              onChange={(e) => update({ cr: e.target.value })}
              placeholder="e.g., 15"
            />
          </div>
          <div>
            <Label>Initiative Prof.</Label>
            <Input
              value={monster.initiativeProf}
              onChange={(e) => update({ initiativeProf: toInt(e.target.value, 0) })}
              inputMode="numeric"
              placeholder="e.g., 2"
            />
          </div>
        </div>

        {/* BODY GRID */}
        <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-5">
          {/* Ability Scores */}
          <section className="lg:col-span-2">
            <SectionTitle>Ability Scores</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              {ABILITY_ORDER.map((k) => (
                <AbilityCard
                  key={k}
                  abbr={k.toUpperCase()}
                  score={monster.abilities[k]}
                  mod={abilityMods[k]}
                  onChange={(val) => setAbility(k, val)}
                />
              ))}
            </div>
          </section>

          {/* Speeds + Senses/Languages */}
          <section className="lg:col-span-3 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <SectionTitle>Speeds</SectionTitle>
                <SpeedEditor
                  value={monster.speed}
                  onChange={(v) => update({ speed: v })}
                />
              </div>
              <div>
                <SectionTitle>Senses & Languages</SectionTitle>
                <TagListEditor
                  label="Senses"
                  value={monster.senses}
                  onChange={(v) => update({ senses: v })}
                  placeholder="e.g., blindsight 60 ft."
                />
                <div className="h-3" />
                <TagListEditor
                  label="Languages"
                  value={monster.languages}
                  onChange={(v) => update({ languages: v })}
                  placeholder="e.g., Common"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <KeyValueListEditor
                title="Saving Throws"
                value={monster.saves}
                onChange={(v) => update({ saves: v })}
                keyPlaceholder="dex"
                valPlaceholder="+6"
              />
              <KeyValueListEditor
                title="Skills"
                value={monster.skills}
                onChange={(v) => update({ skills: v })}
                keyPlaceholder="perception"
                valPlaceholder="+12"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <TagListEditor
                label="Damage Resistances"
                value={monster.resistances}
                onChange={(v) => update({ resistances: v })}
                placeholder="e.g., fire"
              />
              <TagListEditor
                label="Damage Immunities"
                value={monster.immunities}
                onChange={(v) => update({ immunities: v })}
                placeholder="e.g., poison"
              />
              <TagListEditor
                label="Condition Immunities"
                value={monster.conditionImmunities}
                onChange={(v) => update({ conditionImmunities: v })}
                placeholder="e.g., poisoned"
              />
            </div>
          </section>
        </div>

        {/* Actions */}
        <div className="border-t border-slate-700 p-4">
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle>Actions</SectionTitle>
            <Button onClick={addAction}>Add Action</Button>
          </div>
          <div className="flex flex-col gap-3">
            {monster.actions.map((a) => (
              <ActionRow
                key={a.id}
                action={a}
                onChange={(patch) => updateAction(a.id, patch)}
                onRemove={() => removeAction(a.id)}
              />
            ))}
            {monster.actions.length === 0 && (
              <p className="text-sm text-slate-400">No actions. Add one.</p>
            )}
          </div>
        </div>

        {/* Legendary Traits (Legendary Resistance) */}
        <div className="border-t border-slate-700 p-4">
          <SectionTitle>Legendary Traits</SectionTitle>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Legendary Resistance (per day)</Label>
              <Input
                value={monster.legendaryResistancePerDay}
                onChange={(e) => update({ legendaryResistancePerDay: toInt(e.target.value, 0) })}
                inputMode="numeric"
                placeholder="e.g., 3"
                className="w-24"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Legendary Resistance Notes</Label>
              <Textarea
                value={monster.legendaryResistanceText}
                onChange={(e) => update({ legendaryResistanceText: e.target.value })}
                placeholder="If the monster fails a saving throw, it can choose to succeed instead."
              />
            </div>
          </div>
        </div>

        {/* Legendary Actions */}
        <div className="border-t border-slate-700 p-4">
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle>Legendary Actions</SectionTitle>
            <Button onClick={addLegendary}>Add Legendary Action</Button>
          </div>
          <div className="flex flex-col gap-3">
            {monster.legendaryActions.map((a) => (
              <LegendaryRow
                key={a.id}
                action={a}
                onChange={(patch) => updateLegendary(a.id, patch)}
                onRemove={() => removeLegendary(a.id)}
              />
            ))}
            {monster.legendaryActions.length === 0 && (
              <p className="text-sm text-slate-400">No legendary actions. Add one.</p>
            )}
          </div>
        </div>

        {/* Spellcasting */}
        <div className="border-t border-slate-700 p-4">
          <SectionTitle>Spellcasting</SectionTitle>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label>Ability</Label>
              <Input
                value={monster.spellcasting.ability}
                onChange={(e) => update({ spellcasting: { ...monster.spellcasting, ability: e.target.value } })}
                placeholder="cha"
              />
            </div>
            <div>
              <Label>Save DC</Label>
              <Input
                value={monster.spellcasting.dc}
                onChange={(e) => update({ spellcasting: { ...monster.spellcasting, dc: toInt(e.target.value, 0) } })}
                inputMode="numeric"
                placeholder="17"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Header</Label>
              <Input
                value={monster.spellcasting.header}
                onChange={(e) => update({ spellcasting: { ...monster.spellcasting, header: e.target.value } })}
                placeholder="The monster casts one of the following spells..."
              />
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <TagListEditor
              label="At Will"
              value={monster.spellcasting.will}
              onChange={(v) => update({ spellcasting: { ...monster.spellcasting, will: v } })}
              placeholder="Detect Magic"
            />
            <TagListEditor
              label="Daily (1/day each)"
              value={monster.spellcasting.daily}
              onChange={(v) => update({ spellcasting: { ...monster.spellcasting, daily: v } })}
              placeholder="Geas"
            />
            <TagListEditor
              label="Other"
              value={monster.spellcasting.other}
              onChange={(v) => update({ spellcasting: { ...monster.spellcasting, other: v } })}
              placeholder="Custom entries"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ——— UI Bits ——— */
const SectionTitle = ({ children }) => (
  <h3 className="mb-2 text-sm font-semibold tracking-wide text-slate-300">{children}</h3>
);

const Label = ({ children }) => (
  <label className="block text-xs uppercase tracking-widest text-slate-400">{children}</label>
);

const Input = (props) => (
  <input
    {...props}
    className={(props.className || "") + " mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"}
  />
);

const Textarea = (props) => (
  <textarea
    {...props}
    className={(props.className || "") + " mt-1 w-full min-h-20 resize-y rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"}
  />
);

const Button = ({ children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-lg border border-indigo-600 bg-indigo-600/10 px-3 py-1 text-sm font-medium text-indigo-300 hover:bg-indigo-600/20"
  >
    {children}
  </button>
);

const StatBox = ({ label, children }) => (
  <div className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-center">
    <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
    <div className="mt-1 font-semibold">{children}</div>
  </div>
);

const AbilityCard = ({ abbr, score, mod, onChange }) => (
  <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 p-3">
    <div className="text-[10px] tracking-widest text-slate-400">{abbr}</div>
    <input
      inputMode="numeric"
      value={score}
      onChange={(e) => onChange(toInt(e.target.value, 0))}
      className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-center text-base outline-none focus:ring-2 focus:ring-indigo-500"
    />
    <div className="text-xs text-slate-300">{signed(mod)}</div>
  </div>
);

const ActionRow = ({ action, onChange, onRemove }) => (
  <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
    <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-12">
      <input
        className="md:col-span-4 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        value={action.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Action name"
      />
      <input
        className="md:col-span-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        value={action.attackBonus}
        onChange={(e) => onChange({ attackBonus: e.target.value })}
        placeholder="Attack bonus"
      />
      <input
        className="md:col-span-3 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        value={action.damage}
        onChange={(e) => onChange({ damage: e.target.value })}
        placeholder="Damage"
      />
      <input
        className="md:col-span-3 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        value={action.tags || ""}
        onChange={(e) => onChange({ tags: e.target.value })}
        placeholder="Tags (e.g., recharge 5–6)"
      />
    </div>
    <textarea
      className="min-h-20 w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
      value={action.description}
      onChange={(e) => onChange({ description: e.target.value })}
      placeholder="Rules text, save DCs, AoE, effects"
    />
    <div className="mt-2 flex justify-end">
      <button
        type="button"
        onClick={onRemove}
        className="rounded-lg border border-rose-700/70 bg-rose-900/30 px-3 py-1 text-sm text-rose-300 hover:bg-rose-900/50"
      >
        Remove
      </button>
    </div>
  </div>
);

const LegendaryRow = ({ action, onChange, onRemove }) => (
  <div className="rounded-xl border border-slate-700 bg-slate-800 p-3">
    <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-12">
      <input
        className="md:col-span-4 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        value={action.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Legendary action name"
      />
      <input
        className="md:col-span-8 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        value={action.restriction || ""}
        onChange={(e) => onChange({ restriction: e.target.value })}
        placeholder="Restrictions or recharge (optional)"
      />
    </div>
    <textarea
      className="min-h-20 w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
      value={action.description}
      onChange={(e) => onChange({ description: e.target.value })}
      placeholder="Effect text"
    />
    <div className="mt-2 flex justify-end">
      <button
        type="button"
        onClick={onRemove}
        className="rounded-lg border border-rose-700/70 bg-rose-900/30 px-3 py-1 text-sm text-rose-300 hover:bg-rose-900/50"
      >
        Remove
      </button>
    </div>
  </div>
);

const SpeedEditor = ({ value, onChange }) => {
  const v = value || {};
  const set = (k, val) => onChange({ ...v, [k]: toInt(val, 0) });
  const keys = ["walk", "fly", "swim", "climb", "burrow"];
  return (
    <div className="grid grid-cols-5 gap-2">
      {keys.map((k) => (
        <div key={k} className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">{k}</div>
          <input
            inputMode="numeric"
            value={v[k] || ""}
            onChange={(e) => set(k, e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-center text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="0"
          />
        </div>
      ))}
    </div>
  );
};

const TagListEditor = ({ label, value, onChange, placeholder }) => {
  const list = value || [];
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (!v) return;
    onChange([...list, v]);
    setInput("");
  };
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-slate-600 bg-slate-700/30 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700/50"
        >
          Add
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {list.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-xs">
            {t}
            <button onClick={() => remove(i)} className="text-slate-400 hover:text-slate-200">×</button>
          </span>
        ))}
      </div>
    </div>
  );
};

const KeyValueListEditor = ({ title, value, onChange, keyPlaceholder, valPlaceholder }) => {
  const list = value || [];
  const [k, setK] = useState("");
  const [v, setV] = useState("");
  const add = () => {
    const key = k.trim();
    const val = v.trim();
    if (!key || !val) return;
    onChange([...list, { key, value: val }]);
    setK("");
    setV("");
  };
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const edit = (i, patch) => onChange(list.map((kv, idx) => (idx === i ? { ...kv, ...patch } : kv)));
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <div className="grid grid-cols-5 gap-2">
        <input
          value={k}
          onChange={(e) => setK(e.target.value)}
          placeholder={keyPlaceholder}
          className="col-span-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={valPlaceholder}
          className="col-span-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-slate-600 bg-slate-700/30 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700/50"
        >
          Add
        </button>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {list.map((kv, i) => (
          <div key={i} className="grid grid-cols-5 gap-2">
            <input
              value={kv.key}
              onChange={(e) => edit(i, { key: e.target.value })}
              className="col-span-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              value={kv.value}
              onChange={(e) => edit(i, { value: e.target.value })}
              className="col-span-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded-lg border border-rose-700/70 bg-rose-900/30 px-3 py-1 text-sm text-rose-300 hover:bg-rose-900/50"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ——— Helpers ——— */
const ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"];

function toInt(v, fallback = 0) {
  const n = parseInt(String(v).replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function clampInt(v, min, max) {
  const n = toInt(v, min);
  return Math.max(min, Math.min(max, n));
}

function signed(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const a = new Uint32Array(3);
    crypto.getRandomValues(a);
    return Array.from(a, (x) => x.toString(36)).join("");
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function newAction() {
  return { id: cryptoRandomId(), name: "New Action", attackBonus: "", damage: "", tags: "", description: "" };
}

function newLegendary() {
  return { id: cryptoRandomId(), name: "New Legendary", restriction: "", description: "" };
}

function sampleGreenDragon() {
  return {
    name: "Adult Green Dragon",
    ac: 19,
    hp: { average: 207, formula: "18d12 + 90" },
    cr: "15",
    initiativeProf: 2,
    abilities: { str: 23, dex: 12, con: 21, int: 18, wis: 15, cha: 18 },
    speed: { walk: 40, fly: 80, swim: 40 },
    senses: ["blindsight 60 ft.", "darkvision 120 ft."],
    languages: ["Common", "Draconic"],
    saves: [ { key: "dex", value: "+6" }, { key: "wis", value: "+7" } ],
    skills: [
      { key: "deception", value: "+9" },
      { key: "perception", value: "+12" },
      { key: "persuasion", value: "+9" },
      { key: "stealth", value: "+6" },
    ],
    resistances: [],
    immunities: ["poison"],
    conditionImmunities: ["poisoned"],
    actions: [
      { id: cryptoRandomId(), name: "Multiattack", attackBonus: "", damage: "", tags: "", description: "Makes three Rend attacks or replaces one with Mind Spike (3rd)." },
      { id: cryptoRandomId(), name: "Rend", attackBonus: "+11", damage: "2d8+6 slashing + 2d6 poison", tags: "melee", description: "Reach 10 ft." },
      { id: cryptoRandomId(), name: "Poison Breath", attackBonus: "", damage: "16d6 poison", tags: "recharge 5–6, 60-ft cone", description: "DC 18 Con save, half on success." },
    ],
    legendaryResistancePerDay: 3,
    legendaryResistanceText: "If the dragon fails a saving throw, it can choose to succeed instead.",
    legendaryActions: [
      { id: cryptoRandomId(), name: "Mind Invasion", restriction: "", description: "Casts Mind Spike (3rd)." },
      { id: cryptoRandomId(), name: "Noxious Miasma", restriction: "not again until start of next turn", description: "20-ft radius, Con save DC 17, 2d6 poison and -2 AC until end of next turn." },
      { id: cryptoRandomId(), name: "Pounce", restriction: "", description: "Move up to half speed and make one Rend attack." },
    ],
    spellcasting: {
      ability: "cha",
      dc: 17,
      header: "The dragon casts one of the following spells, no material components.",
      will: ["Detect Magic", "Mind Spike (3rd)"],
      daily: ["Geas"],
      other: [],
    },
  };
}
