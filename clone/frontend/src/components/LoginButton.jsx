import React from "react";
import { Link } from "react-router-dom";

const LoginButton = () => {
  return (
    <div className="flex justify-end items-center mx-auto ml-0">
      <Link to="/login">
        <button className="text-white rounded-3xl hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-bold text-lg px-4 py-2 text-center dark:bg-cyan-500 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
          Logga in
        </button>
      </Link>
    </div>
  );
};

export default LoginButton; 
