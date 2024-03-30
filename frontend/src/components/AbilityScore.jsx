import React, {useEffect, useState} from 'react'
import useCharStore from '../store/CharStore';

function AbilityScore() {
  const { charData, setCharData } = useCharStore()

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
          <label htmlFor="strenght">Strenght</label>
          <input type="number" id="strenght" name="strenght"  onChange={handleChange}/>
          </div>
        
        
      </div>

    </div>
  )
}

export default AbilityScore