import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import useAuthStore from "../stores/store"

function RegisterForm() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({})
  const [confirmPassword,SetConfirmPassword] = useState()
  const { setToken } = useAuthStore()
 
  async function handlePassword(e){
    SetConfirmPassword(e.target.value)
  }

  async function handleChange(e) {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    console.log(formData)
  }
 
  
  async function loginUser(updatedFormData){
    console.log(updatedFormData.password)
    const formData = new FormData();
    formData.append("username", updatedFormData.email); 
    formData.append("password", updatedFormData.password);
    try {
      const response = await fetch("http://localhost:8000/user/login", {
        method: "POST",
        body: formData,
      });
      
      if (response.status === 200) {
        const data = await response.json();
        setToken(data.access_token)
        navigate("/user");
      } else if (response.status === 400 || response.status === 401) {
        const data = await response.json();
        setServerError(data.detail); // Set server error based on the response
      } else {
        console.log("Login Failed");
        setServerError(
          "An unexpected error occurred. Please try again later."
        );
      }
    } catch (error) {}
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const updatedFormData = {
      ...formData,
      member_since: new Date().toISOString(), // Save current datetime
    };
  
    setFormData(updatedFormData); // Update formData state
  
    if (formData["password"] === confirmPassword) {
      console.log("Passwords are equal")
      try {
        const response = await fetch("http://localhost:8000/user/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatedFormData),
        });
        if (response.ok) {
          // Handle success, maybe redirect the user or show a success message
          console.log("Account created successfully");
          
          loginUser(updatedFormData)
          
        } else {
          console.error("Error creating account");
          // Handle error
        }
      } catch (error) {
        console.error("Error:", error);
      }
    } else {
      console.log("Passwords are not equal")
    }}

  return (
    <div className="mt-40">
      <form className="max-w-md mx-auto">
        <div className="relative z-0 w-full mb-5 group">
          <label
            htmlFor="email"
            className="peer-focus:font-medium absolute text-md text-gray-600 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
          >
            Email address
          </label>
          <input
            type="email"
            name="email"
            id="email"
            onChange={handleChange}
            className="block py-2.5 px-0 w-full text-lg text-black bg-transparent border-0 border-b-2 border-black appearance-none focus:outline-none focus:ring-0 focus:border-blue-400 peer"
            placeholder=" "
            required
          />
        </div>
        <div className="relative z-0 w-full mb-5 group">
          <label
            htmlFor="password"
            className="peer-focus:font-medium absolute text-md text-gray-600 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
          >
            Password
          </label>
          <input
            type="password"
            name="password"
            id="password"
            onChange={handleChange}
            className="block py-2.5 px-0 w-full text-lg text-black bg-transparent border-0 border-b-2 border-black appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer"
            placeholder=" "
            required
          />
        </div>
        <div className="relative z-0 w-full mb-5 group">
          <input
            type="password"
            name="confirmPassword"
            id="confirmPassword"
            onChange={handlePassword}
            className="block py-2.5 px-0 w-full text-lg text-black bg-transparent border-0 border-b-2 border-black appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer"
            placeholder=" "
            required
          />
          <label
            htmlFor="confirmPassword"
            className="peer-focus:font-medium absolute text-md text-gray-600 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
          >
            Confirm password
          </label>
        </div>
        <div className="grid md:grid-cols-2 md:gap-6">
          <div className="relative z-0 w-full mb-5 group">
            <label
              htmlFor="first_name"
              className="peer-focus:font-medium absolute text-md text-gray-600 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
            >
              First name
            </label>
            <input
              type="text"
              name="first_name"
              id="first_name"
              onChange={handleChange}
              className="block py-2.5 px-0 w-full text-lg text-black bg-transparent border-0 border-b-2 border-black appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer"
              placeholder=" "
              required
            />
          </div>
          <div className="relative z-0 w-full mb-5 group">
            <label
              htmlFor="last_name"
              className="peer-focus:font-medium absolute text-md text-gray-600 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
            >
              Last name
            </label>
            <input
              type="text"
              name="last_name"
              id="last_name"
              onChange={handleChange}
              className="block py-2.5 px-0 w-full text-lg text-black bg-transparent border-0 border-b-2 border-black appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer"
              placeholder=" "
              required
            />
          </div>
        </div>
        <div className="grid md:grid-cols-2 md:gap-6">
          <div className="relative z-0 w-full mb-5 group">
            <label
              htmlFor="user_name"
              className="peer-focus:font-medium absolute text-md text-gray-600 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
            >
              Username
            </label>
            <input
              type="text"
              name="user_name"
              id="user_name"
              onChange={handleChange}
              className="block py-2.5 px-0 w-full text-lg text-black bg-transparent border-0 border-b-2 border-black appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer"
              placeholder=" "
              required
            />
          </div>
          {/* <div className="relative z-0 w-full mb-5 group">
            <label
              for="phone_nr"
              className="peer-focus:font-medium absolute text-md text-gray-600 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
            >
              Phone number
            </label>
            <input
              type="tel"
              pattern="[0-9]{3}[0-9]{3}[0-9]{4}"
              name="phone_nr"
              id="phone_nr"
              onChange={handleChange}
              className="block py-2.5 px-0 w-full text-lg text-black bg-transparent border-0 border-b-2 border-black appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer"
              placeholder=" "
              required
            />
          </div> */}
        </div>
        <div>
          <fieldset>
            <legend className="sr-only">Checkbox variants</legend>
            <div className="flex items-center">
              <input
                id="checkbox-1"
                type="checkbox"
                value=""
                className="w-4 h-4 text-blue-600 bg-black border-gray-600 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="checkbox-1"
                className="ms-2 text-sm font-medium text-black-500 "
              >
                I agree to the{" "}
                <a href="#" className="text-blue-500 hover:underline">
                  terms and conditions
                </a>
                .
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="checkbox-2"
                type="checkbox"
                value=""
                className="w-4 h-4 text-blue-600 bg-black border-gray-600 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="checkbox-2"
                className="ms-2 text-sm font-medium text-black"
              >
                I want to get ... offers.
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="checkbox-3"
                type="checkbox"
                value=""
                className="w-4 h-4 text-blue-600 bg-black border-gray-600 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="checkbox-3"
                className="ms-2 text-sm font-medium text-black"
              >
                exampletext.
              </label>
            </div>
          </fieldset>
        </div>
        <div className="flex justify-center items-center">
          <button
            type="submit"
            onClick={handleSubmit}
            className="text-white mt-10 bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}

export default RegisterForm;
