import React, { useMemo, useState } from "react";
import { FolderIcon } from "./CampaignWidgets";
import { CreateModal, fieldCls, hintCls, labelCls } from "../Catalogues/catalogueStyle";
import { folderRowCls } from "./MoveToModal";

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

/* "Save response" — a file name and a destination folder for an assistant
   reply. Enter saves, Escape closes. */
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
    <CreateModal
      open
      title="Save response"
      onClose={onClose}
      onSave={handleConfirm}
      saveDisabled={!name.trim() || selected === null}
      width="max-w-md"
    >
      <div className="mb-4">
        <label className={labelCls}>File name</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={handleKeyDown} className={fieldCls} />
        <p className={`${hintCls} mt-1`}>.md will be appended automatically</p>
      </div>

      <label className={labelCls}>Destination folder</label>
      <div className="min-h-[160px]">
        {rootPath && (
          <button onClick={() => setSelected(rootPath)} className={`${folderRowCls(selected === rootPath)} px-2`}>
            <FolderIcon className="h-4 w-4 shrink-0 text-rubric" />
            <span className="italic">(root)</span>
          </button>
        )}

        {folders.map(({ node, depth }) => (
          <button
            key={node.path}
            onClick={() => setSelected(node.path)}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
            className={folderRowCls(selected === node.path)}
          >
            <FolderIcon className="h-4 w-4 shrink-0 text-rubric" />
            <span className="truncate">{node.name}</span>
          </button>
        ))}
      </div>
    </CreateModal>
  );
}

export default SaveToModal;