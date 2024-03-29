import React, { useState } from "react";
import useAuthStore from "../../stores/store";
import { useNavigate } from "react-router-dom";

function SettingsTab() {
  const { token, userData, fetchUser } = useAuthStore();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({})
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [noDataToUpdate, setNoDataToUpdate] = useState(false);
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [passwordsMatch, setPasswordsMatch] = useState(true);

  if (!token) {
    console.error("User is not authenticated");
    navigate("/login");
    return;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  } 

  async function submitNewSettings(e) {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      console.error("Passwords do not match");
      setPasswordsMatch(false);
      return;
    } else {
      setPasswordsMatch(true); // Reset passwordsMatch to true if passwords match
    }

    if (Object.keys(formData).length === 0) {
      setNoDataToUpdate(true); // Set no data to update message to be visible
      setTimeout(() => {
        setNoDataToUpdate(false); // Hide the message after 3 seconds
      }, 3000);
      return;
    }

    try {
      const usernameCheckResponse = await fetch(
        'http://localhost:8000/check-username?username=' + encodeURIComponent(formData.user_name), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      if (!usernameCheckResponse.ok) {
        console.error("Error checking username availability");
        return;
      }

      const usernameCheckData = await usernameCheckResponse.json();
      if (usernameCheckData.exists) {
        setUsernameTaken(true);
        setTimeout(() => {
          setUsernameTaken(false);
        }, 3000);
        return;
      }

      const response = await fetch("http://localhost:8000/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        // Handle success, maybe redirect the user or show a success message
        console.log("New data created successfully");
        useAuthStore.setState((state) => ({
          ...state,
          userData: {
            ...state.userData,
            ...formData, // Update only the fields that were changed
          },
        }));
        setUpdateSuccess(true);
        setTimeout(() => {
          setUpdateSuccess(false); // Hide the message after 3 seconds
        }, 3000);
      } else {
        const data = await response.json();
        if (response.status === 422 && data.error === "UsernameTaken") {
          setUsernameTaken(true);
          setTimeout(() => {
            setUsernameTaken(false);
          }, 3000);
        } else {
          console.error("Error submiting new settings");
          // Handle error
        }
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <form className="max-w-lg mx-auto">
        {updateSuccess && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">Update successful</span>
          </div>
        )}
        {noDataToUpdate && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">No data to update</span>
          </div>
        )}
        {usernameTaken && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">Username is already taken</span>
          </div>
        )}
        {!passwordsMatch && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">Passwords do not match</span>
          </div>
        )}
        <div className="space-y-4">
          <div className="mb-5">
            <label htmlFor="user_name" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Username:</label>
            <input className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              type="text"
              name="user_name"
              id="user_name"
              placeholder={userData.user_name}
              onChange={handleChange} />
          </div>
          <div className="mb-5">
            <label htmlFor="first_name" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">First name:</label>
            <input className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              type="text"
              name="first_name"
              id="first_name"
              placeholder={userData.first_name}
              onChange={handleChange} />
          </div>
          <div className="mb-5">
            <label htmlFor="last_name" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Last name:</label>
            <input className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              type="text"
              name="last_name"
              id="last_name"
              placeholder={userData.last_name}
              onChange={handleChange} />
          </div>
          <div className="mb-5">
            <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">New Password:</label>
            <input className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              type="password"
              name="password"
              id="password"
              placeholder="Enter new password"
              onChange={handleChange} />
          </div>
          <div className="mb-5">
            <label htmlFor="confirmPassword" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Confirm Password:</label>
            <input className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              type="password"
              name="confirmPassword"
              id="confirmPassword"
              placeholder="Enter new password"
              onChange={handleChange} />
          </div>
          <div className="mb-5">
            <label htmlFor="phone_nr" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Phone Number:</label>
            <input className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              type="tel"
              name="phone_nr"
              id="phone_nr"
              placeholder={userData.phone_nr}
              onChange={handleChange} />
          </div>
          <div className="mb-5">
            <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Email:</label>
            <input className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              type="email"
              name="email"
              id="email"
              placeholder={userData.email}
              onChange={handleChange} />
          </div>
          <div className="mb-5">
            <label htmlFor="adress" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Adress:</label>
            <input className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              type="text"
              name="adress"
              id="adress"
              placeholder={userData.adress}
              onChange={handleChange} />
          </div>
        </div>
        <button
          type="submit"
          onClick={submitNewSettings}
          className="flex justify-center items-center mx-auto text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-100 font-medium rounded-lg p-4 mt-6 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:focus:ring-gray-700 transition duration-300"
        >
          Save
        </button>
      </form>
    </div>
  );

}

export default SettingsTab;
