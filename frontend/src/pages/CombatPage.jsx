import React, { useEffect, useState } from 'react'
import useAuthStore from "../store/AuthStore"
import { useNavigate } from 'react-router-dom'



function CombatPage() {
  const { token, userData} = useAuthStore()
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
    <div className="justify-center items-center mx-auto w-1/2 min-h-screen mb-2">
      <p className='text-4xl'>CombatPage</p>
      
    </div>
    
  );
}

export default CombatPage;
