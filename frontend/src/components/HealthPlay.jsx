import React, { useMemo, useState } from "react";
import useCharStore from "../store/CharStore";

const DEFAULT_CURRENT = { hp: 0, temp_hp: 0, barrier: 0, reaction: false};


export default function PlayHealth() {
  const { charData, updateCharField, postCharData } = useCharStore();
  if (!charData) return null;

  const maxHP = Number(charData?.max_hp ?? 0);
  const current = useMemo(
    () => ({ ...DEFAULT_CURRENT, ...(charData.current || {}) }),
    [charData?.current]
  );

  const [amount, setAmount] = useState("");

  async function onHealthChange(value, name) {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Token not found in localStorage");

      const res = await fetch("http://localhost:8000/combat/health", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ value, name }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(`Failed: ${res.status} ${payload ? JSON.stringify(payload) : "Unknown error"}`);

      if (payload && payload.current && typeof payload.current === "object") {
        updateCharField("current", { ...(charData.current || DEFAULT_CURRENT), ...payload.current });
      } else if (payload && (payload.hp !== undefined || payload.temp_hp !== undefined || payload.barrier !== undefined)) {
        updateCharField("current", {
          ...(charData.current || DEFAULT_CURRENT),
          ...(payload.hp !== undefined ? { hp: payload.hp } : {}),
          ...(payload.temp_hp !== undefined ? { temp_hp: payload.temp_hp } : {}),
          ...(payload.barrier !== undefined ? { barrier: payload.barrier } : {}),
        });
      }
    } catch (e) {
      console.error("❌ Health update error:", e.message);
    }
  }

  async function onTempHpChange(raw) {
    const value = raw === "" ? "" : Math.max(0, Number(raw) || 0);
    updateCharField("current", { ...(charData.current || DEFAULT_CURRENT), temp_hp: value });
    await postCharData();
  }
  async function onBarrierChange(raw) {
    const value = raw === "" ? "" : Math.max(0, Number(raw) || 0);
    updateCharField("current", { ...(charData.current || DEFAULT_CURRENT), barrier: value });
    await postCharData();
  }
  async function onHpManualChange(raw) {
    const value = raw === "" ? "" : Math.max(0, Number(raw) || 0);
    updateCharField("current", { ...(charData.current || DEFAULT_CURRENT), hp: value });
    await postCharData();
  }

  function onReactionToggle(checked) {
  updateCharField("current", {
    ...(charData.current || DEFAULT_CURRENT),
    reaction: checked,
  });
  postCharData();
}

  // styles
  const labelCls = "text-amber-200 text-xs leading-tight"; // removed w-16/md:w-20
  const inputBase = "px-2 py-1 rounded border border-slate-700";
  const inputLight = `${inputBase} bg-white text-slate-900 w-16`;
  const inputDark  = `${inputBase} bg-slate-900 text-slate-200 w-16`;


  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-4 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[auto_auto_auto_auto_1fr] gap-y-3 min-w-0">

        <div className="flex flex-col  min-w-0">
          <div className="flex gap-3 min-w-0">
            {/* Current HP */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <label className={labelCls}>HP</label>
              <input
                type="number"
                min={0}
                value={current.hp ?? 0}
                onChange={(e) => onHpManualChange(e.target.value)}
                className={inputLight}
              />
            </div>
            {/* Max HP */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <label className={labelCls}>Max</label>
              <input
                type="number"
                value={maxHP}
                readOnly
                className={inputDark}
              />
            </div>
          </div>
        </div>

        {/* Temp HP */}
        <div className="flex flex-col items-start gap-0.5  ml-2 min-w-0">
          <label className={labelCls}>Temp HP</label>
          <input
            type="number"
            min={0}
            value={current.temp_hp ?? 0}
            onChange={(e) => onTempHpChange(e.target.value)}
            className={inputLight}
          />
        </div>

        {/* Barrier */}
        <div className="flex flex-col items-start gap-0.5 ml-2 min-w-0">
          <label className={labelCls}>Barrier</label>
          <input
            type="number"
            min={0}
            value={current.barrier ?? 0}
            onChange={(e) => onBarrierChange(e.target.value)}
            className={inputLight}
          />
        </div>

        {/* Amount input on top */}
        <div className="flex flex-col items-start ml-3 min-w-0"> 
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-24 px-2 py-1 mb-1 ml-2 rounded border border-slate-700 bg-white text-slate-900"
          />

          {/* Damage and Heal buttons same width, minimal gap */}
          <div className="flex w-24 justify-between gap-1">
            <button
              type="button"
              onClick={() => {
                const n = Number(amount);
                if (!Number.isFinite(n) || n <= 0) return;
                onHealthChange(-n, charData.name);
              }}
              className="flex-1 px-2 py-1 text-sm rounded border border-red-700 bg-red-900/40 hover:bg-red-900/60 text-red-100"
            >
              Damage
            </button>
            <button
              type="button"
              onClick={() => {
                const n = Number(amount);
                if (!Number.isFinite(n) || n <= 0) return;
                onHealthChange(n, charData.name);
              }}
              className="flex-1 px-2 py-1 text-sm rounded border border-emerald-700 bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-100"
            >
              Heal
            </button>
          </div>
        </div>
        
        {/* Reaction */}
        <div className="flex items-center ml-8 mb-10 gap-2">
          <label
            htmlFor="reaction"
            className="text-amber-200 text-sm select-none cursor-pointer"
          >
            Reaction
          </label>
          <input
            id="reaction"
            type="checkbox"
            checked={Boolean(current.reaction)}
            onChange={(e) => onReactionToggle(e.target.checked)}
            className="w-4 h-4 accent-amber-500 cursor-pointer"
          />
        </div>
        
      </div>

      {/* Quick buttons */}
      <div className="flex flex-wrap gap-2">
        {[-1, -5, -10].map((v) => (
          <button
            key={v}
            onClick={() => onHealthChange(v, charData.name)}
            className="px-2 py-1 rounded border border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm"
          >
            {v}
          </button>
        ))}
        <span className="mx-2 text-slate-500">|</span>
        {[1, 5, 10].map((v) => (
          <button
            key={v}
            onClick={() => onHealthChange(v, charData.name)}
            className="px-2 py-1 rounded border border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm"
          >
            +{v}
          </button>
        ))}
      </div>
    </section>
  );
}
