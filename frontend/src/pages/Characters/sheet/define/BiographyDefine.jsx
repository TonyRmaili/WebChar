import React, { useEffect, useState } from "react";
import useCharStore from "../../../../store/CharStore";
import useAuthStore from "../../../../store/AuthStore";
import { useCatalogueStore } from "../../../../store/CatalogueStore";
import { usePopupStore } from "../../../../store/PopupStore";
import { INK, InkButton, ParchmentSheet, Title, InkText } from "../../../../styles/parchment";
import { DefineSection, Field, Hint, NumberInput, PickerRow, PickerShell, Segmented, Tag, TextBlock, chipBtn, inputBase } from "../../../../styles/parchmentForm";
import {
  ABILITIES,
  EDITIONS,
  EMPTY_BACKGROUND,
  EMPTY_RACE,
  GOOD_AXIS,
  LAW_AXIS,
  asList,
  backgroundFromEntry,
  backgroundOf,
  cap,
  editionLabel,
  entryEdition,
  entryKey,
  identityLine,
  profileOf,
  raceFromEntry,
  raceOf,
  sameSubrace,
  withSubrace,
  withoutSubrace,
  SIZES,
} from "./biographyHelpers";

/* Define tab: Biography — ancestry, background, profile and story, on
   parchment.

   At half width everything stacks. At full width Ancestry and Background
   sit side by side, and the four personality boxes form a 2×2 grid.
   Picks save right away; typing saves a moment after you stop.

   Renaming: characters are found by their database id, so the name is
   just data. Saving a new name also updates the character list (/me), so
   the party bar and the roster show it. */

const MAX_PICKER_ROWS = 80;

/* ─── Catalogue picker ───────────────────────────────────────────────
   Closed by default: the chosen entry shows as a card with Change and
   Clear. Click a name to open its card; Select picks it. */

