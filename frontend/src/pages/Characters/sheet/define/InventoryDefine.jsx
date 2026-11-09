import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useCharStore from "../../../../store/CharStore";
import { useCatalogueStore } from "../../../../store/CatalogueStore";
import { usePopupStore } from "../../../../store/PopupStore";
import { usesFromCharges, regainLabel } from "../play/playHelpers";
import {
  INK,
  InkButton,
  InkChoice,
  InkHeading,
  InkNumber,
  InkRemove,
  InkSelect,
  InkText,
  InkTextArea,
  Leader,
  Mark,
  ParchmentSheet,
  SubHeading,
  Title,
} from "../../../../styles/parchment";
import {
  COINS,
  NO_CHARGES,
  addFromCatalogue,
  asList,
  attunedCount,
  catalogueKey,
  duplicateRow,
  formatGp,
  isCatalogueItem,
  matchesQuery,
  newGearItem,
  newMagicItem,
  normalizeInventory,
  num,
  ownedCount,
  toggleCharges,
  totalInGp,
} from "./inventoryHelpers";

/* Define tab: Inventory — purse, magic items and gear, on parchment.

   Two kinds of item:
   - From the catalogue: read-only here. Click the name to open its card.
     You set only what's yours: how many, attuned, consumable.
   - Your own (no catalogue source): a glowing rock, a letter, anything
     that isn't a real D&D item. Click the name to edit it and its notes.

   Magic items with charges, and gear marked consumable (◆), show up in
   Play's Actions & Charges. */

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
  const [coin, setCoin] = useState("gp");
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
        <InkSelect
          value={coin}
          onChange={(e) => {
            setCoin(e.target.value);
            setMessage("");
          }}
          aria-label="Coin"
          className="h-7 text-sm"
        >
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

