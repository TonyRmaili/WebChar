import React, { useEffect } from 'react'
import useAuthStore from "../store/AuthStore"
import { useNavigate } from 'react-router-dom'

function LoadChar() {

  const { token ,userData} = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
  }, [token]);

  useEffect(() => {
    if (!userData || !userData.characters || userData.characters.length === 0) {
      navigate('/createChar');
    }
  }, [userData]);


  return (
    <div className="flex flex-wrap justify-center">
      {userData.characters.map((character, index) => (
        <div key={index} className="flex items-center justify-center m-2">
          <div className="w-20 h-20 border-2 border-black rounded-full flex items-center justify-center">
            <p>{character.id}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default LoadChar 