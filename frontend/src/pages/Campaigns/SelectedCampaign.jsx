import React, { useEffect, useRef, useState } from "react";
import { PlusIcon } from "./CampaignWidgets";
import useCampaignStore from "../../store/CampaignStore";
import CampaignNode from "./CampaignNode";
import FilePopup from "./FilePopup";

function SelectedCampaign({ campaignName }) {
  const fetchCampaignData = useCampaignStore((s) => s.fetchCampaignData);
  const campaignData = useCampaignStore((s) => s.campaignData);
  const createFile = useCampaignStore((s) => s.createFile);
  const createFolder = useCampaignStore((s) => s.createFolder);
  const saveFile = useCampaignStore((s) => s.saveFile);
  const loading = useCampaignStore((s) => s.loading);
  const error = useCampaignStore((s) => s.error);

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
    fetchCampaignData(campaignName).then(() => setHasLoadedOnce(true));
  }, [campaignName, fetchCampaignData]);

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
      moveWindow(win.id, originX + (ev.clientX - startX), originY + (ev.clientY - startY));
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
      resizeWindow(win.id, originW + (ev.clientX - startX), originH + (ev.clientY - startY));
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

      <div className="flex gap-2 mb-4">
        <button
          className="px-2 h-7 border rounded-sm bg-slate-800 text-amber-500 flex items-center gap-2"
          onClick={handleAddFileRoot}
        >
          <PlusIcon className="w-4 h-4" />
          File
        </button>

        <button
          className="px-2 h-7 border rounded-sm bg-slate-800 text-amber-500 flex items-center gap-2"
          onClick={handleAddFolderRoot}
        >
          <PlusIcon className="w-4 h-4" />
          Folder
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {campaignData?.map((node) => (
          <CampaignNode
            key={node.path}
            campaignName={campaignName}
            node={node}
            onOpenFile={handleOpenFile}
          />
        ))}
      </div>

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