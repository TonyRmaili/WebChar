import React from "react";
import { Link } from "react-router-dom";
import CombatLogo from "../assets/combat.svg";
import DiceLogo from "../assets/dice.svg";
import CreateCharLogo from "../assets/createChar.svg";
import LoadCharLogo from "../assets/loadChar.svg";
import LogInLogo from "../assets/logInLogo.svg";
import LogOutLogo from '../assets/logout.svg'
import useAuthStore from "../store/AuthStore";

function Header() {
  const { logout } = useAuthStore()
  

  return (
    <div className="h-32 bg-slate-800 flex gap-32 items-center justify-center text-orange-400 font-bold text-lg font-serif ">
      <div className="flex gap-6 p-2 ">
        <Link to="/createChar" className="flex flex-col p-2">
          <img src={CreateCharLogo} className="h-12" />
          <p>Create Char</p>
        </Link>
        <Link to="/loadChar" className="flex flex-col p-2">
          <img src={LoadCharLogo} className="h-12" />
          <p>Load Char</p>
        </Link>
      </div>
      <div className="flex items-center justify-between  w-[400px] p-4">
        <Link to="/" className="flex flex-col gap-2">
          <img src={CombatLogo} alt="combat-logo" className="h-16" />
          <p>Combat</p>
        </Link>
        <Link to="/diceTower" className="flex flex-col gap-2">
          <img src={DiceLogo} alt="" className="h-14" />
          <p> DiceTower</p>
        </Link>
      </div>
      <div className="flex gap-10 items-center p-2"> 
        <Link to="/logIn" className="flex flex-col items-center mt-4">
          <img src={LogInLogo} className="h-12" />
          <p>Log in</p>
        </Link>
        <Link to="/logIn" className="flex flex-col items-center mt-4">
          <button onClick={logout}>
            <img src={LogOutLogo} className="h-12" />
            <p>Logout</p>
          </button>
        </Link>
      </div>
    </div>
  );
}

export default Header;
