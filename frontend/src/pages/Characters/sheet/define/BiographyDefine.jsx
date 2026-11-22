import React, { useEffect, useMemo, useState } from "react";
import useAuthStore from "../../../../store/AuthStore";
import { useCatalogueStore } from "../../../../store/CatalogueStore";
import { usePopupStore } from "../../../../store/PopupStore";
import { INK, InkButton, ParchmentSheet, Title, InkText } from "../../../../styles/parchment";
import { DefineSection, Field, Hint, Segmented, TextBlock, addBtn, inputBase } from "../../../../styles/parchmentForm";
import { useSheet } from "../sheetHelpers";
import { addLayerFeature, featureRows, newOwnFeature, usesKey } from "../featureHelpers";
import FeatureList, { TakenOff } from "./FeatureList";
import OriginSwap from "./OriginSwap";
import { GOOD_AXIS, LAW_AXIS, SIZES, asList, cap, identityLine, originOf, profileOf } from "./biographyHelpers";

/* Define tab: Biography — origin, profile and story, on parchment.

   The race, subrace and background are the character's layers: click a
   name to read its card, "change" to swap it for another (OriginSwap:
   the old one goes with everything it gave). Their traits are listed
   under them, each editable on the character's own copy (FeatureList,
   the same lines as everywhere on the sheet). Everything else here is
   the `profile` block.

   At half width everything stacks. At full width the four personality
   boxes form a 2×2 grid. Picks save right away; typing saves a moment
   after you stop.

   Renaming: characters are found by their database id, so the name is
   just data. Saving a new name also updates the character list (/me), so
   the party bar and the roster show it. */

/* ─── Small pieces ───────────────────────────────────────────────── */

// One origin layer: its name (opens the catalogue card when there is one).
function OriginLine({ label, layer, entry, popupType, note, onChange, changing }) {
  const openPopup = usePopupStore((s) => s.open);
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <span className={`w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] ${INK.faded}`}>{label}</span>
      {layer ? (
        <button
          type="button"
          onClick={() => entry && openPopup(popupType, entry)}
          disabled={!entry}
          className="text-left text-xl enabled:hover:underline enabled:hover:decoration-dotted enabled:hover:underline-offset-4 disabled:cursor-default"
          title={entry ? "Open its card" : "Not in the catalogue (the character keeps its own copy)"}
        >
          {layer.label}
        </button>
      ) : (
        <Hint>none</Hint>
      )}
      {entry?.source && <span className={`text-xs italic ${INK.faded}`}>{entry.source}</span>}
      {note && <span className={`text-xs italic ${INK.faint}`}>{note}</span>}
      {onChange && (
        <InkButton onClick={onChange} active={changing} title={`Pick another ${label.toLowerCase()}`} className="ml-auto">
          {changing ? "keep it" : "change"}
        </InkButton>
      )}
    </div>
  );
}

// One half of the alignment: a short dropdown, plus a text box when
// "Custom…" is picked (or the stored word isn't one of the presets).
function AlignmentPart({ label, presets, value, onPick, onType }) {
  const isPreset = !value || presets.includes(value);
  const [customOpen, setCustomOpen] = useState(!isPreset);
  const custom = customOpen || !isPreset;

  return (
    <div className="flex min-w-0 gap-3">
      <select
        value={custom ? "custom" : value || ""}
        onChange={(e) => {
          const v = e.target.value;
          setCustomOpen(v === "custom");
          onPick(v === "custom" ? "" : v);
        }}
        aria-label={label}
        className={`${inputBase} w-24 shrink-0 cursor-pointer`}
      >
        <option value="">—</option>
        {presets.map((p) => (
          <option key={p} value={p}>
            {cap(p)}
          </option>
        ))}
        <option value="custom">Custom…</option>
      </select>
      {custom && (
        <input
          type="text"
          value={value}
          onChange={(e) => onType(e.target.value)}
          placeholder="Custom"
          autoFocus={!value}
          aria-label={`Custom ${label.toLowerCase()}`}
          className={`${inputBase} w-24 min-w-0`}
        />
      )}
    </div>
  );
}

/* ─── Tab ─────────────────────────────────────────────────────────── */

const PERSONALITY = [
  { key: "personality_traits", label: "Personality traits", placeholder: "How do you act? Habits, quirks, manners…" },
  { key: "ideals", label: "Ideals", placeholder: "What do you believe in?" },
  { key: "bonds", label: "Bonds", placeholder: "Who or what do you care about most?" },
  { key: "flaws", label: "Flaws", placeholder: "Weaknesses, vices, fears…" },
];

