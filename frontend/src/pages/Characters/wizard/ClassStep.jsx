import React, { useMemo, useState } from "react";
import ChoiceGroup from "./ChoiceGroup";
import EntityList from "./EntityList";
import { chip } from "./wizardHelpers";
import {
  classKeys, classVariant, classDisplayName, availableEditions,
  subclassUnlockLevel, subclassOptions, featuresEarned,
  classFeatSlots, isEpicBoonFeat,
  multiclassRequirements, levelBudget, totalLevel, isCaster,
  MAX_CHARACTER_LEVEL,
} from "./classEngine";

/* ═══════════════════════════════════════════════════════════════════
   ClassStep — multiclass-aware class picker.

   Entries are ordered and entry 0 is the primary class: only it grants
   full starting proficiencies and starting equipment. Reordering is
   therefore meaningful, so the first row is labelled as primary.

   The subclass picker appears exactly when the data says it should —
   `subclassUnlockLevel` reads the lowest level any subclass has a
   feature at. Feat slots work the same way via `classFeatSlots`, which
   also folds in the Epic Boon bonus slot once the primary class's OWN
   level (One D&D only) reaches the Epic Boon's own unlock level — not
   the multiclass total, so a 10/9 split reaching 19 combined does not
   qualify.
   ═══════════════════════════════════════════════════════════════════ */

const ABIL = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };

function LevelStepper({ level, max, onChange }) {
  const set = (v) => onChange(Math.max(1, Math.min(max, v)));
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => set(level - 1)}
        disabled={level <= 1}
        className="h-6 w-6 rounded border border-slate-600 bg-slate-800/70 text-amber-200
                   leading-none disabled:opacity-30 hover:border-amber-500/60"
      >
        −
      </button>
      <input
        type="number"
        min={1}
        max={max}
        value={level}
        onChange={(e) => set(Number(e.target.value) || 1)}
        className="w-12 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-center
                   text-sm tabular-nums text-amber-100 outline-none focus:border-amber-500/60
                   [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => set(level + 1)}
        disabled={level >= max}
        className="h-6 w-6 rounded border border-slate-600 bg-slate-800/70 text-amber-200
                   leading-none disabled:opacity-30 hover:border-amber-500/60"
      >
        +
      </button>
    </div>
  );
}

