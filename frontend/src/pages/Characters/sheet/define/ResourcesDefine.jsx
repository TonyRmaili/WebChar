import React, { useMemo, useState } from "react";
import { INK, InkButton, InkNumber, Leader, ParchmentSheet, Title } from "../../../../styles/parchment";
import { DefineSection, Field, Hint, Segmented, addBtn, dangerBtn, ghostBtn, inputCls } from "../../../../styles/parchmentForm";
import { textFromValue, valueFromText } from "../../../Catalogues/catalogueHelpers";
import { labelOf, useSheet } from "../sheetHelpers";
import { featureRows } from "../featureHelpers";
import { ORDINAL } from "../spellbookHelpers";
import { addOwnPool, hiddenPools, patchPool, poolRows, removePool, restorePool, setSlotOverride, slotTable } from "../resourceHelpers";

/* Define tab: Resources — everything the character spends and gets back,
   on parchment. All of it is the player's to set: the numbers the class
   levels give are where it starts, and any number written here replaces
   that one (a Fighter can have spell slots; pact slots can sit at any
   level, up to 9 each).

   1. Spell slots, levels 1–9.
   2. Pact slots, levels 1–9 (back on a short rest).
   3. Pools: the classes' (Rage, Focus Points, Sorcery Points, Second
      Wind…) and the player's own. Each says which features spend it; a
      feature picks its pool in its own editor (Features tab).

   Spending happens in Play; rests give it back. */

const RESETS = [
  { value: "short", label: "short rest" },
  { value: "long", label: "long rest" },
];

/* ─── Slots ──────────────────────────────────────────────────────── */

