import React, { useEffect } from "react";

function CampaignContextMenu({ x, y, node, onAction, onClose }) {
  useEffect(() => {
    const handleClick = () => onClose();
    const handleKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const isFolder = node.type === "folder";

  const items = [
    { label: "Rename", action: "rename" },
    { label: "Move to…", action: "move" },
    ...(isFolder ? [] : [{ label: "Copy", action: "copy" }]),
    { label: "Delete", action: "delete", danger: true },
  ];

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className="fixed z-50 bg-slate-800 border border-slate-700 rounded-md shadow-lg py-1 min-w-[150px]"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-1 text-xs text-slate-500 truncate border-b border-slate-700 mb-1">
        {node.name}
      </div>
      {items.map((item) => (
        <button
          key={item.action}
          onClick={() => {
            onAction(item.action, node);
            onClose();
          }}
          className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 transition-colors ${
            item.danger ? "text-red-400" : "text-slate-200"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default CampaignContextMenu;