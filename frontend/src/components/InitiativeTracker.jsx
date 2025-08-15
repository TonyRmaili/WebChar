import React, { useEffect, useState } from "react";
import { PartyStore } from "../store/PartyStore";

const LS_MONSTERS_KEY = "monstersData";

const InitiativeTracker = () => {
  const party = PartyStore((s) =>
    s.currentPartyId ? s.parties[s.currentPartyId] : null
  );

  const partyCount = party?.players?.length ?? 0;

  const [monsters, setMonsters] = useState([]);
  const [initiativeOrder, setInitiativeOrder] = useState([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [round, setRound] = useState(1);

  // load monsters from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_MONSTERS_KEY);
      setMonsters(saved ? JSON.parse(saved) : []);
    } catch {
      setMonsters([]);
    }
  }, []);

  const monstersCount = monsters.reduce(
    (sum, m) => sum + (Number(m?.amount) || 1),
    0
  );

  const handleRollInitiatives = async () => {
    const diceSize = 20;
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`http://localhost:8000/dice_roll/${diceSize}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(monsters), // array of monsters
      });

      if (!res.ok) {
        throw new Error(`Failed to roll initiatives: ${res.status}`);
      }

      const monsterInitiatives = await res.json(); // { order: [...] }

      // Combine party players (with initiative rolled in backend later, if needed)
      const playerList = (party?.players || []).map((p) => ({
        name: p.name,
        hp: p.hp,
        ac: p.ac,
        type: "player",
        initiative: p.initiative ?? 0, 
      }));

      const monsterList = (monsterInitiatives || []).map((m) => ({
        name: m.name,
        hp: m.hp ?? null,
        ac: m.ac ?? null,
        type: "monster",
        initiative: m.initiative,
      }));

      // Merge and sort
      const mergedOrder = [...playerList, ...monsterList].sort(
        (a, b) => b.initiative - a.initiative
      );


      console.log(mergedOrder)
      setInitiativeOrder(mergedOrder);
      setCurrentTurnIndex(0);
      setRound(1);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNextTurn = () => {
    if (initiativeOrder.length === 0) return;
    const nextIndex = (currentTurnIndex + 1) % initiativeOrder.length;
    if (nextIndex === 0) {
      setRound((r) => r + 1);
    }
    setCurrentTurnIndex(nextIndex);
  };

  const handleResetOrder = () => {
    if (window.confirm("Reset the initiative order?")) {
      setInitiativeOrder([]);
      setCurrentTurnIndex(0);
      setRound(1);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Initiative Tracker</h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRollInitiatives}
            className="rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
          >
            Roll Initiatives & Start
          </button>
          <button
            type="button"
            onClick={handleNextTurn}
            className="rounded-xl px-4 py-2 bg-slate-200 hover:bg-slate-300"
            disabled={initiativeOrder.length === 0}
          >
            Next
          </button>
          <button
            type="button"
            onClick={handleResetOrder}
            className="rounded-xl px-4 py-2 bg-slate-200 hover:bg-slate-300"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Party / Monsters summary */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-slate-200 p-4">
          <h2 className="text-sm text-slate-1600 mb-1">Selected Party</h2>
          {party ? (
            <>
              <div className="text-lg font-medium">{party.name}</div>
              <div className="text-slate-1600">{partyCount} member(s)</div>
            </>
          ) : (
            <div className="text-slate-500">No party selected</div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <h2 className="text-sm text-slate-1600 mb-1">Monsters</h2>
          <div className="text-lg font-medium">{monstersCount} total</div>
          <div className="text-slate-1600">{monsters.length} type(s)</div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <h2 className="text-sm text-slate-1600 mb-1">Round / Turn</h2>
          <div className="text-lg font-medium">Round {round}</div>
          {initiativeOrder.length > 0 && (
            <div className="text-slate-1600">
              Current: {initiativeOrder[currentTurnIndex]?.name}
            </div>
          )}
        </div>
      </div>

      {/* Initiative Order */}
      <div className="rounded-2xl border border-slate-200 p-4">
        <h2 className="text-sm text-slate-1600 mb-3">Initiative Order</h2>
        {initiativeOrder.length === 0 ? (
          <div className="h-48 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-500">
            No order yet. Click{" "}
            <span className="mx-1 font-medium">“Roll Initiatives & Start”</span>{" "}
            to begin.
          </div>
        ) : (
          <ol className="space-y-2">
            {initiativeOrder.map((entity, idx) => (
              <li
                key={idx}
                className={`p-2 rounded-lg ${
                  idx === currentTurnIndex
                    ? "bg-yellow-100 font-semibold"
                    : "bg-slate-50"
                }`}
              >
                {entity.name} — Init {entity.initiative}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};

export default InitiativeTracker;
