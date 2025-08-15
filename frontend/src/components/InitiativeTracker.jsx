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

      const rolledMonsters = await res.json(); // backend returns an array

      // Players (no HP editing for players)
      const playerList = (party?.players || []).map((p) => ({
        id: `pl-${p.id ?? p.name}`,        // stable id if you have p.id
        name: p.name,
        type: "player",
        ac: Number(p.ac ?? 0),
        maxHp: Number(p.hp ?? 0),
        currentHp: Number(p.hp ?? 0),
        initiative: Number(p.initiative ?? 0),
      }));

      // Monsters — give them currentHp + maxHp, filter out any with hp <= 0
      const monsterList = (rolledMonsters || [])
        .map((m, i) => {
          const maxHp = Number(m.hp ?? 0);
          return {
            id: m.id ?? `mon-${i}-${Date.now()}`,
            name: m.name,
            type: "monster",
            ac: Number(m.ac ?? 0),
            maxHp,
            currentHp: maxHp,                           // start full health
            initiative: Number(m.initiative ?? 0),
          };
        })
        .filter((m) => m.maxHp > 0); // (1) don't let 0 HP monsters in

      // Merge and sort
      const mergedOrder = [...playerList, ...monsterList].sort(
        (a, b) => b.initiative - a.initiative
      );

      setInitiativeOrder(mergedOrder);
      setCurrentTurnIndex(0);
      setRound(1);
    } catch (err) {
      console.error(err);
    }
  };

  // ---------- HP helpers (monsters only) ----------
  const setMonsterHp = (id, next) => {
    setInitiativeOrder((prev) => {
      const updated = prev
        .map((e) =>
          e.type === "monster" && e.id === id
            ? {
                ...e,
                currentHp: Math.max(0, Math.min(Number.isFinite(next) ? next : 0, e.maxHp)),
              }
            : e
        )
        // (1) remove monsters that hit 0 HP
        .filter((e) => !(e.type === "monster" && (e.currentHp ?? e.maxHp) <= 0));

      // keep currentTurnIndex in bounds
      setCurrentTurnIndex((i) =>
        updated.length === 0 ? 0 : Math.min(i, updated.length - 1)
      );
      return updated;
    });
  };

  const changeMonsterHp = (id, delta) => {
    setInitiativeOrder((prev) => {
      let removedIndex = -1;
      const updated = prev
        .map((e, idx) => {
          if (e.type !== "monster" || e.id !== id) return e;
          const next = Math.max(0, Math.min((e.currentHp ?? e.maxHp) + delta, e.maxHp));
          const newE = { ...e, currentHp: next };
          if (next <= 0) removedIndex = idx; // will be filtered below
          return newE;
        })
        .filter((e) => !(e.type === "monster" && (e.currentHp ?? e.maxHp) <= 0));

      // adjust current turn if the removed monster was before/at current index
      setCurrentTurnIndex((i) => {
        if (updated.length === 0) return 0;
        if (removedIndex !== -1 && removedIndex <= i) {
          const ni = Math.max(0, i - 1);
          return Math.min(ni, updated.length - 1);
        }
        return Math.min(i, updated.length - 1);
      });

      return updated;
    });
  };

  const handleNextTurn = () => {
    if (initiativeOrder.length === 0) return;
    const nextIndex = (currentTurnIndex + 1) % initiativeOrder.length;
    if (nextIndex === 0) setRound((r) => r + 1);
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
            {initiativeOrder.map((entity, idx) => {
              const isTurn = idx === currentTurnIndex;
              const hpReadout =
                entity.type === "monster"
                  ? `${entity.currentHp}/${entity.maxHp}`
                  : `${entity.currentHp}/${entity.maxHp}`;

              return (
                <li
                  key={entity.id ?? idx}
                  className={`p-2 rounded-lg flex items-center justify-between gap-3 ${
                    isTurn ? "bg-yellow-100 font-semibold" : "bg-slate-50"
                  }`}
                >
                  <div className="flex flex-col">
                    <span>
                      {entity.name} — Init {entity.initiative}
                    </span>
                    <span className="text-sm text-slate-1600">AC {entity.ac}</span>
                  </div>

                  {/* HP controls: monsters only */}
                  {entity.type === "monster" ? (
                    <div className="flex items-center gap-2">
                      

                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={entity.maxHp}
                          value={entity.currentHp}
                          onChange={(e) =>
                            setMonsterHp(entity.id, Number(e.target.value))
                          }
                          className="w-20 text-center rounded-lg border border-slate-300 px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-1600">
                          / {entity.maxHp}
                        </span>
                      </div>

                      
                    </div>
                  ) : (
                    // Players: read-only HP
                    <div className="text-slate-700">{hpReadout}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
};

export default InitiativeTracker;
