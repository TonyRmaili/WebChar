import React, { useState } from "react";
import useAuthStore from "../../store/AuthStore";
import ManageCampaigns from "./ManageCampaigns";
import SelectedCampaign from "./SelectedCampaign";

function MainCampaigns() {
  const userData = useAuthStore((s) => s.userData);
  const [activeView, setActiveView] = useState("manage");

  return (
    <div className="text-amber-500">
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveView("manage")}
          className="p-2 border border-red-600 rounded-lg font-semibold"
        >
          Manage Campaigns
        </button>

        
      </div>

      {activeView === "manage" && (
        <ManageCampaigns goToCampaignView={() => setActiveView("campaign")} />
      )}

      {activeView === "campaign" && userData?.selected_campaign && (
        <SelectedCampaign campaignName={userData.selected_campaign} />
      )}
    </div>
  );
}

export default MainCampaigns;