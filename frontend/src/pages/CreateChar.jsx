import React, { useEffect, useState } from "react";
import useAuthStore from "../store/AuthStore";
import useCharStore from "../store/CharStore";
import { useNavigate } from "react-router-dom";
import GeneralStats from "../components/GeneralStats";
import ShortcutTab from "../components/ShortcutTab";
import AbilityScore from "../components/AbilityScore";

const tabs = [
  { name: "General", id: 0 },
  { name: "Ability Score", id: 1 },
];

function CreateChar() {
  const { token, userData } = useAuthStore();
  const { postCharData } = useCharStore();
  const navigate = useNavigate();
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
        {activeTab.name === "General" && <GeneralStats />}
        {activeTab.name === "Ability Score" && <AbilityScore />}
      </div>
      <div className="flex border-2 border-black rounded-3xl text-white bg-red-500 mt-12 ">
          <button  className="font-bold p-4" onClick={postCharData}>
            Save
          </button>
      </div>
    </div>
    
  );
}

export default CreateChar;
