import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/AuthStore";
import GeneralStats from "../components/GeneralStats";
import useCharStore from "../store/CharStore";



function CombatPage() {
  const { token, userData } = useAuthStore();
  const { charData, postCharData, fetchChar } = useCharStore()
  const navigate = useNavigate();
  const [activeTabId, setActiveTabId] = useState(null);

  
  // Route guards
  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  useEffect(() => {
    if (!userData || !userData.characters || userData.characters.length === 0) {
      navigate("/LoadChar");
    }
  }, [userData, navigate]);

  // Active characters
  const activeChars = useMemo(
    () =>
      (userData?.characters ?? []).filter(
        (c) => c?.active === true || c?.is_active === true || c?.status === "active"
      ),
    [userData]
  );

  // Ensure selected tab
  useEffect(() => {
    if (activeChars.length > 0 && !activeTabId) {
      setActiveTabId(activeChars[0].id || activeChars[0]._id || activeChars[0].name);
    }
  }, [activeChars, activeTabId]);

  const selectedChar = useMemo(
    () => activeChars.find(c => (c.id || c._id || c.name) === activeTabId),
    [activeChars, activeTabId]
  );

   useEffect(() => {
    if (token) {
      fetchChar(activeTabId); 
    }
  }, [activeTabId]);



  return (
    <div className="min-h-screen w-full bg-slate-900 text-slate-100 flex flex-col items-center py-10">
      {/* Tabs */}
      <div className="flex gap-2 bg-slate-800/60 border border-slate-700 rounded-xl p-2 shadow-md">
        {activeChars.map((char) => {
          const id = char.id || char._id || char.name;
          const isActive = id === activeTabId;
          return (
            <button
              key={id}
              onClick={() => setActiveTabId(id)}
              className={`px-4 py-2 rounded-lg transition border ${
                isActive
                  ? "bg-slate-100 text-slate-900 border-slate-200"
                  : "bg-slate-900 text-slate-100 border-slate-700 hover:bg-slate-800"
              }`}
            >
              {char.name}
            </button>
          );
        })}
      </div>

      {/* Only the selected character's details */}
      <div className="w-full max-w-5xl mt-6">
        {selectedChar ? <GeneralStats /> : null}
      </div>
    </div>
  );
}

export default CombatPage;
