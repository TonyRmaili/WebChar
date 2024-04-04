import React, { useEffect, useRef, useState } from "react";
import useCharStore from "../store/CharStore";

function Test2() {
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
    console.log("classData",classData);
  }, [classData]);

 

  function adjustSelectHeight() {
    if (selectRef.current) {
      selectRef.current.style.height = "auto";
      selectRef.current.style.height = `${selectRef.current.scrollHeight}px`;
    }
  }

  useEffect(() => {
    // When the component mounts, adjust the height of the select element
    adjustSelectHeight();
  }, []);

  const handleClassData = (className, value) => {
    setClassData((prevState) => ({
      ...prevState,
      [className]: value,
    }));
  };

  function handleCustomClass(className,value){
    setCustomClass({
      ...customClass,
      [className]: value,
    });

    setClassData({
      
      [customClass.CustomClass]: customClass.CustomLevel,
    });
  }

  function handleReset(){
    setClassData({})
  }


  return (
    <div className="flex gap-6">
      <div className="text-orange-400 mt-10 flex gap-2 ">
        <label htmlFor="classes" className="w-24 text-right">
          Class
        </label>
        <select
          ref={selectRef}
          id="class"
          name="classes"
          onChange={handleChange}
          multiple
          className="w-36 "
        >
          {classes.map((className, index) => (
            <option key={index} value={className}>
              {className}
            </option>
          ))}
        </select>
        <div className="flex flex-col justify-center">
          <button className="font-bold p-4 border bg-blue-400 text-white rounded-xl"
          onClick={handleReset}>Reset</button>
        </div>
      </div>

      {charData && charData.classes ? (
        <div className="flex flex-col items-center p-10 gap-2">
          {charData.classes.map((item, index) => (
            <div key={index} className="flex gap-2">
              <label htmlFor={`class-${index}`}>{item}</label>
              {item === "Custom" ? (
                <div className="flex gap-2">
                  <input
                    id={`class-${index}-text`}
                    type="text"
                    
                    onChange={(e) => handleCustomClass('CustomClass', e.target.value)}
                  />

                  <input
                    id={`class-${index}-number`}
                    type="number"
                   
                    onChange={(e) => handleCustomClass('CustomLevel', e.target.value)}
                  />
                </div>
              ) : (
                <input
                  id={`class-${index}`}
                  type="number"
                  value={classData[item] || ""}
                  onChange={(e) => handleClassData(item, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default Test2;
