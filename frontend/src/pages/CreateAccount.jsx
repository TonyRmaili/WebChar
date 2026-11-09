import React, { useState } from 'react'
import useAuthStore from '../store/AuthStore';
import { useNavigate } from 'react-router-dom';
import { AuthCard, AuthError, AuthField, sealBtn } from './AuthCard';

function CreateAccount() {
  const navigate = useNavigate()
  const { createAccount, logIn, busy, error } = useAuthStore()
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
    const success = await logIn(name,password)

    if (success) {
      navigate("/CharactersMain");
    }

  }

  async function handleSubmit(e) {
    e.preventDefault()
    
    const success = await createAccount(formData);

    if (success) {
      await autoLogIn(formData.name,formData.password)
    }
  }


  return (
    <AuthCard title="Create Account">
      <form onSubmit={handleSubmit}>
        <AuthField id="name" name="name" type="text" label="Mortal Name" autoComplete="username" onChange={handleChange} />
        <AuthField id="email" name="email" type="email" label="Scroll Address" autoComplete="email" onChange={handleChange} />
        <AuthField id="password" name="password" type="password" label="Secret Phrase" autoComplete="new-password" onChange={handleChange} />
        <AuthError>{error}</AuthError>
        <button type="submit" disabled={busy} className={sealBtn}>
          {busy ? "Sealing…" : "Scribe’s Seal"}
        </button>
      </form>
    </AuthCard>
  );
}

export default CreateAccount