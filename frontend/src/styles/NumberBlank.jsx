import React, { useState } from "react";

/* A number input with no look of its own — every style file in this
   folder wraps it with its own classes.

   It keeps what you type as a "draft" and only sends a number when you
   press Enter or click away, so you can clear the box and retype without
   it snapping back. Escape cancels. Sends `fallback` (default null) when
   left empty, and clamps to min/max. */

const noSpin =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export default function NumberBlank({ value, onChange, min, max, fallback = null, className = "", ...rest }) {
  const [draft, setDraft] = useState(null);

  const commit = () => {
    if (draft == null) return;
    const trimmed = String(draft).trim();
    let n = trimmed === "" ? fallback : Math.trunc(Number(trimmed));
    if (n != null && !Number.isFinite(n)) n = fallback;
    if (n != null && min != null) n = Math.max(min, n);
    if (n != null && max != null) n = Math.min(max, n);
    if (n !== value) onChange(n);
    setDraft(null);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      value={draft ?? (value ?? "")}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
      className={`${noSpin} text-center tabular-nums ${className}`}
      {...rest}
    />
  );
}