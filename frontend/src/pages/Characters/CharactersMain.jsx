import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../store/AuthStore";
import CreateCharacters from "./Create";
import Sheets from "./Sheets";
import { WithViewRail } from "./ViewSwitch";

/* Characters: Create (your roster and the builder) or Sheets (play).

   The Sheets / Create switch is in the left rail, not in a strip across
   the top: under the Play panel's open/close button on Sheets, and in a
   rail of its own beside the roster on Create (ViewSwitch.jsx). */

function CharactersMain() {
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const [view, setView] = useState("create");

  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  return (
    <div className="w-full px-4 lg:px-8">
      {view === "sheets" ? (
        <Sheets onView={setView} />
      ) : (
        <div className="py-4">
          <WithViewRail view={view} onView={setView}>
            <CreateCharacters />
          </WithViewRail>
        </div>
      )}
    </div>
  );
}

export default CharactersMain;