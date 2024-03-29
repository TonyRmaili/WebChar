import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <nav className="flex h-20 justify-center items-center mx-auto mr-6">
      <div className="flex flex-wrap items-center justify-between mx-auto p-4">
        <div
          className="hidden w-full md:flex md:w-auto md:order-1"
          id="navbar-cta"
        >
          <ul className="flex flex-row font-medium p-4 gap-6">
            <li>
              <Link to="/">
                <button className="block py-2 px-3 md:p-0 hover:underline text-white">
                  Home
                </button> 
              </Link>
            </li>
            <li>
              <Link to="/about">
                <button className="block py-2 px-3 md:p-0 hover:underline text-white">
                  About
                </button>
              </Link>
            </li>
            <li>
              <Link to="/">
                <button className="block py-2 px-3 md:p-0 hover:underline text-white">
                  Project
                </button>
              </Link>
            </li>
            <li>
              <Link to="/">
                <button className="block py-2 px-3 md:p-0 hover:underline text-white">
                  Contact
                </button>
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
