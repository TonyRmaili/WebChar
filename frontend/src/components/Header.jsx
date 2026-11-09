import React from "react";
import { Link } from "react-router-dom";


import CreateCharLogo from "../assets/createChar.svg";
import LogInLogo from "../assets/logInLogo.svg";
import LogOutLogo from '../assets/logout.svg'
import bannerLeft from "../assets/bannerLeft.webp";
import bannerRight from "../assets/bannerRight.webp";
import bannerMiddle from "../assets/bannerMiddle.webp";

import useAuthStore from "../store/AuthStore";

// The banner in three pieces, so it fits any screen width without
// squashing or cutting off the creatures: the angel pinned left, the
// demon pinned right, and plain parchment repeating in between (it is
// made to repeat without a visible seam). All three are as tall as the
// header.
const bannerStyle = {
  backgroundImage: `url(${bannerLeft}), url(${bannerRight}), url(${bannerMiddle})`,
  backgroundPosition: "left center, right center, left center",
  backgroundSize: "auto 100%, auto 100%, auto 100%",
  backgroundRepeat: "no-repeat, no-repeat, repeat-x",
};

const linkCls = "flex flex-col items-center leading-tight transition-colors hover:text-[#9a3412]";

function Header() {
  const { logout } = useAuthStore()


  return (
    <div style={bannerStyle} className="h-20 bg-[#e9d3a6] flex gap-32 items-center justify-center text-[#3a2716] font-bold text-base font-serif">
      <div className="flex gap-6 p-2">
        <Link to="/CharactersMain" className={linkCls}>
          <img src={CreateCharLogo} className="h-8" />
          <p>Characters</p>
        </Link>

      </div>


      <div className="flex items-center justify-between gap-8 w-[400px] p-2">
        <Link to="/MainCampaigns" className={linkCls}>
          <img src={LogOutLogo} className="h-9" />
          <p>Campaigns</p>
        </Link>
        <Link to="/CataloguesMain" className={linkCls}>
          <img src={LogOutLogo} className="h-9" />
          <p>Catalogues</p>
        </Link>
      </div>

      <div className="flex gap-10 items-center p-2">
        <Link to="/Settings" className={linkCls}>
          <img src={CreateCharLogo} className="h-8" />
          <p>Settings</p>
        </Link>
        <Link to="/logIn" className={linkCls}>
          <img src={LogInLogo} className="h-8" />
          <p>Log in</p>
        </Link>
        <Link to="/logIn" className={linkCls}>
          <button onClick={logout} className="flex flex-col items-center">
            <img src={LogOutLogo} className="h-8" />
            <p>Logout</p>
          </button>
        </Link>
      </div>
    </div>
  );
}

export default Header;