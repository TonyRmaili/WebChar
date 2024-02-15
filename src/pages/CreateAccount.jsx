import React from 'react'

function CreateAccount() {

  function handleSubmit(e){
    e.preventDefault()
    console.log("created account!")
  }


  return (
    <div className='mx-auto mt-32'>
      <h2 className='text-4xl mb-10 font-bold text-red-950'>Create Account</h2>
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
    </div>
  )
}

export default CreateAccount