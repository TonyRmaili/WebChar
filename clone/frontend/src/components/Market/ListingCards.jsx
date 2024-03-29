import React, { useState, useEffect } from "react";
import Listings from "./Listings";
import { useNavigate, Link } from "react-router-dom";
import useAuthStore from "../../stores/store";
import Pagination from "./Pagination";

function ListingCards({ filter }) {
  const { token } = useAuthStore()
  const navigate = useNavigate()
  const [petData, setPetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filteredPets, setFilteredPets] = useState([]);

  // const file_path = "/app/database/pictures/dog1.avif"

  //Fetch Effects

  // pets
  useEffect(() => {
    fetch("http://localhost:8000/pet")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        setPetData(data);
        setLoading(false);
        console.log(petData);
      })
      .catch((error) => {
        console.error("Error fetching user data:", error);
      });
  }, [filter]);

  // if (petData) {
  //   console.log("petData", petData[1].pictures[0]);
  // }

  // Filter pets based on the animal and gender filters
  useEffect(() => {
    const sendFilterData = async () => {
      if (petData && filter) {
        try {
          const response = await fetch("http://localhost:8000/cards/filter", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(filter),
          });
          if (response.ok) {
            // Handle success, maybe redirect the user or show a success message
            const data = await response.json();

            setFilteredPets(data);
          } else {
            console.error("Error sending filter data", response);
            // Handle error
          }
        } catch (error) {
          console.error("Error:", error);
        }
      }
    };
    sendFilterData();
  }, [petData, filter]);

  // if (filteredPets) {
  //   console.log("filteredPets", filteredPets[0]);
  // }

  if (loading) {
    return <p className="text-center">Loading...</p>;
  }

  // ../../../backend/app/database/pictures/dog1.avif
  // if (userData) {
  //   console.log(userData[0].pictures[0].file_path)
  // }

  return (
    <>
      <div className="flex justify-center">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-10">
          {(filter && filteredPets.length > 0 ? filteredPets.slice(0, 8) : petData.slice(0, 8)).map(
            (pet, index) => (
              <Link key={pet.id} to={token ? `/other/${pet.user["user_name"]}` : null}>
                <div
                  className="bg-gray-200 border border-black rounded-lg overflow-hidden p-2 w-80 hover:bg-orange-400 active:bg-orange-600 focus:outline-none focus:ring focus:ring-orange-300"
                  key={index}>
                  <div className="border border-black mb-2 p-1 bg-orange-50 rounded-lg">
                    <p className="flex justify-between text-lg font-semibold mb-2">
                      <span>{pet.animal} / {pet.name}</span>
                      <span>Age: {pet.age}</span>
                    </p>
                    {pet.pictures && pet.pictures[0] && (
                      <img
                        className="p-2 w-full h-60 object-cover border border-black mb-1 shadow-sm"
                        src={pet.pictures[0].file_path}
                        alt={pet.name}
                        onLoad={() => console.log("Image loaded:", pet.pictures[0])}
                        onError={() => console.log("Error loading image:", pet.pictures[0])}
                      />
                    )}
                    <div className="justify-between border border-black flex p-2 mx-auto text-xs">
                      <p>{pet.gender}</p>
                      <p>{pet.race}</p>
                      <p>{pet.weight}kg</p>
                    </div>
                  </div>
                  <div className='flex flex-box mt-2'>
                    <div className='border border-black w-full p-2 bg-orange-200 rounded-lg'>
                      <Listings
                        user_name={pet.user["user_name"]}
                        type={pet.listing_type}
                        price={pet.price}
                        title={pet.listing_title}
                        text={pet.listing_description}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            )
          )}
        </div>
      </div>
      <div className="flex justify-center mt-4 mb-4">
        <Pagination />
      </div>
    </>
  );
}

export default ListingCards;
