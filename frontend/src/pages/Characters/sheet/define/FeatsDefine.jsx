import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../../store/CatalogueStore";
import { usePopupStore } from "../../../../store/PopupStore";
import { INK, InkButton, ParchmentSheet, Title } from "../../../../styles/parchment";
import { DefineSection, Hint, addBtn } from "../../../../styles/parchmentForm";
import { categoryLabel } from "../../../Catalogues/Feats/featsHelpers";
import { asList, labelOf, useSheet } from "../sheetHelpers";
import { addOwnFeature, featureRows, isOptionFeature, isSpellOption, newOwnFeature, optionalFeatureCopy } from "../featureHelpers";
import OptionPicker from "./OptionPicker";
import FeatureList, { TakenOff } from "./FeatureList";

/* Define tab: Feats, on parchment.

   A feat the character has is a layer of its own (from: "feat:<id>"),
   given by another layer (`via`: the background's origin feat, a class's
   Ability Score Improvement level). Each is listed with where it came
   from, the option picked (Magic Initiate's Cleric…) and its features,
   which can be set up for Play like any feature.

   Feats you write yourself are features in the manual layer marked
   `feat: true`. Adding a feat from the catalogue brings its grants and
   choices, so it comes with the builder on the sheet (level up). */

// The option kinds this tab adds (invocations, metamagic, pact boons are the Spellbook's).
const OPTION_KINDS = [
  { id: "maneuver", label: "Maneuvers" },
  { id: "fighting_style", label: "Fighting styles" },
  { id: "elemental_discipline", label: "Elemental disciplines" },
  { id: "arcane_shot", label: "Arcane shots" },
  { id: "rune", label: "Runes" },
  { id: "artificer_infusion", label: "Infusions" },
  { id: "renown_perk", label: "Renown perks" },
];

export default function FeatsDefine() {
  const { ch, d, patchChar } = useSheet();
  const feats = useCatalogueStore((s) => s.feats);
  const openPopup = usePopupStore((s) => s.open);
  const [openKey, setOpenKey] = useState(null);
  const [pickingOptions, setPickingOptions] = useState(false);

  useEffect(() => {
    const store = useCatalogueStore.getState();
    if (!asList(store.feats).length && !store.loadingFeats) store.loadFeats();
  }, []);

  const rows = useMemo(() => featureRows(ch, d), [ch, d]);
  if (!ch || !d) return null;

  const labelByFrom = Object.fromEntries(asList(ch.layers).map((l) => [l.from, l.label || l.from]));
  const featLayers = asList(ch.layers).filter((l) => String(l?.from || "").startsWith("feat:"));
  const own = rows.filter((r) => r.kind === "manual" && r.feature.feat);
  // Picked options that aren't the Spellbook's: maneuvers, fighting styles, runes, infusions…
  const options = rows.filter((r) => isOptionFeature(r.feature) && !isSpellOption(r.feature));

  const addOwn = () => {
    const f = newOwnFeature("traits", { feat: true });
    patchChar(addOwnFeature(ch, f), { now: true });
    setOpenKey(`manual#${f.id}`);
  };

  // The same feature lines as everywhere (FeatureList): card, edit, remove.
  const featureList = (list) => (
    <div className="mt-1">
      <FeatureList rows={list} ch={ch} d={d} patchChar={patchChar} openKey={openKey} setOpenKey={setOpenKey} hideOwner />
    </div>
  );

  return (
    <ParchmentSheet>
      <Title after={<span className={`text-sm italic ${INK.faded}`}>{featLayers.length + own.length || "none yet"}</span>}>Feats & Options</Title>
      <p className={`-mt-4 mb-6 text-xs italic ${INK.faint}`}>◆ = shown in Play · click a name for its card · "edit" changes your copy · “view” opens the feat's catalogue card</p>

      <div className="space-y-8">
        <DefineSection title="From your origin and levels" count={featLayers.length} storageKey="define.feats.layers">
          {featLayers.length === 0 ? (
            <Hint>No feats yet. A background's origin feat and a class's feat levels bring them.</Hint>
          ) : (
            <div className="space-y-5">
              {featLayers.map((l) => {
                const id = l.from.slice(5);
                const entry = asList(feats).find((f) => f.id === id);
                const option = l.picks?.option;
                const list = rows.filter((r) => r.from === l.from);
                return (
                  <div key={l.from}>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-lg">{l.label || labelOf(id)}</span>
                      {option && <span className="text-[15px] italic">{asList(entry?.options).find((o) => o.id === option)?.name || labelOf(option)}</span>}
                      {entry?.category && <span className={`text-[10px] uppercase tracking-wider ${INK.faint}`}>{categoryLabel(entry.category)}</span>}
                      {l.via && <span className={`text-xs italic ${INK.faded}`}>from {labelByFrom[l.via] || l.via}</span>}
                      {entry && (
                        <InkButton onClick={() => openPopup("feat", entry)} className="ml-auto">
                          view
                        </InkButton>
                      )}
                    </div>
                    {list.length ? featureList(list) : <Hint>Nothing to set up for Play: read its card for what it does.</Hint>}
                  </div>
                );
              })}
            </div>
          )}
          <TakenOff ch={ch} patchChar={patchChar} test={(from) => from.startsWith("feat:")} />
        </DefineSection>

        <DefineSection
          title="Your own"
          count={own.length}
          storageKey="define.feats.own"
          actions={(setOpen) => (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                addOwn();
              }}
              className={addBtn}
            >
              + write your own
            </button>
          )}
        >
          {own.length ? featureList(own) : <Hint>A feat the book doesn't have, or one your DM gave you: write it here.</Hint>}
        </DefineSection>

        <DefineSection
          title="Options"
          count={options.length}
          storageKey="define.feats.options"
          actions={(setOpen) => (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setPickingOptions((v) => !v);
              }}
              className={addBtn}
            >
              + from the catalogue
            </button>
          )}
        >
          {pickingOptions && (
            <div className="mb-5">
              <OptionPicker
                title="Options from the catalogue"
                types={OPTION_KINDS}
                have={new Set(options.map((r) => r.feature.id))}
                onAdd={(o) => patchChar(addOwnFeature(ch, optionalFeatureCopy(o)), { now: true })}
                onView={(o) => openPopup("optionalFeature", o)}
                onClose={() => setPickingOptions(false)}
              />
            </div>
          )}
          {options.length ? featureList(options) : <Hint>None yet: maneuvers, fighting styles, runes, infusions and the like come with your class levels, or add them from the catalogue.</Hint>}
          <TakenOff ch={ch} patchChar={patchChar} test={(from, f) => isOptionFeature(f) && !isSpellOption(f)} />
        </DefineSection>

        <Hint>Adding a feat from the catalogue comes with the builder on the sheet, so it brings its skills, scores and choices along.</Hint>
      </div>
    </ParchmentSheet>
  );
}
