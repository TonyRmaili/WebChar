import React, { useEffect, useState } from "react";
import useCharStore from "../store/CharStore";
import CreatableSelect from "react-select/creatable";

function BioStats() {
  const { charData, setCharData } = useCharStore();
  const [races, setRaces] = useState(null);
  const [subRaces, setSubRaces] = useState(null);
  const [selectedRace, setSelectedRace] = useState(null);
  const [selectedSubRace, setSelectedSubRace] = useState(null);
  const [error, setError] = useState(null);


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
    console.log("selectedRace",selectedRace);
  }, [selectedRace]);

  
  useEffect(() => {
    console.log("subrace",selectedSubRace);
  }, [selectedSubRace]);

  

 
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("http://localhost:8000/races");
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const jsonData = await response.json();
        if (Array.isArray(jsonData) && jsonData.length > 0) {
            // Access each dictionary within the array
            const raceData = jsonData[0]; // First dictionary containing races
            const subraceData = jsonData[1]; // Second dictionary containing subraces
            setRaces(cleanJsonRaces(raceData));
            setSubRaces(cleanSubRaces(subraceData))
        
          } else {
            throw new Error("something went wrong with race data");
          }
        
      } catch (error) {
        setError(error.message);
      }
    };

    fetchData();
    // Cleanup function to cancel the fetch request if the component unmounts or before the effect runs again
    return () => {
      // Cleanup code here if necessary
    };
  }, []); 

  function cleanJsonRaces(jsonData) {
    const uniqueNames = new Set();
  
    const races = jsonData.map((race, index) => {
      let name = race.name;
  
      // Remove parentheses and their contents using a regular expression
      name = name.replace(/\s*\([^)]*\)/g, '');
  
      // Check if the modified name is not already present in the Set
      if (!uniqueNames.has(name)) {
        uniqueNames.add(name);
        return { value: name, label: name };
      }
  
      return null;
    }).filter(race => race !== null);
  
    return races;
  }
  

  function cleanSubRaces(jsonData) {
    // Use map directly without wrapping it in another array
    const races = jsonData.map((race, index) => {
      // Perform any operation on each item here
      return { value: race.raceName, label: race.name}; // Return the desired object
    });
  
    // Return the mapped array
    return races;
  }

  
  
  useEffect(() => {
    function selectSubRaces() {
      if (selectedRace && subRaces) {
        const filteredSubRaces = subRaces.filter(subrace => subrace.value === selectedRace);
        return filteredSubRaces;
      }
      return [];
    }
  
    setSelectedSubRace(selectSubRaces());
  }, [selectedRace, subRaces]);
  


  function handleRaceChange(inputVale, actionMeta){
    setSelectedRace(inputVale.value)
  }


  function handleSubRaceChange(inputVale, actionMeta){
    
    setSelectedSubRace(inputVale.value)
    console.log("sub from handle",selectedSubRace)
  }


  return (
    <div>
        {error && <div>Error: {error}</div>}

        <div className="flex gap-4">
            <p>Race</p>
        { races &&
            <CreatableSelect
            options={races}
            // onInputChange={handleInputChange}
            onChange={handleRaceChange}
            className="w-60"
            
           
        />
         }
         {races && selectedRace && subRaces && selectedSubRace &&
         <div className="flex gap-4">
             <p>SubRace</p>
             <CreatableSelect
             options={selectedSubRace}
             // onInputChange={handleInputChange}
             onChange={handleSubRaceChange}
             className="w-60" />
             </div>
            }
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

export default BioStats;
