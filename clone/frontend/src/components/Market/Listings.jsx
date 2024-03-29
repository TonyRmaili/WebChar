import React from "react";

function Listings({ user_name, title, text, type, price }) {

  return (
    <div>
      <h1 className="font-bold text-md">Listings</h1>
      <div className="flex justify-between border-t border-black p-1 font-light">
        <p>Type: {type}</p>
        <p>Price: {price}</p>
      </div>
      <div className="border border-black mt-1 p-2">
        <h3><strong>Title:</strong> {title}</h3>
        <p className="mt-2 mb-2 p-2">{text}</p>
        <div>By: {user_name}</div>
      </div>
    </div>
  );
}

export default Listings;