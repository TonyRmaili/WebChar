import React, { useState, useMemo, useEffect, useRef } from "react";
import useCampaignStore from "../../store/CampaignStore";
import {
  PlusIcon,
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
  activePaths,
  onToggleActive,
  onContextMenu,
  renamingPath,
  onRenameCommit,
  onRenameCancel,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isFolder = node.type === "folder";
  const showCheckbox = typeof onToggleActive === "function";
  const isRenaming = renamingPath === node.path;

  const createFile = useCampaignStore((s) => s.createFile);
  const createFolder = useCampaignStore((s) => s.createFolder);

  const filePaths = useMemo(() => {
    const collect = (n) => {
      if (n.type !== "folder") return [n.path];
      return (n.children ?? []).flatMap(collect);
    };
    return collect(node);
  }, [node]);

  const isActive =
    showCheckbox &&
    filePaths.length > 0 &&
    filePaths.every((p) => activePaths?.includes(p));

  const isPartiallyActive =
    showCheckbox &&
    !isActive &&
    filePaths.some((p) => activePaths?.includes(p));

  const handleMainClick = () => {
    if (isRenaming) return;
    if (isFolder) setCollapsed((prev) => !prev);
    else onOpenFile?.(node);
  };

  const handleToggleActive = (e) => {
    e.stopPropagation();
    onToggleActive(filePaths);
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

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e.clientX, e.clientY, node);
  };

  // --- Inline rename input ---
  const inputRef = useRef(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    if (isRenaming) {
      // For files: show stem only (no extension)
      const initial = isFolder
        ? node.name
        : node.name.replace(/\.[^.]+$/, "");
      setRenameValue(initial);
      // Focus on next tick so the input exists
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isRenaming, node.name, isFolder]);

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      onRenameCancel?.();
      return;
    }
    const currentStem = isFolder ? node.name : node.name.replace(/\.[^.]+$/, "");
    if (trimmed === currentStem) {
      onRenameCancel?.();
      return;
    }
    onRenameCommit?.(node.path, trimmed);
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onRenameCancel?.();
    }
  };

  return (
    <div>
      <div
        onClick={handleMainClick}
        onContextMenu={handleContextMenu}
        className="group flex h-7 cursor-pointer select-none items-center rounded-sm pr-1 transition-colors hover:bg-ink/[0.06]"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {showCheckbox && (
          <input
            type="checkbox"
            checked={!!isActive}
            ref={(el) => {
              if (el) el.indeterminate = isPartiallyActive;
            }}
            onClick={(e) => e.stopPropagation()}
            onChange={handleToggleActive}
            disabled={filePaths.length === 0}
            className="mr-2 h-3.5 w-3.5 cursor-pointer accent-rubric disabled:cursor-not-allowed disabled:opacity-40"
          />
        )}

        <span className="flex w-4 shrink-0 items-center justify-center text-ink-faded">
          {isFolder &&
            (collapsed ? (
              <ChevronRightIcon className="w-3.5 h-3.5" />
            ) : (
              <DownArrowIcon className="w-3.5 h-3.5" />
            ))}
        </span>

        <span className={`ml-1 mr-2 shrink-0 ${isFolder ? "text-rubric" : "text-ink-faded"}`}>
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

        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
            className="h-6 flex-1 rounded-none border-0 border-b border-solid border-ink bg-transparent px-0 font-body text-sm text-ink outline-none focus:ring-0"
          />
        ) : (
          <span
            className={`truncate text-sm ${
              isFolder
                ? "font-semibold text-ink"
                : isActive
                ? "font-semibold text-rubric"
                : "text-ink"
            }`}
          >
            {node.name}
          </span>
        )}

        {/* Hover actions: only add-file / add-folder now, no delete */}
        {!isRenaming && isFolder && (
          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleAddFile}
              className="flex h-6 w-6 items-center justify-center rounded text-ink-faded transition hover:text-rubric"
              title="New file"
            >
              <PlusIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleAddFolder}
              className="flex h-6 w-6 items-center justify-center rounded text-ink-faded transition hover:text-rubric"
              title="New folder"
            >
              <FolderPlusIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
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
              activePaths={activePaths}
              onToggleActive={onToggleActive}
              onContextMenu={onContextMenu}
              renamingPath={renamingPath}
              onRenameCommit={onRenameCommit}
              onRenameCancel={onRenameCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CampaignNode;