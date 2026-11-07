import React, { useCallback, useMemo, useRef, useState } from "react";
import useCharStore from "../../../../store/CharStore";
import { effectChips, effectDamage, usesFromCharges } from "../play/playHelpers";
import { INK, InkSelect, InkText, ParchmentSheet, Title } from "../../../../styles/parchment";
import { DefineSection, Field, Hint, Switch, addBtn, inputCls } from "../../../../styles/parchmentForm";
import { ACTION_GROUPS, EffectEditor, SOURCES, idGen, newEffect, sourceLabel } from "./effectEditor";

/* Define tab: Effects — everything that becomes a button in Play's
   "Actions & Charges". Written on parchment.

   Grouped by when you use it (Action, Bonus Action, Reaction, Passive).
   Each row is one ledger line with the same numbers Play shows; the
   diamond turns it on/off in Play, click the name to open the editor. At full width the rows sit in two
   columns and an open editor spans both. Data shape is unchanged.

   Feats live on their own tab now; the editor itself is shared with it
   (effectEditor.jsx). */


/* ─── One effect: summary row + editor ───────────────────────────── */

function EffectRow({ row, charData, open, onToggle, onPatch, onReplace, onRemove, onDuplicate }) {
  const chips = effectChips(charData, row);
  const damage = effectDamage(charData, row);
  const uses = usesFromCharges(row.charges);

  return (
    <div className={`${open ? "col-span-full" : ""} ${row.active ? "" : "opacity-60"}`}>
      {/* Ledger line */}
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
          {row.name || "unnamed effect"}
        </button>
        <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`}>{sourceLabel(row.trait)}</span>
        <span aria-hidden="true" className="mx-1 min-w-[0.75rem] flex-1 translate-y-[-4px] border-b-2 border-dotted border-[#7b6346]/35" />
        <span className="flex shrink-0 flex-wrap items-baseline justify-end gap-x-2 text-xs">
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
        </span>
      </div>

      {/* Editor */}
      {open && (
        <EffectEditor
          row={row}
          onPatch={onPatch}
          onReplace={onReplace}
          onRemove={onRemove}
          onDuplicate={onDuplicate}
          onDone={onToggle}
          sourceField={
            <Field label="Source">
              <select value={row.trait || "standard"} onChange={(e) => onPatch({ trait: e.target.value })} className={`${inputCls} cursor-pointer`}>
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          }
        />
      )}
    </div>
  );
}

/* ─── One group (Actions, Bonus Actions…) ─────────────────────────── */

function EffectGroup({ group, rows, filtered, onAdd, children }) {
  return (
    <DefineSection
      title={group.title}
      count={filtered ? `${rows.length} shown` : rows.length}
      storageKey={`define.effects.${group.value}`}
      actions={(setOpen) => (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            onAdd();
          }}
          className={addBtn}
        >
          + add
        </button>
      )}
    >
      {rows.length === 0 ? <Hint>{filtered ? "Nothing matches." : "None yet."}</Hint> : <div className="grid grid-cols-1 items-start gap-x-10 @5xl:grid-cols-2">{children}</div>}
    </DefineSection>
  );
}

/* ─── Tab ─────────────────────────────────────────────────────────── */

export default function EffectsDefine() {
  const charData = useCharStore((s) => s.charData);
  const updateCharField = useCharStore((s) => s.updateCharField);
  const postCharData = useCharStore((s) => s.postCharData);

  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const timer = useRef(null);

  const effects = useMemo(() => (Array.isArray(charData?.effects) ? charData.effects : []), [charData?.effects]);

  // Typing saves a moment later; adding/removing saves right away.
  const persist = useCallback(
    (next, immediate = false) => {
      updateCharField("effects", next);
      clearTimeout(timer.current);
      if (immediate) postCharData();
      else timer.current = setTimeout(() => postCharData(), 400);
    },
    [updateCharField, postCharData]
  );

  const q = query.trim().toLowerCase();
  const filtered = q !== "" || source !== "";
  const visible = useMemo(
    () => effects.filter((e) => (!q || String(e.name || "").toLowerCase().includes(q)) && (!source || (e.trait || "standard") === source)),
    [effects, q, source]
  );

  if (!charData) return null;

  const replaceRow = (next) => persist(effects.map((e) => (e.id === next.id ? next : e)));
  const patchRow = (id, patch) => persist(effects.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const addRow = (actionType) => {
    const row = newEffect(actionType);
    persist([...effects, row], true);
    setOpenId(row.id);
  };

  const removeRow = (row) => {
    if (!window.confirm(`Delete "${row.name || "Unnamed effect"}"?`)) return;
    persist(effects.filter((e) => e.id !== row.id), true);
    if (openId === row.id) setOpenId(null);
  };

  const duplicateRow = (row) => {
    const copy = {
      ...structuredClone(row),
      id: idGen(),
      name: row.name ? `${row.name} (copy)` : "",
      damages: (row.damages || []).map((d) => ({ ...d, id: idGen() })),
    };
    const i = effects.findIndex((e) => e.id === row.id);
    persist([...effects.slice(0, i + 1), copy, ...effects.slice(i + 1)], true);
    setOpenId(copy.id);
  };

  const activeCount = effects.filter((e) => e.active).length;

  return (
    <ParchmentSheet>
      <Title
        after={
          <span className={`text-sm italic ${INK.faded}`}>
            {activeCount} of {effects.length} active
          </span>
        }
        right={
          <>
            <InkText value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search…" aria-label="Search effects" className="h-7 w-32 text-sm" />
            <InkSelect value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter by source" className="h-7 text-sm">
              <option value="">all sources</option>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </InkSelect>
          </>
        }
      >
        Effects
      </Title>
      <p className={`-mt-4 mb-6 text-xs italic ${INK.faint}`}>◆ = shown in Play · click a name to edit</p>

      <div className="space-y-8">
      {ACTION_GROUPS.map((g) => {
        const rows = visible.filter((e) => (e.action_type || "action") === g.value);
        return (
          <EffectGroup key={g.value} group={g} rows={rows} filtered={filtered} onAdd={() => addRow(g.value)}>
            {rows.map((row) => (
              <EffectRow
                key={row.id}
                row={row}
                charData={charData}
                open={openId === row.id}
                onToggle={() => setOpenId((id) => (id === row.id ? null : row.id))}
                onPatch={(patch) => patchRow(row.id, patch)}
                onReplace={replaceRow}
                onRemove={() => removeRow(row)}
                onDuplicate={() => duplicateRow(row)}
              />
            ))}
          </EffectGroup>
        );
      })}
      </div>
    </ParchmentSheet>
  );
}