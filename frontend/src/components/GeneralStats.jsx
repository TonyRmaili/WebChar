import React from "react";
import useCharStore from "../store/CharStore";

function GeneralStats() {
  const { charData, updateCharField, postCharData } = useCharStore();

  // Guard: show nothing until data arrives
  if (!charData) return null;

  // ----- Existing numeric handler (AC, HP, etc.) -----
  const handleNumberChange = (e) => {
    const { name, value } = e.target;

    if (value === "") {
      updateCharField(name, "");
      postCharData();
      return;
    }

    const num = Number(value);
    if (!Number.isNaN(num)) {
      updateCharField(name, num);
      postCharData();
    }
  };

  // ----- Classes state helpers (stored at charData.classes: Array<row>) -----
  const classes = Array.isArray(charData?.classes) ? charData.classes : [];

  const addClassRow = () => {
    const newRow = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      class_name: "",
      subclass: "",
      level: "",
      hit_dice: "", // free text like "d6", "d8", etc.
    };
    const next = [...classes, newRow];
    updateCharField("classes", next);
    postCharData();
  };

  const removeClassRow = (id) => {
    const next = classes.filter((r) => r.id !== id);
    updateCharField("classes", next);
    postCharData();
  };

  const updateClassRow = (id, key, value) => {
    const next = classes.map((r) =>
      r.id === id ? { ...r, [key]: key === "level" && value !== "" ? Number(value) : value } : r
    );
    updateCharField("classes", next);
    postCharData();
  };

  return (
    <div className="flex flex-col w-full max-w-3xl gap-6 border border-slate-700 rounded-xl p-4 bg-slate-800/40">
      {/* --- Core stats --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-4">
          <label htmlFor="ac" className="w-28 text-right">
            Armor Class
          </label>
          <input
            type="number"
            id="ac"
            name="ac"
            value={charData?.ac ?? ""}
            onChange={handleNumberChange}
            className="flex-1 px-2 py-1 border rounded text-slate-900"
            min={0}
          />
        </div>

        <div className="flex items-center gap-4">
          <label htmlFor="max_hp" className="w-28 text-right">
            Max HP
          </label>
          <input
            type="number"
            id="max_hp"
            name="max_hp"
            value={charData?.max_hp ?? ""}
            onChange={handleNumberChange}
            className="flex-1 px-2 py-1 border rounded text-slate-900"
          />
        </div>

        <div className="flex items-center gap-4">
          <label htmlFor="speed" className="w-28 text-right">
            Speed
          </label>
          <input
            type="number"
            id="speed"
            name="speed"
            value={charData?.speed ?? ""}
            onChange={handleNumberChange}
            className="flex-1 px-2 py-1 border rounded text-slate-900"
            min={0}
          />
        </div>

        <div className="flex items-center gap-4">
          <label htmlFor="pb" className="w-28 text-right">
            Prof. Bonus
          </label>
          <input
            type="number"
            id="pb"
            name="pb"
            value={charData?.pb ?? ""}
            onChange={handleNumberChange}
            className="flex-1 px-2 py-1 border rounded text-slate-900"
            min={2}
          />
        </div>
      </div>

      {/* --- Multiclass editor --- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-orange-300 font-semibold text-lg">Classes</h3>
          <button
            type="button"
            onClick={addClassRow}
            className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
          >
            Add class
          </button>
        </div>

        <div className="space-y-2">
          {classes.length === 0 && (
            <div className="text-slate-400 text-sm">No classes yet. Click “Add class”.</div>
          )}

          {classes.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-900/60 p-3 md:flex-row md:items-center"
            >
              {/* One line: Class, Subclass, Lvl, Hit Dice */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  placeholder="Class"
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
                  className="px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                />

                <input
                  type="text"
                  placeholder="Hit Dice (e.g., d6)"
                  value={row.hit_dice ?? ""}
                  onChange={(e) => updateClassRow(row.id, "hit_dice", e.target.value)}
                  className="px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => removeClassRow(row.id)}
                  className="mt-1 md:mt-0 px-3 py-1.5 rounded-lg border border-red-700 bg-red-900/40 hover:bg-red-900/60 text-red-100 transition"
                  title="Remove class"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GeneralStats;
