import React, { useEffect } from 'react'
import useAuthStore from "../store/AuthStore"
import useCharStore from '../store/CharStore'
import { useNavigate } from 'react-router-dom'

function LoadChar() {
  const { token, userData } = useAuthStore()
  const { deleteChar } = useCharStore()
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
      await deleteChar(charName);
      
    } 
    catch (e) {
      console.error('Delete failed:', e);
     }
  } 
  
  return (
  <div className="flex flex-wrap justify-center">
    {userData && userData.characters && userData.characters.length > 0 &&
      userData.characters.map((character, index) => (
        <button
          key={index}
          onClick={() => onDeleteChar(character.name)}
          className="m-2 transition-transform hover:scale-105"
        >
          <div className="w-24 h-24 border-4 border-gray-700 bg-gradient-to-b from-gray-100 to-gray-300 rounded-md shadow-md flex items-center justify-center hover:border-indigo-600">
            <p className="font-semibold text-gray-800 text-center px-2">{character.name}</p>
          </div>
        </button>
      ))}
  </div>
);

}

export default LoadChar;
