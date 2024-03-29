import React, { useState } from 'react'

function CreateAccount() {

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
        // Handle success, maybe redirect the user or show a success message
      } else {
        console.error('Error creating account');
        // Handle error
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }


  return (
    <div className='mx-auto mt-32'>
      <h2 className='text-4xl mb-10 font-bold text-red-950'>Create Account</h2>
      <form action="" className='text-red-400 font-mono text-lg border-2 border-black rounded-md'>
        <div className='flex justify-between gap-2 p-2'>
          <label htmlFor="name">Mortal Name</label>
          <input type="text" id='name' name='name' onChange={handleChange}
          className='w-20'/>
        </div><hr />
        <div className='flex justify-between gap-2 p-2'>
          <label htmlFor="password">Secret Phrase</label>
          <input type="password" name="password" id="password" onChange={handleChange}
          className='w-20'/>
        </div><hr />
        <button type='submit' onClick={handleSubmit} 
        className='bg-slate-500 ml-16 mt-2  p-2 hover:bg-red-200 rounded-xl'>Scribe's Seal</button>
      </form>
    </div>
  )
}

export default CreateAccount