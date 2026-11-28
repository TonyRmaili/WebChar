import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ReactRenderer } from "@tiptap/react";

/* The little list that opens while you type "@…" or "[[…" in a note:
   arrows to move, Enter or Tab to link, Escape to leave it be. It floats
   over everything (fixed, on the page itself), just under the cursor. */

const CARD_EDGE = "0 0 0 1px rgb(var(--c-desk) / 0.55), 0 12px 32px rgba(0,0,0,0.45)";

const LinkMenu = forwardRef(function LinkMenu({ items, command, query, emptyHint }, ref) {
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [items]);

  const pick = (i) => items[i] && command(items[i]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (!items.length) return false;
      if (event.key === "ArrowDown") {
        setActive((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setActive((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        pick(active);
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="w-72 overflow-hidden rounded-[3px] bg-page font-body text-ink" style={{ boxShadow: CARD_EDGE }}>
      {items.length === 0 ? (
        <div className="px-3 py-2 text-sm italic text-ink-faded">{query.trim() ? "Nothing by that name" : emptyHint}</div>
      ) : (
        <ul className="max-h-72 overflow-y-auto py-1">
          {items.map((it, i) => (
            <li key={`${it.kind}-${it.id}`}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(i);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-baseline gap-2 px-3 py-1 text-left ${i === active ? "bg-ink/[0.08]" : ""}`}
              >
                <span className="w-16 shrink-0 truncate text-[10px] font-semibold uppercase tracking-wider text-ink-faded">{it.badge}</span>
                <span className={`min-w-0 flex-1 truncate text-sm ${i === active ? "text-rubric" : ""}`}>{it.label}</span>
                {it.source && <span className="shrink-0 text-[10px] uppercase tracking-wider text-ink-faded">{it.source}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

// The suggestion's `render` for Tiptap: puts LinkMenu on the page and keeps
// it under the cursor while the words change.
export function linkMenuRender(emptyHint) {
  return () => {
    let menu = null;
    let box = null;
    const place = (rect) => {
      if (!box || !rect) return;
      const below = rect.bottom + 4;
      const fitsBelow = below + 300 < window.innerHeight;
      box.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
      box.style.top = fitsBelow ? `${below}px` : "";
      box.style.bottom = fitsBelow ? "" : `${window.innerHeight - rect.top + 4}px`;
    };
    return {
      onStart: (props) => {
        menu = new ReactRenderer(LinkMenu, { props: { ...props, emptyHint }, editor: props.editor });
        box = document.createElement("div");
        box.style.position = "fixed";
        box.style.zIndex = "2147483000";
        box.appendChild(menu.element);
        document.body.appendChild(box);
        place(props.clientRect?.());
      },
      onUpdate: (props) => {
        menu?.updateProps({ ...props, emptyHint });
        place(props.clientRect?.());
      },
      onKeyDown: ({ event }) => {
        if (!box) return false; // put away with Escape: keys are the note's again
        if (event.key === "Escape") {
          box?.remove();
          box = null;
          return true;
        }
        return menu?.ref?.onKeyDown(event) ?? false;
      },
      onExit: () => {
        box?.remove();
        box = null;
        menu?.destroy();
        menu = null;
      },
    };
  };
}

export default LinkMenu;
