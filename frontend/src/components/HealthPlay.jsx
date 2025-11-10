import React, { useMemo, useState } from "react";
import useCharStore from "../store/CharStore";

const DEFAULT_HEALTH = { current_hp: 0, max_hp: 0, temp_hp: 0, barrier: 0 };
const DIE_ORDER = ["d4", "d6", "d8", "d10", "d12", "d20"];
const ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"];

export default function HealthPlay({ id }) {
  // --- ZUSTAND SELECTORS ---
  const charData = useCharStore((s) => s.charData);
  const updateCharField = useCharStore((s) => s.updateCharField);
  const postCharData = useCharStore((s) => s.postCharData);
  const fetchChar = useCharStore((s) => s.fetchChar);

  if (!charData) return null;

  const health = useMemo(
    () => ({ ...DEFAULT_HEALTH, ...(charData.health || {}) }),
    [charData?.health]
  );

  const hitDice = useMemo(
    () =>
      charData?.hit_dice && typeof charData.hit_dice === "object"
        ? charData.hit_dice
        : {},
    [charData?.hit_dice]
  );

  const [amount, setAmount] = useState("");

  const patchHealth = async (patch) => {
    updateCharField("health", { ...health, ...patch });
    await postCharData();
  };

  async function onRest(rest_type) {
    try {
      if (!charData?.name) throw new Error("No character selected");
      const authToken = localStorage.getItem("token");
      if (!authToken) throw new Error("Token not found in localStorage");

      const res = await fetch("http://localhost:8000/combat/rest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ rest_type, name: charData.name }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(
          `Failed: ${res.status} ${payload ? JSON.stringify(payload) : ""}`
        );
      await fetchChar(id);
    } catch (e) {
      console.error("rest error:", e.message);
    }
  }

  async function onHealthChange(delta, who) {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Token not found in localStorage");
      const res = await fetch("http://localhost:8000/combat/health", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ value: delta, name: who }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(
          `Failed: ${res.status} ${
            payload ? JSON.stringify(payload) : "Unknown error"
          }`
        );
      if (payload?.health && typeof payload.health === "object")
        await patchHealth(payload.health);
    } catch (e) {
      console.error("❌ Health update error:", e.message);
    }
  }

  const onTempHpChange = (raw) =>
    patchHealth({ temp_hp: raw === "" ? 0 : Math.max(0, Number(raw) || 0) });
  const onBarrierChange = (raw) =>
    patchHealth({ barrier: raw === "" ? 0 : Math.max(0, Number(raw) || 0) });
  const onHpManualChange = (raw) =>
    patchHealth({
      current_hp: raw === "" ? 0 : Math.max(0, Number(raw) || 0),
    });

  function onReactionToggle(checked) {
    updateCharField("reaction", !!checked);
    postCharData();
  }

  function onHeroicInspirationToggle(checked) {
    updateCharField("heroic_inspiration", !!checked);
    postCharData();
  }

  function onBardicInspirationToggle(checked) {
    updateCharField("bardic_inspiration", !!checked);
    postCharData();
  }

  function onConcentrationToggle(checked) {
    updateCharField("concentration", !!checked);
    postCharData();
  }

  const spendHitDie = async (die) => {
    const cur = hitDice?.[die]?.current ?? 0;
    if (cur <= 0) return;
    const next = {
      ...hitDice,
      [die]: {
        max: hitDice?.[die]?.max ?? 0,
        current: Math.max(0, cur - 1),
      },
    };
    updateCharField("hit_dice", next);
    await postCharData();
  };

  const labelCls = "text-amber-200 text-xs leading-tight";
  const inputBase = "px-2 py-1 rounded border border-slate-700";
  const inputLight = `${inputBase} bg-white text-slate-900 w-16`;
  const inputDark = `${inputBase} bg-slate-900 text-slate-200 w-16`;

  const hdList = DIE_ORDER
    .filter((d) => hitDice?.[d]?.max > 0)
    .map((d) => ({
      die: d,
      max: hitDice[d].max ?? 0,
      current: hitDice[d].current ?? 0,
    }));

  return (
    <section className="relative rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-2 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[auto_auto_auto_auto_1fr] gap-y-2 min-w-0">
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
            {/* Max HP */}
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

        {/* Amount + buttons + Hit Dice */}
        <div className="flex items-start ml-3 min-w-0 gap-2">
          <div className="flex flex-col items-start">
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

          {/* Hit Dice buttons */}
          <div className="flex flex-col gap-1 ml-2">
            {hdList.length === 0 ? (
              <span className="text-xs text-slate-400 ml-1">No hit dice</span>
            ) : (
              hdList.map(({ die, current, max }) => (
                <button
                  key={die}
                  type="button"
                  onClick={() => spendHitDie(die)}
                  disabled={current <= 0}
                  className="px-2 py-0.5 text-xs rounded border border-slate-600 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 whitespace-nowrap"
                  title={`Spend one ${die}`}
                >
                  {die} {current}/{max}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-col gap-1 ml-6 mt-1">
          <div className="flex items-center gap-2">
            <label
              htmlFor="reaction"
              className="text-amber-200 text-sm select-none cursor-pointer"
            >
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

          <div className="flex items-center gap-2">
            <label
              htmlFor="concentration"
              className="text-amber-200 text-sm select-none cursor-pointer"
            >
              Concentration
            </label>
            <input
              id="concentration"
              type="checkbox"
              checked={Boolean(charData.concentration)}
              onChange={(e) => onConcentrationToggle(e.target.checked)}
              className="w-4 h-4 accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="heroic_inspiration"
              className="text-amber-200 text-sm select-none cursor-pointer"
            >
              Heroic Inspiration
            </label>
            <input
              id="heroic_inspiration"
              type="checkbox"
              checked={Boolean(charData.heroic_inspiration)}
              onChange={(e) => onHeroicInspirationToggle(e.target.checked)}
              className="w-4 h-4 accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="bardic_inspiration"
              className="text-amber-200 text-sm select-none cursor-pointer"
            >
              Bardic Inspiration
            </label>
            <input
              id="bardic_inspiration"
              type="checkbox"
              checked={Boolean(charData.bardic_inspiration)}
              onChange={(e) => onBardicInspirationToggle(e.target.checked)}
              className="w-4 h-4 accent-amber-500 cursor-pointer"
            />
          </div>
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

      {/* Offense summary */}
      <div className="flex flex-col gap-1">
        <div className="flex gap-2">
          <p>
            MeleeAtk:{" "}
            <span className="text-amber-500">
              {charData.offense?.melee?.total ?? 0}
            </span>
          </p>
          <p>
            RangedAtk:{" "}
            <span className="text-amber-500">
              {charData.offense?.ranged?.total ?? 0}
            </span>
          </p>
          <p>
            SpellAtk:{" "}
            <span className="text-amber-500">
              {charData.offense?.spell?.total ?? 0}
            </span>
          </p>
          <p>
            Initiative:{" "}
            <span className="text-amber-500">
              {charData.initiative?.total ?? 0}
            </span>
          </p>
        </div>

        {/* Save DCs – only active ones */}
        {(() => {
          const saveDcs = charData.offense?.save_dcs || {};

          const activeEntries = Object.entries(saveDcs)
            .filter(([, row]) => row && row.active)
            .sort(([keyA, rowA], [keyB, rowB]) => {
              const baseA = (rowA?.base || keyA.split("_")[1] || "").toLowerCase();
              const baseB = (rowB?.base || keyB.split("_")[1] || "").toLowerCase();
              const idxA = ABILITY_ORDER.indexOf(baseA);
              const idxB = ABILITY_ORDER.indexOf(baseB);
              if (idxA === -1 && idxB === -1) return 0;
              if (idxA === -1) return 1;
              if (idxB === -1) return -1;
              return idxA - idxB;
            });

          if (activeEntries.length === 0) return null;

          const rows = [];
          const CHUNK_SIZE = 4; // keep your original layout

          for (let i = 0; i < activeEntries.length; i += CHUNK_SIZE) {
            rows.push(activeEntries.slice(i, i + CHUNK_SIZE));
          }

          const capitalize = (s) =>
            s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

          return rows.map((rowEntries, rowIdx) => (
            <div key={`save-row-${rowIdx}`} className="flex gap-2">
              {rowEntries.map(([key, row]) => {
                const base = capitalize(row?.base ?? "");
                return (
                  <p key={key}>
                    <span className="text-amber-500">{base}</span>
                    {" "}
                    SaveDC:{" "}
                    <span className="text-amber-500">{row?.total ?? 0}</span>
                  </p>
                );
              })}
            </div>
          ));
        })()}
      </div>

      {/* Rest buttons pinned bottom-right */}
      <div className="absolute bottom-5 right-2 flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => onRest("short")}
          className="px-1 py-1 rounded-lg border border-amber-600 bg-amber-800/50 hover:bg-amber-700/70 text-amber-100 transition"
        >
          Short Rest
        </button>
        <button
          type="button"
          onClick={() => onRest("long")}
          className="px-1 py-1 rounded-lg border border-teal-600 bg-teal-800/50 hover:bg-teal-700/70 text-teal-100 transition"
        >
          Long Rest
        </button>
      </div>
    </section>
  );
}
