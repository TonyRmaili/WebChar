import React, { useEffect, useState } from "react";
import useAuthStore from '../store/AuthStore';

function GeneralStats() {
    const { token, userData } = useAuthStore();

    function handleChange(e) {
        const { name, value } = e.target;
        setFormData({
          ...formData,
          [name]: value,
        });
      }

      const [formData, setFormData] = useState({
        user_id: userData?.id,
      });
    
      useEffect(() => {
        console.log(formData);
      }, [formData]);


  return (
    <div className="flex justify-center">
      
      <div className="flex flex-col justify-center items-center gap">
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="name">Name</label>
          <input type="text" id="name" name="name"  onChange={handleChange}/>
          </div>
        {/* 
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
        </div> */}
        <div className="flex border-2 border-black rounded-3xl text-white bg-red-500 mt-12 ">
          <button  className="font-bold p-4">
            Save
          </button>
        </div>
      </div>

    </div>
  )
}

export default GeneralStats