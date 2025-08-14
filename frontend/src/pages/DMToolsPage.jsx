import React, { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import useAuthStore from "../store/AuthStore";
import ShortcutTab from "../components/ShortcutTab";
import CreateParty from "../components/CreateParty";
import InitiativeTracker from "../components/InitiativeTracker";


const tabs = [
  { name: "Create Party", id: 0 },
  { name: "Initiative Tracker", id: 1 },
  
];


function DMToolsPage() {
    const navigate = useNavigate()
    const { token, userData } = useAuthStore();
    const [activeTab, setActiveTab] = useState(tabs[0]);

    const handleTabSelect = (tab) => {
    setActiveTab(tab);
  };

    useEffect(() => {
        if (!token || !userData) {
          navigate("/login");
        }
      }, [token, userData]);
    

  return (
    <div className="justify-center items-center mx-auto w-1/2 min-h-screen mb-2">
      <p className='text-4xl'>Character Creation</p>
      <div className="mt-2 h-14 ml">
        <ShortcutTab
          tabs={tabs}
          selectedTab={activeTab}
          onSelect={handleTabSelect}
        />
      </div>

      <div className=" min-h-screen p-2 bg-gray-600">
        {activeTab.name === "Create Party" && <CreateParty />}
        {activeTab.name === "Initiative Tracker" && <InitiativeTracker />}
         
      </div>
      
    </div>
    
  );
}

export default DMToolsPage