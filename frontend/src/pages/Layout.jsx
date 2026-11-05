import React from "react";
import { Link, Outlet } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import GlobalPopupLayer from "../components/popups/GlobalPopupLayer"


function Layout() {
  return (
    <div>
      <header>
        <Header></Header>
      </header>
      <div className="min-h-screen bg-slate-900">
        <Outlet />
        <GlobalPopupLayer />
       
      </div>
      <footer>
        <Footer></Footer>
      </footer>
    </div>
  );
}

export default Layout; 
