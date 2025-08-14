import React, { useEffect } from "react";
import { PartyStore, initPartyAutosync } from "../store/PartyStore";

const CreateParty = () => {
  const players = PartyStore((s) => s.players);
  const status = PartyStore((s) => s.status);

  const addPlayer = PartyStore((s) => s.addPlayer);
  const removePlayer = PartyStore((s) => s.removePlayer);
  const updatePlayer = PartyStore((s) => s.updatePlayer);
  const clearPlayers = PartyStore((s) => s.clearPlayers);

  useEffect(() => {
    // set up the debounced autosync subscription once
    initPartyAutosync();
  }, []);

  const clearAll = () => {
    if (
      window.confirm(
        "Are you sure you want to remove all players? This cannot be undone."
      )
    ) {
      clearPlayers();
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Create Party</h1>
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
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Optional sync status */}
      <p className="text-xs text-slate-500 mb-2">
        Sync status: {status}
      </p>

      {players.length === 0 ? (
        <p className="text-slate-500">No players yet. Click “Add Player”.</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-4">
          {players.map((pl, idx) => (
            <li
              key={pl.id}
              className="rounded-2xl border border-slate-200 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-medium">Player {idx + 1}</h2>
                <button
                  onClick={() => removePlayer(pl.id)}
                  className="text-sm rounded-lg px-2 py-1 bg-rose-100 text-rose-700 hover:bg-rose-200"
                >
                  Remove
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col">
                  <label className="text-sm text-slate-1600 mb-1">Name</label>
                  <input
                    type="text"
                    value={pl.name}
                    onChange={(e) =>
                      updatePlayer(pl.id, "name", e.target.value)
                    }
                    placeholder="e.g., Thoriak"
                    className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <label className="text-sm text-slate-1600 mb-1">
                      Initiative
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={pl.initiative}
                      onChange={(e) =>
                        updatePlayer(pl.id, "initiative", e.target.value)
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="text-sm text-slate-1600 mb-1">HP</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={pl.hp}
                      onChange={(e) =>
                        updatePlayer(pl.id, "hp", e.target.value)
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <label className="text-sm text-slate-1600 mb-1">
                      Perception
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={pl.perception}
                      onChange={(e) =>
                        updatePlayer(pl.id, "perception", e.target.value)
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="text-sm text-slate-1600 mb-1">AC</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={pl.ac}
                      onChange={(e) =>
                        updatePlayer(pl.id, "ac", e.target.value)
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CreateParty;












// old
// import React, { useEffect, useState } from "react";

// const emptyPlayer = () => ({
//   id: crypto.randomUUID?.() || String(Date.now() + Math.random()),
//   name: "",
//   initiative: 0,
//   hp: 0,
//   perception: 10,
//   ac: 10,
// });

// const CreateParty = () => {
//   const [players, setPlayers] = useState(() => {
//     try {
//       const saved = localStorage.getItem("party_players");
//       return saved ? JSON.parse(saved) : [];
//     } catch {
//       return [];
//     }
//   });

//   // persist
//   useEffect(() => {
//     localStorage.setItem("party_players", JSON.stringify(players));
//   }, [players]);

//   const addPlayer = () => setPlayers((p) => [...p, emptyPlayer()]);

//   const removePlayer = (id) =>
//     setPlayers((p) => p.filter((pl) => pl.id !== id));

//   const updatePlayer = (id, field, value) =>
//     setPlayers((p) =>
//       p.map((pl) =>
//         pl.id === id ? { ...pl, [field]: field === "name" ? value : Number(value) } : pl
//       )
//     );

//   const clearAll = () => {
//   if (window.confirm("Are you sure you want to remove all players? This action cannot be undone.")) {
//     setPlayers([]);
//   }
// };

//   return (
//     <div className="max-w-3xl mx-auto p-6">
//       <div className="flex items-center justify-between mb-4">
//         <h1 className="text-2xl font-semibold">Create Party</h1>
//         <div className="flex gap-2">
//           <button
//             onClick={addPlayer}
//             className="rounded-xl px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
//           >
//             + Add Player
//           </button>
//           {players.length > 0 && (
//             <button
//               onClick={clearAll}
//               className="rounded-xl px-4 py-2 bg-slate-200 hover:bg-slate-300"
//             >
//               Clear
//             </button>   
//           )}
//         </div>
//       </div>


//       {players.length === 0 ? (
//         <p className="text-slate-500">No players yet. Click “Add Player”.</p>
//       ) : (
//         <ul className="grid sm:grid-cols-2 gap-4">
//           {players.map((pl, idx) => (
//             <li key={pl.id} className="rounded-2xl border border-slate-200 p-4 shadow-sm">
//               <div className="flex items-center justify-between mb-3">
//                 <h2 className="font-medium">Player {idx + 1}</h2>
//                 <button
//                   onClick={() => removePlayer(pl.id)}
//                   className="text-sm rounded-lg px-2 py-1 bg-rose-100 text-rose-700 hover:bg-rose-200"
//                   title="Remove player"
//                 >
//                   Remove
//                 </button>
//               </div>

//               <div className="space-y-3">
//                 {/* Name */}
//                 <div className="flex flex-col">
//                   <label className="text-sm text-slate-1600 mb-1">Name</label>
//                   <input
//                     type="text"
//                     value={pl.name}
//                     onChange={(e) => updatePlayer(pl.id, "name", e.target.value)}
//                     placeholder="e.g., Thoriak"
//                     className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
//                   />
//                 </div>

//                 {/* Initiative */}
//                 <div className="grid grid-cols-2 gap-3">
//                   <div className="flex flex-col">
//                     <label className="text-sm text-slate-1000 mb-1">Initiative</label>
//                     <input
//                       type="number"
//                       inputMode="numeric"
//                       value={pl.initiative}
//                       onChange={(e) => updatePlayer(pl.id, "initiative", e.target.value)}
//                       className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
//                     />
//                   </div>

//                   {/* HP */}
//                   <div className="flex flex-col">
//                     <label className="text-sm text-slate-1600 mb-1">HP</label>
//                     <input
//                       type="number"
//                       inputMode="numeric"
//                       value={pl.hp}
//                       onChange={(e) => updatePlayer(pl.id, "hp", e.target.value)}
//                       className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
//                     />
//                   </div>
//                 </div>

//                 {/* Perception & AC */}
//                 <div className="grid grid-cols-2 gap-3">
//                   <div className="flex flex-col">
//                     <label className="text-sm text-slate-1600 mb-1">Perception</label>
//                     <input
//                       type="number"
//                       inputMode="numeric"
//                       value={pl.perception}
//                       onChange={(e) => updatePlayer(pl.id, "perception", e.target.value)}
//                       className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
//                     />
//                   </div>

//                   <div className="flex flex-col">
//                     <label className="text-sm text-slate-1600 mb-1">AC</label>
//                     <input
//                       type="number"
//                       inputMode="numeric"
//                       value={pl.ac}
//                       onChange={(e) => updatePlayer(pl.id, "ac", e.target.value)}
//                       className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
//                     />
//                   </div>
//                 </div>
//               </div>
//             </li>
//           ))}
//         </ul>
//       )}

     
//     </div>
//   );
// };

// export default CreateParty;
