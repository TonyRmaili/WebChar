import React from "react";
import { Link } from "react-router-dom";

function ShortcutTab({ tabs, onSelect }) {

  return (
    <div>
      <ul className="flex flex-wrap text-md font-medium text-center text-gray-500 border-b border-black">
        {tabs.map(tab =>
          <li className="me-2" key={tab.id}>
            <button
              onClick={() => {
                onSelect(tab);
              }}
              className="inline-block p-4 rounded-t-lg active bg-orange-400 hover:bg-orange-600 text-white"
            >
              {tab.name}
            </button>
          </li>
        )}
      </ul>
    </div>
  )
}

export default ShortcutTab;