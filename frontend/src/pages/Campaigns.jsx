import React, { useEffect, useState } from "react";
import useCampaignStore from "../store/CampaignStore";
import useAuthStore from "../store/AuthStore"


function Campaigns() {
  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns)
  const createCampaign = useCampaignStore((s) => s.createCampaign)
  const selectCampaign = useCampaignStore((s) => s.selectCampaign)

  const userData = useAuthStore((s) => s.userData);
  const setUserData = useAuthStore((s) => s.setUserData);
  
  const [campaigns, setCampaigns] = useState([]);


  useEffect(() => {
    const loadCampaigns = async () => {
      const data = await fetchCampaigns();
      setCampaigns(data);
    };

    loadCampaigns();
  }, []);

  const handleCreateCampaign = async () => {
    const name = prompt("Enter campaign name:");
    if (!name) return;

    await createCampaign(name);

    // refresh campaigns
    const data = await fetchCampaigns();
    setCampaigns(data);
  };

  const handleSelectCampaign = async (name) => {
    const res = await selectCampaign(name);
    if (res?.selected_campaign !== undefined) {
    setUserData({
      ...userData,
      selected_campaign: res.selected_campaign,
    });
  }

  }

  return (
    <div className="flex gap-10 text-amber-500">

      <button
        onClick={handleCreateCampaign}
        className="p-2 border border-red-600 rounded-lg font-semibold"
      >
        Create Campaign
      </button>


      {campaigns.length === 0 ? (
        <label>No campaigns found</label>
      ) : (
        campaigns.map((name, i) => 
        <button 
        className="p-2 border border-red-600 rounded-lg font-semibold"
        onClick={() => handleSelectCampaign(name)}
        key={i}>{name}
        </button>)
      )}
    </div>
  );
}

export default Campaigns;
