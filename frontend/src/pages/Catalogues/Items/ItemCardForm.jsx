import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import SheetSaveChoice from "../SheetSaveChoice";
import { CreateModal, PartPopup, hintCls, labelCls } from "../catalogueStyle";
import { EDITION_OPTIONS, EntryPicker, Segmented, VISIBILITY_OPTIONS } from "../catalogueParts";
import { buildNameIndex, collectUnique, formatCurrency, nameFromId, titleCase, toggleIn } from "../catalogueHelpers";
import { AddRow, CardFeatures, CardText, GivesBlock, LineGroup, StatLine, plural } from "../cardParts";
import { ITEM_KIND_OPTIONS, emptyItemForm, formToItem, itemStats, itemSubtitle, itemToForm } from "./itemHelpers";
import {
  ArmorFields, AttunementField, BaseFields, BonusesFields, ChargesEditor, ItemSpellsFields, MagicFlags, RarityFields, TypeFields, WeaponFields,
  WeightValueFields, usesMode, usesNumber,
} from "./itemFormParts";

/* ═══════════════════════════════════════════════════════════════════
   ItemCardForm — the item form (since 2026-11-24): an item is made on
   its own card, drawn the way the catalogue shows it (ItemPopup).

     header      the name, typed on the card · the line under it (kind,
                 type, rarity, attunement) opens a window
     numbers     the card's lines (itemStats): Damage, Armor Class,
                 Charges, While equipped… each opens its own window;
                 "+ weapon  + armor  + charges…" add what isn't there
     text        the description, typed on the card
     features    "Name. text" with what it does in small words; each
                 opens the feature's window (uses, attack, save, rider…)
     gives       what the item gives (traits, proficiencies)
     footer      weight · value · edition · visibility (· kept from the book)

   Three kinds:
     item     a real object (starting points: a weapon, armor, a
              wondrous item, an empty card, a copy of a book item)
     variant  made from base items ("Flame Tongue {base}"): the "Makes"
              line opens which base items and the name; its weapon lines
              change the base's (+1, more damage); empty dice keep the base's
     group    "choose one of": its members, a description, features

   It edits the same form shape as before (itemHelpers.itemToForm /
   formToItem), so the record saved is the one the pipeline makes.

   `sheet` (optional): it edits a character's own item (the Inventory
   tab): { onSubmit(record, { catalogue, asNew }), homebrew } — "this sheet
   only" or "my catalogue too" (SheetSaveChoice). Sheet items are real
   items (no variants or groups).
   ═══════════════════════════════════════════════════════════════════ */

// Which window each of the card's lines opens (itemStats' labels).
const LINE_WINDOW = {
  Weapon: "weapon", Damage: "weapon", Range: "weapon", Properties: "weapon", Mastery: "weapon", Ammunition: "weapon", Bonus: "weapon", "Critical Hit": "weapon",
  "Armor Class": "armor", Strength: "armor", Stealth: "armor",
  "While equipped": "bonuses",
  Charges: "charges",
  "Spellcasting Focus": "flags", Cursed: "flags", Sentient: "flags",
  "Made from": "base", Name: "base", Adds: "base",
};
// Shown in the footer, not as the card's lines.
const FOOTER_LINES = new Set(["Weight", "Value"]);

const WINDOWS = {
  type: { title: "Kind, type & rarity", hint: "What kind of item it is, how rare, and whether you must attune to it." },
  weapon: { title: "Weapon", hint: "Its damage on a hit (and more damage on every hit, like a hammer's fire), range, a +1 or +2, properties and mastery." },
  armor: { title: "Armor", hint: "Its Armor Class, how much Dex adds, the Strength it needs." },
  charges: { title: "Charges", hint: "The item's charges, shared by everything on it: a spell or a feature set to “item's charges” spends from them." },
  bonuses: { title: "While equipped", hint: "Numbers it changes while you wear or hold it: +1 AC, +1 to saves, Strength becomes 19." },
  spells: { title: "Spells cast from it", hint: "Each spell costs the item's charges, or has its own uses (per long rest, once), or is at will." },
  flags: { title: "More magic", hint: "Cursed, sentient, or a spellcasting focus." },
  base: { title: "Built on", hint: "A unique item made from a base item (Blackrazor is a greatsword), or a mundane base item itself." },
  variant: { title: "Made from", hint: "The base items it can be made from and how the result is named: “Flame Tongue {base}” makes “Flame Tongue Longsword”." },
  members: { title: "Choose one of", hint: "The items of the group: the player picks one of them." },
  more: { title: "Weight, value & book", hint: "What it weighs and costs, which rules it's for, and who can see it." },
  other: { title: "Kept from the book", hint: "Choices and grants from the book this card doesn't show as lines; they're saved as they are." },
};

