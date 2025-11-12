import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/AuthStore";
import useCharStore from "../store/CharStore";
import useMonsterStore from "../store/MonsterStore";

import GeneralStats from "../components/GeneralStats";
import AbilityScore from "../components/AbilityScore";
import BioStats from "../components/BioStats";
import Minions from "../components/Minions";
import Spellbook from "../components/Spellbook";
import Inventory from "../components/Inventory";
import Lore from "../components/Lore";
import Effects from "../components/Effects";

import HealthPlay from "../components/HealthPlay";
import UltimaCharges from "../components/UltimaCharges";

function TabButton({ id, label, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`px-3 py-2 text-sm rounded-lg border transition
        ${
          active
            ? "bg-slate-100 text-slate-900 border-slate-200"
            : "bg-slate-900 text-slate-100 border-slate-700 hover:bg-slate-800"
        }`}
    >
      {label}
    </button>
  );
}

export default function CombatPage() {
  // --- Zustand selectors ---
  const token = useAuthStore((s) => s.token);
  const userData = useAuthStore((s) => s.userData);
  const fetchChar = useCharStore((s) => s.fetchChar);

  const fetchMinions = useMonsterStore((s) => s.fetchMinions);

  const navigate = useNavigate();

  const [activeCharId, setActiveCharId] = useState(null);
  const [rightTab, setRightTab] = useState("effects"); // default right-panel tab
  const [expAmount, setExpAmount] = useState(0);

  // active chars
  const activeChars = useMemo(
    () =>
      (userData?.characters ?? []).filter(
        (c) =>
          c?.active === true ||
          c?.is_active === true ||
          c?.status === "active"
      ),
    [userData]
  );

  // guards
  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  useEffect(() => {
    if (
      !userData ||
      !userData.characters ||
      userData.characters.length === 0
    ) {
      navigate("/LoadChar");
    }
  }, [userData, navigate]);

  useEffect(() => {
    if (activeChars.length > 0 && !activeCharId) {
      setActiveCharId(
        activeChars[0].id || activeChars[0]._id || activeChars[0].name
      );
    }
  }, [activeChars, activeCharId]);

  const selectedChar = useMemo(
    () =>
      activeChars.find(
        (c) => (c.id || c._id || c.name) === activeCharId
      ),
    [activeChars, activeCharId]
  );


  useEffect(() => {
  if (!token || !activeCharId) return;

  (async () => {
    await fetchChar(activeCharId);
    const charData = useCharStore.getState().charData;
    if (charData?.name) await fetchMinions(charData.name);
  })();
}, [token, activeCharId, fetchChar, fetchMinions]);


  // rest API
  async function onRestAll(rest_type) {
    try {
      if (!activeChars || activeChars.length === 0)
        throw new Error("No characters selected");
      const authToken = token || localStorage.getItem("token");
      if (!authToken) throw new Error("Token not found");

      const res = await fetch("http://localhost:8000/combat/rest_all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ rest_type, characters: activeChars }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(
          `Failed: ${res.status} ${
            payload ? JSON.stringify(payload) : ""
          }`
        );
      if (activeCharId) await fetchChar(activeCharId);
    } catch (e) {
      console.error("rest error:", e.message);
    }
  }

  // experience API – send only the delta value
  async function onAdjustExperience(sign) {
    try {
      if (!selectedChar) throw new Error("No character selected");

      const amountNum = Number(expAmount);
      if (!Number.isFinite(amountNum) || amountNum === 0) return;

      const delta = sign === "+" ? amountNum : -amountNum;
      const authToken = token || localStorage.getItem("token");
      if (!authToken) throw new Error("Token not found");

      const res = await fetch("http://localhost:8000/combat/experience", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ delta }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(
          `Failed: ${res.status} ${
            payload ? JSON.stringify(payload) : ""
          }`
        );

      if (activeCharId) await fetchChar(activeCharId);
    } catch (e) {
      console.error("experience error:", e.message);
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-900 text-slate-100 flex flex-col items-center py-6">
      {/* character tabs */}
      <div className="flex gap-2 bg-slate-800/60 border border-slate-700 rounded-xl p-2 shadow-md">
        {activeChars.map((char) => {
          const id = char.id || char._id || char.name;
          const isActive = id === activeCharId;
          return (
            <button
              key={id}
              onClick={() => setActiveCharId(id)}
              className={`px-4 py-2 rounded-lg transition border
                ${
                  isActive
                    ? "bg-slate-100 text-slate-900 border-slate-200"
                    : "bg-slate-900 text-slate-100 border-slate-700 hover:bg-slate-800"
                }`}
            >
              {char.name}
            </button>
          );
        })}
      </div>

      {/* Rest + Experience bar, on same row */}
      <div className="w-[95vw] max-w-[1800px] mt-4 flex items-center gap-64 px-4 text-sm">
        {/* Left: rests */}
        <div className="flex gap-3">
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-amber-600 bg-amber-800/50 hover:bg-amber-700/70 text-amber-100 transition"
            onClick={() => onRestAll("short")}
            disabled={!selectedChar}
          >
            Short Rest
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-teal-600 bg-teal-800/50 hover:bg-teal-700/70 text-teal-100 transition"
            onClick={() => onRestAll("long")}
            disabled={!selectedChar}
          >
            Long Rest
          </button>
        </div>

        {/* Right: experience controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300 tracking-wide">
            Experience
          </span>
          <button
            type="button"
            className="px-2 py-1 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 text-xs text-slate-100 transition"
            onClick={() => onAdjustExperience("-")}
            disabled={!selectedChar}
          >
            −
          </button>
          <input
            type="number"
            value={expAmount}
            onChange={(e) => setExpAmount(e.target.value)}
            className="w-24 px-2 py-1 rounded border border-slate-700 bg-slate-950 text-amber-200 text-center text-xs"
          />
          <button
            type="button"
            className="px-2 py-1 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 text-xs text-slate-100 transition"
            onClick={() => onAdjustExperience("+")}
            disabled={!selectedChar}
          >
            +
          </button>
        </div>
      </div>

      {/* two-column layout */}
      <div className="w-[95vw] max-w-[1800px] mt-6 flex gap-4">
        {/* LEFT: Play area */}
        <div className="flex-[1.1] pr-2">
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 shadow-inner p-6">
            <div className="flex h-full flex-col gap-5">
              <div className="flex-none">
                {selectedChar ? (
                  <HealthPlay id={activeCharId} />
                ) : (
                  <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 text-slate-400">
                    Select a character to view stats.
                  </div>
                )}
              </div>

              <div className="flex-[1.5] min-h-[25vh]">
                <div className="h-full overflow-y-auto rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
                  {selectedChar ? (
                    <UltimaCharges />
                  ) : (
                    <div className="text-slate-400">
                      Select a character.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Tabs */}
        <div className="flex-[1.1] pl-2">
          <div className="flex flex-wrap gap-3 bg-slate-800/60 border border-slate-700 rounded-xl p-3 mb-4">
            <TabButton
              id="effects"
              label="Effects"
              active={rightTab === "effects"}
              onClick={setRightTab}
            />
            <TabButton
              id="minions"
              label="Minions"
              active={rightTab === "minions"}
              onClick={setRightTab}
            />
            <TabButton
              id="spellbook"
              label="Spellbook"
              active={rightTab === "spellbook"}
              onClick={setRightTab}
            />
            <TabButton
              id="inventory"
              label="Inventory"
              active={rightTab === "inventory"}
              onClick={setRightTab}
            />
            <TabButton
              id="general"
              label="General"
              active={rightTab === "general"}
              onClick={setRightTab}
            />
            <TabButton
              id="abilities"
              label="Abilities"
              active={rightTab === "abilities"}
              onClick={setRightTab}
            />
            <TabButton
              id="bio"
              label="Biography"
              active={rightTab === "bio"}
              onClick={setRightTab}
            />
            <TabButton
              id="lore"
              label="Lore"
              active={rightTab === "lore"}
              onClick={setRightTab}
            />
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-6 overflow-y-auto">
            {!selectedChar ? (
              <div className="text-slate-400">
                Select a character to view content.
              </div>
            ) : (
              <>
                {rightTab === "effects" && <Effects />}
                {rightTab === "minions" && <Minions />}
                {rightTab === "spellbook" && <Spellbook />}
                {rightTab === "inventory" && <Inventory />}
                {rightTab === "general" && <GeneralStats />}
                {rightTab === "abilities" && <AbilityScore />}
                {rightTab === "bio" && <BioStats />}
                {rightTab === "lore" && <Lore />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
