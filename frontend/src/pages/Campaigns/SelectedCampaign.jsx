import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { PlusIcon, FolderPlusIcon, ImageIcon } from "./CampaignWidgets";
import useCampaignStore from "../../store/CampaignStore";
import CampaignNode from "./CampaignNode";
import { openCampaignFile } from "./notes/fileCards";
import { searchFiles } from "./notes/notesApi";
import CampaignContextMenu from "./CampaignContextMenu";
import MoveToModal from "./MoveToModal";
import { useAssistantStore } from "../../store/AssistantStore";
import CampaignNpcs from "./npcs/CampaignNpcs";
import Tables from "./tables/Tables";
import { INK, InkHeading, ParchmentSheet } from "../../styles/parchment";
import { addBtn } from "../../styles/parchmentForm";

// "+ note", "+ picture", "+ folder", "+ prompt" next to a heading.
const addNoteBtn = `${addBtn} inline-flex items-center gap-1`;

// The Files tree while searching: files the server found (by name or by
// what they say), folders whose name matches (with all inside), and the
// folders on the way to them.
export function filterTree(nodes, found) {
  const q = found.query.toLowerCase();
  return (nodes || []).flatMap((n) => {
    if (n.type !== "folder") return n.path in found.snippets ? [n] : [];
    if (n.name.toLowerCase().includes(q)) return [n];
    const children = filterTree(n.children, found);
    return children.length ? [{ ...n, children }] : [];
  });
}

const TOOLS = [
  { id: "combat", label: "Combat" },
  { id: "tables", label: "Tables" }, 
];


