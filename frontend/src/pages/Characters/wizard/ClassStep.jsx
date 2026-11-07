import React, { useMemo, useState } from "react";
import { INK, InkButton, InkChoice, InkRemove, Line } from "../../../styles/parchment";
import ChoiceGroup from "./ChoiceGroup";
import EntityList from "./EntityList";
import { ChoiceHead, Note, Pick, PickRow, Stepper } from "./wizardInk";
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
   full starting proficiencies and starting equipment, so the first one
   is marked "primary".

   The subclass picker appears exactly when the data says it should —
   `subclassUnlockLevel` reads the lowest level any subclass has a
   feature at. Feat slots work the same way via `classFeatSlots`, which
   also folds in the Epic Boon bonus slot once this class's OWN level
   (One D&D only) reaches 19 — not the multiclass total.
   ═══════════════════════════════════════════════════════════════════ */

const ABIL = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };

function FeatureList({ variant, level, subclass }) {
  const [open, setOpen] = useState(false);
  const features = useMemo(() => featuresEarned(variant, level, subclass), [variant, level, subclass]);
  if (!features.length) return null;

  return (
    <div>
      <InkButton onClick={() => setOpen((o) => !o)}>
        {open ? "hide" : "show"} features earned ({features.length})
      </InkButton>
      {open && (
        <ul className="mt-1.5 grid max-h-48 grid-cols-1 gap-x-8 overflow-y-auto pr-1 @2xl:grid-cols-2">
          {features.map((f, i) => (
            <li key={`${f.level}-${f.name}-${i}`} className="flex items-baseline gap-2 text-sm">
              <span className={`w-5 shrink-0 text-right tabular-nums ${INK.faint}`}>{f.level}</span>
              <span className={f.from === "subclass" ? "italic" : ""}>{f.name}</span>
              {f.from === "subclass" && <span className={`text-[10px] italic ${INK.faint}`}>subclass</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SubclassPicker({ variant, entry, onChange }) {
  const unlock = subclassUnlockLevel(variant);
  const options = subclassOptions(variant);
  if (unlock == null || !options.length) return null;

  if ((Number(entry.level) || 0) < unlock) {
    return <Note>Subclass unlocks at level {unlock}.</Note>;
  }

  return (
    <div>
      <ChoiceHead title="Subclass" need={entry.subclass ? "pick one · done" : "pick one · 1 left"} done={!!entry.subclass} />
      <PickRow>
        {options.map((sc) => (
          <Pick key={sc.name} round on={entry.subclass === sc.name} onClick={() => onChange(entry.subclass === sc.name ? null : sc.name)}>
            {sc.name}
          </Pick>
        ))}
      </PickRow>
    </div>
  );
}

/* Feats a class grants through its Ability Score Improvement levels (plus
   the Epic Boon slot, where eligible). The same feat can't be taken by
   two classes. Picks are stored as { name, source } — name alone is not
   enough, since PHB and XPHB both have an "Alert". */
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
      .sort((a, b) => String(a.name).localeCompare(String(b.name)) || String(a.source).localeCompare(String(b.source)));
  }, [feats, search, takenElsewhere, epicBoonEligible]);

  if (slots <= 0) return null;

  const same = (a, b) => a.name === b.name && a.source === b.source;
  const toggle = (f) => {
    if (picked.some((p) => same(p, f))) onChangeFeats(entry.key, picked.filter((p) => !same(p, f)));
    else if (picked.length < slots) onChangeFeats(entry.key, [...picked, { name: f.name, source: f.source }]);
  };

  return (
    <div>
      <ChoiceHead
        title="Feats"
        need={`${picked.length} of ${slots} chosen${epicBoonEligible ? " · Epic Boon available" : ""}`}
        done={picked.length >= slots}
      />
      {picked.length > 0 && (
        <p className="mb-2 text-[15px]">
          {picked.map((p, i) => (
            <React.Fragment key={`${p.name}__${p.source}`}>
              {i > 0 && <span className={INK.faint}> · </span>}
              <span className={INK.rubric}>{p.name}</span>
              <span className={`ml-1 text-[10px] uppercase tracking-wider ${INK.faint}`}>{p.source}</span>
            </React.Fragment>
          ))}
        </p>
      )}
      <EntityList
        items={filtered}
        selected={picked}
        onSelect={toggle}
        onPreview={onPreview}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search feats…"
        loadingText="Fetching feats…"
        emptyText="No feats match."
        renderSubtitle={(f) => (isEpicBoonFeat(f) ? "Epic Boon" : null)}
        isDisabled={() => picked.length >= slots}
      />
    </div>
  );
}

function requirementText(variant) {
  const req = multiclassRequirements(variant);
  if (!req) return "no multiclass requirements in the data";
  const text = req.pairs.map(([a, n]) => `${ABIL[a] || a.toUpperCase()} ${n}`).join(req.connector === "or" ? " or " : " and ");
  return `requires ${text}`;
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

  if (loading) return <p className={`py-6 text-center italic ${INK.faint}`}>Fetching classes…</p>;
  if (!classes || allKeys.length === 0) return <p className={`py-6 text-center italic ${INK.faint}`}>No classes available.</p>;

  return (
    <div className="space-y-8">
      <Line label="Character level">
        <span className="text-xl tabular-nums">{total}</span>
        <span className={`text-sm ${INK.faint}`}>of {levelCap}</span>
      </Line>

      {(entries || []).map((entry, index) => {
        const variant = classVariant(classes, entry.key, entry.edition);
        if (!variant) return null;

        const isPrimary = index === 0;
        const eds = availableEditions(classes, entry.key).filter((e) => editions.includes(e));
        const max = levelBudget(entries, entry.key, levelCap);
        // Every class choice id is namespaced `class.<key>.…`, so the prefix is an exact ownership test.
        const owned = (choices || []).filter((c) => c.id?.startsWith(`class.${entry.key}.`) && c.kind !== "subclass");
        const { slots: featSlots, epicBoonEligible } = classFeatSlots({ entry, index, variant, feats });

        return (
          <section key={entry.key} className="space-y-4">
            {/* class line */}
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-[#7b6346]/30 pb-1.5">
              <h4 className="text-xl">{classDisplayName(classes, entry.key, entry.edition)}</h4>
              <span className={`text-xs italic ${isPrimary ? INK.rubric : INK.faint}`}>
                {isPrimary ? "primary" : requirementText(variant)}
              </span>
              {isCaster(variant) && <span className={`text-xs italic ${INK.faded}`}>spellcaster</span>}
              {eds.length > 1 && (
                <InkChoice
                  label="Edition"
                  value={entry.edition}
                  onChange={(ed) => onChangeEdition(entry.key, ed)}
                  options={eds.map((ed) => ({ value: ed, label: ed === "one" ? "One D&D" : "Classic" }))}
                />
              )}
              <span className="ml-auto flex items-baseline gap-2">
                <span className={`text-sm italic ${INK.faded}`}>level</span>
                <Stepper value={entry.level} max={max} onChange={(lv) => onChangeLevel(entry.key, lv)} label={`${entry.key} level`} />
                <InkRemove onClick={() => onRemoveClass(entry.key)} label={`Remove ${entry.key}`} />
              </span>
            </div>

            {!isPrimary && <Note>Multiclass — grants only the reduced proficiencies, no starting equipment.</Note>}

            <SubclassPicker variant={variant} entry={entry} onChange={(name) => onChangeSubclass(entry.key, name)} />
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
            {owned.map((c) => (
              <ChoiceGroup key={c.id} choice={c} sel={choiceSel[c.id]} overlap={overlap} onToggle={onToggleChoice} onAsiChange={onAsiChange} />
            ))}
          </section>
        );
      })}

      {/* add a class */}
      {addable.length > 0 && !atCap && (
        <div>
          {adding ? (
            <>
              <ChoiceHead title={entries?.length ? "Add a class" : "Choose a class"}>
                <InkButton onClick={() => setAdding(false)} className="ml-auto">
                  never mind
                </InkButton>
              </ChoiceHead>
              <PickRow>
                {addable.map((key) => {
                  const ed = availableEditions(classes, key).find((e) => editions.includes(e));
                  return (
                    <Pick key={key} round onClick={() => { onAddClass(key, ed); setAdding(false); }}>
                      {classDisplayName(classes, key, ed)}
                    </Pick>
                  );
                })}
              </PickRow>
            </>
          ) : (
            <InkButton active onClick={() => setAdding(true)} className="text-sm">
              {entries?.length ? "+ multiclass" : "+ choose a class"}
            </InkButton>
          )}
        </div>
      )}

      {atCap && <Note className="text-center">Character level {levelCap} reached.</Note>}
    </div>
  );
}