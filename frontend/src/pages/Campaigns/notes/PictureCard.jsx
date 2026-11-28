import React, { useState } from "react";
import { imageFileUrl, useImageUrl } from "./notesApi";

/* ═══════════════════════════════════════════════════════════════════
   PictureCard — a picture file of the campaign as a card (popup type
   "picture"; data { name, path, campaignName }, see fileCards.js).

   It fits the card; click it to see it at full size (then scroll around),
   click again to fit. Resize the card to make it bigger.
   ═══════════════════════════════════════════════════════════════════ */

export default function PictureCard({ picture: ref }) {
  const { src, error } = useImageUrl(imageFileUrl(ref.path));
  const [full, setFull] = useState(false);

  if (!src) {
    return (
      <div className="wc-page flex h-full items-center justify-center !rounded-none p-6 text-sm italic">
        {error ? <span className="text-bad">{error}</span> : <span className="text-ink-faded">Loading the picture…</span>}
      </div>
    );
  }

  return (
    <div className="wc-page relative h-full !rounded-none">
      <div className={`h-full ${full ? "overflow-auto" : "flex items-center justify-center overflow-hidden p-2"}`}>
        <img
          src={src}
          alt={ref.name}
          draggable={false}
          onClick={() => setFull((f) => !f)}
          title={full ? "Click to fit the card" : "Click for full size"}
          className={full ? "max-w-none cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in object-contain"}
        />
      </div>
    </div>
  );
}
