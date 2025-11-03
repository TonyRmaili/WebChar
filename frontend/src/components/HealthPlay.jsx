import React, { useMemo, useState } from "react";
import useCharStore from "../store/CharStore";

const DEFAULT_HEALTH = { current_hp: 0, max_hp: 0, temp_hp: 0, barrier: 0 };

export default function PlayHealth() {
  const { charData, updateCharField, postCharData } = useCharStore();
  if (!charData) return null;

  const health = useMemo(
    () => ({ ...DEFAULT_HEALTH, ...(charData.health || {}) }),
    [charData?.health]
  );

  const [amount, setAmount] = useState("");

  const patchHealth = async (patch) => {
    updateCharField("health", { ...health, ...patch });
    await postCharData();
  };

  async function onHealthChange(delta, who) {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Token not found in localStorage");
      const res = await fetch("http://localhost:8000/combat/health", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ value: delta, name: who }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(`Failed: ${res.status} ${payload ? JSON.stringify(payload) : "Unknown error"}`);

      // expect { health: { current_hp, temp_hp, barrier, max_hp? } }
      if (payload?.health && typeof payload.health === "object") {
        await patchHealth(payload.health);
      }
    } catch (e) {
      console.error("❌ Health update error:", e.message);
    }
  }

  const onTempHpChange   = (raw) => patchHealth({ temp_hp: raw === "" ? 0 : Math.max(0, Number(raw) || 0) });
  const onBarrierChange  = (raw) => patchHealth({ barrier: raw === "" ? 0 : Math.max(0, Number(raw) || 0) });
  const onHpManualChange = (raw) => patchHealth({ current_hp: raw === "" ? 0 : Math.max(0, Number(raw) || 0) });

  function onReactionToggle(checked) {
    updateCharField("reaction", !!checked);
    postCharData();
  }

  const labelCls = "text-amber-200 text-xs leading-tight";
  const inputBase = "px-2 py-1 rounded border border-slate-700";
  const inputLight = `${inputBase} bg-white text-slate-900 w-16`;
  const inputDark  = `${inputBase} bg-slate-900 text-slate-200 w-16`;

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-4 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[auto_auto_auto_auto_1fr] gap-y-3 min-w-0">

        <div className="flex flex-col min-w-0">
          <div className="flex gap-3 min-w-0">
            {/* Current HP */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <label className={labelCls}>HP</label>
              <input
                type="number"
                min={0}
                value={health.current_hp}
                onChange={(e) => onHpManualChange(e.target.value)}
                className={inputLight}
              />
            </div>
            {/* Max HP (read-only) */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <label className={labelCls}>Max</label>
              <input
                type="number"
                value={health.max_hp}
                readOnly
                className={inputDark}
              />
            </div>
          </div>
        </div>

        {/* Temp HP */}
        <div className="flex flex-col items-start gap-0.5 ml-2 min-w-0">
          <label className={labelCls}>Temp HP</label>
          <input
            type="number"
            min={0}
            value={health.temp_hp}
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
            value={health.barrier}
            onChange={(e) => onBarrierChange(e.target.value)}
            className={inputLight}
          />
        </div>

        {/* Amount + buttons */}
        <div className="flex flex-col items-start ml-3 min-w-0">
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-24 px-2 py-1 mb-1 ml-2 rounded border border-slate-700 bg-white text-slate-900"
          />
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
          <label htmlFor="reaction" className="text-amber-200 text-sm select-none cursor-pointer">
            Reaction
          </label>
          <input
            id="reaction"
            type="checkbox"
            checked={Boolean(charData.reaction)}
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
