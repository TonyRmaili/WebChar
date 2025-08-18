import React, { useEffect, useMemo, useState } from "react";

const LS_KEY = "monstersData";

const emptyForm = {
  name: "",
  hp: 0,
  ac: 10,
  speed: 30,
  initiativeBonus: 0,
  amount: 1,
  roll_type: null, // <-- NEW: null (normal) | true (adv) | false (dis)
};

const uid = () =>
  (crypto.randomUUID?.() || String(Date.now() + Math.random())).toString();

const CreateMonsters = () => {
  // Load from localStorage once
  const [monsters, setMonsters] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist on each change
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(monsters));
  }, [monsters]);

  // Add form
  const [form, setForm] = useState(emptyForm);

  const updateForm = (field, value) =>
    setForm((f) => ({
      ...f,
      [field]: field === "name" ? value : value, // Number handled inside NumberField onBlur
    }));

  const addMonster = (e) => {
    e?.preventDefault?.();
    if (!form.name.trim()) return alert("Please enter a monster name.");
    const entry = {
      id: uid(),
      name: form.name.trim(),
      hp: Number(form.hp) || 0,
      ac: Number(form.ac) || 0,
      speed: Number(form.speed) || 0,
      initiativeBonus: Number(form.initiativeBonus) || 0,
      amount: Math.max(1, Number(form.amount) || 1),
      roll_type: form.roll_type ?? null, // <-- include in saved data
    };
    setMonsters((m) => [...m, entry]);
    setForm(emptyForm);
  };

  // Inline edits
  const updateMonster = (id, field, value) =>
    setMonsters((list) =>
      list.map((m) =>
        m.id === id ? { ...m, [field]: field === "name" ? value : value } : m
      )
    );

  // Quick amount controls
  const adjustAmount = (id, delta) =>
    setMonsters((list) =>
      list.map((m) =>
        m.id === id
          ? { ...m, amount: Math.max(1, (Number(m.amount) || 1) + delta) }
          : m
      )
    );

  const removeMonster = (id) =>
    setMonsters((list) => list.filter((m) => m.id !== id));

  const clearAll = () => {
    if (window.confirm("Delete ALL saved monsters? This cannot be undone.")) {
      setMonsters([]);
    }
  };

  // Optional: sort view by initiativeBonus (highest first)
  const sorted = useMemo(
    () =>
      [...monsters].sort(
        (a, b) =>
          (Number(b.initiativeBonus) || 0) - (Number(a.initiativeBonus) || 0)
      ),
    [monsters]
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Create Monsters</h1>
        {monsters.length > 0 && (
          <button
            onClick={clearAll}
            className="rounded-xl px-4 py-2 bg-slate-200 hover:bg-slate-300"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Add form */}
      <form
        onSubmit={addMonster}
        className="rounded-2xl border border-slate-200 p-4 shadow-sm mb-6"
      >
        <h2 className="font-medium mb-3">Add a monster</h2>
        <div className="grid md:grid-cols-7 sm:grid-cols-3 grid-cols-2 gap-3">
          <div className="flex flex-col">
            <label className="text-sm text-slate-1600 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              placeholder="Goblin"
              className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <NumberField
            label="HP"
            value={form.hp}
            onChange={(v) => updateForm("hp", v)}
          />
          <NumberField
            label="AC"
            value={form.ac}
            onChange={(v) => updateForm("ac", v)}
          />
          <NumberField
            label="Speed"
            value={form.speed}
            onChange={(v) => updateForm("speed", v)}
          />
          <NumberField
            label="Initiative Bonus"
            value={form.initiativeBonus}
            onChange={(v) => updateForm("initiativeBonus", v)}
            allowNegative
          />
          <NumberField
            label="Amount"
            value={form.amount}
            min={1}
            onChange={(v) => updateForm("amount", v)}
          />

          {/* NEW: Roll Type Select */}
          <RollTypeSelect
            label="Roll Type"
            value={form.roll_type}
            onChange={(rt) => updateForm("roll_type", rt)}
          />
        </div>

        <div className="mt-3">
          <button
            type="submit"
            className="rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
          >
            + Add
          </button>
        </div>
      </form>

      {/* List */}
      {sorted.length === 0 ? (
        <p className="text-slate-500">No monsters saved yet.</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-4">
          {sorted.map((m, idx) => (
            <li
              key={m.id}
              className="rounded-2xl border border-slate-200 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">
                  {idx + 1}. {m.name || "Unnamed"}
                </h3>
                <button
                  onClick={() => {
                    removeMonster(m.id);
                  }}
                  className="text-sm rounded-lg px-2 py-1 bg-rose-100 text-rose-700 hover:bg-rose-200"
                >
                  Delete
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Name"
                  value={m.name}
                  onChange={(v) => updateMonster(m.id, "name", v)}
                />
                <NumberField
                  label="HP"
                  value={m.hp}
                  onChange={(v) => updateMonster(m.id, "hp", v)}
                />
                <NumberField
                  label="AC"
                  value={m.ac}
                  onChange={(v) => updateMonster(m.id, "ac", v)}
                />
                <NumberField
                  label="Speed"
                  value={m.speed}
                  onChange={(v) => updateMonster(m.id, "speed", v)}
                />
                <NumberField
                  label="Initiative Bonus"
                  value={m.initiativeBonus}
                  onChange={(v) => updateMonster(m.id, "initiativeBonus", v)}
                  allowNegative
                />

                {/* NEW: Roll Type Select in list */}
                <RollTypeSelect
                  label="Roll Type"
                  value={m.roll_type}
                  onChange={(rt) => updateMonster(m.id, "roll_type", rt)}
                />

                <div className="flex flex-col">
                  <label className="text-sm text-slate-1600 mb-1">Amount</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustAmount(m.id, -1)}
                      className="rounded-lg px-3 py-2 border border-slate-300 hover:bg-slate-50"
                      title="Decrease"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={m.amount}
                      onChange={(e) =>
                        updateMonster(m.id, "amount", Number(e.target.value))
                      }
                      className="w-20 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => adjustAmount(m.id, +1)}
                      className="rounded-lg px-3 py-2 border border-slate-300 hover:bg-slate-50"
                      title="Increase"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Helpers -----------------------------------------------------

// Select for roll type → returns null (normal), true (adv), false (dis)
const RollTypeSelect = ({ label = "Roll Type", value, onChange }) => {
  // map JS value -> UI option
  const toOpt = (v) => (v === true ? "adv" : v === false ? "dis" : "normal");
  // map UI option -> JS value
  const fromOpt = (opt) =>
    opt === "adv" ? true : opt === "dis" ? false : null;

  return (
    <div className="flex flex-col">
      <label className="text-sm text-slate-1600 mb-1">{label}</label>
      <select
        value={toOpt(value)}
        onChange={(e) => onChange(fromOpt(e.target.value))}
        className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="normal">Normal</option>
        <option value="adv">Advantage</option>
        <option value="dis">Disadvantage</option>
      </select>
    </div>
  );
};

// NumberField that allows negative while typing (handles '-', '')
const NumberField = ({ label, value, onChange, min, allowNegative }) => {
  const [text, setText] = useState(
    value === 0 || typeof value === "number" ? String(value) : ""
  );

  useEffect(() => {
    setText(value === 0 || typeof value === "number" ? String(value) : "");
  }, [value]);

  const onTextChange = (e) => {
    const v = e.target.value;
    if (v === "" || v === "-" || v === "+") {
      setText(v);
      return;
    }
    const re = allowNegative ? /^-?\d*$/ : /^\d*$/;
    if (re.test(v)) setText(v);
  };

  const onBlur = () => {
    let n = parseInt(text, 10);
    if (isNaN(n)) n = 0;
    if (min !== undefined) n = Math.max(min, n);
    onChange(n);
    setText(String(n));
  };

  return (
    <div className="flex flex-col">
      <label className="text-sm text-slate-1600 mb-1">{label}</label>
      <input
        type="text"
        value={text}
        onChange={onTextChange}
        onBlur={onBlur}
        className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
};

const TextField = ({ label, value, onChange }) => (
  <div className="flex flex-col">
    <label className="text-sm text-slate-1600 mb-1">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

export default CreateMonsters;
