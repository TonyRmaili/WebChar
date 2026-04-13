import React, { useState } from "react";
import useCampaignStore from "../../store/CampaignStore";
import {
  PlusIcon,
  MinusIcon,
  DownArrowIcon,
  FolderPlusIcon,
  FolderIcon,
  FolderOpenIcon,
  FileIcon,
  ChevronRightIcon,
} from "./CampaignWidgets";

function CampaignNode({
  node,
  campaignName,
  depth = 0,
  onOpenFile,
  activePrompts,
  onToggleActive,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isFolder = node.type === "folder";
  const showCheckbox = !isFolder && typeof onToggleActive === "function";
  const isActive = showCheckbox && activePrompts?.includes(node.path);

  const deleteFile = useCampaignStore((s) => s.deleteFile);
  const createFile = useCampaignStore((s) => s.createFile);
  const createFolder = useCampaignStore((s) => s.createFolder);

  const handleMainClick = () => {
    if (isFolder) setCollapsed((prev) => !prev);
    else onOpenFile?.(node);
  };

  const handleAddFile = (e) => {
    e.stopPropagation();
    const fileName = prompt(`Enter file name for "${node.name}"`);
    if (!fileName) return;
    createFile(fileName, campaignName, node.path);
    setCollapsed(false);
  };

  const handleAddFolder = (e) => {
    e.stopPropagation();
    const folderName = prompt(`Enter folder name for "${node.name}"`);
    if (!folderName) return;
    createFolder(folderName, campaignName, node.path);
    setCollapsed(false);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    const msg = isFolder
      ? `Delete folder "${node.name}" and everything inside?`
      : `Delete file "${node.name}"?`;
    if (!window.confirm(msg)) return;
    deleteFile(node.name, node.path);
  };

  const handleToggleActive = (e) => {
    e.stopPropagation();
    onToggleActive(node.path);
  };

  return (
    <div>
      <div
        onClick={handleMainClick}
        className="group flex items-center h-7 pr-1 rounded-md hover:bg-slate-800/70 cursor-pointer transition-colors select-none"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {/* checkbox (prompts only) */}
        {showCheckbox && (
          <input
            type="checkbox"
            checked={!!isActive}
            onClick={(e) => e.stopPropagation()}
            onChange={handleToggleActive}
            className="mr-2 accent-amber-500 cursor-pointer"
          />
        )}

        {/* chevron */}
        <span className="w-4 flex items-center justify-center shrink-0 text-slate-500">
          {isFolder &&
            (collapsed ? (
              <ChevronRightIcon className="w-3.5 h-3.5" />
            ) : (
              <DownArrowIcon className="w-3.5 h-3.5" />
            ))}
        </span>

        {/* icon */}
        <span className={`shrink-0 ml-1 mr-2 ${isFolder ? "text-amber-400" : "text-sky-400"}`}>
          {isFolder ? (
            collapsed ? (
              <FolderIcon className="w-4 h-4" />
            ) : (
              <FolderOpenIcon className="w-4 h-4" />
            )
          ) : (
            <FileIcon className="w-4 h-4" />
          )}
        </span>

        {/* name */}
        <span
          className={`truncate text-sm ${
            isFolder
              ? "text-amber-100 font-medium"
              : isActive
              ? "text-amber-200 font-medium"
              : "text-slate-200"
          }`}
        >
          {node.name}
        </span>

        {/* hover actions */}
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {isFolder && (
            <>
              <button
                onClick={handleAddFile}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 text-sky-400"
                title="New file"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleAddFolder}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 text-amber-400"
                title="New folder"
              >
                <FolderPlusIcon className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={handleDelete}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-900/60 text-red-400"
            title="Delete"
          >
            <MinusIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isFolder && !collapsed && node.children?.length > 0 && (
        <div>
          {node.children.map((child) => (
            <CampaignNode
              key={child.path}
              node={child}
              depth={depth + 1}
              campaignName={campaignName}
              onOpenFile={onOpenFile}
              activePrompts={activePrompts}
              onToggleActive={onToggleActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CampaignNode;