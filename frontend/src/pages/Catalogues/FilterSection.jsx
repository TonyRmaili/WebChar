import React, { useState } from "react";

/* A group of filters inside the filter popup: a small-caps heading with
   a chevron that folds it away, and a hairline to the right. */
export default function FilterSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group mb-1.5 flex w-full select-none items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faded transition hover:text-rubric"
      >
        <span className={`inline-block text-[9px] transition-transform duration-150 ${open ? "rotate-90" : ""}`}>▶</span>
        <span className="shrink-0">{title}</span>
        <span className="ml-1.5 h-px flex-1 bg-rule/25" />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}