const START_POINTS = [
  { id: "weapon", label: "A weapon", hint: "a sword, a mace, a bow: damage, range, properties" },
  { id: "armor", label: "Armor or a shield", hint: "Armor Class, Dex, Strength" },
  { id: "wondrous", label: "A wondrous item", hint: "a cloak, a ring, a wand: what it does" },
  { id: "blank", label: "An empty card", hint: "start from nothing" },
  { id: "variant", label: "A variant", hint: "made from base items: Flame Tongue → Flame Tongue Longsword", catalogueOnly: true },
  { id: "group", label: "A group", hint: "choose one of several items: the Absorbing Tattoos", catalogueOnly: true },
];
function startForm(id) {
  const f = emptyItemForm();
  if (id === "weapon")
    return { ...f, itemTypes: ["melee_weapon"], weapon: { ...f.weapon, on: true, category: "simple", kind: "melee", dice: "1d6", type: "bludgeoning" } };
  if (id === "armor") return { ...f, itemTypes: ["medium_armor"], armor: { ...f.armor, on: true, category: "medium", base: 14, dexCap: 2 } };
  if (id === "wondrous") return { ...f, itemTypes: ["wondrous_item"], rarity: "uncommon" };
  if (id === "variant") return { ...f, kind: "item_variant", rarity: "rare", nameFormat: "{base}" };
  if (id === "group") return { ...f, kind: "item_group" };
  return f;
}

// "Fireball (1 charge)", "Shield (1/long rest)", "Light (at will)"
function spellWords(sp, index) {
  const mode = usesMode(sp.uses);
  const n = usesNumber(sp.uses);
  const how = mode === "at_will" ? "at will" : mode === "charges" ? plural(n, "charge") : mode === "once" ? "once" : `${n}/${mode === "short" ? "short" : "long"} rest`;
  return `${nameFromId(sp.spell, index)} (${how}${sp.cast_at ? `, as level ${sp.cast_at}` : ""})`;
}
// "Flame Tongue Longsword, Flame Tongue Shortsword and 3 more"
function variantNames(form, index) {
  const names = [...new Set(form.appliesTo.map((id) => nameFromId(id, index)))];
  const make = (base) => {
    const cut = form.nameRemove ? base.replace(form.nameRemove, "") : base;
    return (form.nameFormat || "{base}").replace("{base}", cut).trim();
  };
  if (!names.length) return "";
  const shown = names.slice(0, 3).map(make);
  return names.length > 3 ? `${shown.join(", ")} and ${names.length - 3} more` : shown.join(", ");
}


/* ─── the form ───────────────────────────────────────────────────── */

