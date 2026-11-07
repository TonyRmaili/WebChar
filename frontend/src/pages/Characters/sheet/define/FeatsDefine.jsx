import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useCharStore from "../../../../store/CharStore";
import { useCatalogueStore } from "../../../../store/CatalogueStore";
import { usePopupStore } from "../../../../store/PopupStore";
import { effectChips, effectDamage, usesFromCharges } from "../play/playHelpers";
import { INK, InkButton, InkText, ParchmentSheet, Title } from "../../../../styles/parchment";
import { DefineSection, Field, Hint, PickerRow, PickerShell, Switch, Tag, addBtn, chipBtn } from "../../../../styles/parchmentForm";
import { formatCategory } from "../../../Catalogues/Feats/featsHelpers";
import { ACTION_GROUPS, EffectEditor, idGen } from "./effectEditor";
import { asList, featEdition, featFromCatalogue, groupKey, groupTitle, ownFeat, sameFeat, sortGroups } from "./featHelpers";

/* Define tab: Feats — written on parchment.

   Feats the Builder gave the character land here, and more can be added
   from the catalogue or written by hand. Each feat is stored like an
   effect row, so it can be set up for Play the same way (used as an
   action or passive, a roll, damage, limited uses): the catalogue has no
   structured data for that, so the player decides.

   Catalogue feats keep their name (it's how the card is found again —
   "view" opens it); the player's own feats can be renamed. */

const EDITIONS = [
  { id: "one", label: "One D&D" },
  { id: "classic", label: "Classic" },
];
const MAX_PICKER_ROWS = 80;
const usedAs = (row) => (row.action_type && row.action_type !== "passive" ? ACTION_GROUPS.find((g) => g.value === row.action_type)?.label : null);

/* ─── Catalogue picker ───────────────────────────────────────────── */

