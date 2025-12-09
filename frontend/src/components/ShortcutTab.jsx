import React from "react";


function ShortcutTab({ tabs, onSelect }) {
  

  return (
    <div>
      <ul className="flex justify-center gap-4 font-medium py-2">
        {tabs.map(tab =>
          <li className="" key={tab.id}>
            <button
              onClick={() => {
                onSelect(tab);
              }}
              className="p-2 rounded-lg active bg-orange-400 hover:bg-orange-600 text-white"
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


