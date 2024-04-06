import React, { useEffect, useState } from "react";
import CreatableSelect from "react-select/creatable";
import useCharStore from "../store/CharStore";

function ClassSelection() {
  const { charData, setCharData} = useCharStore()
  const classes = [
    { value: "Artificer", label: "Artificer" },
    { value: "Barbarian", label: "Barbarian" },
    { value: "Bard", label: "Bard" },
    { value: "Cleric", label: "Cleric" },
    { value: "Druid", label: "Druid" },
    { value: "Fighter", label: "Fighter" },
    { value: "Monk", label: "Monk" },
    { value: "Paladin", label: "Paladin" },
    { value: "Ranger", label: "Ranger" },
    { value: "Rogue", label: "Rogue" },
    { value: "Sorcerer", label: "Sorcerer" },
    { value: "Warlock", label: "Warlock" },
    { value: "Wizard", label: "Wizard" },
  ];

  const [selectedClasses, setSelectedClasses] = useState();
  const [selectedClassesLvls, setSelectedClassesLvls] = useState({});

  const colorStyles = {
    control: (styles) => ({ ...styles, backgroundColor: "white" }),
    option: (styles, { data, isDisabled, isFocused, isSelected }) => {
      // console.log("option",data,isFocused,isDisabled,isSelected)
      return { ...styles, color: data.color };
    },
    multiValue: (styles, { data }) => {
      return {
        ...styles,
        backgroundColor: data.color,
        color: "#fff",
      };
    },
    multiValueLabel: (styles, { data }) => {
      return {
        ...styles,
        color: "#fff",
      };
    },
    multiValueRemove: (styles, { data }) => {
      return {
        ...styles,
        color: "#fff",
        cursor: "pointer",
        ":hover": {
          color: "#fff",
        },
      };
    },
  };

  function handleChange(selectedOption, actionMeta) {
    setSelectedClasses(selectedOption);

    // Update selectedClassesLvls
    const updatedSelectedClassesLvls = {};
    selectedOption.forEach(option => {
      updatedSelectedClassesLvls[option.label] = selectedClassesLvls[option.label] || 1;
    });
    setSelectedClassesLvls(updatedSelectedClassesLvls);
  }
  

  const handleInputChange = (inputVale, actionMeta) => {
    console.log("InputChange", inputVale, actionMeta);
  };

  function handleClassLvl(e, name) {
    setSelectedClassesLvls(prevState => {
        return { ...prevState, [name]: Number(e.target.value) };
    });
}

 function handleSaveClass(){
  setCharData({
    ...charData,
    "classes": selectedClassesLvls,
  });
 }
  useEffect(() => {
    console.log(selectedClassesLvls);
  }, [selectedClassesLvls]);

  return (
    <div>
      <CreatableSelect
        options={classes}
        onInputChange={handleInputChange}
        onChange={handleChange}
        isMulti
      />

      {selectedClasses &&
        selectedClasses.length > 0 &&
        selectedClasses.map((classItem, index) => (
          <div key={index} className="flex  justify-between w-60 ">
            <label>{classItem.label}</label>
            <input type="number" defaultValue={1} min={1} className="w-16 mt-2" onChange={(e)=> handleClassLvl(e,classItem.label)}/>
            
          </div>
        ))}
      <button onClick={handleSaveClass}>
        Submit
      </button>

    </div>
  );
}

export default ClassSelection;
