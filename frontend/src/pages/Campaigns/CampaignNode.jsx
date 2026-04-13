import React, { useState } from "react";
import useCampaignStore from "../../store/CampaignStore";
import {
  PlusIcon,
  MinusIcon,
  DownArrowIcon,
  UpArrowIcon,
  FolderPlusIcon,
} from "./CampaignWidgets";

function CampaignNode({ node, campaignName, depth = 0, onOpenFile }) {
  const [collapsed, setCollapsed] = useState(false);
  const isFolder = node.type === "folder";

  const deleteFile = useCampaignStore((s) => s.deleteFile);
  const createFile = useCampaignStore((s) => s.createFile);
  const createFolder = useCampaignStore((s) => s.createFolder);

  const handleMainClick = () => {
    if (isFolder) {
      setCollapsed((prev) => !prev);
    } else {
      onOpenFile?.(node);
    }
  };

  const handleAddFile = () => {
    if (!isFolder) return;
    const fileName = prompt(`Enter file name for "${node.name}"`);
    if (!fileName) return;

    createFile(fileName, campaignName, node.path);
  };

  const handleAddFolder = () => {
    if (!isFolder) return;
    const folderName = prompt(`Enter folder name for "${node.name}"`);
    if (!folderName) return;

    createFolder(folderName, campaignName, node.path);
  };

  const handleDeleteFile = () => {
    deleteFile(node.name, node.path);
  };

  return (
    <div>
      <div
        className="flex items-center ml-2"
        style={{ marginLeft: `${depth * 16}px` }}
      >
        <button
          onClick={handleMainClick}
          className="px-2 text-left border rounded-sm border-r-0 bg-slate-800 min-w-[240px] h-6 text-white flex items-center"
        >
          <span className="w-4 flex items-center justify-center shrink-0 mr-2">
            {isFolder ? (
              collapsed ? (
                <DownArrowIcon className="w-4 h-4 text-amber-500" />
              ) : (
                <UpArrowIcon className="w-4 h-4 text-amber-500" />
              )
            ) : (
              <span className="text-sky-400">•</span>
            )}
          </span>

          <span className={`truncate ${isFolder ? "text-amber-300" : "text-sky-300"}`}>
            {node.name}
          </span>
        </button>

        {isFolder && (
          <button
            onClick={handleAddFile}
            className="w-6 h-6 text-sky-400 border border-l-0 bg-slate-800 flex items-center justify-center"
            title="Add file"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        )}

        {isFolder && (
          <button
            onClick={handleAddFolder}
            className="w-6 h-6 text-amber-400 border border-l-0 bg-slate-800 flex items-center justify-center"
            title="Add folder"
          >
            <FolderPlusIcon className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={handleDeleteFile}
          className="w-6 h-6 text-red-400 border border-l-0 bg-slate-800 rounded-sm flex items-center justify-center"
          title="Delete"
        >
          <MinusIcon className="w-4 h-4" />
        </button>
      </div>

      {isFolder && !collapsed && node.children?.length > 0 && (
        <div className="mt-1">
          {node.children.map((child) => (
            <CampaignNode
              key={child.path}
              node={child}
              depth={depth + 1}
              campaignName={campaignName}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CampaignNode;