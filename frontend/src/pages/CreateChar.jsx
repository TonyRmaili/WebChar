import React, { useEffect, useReducer, useState } from "react";
import useAuthStore from "../store/AuthStore";
import { useNavigate } from "react-router-dom";

function CreateChar() {
  const { token, userData } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token || !userData) {
      navigate("/login");
    }
  }, [token, userData]);

  const [formData, setFormData] = useState({
    user_id: userData?.id,
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  }

  useEffect(() => {
    console.log(formData);
  }, [formData]);

  // async function handleSubmit(e){
  //   e.preventDefault()

  //   try {
  //     const response = await fetch('http://localhost:8000/create_char', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         Authorization: `Bearer ${token}`,
  //       },
  //       body: JSON.stringify(formData),
  //     });
  //     if (response.ok) {
  //       console.log('char created successfully');
  //       // Handle success, maybe redirect the user or show a success message
  //     } else {
  //       console.error('Error creating char');
  //       // Handle error
  //     }
  //   } catch (error) {
  //     console.error('Error:', error);
  //   }
  // }

  return (
    <div className="flex">
      <h>Character Creation</h>
      <div className="flex flex-col justify-center items-center gap">
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="name">Name</label>
          <input type="text" id="name" name="name" onChange={handleChange} />
        </div>
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="class">Class</label>
          <input type="text" id="class" name="class" onChange={handleChange} />
        </div>
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="level">Level</label>
          <input type="text" id="level" name="level" onChange={handleChange} />
        </div>
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="speed">Speed</label>
          <input type="text" id="speed" name="speed" onChange={handleChange} />
        </div>
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="race">Race</label>
          <input type="text" id="race" name="race" onChange={handleChange} />
        </div>
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="background">Background</label>
          <input
            type="text"
            id="background"
            name="background"
            onChange={handleChange}
          />
        </div>
        
      </div>
      <div className="flex flex-col justify-center items-center gap">
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="name">Name</label>
          <input type="text" id="name" name="name" onChange={handleChange} />
        </div>
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="class">Class</label>
          <input type="text" id="class" name="class" onChange={handleChange} />
        </div>
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="level">Level</label>
          <input type="text" id="level" name="level" onChange={handleChange} />
        </div>
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="speed">Speed</label>
          <input type="text" id="speed" name="speed" onChange={handleChange} />
        </div>
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="race">Race</label>
          <input type="text" id="race" name="race" onChange={handleChange} />
        </div>
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="background">Background</label>
          <input
            type="text"
            id="background"
            name="background"
            onChange={handleChange}
          />
        </div>
      </div>
    </div>
  );
}

export default CreateChar;
