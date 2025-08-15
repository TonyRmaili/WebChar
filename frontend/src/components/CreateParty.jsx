import React, { useEffect } from "react";
import { PartyStore, initPartyAutosync } from "../store/PartyStore";
import PlayerCard from "./miniComp/PlayerCard";

const CreateParty = () => {
  const parties       = PartyStore((s) => s.parties);
  const currentPartyId= PartyStore((s) => s.currentPartyId);
  const status        = PartyStore((s) => s.status);

  const createParty   = PartyStore((s) => s.createParty);
  const selectParty   = PartyStore((s) => s.selectParty);
  const addPlayer     = PartyStore((s) => s.addPlayer);
  const removePlayer  = PartyStore((s) => s.removePlayer);
  const updatePlayer  = PartyStore((s) => s.updatePlayer);
  const clearPlayers  = PartyStore((s) => s.clearPlayers);
  const removeParty   = PartyStore((s) => s.removeParty);
  const deletePartyOnServer = PartyStore((s) => s.deletePartyOnServer);
  const players = currentPartyId ? parties[currentPartyId]?.players ?? [] : [];

  useEffect(() => {
    initPartyAutosync();
  }, []);

  const onCreateParty = () => {
    const name = window.prompt("Name your party:");
    if (name && name.trim()) {
      createParty(name.trim());
    }
  };

  const onDeleteParty = async () => {
    if (!currentPartyId) return;
    const name = parties[currentPartyId]?.name;
    if (!name) return;

    if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
      // optimistic update (or wait for server then update)
      removeParty(currentPartyId);
      try {
        await deletePartyOnServer(name);
      } catch (e) {
        console.error(e);
        // optional: revert UI or show toast
      }
    }
  };



  // const onDeleteParty = () => {
  //   if (!currentPartyId) return;
  //   if (window.confirm("Are you sure you want to delete this party? This cannot be undone.")) {
  //     removeParty(currentPartyId);
  //   }
  // };


  const clearAll = () => {
    if (!currentPartyId) return;
    if (window.confirm("Are you sure you want to remove all players in this party?")) {
      clearPlayers();
    }
  };

  const partyList = Object.values(parties);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Parties</h1>
        <button
          onClick={onCreateParty}
          className="rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
        >
          + Create party
        </button>
        {currentPartyId && (
        <button
          onClick={onDeleteParty}
          className="rounded-xl px-3 py-2 bg-rose-600 text-white hover:bg-rose-700"
        >
          Delete party
        </button>
      )}
      </div>

      {/* Party scroller */}
      {partyList.length > 0 ? (
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-2 min-w-[300px]">
            {partyList.map((p) => {
              const active = p.id === currentPartyId;
              return (
                <button
                  key={p.id}
                  onClick={() => selectParty(p.id)}
                  className={`px-3 py-2 rounded-xl border ${
                    active
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                  title={p.name}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-slate-500 mb-6">No parties yet. Click “Create party”.</p>
      )}

      {/* If a party is selected, show player config */}
      {currentPartyId ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">
              {parties[currentPartyId]?.name}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={addPlayer}
                className="rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
              >
                + Add Player
              </button>
              {players.length > 0 && (
                <button
                  onClick={clearAll}
                  className="rounded-xl px-4 py-2 bg-slate-200 hover:bg-slate-300"
                >
                  Clear Players
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-2">Sync status: {status}</p>

          {players.length === 0 ? (
            <p className="text-slate-500">No players yet. Click “Add Player”.</p>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-4">
              {players.map((pl, idx) => (
                <PlayerCard
                  key={pl.id}
                  index={idx}
                  player={pl}
                  onRemove={() => removePlayer(pl.id)}
                  onUpdate={(field, value) => updatePlayer(pl.id, field, value)}
                />
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-slate-500">Select a party to configure players.</p>
      )}
    </div>
  );
};

export default CreateParty;