export default function ItemCardForm({ open, onClose, editingItem = null, copyFromItem = null, sheet = null }) {
  const createItem = useCatalogueStore((s) => s.createItem);
  const updateItem = useCatalogueStore((s) => s.updateItem);
  const saving = useCatalogueStore((s) => s.savingItem);
  const saveError = useCatalogueStore((s) => s.itemsError);
  const items = useCatalogueStore((s) => s.items);
  const feats = useCatalogueStore((s) => s.feats);
  const spells = useCatalogueStore((s) => s.spells);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);

  const [form, setForm] = useState(emptyItemForm);
  const [started, setStarted] = useState(false);
  const [win, setWin] = useState(null); // a WINDOWS key (features and "what it gives" have their own: cardParts)
  const [nameError, setNameError] = useState(false);
  const [saveTo, setSaveTo] = useState("sheet"); // sheet mode: "sheet" | "catalogue"
  const [asNew, setAsNew] = useState(false);
  const [sheetSaving, setSheetSaving] = useState(false);
  const [sheetError, setSheetError] = useState(null);

  useEffect(() => {
    if (open && !spells?.length) loadSpells();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const src = editingItem || copyFromItem;
    setForm(src ? itemToForm(src, { copy: !editingItem }) : emptyItemForm());
    setStarted(!!src);
    setWin(null);
    setNameError(false);
    setSaveTo("sheet");
    setAsNew(false);
    setSheetError(null);
  }, [open, editingItem, copyFromItem]);

  const index = useMemo(() => buildNameIndex(items, spells, feats), [items, spells, feats]);
  const known = useMemo(
    () => ({
      types: collectUnique(items, "item_types"),
      tags: collectUnique(items, "item_tags"),
      properties: collectUnique(items, (it) => it.weapon?.properties),
      masteries: collectUnique(items, (it) => it.weapon?.mastery),
      baseItems: (items || []).filter((it) => it.base),
      realItems: (items || []).filter((it) => it.kind === "item"),
    }),
    [items]
  );

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const patch = (key, p) => setForm((f) => ({ ...f, [key]: { ...f[key], ...p } }));
  const isEditing = !!editingItem;
  const isGroup = form.kind === "item_group";
  const isVariant = form.kind === "item_variant";
  const noun = isVariant ? "variant" : isGroup ? "item group" : "item";

  // What the card shows is the record the form saves.
  const record = formToItem(form, isEditing ? editingItem : null);
  const w = form.weapon;
  const a = form.armor;
  const ch = form.charges;
  const spellGrants = form.grants.spells || [];
  const setSpells = (list) => set("grants", { ...form.grants, spells: list });

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    if (sheet) {
      try {
        setSheetSaving(true);
        setSheetError(null);
        await sheet.onSubmit(record, { catalogue: saveTo === "catalogue", asNew });
        onClose();
      } catch (e) {
        setSheetError(e?.message || "Couldn't save");
      } finally {
        setSheetSaving(false);
      }
      return;
    }
    try {
      if (isEditing) await updateItem(editingItem.id, record);
      else await createItem(record);
      onClose();
    } catch {
      /* the error is shown in the footer */
    }
  };

  /* ---- the numbers: the card's own lines, grouped by the window they open ---- */
  const stats = isGroup ? [] : itemStats(record, index).filter((r) => !FOOTER_LINES.has(r.label) && !(isVariant && LINE_WINDOW[r.label] === "base"));
  const groups = [];
  for (const r of stats) {
    const id = LINE_WINDOW[r.label] || "other";
    const last = groups[groups.length - 1];
    if (last && last.id === id) last.rows.push(r);
    else groups.push({ id, rows: [r] });
  }
  const REMOVE = {
    weapon: () => patch("weapon", { on: false }),
    armor: () => patch("armor", { on: false }),
    charges: () => patch("charges", { on: false }),
    bonuses: () => set("modifiers", []),
    base: () => setForm((f) => ({ ...f, base: false, baseItem: "" })),
  };
  const openNew = (id, change) => {
    if (change) change();
    setWin(id);
  };
  const addNumbers = isGroup
    ? []
    : [
        !w.on && {
          label: isVariant ? "weapon changes" : "weapon",
          hint: isVariant ? "A +1, more damage, a new damage type: it changes the base item's weapon" : undefined,
          onClick: () => openNew("weapon", () => patch("weapon", isVariant ? { on: true, category: "", kind: "" } : { on: true, dice: w.dice || "1d6", type: w.type || "bludgeoning" })),
        },
        !a.on && !isVariant && { label: "armor", onClick: () => openNew("armor", () => patch("armor", { on: true, base: a.base ?? 11 })) },
        !ch.on && { label: "charges", hint: "Charges its spells and features can spend", onClick: () => openNew("charges", () => patch("charges", { on: true, max: ch.max ?? 3 })) },
        !form.modifiers.length && { label: "bonus while equipped", onClick: () => openNew("bonuses", () => set("modifiers", [{ target: "ac", op: "add", value: 1 }])) },
        !spellGrants.length && { label: "spells", onClick: () => setWin("spells") },
        !form.curse && !form.sentient && !form.focusAny && !form.focus.length && { label: "cursed, sentient, focus…", onClick: () => setWin("flags") },
        !isVariant && !form.base && !form.baseItem && { label: "built on a base item", onClick: () => setWin("base") },
      ];

  // the record's keys the form has no field for (saved as they are)
  const restKeys = Object.keys(form.rest || {});

  /* ---- the footer ---- */
  const footer = [
    ...(isGroup
      ? []
      : [form.weight != null && form.weight !== "" ? `${form.weight} lb.` : "no weight", formatCurrency(form.value) || "no value"]),
    form.edition === "classic" ? "Classic (2014)" : "One (2024)",
    form.visibility === "public" ? "public" : "private",
  ];

  const winInfo = win ? WINDOWS[win] : null;
  const title = sheet
    ? isEditing ? `Edit your ${editingItem.name || "item"}` : "Your own item"
    : `${isEditing ? "Edit" : copyFromItem ? "Copy" : "New"} ${noun}`;
  const showSubtitle = form.itemTypes.length || form.rarity !== "none" || form.attunement.required || isGroup || isVariant;

  return (
    <CreateModal open={open} title={title} onClose={onClose} onSave={handleSave} saving={sheet ? sheetSaving : saving}
                 saveLabel={isEditing ? "Save Changes" : "Save"} saveDisabled={!started} error={sheet ? sheetError : saveError} width="max-w-2xl">
      {sheet && started && <SheetSaveChoice saveTo={saveTo} setSaveTo={setSaveTo} asNew={asNew} setAsNew={setAsNew} homebrew={sheet.homebrew} />}
      {!started ? (
        <div className="space-y-4">
          <p className="text-sm italic text-ink-faded">Start from…</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {START_POINTS.filter((p) => !sheet || !p.catalogueOnly).map((p) => (
              <button key={p.id} type="button" onClick={() => { setForm(startForm(p.id)); setStarted(true); }}
                      className="rounded-sm border border-rule/40 px-3 py-2 text-left transition hover:border-rubric/60 hover:bg-rubric/5">
                <div className="text-[15px] text-ink">{p.label}</div>
                <div className="text-xs italic text-ink-faded">{p.hint}</div>
              </button>
            ))}
          </div>
          <div>
            <div className={labelCls}>…or a copy of an item from the book</div>
            <EntryPicker entries={known.realItems} index={index} selected={[]} placeholder="search items…"
                         onToggle={(id) => {
                           const it = known.realItems.find((x) => x.id === id);
                           if (!it) return;
                           setForm(itemToForm(it, { copy: true }));
                           setStarted(true);
                         }} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* header: the name, and the line under it */}
          <div className="border-b border-rule/40 pb-1">
            <input type="text" value={form.name} onChange={(e) => { set("name", e.target.value); setNameError(false); }}
                   placeholder={isVariant ? "Variant name (Flame Tongue)" : isGroup ? "Group name" : "Item name"} aria-label="Name" autoFocus={!form.name}
                   className={`w-full bg-transparent text-xl font-bold tracking-wide text-ink outline-none placeholder:font-normal placeholder:italic placeholder:text-ink-faint ${nameError ? "border-b border-bad" : ""}`} />
            {nameError && <p className="text-xs italic text-bad">It needs a name.</p>}
            <button type="button" onClick={() => setWin("type")} className="text-left text-sm italic text-ink-faded hover:text-rubric" title="Kind, type, rarity, attunement">
              {showSubtitle ? itemSubtitle(record) : "type · rarity · attunement"}
            </button>
          </div>

          {/* a variant: what it makes */}
          {isVariant && (
            <div className="border-b border-rule/40 pb-2">
              <StatLine label="Makes" value={variantNames(form, index) || <span className="italic text-ink-faint">no base items yet: pick them</span>} onClick={() => setWin("variant")} />
              {form.propertiesAdd.length > 0 && (
                <StatLine label="Adds" value={form.propertiesAdd.map((p) => titleCase(p.replace(/_/g, " "))).join(", ")} onClick={() => setWin("variant")} />
              )}
            </div>
          )}

          {/* a group: its members */}
          {isGroup && (
            <div className="border-b border-rule/40 pb-2">
              <StatLine label="Choose one of"
                        value={form.members.length ? form.members.map((id) => nameFromId(id, index)).join(", ") : <span className="italic text-ink-faint">no items yet: pick them</span>}
                        onClick={() => setWin("members")} />
            </div>
          )}

          {/* the numbers */}
          {!isGroup && (
            <div className="border-b border-rule/40 pb-2">
              <div className="space-y-1">
                {groups.map((g, i) => (
                  <LineGroup key={`${g.id}-${i}`} rows={g.rows} onOpen={() => g.id !== "other" && setWin(g.id)} onRemove={REMOVE[g.id]}
                             removeLabel={WINDOWS[g.id]?.title.toLowerCase()} />
                ))}
                {spellGrants.length > 0 && (
                  <LineGroup rows={[{ label: "Casts", value: spellGrants.map((sp) => spellWords(sp, index)).join(", ") }]} onOpen={() => setWin("spells")}
                             onRemove={() => setSpells([])} removeLabel="its spells" />
                )}
                {!groups.length && !spellGrants.length && <p className="text-sm italic text-ink-faint">No numbers yet: add what it has.</p>}
              </div>
              <AddRow items={addNumbers} />
            </div>
          )}

          {/* the text */}
          <CardText value={form.text} onChange={(v) => set("text", v)}
                    placeholder="Describe it: what it looks like, what it does. (**Name.** text starts a named part.)" />

          {/* features */}
          <CardFeatures features={form.features || []} onChange={(v) => set("features", v)} text={form.text} index={index}
                        fieldProps={{ itemCharges: !isGroup && ch.on }} />

          {/* what it gives (an item's spells are its "Casts" line) */}
          {!isGroup && (
            <GivesBlock value={form.grants} onChange={(v) => set("grants", v)} parts={["traits", "proficiencies"]} skip={["spells"]}
                        catalogues={{ feats, spells }} index={index} />
          )}

          {/* footer */}
          <div className="flex flex-wrap items-baseline gap-x-3 border-t border-rule/25 pt-1.5 text-xs italic text-ink-faded">
            <button type="button" onClick={() => setWin("more")} className="text-left hover:text-rubric" title="Weight, value, edition, who can see it">
              {footer.join(" · ")}
            </button>
            {restKeys.length > 0 && (
              <button type="button" onClick={() => setWin("other")} className="hover:text-rubric" title="Parts of the book's record the card has no line for, saved as they are">
                · {plural(restKeys.length, "thing")} kept from the book
              </button>
            )}
          </div>
        </div>
      )}

      {winInfo && (
        <PartPopup title={winInfo.title} hint={winInfo.hint} onClose={() => setWin(null)}>
          {win === "type" && (
            <>
              {!sheet && !isEditing && (
                <div>
                  <div className={labelCls}>Kind</div>
                  <Segmented size="sm" options={ITEM_KIND_OPTIONS} value={form.kind} onChange={(v) => set("kind", v)} />
                </div>
              )}
              {!isGroup && <TypeFields form={form} set={set} known={known} />}
              <RarityFields form={form} set={set} tier={!isGroup} />
              {!isGroup && <AttunementField value={form.attunement} onChange={(p) => patch("attunement", p)} />}
            </>
          )}
          {win === "weapon" && (
            <>
              {isVariant && <p className={hintCls}>Changes to the base item's weapon: leave the dice empty to keep the base's.</p>}
              <WeaponFields value={w} onChange={(p) => patch("weapon", p)} known={known} variant={isVariant} />
            </>
          )}
          {win === "armor" && <ArmorFields value={a} onChange={(p) => patch("armor", p)} />}
          {win === "charges" && <ChargesEditor value={ch} onChange={(p) => patch("charges", p)} />}
          {win === "bonuses" && <BonusesFields value={form.modifiers} onChange={(v) => set("modifiers", v)} />}
          {win === "spells" && <ItemSpellsFields value={spellGrants} onChange={setSpells} spells={spells} index={index} hasCharges={ch.on} />}
          {win === "flags" && <MagicFlags form={form} set={set} />}
          {(win === "base" || win === "variant") && <BaseFields form={form} set={set} known={known} index={index} />}
          {win === "members" && (
            <div className="space-y-2">
              <EntryPicker entries={known.realItems} index={index} selected={form.members} placeholder="search items…"
                           onToggle={(id) => set("members", toggleIn(form.members, id))} />
              <label className="flex items-baseline gap-2 text-sm">
                <input type="checkbox" checked={form.hiddenMembers} onChange={(e) => set("hiddenMembers", e.target.checked)} className="accent-rubric" />
                Only the group is listed in the book
              </label>
            </div>
          )}
          {win === "more" && (
            <>
              {!isGroup && <WeightValueFields form={form} set={set} />}
              <div className="flex flex-wrap gap-x-10 gap-y-3">
                <div>
                  <div className={labelCls}>Edition</div>
                  <Segmented size="sm" options={EDITION_OPTIONS} value={form.edition} onChange={(v) => set("edition", v)} />
                </div>
                <div>
                  <div className={labelCls}>Visibility</div>
                  <Segmented size="sm" options={VISIBILITY_OPTIONS} value={form.visibility} onChange={(v) => set("visibility", v)} />
                </div>
              </div>
            </>
          )}
          {win === "other" && <p className={hintCls}>Kept as they are: {restKeys.map((k) => titleCase(k.replace(/_/g, " "))).join(", ")}.</p>}
        </PartPopup>
      )}

    </CreateModal>
  );
}
