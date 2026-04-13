import React, { useEffect, useRef, useState } from "react";
import { PlusIcon, FolderPlusIcon } from "./CampaignWidgets";
import useCampaignStore from "../../store/CampaignStore";
import CampaignNode from "./CampaignNode";
import FilePopup from "./FilePopup";

function SelectedCampaign({ campaignName }) {
  const fetchCampaignData = useCampaignStore((s) => s.fetchCampaignData);
  const campaignData = useCampaignStore((s) => s.campaignData);
  const createFile = useCampaignStore((s) => s.createFile);
  const createFolder = useCampaignStore((s) => s.createFolder);
  const sendChat = useCampaignStore((s) => s.sendChat);
  const saveFile = useCampaignStore((s) => s.saveFile);
  const loading = useCampaignStore((s) => s.loading);
  const error = useCampaignStore((s) => s.error);
  const fetchPromptsData = useCampaignStore((s) => s.fetchPromptsData);
  const promptsData = useCampaignStore((s) => s.promptsData);
  const activePrompts = useCampaignStore((s) => s.activePrompts);
  const toggleActivePrompt = useCampaignStore((s) => s.toggleActivePrompt);
  const [chatInput, setChatInput] = useState("");
  const [chatResponse, setChatResponse] = useState("");
  const [isSending, setIsSending] = useState(false);


  const handleSendChat = async () => {
    if (!chatInput.trim() || isSending) return;

    setIsSending(true);
    try {
      const instructions = useCampaignStore.getState().getActivePromptText();
      const data = await sendChat(chatInput, instructions, campaignName);
      if (data) {
        setChatResponse(data);
        setChatInput("");
      }
    } finally {
      setIsSending(false);
    }
  };


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
    return <div className="ml-2 text-white">Loading...</div>;
  }

  if (error) {
    return <div className="ml-2 text-red-500">{error}</div>;
  }

  return (
  <div className="ml-2 relative min-h-[700px]">
    <h2 className="text-2xl font-bold mb-4">{campaignName}</h2>

    <div className="flex gap-6 items-start">
      {/* LEFT COLUMN — file handlers */}
      <div className="shrink-0">
        <div className="flex gap-2 mb-4">
          <button
            className="px-3 h-8 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-sm font-medium flex items-center gap-2 transition-colors"
            onClick={handleAddFileRoot}
          >
            <PlusIcon className="w-4 h-4" />
            New File
          </button>

          <button
            className="px-3 h-8 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-sm font-medium flex items-center gap-2 transition-colors"
            onClick={handleAddFolderRoot}
          >
            <FolderPlusIcon className="w-4 h-4" />
            New Folder
          </button>
        </div>

        <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-2 w-[380px] mb-4">
          {campaignData?.length ? (
            <div className="flex flex-col">
              {campaignData.map((node) => (
                <CampaignNode
                  key={node.path}
                  campaignName={campaignName}
                  node={node}
                  onOpenFile={handleOpenFile}
                />
              ))}
            </div>
          ) : (
            <div className="px-3 py-6 text-center text-sm text-slate-500">
              No files yet. Create one above to get started.
            </div>
          )}
        </div>

        {/* System Prompts */}
        <div className="mt-6">
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-amber-400">System Prompts</h3>
            <p className="text-xs text-slate-400">
              {activePrompts.length} active · sent to the AI assistant
            </p>
          </div>

          <div className="flex gap-2 mb-3">
            <button
              className="px-3 h-8 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-sm font-medium flex items-center gap-2 transition-colors"
              onClick={handleAddPromptRoot}
            >
              <PlusIcon className="w-4 h-4" />
              New Prompt
            </button>
          </div>

          <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-2 w-[380px]">
            {promptsData?.length ? (
              <div className="flex flex-col">
                {promptsData.map((node) => (
                  <CampaignNode
                    key={node.path}
                    node={node}
                    campaignName={campaignName}
                    onOpenFile={handleOpenFile}
                    activePrompts={activePrompts}
                    onToggleActive={toggleActivePrompt}
                  />
                ))}
              </div>
            ) : (
              <div className="px-3 py-6 text-center text-sm text-slate-500">
                No prompts yet.
              </div>
            )}
          </div>
        </div>
      </div>

     
          {/* RIGHT COLUMN — chat */}
    <div className="flex-1 min-w-0 max-w-6xl ml-24 -mt-20">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-amber-400">DM Assistant</h3>
      </div>

        <div className="bg-slate-900/40 border border-slate-700 rounded-lg flex flex-col h-[640px]">
          {/* Message log */}
          <div className="flex-1 overflow-y-auto p-4 text-sm text-slate-300 whitespace-pre-wrap">
            {isSending && !chatResponse ? (
              <div className="text-slate-500 italic">Thinking…</div>
            ) : chatResponse ? (
              chatResponse
            ) : (
              <div className="text-slate-500 italic">
                Ask the DM assistant anything about your campaign.
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="border-t border-slate-700 p-3">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
              placeholder="Ask your DM assistant... (Ctrl+Enter to send)"
              className="w-full h-32 bg-slate-800 text-white rounded-md p-3 resize-none outline-none border border-slate-700 focus:border-amber-500/60 transition-colors text-sm"
            />
            <div className="flex justify-end items-center mt-2">
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim() || isSending}
                className="px-4 h-8 rounded-md bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 font-semibold text-sm transition-colors"
              >
                {isSending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* File popup windows (unchanged) */}
    {openWindows.map((win) => (
      <div
        key={win.id}
        onMouseDown={() => focusWindow(win.id)}
        className="absolute border border-slate-700 bg-slate-900 text-white rounded shadow-lg flex flex-col overflow-hidden"
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
          className="flex items-center justify-between px-2 py-1 border-b border-slate-700 bg-slate-800 cursor-move select-none"
        >
          <span className="truncate text-amber-400">{win.title}</span>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {saveStatus[win.id] === "saving" && "Saving…"}
              {saveStatus[win.id] === "saved" && "Saved"}
              {saveStatus[win.id] === "unsaved" && "Unsaved"}
            </span>

            <div className="flex gap-1">
              <button
                className="px-2 hover:bg-slate-700 rounded"
                onClick={() => minimizeWindow(win.id)}
              >
                −
              </button>
              <button
                className="px-2 hover:bg-red-700 rounded"
                onClick={() => handleCloseWindow(win)}
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <textarea
          className="flex-1 w-full bg-slate-800 text-white p-2 resize-none outline-none"
          value={win.content}
          onChange={(e) => updateWindowContent(win.id, e.target.value)}
        />

        <div
          onMouseDown={(e) => handleResizeStart(e, win)}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          style={{
            background:
              "linear-gradient(135deg, transparent 50%, rgb(245 158 11) 50%, rgb(245 158 11) 70%, transparent 70%)",
          }}
        />
      </div>
    ))}

    <div className="fixed bottom-2 left-2 flex gap-2">
      {minimizedWindows.map((win) => (
        <button
          key={win.id}
          onClick={() => restoreWindow(win.id)}
          className="px-2 py-1 bg-slate-800 text-white border rounded"
        >
          {win.title}
        </button>
      ))}
    </div>
  </div>
);
}

export default SelectedCampaign;
