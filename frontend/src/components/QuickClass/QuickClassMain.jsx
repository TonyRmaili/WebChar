import React , { useState} from "react";
import useCharStore from "../../store/CharStore";





function QuickClassMain() {
  
  const createQuickClass = useCharStore((s) => s.createQuickClass)
  
  const [prompt, setPrompt] = useState("")
  const [charName, setCharName] = useState("")
  const [generatingChar, setGeneratingChar] = useState(false)

  async function sendPrompt() {
    setGeneratingChar(true)
    const response = await createQuickClass(prompt,charName)
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

        <div className="flex gap-12">
          <p className="text-amber-500">
            File/Character Name
          </p>
          <input 
          type="text" 
          value={charName}
          onChange={(e) => setCharName(e.target.value)}
          className="rounded-lg px-2"
          />
        </div>

        <button 
          className="bg-amber-500 p-2 rounded-xl font-semibold"
          onClick={sendPrompt}
          disabled={generatingChar}
        >
          Create Quick Class
        </button>
      </div>
      
    </div>
    
  );

  
}

export default QuickClassMain