function SelectedCampaign({ campaignName }) {
  const fetchCampaignData = useCampaignStore((s) => s.fetchCampaignData);
  const campaignData = useCampaignStore((s) => s.campaignData);
  const createFile = useCampaignStore((s) => s.createFile);
  const createFolder = useCampaignStore((s) => s.createFolder);
  const uploadPicture = useCampaignStore((s) => s.uploadPicture);
  const filesRoot = useCampaignStore((s) => s.filesRoot);
  const promptsRoot = useCampaignStore((s) => s.promptsRoot);
  const loading = useCampaignStore((s) => s.loading);
  const error = useCampaignStore((s) => s.error);
  const fetchPromptsData = useCampaignStore((s) => s.fetchPromptsData);
  const promptsData = useCampaignStore((s) => s.promptsData);
  const activePrompts = useCampaignStore((s) => s.activePrompts);
  const toggleActivePrompt = useCampaignStore((s) => s.toggleActivePrompt);
  const renameNode = useCampaignStore((s) => s.renameNode);
  const moveNode = useCampaignStore((s) => s.moveNode);
  const copyNode = useCampaignStore((s) => s.copyNode);
  const deleteFile = useCampaignStore((s) => s.deleteFile);
  const clearError = useCampaignStore((s) => s.clearError);

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  // Searching the Files: what's typed, and what the server found for it.
  const [search, setSearch] = useState("");
  const [found, setFound] = useState(null); // { query, snippets } | null

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setFound(null);
      return undefined;
    }
    let live = true;
    const wait = setTimeout(async () => {
      const r = await searchFiles(campaignName, query);
      if (live && r.ok) setFound({ query, snippets: Object.fromEntries(r.matches.map((m) => [m.path, m.snippet])) });
    }, 250);
    return () => {
      live = false;
      clearTimeout(wait);
    };
  }, [search, campaignName, campaignData]);

  const shownFiles = useMemo(() => (found ? filterTree(campaignData, found) : campaignData), [found, campaignData]);
  // A picture that couldn't be added, said under the Files heading.
  const [pictureNote, setPictureNote] = useState(null);
  const picker = useRef(null);
  const pickerFolder = useRef("");

  const [contextMenu, setContextMenu] = useState(null);
  // { x, y, node, treeKind: "files" | "prompts" }
  const [renamingPath, setRenamingPath] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  // { node, treeKind }

  // Right-column tool selection
  const [activeTool, setActiveTool] = useState("combat");

  // The footer's assistant offers to switch to the campaign open here.
  useEffect(() => {
    useAssistantStore.getState().setPageCampaign(campaignName);
    return () => useAssistantStore.getState().setPageCampaign(null);
  }, [campaignName]);

  useEffect(() => {
    if (!campaignName) return;
    Promise.all([
      fetchCampaignData(campaignName),
      fetchPromptsData(campaignName),
    ]).then(() => setHasLoadedOnce(true));
  }, [campaignName, fetchCampaignData, fetchPromptsData]);

  // A new note opens straight away, ready to write in.
  const addNote = async (folder) => {
    const fileName = prompt("Name of the new note");
    if (!fileName) return;
    const made = await createFile(fileName, campaignName, folder);
    if (made?.path) openCampaignFile({ kind: made.kind, name: made.name, path: made.path }, campaignName);
  };

  const handleAddFileRoot = () => addNote("");

  // Pictures as files of their own: pick one or more, into a folder or the top.
  const pickPictures = (folder) => {
    pickerFolder.current = folder;
    picker.current?.click();
  };

  const handlePicked = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    setPictureNote(null);
    for (const file of files) {
      const r = await uploadPicture(campaignName, file, pickerFolder.current);
      if (!r.ok) setPictureNote(`"${file.name}": ${r.message}`);
    }
  };

  const handleAddFolderRoot = () => {
    const folderName = prompt("Name of the new folder");
    if (!folderName) return;
    createFolder(folderName, campaignName, "");
  };


  const addPrompt = async (folder) => {
    const fileName = prompt("Name of the new prompt");
    if (!fileName || !folder) return;
    const made = await createFile(fileName, campaignName, folder);
    if (made?.path) openCampaignFile({ kind: made.kind, name: made.name, path: made.path }, campaignName);
  };

  const handleAddPromptRoot = () => addPrompt(promptsRoot);

  const handleContextMenu = (treeKind) => (x, y, node) => {
    setContextMenu({ x, y, node, treeKind });
  };

  const handleContextAction = (action, node) => {
    if (action === "rename") {
      setRenamingPath(node.path);
    } else if (action === "move") {
      const treeKind = contextMenu?.treeKind ?? "files";
      setMoveTarget({ node, treeKind });
    } else if (action === "copy") {
      copyNode(node.path);
    } else if (action === "delete") {
      const msg =
        node.type === "folder"
          ? `Delete folder "${node.name}" and everything inside?`
          : `Delete file "${node.name}"?`;
      if (window.confirm(msg)) {
        deleteFile(node.name, node.path);
      }
    }
  };

  const handleRenameCommit = async (path, newName) => {
    setRenamingPath(null);
    await renameNode(path, newName);
  };

  const handleRenameCancel = () => setRenamingPath(null);

  const handleMoveConfirm = async (targetFolder) => {
    if (!moveTarget) return;
    const src = moveTarget.node.path;
    setMoveTarget(null);
    await moveNode(src, targetFolder);
  };

  // For the Move modal: the folder at the top of each tree
  const getTreeRoot = (treeKind) => (treeKind === "prompts" ? promptsRoot : filesRoot);

  const handleOpenFile = (fileNode) => openCampaignFile(fileNode, campaignName);

  if (!hasLoadedOnce && loading) {
    return <div className="ml-2 font-body text-sm italic text-desk-ink-faded">Loading…</div>;
  }


  return (
    <div className="relative min-h-[700px]">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 pb-4">
        {/* On the leather, so it's written in the desk inks. */}
        <h2 className="w-[380px] shrink-0 font-body text-2xl tracking-wide text-desk-ink">{campaignName}</h2>

        {/* Tool tab strip — the same leather bar as the catalogue tabs */}
        <div className="wc-desk flex flex-wrap gap-1 rounded-xl border border-stitch/25 p-1.5 font-body" role="tablist" aria-label="Campaign tools">
          {TOOLS.map((t) => {
            const isActive = activeTool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTool(t.id)}
                className={`h-8 rounded-md px-4 text-[15px] transition ${
                  isActive ? "bg-page font-semibold text-ink shadow" : "text-desk-ink-faded hover:bg-desk-deep/50 hover:text-desk-accent"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-6">
        {/* LEFT COLUMN — file handlers */}
        <div className="w-[380px] shrink-0">
          <ParchmentSheet>
            {/* Something went wrong (a name already taken, the server away…): said here, the page stays. */}
            {error && (
              <p className="mb-3 text-sm italic text-bad">
                {error}{" "}
                <button className="text-xs text-ink-faded underline decoration-dotted underline-offset-4 hover:text-ink" onClick={clearError}>
                  ok
                </button>
              </p>
            )}
            <InkHeading
              right={
                <span className="flex items-baseline gap-3">
                  <button className={addNoteBtn} onClick={handleAddFileRoot} title="New note">
                    <PlusIcon className="h-3 w-3" />
                    note
                  </button>
                  <button className={addNoteBtn} onClick={() => pickPictures("")} title="Add pictures (PNG, JPEG, GIF, WebP)">
                    <ImageIcon className="h-3.5 w-3.5" />
                    picture
                  </button>
                  <button className={addNoteBtn} onClick={handleAddFolderRoot} title="New folder">
                    <FolderPlusIcon className="h-3.5 w-3.5" />
                    folder
                  </button>
                </span>
              }
            >
              Files
            </InkHeading>
            {pictureNote && (
              <p className="-mt-2 mb-2 text-xs italic text-bad">
                {pictureNote}{" "}
                <button className="text-ink-faded underline decoration-dotted underline-offset-4 hover:text-ink" onClick={() => setPictureNote(null)}>
                  ok
                </button>
              </p>
            )}
            <input ref={picker} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={handlePicked} />

            {campaignData?.length > 0 && (
              <label className="mb-2 flex items-center gap-2 border-b border-rule/50 pb-1 text-ink-faded focus-within:border-rubric/60">
                <Search size={14} className="shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setSearch("")}
                  placeholder="Search names and what the notes say…"
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 font-body text-sm text-ink placeholder:italic placeholder:text-ink-faint focus:outline-none focus:ring-0"
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} title="Clear the search (Esc)" className="shrink-0 hover:text-ink">
                    <X size={14} />
                  </button>
                )}
              </label>
            )}

            {found && shownFiles.length === 0 ? (
              <p className={`py-4 text-sm italic ${INK.faded}`}>Nothing in the files says "{found.query}".</p>
            ) : shownFiles?.length ? (
              <div className="-mx-1 flex flex-col">
                {shownFiles.map((node) => (
                  <CampaignNode
                    key={node.path}
                    campaignName={campaignName}
                    node={node}
                    onOpenFile={handleOpenFile}
                    onAddNote={addNote}
                    onAddPicture={pickPictures}
                    onContextMenu={handleContextMenu("files")}
                    renamingPath={renamingPath}
                    onRenameCommit={handleRenameCommit}
                    onRenameCancel={handleRenameCancel}
                    found={found}
                  />
                ))}
              </div>
            ) : (
              <p className={`py-4 text-sm italic ${INK.faded}`}>No notes yet. Make one above, or add a picture.</p>
            )}

            {/* System Prompts */}
            <div className="mt-8">
              <InkHeading
                right={
                  <button className={addNoteBtn} onClick={handleAddPromptRoot} title="New prompt">
                    <PlusIcon className="h-3 w-3" />
                    prompt
                  </button>
                }
              >
                System Prompts
              </InkHeading>
              <p className={`-mt-2 mb-2 text-xs italic ${INK.faded}`}>{activePrompts.length} active · sent to the AI assistant</p>

              {promptsData?.length ? (
                <div className="-mx-1 flex flex-col">
                  {promptsData.map((node) => (
                    <CampaignNode
                      key={node.path}
                      node={node}
                      campaignName={campaignName}
                      onOpenFile={handleOpenFile}
                      onAddNote={addPrompt}
                      activePaths={activePrompts}
                      onToggleActive={toggleActivePrompt}
                      onContextMenu={handleContextMenu("prompts")}
                      renamingPath={renamingPath}
                      onRenameCommit={handleRenameCommit}
                      onRenameCancel={handleRenameCancel}
                    />
                  ))}
                </div>
              ) : (
                <p className={`py-4 text-sm italic ${INK.faded}`}>No prompts yet.</p>
              )}
            </div>
          </ParchmentSheet>
        </div>

        {/* RIGHT COLUMN — tools */}
        <div className="min-w-0 max-w-6xl flex-1">
          {activeTool === "combat" && <CampaignNpcs campaignName={campaignName} />}

          {activeTool === "tables" && <Tables campaignName={campaignName} />}
        </div>
      </div>

      {contextMenu && (
        <CampaignContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
        />
      )}

      {moveTarget && (
        <MoveToModal
          sourceNode={moveTarget.node}
          tree={moveTarget.treeKind === "prompts" ? promptsData : campaignData}
          rootPath={getTreeRoot(moveTarget.treeKind)}
          onConfirm={handleMoveConfirm}
          onClose={() => setMoveTarget(null)}
        />
      )}
    </div>
  );
}

export default SelectedCampaign;