import React, { useEffect, useState } from "react";
import useAuthStore from "../store/AuthStore";
import { useNavigate } from "react-router-dom";
import GeneralStats from "../components/GeneralStats";
import ShortcutTab from "../components/ShortcutTab";

const tabs = [{ name: "General", id: 0 }];

function CreateChar() {
  const { token, userData } = useAuthStore();
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

  
  

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      const response = await fetch("http://localhost:8000/create_char", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        console.log("char created successfully");
        // Handle success, maybe redirect the user or show a success message
      } else {
        console.error("Error creating char");
        // Handle error
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }

  return (
    <div className="justify-center items-center mx-auto w-1/2 min-h-screen mb-2">
      <h className='text-4xl'>Character Creation</h>
      <div className="mt-2 h-14">
        <ShortcutTab
          tabs={tabs}
          selectedTab={activeTab}
          onSelect={handleTabSelect}
        />
      </div>

      <div className=" min-h-screen p-2 bg-gray-600">
        {activeTab.name === "General" && <GeneralStats />}
      </div>
    </div>
    
  );
}

export default CreateChar;
