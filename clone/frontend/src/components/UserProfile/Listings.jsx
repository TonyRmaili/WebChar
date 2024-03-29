import React, { useEffect } from 'react'
import useAuthStore from '../../stores/store';

function Listings() {
    const { token, userData, fetchUser, fetchPet, petData } = useAuthStore();

    useEffect(() => {
        if (token) {
            fetchUser();
            fetchPet()
        }
    }, [token]);

    return (
        <>
            {userData && petData ? (
                petData.filter(pet => pet.user_id == userData.id)
                    .map((pet, index) => (
                        <div key={index} className="border flex bg-white shadow-lg rounded-lg mx-4 md:mx-auto my-10 max-w-md md:max-w-2xl">
                            <div className="flex items-start px-2 py-4 w-full">
                                {pet.pictures && pet.pictures[0] && (
                                    <img
                                        className="w-40 h-60 rounded-lg object-cover mr-4 shadow"
                                        src={pet.pictures[0].file_path}
                                        alt={pet.name}
                                        onLoad={() => console.log("Image loaded:", pet.pictures[0])}
                                        onError={() => console.log("Error loading image:", pet.pictures[0])}
                                    />
                                )}
                                <div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xl font-bold text-gray-900">Title: </span>
                                        <h2 className="text-lg font-lightbold text-gray-900"> {pet.listing_title} </h2>
                                        <small className="text-sm text-gray-700 ">Type: {pet.listing_type}</small>
                                    </div>
                                    <hr />
                                    <div className='flex items-center justify-between'>
                                        <p className="text-gray-700 text-xs">Posted date: {pet.date}</p>
                                        <small className="text-sm text-gray-700">Price: {pet.price}</small>
                                    </div>
                                    <p className="mt-3 text-black text-md">
                                        <span className='text-xs text-gray-700'>Description: <br /></span>
                                        {pet.listing_description}
                                    </p>
                                    <div className='border p-2 grid grid-cols-3 text-gray-700 justify-between items-center gap-2 text-xs mt-10'>
                                        <p>Name: {pet.name}</p>
                                        <p>Animal: {pet.animal}</p>
                                        <p>Race: {pet.race}</p>
                                        <p>Age: {pet.age}</p>
                                        <p>Gender: {pet.gender}</p>
                                        <p>Weight: {pet.weight} kg</p>
                                        <p>Spayed: {pet.spayed}</p>
                                    </div>

                                    <div className="mt-4 flex justify-end items-center">
                                        <div className="flex mr-4 text-gray-700 text-md ">
                                            <svg fill="none" viewBox="0 0 24 24" className="w-4 h-4 mr-1" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                            </svg>
                                            <span>12</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
            ) : (
                <p>No posts found.</p>
            )}
        </>
    );
}

export default Listings