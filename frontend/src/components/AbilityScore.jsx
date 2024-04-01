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
    <div className="flex flex-col justify-center">
      
      <div className="flex flex-col justify-center items-center gap">
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="strenght">Strenght</label>
          <input type="number" id="strenght" name="strenght"  onChange={handleChange}/>
          </div>
      </div>
      <div className="flex flex-col justify-center items-center gap">
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="dexterity">Dexterity</label>
          <input type="number" id="dexterity" name="dexterity"  onChange={handleChange}/>
          </div>
      </div>
      <div className="flex flex-col justify-center items-center gap">
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="constitution">Constitution</label>
          <input type="number" id="constitution" name="constitution"  onChange={handleChange}/>
          </div>
      </div>
      <div className="flex flex-col justify-center items-center gap">
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="intelligence">Intelligence</label>
          <input type="number" id="intelligence" name="intelligence"  onChange={handleChange}/>
          </div>
      </div>
      <div className="flex flex-col justify-center items-center gap">
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="wisdom">Wisdom</label>
          <input type="number" id="wisdom" name="wisdom"  onChange={handleChange}/>
          </div>
      </div>
      <div className="flex flex-col justify-center items-center gap">
        <div className="text-orange-400 mt-10 flex gap-2">
          <label htmlFor="charisma">Charisma</label>
          <input type="number" id="charisma" name="charisma"  onChange={handleChange}/>
          </div>
      </div>

    </div>
  )
}

export default AbilityScore