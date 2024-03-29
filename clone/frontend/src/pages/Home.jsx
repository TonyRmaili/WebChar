import React,{ useState } from "react";
import ListingCards from "../components/Market/ListingCards";
import Filter from "../components/Market/Filter";


function Home() {
  const [filterData, setFilterData] = useState(null);

  const handleFilterChange = (newFilterData) => {
    setFilterData(newFilterData);
  };


  return (
    <div>
      <section className="bg-orange-600  ">
        <div className="py-8 px-4 mx-auto max-w-screen-xl text-center lg:py-16">
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight leading-none text-gray-900 md:text-5xl lg:text-8xl dark:text-white">
            PetZon
          </h1>

          <div className="flex flex-col space-y-4 sm:flex-row sm:justify-center sm:space-y-0 mt-10">
            <a
              href="/register"
              className="inline-flex justify-center items-center py-3 px-5 text-base font-medium text-center text-white rounded-lg bg-cyan-500 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-900"
            >
              Become a member
              <svg
                className="w-3.5 h-3.5 ms-2 rtl:rotate-180"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 14 10"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M1 5h12m0 0L9 1m4 4L9 9"
                />
              </svg>
            </a>
          </div>
        </div>
      </section>
      
      <Filter onFilterChange={handleFilterChange}/>
      <ListingCards filter={filterData}/>
    </div>
  );
}

export default Home;
