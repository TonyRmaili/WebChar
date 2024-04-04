import React, { useEffect, useState } from "react";

function TestClasses() {
  const [classValues, setClassValues] = useState({});

  function handleChange(e) {
    const selectedClassName = e.target.value;

    if (selectedClassName !== "Custom"){
        const selectedNumber = parseInt(prompt(`Enter class level for ${selectedClassName}:`));
        if (!isNaN(selectedNumber)) {
          setClassValues((prevClassValues) => ({
            ...prevClassValues,
            [selectedClassName]: selectedNumber,
          }));
        }
    } else{
        const newClassName =prompt(`Enter custom Class Name`);
        const selectedNumber = parseInt(prompt(`Enter class level for ${selectedClassName}:`));
        if (!isNaN(selectedNumber)) {
            setClassValues((prevClassValues) => ({
              ...prevClassValues,
              [newClassName]: selectedNumber,
            }));
          }
    }

  }

  function handleReset() {
    setClassValues({});
  }

  useEffect(() => {
    console.log(classValues);
  }, [classValues]);

  return (
    <div className="">
      <p className="text-orange-500 text-xl mb-6">Select a Class(es)</p>
      <select name="classes" id="classes" multiple onChange={handleChange} className="h-80 w-32">
        <option value="Artificer">Artificer</option>
        <option value="Barbarian">Barbarian</option>
        <option value="Bard">Bard</option>
        <option value="Cleric">Cleric</option>
        <option value="Druid">Druid</option>
        <option value="Fighter">Fighter</option>
        <option value="Monk">Monk</option>
        <option value="Paladin">Paladin</option>
        <option value="Ranger">Ranger</option>
        <option value="Rogue">Rogue</option>
        <option value="Sorcerer">Sorcerer</option>
        <option value="Warlock">Warlock</option>
        <option value="Wizard">Wizard</option>
        <option value="Custom">Custom</option>
      </select>
      <button className="font-bold p-4 border bg-blue-400 text-white rounded-xl" onClick={handleReset}>Reset</button>
    </div>
  );
}

export default TestClasses;
