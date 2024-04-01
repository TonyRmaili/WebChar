import React, { useEffect } from 'react'
import useAuthStore from "../store/AuthStore"
import useCharStore from '../store/CharStore'
import { useNavigate } from 'react-router-dom'

function LoadChar() {
  const { token, userData } = useAuthStore()
  const { fetchChar, setCharData } = useCharStore()
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

  async function selectChar(character) {
    console.log(character.id)
    console.log(character.file_path)
    setCharData(null)
    fetchChar(character)
  }

  return (
    <div className="flex flex-wrap justify-center">
      {userData && userData.characters && userData.characters.length > 0 &&
        userData.characters.map((character, index) => (
          <button key={index} onClick={() => selectChar(character)}>
            <div className="flex items-center justify-center m-2">
              <div className="w-20 h-20 border-2 border-black rounded-full flex items-center justify-center">
                <p>{character.name}</p>
              </div>
            </div>
          </button>
        ))}
    </div>
  );
}

export default LoadChar;