function FeatPicker({ taken, onAdd, onView, onClose }) {
  const featsData = useCatalogueStore((s) => s.featsData);
  const loadingFeats = useCatalogueStore((s) => s.loadingFeats);
  const loadFeats = useCatalogueStore((s) => s.loadFeats);
  const [query, setQuery] = useState("");
  const [editions, setEditions] = useState(["one"]);

  useEffect(() => {
    if (!asList(featsData?.feats).length && !loadingFeats) loadFeats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = query.trim().toLowerCase();
  const all = asList(featsData?.feats).filter((f) => f?.name && editions.includes(featEdition(f)));
  const rows = all
    .filter((f) => !q || f.name.toLowerCase().includes(q) || String(f.source || "").toLowerCase().includes(q) || String(f.category || "").includes(q))
    .sort((a, b) => a.name.localeCompare(b.name) || String(a.source).localeCompare(String(b.source)));

  const toggleEdition = (id) => {
    const next = editions.includes(id) ? editions.filter((v) => v !== id) : [...editions, id];
    if (next.length) setEditions(next); // never zero
  };

  return (
    <PickerShell
      title="Add from the catalogue"
      query={query}
      onQuery={setQuery}
      placeholder="search by name, book or category…"
      onClose={onClose}
      filters={EDITIONS.map((e) => (
        <button key={e.id} type="button" onClick={() => toggleEdition(e.id)} className={chipBtn(editions.includes(e.id))}>
          {e.label}
        </button>
      ))}
      footer={`${rows.length > MAX_PICKER_ROWS ? `first ${MAX_PICKER_ROWS} of ${rows.length} — type to narrow` : `${rows.length} of ${all.length}`} · click a name to read it · ability bonuses and proficiencies a feat grants aren't applied for you — set those on their tabs`}
    >
      {rows.length === 0 && <Hint className="py-2">{loadingFeats || !asList(featsData?.feats).length ? "Fetching the catalogue…" : "Nothing matches."}</Hint>}
      {rows.slice(0, MAX_PICKER_ROWS).map((feat) => {
        const have = taken(feat);
        return (
          <PickerRow
            key={`${feat.name}__${feat.source}`}
            name={feat.name}
            onOpen={() => onView(feat)}
            meta={<Tag>{feat.category ? formatCategory(feat.category) : "classic"}</Tag>}
            source={feat.source}
            highlight={have}
            action={{
              label: have ? (feat.repeatable ? "add again" : "taken") : "add",
              disabled: have && !feat.repeatable,
              onClick: () => onAdd(feat),
            }}
          />
        );
      })}
    </PickerShell>
  );
}

/* ─── One feat: ledger line + editor ─────────────────────────────── */

function FeatRow({ row, charData, open, onToggle, onPatch, onReplace, onRemove, onDuplicate, onView }) {
  const chips = effectChips(charData, row);
  const damage = effectDamage(charData, row);
  const uses = usesFromCharges(row.charges);
  const fromCatalogue = !!row.source;
  const when = usedAs(row);

  return (
    <div className={`${open ? "col-span-full" : ""} ${row.active ? "" : "opacity-60"}`}>
      <div className="group flex items-baseline gap-1.5 py-[3px]">
        <span className="self-center">
          <Switch checked={!!row.active} onChange={(v) => onPatch({ active: v })} label={row.active ? "Active — shown in Play" : "Inactive — hidden in Play"} />
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={`truncate text-left text-[15px] hover:underline hover:decoration-dotted hover:underline-offset-4 ${row.name ? "" : `italic ${INK.faint}`} ${open ? "underline decoration-dotted underline-offset-4" : ""}`}
        >
          {row.name || "unnamed feat"}
        </button>
        {fromCatalogue && <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`}>{row.source}</span>}
        <span aria-hidden="true" className="mx-1 min-w-[0.75rem] flex-1 translate-y-[-4px] border-b-2 border-dotted border-[#7b6346]/35" />
        <span className="flex shrink-0 flex-wrap items-baseline justify-end gap-x-2 text-xs">
          {when && <span className={`italic ${INK.faded}`}>{when.toLowerCase()}</span>}
          {chips.map((c, i) => (
            <span key={i} className={c.tone === "hit" ? "text-[#1e3a8a]" : c.tone === "save" ? "text-[#6b21a8]" : INK.faded}>
              {c.text}
            </span>
          ))}
          {damage && <span className={INK.rubric}>{damage}</span>}
          {uses && (
            <span className={`italic ${INK.faded}`}>
              {uses.max} {uses.max === 1 ? "use" : "uses"}
            </span>
          )}
          {fromCatalogue && (
            <InkButton onClick={() => onView(row)} title={`Read ${row.name}`}>
              view
            </InkButton>
          )}
        </span>
      </div>

      {open && (
        <EffectEditor
          row={row}
          onPatch={onPatch}
          onReplace={onReplace}
          onRemove={onRemove}
          onDuplicate={onDuplicate}
          onDone={onToggle}
          namePlaceholder="e.g. Tavern Brawler's Knack"
          notesLabel={fromCatalogue ? "The feat's text (shown when hovering the card in Play)" : "What it does (shown when hovering the card in Play)"}
          nameField={
            fromCatalogue ? (
              <Field label="Feat">
                <p className="flex items-baseline gap-3 pb-1 text-[17px]">
                  {row.name}
                  <InkButton onClick={() => onView(row)}>read its card</InkButton>
                </p>
              </Field>
            ) : undefined
          }
          sourceField={
            <Field label="From">
              <p className="pb-1 text-[15px]">
                {fromCatalogue ? (
                  <>
                    {row.source}
                    <span className={`italic ${INK.faded}`}> · {row.category ? `${formatCategory(row.category)} feat` : "classic feat"}</span>
                  </>
                ) : (
                  <span className={`italic ${INK.faded}`}>written by you</span>
                )}
              </p>
            </Field>
          }
        />
      )}
    </div>
  );
}

/* ─── Tab ─────────────────────────────────────────────────────────── */

export default function FeatsDefine() {
  const charData = useCharStore((s) => s.charData);
  const updateCharField = useCharStore((s) => s.updateCharField);
  const postCharData = useCharStore((s) => s.postCharData);
  const featsData = useCatalogueStore((s) => s.featsData);
  const openPopup = usePopupStore((s) => s.open);

  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const timer = useRef(null);

  const feats = useMemo(() => asList(charData?.feats), [charData?.feats]);

  // Typing saves a moment later; adding/removing saves right away.
  const persist = useCallback(
    (next, immediate = false) => {
      updateCharField("feats", next);
      clearTimeout(timer.current);
      if (immediate) postCharData();
      else timer.current = setTimeout(() => postCharData(), 400);
    },
    [updateCharField, postCharData]
  );

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => feats.filter((f) => !q || String(f.name || "").toLowerCase().includes(q)), [feats, q]);
  const groups = useMemo(() => {
    const map = new Map();
    for (const row of visible) {
      const key = groupKey(row);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return sortGroups([...map.keys()]).map((key) => ({ key, rows: map.get(key) }));
  }, [visible]);

  if (!charData) return null;

  /* Opens the catalogue card. Falls back to what's stored on the row
     (name, text, category) when the catalogue isn't loaded or the feat
     isn't in it any more. */
  const viewFeat = (row) => {
    const full = asList(featsData?.feats).find((f) => sameFeat(f, row));
    openPopup("feat", full || { name: row.name, source: row.source, category: row.category, prerequisite: row.prerequisite, entries: row.notes });
  };

  const replaceRow = (next) => persist(feats.map((f) => (f.id === next.id ? next : f)));
  const patchRow = (id, patch) => persist(feats.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const addRow = (row) => {
    persist([...feats, row], true);
    setOpenId(row.id);
  };

  const removeRow = (row) => {
    if (!window.confirm(`Remove "${row.name || "Unnamed feat"}" from this character?`)) return;
    persist(feats.filter((f) => f.id !== row.id), true);
    if (openId === row.id) setOpenId(null);
  };

  const duplicateRow = (row) => {
    const copy = { ...structuredClone(row), id: idGen(), damages: (row.damages || []).map((d) => ({ ...d, id: idGen() })) };
    if (!row.source) copy.name = row.name ? `${row.name} (copy)` : "";
    const i = feats.findIndex((f) => f.id === row.id);
    persist([...feats.slice(0, i + 1), copy, ...feats.slice(i + 1)], true);
    setOpenId(copy.id);
  };

  const activeCount = feats.filter((f) => f.active).length;

  return (
    <ParchmentSheet>
      <Title
        after={
          <span className={`text-sm italic ${INK.faded}`}>
            {feats.length === 0 ? "none yet" : `${activeCount} of ${feats.length} shown in Play`}
          </span>
        }
        right={<InkText value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search…" aria-label="Search feats" className="h-7 w-32 text-sm" />}
      >
        Feats
      </Title>
      <p className={`-mt-4 mb-6 text-xs italic ${INK.faint}`}>◆ = shown in Play · click a name to set it up · “view” opens the catalogue card</p>

      <div className="mb-8 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <button type="button" onClick={() => setPicking((p) => !p)} className={addBtn}>
          + from the catalogue
        </button>
        <button type="button" onClick={() => addRow(ownFeat())} className={addBtn}>
          + write your own
        </button>
      </div>

      {picking && (
        <div className="mb-8">
          <FeatPicker
            taken={(feat) => feats.some((f) => sameFeat(f, feat))}
            onAdd={(feat) => addRow(featFromCatalogue(feat))}
            onView={(feat) => openPopup("feat", feat)}
            onClose={() => setPicking(false)}
          />
        </div>
      )}

      {feats.length === 0 ? (
        <Hint>No feats yet. Characters made with the Builder bring theirs along; add more from the catalogue or write your own.</Hint>
      ) : groups.length === 0 ? (
        <Hint>Nothing matches.</Hint>
      ) : (
        <div className="space-y-8">
          {groups.map(({ key, rows }) => (
            <DefineSection key={key} title={groupTitle(key)} count={rows.length} storageKey={`define.feats.${key}`}>
              <div className="grid grid-cols-1 items-start gap-x-10 @5xl:grid-cols-2">
                {rows.map((row) => (
                  <FeatRow
                    key={row.id}
                    row={row}
                    charData={charData}
                    open={openId === row.id}
                    onToggle={() => setOpenId((id) => (id === row.id ? null : row.id))}
                    onPatch={(patch) => patchRow(row.id, patch)}
                    onReplace={replaceRow}
                    onRemove={() => removeRow(row)}
                    onDuplicate={() => duplicateRow(row)}
                    onView={viewFeat}
                  />
                ))}
              </div>
            </DefineSection>
          ))}
        </div>
      )}
    </ParchmentSheet>
  );
}