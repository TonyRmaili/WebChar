import React, { useEffect, useRef, useState } from "react";
import { PlusIcon, FolderPlusIcon } from "./CampaignWidgets";
import useCampaignStore from "../../store/CampaignStore";
import CampaignNode from "./CampaignNode";
import FilePopup from "./FilePopup";
import CampaignContextMenu from "./CampaignContextMenu";
import MoveToModal from "./MoveToModal";
import SaveToModal from "./SaveToModal";

function slugifyResponse(content, maxLen = 50) {
  const firstLine = content.trim().split("\n", 1)[0] || "";
  const noLinks = firstLine.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const noMarkers = noLinks.replace(/[*_`#>\-]+/g, " ");
  const noPunct = noMarkers.replace(/[^a-zA-Z0-9\s]+/g, " ");
  const slug = noPunct.trim().replace(/\s+/g, "-").toLowerCase();
  return slug.slice(0, maxLen) || "response";
}

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
  const [messages, setMessages] = useState([]);
  const chatLogRef = useRef(null);
  const [isSending, setIsSending] = useState(false);
  const activeFiles = useCampaignStore((s) => s.activeFiles);
  const toggleActiveFiles = useCampaignStore((s) => s.toggleActiveFiles);
  const renameNode = useCampaignStore((s) => s.renameNode);
  const moveNode = useCampaignStore((s) => s.moveNode);
  const copyNode = useCampaignStore((s) => s.copyNode);
  const deleteFile = useCampaignStore((s) => s.deleteFile);
  const saveResponse = useCampaignStore((s) => s.saveResponse);

  const handleSendChat = async () => {
    if (!chatInput.trim() || isSending) return;

    const userMessage = { role: "user", content: chatInput };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setChatInput("");
    setIsSending(true);

    try {
      const instructions = useCampaignStore.getState().getActivePromptText();
      const data = await sendChat(nextMessages, instructions, campaignName);
      if (data) {
        setMessages((prev) => [...prev, { role: "assistant", content: data }]);
      }
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [messages, isSending]);

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

  const [savedMessages, setSavedMessages] = useState({}); // { [idx]: "saved" | "saving" | "error" }
  const [editingIndex, setEditingIndex] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [saveModal, setSaveModal] = useState(null); // { index, content }

  const [contextMenu, setContextMenu] = useState(null);
  // { x, y, node, treeKind: "files" | "prompts" }
  const [renamingPath, setRenamingPath] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  // { node, treeKind }

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

  // --- Edit ---
  const handleStartEdit = (i, content) => {
    if (isSending) return;
    setEditingIndex(i);
    setEditDraft(content);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditDraft("");
  };

  const handleCommitEdit = (i) => {
    setMessages((prev) =>
      prev.map((m, idx) =>
        idx === i ? { ...m, content: editDraft, edited: true } : m,
      ),
    );
    // Re-enable save if it was previously saved
    setSavedMessages((prev) => {
      if (prev[i] !== "saved") return prev;
      const next = { ...prev };
      delete next[i];
      return next;
    });
    setEditingIndex(null);
    setEditDraft("");
  };

  // --- Save ---
  const handleQuickSave = async (i, content) => {
    setSavedMessages((prev) => ({ ...prev, [i]: "saving" }));
    const name = slugifyResponse(content);
    const res = await saveResponse(campaignName, content, name, "");
    setSavedMessages((prev) => ({ ...prev, [i]: res ? "saved" : "error" }));
  };

  const handleOpenSaveModal = (i, content) => {
    setSaveModal({ index: i, content });
  };

  const handleSaveFromModal = async (fileName, folderPath) => {
    if (!saveModal) return;
    const { index, content } = saveModal;
    setSaveModal(null);
    setSavedMessages((prev) => ({ ...prev, [index]: "saving" }));
    const res = await saveResponse(campaignName, content, fileName, folderPath);
    setSavedMessages((prev) => ({ ...prev, [index]: res ? "saved" : "error" }));
  };

  const getFilesTreeRoot = () => {
    if (campaignData.length === 0) {
      // Fallback: derive from campaign name
      return null;
    }
    const firstPath = campaignData[0].path;
    return firstPath.replace(/[/\\][^/\\]+$/, "");
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
              <div className="px-3 py-6 text-center text-sm text-slate-500">
                No files yet. Create one above to get started.
              </div>
            )}
          </div>

          {/* System Prompts */}
          <div className="mt-6">
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-amber-400">
                System Prompts
              </h3>
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
            <h3 className="text-lg font-semibold text-amber-400">
              DM Assistant
            </h3>
          </div>

          <div className="bg-slate-900/40 border border-slate-700 rounded-lg flex flex-col h-[640px]">
            {/* Message log */}
            <div
              ref={chatLogRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
            >
              {messages.length === 0 && !isSending ? (
                <div className="text-slate-500 italic text-sm">
                  Ask the DM assistant anything about your campaign.
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => {
                    const isUser = msg.role === "user";
                    const isEditing = editingIndex === i;
                    const saveState = savedMessages[i];
                    const saveDisabled =
                      saveState === "saving" || saveState === "saved";

                    return (
                      <div
                        key={i}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                            isUser
                              ? "bg-amber-600/90 text-slate-900 font-medium"
                              : "bg-slate-800 text-slate-200 border border-slate-700"
                          }`}
                        >
                          <div
                            contentEditable={isEditing}
                            suppressContentEditableWarning
                            ref={(el) => {
                              if (
                                isEditing &&
                                el &&
                                document.activeElement !== el
                              ) {
                                el.focus();
                                const range = document.createRange();
                                range.selectNodeContents(el);
                                range.collapse(false);
                                const sel = window.getSelection();
                                sel.removeAllRanges();
                                sel.addRange(range);
                              }
                            }}
                            onBlur={(e) => {
                              if (isEditing) {
                                setEditDraft(e.currentTarget.innerText);
                              }
                            }}
                            onInput={(e) =>
                              setEditDraft(e.currentTarget.innerText)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.preventDefault();
                                handleCancelEdit();
                              }
                            }}
                            className={`outline-none ${
                              isEditing
                                ? "ring-1 ring-amber-500/40 rounded px-1 -mx-1"
                                : ""
                            }`}
                          >
                            {msg.content}
                          </div>

                          {!isUser && (
                            <div className="flex items-center justify-end gap-2 mt-2 pt-1 border-t border-slate-700/60">
                              {msg.edited && (
                                <span className="text-[10px] text-slate-500 italic mr-auto">
                                  edited
                                </span>
                              )}

                              {isEditing ? (
                                <>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleCommitEdit(i)}
                                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors"
                                  >
                                    Done
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() =>
                                      handleStartEdit(i, msg.content)
                                    }
                                    disabled={isSending}
                                    className="text-xs text-slate-500 hover:text-amber-400 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
                                    title="Edit response"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleQuickSave(i, msg.content)
                                    }
                                    disabled={saveDisabled}
                                    className="text-xs text-slate-500 hover:text-amber-400 disabled:text-slate-600 disabled:cursor-default transition-colors"
                                    title="Quick save to root"
                                  >
                                    ⚡
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleOpenSaveModal(i, msg.content)
                                    }
                                    disabled={saveDisabled}
                                    className="text-xs text-slate-500 hover:text-amber-400 disabled:text-slate-600 disabled:cursor-default transition-colors"
                                    title="Save to folder…"
                                  >
                                    {saveState === "saving"
                                      ? "Saving…"
                                      : saveState === "saved"
                                        ? "✓ Saved"
                                        : saveState === "error"
                                          ? "Failed"
                                          : "Save"}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {isSending && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-slate-800 border border-slate-700 text-slate-500 italic">
                        Thinking…
                      </div>
                    </div>
                  )}
                </>
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

              {/* Chat Buttons */}
              <div className="flex items-center mt-2">
                {messages.length > 0 && (
                  <button
                    onClick={() => setMessages([])}
                    className="px-4 h-8 rounded-md bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 font-semibold text-sm transition-colors"
                  >
                    Clear chat
                  </button>
                )}
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || isSending}
                  className="ml-auto px-4 h-8 rounded-md bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 font-semibold text-sm transition-colors"
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
      {saveModal && (
        <SaveToModal
          initialName={slugifyResponse(saveModal.content)}
          tree={campaignData}
          rootPath={getFilesTreeRoot()}
          onConfirm={handleSaveFromModal}
          onClose={() => setSaveModal(null)}
        />
      )}
    </div>
  );
}

export default SelectedCampaign;
