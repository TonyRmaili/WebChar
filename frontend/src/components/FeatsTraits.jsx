import React, { useEffect, useState } from "react";
import useCharStore from "../store/CharStore";

function FeatsTraits() {
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
      <p>Add feat</p>
    </div>
  );
}

export default FeatsTraits;
