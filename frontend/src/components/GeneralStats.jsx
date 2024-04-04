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
    <div className="flex flex-col justify-center items-center gap">
      <div className="text-orange-400 mt-10 flex gap-2">
        <label htmlFor="name" className="w-24 text-right">
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          onChange={handleChange}
          className="w-64"
        />
      </div>
      <div className="text-orange-400 mt-10 flex gap-2">
        <label htmlFor="ac" className="w-24 text-right">
          Armor Class
        </label>
        <input
          type="number"
          id="ac"
          name="ac"
          onChange={handleChange}
          className="w-64"
        />
      </div>
      <div className="text-orange-400 mt-10 flex gap-2">
        <label htmlFor="max_hp">Max Health</label>
        <input type="number" id="max_hp" name="max_hp" onChange={handleChange} />
      </div>

      <div className="text-orange-400 mt-10 flex gap-2">
        <label htmlFor="speed" className="w-24 text-right">
          Speed
        </label>
        <input
          type="number"
          id="speed"
          name="speed"
          onChange={handleChange}
          className="w-64"
        />
      </div>
      <div className="text-orange-400 mt-10 flex gap-2">
        <label htmlFor="race" className="w-24 text-right">
          Race
        </label>
        <input
          type="text"
          id="race"
          name="race"
          onChange={handleChange}
          className="w-64"
        />
      </div>
      <div className="text-orange-400 mt-10 flex gap-2">
        <label htmlFor="languages" className="w-24 text-right">
          Languages
        </label>
        <input
          type="text"
          id="languages"
          name="languages"
          onChange={handleChange}
          className="w-64"
        />
      </div>
      <div className="text-orange-400 mt-10 flex gap-2">
        <label htmlFor="background" className="w-24 text-right">
          Background
        </label>
        <input
          type="text"
          id="background"
          name="background"
          onChange={handleChange}
          className="w-64"
        />
      </div>
    </div>
  );
}

export default GeneralStats;
