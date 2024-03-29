import React from 'react'
import CreateAccountLogo from "../assets/createAccountLogo.svg"
import { Link } from "react-router-dom"

function LogIn() {

  function handleSubmit(e){
    e.preventDefault()
    console.log("logged in!")
  }

  return (
    <div className='mx-auto mt-32'>
      <h2 className='text-4xl mb-10 ml-16 font-bold text-orange-400'>Log In</h2>
      <form action="" className='text-red-400 font-mono text-lg border-2 border-black rounded-md'>
        <div className='flex justify-between gap-2 p-2'>
          <label htmlFor="name">Mortal Name</label>
          <input type="text" id='name' name='name'
          className='w-20'/>
        </div><hr />
        <div className='flex justify-between gap-2 p-2'>
          <label htmlFor="password">Secret Phrase</label>
          <input type="password" name="password" id="password"
          className='w-20'/>
        </div><hr />
        <button type='submit' onClick={handleSubmit} 
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