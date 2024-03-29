import React, { useEffect } from 'react'
import useAuthStore from "../store/AuthStore"
import { useNavigate } from 'react-router-dom'

function DiceTower() {
  const { token } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
  }, [token]);

  return (
    <div>DiceTower page</div>
  )
}

export default DiceTower