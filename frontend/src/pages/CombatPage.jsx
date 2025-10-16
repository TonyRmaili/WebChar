import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/AuthStore";
import useCharStore from "../store/CharStore";

import GeneralStats from "../components/GeneralStats";
import AbilityScore from "../components/AbilityScore";
import BioStats from "../components/BioStats";
import Traits from "../components/Traits";
import Spellbook from "../components/Spellbook";


// Reusable collapsible component
function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-800/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/70"
        aria-expanded={open}
      >
        <span className="font-medium text-slate-100">{title}</span>
        <svg
          className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

function CombatPage() {
  const { token, userData } = useAuthStore();
  const { fetchChar } = useCharStore();
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
    () => activeChars.find((c) => (c.id || c._id || c.name) === activeTabId),
    [activeChars, activeTabId]
  );

  // Load selected char details
  useEffect(() => {
    if (token && activeTabId) {
      fetchChar(activeTabId);
    }
  }, [token, activeTabId, fetchChar]);

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

      {/* Content */}
      <div className="w-full max-w-6xl mt-6 space-y-4">
        {/* Collapsible PLAY AREA */}
        <Collapsible title="Play Area" >
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 shadow-inner">
            <div className="w-full h-[520px] md:h-[620px] lg:h-[680px] flex items-center justify-center">
              <span className="text-slate-300/80 text-lg tracking-wide">
                Play Area (place components here later)
              </span>
            </div>
          </div>
        </Collapsible>

        {/* Collapsible panels */}
        <Collapsible title="General Stats" >
          {selectedChar ? (<GeneralStats />) : (<div className="text-slate-400">Select a character to view stats.</div>)}
        </Collapsible>

        <Collapsible title="Abilities & Skills">
          {selectedChar ? (<AbilityScore />) : (<div className="text-slate-400">Select a character to view stats.</div>)}
        </Collapsible>

        <Collapsible title="Biography">
          {selectedChar ? (<BioStats />) : (<div className="text-slate-400">Select a character to view stats.</div>)}
        </Collapsible>

        <Collapsible title="Traits">
          {selectedChar ? (<Traits />) : (<div className="text-slate-400">Select a character to view stats.</div>)}
        </Collapsible>

        <Collapsible title="Spellbook">
          {selectedChar ? (<Spellbook />) : (<div className="text-slate-400">Select a character to view stats.</div>)}
        </Collapsible>

        <Collapsible title="Inventory & Equipment">
          <div className="text-slate-300/90">Coming soon…</div>
        </Collapsible>

        <Collapsible title="Actions">
          <div className="text-slate-300/90">Coming soon…</div>
        </Collapsible>

        <Collapsible title="Lore">
          <div className="text-slate-300/90">Coming soon…</div>
        </Collapsible>
      </div>
    </div>
  );
}

export default CombatPage;
