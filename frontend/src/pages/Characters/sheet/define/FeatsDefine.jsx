import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../../store/CatalogueStore";
import { usePopupStore } from "../../../../store/PopupStore";
import { INK, InkButton, ParchmentSheet, Title } from "../../../../styles/parchment";
import { DefineSection, Hint, addBtn } from "../../../../styles/parchmentForm";
import { categoryLabel } from "../../../Catalogues/Feats/featsHelpers";
import { asList, labelOf, useSheet } from "../sheetHelpers";
import useCharStore from "../../../../store/CharStore";
import useAuthStore from "../../../../store/AuthStore";
import { layersOf } from "../../../../utils/derive";
import FeatCardForm from "../../../Catalogues/Feats/FeatCardForm";
import { addOwnFeature, featureRows, isOptionFeature, isSpellOption, optionalFeatureCopy } from "../featureHelpers";
import OptionPicker from "./OptionPicker";
import OriginSwap from "./OriginSwap";
import FeatureList from "./FeatureList";

/* Define tab: Feats, on parchment.

   A feat the character has is a layer of its own (from: "feat:<id>"),
   given by another layer (`via`: the background's origin feat, a class's
   Ability Score Improvement level). Each is listed with where it came
   from, the option picked (Magic Initiate's Cleric…) and its features,
   which can be set up for Play like any feature.

   A whole feat can be taken off the sheet (`removed` on its layer: it
   counts for nothing, nor do feats that came through it) or edited with the feat form: the edited record is kept
   on the layer (`entry`) and the builder uses it from then on
   (app/builder/feat_edit.py); "back to the book's" drops it.

   A feat of the player's own is made in the catalogue (the feat card) and
   taken from there; "edit" changes a taken one for this sheet. (Older
   self-written feats, manual features with `feat: true`, show on the
   Features tab.) "+ from the catalogue" takes any feat whenever the player
   likes (OriginSwap kind "feat", app/builder/origin.py): it's a feat layer
   of its own (no `via`), built with its grants and choices. */

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
  const [takingFeat, setTakingFeat] = useState(false);
  const loadingFeats = useCatalogueStore((s) => s.loadingFeats);
  const [editing, setEditing] = useState(null); // the feat layer the form edits
  const [busy, setBusy] = useState(false);
  const editFeat = useCharStore((s) => s.editFeat);
  const createFeat = useCatalogueStore((s) => s.createFeat);
  const updateFeat = useCatalogueStore((s) => s.updateFeat);
  const userName = useAuthStore((s) => s.userData?.name);

  useEffect(() => {
    const store = useCatalogueStore.getState();
    if (!asList(store.feats).length && !store.loadingFeats) store.loadFeats();
  }, []);

  const rows = useMemo(() => featureRows(ch, d), [ch, d]);
  if (!ch || !d) return null;

  const labelByFrom = Object.fromEntries(asList(ch.layers).map((l) => [l.from, l.label || l.from]));
  const featLayers = layersOf(ch).filter((l) => String(l?.from || "").startsWith("feat:"));
  const setRemoved = (from, removed) =>
    patchChar({ layers: asList(ch.layers).map((l) => (l?.from === from ? { ...l, removed: removed || undefined } : l)) }, { now: true });
  const takeOff = (l) => {
    if (window.confirm(`Take ${l.label || labelOf(l.from.slice(5))} off the sheet? It stops counting (and so do feats it gave).`)) setRemoved(l.from, true);
  };
  const catalogueFeat = (l) => asList(feats).find((f) => f.id === l.from.slice(5)) || null;
  // The player's own catalogue entry a feat comes from (saving to the catalogue updates it).
  const homebrewOf = (l) => {
    const e = catalogueFeat(l);
    return e && e.visibility && e.created_by === userName ? { id: e.id, name: e.name, visibility: e.visibility } : null;
  };
  const runFeat = async (from, entry) => {
    setBusy(true);
    try {
      await editFeat(from, entry);
    } catch (e) {
      window.alert(e?.message || "Couldn't rebuild the feat");
    } finally {
      setBusy(false);
    }
  };
  // The form's save: the sheet's version (kept on the layer), and the catalogue too if asked.
  const submitFeat = async (record, { catalogue: toCatalogue, asNew }) => {
    const l = editing;
    const { visibility, ...entry } = record;
    if (toCatalogue) {
      const target = homebrewOf(l);
      const rec = { ...entry, visibility: visibility || "private" };
      delete rec.id;
      if (target && !asNew) await updateFeat(target.id, { ...rec, id: target.id });
      else await createFeat(rec);
    }
    await editFeat(l.from, { ...entry, id: l.from.slice(5) });
  };
  // Picked options that aren't the Spellbook's: maneuvers, fighting styles, runes, infusions…
  const options = rows.filter((r) => isOptionFeature(r.feature) && !isSpellOption(r.feature));

  // The same feature lines as everywhere (FeatureList): card, edit, remove.
  const featureList = (list) => (
    <div className="mt-1">
      <FeatureList rows={list} ch={ch} d={d} patchChar={patchChar} openKey={openKey} setOpenKey={setOpenKey} hideOwner restorable={false} />
    </div>
  );

  return (
    <ParchmentSheet>
      <Title after={<span className={`text-sm italic ${INK.faded}`}>{featLayers.length || "none yet"}</span>}>Feats & Options</Title>
      <p className={`-mt-4 mb-6 text-xs italic ${INK.faint}`}>◆ = shown in Play · click a name for its card · "edit" changes your copy · “view” opens the feat's catalogue card</p>

      <div className="space-y-8">
        <DefineSection
          title="Feats"
          count={featLayers.length}
          storageKey="define.feats.layers"
          actions={(setOpen) => (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setTakingFeat((v) => !v);
              }}
              className={addBtn}
            >
              + from the catalogue
            </button>
          )}
        >
          {takingFeat && (
            <div className="mb-5">
              <OriginSwap
                kind="feat"
                entries={asList(feats).filter((f) => f.repeatable || !featLayers.some((l) => l.from === `feat:${f.id}`))}
                loading={loadingFeats}
                onClose={() => setTakingFeat(false)}
              />
            </div>
          )}
          {featLayers.length === 0 ? (
            <Hint>No feats yet. A background's origin feat and a class's feat levels bring them, or take one from the catalogue.</Hint>
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
                      {l.via ? (
                        <span className={`text-xs italic ${INK.faded}`}>from {labelByFrom[l.via] || l.via}</span>
                      ) : (
                        <span className={`text-xs italic ${INK.faded}`}>taken by you</span>
                      )}
                      {l.entry && <span className={`text-[10px] uppercase tracking-wider ${INK.faint}`} title="You edited this feat for this sheet">edited</span>}
                      <span className="ml-auto flex items-baseline gap-3">
                        {(l.entry || entry) && <InkButton onClick={() => openPopup("feat", l.entry || entry)}>view</InkButton>}
                        {(l.entry || entry) && (
                          <InkButton onClick={() => setEditing(l)} disabled={busy}>
                            edit
                          </InkButton>
                        )}
                        {l.entry && (
                          <InkButton onClick={() => window.confirm("Use the book's version of this feat again? Your changes to it go.") && runFeat(l.from, null)} disabled={busy}>
                            back to the book's
                          </InkButton>
                        )}
                        <InkButton onClick={() => takeOff(l)}>take off</InkButton>
                      </span>
                    </div>
                    {list.length ? featureList(list) : <Hint>Nothing to set up for Play: read its card for what it does.</Hint>}
                  </div>
                );
              })}
            </div>
          )}
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
        </DefineSection>

        <Hint>A feat taken from the catalogue brings its skills, scores and choices along, the same as one from your origin or a level.</Hint>
      </div>

      <FeatCardForm
        open={!!editing}
        onClose={() => setEditing(null)}
        editingFeat={editing ? { ...(editing.entry || catalogueFeat(editing)), visibility: homebrewOf(editing)?.visibility } : null}
        sheet={{ onSubmit: submitFeat, homebrew: editing ? homebrewOf(editing) : null }}
      />
    </ParchmentSheet>
  );
}
