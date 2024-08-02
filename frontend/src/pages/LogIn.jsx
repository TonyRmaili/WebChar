import React,  { useState } from 'react'
import CreateAccountLogo from "../assets/createAccountLogo.svg"
import { Link, useNavigate } from "react-router-dom"
import useAuthStore from '../store/AuthStore';

function LogIn() {
  const navigate = useNavigate()
  const { token, setToken, fetchUser,fetchChars} = useAuthStore()
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
 
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
        
        navigate("/")

      } else if (response.status === 400 || response.status === 401) {
        const data = await response.json();
        console.log(data)
      } else {
        console.log("Login Failed");
      }
    } catch (error) {}   
  }

  return (
    <div className='mx-auto mt-32'>
      <h2 className='text-4xl mb-10 ml-16 font-bold text-orange-400'>Log In</h2>
      <form action="" className='text-red-400 font-mono text-lg border-2 border-black rounded-md'>
        <div className='flex justify-between gap-2 p-2'>
          <label htmlFor="username">Mortal Name</label>
          <input type="text" id='username' name='username' onChange={(e) => setName(e.target.value)}
          className='w-20'/>
        </div><hr />
        <div className='flex justify-between gap-2 p-2'>
          <label htmlFor="password">Secret Phrase</label>
          <input type="password" name="password" id="password" onChange={(e) => setPassword(e.target.value)}
          className='w-20'/>
        </div><hr />
        <button type='submit' onClick={submitLogin} 
        className='bg-slate-500 ml-16 mt-2  p-2 hover:bg-red-200 rounded-xl'>Scribe's Seal</button>
      </form>
      <Link to="/createAccount" className="flex  items-center">
        <img src={CreateAccountLogo} className="h-12" />
        <p>Create Account</p>
      </Link>
    </div>
    
  )
}

export default LogIn 