function SlotGrid({ rows, onSet, hint }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-x-8 gap-y-1 @xl:grid-cols-5 @4xl:grid-cols-9">
        {rows.map((r) => {
          const changed = r.own != null && r.own !== r.book;
          return (
            <label key={r.level} className="flex flex-col items-center" title={changed ? `Your number. The class levels give ${r.book}.` : r.book ? "From your class levels" : undefined}>
              <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${INK.faded}`}>{ORDINAL[r.level]}</span>
              <InkNumber
                value={r.count || null}
                min={0}
                max={9}
                placeholder="—"
                fallback={0}
                onChange={(v) => onSet(r.level, v == null ? 0 : v)}
                aria-label={`${ORDINAL[r.level]} level slots`}
                className={`h-8 w-10 text-center text-lg ${r.count ? "font-semibold" : ""}`}
              />
              {changed ? (
                <button type="button" onClick={() => onSet(r.level, null)} className={`text-[10px] italic ${INK.rubric} hover:underline`} title="Back to the number from your class levels">
                  book {r.book}
                </button>
              ) : (
                <span className="text-[10px]">&nbsp;</span>
              )}
            </label>
          );
        })}
      </div>
      {hint && <p className={`mt-1 text-xs italic ${INK.faint}`}>{hint}</p>}
    </div>
  );
}

/* ─── One pool ───────────────────────────────────────────────────── */

function PoolRow({ pool, open, onToggle, onPatch, onRemove, onRestore }) {
  const entry = pool.entry || {};
  const maxText = entry.max != null ? entry.max : pool.own ? 1 : pool.book_max;
  const back = pool.reset === "short" ? "short rest" : typeof pool.short_rest === "number" ? `long rest (${pool.short_rest} on a short)` : "long rest";
  return (
    <div className={open ? "col-span-full" : ""}>
      <div className="flex items-baseline gap-1.5 py-[3px]">
        <button type="button" onClick={onToggle} aria-expanded={open} className={`truncate text-left text-[15px] hover:underline hover:decoration-dotted hover:underline-offset-4 ${open ? "underline decoration-dotted underline-offset-4" : ""}`}>
          {pool.name}
        </button>
        {pool.edited && <span className={`shrink-0 text-[10px] italic ${INK.faint}`}>edited</span>}
        {pool.own && <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`}>yours</span>}
        <Leader />
        <span className="flex shrink-0 items-baseline gap-2 text-xs">
          {pool.spentBy.length > 0 && <span className={`italic ${INK.faded}`}>spent by {pool.spentBy.map((r) => r.feature.name).join(", ")}</span>}
          <span className={`italic ${INK.faded}`}>back on a {back}</span>
          {pool.die && <span className={INK.faded}>{pool.die}</span>}
          <span className="text-[15px] font-semibold tabular-nums">{pool.max}</span>
        </span>
      </div>

      {open && (
        <div className="mb-4 ml-2 mt-1 space-y-3 border-l-2 border-rubric/40 pl-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <Field label="Name">
              <input type="text" value={entry.name ?? pool.name} onChange={(e) => onPatch({ name: e.target.value })} className={`${inputCls} !w-48`} />
            </Field>
            <Field label="How many">
              <span className="flex items-baseline gap-2">
                <input
                  type="text"
                  value={textFromValue(maxText)}
                  onChange={(e) => onPatch({ max: valueFromText(e.target.value) })}
                  placeholder="3, pb, wis_mod, 5 * level…"
                  aria-label="How many"
                  className={`${inputCls} !w-36`}
                />
                <span className={`text-xs italic ${INK.faded}`}>= {pool.max}</span>
                {pool.book_max != null && pool.book_max !== pool.max && <span className={`text-xs italic ${INK.faint}`}>(book {pool.book_max})</span>}
              </span>
            </Field>
            <Field label="Die">
              <input type="text" value={textFromValue(entry.die ?? pool.die ?? "")} onChange={(e) => onPatch({ die: valueFromText(e.target.value) || null })} placeholder="d8" className={`${inputCls} !w-20`} />
            </Field>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <Field label="All back on a">
              <Segmented size="sm" options={RESETS} value={pool.reset === "short" ? "short" : "long"} onChange={(reset) => onPatch({ reset })} />
            </Field>
            {pool.reset !== "short" && (
              <Field label="On a short rest, regain">
                <span className="flex items-baseline gap-2">
                  <InkNumber
                    value={typeof pool.short_rest === "number" ? pool.short_rest : null}
                    min={0}
                    placeholder="0"
                    onChange={(v) => onPatch({ short_rest: v ? v : "all" })}
                    aria-label="Regained on a short rest"
                    className="h-7 w-10 text-[15px]"
                  />
                  <span className={`text-xs italic ${INK.faint}`}>empty = none</span>
                </span>
              </Field>
            )}
          </div>
          <p className={`text-xs italic ${INK.faint}`}>
            {pool.spentBy.length
              ? `Spent by ${pool.spentBy.map((r) => `${r.feature.name} (${r.consumes?.amount ?? 1})`).join(", ")}.`
              : "No feature spends it yet: it shows on its own above Actions in Play."}{" "}
            A feature picks the pool it spends in its editor (Features tab).
          </p>
          <div className="flex flex-wrap items-baseline gap-x-5">
            <button type="button" onClick={onToggle} className={ghostBtn}>
              done
            </button>
            {pool.edited && (
              <button type="button" onClick={onRestore} className={ghostBtn}>
                back to the book's
              </button>
            )}
            <button type="button" onClick={onRemove} className={`ml-auto ${dangerBtn}`}>
              {pool.own ? "remove" : "hide"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tab ─────────────────────────────────────────────────────────── */

export default function ResourcesDefine() {
  const { ch, d, patchChar } = useSheet();
  const [openId, setOpenId] = useState(null);
  const features = useMemo(() => featureRows(ch, d), [ch, d]);
  if (!ch || !d) return null;

  const pools = poolRows(ch, d, features);
  const hidden = hiddenPools(ch);
  const now = (patch) => patchChar(patch, { now: true });

  const addPool = () => {
    const { patch, id } = addOwnPool(ch, d);
    now(patch);
    setOpenId(id);
  };

  return (
    <ParchmentSheet>
      <Title
        after={
          <span className={`text-sm italic ${INK.faded}`}>
            {d.spell_slots.slots.reduce((n, x) => n + x, 0)} spell slots · {d.spell_slots.pact.reduce((n, x) => n + x.count, 0)} pact slots · {pools.length} pools
          </span>
        }
      >
        Resources
      </Title>
      <p className={`-mt-4 mb-6 text-xs italic ${INK.faint}`}>Your class levels fill these in; any number you write replaces theirs. Spend them in Play.</p>

      <div className="space-y-8">
        <DefineSection title="Spell slots" storageKey="define.resources.slots">
          <SlotGrid rows={slotTable(ch, d, "slots")} onSet={(level, n) => now(setSlotOverride(ch, "slots", level, n))} hint="Back on a long rest." />
        </DefineSection>

        <DefineSection title="Pact slots" storageKey="define.resources.pact">
          <SlotGrid rows={slotTable(ch, d, "pact")} onSet={(level, n) => now(setSlotOverride(ch, "pact", level, n))} hint="Back on a short rest. Any level, up to 9 each." />
        </DefineSection>

        <DefineSection
          title="Pools"
          count={pools.length}
          storageKey="define.resources.pools"
          actions={(setOpen) => (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                addPool();
              }}
              className={addBtn}
            >
              + a pool of your own
            </button>
          )}
        >
          {pools.length === 0 ? (
            <Hint>No pools yet: Rage, Focus Points or Sorcery Points come with their classes, or add your own (Luck, Grit, a homebrew charge).</Hint>
          ) : (
            <div className="grid grid-cols-1 items-start gap-x-10 @5xl:grid-cols-2">
              {pools.map((p) => (
                <PoolRow
                  key={p.id}
                  pool={p}
                  open={openId === p.id}
                  onToggle={() => setOpenId(openId === p.id ? null : p.id)}
                  onPatch={(patch) => patchChar(patchPool(ch, p.id, patch))}
                  onRestore={() => now(restorePool(ch, p.id))}
                  onRemove={() => {
                    if (!window.confirm(p.own ? `Remove ${p.name}?` : `Hide ${p.name}? You can bring it back below.`)) return;
                    now(removePool(ch, p));
                    setOpenId(null);
                  }}
                />
              ))}
            </div>
          )}
          {hidden.length > 0 && (
            <p className={`mt-3 flex flex-wrap items-baseline gap-x-3 text-xs italic ${INK.faded}`}>
              hidden:
              {hidden.map((h) => (
                <InkButton key={h.id} onClick={() => now(restorePool(ch, h.id))} title="Bring it back">
                  {labelOf(h.id)}
                </InkButton>
              ))}
            </p>
          )}
        </DefineSection>
      </div>
    </ParchmentSheet>
  );
}
