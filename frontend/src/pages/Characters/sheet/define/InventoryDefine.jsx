import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../../store/CatalogueStore";
import { usePopupStore } from "../../../../store/PopupStore";
import { INK, InkButton, InkNumber, InkSelect, InkText, Leader, Mark, ParchmentSheet, Title } from "../../../../styles/parchment";
import { DefineSection, Field, Hint, PickerRow, PickerShell, Segmented, Tag, TextBlock, addBtn, dangerBtn, ghostBtn } from "../../../../styles/parchmentForm";
import useAuthStore from "../../../../store/AuthStore";
import useCharStore from "../../../../store/CharStore";
import ItemCreatePopup from "../../../Catalogues/Items/ItemCreatePopup";
import { asList, labelOf, useSheet } from "../sheetHelpers";
import { weaponAttack } from "../featureHelpers";
import { actionWords } from "../../../../utils/featureRuntime";
import {
  COINS,
  addFromCatalogue,
  addOwnItem,
  editedCopy,
  variantItem,
  itemRecord,
  newId,
  replaceItem,
  restoredCopy,
  savedCopy,
  attunedCount,
  chargesOf,
  duplicateItem,
  formatGp,
  inventoryOf,
  isConsumable,
  isMagic,
  itemSpells,
  matchesQuery,
  needsAttunement,
  num,
  patchItem,
  regainText,
  removeItem,
  setCoin,
  setMaxAttunement,
  totalInGp,
  weightOf,
} from "./inventoryHelpers";

/* Define tab: Inventory, on parchment.

   The purse, then the items: magic items, mundane gear, consumables.
   Each row is the character's own copy of the item:
     ◆ (left)     shown in Play: its cards there (attack, charges, −1,
                  its features). Off: no card, but equipped it still counts.
     the name     opens its card (the copy as it is now)
     equipped     it counts on the sheet: armour and shield set your AC,
                  its bonuses, grants and features apply
     attuned      only for an item that needs attunement
     ⋯            how many, charges left, your note, edit, duplicate, remove
   "edit" opens the catalogue's item form on the copy: save to this sheet
   only, or to your catalogue too (a homebrew entry; the copy then comes
   from it). "back to the book's" undoes your changes since the original
   (or since your homebrew entry). Items from your class and background
   start here; add more from the catalogue, or make your own. */

const MAX_PICKER_ROWS = 80;

// Rarity inks (theme slots; the catalogue's colours are for dark screens).
const RARITY_INK = {
  common: "text-ink-faded",
  uncommon: "text-good",
  rare: "text-info",
  "very rare": "text-magic",
  legendary: "text-rubric",
  artifact: "text-bad",
};
const rarityInk = (r) => RARITY_INK[String(r || "").toLowerCase()] || INK.faded;
const showRarity = (r) => r && !["none", "unknown"].includes(String(r).toLowerCase());

/* ─── Purse ──────────────────────────────────────────────────────── */

