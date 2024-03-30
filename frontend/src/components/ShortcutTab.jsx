import React from "react";


function ShortcutTab({ tabs, onSelect }) {
  return (
    <div>
      <ul className="flex flex-wrap gap-2 font-medium text-center">
        {tabs.map(tab =>
          <li className="" key={tab.id}>
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