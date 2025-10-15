import React,  { useState } from 'react'
import CreateAccountLogo from "../assets/createAccountLogo.svg"
import { Link, useNavigate } from "react-router-dom"
import useAuthStore from '../store/AuthStore';
import { PartyStore } from '../store/PartyStore';

function LogIn() {
  const navigate = useNavigate()
  const { token, setToken, fetchUser, fetchChars} = useAuthStore()
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const { fetchParty } = PartyStore()
 
  async function submitLogin(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append("username", name) 
    formData.append("password", password)
    
    try {
      const response = await fetch("http://localhost:8000/login", {
        method: "POST",
        body: formData
      });
       
      if (response.status === 200) {
        console.log("login success!")
        const data = await response.json();
        setToken(data.access_token)
        await fetchUser()
        await fetchParty()

        navigate("/loadChar")

      } else if (response.status === 400 || response.status === 401) {
        const data = await response.json();
        console.log(data)
      } else {
        console.log("Login Failed");
      }
    } catch (error) {}   
  }

  return (
  <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-stone-900 via-stone-800 to-stone-950">
    <div className="w-full max-w-md bg-gradient-to-b from-stone-700 via-stone-800 to-stone-900 border-4 border-amber-900 rounded-lg shadow-[0_0_20px_rgba(139,92,246,0.3)] p-8">
      <h2 className="text-4xl mb-8 text-center font-bold text-amber-200 drop-shadow-[0_0_5px_#451a03]">
        Log In
      </h2>

      <form
        onSubmit={submitLogin}
        className="text-amber-100 font-serif text-lg border-2 border-amber-800 bg-gradient-to-b from-amber-100/5 to-amber-950/10 rounded-md p-4 shadow-inner"
      >
        <div className="flex flex-col gap-3 mb-4">
          <label htmlFor="username" className="font-semibold text-amber-300">
            Mortal Name
          </label>
          <input
            type="text"
            id="username"
            name="username"
            onChange={(e) => setName(e.target.value)}
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
            onChange={(e) => setPassword(e.target.value)}
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

      <Link
        to="/createAccount"
        className="flex items-center justify-center mt-6 text-amber-200 hover:text-red-400 transition-colors"
      >
        <img src={CreateAccountLogo} className="h-10 mr-2" alt="Create Account" />
        <p>Create Account</p>
      </Link>
    </div>
  </div>
);


}

export default LogIn 