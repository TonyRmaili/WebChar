import React from "react";
import { useState } from "react";

function Filter({ onFilterChange }) {
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [animal, setAnimal] = useState("");
  const [gender, setGender] = useState("");
  const [category, setCategory] = useState("");

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
  const handleCategory = (e) => {
    setCategory(e.target.value);
  };

  const handleFilter = () => {
    // Package the filter data into an object and pass it to the onSearch callback
    const filters = { country, region, animal, gender, category };
    onFilterChange(filters);
  };

  const handleReset = () => {
    // setCountry("")
    // setRegion("")
    // setGender("")
    // setAnimal("")
    const filters = { country: "", region: "", animal: "", gender: "", category: "" };
    onFilterChange(filters)
  }



  return (
    <div className="mb-4 flex justify-center gap-6 border-b border-black p-2 py-4">
      <div className="flex justify-between items-center gap-5 text-lg">
        <div>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>

        </div>
        <div>
          <select
            className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 p-2 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
            value={country}
            onChange={handleCountry}>
            <option value="" disabled>Country</option>
            <option value="Sweden">Sweden</option>
            <option value="Finland">Finland</option>
            <option value="Norway">Norway</option>
          </select>
        </div>
        <div>
          <select
            className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 p-2 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
            value={region} onChange={handleRegion}>
            <option value="" disabled>
              Region
            </option>
            <option value="Stockholm">Stockholm</option>
            <option value="Umeå">Umeå</option>
            <option value="Bålsta">Bålsta</option>
          </select>
        </div>
        <div>
          <select
            className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 p-2 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
            value={animal} onChange={handleAnimal}>
            <option value="" disabled>
              Animal
            </option>
            <option value="Dog">Dog</option>
            <option value="Cat">Cat</option>
            <option value="Bird">Bird</option>
          </select>
        </div>
        <div>
          <select
            className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 p-2 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
            value={gender} onChange={handleGender}>
            <option value="" disabled>
              Gender
            </option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
        <div>
          <select
            className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 p-2 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
            value={category} onChange={handleCategory}>
            <option value="" disabled>
              Category
            </option>
            <option value="mate">Mating</option>
            <option value="mate">Sell</option>
            <option value="mate">Pet sitter</option>
            <option value="mate">Others</option>
          </select>
        </div>
      </div>
      <div className="flex justify-between items-center gap-2 text-md">
        <div>
          <button
            className="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-100 font-medium rounded-lg text-sm px-5 py-2.5 me-2 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:focus:ring-gray-700"
            onClick={handleFilter}>
            Search
          </button>
        </div>
        <div>
          <button
            className="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-100 font-medium rounded-lg text-sm px-5 py-2.5 me-2 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:focus:ring-gray-700"
            onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>
    </div>

  );
}

export default Filter;
