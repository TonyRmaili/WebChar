import React, { useEffect, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import useEncounterStore from "../../../store/EncounterStore";
import { usePopupStore } from "../../../store/PopupStore";
import useTableStore from "../../../store/TableStore";
import { INK, InkButton, InkNumber, InkRemove, InkSelect, InkText, InkTextArea, ParchmentSheet } from "../../../styles/parchment";
import { addBtn } from "../../../styles/parchmentForm";
import ParchmentMenu from "../../../styles/ParchmentMenu";
import { withLootItem } from "../encounters/encounterHelpers";
import CataloguePicker from "../statblock/CataloguePicker";
import useStatblockDrafts from "../statblock/statblockDrafts";
import { openTracker } from "../tracker/TrackerWindow";
import {
  CATEGORIES,
  DICE,
  addRow,
  changeRow,
  checkRows,
  dieOf,
  dieNumber,
  linkName,
  linkableTables,
  rangeLabel,
  readRoll,
  removeRow,
  rowAt,
  rowsOf,
  runsLabel,
  setRange,
  spreadEvenly,
} from "./tableLogic";

/* ═══════════════════════════════════════════════════════════════════
   TableWindow — one table as a card window (popup type "table"):
   movable, resizable, minimized to the footer, like the statblock cards.

   Reading: roll your real die and type the number (or click a row) — that
   row is marked. A row's link opens what it points at: the item's card,
   the encounter's tracker, or the other table's card. Right-click a row
   for more (add its item to an encounter's loot, …); right-click anywhere
   else to edit.

   Editing (right-click → Edit, then Save or Discard): name, category,
   die, notes and the rows. Ranges keep in step by themselves
   (tableLogic.setRange); gaps, overlaps and numbers past the die are
   warnings only.

   Unsaved edits live in the drafts store (statblockDrafts.js, keyed by
   window id), so minimizing the card keeps them.
   ═══════════════════════════════════════════════════════════════════ */

const asList = (v) => (Array.isArray(v) ? v : []);
const where = (scope) => (scope === "all" ? "all campaigns" : "this campaign");

export const tableWindowId = (d) => `table__${d.campaignName}__${d.tableId}`;

// A card for reading, a bit narrower than a statblock; each new one a
// little down and to the right of the last, so they don't hide each other.
function tableFrame() {
  const open = usePopupStore.getState().openPopups.filter((p) => p.type === "table").length;
  const width = Math.min(760, window.innerWidth - 32);
  const height = Math.max(420, window.innerHeight - 96);
  const step = 28 * (open % 6);
  return { width, height, x: Math.max(16, Math.round((window.innerWidth - width) / 2) + step), y: 48 + step };
}

// Open (or bring forward) a table's card. `editFrom`: open it already
// editing, starting from this (a table that was just made).
export function openTable(data, { editFrom } = {}) {
  const store = usePopupStore.getState();
  const id = tableWindowId(data);
  // (Edits already in progress are kept.)
  if (editFrom && useStatblockDrafts.getState().drafts[id] == null) useStatblockDrafts.getState().setDraft(id, structuredClone(editFrom));
  const known = store.openPopups.some((p) => p.id === id) || store.minimized.some((p) => p.id === id);
  const f = known ? null : tableFrame();
  store.open("table", data);
  if (f) {
    usePopupStore.getState().resize(id, f.width, f.height);
    usePopupStore.getState().move(id, f.x, f.y);
  }
}

export function closeTable(data) {
  const id = tableWindowId(data);
  usePopupStore.setState((s) => ({ openPopups: s.openPopups.filter((p) => p.id !== id), minimized: s.minimized.filter((p) => p.id !== id) }));
  useStatblockDrafts.getState().clearDraft(id);
}

const smallCaps = `text-[10px] font-semibold uppercase tracking-[0.18em] ${INK.faded}`;

/* ─── reading ────────────────────────────────────────────────────── */

function RowLine({ row, die, hit, names, onPick, onFollow, onMenu }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onPick(row)}
      onKeyDown={(e) => e.key === "Enter" && onPick(row)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onMenu(e, row);
      }}
      className={`flex cursor-pointer items-baseline gap-4 border-b border-[#7b6346]/15 px-1 py-1.5 text-[15px] last:border-b-0 ${hit ? "bg-[#9a3412]/10" : "hover:bg-[#7b6346]/5"}`}
    >
      <span className={`w-16 shrink-0 text-right font-semibold tabular-nums ${hit ? INK.rubric : ""}`}>
        {hit && <span className="mr-1.5 text-[10px]">◆</span>}
        {rangeLabel(row, die)}
      </span>
      <span className="min-w-0">
        {row.text}
        {row.link && (
          <>
            {row.text ? " " : ""}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFollow(row.link);
              }}
              className={`${INK.rubric} underline decoration-dotted underline-offset-4 hover:text-[#3a2716]`}
              title={row.link.kind === "item" ? "Open the item" : row.link.kind === "encounter" ? "Open the encounter's tracker" : "Open the table"}
            >
              {row.link.kind === "table" ? `roll on ${linkName(row.link, names)}` : linkName(row.link, names)}
            </button>
          </>
        )}
        {!row.text && !row.link && <span className={`italic ${INK.faint}`}>nothing written yet</span>}
      </span>
    </div>
  );
}

