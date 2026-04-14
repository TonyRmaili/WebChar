import React, { useMemo, useState } from "react";
import { FolderIcon } from "./CampaignWidgets";

// Flatten a tree into a list of { node, depth } entries — folders only
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

// True if `candidate` is the source itself or inside it (can't move into self)
function isDescendantOrSelf(candidatePath, sourcePath) {
  if (!sourcePath) return false;
  const normSource = sourcePath.replace(/\\/g, "/");
  const normCand = candidatePath.replace(/\\/g, "/");
  return normCand === normSource || normCand.startsWith(normSource + "/");
}

function MoveToModal({ sourceNode, tree, rootPath, onConfirm, onClose }) {
  const [selected, setSelected] = useState(null);

  const folders = useMemo(() => flattenFolders(tree), [tree]);

  const handleConfirm = () => {
    if (!selected) return;
    onConfirm(selected);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-[440px] max-h-[70vh] flex flex-col"
      >
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="text-amber-400 font-semibold">Move "{sourceNode.name}"</h3>
          <p className="text-xs text-slate-400 mt-1">Choose a destination folder</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {/* Root entry */}
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

          {folders.length === 0 && !rootPath ? (
            <div className="text-slate-500 text-sm italic px-2 py-4">No folders available</div>
          ) : (
            folders.map(({ node, depth }) => {
              const disabled = isDescendantOrSelf(node.path, sourceNode.path);
              const isSelected = selected === node.path;
              return (
                <button
                  key={node.path}
                  disabled={disabled}
                  onClick={() => setSelected(node.path)}
                  style={{ paddingLeft: `${8 + depth * 16}px` }}
                  className={`w-full flex items-center gap-2 py-1.5 pr-2 rounded text-sm text-left transition-colors ${
                    disabled
                      ? "text-slate-600 cursor-not-allowed"
                      : isSelected
                      ? "bg-amber-600/30 text-amber-200"
                      : "text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <FolderIcon className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">{node.name}</span>
                </button>
              );
            })
          )}
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
            disabled={!selected}
            className="px-4 h-8 rounded-md bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 font-semibold text-sm transition-colors"
          >
            Move here
          </button>
        </div>
      </div>
    </div>
  );
}

export default MoveToModal;