import React, { useEffect } from "react";
import useAuthStore from "../../stores/store";

function PetsTab() {
    const { token, userData, fetchUser, petData, fetchPet } = useAuthStore();

    useEffect(() => {
        if (token) {
          fetchUser();
          fetchPet();
        }
      }, [token]);

    return (
        <div className="flex justify-center bg-white shadow-lg rounded-lg p-2 mx-4 md:mx-auto my-2 max-w-md md:max-w-2xl">
            <div className="w-2/3">
                <div className="justify-center items-center mx-auto border border-black w-full p-2 bg-gray-200 rounded-lg overflow-hidden">
                    {userData && petData ? (
                        <>
                            {petData
                                .filter((pet) => pet.user_id === userData.id)
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
    )
}

export default PetsTab