function FeatureList({ variant, level, subclass }) {
  const [open, setOpen] = useState(false);
  const feats = useMemo(
    () => featuresEarned(variant, level, subclass),
    [variant, level, subclass]
  );
  if (!feats.length) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider
                   text-slate-400 hover:text-amber-300 transition select-none"
      >
        <span className={`inline-block transition-transform duration-150 ${open ? "rotate-90" : ""}`}>▶</span>
        Features earned
        <span className="text-amber-300/80 normal-case">({feats.length})</span>
      </button>

      {open && (
        <div className="mt-1.5 space-y-0.5 pl-3 max-h-44 overflow-y-auto pr-1">
          {feats.map((f, i) => (
            <div key={`${f.level}-${f.name}-${i}`} className="flex gap-2 text-[11px]">
              <span className="w-5 shrink-0 tabular-nums text-slate-500">{f.level}</span>
              <span className={f.from === "subclass" ? "text-cyan-300/90" : "text-slate-300"}>
                {f.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubclassPicker({ variant, entry, onChange }) {
  const unlock = subclassUnlockLevel(variant);
  const options = subclassOptions(variant);
  if (unlock == null || !options.length) return null;

  const locked = (Number(entry.level) || 0) < unlock;

  if (locked) {
    return (
      <div className="text-[11px] text-slate-500 italic">
        Subclass unlocks at level {unlock}.
      </div>
    );
  }

  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-amber-400 mb-1.5">
        Subclass
        <span className="ml-1.5 normal-case text-slate-500">(from level {unlock})</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((sc) => (
          <button
            key={sc.name}
            type="button"
            onClick={() => onChange(entry.subclass === sc.name ? null : sc.name)}
            className={chip(entry.subclass === sc.name)}
          >
            {sc.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/* Feats a class currently grants via its ASI-derived (+ Epic Boon, where
   eligible) slots. Cross-entry so the same feat can't be double-picked if
   the character has more than one class — most feats are a one-time take. */
function FeatSlotsPicker({ feats, loading, entry, slots, epicBoonEligible, allEntries, onChangeFeats, onPreview }) {
  const [search, setSearch] = useState("");
  const picked = entry.feats || [];

  const takenElsewhere = useMemo(() => {
    const set = new Set();
    (allEntries || []).forEach((e) => {
      if (e.key === entry.key) return;
      (e.feats || []).forEach((f) => set.add(`${f.name}__${f.source}`));
    });
    return set;
  }, [allEntries, entry.key]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (feats || [])
      .filter((f) => f && !takenElsewhere.has(`${f.name}__${f.source}`))
      .filter((f) => epicBoonEligible || !isEpicBoonFeat(f))
      .filter((f) => !q || f.name?.toLowerCase().includes(q))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [feats, search, takenElsewhere, epicBoonEligible]);

  if (slots <= 0) return null;

  const toggle = (f) => {
    const already = picked.some((p) => p.name === f.name && p.source === f.source);
    if (already) {
      onChangeFeats(entry.key, picked.filter((p) => !(p.name === f.name && p.source === f.source)));
    } else if (picked.length < slots) {
      onChangeFeats(entry.key, [...picked, { name: f.name, source: f.source }]);
    }
  };

  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-amber-400 mb-1.5">
        Feats
        <span className="ml-1.5 normal-case text-slate-500">
          {picked.length}/{slots} selected
          {epicBoonEligible ? " · Epic Boon available" : ""}
        </span>
      </div>
      <EntityList
        items={filtered}
        selected={picked}
        onSelect={toggle}
        onPreview={onPreview}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search feats…"
        loadingText="Loading feats…"
        emptyText="No feats match."
        renderSubtitle={(f) => (isEpicBoonFeat(f) ? "Epic Boon" : null)}
        isDisabled={() => picked.length >= slots}
      />
    </div>
  );
}

function RequirementNote({ variant }) {
  const req = multiclassRequirements(variant);
  if (!req) {
    return (
      <span className="text-[10px] text-slate-600 italic">
        no multiclass requirements in data
      </span>
    );
  }
  const text = req.pairs
    .map(([a, n]) => `${ABIL[a] || a.toUpperCase()} ${n}`)
    .join(req.connector === "or" ? " or " : " and ");
  return <span className="text-[10px] text-slate-500 italic">requires {text}</span>;
}

export default function ClassStep({
  classes,
  loading,
  editions,
  entries,
  choices,
  choiceSel,
  overlap,
  feats,
  loadingFeats,
  onAddClass,
  onRemoveClass,
  onChangeLevel,
  onChangeEdition,
  onChangeSubclass,
  onChangeFeats,
  onPreviewFeat,
  onToggleChoice,
  onAsiChange,
  levelCap = MAX_CHARACTER_LEVEL,
}) {
  const [adding, setAdding] = useState(false);

  const allKeys = useMemo(() => classKeys(classes, editions), [classes, editions]);
  const taken = useMemo(() => new Set((entries || []).map((e) => e.key)), [entries]);
  const addable = allKeys.filter((k) => !taken.has(k));

  const total = totalLevel(entries);
  const atCap = total >= levelCap;

  if (loading) {
    return <div className="py-8 text-center text-sm text-slate-500">Loading classes…</div>;
  }
  if (!classes || allKeys.length === 0) {
    return <div className="py-8 text-center text-sm text-slate-500">No classes available.</div>;
  }

  return (
    <div className="space-y-4">
      {/* total level */}
      <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
        <span className="text-[11px] uppercase tracking-wider text-slate-400">Character level</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700/60">
          <div
            className="h-full rounded-full bg-amber-500/70 transition-all"
            style={{ width: `${(total / levelCap) * 100}%` }}
          />
        </div>
        <span className="text-sm font-bold tabular-nums text-amber-200">
          {total}<span className="text-slate-500">/{levelCap}</span>
        </span>
      </div>

      {/* class entries */}
      {(entries || []).map((entry, index) => {
        const variant = classVariant(classes, entry.key, entry.edition);
        if (!variant) return null;

        const isPrimary = index === 0;
        const eds = availableEditions(classes, entry.key).filter((e) => editions.includes(e));
        const max = levelBudget(entries, entry.key, levelCap);
        // Every class choice id is namespaced `class.<key>.…`, so the prefix
        // is an exact ownership test.
        const prefix = `class.${entry.key}.`;
        const owned = (choices || []).filter((c) => c.id?.startsWith(prefix));
        const { slots: featSlots, epicBoonEligible } = classFeatSlots({
          entry, index, variant, feats,
        });

        return (
          <div
            key={entry.key}
            className="rounded-lg border border-slate-700 bg-slate-800/30 p-3 space-y-3"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-amber-200">
                  {classDisplayName(classes, entry.key, entry.edition)}
                </span>
                {isPrimary ? (
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded
                                   border border-amber-500/40 text-amber-300/90">
                    primary
                  </span>
                ) : (
                  <RequirementNote variant={variant} />
                )}
                {isCaster(variant) && (
                  <span className="text-[9px] uppercase tracking-wider text-cyan-400/70">caster</span>
                )}
              </div>

              {eds.length > 1 && (
                <div className="flex gap-1">
                  {eds.map((ed) => (
                    <button
                      key={ed}
                      type="button"
                      onClick={() => onChangeEdition(entry.key, ed)}
                      className={chip(entry.edition === ed)}
                    >
                      {ed === "one" ? "One" : "Classic"}
                    </button>
                  ))}
                </div>
              )}

              <div className="ml-auto flex items-center gap-3">
                <LevelStepper
                  level={entry.level}
                  max={max}
                  onChange={(lv) => onChangeLevel(entry.key, lv)}
                />
                <button
                  type="button"
                  onClick={() => onRemoveClass(entry.key)}
                  title="Remove class"
                  className="px-2 py-1 rounded border border-slate-600 text-slate-400 text-xs
                             hover:border-red-500/40 hover:text-red-300 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {!isPrimary && (
              <p className="text-[10px] text-slate-500 italic">
                Multiclass — grants only the reduced proficiencies, no starting equipment.
              </p>
            )}

            <SubclassPicker
              variant={variant}
              entry={entry}
              onChange={(name) => onChangeSubclass(entry.key, name)}
            />

            <FeatureList variant={variant} level={entry.level} subclass={entry.subclass} />

            <FeatSlotsPicker
              feats={feats}
              loading={loadingFeats}
              entry={entry}
              slots={featSlots}
              epicBoonEligible={epicBoonEligible}
              allEntries={entries}
              onChangeFeats={onChangeFeats}
              onPreview={onPreviewFeat}
            />

            {owned.filter((c) => c.kind !== "subclass").length > 0 && (
              <div className="space-y-4 border-t border-slate-700/60 pt-3">
                {owned
                  .filter((c) => c.kind !== "subclass")
                  .map((c) => (
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
          </div>
        );
      })}

      {/* add a class */}
      {addable.length > 0 && !atCap && (
        adding ? (
          <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider text-amber-400">
                {entries?.length ? "Add a class" : "Choose a class"}
              </span>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="text-slate-500 hover:text-slate-300 text-sm px-1"
              >
                ×
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {addable.map((key) => {
                const ed = availableEditions(classes, key).find((e) => editions.includes(e));
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { onAddClass(key, ed); setAdding(false); }}
                    className={chip(false)}
                  >
                    {classDisplayName(classes, key, ed)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full py-2 rounded-lg border border-dashed border-slate-600 text-slate-400
                       text-sm hover:border-amber-500/40 hover:text-amber-300 transition"
          >
            {entries?.length ? "+ Multiclass" : "+ Choose a class"}
          </button>
        )
      )}

      {atCap && (
        <p className="text-center text-[11px] text-slate-500 italic">
          Character level {levelCap} reached.
        </p>
      )}
    </div>
  );
}