function Purse({ currency, onSet }) {
  const [amount, setAmount] = useState(null);
  const [coin, setCoinKey] = useState("gp");
  const [message, setMessage] = useState("");

  const apply = (sign) => {
    const n = num(amount, 0);
    if (n <= 0) return setMessage("write an amount first");
    const have = num(currency[coin], 0);
    if (sign < 0 && n > have) return setMessage(`not enough — only ${have} ${coin}`);
    onSet(coin, sign > 0 ? have + n : have - n);
    setAmount(null);
    setMessage("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-7 gap-y-2">
        {COINS.map((c) => (
          <label key={c.key} className="inline-flex items-baseline gap-1.5" title={c.label}>
            <InkNumber
              value={num(currency[c.key], 0) || null}
              min={0}
              fallback={0}
              placeholder="0"
              onChange={(v) => onSet(c.key, v ?? 0)}
              aria-label={`${c.label} pieces`}
              className="h-8 w-16 text-lg font-semibold"
            />
            <span className={`text-xs uppercase tracking-wider ${INK.faded}`}>{c.key}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 text-sm">
        <InkNumber
          value={amount}
          min={0}
          placeholder="amount"
          onChange={(v) => {
            setAmount(v);
            setMessage("");
          }}
          aria-label="Amount to add or spend"
          className="h-7 w-20 text-[15px]"
        />
        <InkSelect value={coin} onChange={(e) => setCoinKey(e.target.value)} aria-label="Coin" className="h-7 text-sm">
          {COINS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.key}
            </option>
          ))}
        </InkSelect>
        <InkButton onClick={() => apply(1)}>add</InkButton>
        <InkButton onClick={() => apply(-1)}>spend</InkButton>
        {message ? (
          <span className={`text-xs italic ${INK.rubric}`}>{message}</span>
        ) : (
          <span className={`ml-auto text-xs italic ${INK.faded}`}>
            worth <span className={`not-italic font-semibold ${INK.ink}`}>{formatGp(totalInGp(currency))}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Catalogue picker ───────────────────────────────────────────── */

function ItemPicker({ items, owned, onAdd, onView, onClose }) {
  const [query, setQuery] = useState("");
  const [magicOnly, setMagicOnly] = useState(false);
  const [variant, setVariant] = useState(null); // a variant waiting for its base item
  const q = query.trim().toLowerCase();
  // Items and variants (a variant asks which base item it's on); a group's
  // members are listed on their own.
  const all = items.filter((e) => e?.name && e.kind !== "item_group");
  const byId = useMemo(() => new Map(items.map((e) => [e.id, e])), [items]);
  const bases = variant ? asList(variant.applies_to).map((id) => byId.get(id)).filter(Boolean) : [];
  const rows = all
    .filter((e) => (!magicOnly || isMagic(e)) && (!q || e.name.toLowerCase().includes(q) || String(e.source || "").toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name) || String(a.source).localeCompare(String(b.source)));
  return (
    <PickerShell
      title="Add from the catalogue"
      query={query}
      onQuery={setQuery}
      onClose={onClose}
      filters={
        <button type="button" onClick={() => setMagicOnly((v) => !v)} className={`text-xs italic ${magicOnly ? INK.rubric : INK.faded}`}>
          {magicOnly ? "magic items only" : "all items"}
        </button>
      }
      footer={`${rows.length > MAX_PICKER_ROWS ? `first ${MAX_PICKER_ROWS} of ${rows.length} — type to narrow` : `${rows.length} of ${all.length}`} · click a name to view its card`}
    >
      {variant && (
        <div className="mb-2 border-l-2 border-rubric/40 py-1 pl-3">
          <div className="mb-1 flex items-baseline gap-3 text-sm">
            <span className="italic">{variant.name}: on which {bases.some((x) => x.armor) ? "item" : "weapon"}?</span>
            <button type="button" onClick={() => setVariant(null)} className={`ml-auto text-xs italic ${INK.faded} hover:text-ink`}>
              cancel
            </button>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {bases.length === 0 && <Hint>None of its base items are in your catalogue.</Hint>}
            {bases.map((bi) => (
              <button
                key={bi.id}
                type="button"
                onClick={() => {
                  onAdd(variantItem(variant, bi));
                  setVariant(null);
                }}
                className="text-sm hover:underline hover:decoration-dotted hover:underline-offset-4"
                title={bi.source}
              >
                {bi.name} <span className={`text-[10px] ${INK.faint}`}>{bi.source}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {rows.length === 0 && <Hint className="py-2">{all.length ? "Nothing matches." : "Fetching the catalogue…"}</Hint>}
      {rows.slice(0, MAX_PICKER_ROWS).map((e) => {
        const n = owned(e);
        if (e.kind === "item_variant")
          return (
            <PickerRow
              key={`${e.id}-${e.visibility || ""}`}
              name={e.name}
              onOpen={() => onView(e)}
              meta={showRarity(e.rarity) ? <Tag className={rarityInk(e.rarity)}>{e.rarity}</Tag> : null}
              source={e.source}
              highlight={n > 0}
              action={{ label: "add…", onClick: () => setVariant(e) }}
            />
          );
        return (
          <PickerRow
            key={`${e.id}-${e.visibility || ""}`}
            name={e.name}
            onOpen={() => onView(e)}
            meta={showRarity(e.rarity) ? <Tag className={rarityInk(e.rarity)}>{e.rarity}</Tag> : null}
            source={e.source}
            highlight={n > 0}
            action={{ label: n ? `add (${n})` : "add", onClick: () => onAdd(e) }}
          />
        );
      })}
    </PickerShell>
  );
}

/* ─── One item ───────────────────────────────────────────────────── */

// A word on the dotted line that inks in when it's on (equipped, attuned).
function WordToggle({ on, onClick, label, title, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      title={title}
      className={`shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? INK.rubric : `${INK.faint} hover:text-ink`
      }`}
    >
      {label}
    </button>
  );
}

function ItemRow({ it, d, open, attuneFull, onToggle, onPatch, onRemove, onDuplicate, onView, onEdit, onRestore }) {
  const charges = chargesOf(it);
  const attack = it.equipped && it.weapon ? weaponAttack(it, d) : null;
  const ac = it.armor ? (it.armor.category === "shield" ? `+${it.armor.base ?? 2} AC` : `AC ${it.armor.base}${it.armor.dex_cap === 0 ? "" : " + Dex"}${it.armor.dex_cap ? ` (max ${it.armor.dex_cap})` : ""}`) : null;
  const spells = itemSpells(it);
  const shown = it.shown !== false;

  return (
    <div className={open ? "col-span-full" : ""}>
      <div className={`group flex items-baseline gap-1.5 py-[3px] ${shown ? "" : "opacity-70"}`}>
        <span className="self-center">
          <Mark on={shown} onClick={() => onPatch({ shown: !shown })} label={shown ? "Shown in Play" : "Not shown in Play"} title={shown ? "Shown in Play (when there's something to use)" : "Not shown in Play"} />
        </span>
        <button type="button" onClick={onView} title="Open its card" className={`truncate text-left text-[15px] hover:underline hover:decoration-dotted hover:underline-offset-4 ${it.name ? "" : `italic ${INK.faint}`}`}>
          {it.name || "unnamed item"}
        </button>
        {num(it.qty, 1) !== 1 && !isConsumable(it) && <span className="shrink-0 text-sm tabular-nums">×{num(it.qty, 1)}</span>}
        {showRarity(it.rarity) && <span className={`shrink-0 text-[10px] uppercase tracking-wider ${rarityInk(it.rarity)}`}>{it.rarity}</span>}
        {it.edited && <span className={`shrink-0 text-[10px] italic ${INK.faint}`} title="You changed this item">edited</span>}
        {!it.item && <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`} title="Made by you">yours</span>}
        <Leader />
        <span className="flex min-w-0 shrink flex-wrap items-baseline justify-end gap-x-2 text-xs">
          {ac && <span className={INK.faded}>{ac}</span>}
          {attack && (
            <span className={INK.rubric}>
              {attack.hit >= 0 ? "+" : ""}
              {attack.hit} · {actionWords({ damage: attack.damage })}
            </span>
          )}
          {charges && (
            <span className={`italic ${INK.faded}`}>
              {charges.cur}/{charges.max} charges
            </span>
          )}
        </span>
        <WordToggle on={!!it.equipped} onClick={() => onPatch({ equipped: !it.equipped })} label="equipped" title={it.equipped ? "Equipped / worn: it counts on the sheet" : "Equip or wear it"} />
        {needsAttunement(it) && (
          <WordToggle
            on={!!it.attuned}
            onClick={() => onPatch({ attuned: !it.attuned })}
            label="attuned"
            title={it.attuned ? "Attuned: click to end it" : attuneFull ? "All attunement slots are used (you can still attune)" : "Attune to it"}
          />
        )}
        {isConsumable(it) && (
          <span className="flex shrink-0 items-baseline text-sm tabular-nums" role="group" aria-label={`How many ${it.name || "items"}`}>
            <button type="button" onClick={() => onPatch({ qty: Math.max(0, num(it.qty, 1) - 1) })} className={`w-5 ${INK.faded} hover:text-ink`} title="One fewer" aria-label="One fewer">
              −
            </button>
            <span className="min-w-[1.25rem] text-center font-semibold">{num(it.qty, 1)}</span>
            <button type="button" onClick={() => onPatch({ qty: num(it.qty, 1) + 1 })} className={`w-5 ${INK.faded} hover:text-ink`} title="One more" aria-label="One more">
              +
            </button>
          </span>
        )}
        <button type="button" onClick={onToggle} aria-expanded={open} title="How many, charges, your note, edit…" className={`shrink-0 px-0.5 text-sm leading-none ${open ? INK.rubric : INK.faded} hover:text-ink`}>
          ⋯
        </button>
      </div>

      {open && (
        <div className="mb-4 ml-[26px] mt-1 space-y-3 border-l-2 border-rubric/40 pl-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <Field label="How many">
              <InkNumber value={num(it.qty, 1)} min={0} fallback={1} onChange={(v) => onPatch({ qty: v ?? 1 })} aria-label="How many" className="h-7 w-14 text-[15px]" />
            </Field>
            <Field label="Used up when used">
              <Segmented
                size="sm"
                options={[
                  { value: "yes", label: "yes" },
                  { value: "no", label: "no" },
                ]}
                value={isConsumable(it) ? "yes" : "no"}
                onChange={(v) => onPatch({ consumable: v === "yes" })}
              />
            </Field>
            {charges && (
              <Field label="Charges">
                <span className="flex items-baseline gap-2 text-sm">
                  <InkNumber value={charges.cur} min={0} max={charges.max} fallback={charges.max} onChange={(v) => onPatch({ charges_used: charges.max - (v ?? charges.max) })} aria-label="Charges left" className="h-7 w-10 text-[15px]" />
                  of {charges.max} · <span className={`italic ${INK.faded}`}>{regainText(charges)}</span>
                </span>
              </Field>
            )}
          </div>
          {spells.length > 0 && (
            <p className="text-sm">
              <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${INK.faded}`}>Casts </span>
              {spells.map((s) => `${labelOf(String(s.id).replace(/-[a-z0-9]+$/, ""))}${s.cost ? ` (${s.cost} charge${s.cost > 1 ? "s" : ""})` : s.atWill ? " (at will)" : ""}`).join(", ")}
            </p>
          )}
          {attack && (
            <p className="text-sm">
              {attack.range} · {attack.hit >= 0 ? "+" : ""}
              {attack.hit} to hit{attack.proficient ? "" : " (not proficient)"} · {actionWords({ damage: attack.damage })}
              {attack.versatile && ` · two-handed ${actionWords({ damage: [attack.versatile] })}`}
              {attack.mastery.length > 0 && <span className={INK.faded}> · mastery: {attack.mastery.map(labelOf).join(", ")}</span>}
            </p>
          )}
          <TextBlock value={it.notes || ""} onChange={(e) => onPatch({ notes: e.target.value })} placeholder="Your note…" minRows={1} />
          <div className="flex flex-wrap items-baseline gap-x-5">
            <button type="button" onClick={onToggle} className={ghostBtn}>
              done
            </button>
            <button type="button" onClick={onEdit} className={ghostBtn} title="Change the item itself: its numbers, text, properties…">
              edit the item
            </button>
            {it.edited && it.book && (
              <button type="button" onClick={onRestore} className={ghostBtn} title="Undo every change you made to the item">
                back to the book's
              </button>
            )}
            <button type="button" onClick={onDuplicate} className={ghostBtn}>
              duplicate
            </button>
            <button type="button" onClick={onRemove} className={`ml-auto ${dangerBtn}`}>
              remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tab ─────────────────────────────────────────────────────────── */

// Each item in one of three; equipped and attuned are marks on the line.
const GROUPS = [
  { key: "magic", title: "Magic items", test: (it) => isMagic(it) && !isConsumable(it) },
  { key: "mundane", title: "Mundane", test: (it) => !isMagic(it) && !isConsumable(it) },
  { key: "consumables", title: "Consumables", test: (it) => isConsumable(it) },
];

export default function InventoryDefine() {
  const { ch, d, patchChar } = useSheet();
  const catalogue = useCatalogueStore((s) => s.items);
  const createItem = useCatalogueStore((s) => s.createItem);
  const updateItem = useCatalogueStore((s) => s.updateItem);
  const userName = useAuthStore((s) => s.userData?.name);
  const openPopup = usePopupStore((s) => s.open);
  const [openId, setOpenId] = useState(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  // The item form: { row } to edit a copy, { row: null } to make your own.
  const [form, setForm] = useState(null);

  useEffect(() => {
    const store = useCatalogueStore.getState();
    if (!(store.items || []).length && !store.loadingItems) store.loadItems();
  }, []);

  const inv = useMemo(() => inventoryOf(ch), [ch]);
  if (!ch || !d) return null;

  const attuned = attunedCount(inv.items);
  const attuneFull = inv.max_attunement > 0 && attuned >= inv.max_attunement;
  const q = query.trim().toLowerCase();
  const visible = inv.items.filter((it) => matchesQuery(it, q));
  const weight = weightOf(inv.items);
  const capacity = d.abilities.str.score * 15;

  const write = (patch, now = true) => patchChar(patch, { now });
  const owned = (e) => inv.items.filter((i) => i.item === e.id).reduce((n, i) => n + num(i.qty, 1), 0);
  // The player's own catalogue entry a copy comes from (saving updates it).
  const homebrewOf = (row) => {
    const entry = row?.item ? (catalogue || []).find((c) => c.id === row.item) : null;
    return entry && entry.visibility && entry.created_by === userName ? { id: entry.id, name: entry.name, visibility: entry.visibility } : null;
  };
  const latest = () => inventoryOf(useCharStore.getState().charData || ch).items;

  const add = (entry) => {
    const { patch } = addFromCatalogue(ch, entry);
    write(patch);
  };
  const remove = (it) => {
    if (!window.confirm(`Remove ${it.name || "this item"}${num(it.qty, 1) > 1 ? ` (all ${it.qty})` : ""}?`)) return;
    write(removeItem(ch, it.id));
    setOpenId(null);
  };
  const patchRow = (it, p) => write(patchItem(ch, it.id, p), !("notes" in p));

  // The form's save: the copy only, or the catalogue too.
  const submit = async (record, { catalogue: toCatalogue, asNew }) => {
    const row = form?.row ? latest().find((i) => i.id === form.row.id) || form.row : null;
    const now = useCharStore.getState().charData || ch;
    if (!toCatalogue) {
      if (row) write(replaceItem(now, editedCopy(row, record)));
      else write(addOwnItem(now, { ...itemRecord(record), id: newId(), item: null, from: "manual", qty: 1, equipped: false }));
      return;
    }
    const target = row ? homebrewOf(row) : null;
    const entry = { ...itemRecord(record), visibility: record.visibility || "private" };
    delete entry.id;
    const saved = target && !asNew ? await updateItem(target.id, { ...entry, id: target.id }) : await createItem(entry);
    const fresh = useCharStore.getState().charData || ch;
    if (row) write(replaceItem(fresh, savedCopy(row, saved)));
    else write(addOwnItem(fresh, { ...itemRecord(saved), id: newId(), item: saved.id, from: "manual", qty: 1, equipped: false }));
  };

  const list = (items) => (
    <div className="grid grid-cols-1 items-start gap-x-10 @5xl:grid-cols-2">
      {items.map((it) => (
        <ItemRow
          key={it.id}
          it={it}
          d={d}
          open={openId === it.id}
          attuneFull={attuneFull}
          onToggle={() => setOpenId(openId === it.id ? null : it.id)}
          onPatch={(p) => patchRow(it, p)}
          onRemove={() => remove(it)}
          onDuplicate={() => write(duplicateItem(ch, it))}
          onView={() => openPopup("item", { ...it, _sheet: true })}
          onEdit={() => setForm({ row: it })}
          onRestore={() => write(replaceItem(ch, restoredCopy(it)))}
        />
      ))}
    </div>
  );

  return (
    <ParchmentSheet>
      <Title
        after={
          <span className={`text-sm italic ${INK.faded}`}>
            {inv.items.length} items · {formatGp(totalInGp(inv.currency))}
            {weight > 0 && ` · ${Math.round(weight * 10) / 10} of ${capacity} lb`}
          </span>
        }
        right={<InkText value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search…" aria-label="Search items" className="h-7 w-32 text-sm" />}
      >
        Inventory
      </Title>

      <div className="space-y-8">
        <DefineSection title="Purse" storageKey="define.inventory.purse">
          <Purse currency={inv.currency} onSet={(coin, v) => write(setCoin(ch, coin, v))} />
        </DefineSection>

        <DefineSection
          title="Items"
          count={inv.items.length}
          storageKey="define.inventory.items"
          actions={(setOpen) => (
            <span className="flex items-baseline gap-4">
              <span className={`inline-flex items-baseline gap-1 text-xs italic ${attuneFull ? INK.rubric : INK.faded}`} title="Attunement slots">
                attuned {attuned} of
                <InkNumber value={inv.max_attunement} min={0} fallback={3} onChange={(v) => write(setMaxAttunement(ch, v ?? 3))} aria-label="Attunement slots" className="h-6 w-7 text-xs" />
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpen(true);
                  setPicking((v) => !v);
                }}
                className={addBtn}
              >
                + from the catalogue
              </button>
              <button type="button" onClick={() => setForm({ row: null })} className={addBtn}>
                + your own
              </button>
            </span>
          )}
        >
          {picking && (
            <div className="mb-5">
              <ItemPicker items={catalogue || []} owned={owned} onAdd={add} onView={(e) => openPopup("item", e)} onClose={() => setPicking(false)} />
            </div>
          )}
          {inv.items.length === 0 ? (
            <Hint>Nothing carried yet.</Hint>
          ) : (
            <div className="space-y-5">
              {GROUPS.map((g) => {
                const items = visible.filter(g.test);
                if (!items.length) return null;
                return (
                  <div key={g.key}>
                    <div className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${INK.rubric}`}>
                      {g.title} <span className={`font-normal ${INK.faint}`}>{items.length}</span>
                    </div>
                    {list(items)}
                  </div>
                );
              })}
              <p className={`text-xs italic ${INK.faint}`}>◆ = shown in Play · click a name for its card · equipped / attuned on the line · ⋯ for how many, charges, your note and editing</p>
            </div>
          )}
        </DefineSection>
      </div>

      <ItemCreatePopup
        open={!!form}
        onClose={() => setForm(null)}
        editingItem={form?.row ? { ...itemRecord(form.row), visibility: homebrewOf(form.row)?.visibility } : null}
        sheet={{ onSubmit: submit, homebrew: form?.row ? homebrewOf(form.row) : null }}
      />
    </ParchmentSheet>
  );
}
