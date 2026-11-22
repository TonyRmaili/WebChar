import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import FilterSection from "../FilterSection";
import SheetSaveChoice from "../SheetSaveChoice";
import { CreateModal, fieldCls, hintCls, labelCls, addRowCls, removeRowCls } from "../catalogueStyle";
import {
  BasicsSection, ChipToggles, CurrencyEditor, DescriptionSection, EntryPicker, FoldChips, GrantsEditor, KeptSection, Segmented,
} from "../catalogueParts";
import {
  buildNameIndex, collectUnique, toggleIn, labelFromId, numOrNull, nameFromId, formatRarity, titleCase,
  RARITY_ORDER, DAMAGE_TYPES, CLASS_IDS,
} from "../catalogueHelpers";
import {
  ITEM_KIND_OPTIONS, MODIFIER_TARGETS, emptyItemForm, formToItem, formatModifierTarget, itemToForm,
} from "./itemHelpers";

const TIERS = [
  { value: "", label: "none" },
  { value: "minor", label: "minor" },
  { value: "major", label: "major" },
];
const WEAPON_CATEGORY = [
  { value: "simple", label: "simple" },
  { value: "martial", label: "martial" },
];
const WEAPON_KIND = [
  { value: "melee", label: "melee" },
  { value: "ranged", label: "ranged" },
];
const ARMOR_CATEGORY = ["light", "medium", "heavy", "shield"].map((v) => ({ value: v, label: v }));
const MOD_OPS = [
  { value: "add", label: "+" },
  { value: "set", label: "becomes" },
  { value: "min", label: "at least" },
];
const RESETS = ["dawn", "dusk", "midnight", "long_rest", "special", ""];
const SPELL_USES = [
  { value: "charges", label: "charges" },
  { value: "daily", label: "per dawn" },
  { value: "once", label: "once" },
  { value: "at_will", label: "at will" },
];
const GRANT_SECTIONS = ["traits", "proficiencies"];

// A spell grant's `uses` ↔ the form's words.
const usesMode = (u) =>
  u === "at_will" ? "at_will" : u?.resource ? "charges" : u?.reset === "never" ? "once" : "daily";
const usesFor = (mode, n) =>
  mode === "at_will" ? "at_will"
  : mode === "charges" ? { resource: "charges", cost: n || 1 }
  : mode === "once" ? { max: n || 1, reset: "never" }
  : { max: n || 1, reset: "dawn" };
const usesNumber = (u) => (u?.resource ? u.cost : u?.max) ?? 1;

/* Create, edit or copy an item, a variant or a group. The form writes
   the same record shapes the pipeline makes. */
/* `sheet` (optional): the form edits a character's own item instead of
   the catalogue (the Inventory tab). { onSubmit(record, { catalogue, asNew }),
   homebrew: { id, name } | null — the player's own catalogue entry the
   copy comes from, if any }. "This sheet only" changes just the copy;
   "my catalogue too" also saves it as a homebrew entry (Visibility below
   says private or public), updating `homebrew` unless "as a new entry".
   Without `sheet` the form saves to the catalogue as always. */
