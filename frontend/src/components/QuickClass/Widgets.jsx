import React , { useState }from "react";
import { fmt, scoreToMod } from "../../utils/HelperFunctions";


export function NumberInput({ label, value, onChange }) {
  return (
    <div className="relative">
      <input
        type="number"
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