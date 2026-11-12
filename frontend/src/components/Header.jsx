import React from "react";
import { Link } from "react-router-dom";

import CreateCharLogo from "../assets/createChar.svg";
import LogInLogo from "../assets/logInLogo.svg";
import LogOutLogo from "../assets/logout.svg";

import useAuthStore from "../store/AuthStore";

/* The header bar. Its look is the theme's (wc-banner in themes.css): in
   parchment, the angel-and-demon banner — angel pinned left, demon pinned
   right, parchment repeating between, so it fits any screen width; in
   classic, a plain slate bar. Text is ink, rubric on hover. */

const linkCls = "flex flex-col items-center leading-tight transition-colors hover:text-rubric";

function Header() {
  const logout = useAuthStore((s) => s.logout);
  // Logged in = there is a login token (kept in localStorage by
  // utils/api.js, so this survives a page reload). Only one of Log in /
  // Logout is shown.
  const loggedIn = useAuthStore((s) => !!s.token);

  return (
    <div className="wc-banner flex h-20 items-center justify-center gap-32 text-base font-bold">
      <div className="flex gap-6 p-2">
        <Link to="/CharactersMain" className={linkCls}>
          <img src={CreateCharLogo} className="h-8" alt="" />
          <p>Characters</p>
        </Link>
      </div>

      <div className="flex w-[400px] items-center justify-between gap-8 p-2">
        <Link to="/MainCampaigns" className={linkCls}>
          <img src={LogOutLogo} className="h-9" alt="" />
          <p>Campaigns</p>
        </Link>
        <Link to="/CataloguesMain" className={linkCls}>
          <img src={LogOutLogo} className="h-9" alt="" />
          <p>Catalogues</p>
        </Link>
      </div>

      <div className="flex items-center gap-10 p-2">
        <Link to="/Settings" className={linkCls}>
          <img src={CreateCharLogo} className="h-8" alt="" />
          <p>Settings</p>
        </Link>
        {loggedIn ? (
          // logout() saves any waiting change first, then logs out.
          <Link to="/logIn" onClick={() => logout()} className={linkCls}>
            <img src={LogOutLogo} className="h-8" alt="" />
            <p>Logout</p>
          </Link>
        ) : (
          <Link to="/logIn" className={linkCls}>
            <img src={LogInLogo} className="h-8" alt="" />
            <p>Log in</p>
          </Link>
        )}
      </div>
    </div>
  );
}

export default Header;