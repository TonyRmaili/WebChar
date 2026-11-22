import React from "react";
import { hintCls, labelCls } from "./catalogueStyle";
import { Segmented } from "./catalogueParts";

/* The "Save to" block a catalogue form shows when it edits a character's
   own copy (the sheet's Inventory and Spellbook): this sheet only, or
   the sheet and the player's catalogue too (a homebrew entry; Visibility
   in the form says private or public). `homebrew` is the player's own
   entry the copy comes from: saving updates it unless "as a new entry". */

export default function SheetSaveChoice({ saveTo, setSaveTo, asNew, setAsNew, homebrew }) {
  return (
    <div className="mb-4 space-y-1 rounded border border-rule/40 px-3 py-2">
      <div className={labelCls}>Save to</div>
      <Segmented
        options={[
          { value: "sheet", label: "this sheet only" },
          { value: "catalogue", label: homebrew ? "sheet + my catalogue entry" : "sheet + my catalogue" },
        ]}
        value={saveTo}
        onChange={setSaveTo}
      />
      <p className={hintCls}>
        {saveTo === "sheet"
          ? "Only this character's copy changes. The catalogue is never touched."
          : homebrew && !asNew
            ? `Also updates your catalogue entry "${homebrew.name}" (private or public: Visibility below).`
            : "Also saves it as a new homebrew entry in your catalogue (private or public: Visibility below). The original stays as it is."}
      </p>
      {saveTo === "catalogue" && homebrew && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={asNew} onChange={(e) => setAsNew(e.target.checked)} />
          as a new entry instead
        </label>
      )}
    </div>
  );
}
