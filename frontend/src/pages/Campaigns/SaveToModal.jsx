import React, { useMemo, useState } from "react";
import { FolderIcon } from "./CampaignWidgets";

function flattenFolders(nodes, depth = 0) {
  const out = [];
  for (const n of nodes) {
    if (n.type === "folder") {
      out.push({ node: n, depth });
      if (n.children) out.push(...flattenFolders(n.children, depth + 1));
    }
  }
  return out;
}

function SaveToModal({ initialName, tree, rootPath, onConfirm, onClose }) {
  const [name, setName] = useState(initialName);
  const [selected, setSelected] = useState(rootPath ?? null);

  const folders = useMemo(() => flattenFolders(tree), [tree]);

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed || selected === null) return;
    // empty-string folder means root
    onConfirm(trimmed, selected === rootPath ? "" : selected);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-[460px] max-h-[80vh] flex flex-col"
      >
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="text-amber-400 font-semibold">Save response</h3>
        </div>

        <div className="px-4 py-3 border-b border-slate-700">
          <label className="block text-xs text-slate-400 mb-1">File name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-slate-800 text-slate-100 text-sm px-2 py-1.5 rounded border border-slate-700 focus:border-amber-500/60 outline-none"
          />
          <p className="text-xs text-slate-500 mt-1">.md will be appended automatically</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-h-[180px]">
          <label className="block text-xs text-slate-400 px-2 mb-1">Destination folder</label>

          {rootPath && (
            <button
              onClick={() => setSelected(rootPath)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
                selected === rootPath
                  ? "bg-amber-600/30 text-amber-200"
                  : "text-slate-200 hover:bg-slate-800"
              }`}
            >
              <FolderIcon className="w-4 h-4 text-amber-400" />
              <span className="italic text-slate-400">(root)</span>
            </button>
          )}

          {folders.map(({ node, depth }) => {
            const isSelected = selected === node.path;
            return (
              <button
                key={node.path}
                onClick={() => setSelected(node.path)}
                style={{ paddingLeft: `${8 + depth * 16}px` }}
                className={`w-full flex items-center gap-2 py-1.5 pr-2 rounded text-sm text-left transition-colors ${
                  isSelected
                    ? "bg-amber-600/30 text-amber-200"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                <FolderIcon className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">{node.name}</span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-3 h-8 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!name.trim() || selected === null}
            className="px-4 h-8 rounded-md bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 font-semibold text-sm transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default SaveToModal;