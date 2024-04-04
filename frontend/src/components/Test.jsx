import React, { useEffect, useRef, useState } from "react";
import useCharStore from "../store/CharStore";

function Test() {
  const selectRef = useRef(null);
  const { charData, setCharData } = useCharStore();
  const [classData, setClassData] = useState({});
  const [customClass, setCustomClass] = useState({})
  const classes = [
    "Artificer",
    "Barbarian",
    "Bard",
    "Cleric",
    "Druid",
    "Fighter",
    "Monk",
    "Paladin",
    "Ranger",
    "Rogue",
    "Sorcerer",
    "Warlock",
    "Wizard",
    "Custom",
  ];

  
  function getSelectedValues(options) {
    return Array.from(options)
      .filter((option) => option.selected)
      .map((option) => option.value);
  }

  function adjustSelectHeight() {
    if (selectRef.current) {
      selectRef.current.style.height = "auto";
      selectRef.current.style.height = `${selectRef.current.scrollHeight}px`;
    }
  }

  useEffect(() => {
    adjustSelectHeight();
  }, []);


  useEffect(() => {
    console.log("classData",classData);
  }, [classData]);

  useEffect(() => {
    console.log("charData",charData);
  }, [charData]);

 
  return (
    <div className="flex gap-6">
      <div className="text-orange-400 mt-10 flex gap-2 ">
        <label htmlFor="classes" className="w-24 text-right">
          Class
        </label>
      
        <div className="flex flex-col justify-center gap-6">
          <button className="font-bold p-4 border bg-blue-400 text-white rounded-xl"
          >Add</button>

          <button className="font-bold p-4 border bg-blue-400 text-white rounded-xl"
          >Reset</button>
        </div>
      </div>

    </div>
  );
}

export default Test;