function Warnings({ table }) {
  const die = dieOf(table);
  const check = checkRows(table);
  const lines = [
    check.gaps.length ? `Not covered: ${runsLabel(check.gaps, die)} — a roll there gives nothing.` : "",
    check.overlaps.length ? `More than one row has ${runsLabel(check.overlaps, die)}.` : "",
    check.past.length ? `${runsLabel(check.past, die)} can't be rolled on a d${die}.` : "",
  ].filter(Boolean);
  if (!lines.length || !rowsOf(table).length) return null;
  return (
    <div className="mt-3 space-y-0.5">
      {lines.map((l) => (
        <p key={l} className={`text-[13px] italic ${INK.rubric}`}>
          {l}
        </p>
      ))}
    </div>
  );
}

/* ─── editing ────────────────────────────────────────────────────── */

function RowEditor({ table, row, names, linkTables, picking, onPicking, change }) {
  const die = dieOf(table);
  const isAll = table.scope === "all";
  const chooseLink = (value) => {
    if (value === "item") return onPicking(row.id);
    const [kind, id] = value.split(":");
    if (kind === "encounter" || kind === "table") change(changeRow(table, row.id, { link: { kind, id } }));
  };

  return (
    <div className="border-b border-[#7b6346]/15 py-1.5 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="flex w-24 shrink-0 items-baseline gap-1">
          <InkNumber value={row.from} min={1} onChange={(v) => v != null && change(setRange(table, row.id, v, Math.max(v, row.to)))} aria-label="From" className="h-7 w-10 text-center tabular-nums" />
          –
          <InkNumber value={row.to} min={1} onChange={(v) => v != null && change(setRange(table, row.id, Math.min(row.from, v), v))} aria-label="To" className="h-7 w-10 text-center tabular-nums" />
        </span>
        <InkText
          value={row.text || ""}
          onChange={(e) => change(changeRow(table, row.id, { text: e.target.value }))}
          placeholder={row.link ? "words before the link — e.g. 2d4 ×" : "what happens — e.g. 2d6 goblins, a storm rolls in"}
          aria-label={`What happens on ${rangeLabel(row, die)}`}
          className="h-7 min-w-[12rem] flex-1"
        />
        {row.link ? (
          <span className={`inline-flex items-baseline text-sm ${INK.rubric}`}>
            → {row.link.kind === "table" ? "roll on " : ""}
            {linkName(row.link, names)}
            <InkRemove onClick={() => change(changeRow(table, row.id, { link: null }))} label="Remove the link" />
          </span>
        ) : (
          <InkSelect value="" onChange={(e) => e.target.value && chooseLink(e.target.value)} aria-label="Link it to something" className="h-7 text-sm">
            <option value="">+ link…</option>
            <option value="item">an item from the catalogue…</option>
            {!isAll && asList(names.encounters).length > 0 && (
              <optgroup label="An encounter">
                {asList(names.encounters).map((e) => (
                  <option key={e.id} value={`encounter:${e.id}`}>
                    {e.name || "Unnamed"}
                  </option>
                ))}
              </optgroup>
            )}
            {linkTables.length > 0 && (
              <optgroup label="Roll on another table">
                {linkTables.map((t) => (
                  <option key={t.id} value={`table:${t.id}`}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
          </InkSelect>
        )}
        <InkRemove onClick={() => change(removeRow(table, row.id))} label={`Remove the row ${rangeLabel(row, die)}`} />
      </div>
      {picking && (
        <div className="mb-2 mt-2 pl-[6.75rem]">
          <CataloguePicker
            kind="item"
            has={() => false}
            onAdd={(entry) => {
              change(changeRow(table, row.id, { link: { kind: "item", name: entry.name, source: entry.source ?? null } }));
              onPicking(null);
            }}
            onView={(type, entry) => usePopupStore.getState().open(type, entry)}
            onClose={() => onPicking(null)}
          />
        </div>
      )}
    </div>
  );
}

function TableEditor({ table, tables, names, change }) {
  const [picking, setPicking] = useState(null); // row id choosing an item
  const rows = rowsOf(table);
  const linkTables = linkableTables(table, tables);
  const categories = [...new Set([...CATEGORIES, ...asList(tables).map((t) => t.category).filter(Boolean)])];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
        <label className={`flex items-baseline gap-2 italic ${INK.faded}`}>
          category
          <InkText value={table.category || ""} onChange={(e) => change({ ...table, category: e.target.value })} list="table-categories" placeholder="e.g. Loot" aria-label="Category" className="h-7 w-40 text-[15px]" />
          <datalist id="table-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className={`flex items-baseline gap-2 italic ${INK.faded}`}>
          die
          <InkSelect value={dieOf(table)} onChange={(e) => change({ ...table, die: Number(e.target.value) })} aria-label="Die" className="h-7 text-[15px]">
            {DICE.map((d) => (
              <option key={d} value={d}>
                d{d}
              </option>
            ))}
          </InkSelect>
        </label>
      </div>

      <div>
        <div className={`flex gap-3 px-1 ${smallCaps}`}>
          <span className="w-24 shrink-0">d{dieOf(table)}{dieOf(table) === 100 ? " (00 = 100)" : ""}</span>
          <span>What happens</span>
        </div>
        {rows.length === 0 ? (
          <p className={`py-2 text-sm italic ${INK.faint}`}>No rows yet.</p>
        ) : (
          rows.map((row) => (
            <RowEditor key={row.id} table={table} row={row} names={names} linkTables={linkTables} picking={picking === row.id} onPicking={setPicking} change={change} />
          ))
        )}
        <p className="mt-2 flex flex-wrap items-baseline gap-x-5">
          <button type="button" onClick={() => change(addRow(table))} className={addBtn}>
            + row
          </button>
          {rows.length > 1 && (
            <InkButton onClick={() => change(spreadEvenly(table))} title={`Share 1–${dieOf(table)} out evenly over the rows, in their order`}>
              spread evenly
            </InkButton>
          )}
        </p>
        <Warnings table={table} />
        {table.scope === "all" && <p className={`mt-1 text-xs italic ${INK.faint}`}>A table for all campaigns links only to items and other tables for all campaigns.</p>}
      </div>

      <div>
        <p className={smallCaps}>Notes</p>
        <InkTextArea value={table.notes || ""} onChange={(e) => change({ ...table, notes: e.target.value })} rows={3} placeholder="When to roll, how to read the results…" aria-label="Notes" />
      </div>
    </div>
  );
}

/* ─── the card ───────────────────────────────────────────────────── */

export default function TableWindow({ table: ref }) {
  const { campaignName, tableId } = ref;
  const id = tableWindowId(ref);

  const tables = useTableStore((s) => s.records[campaignName]);
  const saved = asList(tables).find((t) => t.id === tableId);
  const encounters = useEncounterStore((s) => s.encounters[campaignName]);
  const names = { encounters, tables };

  const draft = useStatblockDrafts((s) => s.drafts[id]) ?? null;
  const setDraft = (d) => useStatblockDrafts.getState().setDraft(id, d);
  const clearDraft = () => useStatblockDrafts.getState().clearDraft(id);
  const editing = draft !== null;
  const table = draft ?? saved;
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(saved);

  const [picked, setPicked] = useState(null); // { n } typed, or { rowId } clicked
  const [menu, setMenu] = useState(null); // { x, y, row? }
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!tables) useTableStore.getState().fetch(campaignName);
    if (!encounters) useEncounterStore.getState().fetchEncounters(campaignName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignName]);

  // Keep the window's title (and its footer button) on the table's name.
  const shownName = table?.name || "New table";
  useEffect(() => {
    if (shownName === ref.name) return;
    usePopupStore.setState((s) => ({
      openPopups: s.openPopups.map((p) => (p.id === id ? { ...p, data: { ...p.data, name: shownName } } : p)),
      minimized: s.minimized.map((p) => (p.id === id ? { ...p, data: { ...p.data, name: shownName } } : p)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownName]);

  if (!table) {
    return (
      <div className="h-full overflow-y-auto bg-[#1c120b] p-2">
        <ParchmentSheet>
          <p className={`italic ${INK.faint}`}>{tables ? "This table is gone." : "Fetching…"}</p>
        </ParchmentSheet>
      </div>
    );
  }

  const die = dieOf(table);
  const hitRow = picked?.rowId ? rowsOf(table).find((r) => r.id === picked.rowId) : picked?.n != null ? rowAt(table, picked.n) : null;

  const save = async () => {
    setSaving(true);
    const store = useTableStore.getState();
    store.update(campaignName, tableId, () => draft);
    const res = await store.flush(campaignName, tableId);
    setSaving(false);
    if (res.ok) clearDraft();
    setNotice(res.ok ? null : `Couldn't save — ${res.message}.`);
  };

  const close = () => {
    if (dirty && !window.confirm("Close without saving your changes?")) return;
    clearDraft();
    usePopupStore.getState().close(id);
  };

  // The row only keeps an item's name + source, so look the item up for its card.
  const viewItem = async (link) => {
    const find = () => asList(useCatalogueStore.getState().items).find((e) => e?.name === link.name && (e?.source ?? null) === (link.source ?? null));
    let full = find();
    if (!full) {
      await useCatalogueStore.getState().loadItems?.();
      full = find();
    }
    usePopupStore.getState().open("item", full || { name: link.name, source: link.source });
  };

  const follow = (link) => {
    if (link.kind === "item") return viewItem(link);
    if (link.kind === "encounter") {
      const enc = asList(encounters).find((e) => e.id === link.id);
      return enc ? openTracker({ name: enc.name, campaignName, encounterId: enc.id }) : setNotice("That encounter isn't in this campaign.");
    }
    if (link.kind === "table") {
      const t = asList(tables).find((x) => x.id === link.id);
      return t ? openTable({ name: t.name, campaignName, tableId: t.id }) : setNotice("That table isn't in this campaign.");
    }
  };

  const addToLoot = (enc, link) => {
    useEncounterStore.getState().update(campaignName, enc.id, (e) => withLootItem(e, link));
    setNotice(`${link.name} was added to the loot of ${enc.name}.`);
  };

  const rowGroups = (row) => {
    const link = row.link;
    const out = [{ items: [{ label: "This is what was rolled", onSelect: () => setPicked({ rowId: row.id }) }] }];
    if (link?.kind === "item") {
      out.push({ items: [{ label: `Open ${link.name}`, onSelect: () => viewItem(link) }] });
      out.push({
        heading: "Add it to the loot of…",
        items: asList(encounters).map((e) => ({ label: e.name || "Unnamed", onSelect: () => addToLoot(e, link) })),
        empty: "No encounters yet",
      });
    }
    if (link?.kind === "encounter") out.push({ items: [{ label: "Open the encounter's tracker", onSelect: () => follow(link) }] });
    if (link?.kind === "table") out.push({ items: [{ label: `Open ${linkName(link, names)}`, onSelect: () => follow(link) }] });
    return out;
  };

  const cardGroups = [
    {
      items: editing
        ? [
            { label: saving ? "Saving…" : "Save changes", onSelect: save, disabled: !dirty || saving },
            { label: "Discard changes", onSelect: clearDraft },
          ]
        : [{ label: "Edit", onSelect: () => setDraft(structuredClone(saved)) }],
    },
    {
      items: [
        { label: "Minimize", onSelect: () => usePopupStore.getState().minimize(id), note: editing ? "keeps your edits" : undefined },
        { label: "Close", onSelect: close },
      ],
    },
  ];

  return (
    <div
      className="h-full overflow-y-auto bg-[#1c120b] p-2"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <ParchmentSheet>
        <div className="mb-4">
          {editing ? (
            <InkText value={table.name || ""} onChange={(e) => setDraft({ ...table, name: e.target.value })} placeholder="Name of the table" aria-label="Name" className="h-9 w-full max-w-md text-2xl" />
          ) : (
            <h2 className="text-2xl tracking-wide">{table.name}</h2>
          )}
          <p className={`text-[13px] italic ${INK.faded}`}>
            {[table.category, `d${die}`, `for ${where(table.scope)}`].filter(Boolean).join(" · ")}
            <span className={`ml-2 ${INK.faint}`}>· right-click to {editing ? "save or discard" : "edit"}</span>
          </p>
          {editing && <p className={`text-[13px] italic ${INK.rubric}`}>Editing{dirty ? " · unsaved changes" : ""}</p>}
          {notice && (
            <p className={`mt-1 flex flex-wrap items-baseline gap-x-3 text-[13px] italic ${INK.faded}`} role="status">
              {notice}
              <InkButton onClick={() => setNotice(null)}>dismiss</InkButton>
            </p>
          )}
        </div>

        {editing ? (
          <TableEditor table={table} tables={tables} names={names} change={setDraft} />
        ) : (
          <>
            {table.notes && <p className={`mb-4 whitespace-pre-line text-[15px] italic ${INK.faded}`}>{table.notes}</p>}

            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              <span className={`italic ${INK.faded}`}>rolled</span>
              <InkNumber
                value={picked?.n ?? null}
                onChange={(v) => setPicked(v == null ? null : { n: readRoll(v, die) })}
                min={0}
                aria-label={`What you rolled on the d${die}`}
                className="h-7 w-14 text-center text-lg tabular-nums"
              />
              {picked && (
                <>
                  <span className={`italic ${hitRow ? INK.rubric : INK.faint}`}>
                    {hitRow ? `→ ${rangeLabel(hitRow, die)}` : `nothing on ${dieNumber(picked.n, die)}`}
                  </span>
                  <InkButton onClick={() => setPicked(null)}>clear</InkButton>
                </>
              )}
              {!picked && <span className={`italic ${INK.faint}`}>type what your d{die} shows, or click a row</span>}
            </div>

            {rowsOf(table).length === 0 ? (
              <p className={`py-3 italic ${INK.faint}`}>No rows yet — right-click to edit.</p>
            ) : (
              <div>
                <div className={`flex gap-4 px-1 pb-1 ${smallCaps}`}>
                  <span className="w-16 shrink-0 text-right">d{die}</span>
                  <span>What happens</span>
                </div>
                {rowsOf(table).map((row) => (
                  <RowLine
                    key={row.id}
                    row={row}
                    die={die}
                    hit={hitRow?.id === row.id}
                    names={names}
                    onPick={(r) => setPicked({ rowId: r.id })}
                    onFollow={follow}
                    onMenu={(e, r) => setMenu({ x: e.clientX, y: e.clientY, row: r })}
                  />
                ))}
              </div>
            )}
            <Warnings table={table} />
          </>
        )}
      </ParchmentSheet>

      {menu && (
        <ParchmentMenu
          x={menu.x}
          y={menu.y}
          title={menu.row ? `${rangeLabel(menu.row, die)} · ${table.name}` : table.name}
          subtitle={editing ? (dirty ? "editing · unsaved changes" : "editing") : undefined}
          groups={menu.row && !editing ? [...rowGroups(menu.row), ...cardGroups] : cardGroups}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}