import React, { useEffect, useState } from 'react'
import useAuthStore from '../../store/AuthStore';
import { useNavigate } from 'react-router-dom';
import CreateCharacters from './Create';
import Sheets from './Sheets';



const TOOLS = [
  { id: "create", label: "Create" },
  { id: "sheets", label: "Sheets" },
];


function CharactersMain() {
  const { token, userData, fetchUser } = useAuthStore()
  const navigate = useNavigate()

  const [activeTool, setActiveTool] = useState("create");


  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
  }, [token, navigate])

 

  return (
  <div className="flex flex-col items-center">
    {/* Tab Strip */}
      <div className="mb-4 flex justify-center gap-1 border-b border-slate-700">
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`px-4 h-9 text-sm font-medium rounded-t-md -mb-px border-b-2 transition-colors ${
                isActive
                  ? "text-amber-400 border-amber-500 bg-slate-900/40"
                  : "text-slate-400 hover:text-amber-400 border-transparent"
              }`}
            >
              {tool.label}
            </button>
          );
        })}
      </div>

      <div className="w-full px-4 lg:px-8">
        {activeTool === "create" && <CreateCharacters />}
        {activeTool === "sheets" && <Sheets />}   
      </div>

  </div>
);

}

export default CharactersMain;
