import React, { useEffect, useState } from "react";
import useAuthStore from "../../store/AuthStore";
import useCampaignStore from "../../store/CampaignStore";
import SelectedCampaign from "./SelectedCampaign";
import { PlusIcon, FolderIcon, ChevronRightIcon } from "./CampaignWidgets";
import { ParchmentSheet, Title } from "../../styles/parchment";
import { addBtn } from "../../styles/parchmentForm";
import { CreateModal, fieldCls } from "../Catalogues/catalogueStyle";

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
      <div>
        {/* On the leather, so it's written in the desk inks. */}
        <button
          onClick={handleBackToList}
          className="mb-4 inline-flex items-center gap-1.5 font-body text-sm text-desk-ink-faded transition-colors hover:text-desk-accent"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          All campaigns
        </button>

        <SelectedCampaign campaignName={activeCampaign} />
      </div>
    );
  }

  /* ---------- render: campaign list view ---------- */

  return (
    <ParchmentSheet>
      <Title
        after={
          <span className="text-sm italic text-ink-faded">
            {campaigns.length === 0
              ? "No campaigns yet — create your first one."
              : `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`}
          </span>
        }
        right={
          <button onClick={() => setCreateOpen(true)} className={`${addBtn} !text-sm`}>
            + new campaign
          </button>
        }
      >
        Campaigns
      </Title>

      <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((name) => (
          <div
            key={name}
            className="group relative flex cursor-pointer items-center gap-3 border-b border-dotted border-rule/40 px-1.5 py-2.5 transition-colors hover:bg-ink/[0.05]"
            onClick={() => handleSelect(name)}
          >
            <FolderIcon className="h-5 w-5 shrink-0 text-rubric" />

            <span className="min-w-0 flex-1 truncate text-[17px] text-ink group-hover:text-rubric">{name}</span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(name);
              }}
              title="Delete campaign"
              aria-label={`Delete ${name}`}
              className="rounded p-1 text-ink-faded opacity-0 transition hover:text-rubric focus-visible:opacity-100 group-hover:opacity-100"
            >
              <TrashIcon className="h-4 w-4" />
            </button>

            <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-faint transition-colors group-hover:text-rubric" />
          </div>
        ))}

        {/* "Add" entry at the end of the list */}
        <button
          onClick={() => setCreateOpen(true)}
          className="mt-1 flex min-h-[44px] items-center justify-center gap-2 rounded-sm border border-dashed border-rule/50 text-sm italic text-ink-faded transition-colors hover:border-rubric/60 hover:text-rubric"
        >
          <PlusIcon className="h-4 w-4" />
          New campaign
        </button>
      </div>

      {/* ---------- Create modal ---------- */}
      <CreateModal
        open={createOpen}
        title="New campaign"
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
        saving={createBusy}
        saveDisabled={!createName.trim()}
        saveLabel="Create"
        width="max-w-md"
      >
        <input
          autoFocus
          type="text"
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
          placeholder="Campaign name"
          className={fieldCls}
        />
      </CreateModal>

      {/* ---------- Delete confirm modal ---------- */}
      <CreateModal
        open={!!deleteTarget}
        title="Delete campaign?"
        onClose={() => setDeleteTarget(null)}
        onSave={handleDelete}
        saveLabel="Delete"
        width="max-w-md"
      >
        <p className="text-[15px] text-ink">
          This permanently deletes <span className="font-semibold text-rubric">{deleteTarget}</span> and everything inside. This cannot be undone.
        </p>
      </CreateModal>
    </ParchmentSheet>
  );
}

export default MainCampaigns;