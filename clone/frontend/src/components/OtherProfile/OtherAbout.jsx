import React from "react";
import useAuthStore from "../../stores/store";
import { useEffect } from "react";
import favoriteSVG from "../../svg/heart.svg";
import likeSVG from "../../svg/like.svg";



function OtherAbout({ otherUserData }) {
  const { petData, fetchPet, token } = useAuthStore();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const userId = userData ? userData.id : null;

  useEffect(() => {
    if (token) {
      fetchPet();
      
    }
  }, [token]);

  async function handleFavorite(petId) {
    try {
      if (!userId) {
        // userId doesn't exist in localStorage
        console.error("User ID not found in local storage.");
        return;
      }

      fetch("http://localhost:8000/favorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pet_id: petId, user_id: userId }),
      })
        .then((response) => {
          // Handle response
        })
        .catch((error) => {
          // Handle error
          console.error("Error:", error);
        });
    } catch (error) {
      // Handle any synchronous errors
      console.error("Synchronous Error:", error);
    }
  }

  async function handleLike(){
    try {
      if (!userId) {
        // userId doesn't exist in localStorage
        console.error("User ID not found in local storage.");
        return;
      }

      fetch("http://localhost:8000/likes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ liked_id: otherUserData.id, liker_id: userId }),
      })
        .then((response) => {
          // Handle response
        })
        .catch((error) => {
          // Handle error
          console.error("Error:", error);
        });
    } catch (error) {
      // Handle any synchronous errors
      console.error("Synchronous Error:", error);
    }
  }

  return (
    <div>
       <button onClick={handleLike} className="ml-16">
        <img src={likeSVG} className="h-12"></img>
       </button>
      <div className="flex justify-center bg-white shadow-lg rounded-lg p-2 mx-4 md:mx-auto my-2 max-w-md md:max-w-2xl">
        <div className="w-2/3">
          <div className="justify-center items-center mx-auto border border-black w-full p-2 bg-gray-200 rounded-lg overflow-hidden">
            {otherUserData && petData ? (
              <>
                {petData
                  .filter((pet) => pet.user_id === otherUserData.id)
                  .map((pet, index) => (
                    <div key={index} className="">
                      <div className="border border-black p-2 mb-4 bg-orange-100">
                        <p className="flex justify-between text-lg font-semibold mb-2">
                          <span>
                            {pet.animal} / {pet.name}
                          </span>
                          <span>{pet.gender}</span>
                          <span>Age: {pet.age}</span>
                        </p>
                        <div className="flex justify-center items-center">
                          {pet.pictures && pet.pictures[0] && (
                            <img
                              className="p-2 w-full h-60 object-cover border border-black mb-1 shadow-sm"
                              src={pet.pictures[0].file_path}
                              alt={pet.name}
                              onLoad={() =>
                                console.log("Image loaded:", pet.pictures[0])
                              }
                              onError={() =>
                                console.log(
                                  "Error loading image:",
                                  pet.pictures[0]
                                )
                              }
                            />
                          )}
                        </div>
                        <div className="border border-black p-2 mt-2">
                          <div className="grid grid-cols-2 justify-between items-center gap-8 mb-2 text-sm">
                            <p>Race: {pet.race}</p>
                            <p>Spayed: {pet.spayed}</p>
                          </div>
                          <div className="flex justify-center border border-black p-1 mb-2">
                            <p>"{pet.text}"</p>
                          </div>
                          <button onClick={() => handleFavorite(pet.id)}>
                          <img src={favoriteSVG} className="h-6"></img>
                          </button>
  
                        </div>
                      </div>
                    </div>
                  ))}
              </>
            ) : (
              <p>No pets found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

}

export default OtherAbout;
