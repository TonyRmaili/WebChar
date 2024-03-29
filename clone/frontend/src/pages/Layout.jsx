import React from 'react'
import Footer from '../components/Footer.jsx';
import Header from '../components/Header.jsx';
import { Outlet } from "react-router-dom";
import Header2 from '../components/Header2.jsx';

function Layout() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header2 />
      <div className="flex flex-col flex-grow bg-white">
        <Outlet />
      </div>
      <div className=''>
        <Footer />
      </div>
    </div>
  );
}

export default Layout