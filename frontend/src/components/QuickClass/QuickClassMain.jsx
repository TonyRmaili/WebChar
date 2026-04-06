import React , { useState} from "react";
import useCharStore from "../../store/CharStore";


function QuickClassMain() {
  
  const createQuickClass = useCharStore((s) => s.createQuickClass)
  
  const [prompt, setPrompt] = useState("")
  const [charName, setCharName] = useState("")
  const [generatingChar, setGeneratingChar] = useState(false)
  const [response, setResponse] = useState(null);

  async function sendPrompt() {
    setGeneratingChar(true)
    const result = await createQuickClass(prompt,charName)
    setResponse(result)
    setGeneratingChar(false)
    console.log(charName)

  } 

  return (
    <div className="w-full min-h-screen bg-slate-900">

      <div className="flex flex-col items-center mt-4 gap-2">
        <p className="text-amber-500 text-xl">Who are you?</p>

        <textarea 
          className="w-1/3 h-20 rounded-lg p-2"
          value={prompt}                    
          onChange={(e) => setPrompt(e.target.value)}   
        >
        </textarea>
 
        <input 
          type="text" 
          value={charName}
          placeholder="Character Name"
          onChange={(e) => setCharName(e.target.value)}
          className="rounded-lg px-2"
        />
       
        <button 
          className="bg-amber-500 p-2 rounded-xl font-semibold"
          onClick={sendPrompt}
          disabled={generatingChar}
        >
          Create Quick Class
        </button>
      </div>
      
    <div className="py-6 px-32">
        <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-6 shadow-lg">
          {response && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-10">
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Max HP
                </label>
                <input
                  type="number"
                  value={response.max_hp ?? ""}
                  onChange={(e) =>
                    setResponse({
                      ...response,
                      max_hp: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                />
              </div>
              
              
            </div>
          )}
        </div>
      </div>

    </div>
    
  );

}
export default QuickClassMain



// Claude first try
// import React, { useState } from "react";
// import useCharStore from "../../store/CharStore";
// import CharacterOverview from "./CharacterOverview";


// function QuickClassMain() {
//   const createQuickClass = useCharStore((s) => s.createQuickClass);

//   const [prompt, setPrompt] = useState("");
//   const [charName, setCharName] = useState("");
//   const [generatingChar, setGeneratingChar] = useState(false);
//   const [charData, setCharData] = useState(null);

//   async function sendPrompt() {
//     setGeneratingChar(true);
//     setCharData(null);
//     try {
//       const response = await createQuickClass(prompt, charName);
//       if (response) {
//         setCharData(response);
//       }
//     } catch (err) {
//       console.error("Failed to generate character:", err);
//     }
//     setGeneratingChar(false);
//   }

//   function handleReset() {
//     setCharData(null);
//     setPrompt("");
//     setCharName("");
//   }

//   return (
//     <div className="w-full min-h-screen bg-slate-900 text-slate-100">
      
//       {/* ── Prompt Section ── */}
//       <div className="flex flex-col items-center pt-6 gap-3 px-4">
//         <p className="text-amber-500 text-xl font-semibold">Who are you?</p>

//         <textarea
//           className="w-full max-w-lg h-24 rounded-lg p-3 bg-slate-800 border border-slate-600 text-slate-100
//                      placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 resize-y"
//           value={prompt}
//           onChange={(e) => setPrompt(e.target.value)}
//           placeholder="Describe your character concept..."
//         />

//         <div className="flex items-center gap-4">
//           <label className="text-amber-500 text-sm">Character Name</label>
//           <input
//             type="text"
//             value={charName}
//             onChange={(e) => setCharName(e.target.value)}
//             className="rounded-lg px-3 py-1.5 bg-slate-800 border border-slate-600 text-slate-100
//                        focus:outline-none focus:border-amber-500/60"
//             placeholder="Optional"
//           />
//         </div>

//         <div className="flex gap-3">
//           <button
//             className="bg-amber-500 hover:bg-amber-400 disabled:bg-slate-600 disabled:text-slate-400
//                        px-5 py-2 rounded-xl font-semibold text-slate-900 transition-colors"
//             onClick={sendPrompt}
//             disabled={generatingChar}
//           >
//             {generatingChar ? "Generating..." : "Create Quick Class"}
//           </button>

//           {charData && (
//             <button
//               className="border border-slate-600 hover:border-slate-500 px-4 py-2 rounded-xl text-slate-300 hover:text-slate-100 transition-colors"
//               onClick={handleReset}
//             >
//               Start Over
//             </button>
//           )}
//         </div>

//         {generatingChar && (
//           <div className="flex items-center gap-2 mt-2">
//             <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
//             <span className="text-slate-400 text-sm">AI is crafting your character...</span>
//           </div>
//         )}
//       </div>

//       {/* ── Character Overview ── */}
//       {charData && (
//         <div className="mt-8 px-4">
//           <CharacterOverview data={charData} onChange={setCharData} />

//           {/* Save / Export actions */}
//           <div className="max-w-4xl mx-auto flex justify-center gap-4 py-6">
//             <button
//               className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2 rounded-xl font-semibold text-white transition-colors"
//               onClick={() => {
//                 console.log("Character data to save:", charData);
//                 // TODO: hook up save endpoint
//               }}
//             >
//               Save Character
//             </button>
//             <button
//               className="border border-slate-600 hover:border-slate-500 px-5 py-2 rounded-xl text-slate-300 hover:text-slate-100 transition-colors"
//               onClick={() => {
//                 const blob = new Blob([JSON.stringify(charData, null, 2)], { type: "application/json" });
//                 const url = URL.createObjectURL(blob);
//                 const a = document.createElement("a");
//                 a.href = url;
//                 a.download = `${charData?.general?.character_name || "character"}.json`;
//                 a.click();
//                 URL.revokeObjectURL(url);
//               }}
//             >
//               Export JSON
//             </button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default QuickClassMain;
