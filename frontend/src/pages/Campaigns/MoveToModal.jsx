import React, { useMemo, useState } from "react";
import { FolderIcon } from "./CampaignWidgets";
import { CreateModal } from "../Catalogues/catalogueStyle";

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

// One folder in the destination list: rubric and washed when picked,
// faint when it can't be picked (the thing being moved, or inside it).
export const folderRowCls = (selected, disabled = false) =>
  `flex w-full items-center gap-2 rounded-sm py-1 pr-2 text-left text-sm transition-colors ${
    disabled ? "cursor-not-allowed text-ink-faint" : selected ? "bg-rubric/10 font-semibold text-rubric" : "text-ink hover:bg-ink/[0.06]"
  }`;

/* "Move <name>" — pick a destination folder in the same tree. */
function MoveToModal({ sourceNode, tree, rootPath, onConfirm, onClose }) {
  const [selected, setSelected] = useState(null);

  const folders = useMemo(() => flattenFolders(tree), [tree]);

  const handleConfirm = () => {
    if (!selected) return;
    onConfirm(selected);
  };

  return (
    <CreateModal
      open
      title={`Move "${sourceNode.name}"`}
      onClose={onClose}
      onSave={handleConfirm}
      saveDisabled={!selected}
      saveLabel="Move here"
      width="max-w-md"
    >
      <p className="mb-2 text-xs italic text-ink-faded">Choose a destination folder</p>

      {/* Root entry */}
      {rootPath && (
        <button onClick={() => setSelected(rootPath)} className={`${folderRowCls(selected === rootPath)} px-2`}>
          <FolderIcon className="h-4 w-4 shrink-0 text-rubric" />
          <span className="italic">(root)</span>
        </button>
      )}

      {folders.length === 0 && !rootPath ? (
        <div className="px-2 py-4 text-sm italic text-ink-faded">No folders available</div>
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
              className={folderRowCls(isSelected, disabled)}
            >
              <FolderIcon className={`h-4 w-4 shrink-0 ${disabled ? "" : "text-rubric"}`} />
              <span className="truncate">{node.name}</span>
            </button>
          );
        })
      )}
    </CreateModal>
  );
}

export default MoveToModal;