import React from "react";
import { useState } from "react";

function Filter({ onFilterChange }) {
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [animal, setAnimal] = useState("");
  const [gender, setGender] = useState("");

  const handleCountry = (e) => {
    setCountry(e.target.value);
  };
  const handleRegion = (e) => {
    setRegion(e.target.value);
  };
  const handleAnimal = (e) => {
    setAnimal(e.target.value);
  };
  const handleGender = (e) => {
    setGender(e.target.value);
  };
 
  const handleFilter = () => {
    // Package the filter data into an object and pass it to the onSearch callback
    const filters = { country, region, animal, gender };
    onFilterChange(filters);
  };

  const handleReset = () => {
    // setCountry("")
    // setRegion("")
    // setGender("")
    // setAnimal("")
    const filters = { country:"", region:"", animal:"", gender:"" };
    onFilterChange(filters)
  }
    
  

  return (
    <div className="mb-4 flex justify-center gap-6 border border-black p-2">
      <div>
        <p>Country</p>
        <select value={country} onChange={handleCountry}>
          <option value="" disabled>
            Select an option
          </option>
          <option value="Sweden">Sweden</option>
          <option value="Finland">Finland</option>
          <option value="Norway">Norway</option>
        </select>
      </div>
      <div>
        <p>Region</p>
        <select value={region} onChange={handleRegion}>
          <option value="" disabled>
            Select an option
          </option>
          <option value="Stockholm">Stockholm</option>
          <option value="Umeå">Umeå</option>
          <option value="Bålsta">Bålsta</option>
        </select>
      </div>
      <div>
        <p>Animals</p>
        <select value={animal} onChange={handleAnimal}>
          <option value="" disabled>
            Select an option
          </option>
          <option value="Dog">Dog</option>
          <option value="Cat">Cat</option>
          <option value="Bird">Bird</option> 
        </select> 
      </div>
      <div>
        <p>Gender</p>
        <select value={gender} onChange={handleGender}>
          <option value="" disabled>
            Select an option
          </option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </div>
      <div>
        <button className="border-2 border-black p-4 rounded-full bg-red-600"
        onClick={handleFilter}>
            Search
        </button>
      </div>
      <div>
        <button className="border-2 border-black p-4 rounded-full bg-red-600" onClick={handleReset}
        
        >Reset</button> 
      </div>
    </div>
   
  );
}

export default Filter;
