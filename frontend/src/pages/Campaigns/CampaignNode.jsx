import React, { useState, useMemo, useEffect, useRef } from "react";
import useCampaignStore from "../../store/CampaignStore";
import {
  PlusIcon,
  DownArrowIcon,
  FolderPlusIcon,
  FolderIcon,
  FolderOpenIcon,
  FileIcon,
  ImageIcon,
  PromptIcon,
  ChevronRightIcon,
} from "./CampaignWidgets";

/* One row of a campaign tree (a folder, a note, a picture or a prompt), and
   the rows inside it. The box ticks what the DM Assistant reads; pictures
   have none, since the assistant can't look at pictures yet. */

// Notes and prompts show without ".json" / ".md"; pictures keep theirs.
const shownName = (node) => (node.type === "folder" || node.kind === "image" ? node.name : node.name.replace(/\.[^.]+$/, ""));
const readable = (n) => n.type !== "folder" && n.kind !== "image";

// Under a file the search found: the words around the hit, the hit in ink.
function Snippet({ text, query, depth }) {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  return (
    <p className="truncate pb-1 pr-2 text-xs italic text-ink-faded" style={{ paddingLeft: `${depth * 16 + 52}px` }} title={text}>
      {at < 0 ? (
        text
      ) : (
        <>
          {text.slice(0, at)}
          <span className="font-semibold not-italic text-ink">{text.slice(at, at + query.length)}</span>
          {text.slice(at + query.length)}
        </>
      )}
    </p>
  );
}

function CampaignNode({
  node,
  campaignName,
  depth = 0,
  onOpenFile,
  onAddNote,
  onAddPicture,
  activePaths,
  onToggleActive,
  onContextMenu,
  renamingPath,
  onRenameCommit,
  onRenameCancel,
  found, // while searching: { query, snippets: { path: words around the hit } }; folders stay open
}) {
  const [collapsed, setCollapsed] = useState(false);
  const shut = !found && collapsed;
  const isFolder = node.type === "folder";
  const showCheckbox = typeof onToggleActive === "function";
  const isRenaming = renamingPath === node.path;

  const createFolder = useCampaignStore((s) => s.createFolder);

  const filePaths = useMemo(() => {
    const collect = (n) => {
      if (n.type !== "folder") return readable(n) ? [n.path] : [];
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
    setCollapsed(false);
    onAddNote?.(node.path);
  };

  const handleAddPicture = (e) => {
    e.stopPropagation();
    setCollapsed(false);
    onAddPicture?.(node.path);
  };

  const handleAddFolder = (e) => {
    e.stopPropagation();
    const folderName = prompt(`Name of the new folder in "${node.name}"`);
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
        {showCheckbox && !isFolder && !readable(node) && <span className="mr-2 w-3.5 shrink-0" aria-hidden="true" />}
        {showCheckbox && (isFolder || readable(node)) && (
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
            (shut ? (
              <ChevronRightIcon className="w-3.5 h-3.5" />
            ) : (
              <DownArrowIcon className="w-3.5 h-3.5" />
            ))}
        </span>

        <span className={`ml-1 mr-2 shrink-0 ${isFolder ? "text-rubric" : "text-ink-faded"}`}>
          {isFolder ? (
            shut ? (
              <FolderIcon className="w-4 h-4" />
            ) : (
              <FolderOpenIcon className="w-4 h-4" />
            )
          ) : node.kind === "image" ? (
            <ImageIcon className="w-4 h-4" />
          ) : node.kind === "prompt" ? (
            <PromptIcon className="w-4 h-4" />
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
            {shownName(node)}
          </span>
        )}

        {/* Hover actions on a folder: add a note (or prompt), pictures, a folder */}
        {!isRenaming && isFolder && (
          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleAddFile}
              className="flex h-6 w-6 items-center justify-center rounded text-ink-faded transition hover:text-rubric"
              title={onAddPicture ? "New note" : "New prompt"}
            >
              <PlusIcon className="w-3.5 h-3.5" />
            </button>
            {onAddPicture && (
              <button
                onClick={handleAddPicture}
                className="flex h-6 w-6 items-center justify-center rounded text-ink-faded transition hover:text-rubric"
                title="Add pictures"
              >
                <ImageIcon className="w-3.5 h-3.5" />
              </button>
            )}
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

      {!isFolder && found?.snippets[node.path] && <Snippet text={found.snippets[node.path]} query={found.query} depth={depth} />}

      {isFolder && !shut && node.children?.length > 0 && (
        <div>
          {node.children.map((child) => (
            <CampaignNode
              key={child.path}
              node={child}
              depth={depth + 1}
              campaignName={campaignName}
              onOpenFile={onOpenFile}
              onAddNote={onAddNote}
              onAddPicture={onAddPicture}
              activePaths={activePaths}
              onToggleActive={onToggleActive}
              onContextMenu={onContextMenu}
              renamingPath={renamingPath}
              onRenameCommit={onRenameCommit}
              onRenameCancel={onRenameCancel}
              found={found}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CampaignNode;