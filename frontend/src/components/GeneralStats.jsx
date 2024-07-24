import React, { useEffect } from "react";
import useCharStore from "../store/CharStore";

function GeneralStats() {
  const { charData, setCharData } = useCharStore();

  function handleChange(e) {
    const { name, value, options } = e.target;

    const selectedValues = options ? getSelectedValues(options) : value;
    setCharData({
      ...charData,
      [name]: selectedValues,
    });
  }

  function getSelectedValues(options) {
    return Array.from(options)
      .filter((option) => option.selected)
      .map((option) => option.value);
  }

  useEffect(() => {
    console.log(charData);
  }, [charData]);



  return (
    <div className="flex flex-col w-80 gap-4 border p-4">
      <div className="flex items-center gap-4">
        <label htmlFor="name" className="w-20 text-right">
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          onChange={handleChange}
          className="flex-1 px-2 py-1 border rounded"
        />
      </div>
      <div className="flex items-center gap-4">
        <label htmlFor="ac" className="w-24 text-right">
          Armor Class
        </label>
        <input
          type="number"
          id="ac"
          name="ac"
          onChange={handleChange}
          className="flex-1 px-2 py-1 border rounded"
          min={0}
        />
      </div>
      <div className="flex items-center gap-4">
        <label htmlFor="max_hp" className="w-24 text-right">
          Max Health
        </label>
        <input
          type="number"
          id="max_hp"
          name="max_hp"
          onChange={handleChange}
          className="flex-1 px-2 py-1 border rounded"
        />
      </div>
      <div className="flex items-center gap-4">
        <label htmlFor="speed" className="w-24 text-right">
          Speed
        </label>
        <input
          type="number"
          id="speed"
          name="speed"
          onChange={handleChange}
          className="flex-1 px-2 py-1 border rounded"
          min={0}
        />
      </div>
      <div className="flex items-center gap-4">
        <label htmlFor="pb" className="w-24 text-right">
          Proficiency Bonus
        </label>
        <input
          type="number"
          id="pb"
          name="pb"
          onChange={handleChange}
          className="flex-1 px-2 py-1 border rounded"
          min={2}
        />
      </div>
      <div>
      
      </div>
    </div>
  );
  
}

export default GeneralStats;
