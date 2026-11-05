import React, { useMemo, useState } from "react";
import EntityList from "./EntityList";
import ChoiceGroup from "./ChoiceGroup";
import { editionOf, formatFeatTag, skillLabel } from "./wizardHelpers";
import { formatSource } from "../../Catalogues/Backgrounds/backgroundHelpers";

/* ═══════════════════════════════════════════════════════════════════
   BackgroundStep — mirror of RaceStep.

   Backgrounds carry edition:"one" (or no key = classic) exactly like
   races, so the same ruleset chips filter both. Note the catalogue
   screen filters by `source` instead; that is intentional there and
   not shared with the wizard.
   ═══════════════════════════════════════════════════════════════════ */

const subtitle = (bg) => {
  const feat = (bg.feats || [])[0];
  const skills = (bg.skill_proficiencies?.fixed || []).slice(0, 2).map(skillLabel);
  return [feat ? formatFeatTag(feat) : null, skills.join(", ") || null]
    .filter(Boolean)
    .join(" • ");
};

export default function BackgroundStep({
  backgrounds,
  loading,
  editions,
  selectedBackground,
  choices,
  choiceSel,
  overlap,
  onSelectBackground,
  onToggleChoice,
  onAsiChange,
  onPreview,
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (backgrounds || [])
      .filter((b) => {
        if (!b) return false;
        if (!editions.includes(editionOf(b))) return false;
        if (q && !b.name?.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [backgrounds, editions, search]);

  const bgOwned = (choices || []).filter((c) => c.scope === "background");

  return (
    <div className="space-y-4">
      <EntityList
        items={filtered}
        selected={selectedBackground}
        onSelect={onSelectBackground}
        onPreview={onPreview}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search backgrounds…"
        loadingText="Loading backgrounds…"
        emptyText="No backgrounds match."
        renderSubtitle={subtitle}
        sourceTitle={formatSource}
      />

      {selectedBackground && bgOwned.length > 0 && (
        <div className="space-y-4 border-t border-slate-700/60 pt-4">
          {bgOwned.map((c) => (
            <ChoiceGroup
              key={c.id}
              choice={c}
              sel={choiceSel[c.id]}
              overlap={overlap}
              onToggle={onToggleChoice}
              onAsiChange={onAsiChange}
            />
          ))}
        </div>
      )}

      {selectedBackground && bgOwned.length === 0 && (
        <p className="text-xs text-slate-500 italic border-t border-slate-700/60 pt-4">
          {selectedBackground.name} has no choices to make.
        </p>
      )}
    </div>
  );
}