import React from "react";
import { Link, Outlet } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";

function Layout() {
  return (
    <div>
      <header>
        <Header></Header>
      </header>
      <div className="flex flex-col min-h-screen bg-slate-700">
        <Outlet />
      </div>
      <footer>
        <Footer></Footer>
      </footer>
    </div>
  );
}

export default Layout;