function ItemPicker({ entries, loading, inv, onOpen, onAdd, onClose }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const all = asList(entries).filter((e) => e?.name);
  const rows = all
    .filter((e) => !q || e.name.toLowerCase().includes(q) || String(e.source || "").toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="mb-8">
      <InkHeading right={<InkButton onClick={onClose}>close</InkButton>}>From the catalogue</InkHeading>
      <InkText value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search by name or source…" autoFocus className="mb-2 h-8 w-full max-w-sm text-[15px]" />

      <div className="max-h-72 overflow-y-auto border-y border-rule/25 py-1">
        {loading && all.length === 0 && <p className={`py-2 text-sm italic ${INK.faint}`}>Fetching the catalogue…</p>}
        {!loading && rows.length === 0 && <p className={`py-2 text-sm italic ${INK.faint}`}>Nothing matches.</p>}
        {rows.slice(0, MAX_PICKER_ROWS).map((entry) => {
          const owned = ownedCount(inv, entry);
          const type = asList(entry.types)[0];
          return (
            <div key={catalogueKey(entry)} className="flex items-baseline gap-2 py-1 hover:bg-ink/[0.04]">
              <button type="button" onClick={() => onOpen(entry)} className="truncate text-left text-[15px] hover:underline hover:decoration-dotted" title="Open its card">
                {entry.name}
              </button>
              {entry.reqAttune && <span className={`shrink-0 text-[10px] italic ${INK.faded}`}>attunement</span>}
              {type && <span className={`hidden shrink-0 text-[10px] uppercase tracking-wider @lg:inline ${INK.faint}`}>{type}</span>}
              {showRarity(entry.rarity) && <span className={`hidden shrink-0 text-[10px] uppercase tracking-wider @md:inline ${rarityInk(entry.rarity)}`}>{entry.rarity}</span>}
              <Leader />
              <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`}>{entry.source}</span>
              {owned > 0 && <span className={`shrink-0 text-xs italic ${INK.faded}`}>have {owned}</span>}
              <InkButton onClick={() => onAdd(entry)} active className="shrink-0">
                {owned > 0 ? "+1" : "add"}
              </InkButton>
            </div>
          );
        })}
      </div>
      <p className={`mt-1 text-[11px] italic ${INK.faint}`}>
        {rows.length > MAX_PICKER_ROWS ? `first ${MAX_PICKER_ROWS} of ${rows.length} — type to narrow` : `${rows.length} of ${all.length}`} · potions, scrolls and ammunition go to Gear as consumables
      </p>
    </section>
  );
}

/* ─── Small pieces ───────────────────────────────────────────────── */

// −  n  +
// An item saved without an amount counts as one.
function Count({ value, onChange }) {
  const n = num(value, 1);
  const btn = `w-5 text-center text-base leading-none ${INK.faded} hover:text-ink disabled:opacity-30`;
  return (
    <span className="inline-flex shrink-0 items-baseline">
      <button type="button" className={btn} onClick={() => onChange(Math.max(0, n - 1))} disabled={n <= 0} aria-label="One less">
        −
      </button>
      <InkNumber value={n} min={0} fallback={0} onChange={(v) => onChange(v ?? 0)} aria-label="Amount" className="h-6 w-9 text-[15px]" />
      <button type="button" className={btn} onClick={() => onChange(n + 1)} aria-label="One more">
        +
      </button>
    </span>
  );
}

// Charges for your own magic items, written as a sentence:
// "7 charges, 5 left, regain all · some on a rest"
function ChargeBlanks({ charges, onChange }) {
  const c = charges || {};
  const max = num(c.max_charges, 0);
  const regainsAll = c.reset_amount === "full" || (max > 0 && num(c.reset_amount, 0) >= max);
  const set = (p) => onChange({ ...c, has: true, ...p });

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[15px]">
      <InkNumber
        value={max || null}
        min={1}
        fallback={1}
        placeholder="—"
        onChange={(v) => {
          // Full stays full when the max changes; otherwise keep what's left.
          const cur = c.current_charges;
          const wasFull = cur === "" || cur == null || num(cur, 0) >= max;
          set({ max_charges: v, current_charges: wasFull ? v : Math.min(num(cur, v), v) });
        }}
        aria-label="Max charges"
        className="h-6 w-9"
      />
      <span className={INK.faded}>charges,</span>
      <InkNumber
        value={c.current_charges === "" || c.current_charges == null ? null : num(c.current_charges, null)}
        min={0}
        max={max || undefined}
        placeholder={max ? String(max) : "—"}
        onChange={(v) => set({ current_charges: v ?? "" })}
        aria-label="Charges left"
        className="h-6 w-9"
      />
      <span className={INK.faded}>left · on a rest regain</span>
      <InkChoice
        label="Regain on rest"
        options={[
          { value: "all", label: "all" },
          { value: "some", label: "some" },
        ]}
        value={regainsAll ? "all" : "some"}
        onChange={(v) => set({ reset_amount: v === "all" ? "full" : max > 1 ? 1 : 0 })}
      />
      {!regainsAll && (
        <InkNumber value={num(c.reset_amount, 0)} min={0} max={max || undefined} fallback={0} onChange={(v) => set({ reset_amount: v ?? 0 })} aria-label="Regained on rest" className="h-6 w-9" />
      )}
    </div>
  );
}

/* ─── One item ───────────────────────────────────────────────────── */

function ItemRow({ row, kind, open, attuneFull, onToggle, onPatch, onRemove, onDuplicate, onMove, onOpenCard }) {
  const isMagic = kind === "magic";
  const fromCatalogue = isCatalogueItem(row);
  const uses = isMagic ? usesFromCharges(row.charges) : null;
  const regain = uses ? regainLabel(row.charges?.reset_amount, uses.max) : "";

  const mark = isMagic ? (
    <Mark
      on={!!row.attuned}
      onClick={() => onPatch({ attuned: !row.attuned })}
      disabled={!row.attuned && attuneFull}
      label={row.attuned ? "Attuned" : "Not attuned"}
      title={!row.attuned && attuneFull ? "All attunement slots are used" : row.attuned ? "Attuned — click to end attunement" : "Click to attune"}
    />
  ) : (
    <Mark
      on={!!row.consumed}
      onClick={() => onPatch({ consumed: !row.consumed })}
      label={row.consumed ? "Consumable" : "Not consumable"}
      title={row.consumed ? "Consumable — shown in Play with a −1 button" : "Click to mark as consumable"}
    />
  );

  return (
    <div className="break-inside-avoid">
      <div className="group flex items-baseline gap-1.5 py-[3px]">
        <span className="self-center">{mark}</span>
        <div className="flex min-w-0 flex-1 items-baseline">
          {fromCatalogue ? (
            <button
              type="button"
              onClick={onOpenCard || undefined}
              disabled={!onOpenCard}
              className="truncate text-left text-[15px] enabled:hover:underline enabled:hover:decoration-dotted disabled:cursor-default"
              title={onOpenCard ? "Open its card" : "Loading the catalogue…"}
            >
              {row.name}
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              className={`truncate text-left text-[15px] italic hover:underline hover:decoration-dotted ${row.name ? "" : INK.faint}`}
              title="Your own item — click to edit"
            >
              {row.name || "unnamed item"}
            </button>
          )}
          {fromCatalogue && showRarity(row.rarity) && (
            <span className={`ml-1.5 shrink-0 text-[10px] uppercase tracking-wider ${rarityInk(row.rarity)}`}>{row.rarity}</span>
          )}
          {!fromCatalogue && <span className={`ml-1.5 shrink-0 text-[10px] italic ${INK.faint}`}>your own</span>}
          <Leader />
        </div>
        {uses && (
          <span className={`shrink-0 text-xs ${INK.faded}`} title={regain}>
            <span className={`font-semibold ${INK.ink}`}>
              {uses.cur}/{uses.max}
            </span>{" "}
            charges
          </span>
        )}
        <Count value={row.amount} onChange={(amount) => onPatch({ amount })} />
        <span className="opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <InkRemove onClick={onRemove} label={`Remove ${row.name || "item"}`} />
        </span>
      </div>

      {/* Notes of your own items, as a quiet line under the name */}
      {!fromCatalogue && !open && row.notes && <p className={`-mt-0.5 mb-1 ml-[26px] line-clamp-1 text-xs italic ${INK.faded}`}>{row.notes}</p>}

      {/* Editor — your own items only */}
      {!fromCatalogue && open && (
        <div className="mb-3 ml-[26px] mt-1 space-y-2 border-l-2 border-rubric/40 pl-3">
          <InkText value={row.name ?? ""} autoFocus={!row.name} onChange={(e) => onPatch({ name: e.target.value }, true)} placeholder="what is it?" className="h-8 w-full max-w-sm text-[15px]" aria-label="Item name" />
          {isMagic && (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="self-center">
                <Mark on={!!row.charges?.has} onClick={() => onPatch({ charges: toggleCharges(row.charges, !row.charges?.has) })} label="Has charges" />
              </span>
              {row.charges?.has ? (
                <ChargeBlanks charges={row.charges} onChange={(charges) => onPatch({ charges })} />
              ) : (
                <span className={`text-sm italic ${INK.faded}`}>has charges</span>
              )}
            </div>
          )}
          <InkTextArea value={row.notes ?? ""} onChange={(e) => onPatch({ notes: e.target.value }, true)} placeholder="notes — where you found it, what it does…" rows={2} />
          <div className="flex flex-wrap items-baseline gap-x-4">
            <InkButton onClick={onMove}>{isMagic ? "move to gear" : "move to magic items"}</InkButton>
            <InkButton onClick={onDuplicate}>duplicate</InkButton>
            <InkButton onClick={onToggle} active className="ml-auto">
              done
            </InkButton>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tab ─────────────────────────────────────────────────────────── */

export default function InventoryDefine() {
  const charData = useCharStore((s) => s.charData);
  const updateCharField = useCharStore((s) => s.updateCharField);
  const postCharData = useCharStore((s) => s.postCharData);

  const catalogue = useCatalogueStore((s) => s.items);
  const loadingItems = useCatalogueStore((s) => s.loadingItems);
  const loadItems = useCatalogueStore((s) => s.loadItems);
  const openPopup = usePopupStore((s) => s.open);

  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const timer = useRef(null);

  const inv = useMemo(() => normalizeInventory(charData?.inventory), [charData?.inventory]);

  // The catalogue is needed for the picker and for opening cards.
  const needsCatalogue = pickerOpen || [...inv.magic, ...inv.mundane].some(isCatalogueItem);
  useEffect(() => {
    if (needsCatalogue && asList(catalogue).length === 0 && !loadingItems) loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsCatalogue]);

  // Clicks save right away; typing saves a moment later.
  const persist = useCallback(
    (next, typing = false) => {
      updateCharField("inventory", next);
      clearTimeout(timer.current);
      if (typing) timer.current = setTimeout(() => postCharData(), 400);
      else postCharData();
    },
    [updateCharField, postCharData]
  );

  const entryFor = useCallback(
    (row) => (row.source ? asList(catalogue).find((c) => c.name === row.name && c.source === row.source) : null),
    [catalogue]
  );

  if (!charData) return null;

  const q = query.trim().toLowerCase();
  const attuned = attunedCount(inv);
  const attuneMax = inv.max_attunment;
  const attuneFull = attuneMax > 0 && attuned >= attuneMax;

  const patchRow = (list, id, patch, typing = false) => {
    if (patch.attuned === true && attuneFull) return;
    persist({ ...inv, [list]: inv[list].map((r) => (r.id === id ? { ...r, ...patch } : r)) }, typing);
  };

  const addOwn = (list, row) => {
    persist({ ...inv, [list]: [...inv[list], row] });
    setOpenId(row.id);
  };

  const removeRow = (list, row) => {
    if (!window.confirm(`Remove "${row.name || "unnamed item"}"?`)) return;
    persist({ ...inv, [list]: inv[list].filter((r) => r.id !== row.id) });
    if (openId === row.id) setOpenId(null);
  };

  const duplicate = (list, row) => {
    const copy = duplicateRow(row);
    const i = inv[list].findIndex((r) => r.id === row.id);
    persist({ ...inv, [list]: [...inv[list].slice(0, i + 1), copy, ...inv[list].slice(i + 1)] });
    setOpenId(copy.id);
  };

  // Your own items can switch lists; name, amount and notes come along.
  const move = (from, row) => {
    const to = from === "magic" ? "mundane" : "magic";
    const { id, name, amount, notes } = row;
    const moved = to === "magic" ? { id, name, amount, notes, attuned: false, charges: { ...NO_CHARGES } } : { id, name, amount, notes, consumed: false };
    persist({ ...inv, [from]: inv[from].filter((r) => r.id !== id), [to]: [...inv[to], moved] });
  };

  const renderRows = (list, rows) =>
    rows.map((row) => {
      const entry = entryFor(row);
      return (
        <ItemRow
          key={row.id}
          row={row}
          kind={list === "magic" ? "magic" : "gear"}
          open={openId === row.id}
          attuneFull={attuneFull}
          onToggle={() => setOpenId((id) => (id === row.id ? null : row.id))}
          onPatch={(patch, typing) => patchRow(list, row.id, patch, typing)}
          onRemove={() => removeRow(list, row)}
          onDuplicate={() => duplicate(list, row)}
          onMove={() => move(list, row)}
          onOpenCard={entry ? () => openPopup("item", entry) : null}
        />
      );
    });

  const magic = inv.magic.filter((r) => matchesQuery(r, q));
  const consumables = inv.mundane.filter((r) => r.consumed && matchesQuery(r, q));
  const gear = inv.mundane.filter((r) => !r.consumed && matchesQuery(r, q));
  const itemCount = inv.magic.length + inv.mundane.length;

  return (
    <ParchmentSheet>
      <Title
        after={
          <span className={`text-sm italic ${INK.faded}`}>
            {itemCount} {itemCount === 1 ? "item" : "items"} · {formatGp(totalInGp(inv.currency))}
          </span>
        }
        right={
          <>
            <InkText value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search…" aria-label="Search items" className="h-7 w-32 text-sm" />
            <InkButton onClick={() => setPickerOpen((o) => !o)} active={pickerOpen}>
              {pickerOpen ? "close catalogue" : "+ from the catalogue"}
            </InkButton>
          </>
        }
      >
        Inventory
      </Title>

      {pickerOpen && (
        <ItemPicker
          entries={catalogue}
          loading={loadingItems}
          inv={inv}
          onOpen={(entry) => openPopup("item", entry)}
          onAdd={(entry) => persist(addFromCatalogue(inv, entry).inv)}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <section className="mb-9">
        <InkHeading>Purse</InkHeading>
        <Purse currency={inv.currency} onSet={(key, value) => persist({ ...inv, currency: { ...inv.currency, [key]: value } })} />
      </section>

      <div className="grid grid-cols-1 gap-x-12 gap-y-9 @4xl:grid-cols-2">
        <section>
          <InkHeading
            right={
              <span className={`inline-flex items-baseline gap-1 text-xs italic ${attuneFull ? INK.rubric : INK.faded}`} title="Attunement slots (empty = no limit)">
                ◆ attuned {attuned} of
                <InkNumber value={attuneMax || null} min={0} max={10} fallback={0} placeholder="∞" onChange={(v) => persist({ ...inv, max_attunment: v ?? 0 })} aria-label="Attunement slots" className="h-6 w-7 text-xs not-italic" />
              </span>
            }
          >
            Magic items
          </InkHeading>
          {inv.magic.length === 0 ? (
            <p className={`text-sm italic ${INK.faint}`}>None yet.</p>
          ) : magic.length === 0 ? (
            <p className={`text-sm italic ${INK.faint}`}>Nothing matches “{query}”.</p>
          ) : (
            renderRows("magic", magic)
          )}
          <div className="mt-2">
            <InkButton onClick={() => addOwn("magic", newMagicItem())}>+ your own magic item</InkButton>
          </div>
        </section>

        <section>
          <InkHeading right={<span className={`text-xs italic ${INK.faded}`}>◆ consumable</span>}>Gear</InkHeading>
          {inv.mundane.length === 0 ? (
            <p className={`text-sm italic ${INK.faint}`}>None yet.</p>
          ) : consumables.length + gear.length === 0 ? (
            <p className={`text-sm italic ${INK.faint}`}>Nothing matches “{query}”.</p>
          ) : (
            <>
              {consumables.length > 0 && (
                <>
                  <SubHeading count={consumables.length}>Consumables</SubHeading>
                  {renderRows("mundane", consumables)}
                </>
              )}
              {gear.length > 0 && (
                <>
                  {consumables.length > 0 && <SubHeading count={gear.length}>Everything else</SubHeading>}
                  {renderRows("mundane", gear)}
                </>
              )}
            </>
          )}
          <div className="mt-2">
            <InkButton onClick={() => addOwn("mundane", newGearItem(false))}>+ your own item</InkButton>
          </div>
        </section>
      </div>
    </ParchmentSheet>
  );
}