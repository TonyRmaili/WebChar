import React from "react";
import { INK } from "../../../styles/parchment";

/* A character's token: a round portrait with a dark leather rim, the
   name in ink underneath.

   Ready for images: when the character has a token image (`token_url`,
   or `token` — whatever the backend ends up storing on the roster entry)
   it fills the circle. Until then the circle stays plain with the
   initials, on purpose.

   `active` = used on the Sheets page; drawn as a rust ring around the rim. */

export function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export const tokenImage = (character) => character?.token_url || character?.token || null;

export default function CharacterToken({ character, active, onClick, onContextMenu, onMenuButton }) {
  const image = tokenImage(character);
  return (
    <div className="group relative flex w-24 flex-col items-center" onContextMenu={onContextMenu}>
      <button
        type="button"
        onClick={onClick}
        title={active ? "In Sheets — click to take them out" : "Click to use in Sheets"}
        aria-pressed={!!active}
        aria-label={`${character.name}${active ? ", in Sheets" : ""}`}
        className="relative rounded-full outline-none transition-transform duration-150 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-rubric/60"
      >
        {/* Rust ring when the character is in Sheets */}
        <span
          aria-hidden="true"
          className={`absolute -inset-[5px] rounded-full border-2 transition ${active ? "border-rubric" : "border-transparent group-hover:border-rule/40"}`}
        />
        {/* Leather rim + portrait */}
        <span
          className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full"
          style={{
            // a parchment disc in a leather rim — theme slots, so it follows the theme
            background: "radial-gradient(circle at 35% 30%, rgb(var(--c-page-light)), rgb(var(--c-page)) 70%)",
            boxShadow:
              "0 0 0 3px rgb(var(--c-desk)), 0 0 0 4px rgb(var(--c-stitch) / 0.35), 0 3px 8px rgba(0,0,0,0.35), inset 0 2px 6px rgb(var(--c-desk) / 0.35), inset 0 0 12px rgb(var(--c-rule) / 0.45)",
          }}
        >
          {image ? (
            <img src={image} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <span className={`text-xl tracking-wide ${INK.faded}`}>{initials(character.name)}</span>
          )}
        </span>
      </button>

      {/* More: same menu as right-click, for touch screens and discoverability */}
      <button
        type="button"
        onClick={onMenuButton}
        aria-label={`More for ${character.name}`}
        title="More…"
        className={`absolute right-0 top-0 h-6 w-6 rounded-full text-base leading-none opacity-0 transition group-hover:opacity-100 focus:opacity-100 ${INK.faded} hover:text-ink`}
      >
        ⋯
      </button>

      <p className="mt-2.5 w-full truncate text-center text-[15px] leading-tight" title={character.name}>
        {character.name}
      </p>
      <p className={`h-4 text-[10px] italic ${active ? INK.rubric : "text-transparent"}`}>in Sheets</p>
    </div>
  );
}