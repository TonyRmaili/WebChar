import React, { useEffect, useMemo, useState } from "react";
import useCharStore from "../store/CharStore";

const DEFAULT_CURRENT = { hp: 0, temp_hp: 0 };

export default function PlayHealth() {
  const { charData, updateCharField, postCharData } = useCharStore();

  if (!charData) return null;

  // // Ensure the "current" object exists once
  // useEffect(() => {
  //   if (!charData.current) {
  //     updateCharField("current", DEFAULT_CURRENT);
  //     postCharData();
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [!!charData.current]);

  const maxHP = Number(charData?.max_hp ?? 0);

  const current = useMemo(
    () => ({ ...DEFAULT_CURRENT, ...(charData.current || {}) }),
    [charData?.current]
  );

  const [amount, setAmount] = useState("");

  // --- API call to apply damage or healing ---
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
      console.log(charData.current.hp)
      
      if (!res.ok) {
        throw new Error(
          `Failed: ${res.status} ${
            payload ? JSON.stringify(payload) : "Unknown error"
          }`
        );
      }

      // ✅ Apply backend’s updated HP to store
      if (payload && payload.current && typeof payload.current === "object") {
        updateCharField("current", {
          ...(charData.current || DEFAULT_CURRENT),
          ...payload.current,
        });
      } else if (
        payload &&
        (payload.hp !== undefined || payload.temp_hp !== undefined)
      ) {
        updateCharField("current", {
          ...(charData.current || DEFAULT_CURRENT),
          ...(payload.hp !== undefined ? { hp: payload.hp } : {}),
          ...(payload.temp_hp !== undefined ? { temp_hp: payload.temp_hp } : {}),
        });
      }

      console.log("✅ Updated from backend:", payload);
    } catch (e) {
      console.error("❌ Health update error:", e.message);
    }
  }

  // --- Update temp HP locally and persist ---
  async function onTempHpChange(raw) {
    const value = raw === "" ? "" : Number(raw);
    const next = {
      ...(charData.current || DEFAULT_CURRENT),
      temp_hp: Number.isNaN(value) ? 0 : value,
    };
    updateCharField("current", next);
    await postCharData();
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-4">
      <header>
        <h3 className="text-lg font-semibold text-orange-300">Health</h3>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
        {/* Current / Max (read-only; backend updates these) */}
        <div className="flex items-center gap-3">
          <label className="w-24 text-slate-300 text-sm">Current / Max</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={current.hp ?? 0}
              readOnly
              className="w-24 px-2 py-1 rounded border border-slate-700 bg-slate-900 text-slate-200"
              title="Current HP is controlled by the backend"
            />
            <span className="text-slate-300">/</span>
            <input
              type="number"
              value={maxHP}
              readOnly
              className="w-24 px-2 py-1 rounded border border-slate-700 bg-slate-900 text-slate-200"
              title="Max HP comes from General Stats"
            />
          </div>
        </div>

        {/* Temp HP (editable) */}
        <div className="flex items-center gap-3">
          <label className="w-24 text-slate-300 text-sm">Temp HP</label>
          <input
            type="number"
            value={current.temp_hp ?? 0}
            onChange={(e) => onTempHpChange(e.target.value)}
            className="w-24 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
          />
        </div>

        {/* Amount + buttons */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-28 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
          />
          <button
            type="button"
            onClick={() => {
              const n = Number(amount);
              if (!Number.isFinite(n) || n <= 0) return;
              onHealthChange(-n, charData.name); // damage
            }}
            className="px-3 py-1.5 rounded-lg border border-red-700 bg-red-900/40 hover:bg-red-900/60 text-red-100 transition"
          >
            Damage
          </button>
          <button
            type="button"
            onClick={() => {
              const n = Number(amount);
              if (!Number.isFinite(n) || n <= 0) return;
              onHealthChange(+n, charData.name); // heal
            }}
            className="px-3 py-1.5 rounded-lg border border-emerald-700 bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-100 transition"
          >
            Heal
          </button>
        </div>
      </div>

      {/* Quick heal/damage buttons */}
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
