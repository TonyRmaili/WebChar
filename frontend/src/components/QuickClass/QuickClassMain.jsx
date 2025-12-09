import React , { useState} from "react";
import useCharStore from "../../store/CharStore";





function QuickClassMain() {
  
  const createQuickClass = useCharStore((s) => s.createQuickClass)
  
  const [prompt, setPrompt] = useState("")

  async function sendPrompt() {
    
    const response = await createQuickClass(prompt) 
    console.log(response)

    setPrompt(response)

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

        <button 
          className="bg-amber-500 p-2 rounded-xl font-semibold"
          onClick={sendPrompt}
        >
          Create Quick Class
        </button>
      </div>
      
    </div>
    
  );

  
}

export default QuickClassMain

