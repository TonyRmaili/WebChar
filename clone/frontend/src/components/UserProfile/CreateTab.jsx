import React, { useState } from "react";
import useAuthStore from "../../stores/store";

function CreateTab() {
  const { userData, token } = useAuthStore();
  const [showText, setShowText] = useState({
    1: true,
    2: true,
    3: true,
    4: true,
  });
  const [selectedImages, setSelectedImages] = useState({
    1: null,
    2: null,
    3: null,
    4: null,
  });

  const [formData, setFormData] = useState({
    name: "",
    gender: "Male",
    age: 0,
    animal: "Dog",
    race: "comming soon",
    listing_type: "sell",
    weight: "",
    spayed: false,
    text: "stuff",
    price: "",
    listing_title: "",
    listing_description: "",
  });

  const [createDataSuccess, setCreateDataSuccess] = useState(false);

  if (!token) {
    console.error("User is not authenticated");
    navigate("/login");
    return null;
  }

  async function handleChange(e) {
    const { name, value } = e.target;
    const parsedValue = name === "age" ? parseInt(value, 10) : value;
    setFormData({
      ...formData,
      [name]: parsedValue,
    });
  }

  async function uploadImages(pet_id, selectedImages) {
    console.log("Pet ID:", pet_id);

    try {
      for (const key in selectedImages) {
        if (selectedImages.hasOwnProperty(key)) {
          const image = selectedImages[key];

          // Check if the current image exists and is not null
          if (image) {
            const formData = new FormData();
            formData.append("image", image);

            const response = await fetch(
              `http://localhost:8000/pet/${pet_id}/upload_image`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
                body: formData,
              }
            );
            if (response.ok) {
              console.log(`Image ${key} uploaded successfully`);
              // Handle success
            } else {
              console.error(`Error uploading image ${key}`);
              // Handle error
            }
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }

  async function submitPetData(e) {
    e.preventDefault();

    const updatedFormData = {
      ...formData,
      // date: new Date().toISOString(),
      user_id: userData.id,
    };
    console.log(updatedFormData);
    try {
      const response = await fetch("http://localhost:8000/pet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedFormData),
      });
      if (response.ok) {
        // Handle success, maybe redirect the user or show a success message
        console.log("new data created successfully");

        const pet_id = await response.json();
        uploadImages(pet_id, selectedImages);
        setCreateDataSuccess(true);
        setTimeout(() => {
          setCreateDataSuccess(false); // Hide the message after 3 seconds
        }, 3000);
      } else {
        console.error("Error submiting new settings");
        // Handle error
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }

  function handleImageChange(event, previewId, pictureIndex) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onloadend = function () {
      const preview = document.getElementById(previewId);
      if (preview) {
        preview.innerHTML = `<img class="h-full w-full object-cover" src="${reader.result}" alt="Preview Image" />`;
        preview.classList.remove("filter", "blur-sm");
        setShowText((prevState) => ({
          ...prevState,
          [pictureIndex]: false,
        }));
        setSelectedImages((prevState) => ({
          ...prevState,
          [pictureIndex]: file,
        }));
      }
    };
    if (file) {
      reader.readAsDataURL(file);
    }
  }

  return (
    <>
      <div className="border flex bg-white shadow-lg rounded-lg mx-4 md:mx-auto my-2 max-w-md md:max-w-2xl">
        <div className="flex items-start px-4 py-4">
          <form method="post" onSubmit={submitPetData}>
            {createDataSuccess && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
                <span className="block sm:inline">Pet data created successfully</span>
              </div>
            )}
            <h2 className="text-2xl text-black font-bold">Create pet: </h2>
            <hr />
            <div className="flex justify-between items-center gap-6 text-xs mb-4 mt-2">
              <div className="flex gap-2">
                <input
                  className="block appearance-none w-32 bg-white border border-gray-300 text-gray-700 p-2 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                  type="text"
                  min="0"
                  name="name"
                  placeholder="Name"
                  onChange={handleChange}
                />
              </div>
              <div className="flex gap-2">
                <select
                  className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 p-2 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                  name="animal"
                  placeholder="Animal"
                  onChange={handleChange}
                >
                  <option value="Dog">Dog</option>
                  <option value="Cat">Cat</option>
                  <option value="Bird">Bird</option>
                </select>
              </div>
              <div className="flex flex-col">
                <select
                  className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 p-2 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                  name="race"
                  placeholder="Race"
                  onChange={handleChange}
                >
                  <option value="comming_soon">Mixed</option>
                </select>
              </div>
              <div className="flex flex-col">
                <select
                  className="block appearance-none w-12 bg-white border border-gray-300 text-gray-700 p-2 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                  name="gender"
                  placeholder="Gender"
                  onChange={handleChange}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  className="block appearance-none w-16 bg-white border border-gray-300 text-gray-700 p-2 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                  type="number"
                  min="0"
                  placeholder="Age"
                  name="age"
                  onChange={handleChange}
                />
              </div>
              <div className="flex gap-2">
                <input
                  className="block appearance-none w-16 bg-white border border-gray-300 text-gray-700 p-2 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                  type="number"
                  min="0"
                  placeholder="weight"
                  name="weight"
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 grid-rows-2 gap-4">
              {[1, 2, 3, 4].map((index) => (
                <div
                  key={index}
                  className="relative overflow-hidden border-2 border-black"
                >
                  <input
                    type="file"
                    name={`file${index}`}
                    id={`file${index}`}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={(e) =>
                      handleImageChange(e, `preview${index}`, index)
                    }
                  />
                  <label
                    htmlFor={`file${index}`}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded cursor-pointer"
                  >
                    Choose Picture {index}
                  </label>
                  <div
                    className="h-[10em] w-[10em] filter blur-sm"
                    id={`preview${index}`}
                  >
                    <img
                      className="h-full w-full object-cover"
                      src="/pictures/cat1.avif"
                      alt="Placeholder"
                    />
                  </div>
                  {showText[index] && (
                    <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                      Picture {index}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <h2 className="text-2xl text-black font-bold mt-10">
              Create listing:{" "}
            </h2>
            <hr />
            <div className="flex justify-between items-center gap-2 text-xs mb-4 mt-2">
              <div className="flex flex-col">
                <select
                  className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 p-2 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                  name="listing_type"
                  placeholder="Listing Type"
                  onChange={handleChange}
                >
                  <option value="sell">Sell</option>
                  <option value="mating">Mating</option>
                  <option value="pet_sitting">Pet Sitting</option>
                </select>
              </div>
              <div className="flex flex-col">
                <select
                  className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 p-2 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                  name="spayed"
                  placeholder="Spayed"
                  onChange={handleChange}
                >
                  <option value="" disabled>
                    Spayed
                  </option>
                  <option value={false}>No</option>
                  <option value={true}>Yes</option>
                </select>
              </div>
              <div className="flex flex-col">
                <input
                  className="block appearance-none w-20 bg-white border border-gray-300 text-gray-700 p-2 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                  type="number"
                  min="0"
                  name="price"
                  placeholder="Price"
                  onChange={handleChange}
                />
              </div>
            </div>
            <label>
              Title:
              <input
                onChange={handleChange}
                className="border p-1 ml-4 max-w-md md:max-w-2xl"
                name="listing_title"
                id="listing_title"
                placeholder="Enter listing title..."
                required
              />
            </label>
            <label className="flex flex-col my-4">
              Listing decription:
              <textarea
                onChange={handleChange}
                className="border p-2 max-w-md md:max-w-2xl"
                name="listing_description"
                id="listing_description"
                placeholder="mjau mjau voff voff..."
                rows={4}
                cols={30}
                required
              />
            </label>
            <hr />
            <div className="flex justify-between p-2">
              <button
                className="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-100 font-medium rounded-lg text-sm px-5 py-2.5 me-2 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:focus:ring-gray-700"
                type="reset"
              >
                Reset
              </button>
              <button
                className="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-100 font-medium rounded-lg text-sm px-5 py-2.5 me-2 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:focus:ring-gray-700"
                onClick={submitPetData}
                type="submit"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default CreateTab;
