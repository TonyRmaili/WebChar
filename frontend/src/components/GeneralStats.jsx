import React, { useEffect } from "react";
import useCharStore from "../store/CharStore";



function GeneralStats() {
  const { charData } = useCharStore()
  
  

  return (
    <div className="flex flex-col w-80 gap-4 border p-4 ">
      <div className="flex items-center gap-4">
        <label htmlFor="ac" className="w-24 text-right">
          Armor Class
        </label>
        <input
          type="number"
          id="ac"
          name="ac"
          value= {charData?.ac ?? ""} 
        
          className="flex-1 px-2 py-1 border rounded text-slate-900"
          min={0}
        />
      </div>
      <div className="flex items-center gap-4">
        <label htmlFor="max_hp" className="w-24 text-right">
          Max Hp
        </label>
        <input
          type="number"
          id="max_hp"
          name="max_hp"
          value={charData?.max_hp ?? ""}

          className="flex-1 px-2 py-1 border rounded text-slate-900"
        />
      </div>
      <div className="flex items-center gap-4">
        <label htmlFor="speed" className="w-24 text-right">
          Speed
        </label>
        <input
          type="number"
          id="speed"
          name="speed"
          value={charData?.speed ?? ""}

          className="flex-1 px-2 py-1 border rounded text-slate-900"
          min={0}
        />
      </div>
      <div className="flex items-center gap-4">
        <label htmlFor="pb" className="w-24 text-right">
          Proficiency Bonus
        </label>
        <input
          type="number"
          id="pb"
          name="pb"
          value={charData?.pb ?? ""}
          className="flex-1 px-2 py-1 border rounded text-slate-900"
          min={2}
        />
      </div>
      <div>
      
      </div>
    </div>
  );
  
}

export default GeneralStats;
