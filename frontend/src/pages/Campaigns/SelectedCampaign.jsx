import React, { useEffect, useRef, useState } from "react";
import { PlusIcon, FolderPlusIcon } from "./CampaignWidgets";
import useCampaignStore from "../../store/CampaignStore";
import CampaignNode from "./CampaignNode";
import FilePopup from "./FilePopup";
import CampaignContextMenu from "./CampaignContextMenu";
import MoveToModal from "./MoveToModal";
import DMAssistant from "./DMAssistant";
import CampaignNpcs from "./npcs/CampaignNpcs";
import Tables from "./tables/Tables";
import { INK, InkHeading, ParchmentSheet } from "../../styles/parchment";
import { addBtn } from "../../styles/parchmentForm";

// Buttons on a file window's leather title bar (as on the card windows).
const barBtn = "rounded px-2 leading-6 text-desk-ink-faded transition-colors hover:bg-desk-deep/60 hover:text-desk-accent";
// "+ file", "+ folder", "+ prompt" next to a heading.
const addNote = `${addBtn} inline-flex items-center gap-1`;




const TOOLS = [
  { id: "assistant", label: "Assistant" },
  { id: "combat", label: "Combat" },
  { id: "tables", label: "Tables" }, 
];


function SelectedCampaign({ campaignName }) {
  const fetchCampaignData = useCampaignStore((s) => s.fetchCampaignData);
  const campaignData = useCampaignStore((s) => s.campaignData);
  const createFile = useCampaignStore((s) => s.createFile);
  const createFolder = useCampaignStore((s) => s.createFolder);
  const saveFile = useCampaignStore((s) => s.saveFile);
  const loading = useCampaignStore((s) => s.loading);
  const error = useCampaignStore((s) => s.error);
  const fetchPromptsData = useCampaignStore((s) => s.fetchPromptsData);
  const promptsData = useCampaignStore((s) => s.promptsData);
  const activePrompts = useCampaignStore((s) => s.activePrompts);
  const toggleActivePrompt = useCampaignStore((s) => s.toggleActivePrompt);
  const activeFiles = useCampaignStore((s) => s.activeFiles);
  const toggleActiveFiles = useCampaignStore((s) => s.toggleActiveFiles);
  const renameNode = useCampaignStore((s) => s.renameNode);
  const moveNode = useCampaignStore((s) => s.moveNode);
  const copyNode = useCampaignStore((s) => s.copyNode);
  const deleteFile = useCampaignStore((s) => s.deleteFile);




  const {
    openWindows,
    minimizedWindows,
    openWindow,
    restoreWindow,
    minimizeWindow,
    closeWindow,
    focusWindow,
    moveWindow,
    resizeWindow,
    updateWindowContent,
  } = FilePopup();

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // autosave bookkeeping
  const saveTimers = useRef({});
  const lastSaved = useRef({});
  const [saveStatus, setSaveStatus] = useState({});


  const [contextMenu, setContextMenu] = useState(null);
  // { x, y, node, treeKind: "files" | "prompts" }
  const [renamingPath, setRenamingPath] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  // { node, treeKind }

  // Right-column tool selection
  const [activeTool, setActiveTool] = useState("assistant");

  useEffect(() => {
    if (!campaignName) return;
    Promise.all([
      fetchCampaignData(campaignName),
      fetchPromptsData(campaignName),
    ]).then(() => setHasLoadedOnce(true));
  }, [campaignName, fetchCampaignData, fetchPromptsData]);

  // Debounced autosave
  useEffect(() => {
    openWindows.forEach((win) => {
      if (lastSaved.current[win.id] === undefined) {
        lastSaved.current[win.id] = win.content;
        return;
      }
      if (lastSaved.current[win.id] === win.content) return;

      setSaveStatus((s) => ({ ...s, [win.id]: "unsaved" }));

      clearTimeout(saveTimers.current[win.id]);
      saveTimers.current[win.id] = setTimeout(async () => {
        setSaveStatus((s) => ({ ...s, [win.id]: "saving" }));
        await saveFile(win.path, win.content);
        lastSaved.current[win.id] = win.content;
        setSaveStatus((s) => ({ ...s, [win.id]: "saved" }));
      }, 1000);
    });
  }, [openWindows, saveFile]);

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach(clearTimeout);
    };
  }, []);

  const handleAddFileRoot = () => {
    const fileName = prompt("Enter file name");
    if (!fileName) return;
    createFile(fileName, campaignName, "");
  };

  const handleAddFolderRoot = () => {
    const folderName = prompt("Enter folder name");
    if (!folderName) return;
    createFolder(folderName, campaignName, "");
  };


  const getPromptsRootPath = () => {
    if (promptsData.length === 0) return null;
    // Any top-level prompt node's parent is the prompts folder
    const firstPath = promptsData[0].path;
    // Strip the filename/foldername to get the parent dir
    return firstPath.replace(/[/\\][^/\\]+$/, "");
  };

  const handleAddPromptRoot = () => {
    const fileName = prompt("Enter prompt name");
    if (!fileName) return;
    const root = getPromptsRootPath();
    if (!root) {
      alert("Cannot determine prompts folder — try refreshing");
      return;
    }
    createFile(fileName, campaignName, root);
  };

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

  // For the Move modal: figure out the root path of each tree
  const getTreeRoot = (treeKind) => {
    const tree = treeKind === "prompts" ? promptsData : campaignData;
    if (tree.length === 0) return null;
    const firstPath = tree[0].path;
    return firstPath.replace(/[/\\][^/\\]+$/, "");
  };

  const handleOpenFile = (fileNode) => {
    openWindow({
      id: fileNode.path,
      title: fileNode.name,
      content: fileNode.content ?? "",
      path: fileNode.path,
      type: "file",
    });
  };

  const handleCloseWindow = async (win) => {
    if (saveTimers.current[win.id]) {
      clearTimeout(saveTimers.current[win.id]);
      delete saveTimers.current[win.id];
    }
    if (lastSaved.current[win.id] !== win.content) {
      await saveFile(win.path, win.content);
      lastSaved.current[win.id] = win.content;
    }
    delete lastSaved.current[win.id];
    setSaveStatus((s) => {
      const next = { ...s };
      delete next[win.id];
      return next;
    });
    closeWindow(win.id);
  };

  // --- Drag ---
  const handleDragStart = (e, win) => {
    if (e.target.closest("button")) return;
    e.preventDefault();
    focusWindow(win.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const originX = win.x;
    const originY = win.y;

    const onMove = (ev) => {
      moveWindow(
        win.id,
        originX + (ev.clientX - startX),
        originY + (ev.clientY - startY),
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // --- Resize ---
  const handleResizeStart = (e, win) => {
    e.preventDefault();
    e.stopPropagation();
    focusWindow(win.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const originW = win.width;
    const originH = win.height;

    const onMove = (ev) => {
      resizeWindow(
        win.id,
        originW + (ev.clientX - startX),
        originH + (ev.clientY - startY),
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  if (!hasLoadedOnce && loading) {
    return <div className="ml-2 font-body text-sm italic text-desk-ink-faded">Loading…</div>;
  }

  if (error) {
    return <div className="ml-2 font-body text-sm italic text-bad">{error}</div>;
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
            <InkHeading
              right={
                <span className="flex items-baseline gap-3">
                  <button className={addNote} onClick={handleAddFileRoot} title="New file">
                    <PlusIcon className="h-3 w-3" />
                    file
                  </button>
                  <button className={addNote} onClick={handleAddFolderRoot} title="New folder">
                    <FolderPlusIcon className="h-3.5 w-3.5" />
                    folder
                  </button>
                </span>
              }
            >
              Files
            </InkHeading>

            {campaignData?.length ? (
              <div className="-mx-1 flex flex-col">
                {campaignData.map((node) => (
                  <CampaignNode
                    key={node.path}
                    campaignName={campaignName}
                    node={node}
                    onOpenFile={handleOpenFile}
                    activePaths={activeFiles}
                    onToggleActive={toggleActiveFiles}
                    onContextMenu={handleContextMenu("files")}
                    renamingPath={renamingPath}
                    onRenameCommit={handleRenameCommit}
                    onRenameCancel={handleRenameCancel}
                  />
                ))}
              </div>
            ) : (
              <p className={`py-4 text-sm italic ${INK.faded}`}>No files yet. Create one above to get started.</p>
            )}

            {/* System Prompts */}
            <div className="mt-8">
              <InkHeading
                right={
                  <button className={addNote} onClick={handleAddPromptRoot} title="New prompt">
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
          {activeTool === "assistant" && <DMAssistant campaignName={campaignName} />}

          {activeTool === "combat" && <CampaignNpcs campaignName={campaignName} />}

          {activeTool === "tables" && <Tables campaignName={campaignName} />}
        </div>
      </div>

      {/* File windows: a leather title bar over lined parchment, like the card windows */}
      {openWindows.map((win) => (
        <div
          key={win.id}
          onMouseDown={() => focusWindow(win.id)}
          className="absolute flex flex-col overflow-hidden rounded-md bg-desk-deep shadow-2xl ring-1 ring-desk"
          style={{
            left: win.x,
            top: win.y,
            width: win.width,
            height: win.height,
            zIndex: win.zIndex,
          }}
        >
          <div
            onMouseDown={(e) => handleDragStart(e, win)}
            className="wc-desk flex cursor-move select-none items-center justify-between border-b border-stitch/30 px-2 py-1 font-body"
          >
            <span className="truncate text-sm font-semibold tracking-wide text-desk-ink">{win.title}</span>

            <div className="flex items-center gap-2">
              <span className="text-xs italic text-desk-ink-faded">
                {saveStatus[win.id] === "saving" && "Saving…"}
                {saveStatus[win.id] === "saved" && "Saved"}
                {saveStatus[win.id] === "unsaved" && "Unsaved"}
              </span>

              <div className="flex gap-1">
                <button className={barBtn} onClick={() => minimizeWindow(win.id)} title="Minimize">
                  −
                </button>
                <button className={`${barBtn} hover:!bg-bad/70 hover:!text-desk-ink`} onClick={() => handleCloseWindow(win)} title="Close">
                  ×
                </button>
              </div>
            </div>
          </div>

          <div className="wc-page flex min-h-0 flex-1 !rounded-none">
            <textarea
              className="wc-lined h-full w-full resize-none border-0 bg-transparent px-4 py-1 font-body text-[15px] leading-7 text-ink outline-none focus:ring-0"
              value={win.content}
              onChange={(e) => updateWindowContent(win.id, e.target.value)}
            />
          </div>

          <div
            onMouseDown={(e) => handleResizeStart(e, win)}
            className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
            style={{
              background: "linear-gradient(135deg, transparent 50%, rgb(var(--c-desk-accent)) 50%, rgb(var(--c-desk-accent)) 70%, transparent 70%)",
            }}
          />
        </div>
      ))}

      {/* Minimized file windows: small leather tabs in the bottom-left corner */}
      <div className="fixed bottom-2 left-2 flex gap-2">
        {minimizedWindows.map((win) => (
          <button
            key={win.id}
            onClick={() => restoreWindow(win.id)}
            className="wc-desk rounded-md border border-stitch/30 px-2.5 py-1 font-body text-sm text-desk-ink shadow-lg transition-colors hover:text-desk-accent"
          >
            {win.title}
          </button>
        ))}
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