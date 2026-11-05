import React, { useState } from "react";

export default function FilterSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 uppercase tracking-wider text-amber-400
                   mb-1.5 hover:text-amber-300 transition select-none"
      >
        <span
          className={`text-[10px] inline-block transition-transform duration-150
                      ${open ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        <span>{title}</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}