export default function ItemCreatePopup({ open, onClose, editingItem, copyFromItem, sheet }) {
  const createItem = useCatalogueStore((s) => s.createItem);
  const updateItem = useCatalogueStore((s) => s.updateItem);
  const saving = useCatalogueStore((s) => s.savingItem);
  const saveError = useCatalogueStore((s) => s.itemsError);

  const items = useCatalogueStore((s) => s.items);
  const feats = useCatalogueStore((s) => s.feats);
  const spells = useCatalogueStore((s) => s.spells);
  const loadSpells = useCatalogueStore((s) => s.loadSpells);

  const [form, setForm] = useState(emptyItemForm);
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
    setNameError(false);
    setSaveTo("sheet");
    setAsNew(false);
    setSheetError(null);
    const src = editingItem || copyFromItem;
    setForm(src ? itemToForm(src, { copy: !editingItem }) : emptyItemForm());
  }, [open, editingItem, copyFromItem]);

  const index = useMemo(() => buildNameIndex(items, spells, feats), [items, spells, feats]);
  // Words the catalogue already uses, offered as chips.
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
  const union = (a, b) => [...new Set([...(a || []), ...(b || [])])];

  const isEditing = !!editingItem;
  const noun = form.kind === "item_variant" ? "Variant" : form.kind === "item_group" ? "Item Group" : "Item";
  const title = sheet ? (isEditing ? `Edit your ${editingItem.name || "item"}` : "Your own item") : `${isEditing ? "Edit" : copyFromItem ? "Copy" : "Create"} ${noun}`;
  const isGroup = form.kind === "item_group";

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    const record = formToItem(form, isEditing ? editingItem : null);
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

  const w = form.weapon;
  const a = form.armor;
  const ch = form.charges;
  const spellGrants = form.grants.spells;
  const setSpells = (list) => set("grants", { ...form.grants, spells: list });
  const restKeys = Object.keys(form.rest);

  return (
    <CreateModal open={open} title={title} onClose={onClose} onSave={handleSave} saving={sheet ? sheetSaving : saving}
                 saveLabel={isEditing ? "Save Changes" : "Save"} error={sheet ? sheetError : saveError}>
      {sheet && <SheetSaveChoice saveTo={saveTo} setSaveTo={setSaveTo} asNew={asNew} setAsNew={setAsNew} homebrew={sheet.homebrew} />}
      <BasicsSection form={form} set={set} nameError={nameError} namePlaceholder="e.g. Cloak of Protection">
        <div>
          <div className={labelCls}>Kind</div>
          <Segmented options={ITEM_KIND_OPTIONS} value={form.kind} onChange={(v) => set("kind", v)} />
          <p className={`${hintCls} mt-1`}>
            {form.kind === "item_variant"
              ? "A template for base items: picking one on a sheet makes a real item, e.g. “Flame Tongue Longsword”."
              : isGroup
                ? "A heading over complete items; the player picks one of its members."
                : "A real object you can own."}
          </p>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
          <label className="flex items-baseline gap-2">
            <span className={`${labelCls} !mb-0`}>Rarity</span>
            <select value={form.rarity} onChange={(e) => set("rarity", e.target.value)} className={`${fieldCls} !w-40`}>
              {RARITY_ORDER.map((r) => <option key={r} value={r}>{formatRarity(r)}</option>)}
            </select>
          </label>
          {!isGroup && (
            <div className="flex items-baseline gap-2">
              <span className={`${labelCls} !mb-0`}>Tier</span>
              <Segmented size="sm" options={TIERS} value={form.tier} onChange={(v) => set("tier", v)} />
            </div>
          )}
        </div>
      </BasicsSection>

      {isGroup ? (
        <FilterSection title="Members">
          <div className="space-y-2">
            <EntryPicker entries={known.realItems} index={index} selected={form.members} placeholder="search items…"
                         onToggle={(id) => set("members", toggleIn(form.members, id))} />
            <label className="flex items-baseline gap-2 text-sm">
              <input type="checkbox" checked={form.hiddenMembers} onChange={(e) => set("hiddenMembers", e.target.checked)} className="accent-rubric" />
              Only the group is listed in the book
            </label>
          </div>
        </FilterSection>
      ) : (
        <>
          <FilterSection title="Type">
            <div className="space-y-2">
              <ChipToggles options={union(known.types, form.itemTypes)} selected={form.itemTypes} labelOf={labelFromId}
                           onToggle={(t) => set("itemTypes", toggleIn(form.itemTypes, t))} />
              <FoldChips label="Tags" options={union(known.tags, form.itemTags)} selected={form.itemTags}
                         onToggle={(t) => set("itemTags", toggleIn(form.itemTags, t))} />
            </div>
          </FilterSection>

          {form.kind === "item_variant" ? (
            <FilterSection title="Made From">
              <div className="space-y-3">
                <div>
                  <div className={labelCls}>Base items it can be made from</div>
                  <EntryPicker entries={known.baseItems} index={index} selected={form.appliesTo} placeholder="search base items…"
                               onToggle={(id) => set("appliesTo", toggleIn(form.appliesTo, id))} />
                </div>
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  <label className="flex items-baseline gap-2">
                    <span className={`${labelCls} !mb-0`}>Name</span>
                    <input type="text" value={form.nameFormat} onChange={(e) => set("nameFormat", e.target.value)} placeholder="Flame Tongue {base}"
                           className={`${fieldCls} !w-56`} />
                  </label>
                  <label className="flex items-baseline gap-2">
                    <span className={`${labelCls} !mb-0`}>Cut from the base name</span>
                    <input type="text" value={form.nameRemove} onChange={(e) => set("nameRemove", e.target.value)} placeholder="e.g. “ Armor”"
                           className={`${fieldCls} !w-32`} />
                  </label>
                </div>
                <p className={hintCls}>
                  <code>{"{base}"}</code> is the base item's name: “{(form.nameFormat || "{base}").replace("{base}", "Longsword")}”.
                </p>
                <FoldChips label="Weapon properties it adds" options={union(known.properties, form.propertiesAdd)} selected={form.propertiesAdd}
                           onToggle={(p) => set("propertiesAdd", toggleIn(form.propertiesAdd, p))} />
              </div>
            </FilterSection>
          ) : (
            <FilterSection title="Base">
              <div className="space-y-2">
                <label className="flex items-baseline gap-2 text-sm">
                  <input type="checkbox" checked={form.base} onChange={(e) => set("base", e.target.checked)} className="accent-rubric" />
                  A mundane base item (variants can be made from it)
                </label>
                <div>
                  <div className={labelCls}>Built on (a unique item made from a base item)</div>
                  <EntryPicker entries={known.baseItems} index={index} selected={form.baseItem ? [form.baseItem] : []} placeholder="search base items…"
                               onToggle={(id) => set("baseItem", form.baseItem === id ? "" : id)} />
                </div>
              </div>
            </FilterSection>
          )}

          <FilterSection title="Weapon" defaultOpen={false}>
            <div className="space-y-2">
              <label className="flex items-baseline gap-2 text-sm">
                <input type="checkbox" checked={w.on} onChange={(e) => patch("weapon", { on: e.target.checked })} className="accent-rubric" />
                It is a weapon
              </label>
              {w.on && (
                <div className="space-y-2 border-l border-rule/30 pl-3">
                  <div className="flex flex-wrap gap-x-8 gap-y-2">
                    <Segmented size="sm" options={WEAPON_CATEGORY} value={w.category} onChange={(v) => patch("weapon", { category: v })} />
                    <Segmented size="sm" options={WEAPON_KIND} value={w.kind} onChange={(v) => patch("weapon", { kind: v })} />
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                    <span className={`${labelCls} !mb-0`}>Damage</span>
                    <input type="text" value={w.dice} onChange={(e) => patch("weapon", { dice: e.target.value })} placeholder="1d8" className={`${fieldCls} !w-16`} />
                    <select value={w.type} onChange={(e) => patch("weapon", { type: e.target.value })} className={`${fieldCls} !w-32`}>
                      <option value="">—</option>
                      {DAMAGE_TYPES.map((d) => <option key={d} value={d}>{labelFromId(d)}</option>)}
                    </select>
                    <span className="text-xs italic text-ink-faded">two-handed</span>
                    <input type="text" value={w.versatile} onChange={(e) => patch("weapon", { versatile: e.target.value })} placeholder="1d10" className={`${fieldCls} !w-16`} />
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                    <span className={`${labelCls} !mb-0`}>Range</span>
                    <input type="number" min={0} value={w.normal ?? ""} onChange={(e) => patch("weapon", { normal: numOrNull(e.target.value) })} placeholder="—" className={`${fieldCls} !w-16`} />
                    <span>/</span>
                    <input type="number" min={0} value={w.long ?? ""} onChange={(e) => patch("weapon", { long: numOrNull(e.target.value) })} placeholder="—" className={`${fieldCls} !w-16`} />
                    <span className="text-xs text-ink-faded">ft.</span>
                    <span className={`${labelCls} !mb-0 ml-6`}>Bonus</span>
                    <span className="text-xs italic text-ink-faded">attack +</span>
                    <input type="number" value={w.attack || ""} onChange={(e) => patch("weapon", { attack: numOrNull(e.target.value) || 0 })} placeholder="0" className={`${fieldCls} !w-12`} />
                    <span className="text-xs italic text-ink-faded">damage +</span>
                    <input type="number" value={w.damage || ""} onChange={(e) => patch("weapon", { damage: numOrNull(e.target.value) || 0 })} placeholder="0" className={`${fieldCls} !w-12`} />
                  </div>
                  <FoldChips label="Properties" options={union(known.properties, w.properties)} selected={w.properties}
                             onToggle={(p) => patch("weapon", { properties: toggleIn(w.properties, p) })} />
                  <FoldChips label="Mastery" options={union(known.masteries, w.mastery)} selected={w.mastery}
                             onToggle={(p) => patch("weapon", { mastery: toggleIn(w.mastery, p) })} />
                </div>
              )}
            </div>
          </FilterSection>

          <FilterSection title="Armor" defaultOpen={false}>
            <div className="space-y-2">
              <label className="flex items-baseline gap-2 text-sm">
                <input type="checkbox" checked={a.on} onChange={(e) => patch("armor", { on: e.target.checked })} className="accent-rubric" />
                It is armor or a shield
              </label>
              {a.on && (
                <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-l border-rule/30 pl-3">
                  <Segmented size="sm" options={ARMOR_CATEGORY} value={a.category} onChange={(v) => patch("armor", { category: v })} />
                  <label className="flex items-baseline gap-1.5">
                    <span className="text-xs text-ink-faded">{a.category === "shield" ? "AC +" : "AC"}</span>
                    <input type="number" value={a.base ?? ""} onChange={(e) => patch("armor", { base: numOrNull(e.target.value) })} className={`${fieldCls} !w-12`} />
                  </label>
                  {a.category !== "shield" && (
                    <label className="flex items-baseline gap-1.5">
                      <span className="text-xs text-ink-faded">Dex max (0 = none, empty = full)</span>
                      <input type="number" min={0} value={a.dexCap ?? ""} onChange={(e) => patch("armor", { dexCap: numOrNull(e.target.value) })} className={`${fieldCls} !w-12`} />
                    </label>
                  )}
                  <label className="flex items-baseline gap-1.5">
                    <span className="text-xs text-ink-faded">Str needed</span>
                    <input type="number" min={0} value={a.strength ?? ""} onChange={(e) => patch("armor", { strength: numOrNull(e.target.value) })} className={`${fieldCls} !w-12`} />
                  </label>
                  <label className="flex items-baseline gap-2 text-sm">
                    <input type="checkbox" checked={a.stealth} onChange={(e) => patch("armor", { stealth: e.target.checked })} className="accent-rubric" />
                    Stealth disadvantage
                  </label>
                </div>
              )}
            </div>
          </FilterSection>

          <FilterSection title="Magic">
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <label className="flex items-baseline gap-2 text-sm">
                  <input type="checkbox" checked={form.attunement.required} onChange={(e) => patch("attunement", { required: e.target.checked })} className="accent-rubric" />
                  Requires attunement
                </label>
                {form.attunement.required && (
                  <input type="text" value={form.attunement.note} onChange={(e) => patch("attunement", { note: e.target.value })}
                         placeholder="e.g. by a wizard" className={`${fieldCls} !w-56`} />
                )}
              </div>

              <div className="space-y-1">
                <label className="flex items-baseline gap-2 text-sm">
                  <input type="checkbox" checked={ch.on} onChange={(e) => patch("charges", { on: e.target.checked })} className="accent-rubric" />
                  Has charges
                </label>
                {ch.on && (
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-l border-rule/30 pl-3">
                    <input type="text" value={ch.max ?? ""} onChange={(e) => patch("charges", { max: e.target.value })} placeholder="7" className={`${fieldCls} !w-14`} />
                    <span className="text-xs italic text-ink-faded">charges, regains</span>
                    <input type="text" value={ch.regain ?? ""} onChange={(e) => patch("charges", { regain: e.target.value })} placeholder="1d6 + 1 or all" className={`${fieldCls} !w-28`} />
                    <span className="text-xs italic text-ink-faded">at</span>
                    <select value={ch.reset} onChange={(e) => patch("charges", { reset: e.target.value })} className={`${fieldCls} !w-28`}>
                      {RESETS.map((r) => <option key={r} value={r}>{r ? labelFromId(r) : "—"}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-baseline gap-3">
                  <span className={`${labelCls} !mb-0`}>While equipped</span>
                  <button type="button" onClick={() => set("modifiers", [...form.modifiers, { target: "ac", op: "add", value: 1 }])} className={addRowCls}>
                    + add a bonus
                  </button>
                </div>
                {form.modifiers.map((m, i) => {
                  const setM = (p) => set("modifiers", form.modifiers.map((x, j) => (j === i ? { ...x, ...p } : x)));
                  return (
                    <div key={i} className="mt-1 flex flex-wrap items-baseline gap-3">
                      <select value={m.target} onChange={(e) => setM({ target: e.target.value })} className={`${fieldCls} !w-44`}>
                        {[...new Set([...MODIFIER_TARGETS, m.target])].map((t) => <option key={t} value={t}>{formatModifierTarget(t)}</option>)}
                      </select>
                      <Segmented size="sm" options={MOD_OPS} value={m.op} onChange={(op) => setM({ op })} />
                      <input type="number" value={m.value ?? ""} onChange={(e) => setM({ value: numOrNull(e.target.value) })} className={`${fieldCls} !w-14`} />
                      <button type="button" onClick={() => set("modifiers", form.modifiers.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove">✕</button>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-x-6">
                <label className="flex items-baseline gap-2 text-sm">
                  <input type="checkbox" checked={form.curse} onChange={(e) => set("curse", e.target.checked)} className="accent-rubric" />
                  Cursed
                </label>
                <label className="flex items-baseline gap-2 text-sm">
                  <input type="checkbox" checked={form.sentient} onChange={(e) => set("sentient", e.target.checked)} className="accent-rubric" />
                  Sentient
                </label>
                <label className="flex items-baseline gap-2 text-sm">
                  <input type="checkbox" checked={form.focusAny} onChange={(e) => set("focusAny", e.target.checked)} className="accent-rubric" />
                  Spellcasting focus for any class
                </label>
              </div>
              {!form.focusAny && (
                <FoldChips label="Spellcasting focus for" options={CLASS_IDS} selected={form.focus} onToggle={(c) => set("focus", toggleIn(form.focus, c))} />
              )}
            </div>
          </FilterSection>

          <FilterSection title="Spells Cast From It">
            <div className="space-y-2">
              <EntryPicker entries={spells} index={index} placeholder="search spells…" selected={[]}
                           onToggle={(id) => setSpells([...spellGrants, { spell: id, how: "item", uses: { resource: "charges", cost: 1 } }])} />
              {spellGrants.length === 0 && <p className={hintCls}>None.</p>}
              {spellGrants.map((sp, i) => {
                const mode = usesMode(sp.uses);
                const setSp = (p) => setSpells(spellGrants.map((x, j) => (j === i ? { ...x, ...p } : x)));
                return (
                  <div key={`${sp.spell}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="min-w-[10rem] text-sm">{nameFromId(sp.spell, index)}</span>
                    {mode !== "at_will" && (
                      <input type="number" min={1} value={usesNumber(sp.uses)} onChange={(e) => setSp({ uses: usesFor(mode, numOrNull(e.target.value)) })}
                             className={`${fieldCls} !w-12`} aria-label="How many" />
                    )}
                    <Segmented size="sm" options={SPELL_USES} value={mode} onChange={(m) => setSp({ uses: usesFor(m, usesNumber(sp.uses)) })} />
                    <span className="text-xs italic text-ink-faded">cast at level</span>
                    <input type="number" min={1} max={9} value={sp.cast_at ?? ""} placeholder="—" onChange={(e) => setSp({ cast_at: numOrNull(e.target.value) ?? undefined })}
                           className={`${fieldCls} !w-12`} />
                    <button type="button" onClick={() => setSpells(spellGrants.filter((_, j) => j !== i))} className={removeRowCls} aria-label="Remove spell">✕</button>
                  </div>
                );
              })}
            </div>
          </FilterSection>

          <FilterSection title="Weight & Value" defaultOpen={false}>
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
              <label className="flex items-baseline gap-1.5">
                <input type="number" min={0} step="any" value={form.weight ?? ""} onChange={(e) => set("weight", numOrNull(e.target.value))} placeholder="—" className={`${fieldCls} !w-16`} />
                <span className="text-xs text-ink-faded">lb.</span>
              </label>
              <CurrencyEditor value={form.value} onChange={(v) => set("value", v)} coins={["pp", "gp", "sp", "cp"]} />
            </div>
          </FilterSection>
        </>
      )}

      <DescriptionSection value={form.text} onChange={(v) => set("text", v)}
                          placeholder={"While wearing this cloak, you gain a +1 bonus to Armor Class and saving throws."} />

      {!isGroup && (
        <GrantsEditor value={form.grants} onChange={(v) => set("grants", v)} catalogues={{ feats, spells }} index={index} show={GRANT_SECTIONS} />
      )}

      <KeptSection features={form.features} onFeatures={(v) => set("features", v)}
                   choices={form.grants.extraChoices} onChoices={(v) => set("grants", { ...form.grants, extraChoices: v })}
                   grants={form.grants.extraGrants} index={index} />
      {restKeys.length > 0 && <p className={`${hintCls} mt-2`}>Also kept as they are: {restKeys.map((k) => titleCase(k.replace(/_/g, " "))).join(", ")}.</p>}
    </CreateModal>
  );
}