function CatalogPicker({ popupType, entries, selected, selectedEntry, onSelect, onClear, emptyLabel, chooseLabel }) {
  const openPopup = usePopupStore((s) => s.open);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editions, setEditions] = useState(["one", "classic"]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  if (!open) {
    if (selected?.name) {
      return (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <button
            type="button"
            onClick={() => selectedEntry && openPopup(popupType, selectedEntry)}
            disabled={!selectedEntry}
            className="text-left text-xl enabled:hover:underline enabled:hover:decoration-dotted enabled:hover:underline-offset-4 disabled:cursor-default"
            title={selectedEntry ? "Open its card" : "Not found in the catalogue"}
          >
            {selected.name}
          </button>
          <span className={`text-xs italic ${INK.faded}`}>
            {editionLabel(selected)} · {selected.source}
          </span>
          <span className="ml-auto flex gap-4">
            <InkButton onClick={() => setOpen(true)}>change</InkButton>
            <InkButton onClick={onClear}>clear</InkButton>
          </span>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-baseline gap-x-4">
        <Hint>{emptyLabel}</Hint>
        <InkButton onClick={() => setOpen(true)} active>
          {chooseLabel}
        </InkButton>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const all = asList(entries).filter((e) => e?.name && editions.includes(entryEdition(e)));
  const rows = all
    .filter((e) => !q || e.name.toLowerCase().includes(q) || String(e.source || "").toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  const isSelected = (e) => !!selected?.name && e.name === selected.name && e.source === selected.source;

  const toggleEdition = (id) => {
    const next = editions.includes(id) ? editions.filter((v) => v !== id) : [...editions, id];
    if (next.length) setEditions(next); // never zero
  };

  return (
    <PickerShell
      title={chooseLabel}
      query={query}
      onQuery={setQuery}
      onClose={close}
      filters={EDITIONS.map((e) => (
        <button key={e.id} type="button" onClick={() => toggleEdition(e.id)} className={chipBtn(editions.includes(e.id))}>
          {e.label}
        </button>
      ))}
      footer={`${rows.length > MAX_PICKER_ROWS ? `first ${MAX_PICKER_ROWS} of ${rows.length} — type to narrow` : `${rows.length} of ${all.length}`} · click a name to view its card`}
    >
      {rows.length === 0 && <Hint className="py-2">{all.length ? "Nothing matches." : "Fetching the catalogue…"}</Hint>}
      {rows.slice(0, MAX_PICKER_ROWS).map((entry) => {
        const chosen = isSelected(entry);
        return (
          <PickerRow
            key={entryKey(entry)}
            name={entry.name}
            onOpen={() => openPopup(popupType, entry)}
            meta={<Tag>{editionLabel(entry)}</Tag>}
            source={entry.source}
            highlight={chosen}
            action={{
              label: chosen ? "chosen" : "select",
              disabled: chosen,
              onClick: () => {
                onSelect(entry);
                close();
              },
            }}
          />
        );
      })}
    </PickerShell>
  );
}

/* ─── Small pieces ───────────────────────────────────────────────── */

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
  const charData = useCharStore((s) => s.charData);
  const patchChar = useCharStore((s) => s.patchChar);
  const fetchUser = useAuthStore((s) => s.fetchUser);

  const races = useCatalogueStore((s) => s.races);
  const loadRaces = useCatalogueStore((s) => s.loadRaces);
  const backgroundsData = useCatalogueStore((s) => s.backgroundsData);
  const loadBackgrounds = useCatalogueStore((s) => s.loadBackgrounds);

  const [renaming, setRenaming] = useState(false); // is the rename area open?
  const [newName, setNewName] = useState(""); // what's typed in the blank

  useEffect(() => {
    if (!asList(races).length) loadRaces();
    if (!asList(backgroundsData?.backgrounds).length) loadBackgrounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Picks save right away; typing saves a moment later.
  const write = (key, value, immediate = true) => patchChar({ [key]: value }, { now: immediate });

  if (!charData) return null;

  const race = raceOf(charData);
  const background = backgroundOf(charData);
  const profile = profileOf(charData);

  const raceList = asList(races);
  const bgList = asList(backgroundsData?.backgrounds);
  const raceEntry = raceList.find((r) => r.name === race.name && r.source === race.source);
  const bgEntry = bgList.find((b) => b.name === background.name && b.source === background.source);
  const subraces = asList(raceEntry?.sub_races); // the catalogue calls them sub_races

  const writeRace = (patch) => write("race", { ...race, ...patch });
  const writeProfile = (patch, immediate = true) => write("character_profile", { ...profile, ...patch }, immediate);
  const typeProfile = (patch) => writeProfile(patch, false);

  const identity = identityLine(race, background, profile, charData.name);

  // Open the area with the current name already filled in.
  const openRename = () => {
    setNewName(charData.name || "");
    setRenaming(true);
  };

  const cancelRename = () => setRenaming(false);

  // Save only if the name is non-empty and actually different, then
  // refresh the character list so the party bar shows the new name.
  const confirmRename = async () => {
    const next = newName.trim();
    if (!next || next === charData.name) return cancelRename();
    setRenaming(false);
    await patchChar({ name: next }, { now: true });
    await fetchUser();
  };

  return (
    <ParchmentSheet>
      <Title
        after={<span className={`text-sm italic ${INK.faded}`}>{identity || "choose a race and background to start"}</span>}
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
          <InkButton active onClick={confirmRename} disabled={!newName.trim() || newName.trim() === charData.name}>
            save
          </InkButton>
          <InkButton onClick={cancelRename}>cancel</InkButton>
        </div>
      )}

      <div className="space-y-9">

      {/* Ancestry + Background */}
      <div className="grid grid-cols-1 items-start gap-x-12 gap-y-9 @4xl:grid-cols-2">
        <DefineSection title="Ancestry" storageKey="bio.ancestry">
          <CatalogPicker
            popupType="race"
            entries={raceList}
            selected={race.name ? race : null}
            selectedEntry={raceEntry}
            onSelect={(entry) => write("race", raceFromEntry(entry))}
            onClear={() => write("race", { ...EMPTY_RACE })}
            emptyLabel="No race chosen."
            chooseLabel="Choose a race"
          />

          {race.name && subraces.length > 0 && (
            <Field label="Subrace">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {subraces.map((sub) => {
                  const on = sameSubrace(sub, race);
                  return (
                    <button
                      key={`${sub.name}|${sub.source ?? ""}`}
                      type="button"
                      onClick={() => write("race", on ? withoutSubrace(race) : withSubrace(race, sub))}
                      className={chipBtn(on)}
                    >
                      {sub.display_name || sub.name}
                      {sub.source && <span className={`ml-1 text-[10px] not-italic ${INK.faint}`}>{sub.source}</span>}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <Field label="Size">
              <Segmented size="sm" options={[{ value: "", label: "—" }, ...SIZES]} value={race.size || ""} onChange={(v) => writeRace({ size: v })} />
            </Field>
            <Field label="Spellcasting ability" hint="For spells your race grants">
              <Segmented
                size="sm"
                options={[{ value: "", label: "—" }, ...ABILITIES.map((a) => ({ value: a, label: a.toUpperCase() }))]}
                value={race.spell_ability || ""}
                onChange={(v) => writeRace({ spell_ability: v })}
              />
            </Field>
          </div>
        </DefineSection>

        <DefineSection title="Background" storageKey="bio.background">
          <CatalogPicker
            popupType="background"
            entries={bgList}
            selected={background.name ? background : null}
            selectedEntry={bgEntry}
            onSelect={(entry) => write("background", backgroundFromEntry(entry))}
            onClear={() => write("background", { ...EMPTY_BACKGROUND })}
            emptyLabel="No background chosen."
            chooseLabel="Choose a background"
          />
        </DefineSection>
      </div>

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
              ["age", "Age"],
              ["height", "Height"],
              ["weight", "Weight"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <NumberInput
                  value={Number(profile[key]) || null}
                  min={0}
                  fallback={0}
                  placeholder="—"
                  onChange={(v) => writeProfile({ [key]: v ?? 0 })}
                  className="w-16"
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