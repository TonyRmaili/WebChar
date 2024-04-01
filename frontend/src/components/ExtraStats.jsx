import React, { useEffect, useState } from "react";
import useCharStore from "../store/CharStore";

function ExtraStats() {
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
    <div className="text-orange-400 mt-10 flex gap-2">
      <label htmlFor="max_hp">Max Health</label>
      <input type="text" id="max_hp" name="max_hp" onChange={handleChange} />
    </div>
  );
}

export default ExtraStats;
