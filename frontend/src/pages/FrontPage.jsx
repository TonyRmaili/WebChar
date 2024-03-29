import React, { useEffect } from 'react'
import useAuthStore from "../store/AuthStore"
import { useNavigate } from 'react-router-dom'

function FrontPage() {

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


  return <p className="text-4xl text-center">FrontPage</p>;
}

export default FrontPage;
