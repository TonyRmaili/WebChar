import React, { useEffect } from 'react'
import useAuthStore from "../store/AuthStore"
import useCharStore from '../store/CharStore'
import { useNavigate } from 'react-router-dom'
import deleteSkull from '../assets/deleteSkull.svg'


function LoadChar() {
  const { token, userData, fetchUser } = useAuthStore()
  const { deleteChar, setCharData, createChar } = useCharStore()
  const navigate = useNavigate()


  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
  }, [token, navigate])

  useEffect(() => {
    if (!userData || !userData.characters || userData.characters.length === 0) {
      navigate('/createChar');
    }
  }, [userData, navigate])

  async function onDeleteChar(charName) {
    try {
     
      const ok = window.confirm(`Delete ${charName}? This cannot be undone.`)
      if (!ok) return

      await deleteChar(charName)
      await fetchUser()

      // clear local selection if it was this one
      const current = JSON.parse(localStorage.getItem("charData"))
      if (current?.name === charName) {
        localStorage.removeItem("charData")
      }

    } catch (e) {
      console.error('Delete failed:', e)
      alert('Delete failed. Please try again.')
    }
  }
  
  async function onCreateChar() {
    const raw = window.prompt("Name your character:");
    const name = (raw || "").trim();

    if (!name) {
      console.log("Creation cancelled or empty name.");
      return;
    }

    try {
      await createChar(name);
      console.log("Character created successfully:", name);
      fetchUser()

    } catch (e) {
      console.error("Failed to create character:", e);
    } 
}


  function onSelectChar(charId) {
    const selected = userData?.characters?.find(c => c.id === charId);
    if (!selected) return;

    // Save to localStorage via store
    setCharData({
      ...selected,
      user_id: userData.id,          // include user id for later API calls
      selectedAt: new Date().toISOString()
    });

    console.log(`Selected: ${selected.name}`);
  }


  return (
  <div className="flex flex-col items-center">
    {/* Action bar */}
    <div className="w-full flex justify-center gap-4 mb-6">
      <button
        type="button"
        onClick={onCreateChar}
        className="px-5 py-2 rounded-md border-2 border-amber-900 bg-gradient-to-r from-emerald-900 to-emerald-700 text-amber-100 font-semibold shadow-[0_0_10px_rgba(16,185,129,0.25)] hover:from-emerald-800 hover:to-emerald-600 transition-all"
      >
        Create Character
      </button>

      
    </div>

    {/* Title */}
    <h2 className="text-2xl font-bold text-amber-200 mb-4 tracking-wide drop-shadow-md">
      Select Characters
    </h2>

    {/* Tokens grid */}
    <div className="flex flex-wrap justify-center">
      {userData?.characters?.length > 0 &&
        userData.characters.map((character) => (
          <div key={character.id ?? character.name} className="m-2 flex flex-col items-center">
             {/* Token */}
              <button
            onClick={() => {}}
            className="m-2 transition-transform hover:scale-105"
          >
            <div className="w-24 h-24 border-4 border-gray-700 bg-gradient-to-b from-gray-100 to-gray-300 rounded-md shadow-md flex items-center justify-center hover:border-indigo-600">
              <p className="font-semibold text-gray-800 text-center px-2">
                {character.name}
              </p>
            </div>
          </button>

          {/* Delete skull button (same width as token) */}
          <button
            type="button"
            aria-label={`Delete ${character.name}`}
            onClick={() => onDeleteChar(character.name)}
            className="w-24 h-8 mt-2 rounded-md bg-red-700 border border-red-900 hover:bg-red-600 active:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400 flex items-center justify-center"
          >
            <img
              src={deleteSkull}
              alt=""
              className="w-4 h-4 mx-auto pointer-events-none"
            />
          </button>

          </div>
        ))}
    </div>
  </div>
);


}

export default LoadChar;
