import React from "react";
import useAuthStore from "../stores/store";
import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import ShortcutTab from "../components/UserProfile/ShortcutTab";
import OtherProfileCard from "../components/OtherProfile/OtherProfileCard";
import OtherGallery from "../components/OtherProfile/OtherGallery";
import OtherAbout from "../components/OtherProfile/OtherAbout";
import OtherPosts from "../components/OtherProfile/OtherPosts";

const tabs = [{ name: "About", id: 0 }];

export default function OtherUserPage() {
  const [activeTab, setActiveTab] = useState(tabs[0]);

  const handleTabSelect = (tab) => {
    setActiveTab(tab);
  };

  const { userName } = useParams();
  const [otherUserData, setOtherUserData] = useState(null);
  const { token } = useAuthStore();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          `http://localhost:8000/other/${userName}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (response.status === 200) {
          const data = await response.json();
          // console.log(userData)
          setOtherUserData(data);
        } else if (response.status === 401) {
          //   logout();
        } else {
          console.error("Failed to fetch user data");
        }
      } catch (error) {
        console.error("There was an error fetching user data:", error);
      }
    };

    fetchData();
  }, [userName]);

  return (
    <div className="justify-center items-center mx-auto w-1/2 min-h-screen mb-2">
      <div className="mt-2 h-14">
        <ShortcutTab
          tabs={tabs}
          selectedTab={activeTab}
          onSelect={handleTabSelect}
        />
      </div>
      <div className="flex min-h-screen">
        <div className="border border-black w-1/3 min-h-screen bg-gray-400 p-2">
          <div className="mt-2 mr-2 ml-2">
            <OtherProfileCard otherUserData={otherUserData} />
          </div>
          <div className="h-60 w-72 mx-auto mt-10">
            <OtherGallery />
          </div>
        </div>
        <div className="w-2/3 min-h-screen p-2 bg-gray-600">
          {activeTab.name === "About" && (
            <>
              <OtherAbout otherUserData={otherUserData} />
              {/* <OtherPosts otherUserData={otherUserData} /> */}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
