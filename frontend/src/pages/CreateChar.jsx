import React, { useEffect, useReducer, useState } from 'react'
import useAuthStore from "../store/AuthStore"
import { useNavigate } from 'react-router-dom'

function CreateChar() {
  const { token, userData } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!token || !userData) {
      navigate('/login');
    } 
  }, [token, userData]);


  const [formData, setFormData] = useState({
    user_id: userData?.id
  });


  function handleChange(e) {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  }


  async function handleSubmit(e){
    e.preventDefault()
    
    try {
      const response = await fetch('http://localhost:8000/create_char', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        console.log('char created successfully');
        // Handle success, maybe redirect the user or show a success message
      } else {
        console.error('Error creating char');
        // Handle error
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className='text-orange-400 mt-10 flex justify-center gap-2'>
        <label htmlFor="file_path">File path</label>
        <input type="text" id="file_path" name='file_path' onChange={handleChange}/>
        <button type="submit">Submit</button>
      </div>
    </form>
  )
}

export default CreateChar