export default function BiographyDefine() {
  const { ch, d, patchChar } = useSheet();
  const fetchUser = useAuthStore((s) => s.fetchUser);

  const races = useCatalogueStore((s) => s.races);
  const backgrounds = useCatalogueStore((s) => s.backgrounds);

  const [renaming, setRenaming] = useState(false); // is the rename area open?
  const [newName, setNewName] = useState(""); // what's typed in the blank
  const [swapping, setSwapping] = useState(null); // "race" | "background" | null
  const [openTrait, setOpenTrait] = useState(null); // the trait whose editor is open
  const loadingRaces = useCatalogueStore((s) => s.loadingRaces);
  const loadingBackgrounds = useCatalogueStore((s) => s.loadingBackgrounds);
  // The race's, subrace's and background's traits (their own copies).
  const traits = useMemo(() => featureRows(ch, d).filter((r) => /^(race|background):/.test(r.from)), [ch, d]);

  useEffect(() => {
    const store = useCatalogueStore.getState();
    if (!asList(store.races).length && !store.loadingRaces) store.loadRaces();
    if (!asList(store.backgrounds).length && !store.loadingBackgrounds) store.loadBackgrounds();
  }, []);

  if (!ch) return null;

  const origin = originOf(ch);
  const profile = profileOf(ch);
  const raceEntry = origin.race ? asList(races).find((r) => r.id === origin.race.id) : null;
  const subEntry = origin.subrace ? asList(raceEntry?.subraces).find((s) => s.id === origin.subrace.id) : null;
  const bgEntry = origin.background ? asList(backgrounds).find((b) => b.id === origin.background.id) : null;
  const raceSizes = asList(raceEntry?.size);

  // Picks save right away; typing saves a moment later.
  const writeProfile = (patch, immediate = true) => patchChar({ profile: { ...profile, ...patch } }, { now: immediate });
  const typeProfile = (patch) => writeProfile(patch, false);

  const identity = identityLine(origin, profile, ch.name);

  // Open the area with the current name already filled in.
  const openRename = () => {
    setNewName(ch.name || "");
    setRenaming(true);
  };
  const cancelRename = () => setRenaming(false);

  // Save only if the name is non-empty and actually different, then
  // refresh the character list so the party bar shows the new name.
  const confirmRename = async () => {
    const next = newName.trim();
    if (!next || next === ch.name) return cancelRename();
    setRenaming(false);
    await patchChar({ name: next }, { now: true });
    await fetchUser();
  };

  return (
    <ParchmentSheet>
      <Title
        after={<span className={`text-sm italic ${INK.faded}`}>{identity}</span>}
        right={!renaming && <InkButton onClick={openRename}>change name</InkButton>}
      >
        Biography
      </Title>

      {renaming && (
        <div className="-mt-3 mb-6 flex flex-wrap items-baseline gap-3">
          <InkText
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmRename();
              if (e.key === "Escape") cancelRename();
            }}
            placeholder="new name"
            aria-label="New character name"
            className="w-64 text-lg"
          />
          <InkButton active onClick={confirmRename} disabled={!newName.trim() || newName.trim() === ch.name}>
            save
          </InkButton>
          <InkButton onClick={cancelRename}>cancel</InkButton>
        </div>
      )}

      <div className="space-y-9">
        {/* Origin */}
        <DefineSection title="Origin" storageKey="bio.origin">
          <div className="space-y-2">
            <OriginLine label="Race" layer={origin.race} entry={raceEntry} popupType="race" changing={swapping === "race"} onChange={() => setSwapping(swapping === "race" ? null : "race")} />
            {swapping === "race" && <OriginSwap kind="race" entries={asList(races)} loading={loadingRaces} currentId={origin.race?.id} onClose={() => setSwapping(null)} />}
            {origin.subrace && <OriginLine label="Subrace" layer={origin.subrace} entry={null} note={subEntry?.source && subEntry.source !== raceEntry?.source ? subEntry.source : null} />}
            <OriginLine
              label="Background"
              layer={origin.background}
              entry={bgEntry}
              popupType="background"
              changing={swapping === "background"}
              onChange={() => setSwapping(swapping === "background" ? null : "background")}
            />
            {swapping === "background" && (
              <OriginSwap kind="background" entries={asList(backgrounds)} loading={loadingBackgrounds} currentId={origin.background?.id} onClose={() => setSwapping(null)} />
            )}
          </div>
          <Field label="Size" hint={raceSizes.length > 1 ? `Your race can be ${raceSizes.join(" or ")}` : raceSizes.length === 1 && !profile.size ? `Your race's size` : undefined}>
            <Segmented size="sm" options={SIZES} value={profile.size || raceSizes[0] || ""} onChange={(v) => writeProfile({ size: v })} />
          </Field>
        </DefineSection>

        {/* Traits of the race and background */}
        <DefineSection
          title="Traits"
          count={traits.length}
          storageKey="bio.traits"
          actions={(setOpen) => (
            <span className="flex flex-wrap items-baseline gap-x-4">
              {[
                ["race", origin.race, `race:${origin.race?.id}`],
                ["background", origin.background, `background:${origin.background?.id}`],
              ].map(
                ([word, layer, from]) =>
                  layer && (
                    <button
                      key={word}
                      type="button"
                      title={`Write a trait of your own for your ${word}. It goes if the ${word} is swapped.`}
                      onClick={() => {
                        const f = newOwnFeature("traits");
                        setOpen(true);
                        patchChar(addLayerFeature(ch, from, f), { now: true });
                        setOpenTrait(usesKey(from, f.id));
                      }}
                      className={addBtn}
                    >
                      + a {word} trait
                    </button>
                  )
              )}
            </span>
          )}
        >
          <FeatureList
            rows={traits}
            ch={ch}
            d={d}
            patchChar={patchChar}
            openKey={openTrait}
            setOpenKey={setOpenTrait}
            empty="Your race and background list no traits (their bonuses and proficiencies are on the General and Abilities tabs). Add your own with the + above."
          />
          <TakenOff ch={ch} patchChar={patchChar} test={(from) => /^(race|background):/.test(from)} />
          <p className={`mt-2 text-xs italic ${INK.faint}`}>◆ = shown in Play · click a name for its card · "edit" changes your copy</p>
        </DefineSection>

        {/* Profile */}
        <DefineSection title="Profile" storageKey="bio.profile">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <Field label="Alignment">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <AlignmentPart
                  label="Law / chaos"
                  presets={LAW_AXIS}
                  value={profile.alignment.prefix}
                  onPick={(prefix) => writeProfile({ alignment: { ...profile.alignment, prefix } })}
                  onType={(prefix) => typeProfile({ alignment: { ...profile.alignment, prefix } })}
                />
                <AlignmentPart
                  label="Good / evil"
                  presets={GOOD_AXIS}
                  value={profile.alignment.suffix}
                  onPick={(suffix) => writeProfile({ alignment: { ...profile.alignment, suffix } })}
                  onType={(suffix) => typeProfile({ alignment: { ...profile.alignment, suffix } })}
                />
              </div>
            </Field>
            <div className="grid grid-cols-3 gap-4">
              {[
                ["age", "Age", "years"],
                ["height", "Height", "5'10\""],
                ["weight", "Weight", "lb"],
              ].map(([key, label, placeholder]) => (
                <Field key={key} label={label}>
                  <input
                    type="text"
                    value={profile[key] ?? ""}
                    onChange={(e) => typeProfile({ [key]: e.target.value })}
                    placeholder={placeholder}
                    aria-label={label}
                    className={`${inputBase} w-20`}
                  />
                </Field>
              ))}
            </div>
          </div>
          <Field label="Appearance">
            <TextBlock value={profile.appearance} onChange={(e) => typeProfile({ appearance: e.target.value })} placeholder="Hair, eyes, scars, clothing…" minRows={3} />
          </Field>
        </DefineSection>

        {/* Personality */}
        <DefineSection title="Personality" storageKey="bio.personality">
          <div className="grid grid-cols-1 gap-x-10 gap-y-4 @3xl:grid-cols-2">
            {PERSONALITY.map((p) => (
              <Field key={p.key} label={p.label}>
                <TextBlock value={profile[p.key]} onChange={(e) => typeProfile({ [p.key]: e.target.value })} placeholder={p.placeholder} minRows={3} />
              </Field>
            ))}
          </div>
        </DefineSection>

        {/* Backstory */}
        <DefineSection
          title="Backstory"
          storageKey="bio.backstory"
          actions={<span className={`text-[11px] italic ${INK.faint}`}>{(String(profile.backstory || "").trim().match(/\S+/g) || []).length} words</span>}
        >
          <TextBlock
            value={profile.backstory}
            onChange={(e) => typeProfile({ backstory: e.target.value })}
            placeholder="Where do you come from, and what set you on the road?"
            minRows={8}
            maxRows={40}
          />
        </DefineSection>
      </div>
    </ParchmentSheet>
  );
}
