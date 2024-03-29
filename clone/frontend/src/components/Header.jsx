import React from 'react'
import Navbar from './Navbar'
import LoginButton from './LoginButton'

function Header() {
  return (
    <div>
        <header className="flex h-20 bg-gradient-to-b from-orange-500 to-orange-700">
            <Navbar />
            <LoginButton />
        </header>
    </div>
  );
}

export default Header