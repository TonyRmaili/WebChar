import React, { useEffect, useState } from "react";
import useAuthStore from "../../store/AuthStore";
import useCampaignStore from "../../store/CampaignStore";
import SelectedCampaign from "./SelectedCampaign";
import { PlusIcon, FolderIcon, ChevronRightIcon } from "./CampaignWidgets";

/* ---------- Local icons (kept here so CampaignWidgets stays untouched) ---------- */

const TrashIcon = ({ className = "w-4 h-4", ...props }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
    <path
      d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-7 0v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronLeftIcon = ({ className = "w-4 h-4", ...props }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
    <path
      d="M15 6l-6 6 6 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ---------- Small inline modal for create / confirm-delete ---------- */

function Modal({ title, children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-[90%] max-w-md p-5"
      >
        <h3 className="text-lg font-semibold text-amber-400 mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */

function MainCampaigns() {
  const userData = useAuthStore((s) => s.userData);
  const setUserData = useAuthStore((s) => s.setUserData);

  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns);
  const createCampaign = useCampaignStore((s) => s.createCampaign);
  const selectCampaign = useCampaignStore((s) => s.selectCampaign);
  const deleteCampaign = useCampaignStore((s) => s.deleteCampaign);

  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaign, setActiveCampaign] = useState(
    userData?.selected_campaign || null,
  );

  // modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const reload = async () => {
    const data = await fetchCampaigns();
    setCampaigns(data || []);
  };

  useEffect(() => {
    reload();
  }, []);

  /* ---------- handlers ---------- */

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name || createBusy) return;
    setCreateBusy(true);
    await createCampaign(name);
    await reload();
    setCreateBusy(false);
    setCreateName("");
    setCreateOpen(false);
  };

  const handleSelect = async (name) => {
    const res = await selectCampaign(name);
    if (res?.selected_campaign !== undefined) {
      setUserData({ ...userData, selected_campaign: res.selected_campaign });
      setActiveCampaign(res.selected_campaign);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const name = deleteTarget;
    setDeleteTarget(null);
    await deleteCampaign(name);
    if (activeCampaign === name) setActiveCampaign(null);
    await reload();
  };

  const handleBackToList = () => {
    setActiveCampaign(null);
  };

  /* ---------- render: selected campaign view ---------- */

  if (activeCampaign) {
    return (
      <div className="text-amber-500">
        <button
          onClick={handleBackToList}
          className="mb-4 inline-flex items-center gap-2 px-3 h-9 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-sm font-medium transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          All campaigns
        </button>

        <SelectedCampaign campaignName={activeCampaign} />
      </div>
    );
  }

  /* ---------- render: campaign list view ---------- */

  return (
    <div className="text-amber-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-amber-400">Campaigns</h2>
          <p className="text-sm text-slate-400">
            {campaigns.length === 0
              ? "No campaigns yet — create your first one."
              : `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`}
          </p>
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-amber-600 hover:bg-amber-500 text-slate-900 text-sm font-semibold transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map((name) => (
          <div
            key={name}
            className="group relative bg-slate-900/40 hover:bg-slate-800/60 border border-slate-700 hover:border-amber-500/50 rounded-lg p-4 transition-colors cursor-pointer"
            onClick={() => handleSelect(name)}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
                <FolderIcon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-amber-400 font-semibold truncate">
                  {name}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Campaign</div>
              </div>

              <ChevronRightIcon className="w-4 h-4 text-slate-600 group-hover:text-amber-400 transition-colors mt-1" />
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(name);
              }}
              title="Delete campaign"
              className="absolute top-2 right-2 p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}

        {/* "Add" tile at the end of the grid */}
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center justify-center gap-2 min-h-[88px] rounded-lg border-2 border-dashed border-slate-700 hover:border-amber-500/60 text-slate-500 hover:text-amber-400 text-sm font-medium transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* ---------- Create modal ---------- */}
      {createOpen && (
        <Modal title="New campaign" onClose={() => setCreateOpen(false)}>
          <input
            autoFocus
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreateOpen(false);
            }}
            placeholder="Campaign name"
            className="w-full bg-slate-800 text-white rounded-md p-2 outline-none border border-slate-700 focus:border-amber-500/60 transition-colors text-sm"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setCreateOpen(false)}
              className="px-3 h-8 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!createName.trim() || createBusy}
              className="px-3 h-8 rounded-md bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 text-sm font-semibold transition-colors"
            >
              {createBusy ? "Creating…" : "Create"}
            </button>
          </div>
        </Modal>
      )}

      {/* ---------- Delete confirm modal ---------- */}
      {deleteTarget && (
        <Modal title="Delete campaign?" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm text-slate-300">
            This permanently deletes{" "}
            <span className="text-amber-400 font-semibold">{deleteTarget}</span>{" "}
            and everything inside. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-3 h-8 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-3 h-8 rounded-md bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default MainCampaigns;
