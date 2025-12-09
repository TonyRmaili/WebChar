import React, { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import useAuthStore from "../store/AuthStore";
import ShortcutTab from "../components/ShortcutTab";
import CreateParty from "../components/CreateParty";
import InitiativeTracker from "../components/InitiativeTracker";
import CreateMonsters from "../components/CreateMonsters";
import MonsterCard from "../utils/MonsterCard";
import QuickClassMain from "../components/QuickClass/QuickClassMain";


const tabs = [
  { name: "Create Party", id: 0 },
  { name: "Create Monsters", id: 1 },
  { name: "Monster Card", id: 2 },
  { name: "Initiative Tracker", id: 3 },
  { name: "Quick Class", id: 4 },
  
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
  <div className="justify-center items-center mx-auto min-h-screen mb-2">
    <div className="h-14">
      <ShortcutTab tabs={tabs} selectedTab={activeTab} onSelect={handleTabSelect} />
    </div>

    <div className="min-h-screen bg-slate-600">
      {activeTab.name === "Create Party" && (
        <div className="w-1/2 mx-auto border">
          <CreateParty />
        </div>
      )}
      {activeTab.name === "Create Monsters" && (
        <div className="w-1/2 mx-auto">
          <CreateMonsters />
        </div>
      )}
      {activeTab.name === "Monster Card" && (
        <div className="w-1/2 mx-auto">
          <MonsterCard />
        </div>
      )}

      {activeTab.name === "Initiative Tracker" && (
        <div className="w-1/2 mx-auto">
          <InitiativeTracker />
        </div>
      )}

      {activeTab.name === "Quick Class" && (
        <div className="w-full">
          <QuickClassMain />
        </div>
      )}
    </div>
  </div>
);

  
}

export default DMToolsPage



