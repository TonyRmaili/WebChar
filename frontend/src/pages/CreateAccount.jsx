import React, { useState } from 'react'
import useAuthStore from '../store/AuthStore';
import { useNavigate } from 'react-router-dom';

function CreateAccount() {
  const navigate = useNavigate()
  const { fetchUser, setToken } = useAuthStore()
  const [formData, setFormData] = useState({
    name: '',
    password: ''
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  }

  async function autoLogIn(name,password){
    const newFormData = new FormData();
    newFormData.append("username", name) 
    newFormData.append("password", password)

    try {
      const response = await fetch("http://localhost:8000/login", {
        method: "POST",
        body: newFormData
      });
      
      if (response.status === 200) {
        console.log("login success!")
        const data = await response.json();
        setToken(data.access_token)
        await fetchUser()
        navigate("/loadChar")

      } else if (response.status === 400 || response.status === 401) {
        const data = await response.json();
        console.log(data)
      } else {
        console.log("Login Failed");
      }
    } catch (error) {}   
  }

  async function handleSubmit(e) {
    e.preventDefault()
    console.log(formData)
    try {
      const response = await fetch('http://localhost:8000/create_account', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        console.log('Account created successfully');
        autoLogIn(formData.name,formData.password)
      } else {
        console.error('Error creating account');
        // Handle error
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }


  return (
  <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-stone-900 via-stone-800 to-stone-950">
    <div className="w-full max-w-md bg-gradient-to-b from-stone-700 via-stone-800 to-stone-900 border-4 border-amber-900 rounded-lg shadow-[0_0_20px_rgba(139,92,246,0.3)] p-8">
      <h2 className="text-4xl mb-8 text-center font-bold text-amber-200 drop-shadow-[0_0_5px_#451a03]">
        Create Account
      </h2>

      <form
        onSubmit={handleSubmit}
        className="text-amber-100 font-serif text-lg border-2 border-amber-800 bg-gradient-to-b from-amber-100/5 to-amber-950/10 rounded-md p-4 shadow-inner"
      >
        <div className="flex flex-col gap-3 mb-4">
          <label htmlFor="name" className="font-semibold text-amber-300">
            Mortal Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            onChange={handleChange}
            className="w-full border border-amber-700 rounded-md px-3 py-2 bg-stone-800 text-amber-100 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
          />
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <label htmlFor="email" className="font-semibold text-amber-300">
            Scroll Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            onChange={handleChange}
            className="w-full border border-amber-700 rounded-md px-3 py-2 bg-stone-800 text-amber-100 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
          />
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <label htmlFor="password" className="font-semibold text-amber-300">
            Secret Phrase
          </label>
          <input
            type="password"
            id="password"
            name="password"
            onChange={handleChange}
            className="w-full border border-amber-700 rounded-md px-3 py-2 bg-stone-800 text-amber-100 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-red-900 to-red-700 text-amber-100 font-semibold py-2 rounded-md hover:from-red-800 hover:to-red-600 transition-all shadow-[0_0_10px_rgba(255,0,0,0.4)]"
        >
          Scribe’s Seal
        </button>
      </form>
    </div>
  </div>
);

}

export default CreateAccount