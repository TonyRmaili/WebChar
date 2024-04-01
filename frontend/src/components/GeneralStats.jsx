import React, { useEffect, useState } from "react";
import useCharStore from "../store/CharStore";

function GeneralStats() {
  const { charData, setCharData } = useCharStore();
  
  function handleChange(e) {
    const { name, value } = e.target;
    setCharData({
      ...charData,
      [name]: value,
    });
  }

  
  useEffect(() => {
    console.log(charData);
  }, [charData]);




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
        
        
      </div>

    </div>
  )
}

export default GeneralStats