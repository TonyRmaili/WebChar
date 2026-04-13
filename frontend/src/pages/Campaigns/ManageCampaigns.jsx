import React, { useEffect, useState } from "react";
import useCampaignStore from "../../store/CampaignStore";
import useAuthStore from "../../store/AuthStore";

function ManageCampaigns({ goToCampaignView }) {
  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns);
  const createCampaign = useCampaignStore((s) => s.createCampaign);
  const selectCampaign = useCampaignStore((s) => s.selectCampaign);
  const deleteCampaign = useCampaignStore((s) => s.deleteCampaign);

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

      goToCampaignView();
    }
  };

  const handleDeleteCampaign = async (name) => {
    const confirmDelete = window.confirm(`Delete campaign "${name}"?`);
    if (!confirmDelete) return;

    await deleteCampaign(name);

    const data = await fetchCampaigns();
    setCampaigns(data);
  };

  return (
    <div className="flex gap-10">
      <button
        onClick={handleCreateCampaign}
        className="p-2 border border-red-600 rounded-lg font-semibold"
      >
        Create Campaign
      </button>

      {campaigns.length === 0 ? (
        <label>No campaigns found</label>
      ) : (
        campaigns.map((name, i) => (
          <div key={i} className="flex flex-col gap-2">
            <button
              className="p-2 border border-red-600 rounded-lg font-semibold"
              onClick={() => handleSelectCampaign(name)}
            >
              {name}
            </button>

            <button
              className="p-2 border border-red-800 rounded-lg text-sm text-red-500"
              onClick={() => handleDeleteCampaign(name)}
            >
              Delete
            </button>
          </div>
        ))
      )}
    </div>
  );
}

export default ManageCampaigns;