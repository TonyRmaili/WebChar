import React,  { useState } from 'react'
import CreateAccountLogo from "../assets/createAccountLogo.svg"
import { Link, useNavigate } from "react-router-dom"
import useAuthStore from '../store/AuthStore';
import { AuthCard, AuthError, AuthField, sealBtn } from './AuthCard';


function LogIn() {
  const navigate = useNavigate()
  const { logIn, busy , error} = useAuthStore()
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  
  async function submitLogin(e) {
    e.preventDefault();
    const success = await logIn(name, password);

    if (success) {
      navigate("/CharactersMain");
    }
  }

  return (
    <AuthCard
      title="Log In"
      footer={
        <Link to="/createAccount" className="flex items-center gap-2 text-desk-ink-faded transition-colors hover:text-desk-accent">
          <img src={CreateAccountLogo} className="h-8" alt="" />
          <span>Create Account</span>
        </Link>
      }
    >
      <form onSubmit={submitLogin}>
        <AuthField id="username" name="username" type="text" label="Mortal Name" autoComplete="username" onChange={(e) => setName(e.target.value)} />
        <AuthField id="password" name="password" type="password" label="Secret Phrase" autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} />
        <AuthError>{error}</AuthError>
        <button type="submit" disabled={busy} className={sealBtn}>
          {busy ? "Sealing…" : "Scribe’s Seal"}
        </button>
      </form>
    </AuthCard>
  );
}

export default LogIn