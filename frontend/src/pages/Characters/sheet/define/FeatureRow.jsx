import React from "react";
import { INK } from "../../../../styles/parchment";
import { Field, Segmented, Switch, TextBlock, dangerBtn, ghostBtn, inputCls } from "../../../../styles/parchmentForm";
import { DamageEditor, FeatureParts, RichText } from "../../../Catalogues/catalogueParts";
import { riderOf, riderWords, textFromValue, valueFromText } from "../../../Catalogues/catalogueHelpers";
import { actionTags, actionWords, partWords, regainWords } from "../../../../utils/featureRuntime";
import { CATEGORIES } from "../featureHelpers";

/* One feature on the Features or Feats tab: a ledger line with the
   numbers Play shows (worked out for this character), and an editor that
   opens under it. The editor changes the character's own copy, in the
   shared feature shape (data-model §2): numbers can be plain or formulas
   ("dex_mod + pb", "martial_arts"), the line shows them worked out.

   `row` comes from featureHelpers.featureRows. */


/* `onView` (optional): the name opens the feature's card and a small
   "edit" opens the editor (`onToggle`); without it the name opens the
   editor. `hideOwner`: leave out where it came from ("Wizard 1"), for a
   list that already says so. */
const TAG_INK = { hit: INK.rubric, save: "text-indigo-800", damage: "", heal: "text-emerald-800" };

export function FeatureLine({ row, open, onToggle, onActive, onView, onRemove, hideOwner = false }) {
  const f = row.feature;
  const riderTag = row.rider ? `+${row.rider.damage.map(partWords).filter(Boolean).join(" + ") || "damage"}${row.rider.conditions.length ? `, ${row.rider.conditions.join(", ")}` : ""}` : "";
  const words = [actionWords(row.action), riderTag ? `rider: ${riderTag} on ${row.rider.on === "saves" ? "saves" : row.rider.on === "both" ? "attacks and saves" : "attacks"}` : ""].filter(Boolean).join(" · ");
  const tags = [...actionTags(row.action).filter((t) => !(row.rider && row.action?.attack?.kind === "any")), ...(riderTag ? [{ tone: "damage", text: riderTag }] : [])];
  return (
    <div className={`group flex items-baseline gap-1.5 py-[3px] ${row.active ? "" : "opacity-60"}`}>
      <span className="self-center">
        <Switch checked={row.active} onChange={onActive} label={row.active ? "Shown in Play" : "Hidden in Play"} />
      </span>
      <button
        type="button"
        onClick={onView || onToggle}
        aria-expanded={onView ? undefined : open}
        title={onView ? "Open its card" : undefined}
        className={`min-w-[4rem] max-w-[60%] shrink-0 truncate text-left text-[15px] hover:underline hover:decoration-dotted hover:underline-offset-4 ${f.name ? "" : `italic ${INK.faint}`} ${open ? "underline decoration-dotted underline-offset-4" : ""}`}
      >
        {f.name || "unnamed"}
      </button>
      {f.edited && <span className={`shrink-0 text-[10px] italic ${INK.faint}`} title="You changed this copy">edited</span>}
      {f.own && <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`} title="You added this one">yours</span>}
      {!hideOwner && row.owner && <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`}>{row.owner}</span>}
      {row.linked && (
        <span className={`shrink-0 text-[10px] italic ${INK.faint}`} title="An attack made with this item: its numbers follow the item">
          ⇢ {row.linked.item?.name || "item gone"}
          {row.linked.item && !row.linked.item.equipped ? " (not equipped)" : ""}
        </span>
      )}
      <span aria-hidden="true" className="mx-1 min-w-[0.75rem] flex-1 translate-y-[-4px] border-b-2 border-dotted border-rule/35" />
      {onRemove && (
        <button type="button" onClick={onRemove} title="Delete it" aria-label={`Delete ${f.name || "this feature"}`} className={`shrink-0 px-0.5 text-xs leading-none ${INK.faint} hover:text-rubric`}>
          ✕
        </button>
      )}
      <span className="flex min-w-0 shrink items-baseline justify-end gap-x-2 overflow-hidden whitespace-nowrap text-xs" title={words || undefined}>
        {row.isToggle && <span className={row.on ? INK.rubric : INK.faded}>{row.on ? "on" : "toggle"}</span>}
        {tags.map((t, i) => (
          <span key={i} className={`truncate ${TAG_INK[t.tone] || ""}`}>
            {t.text}
          </span>
        ))}
        {row.uses && (
          <span className={`italic ${INK.faded}`}>
            {row.uses.max}/{f.uses?.reset === "short" ? "short" : "long"}
          </span>
        )}
        {row.consumes && <span className={`italic ${INK.faded}`}>{row.consumes.amount} {row.consumes.name}</span>}
      </span>
      {onView && (
        <button type="button" onClick={onToggle} aria-expanded={open} className={`shrink-0 text-xs italic ${open ? INK.rubric : INK.faded} hover:text-ink`} title="Change your copy">
          edit
        </button>
      )}
    </div>
  );
}

/* An attack exported from the Inventory (`link.item`): to hit and damage
   come from the item; this adds what comes on top (Booming Blade, a
   Smite, a bonus to hit). */
function LinkedAttackEditor({ row, onPatch }) {
  const f = row.feature;
  const atk = f.action?.attack || { kind: row.linked.item?.weapon?.kind || "melee", damage: [] };
  const setAttack = (p) => onPatch({ action: { ...(f.action || {}), attack: { ...atk, ...p } } });
  const a = row.linked.attack;
  return (
    <div className="space-y-2 text-sm">
      {a ? (
        <p className={`italic ${INK.faded}`}>
          From the item: {a.hit >= 0 ? "+" : ""}
          {a.hit} to hit · {actionWords({ damage: a.damage })}
          {a.twoHanded ? " (two-handed)" : ""} · {a.range}. Change the item and this follows.
        </p>
      ) : (
        <p className={`italic ${INK.rubric}`}>{row.linked.item ? "The item has no weapon numbers." : "The item is gone from your inventory."}</p>
      )}
      <span className="flex flex-wrap items-baseline gap-2">
        <span className="text-xs text-ink-faded">Extra to hit +</span>
        <input
          type="text"
          value={textFromValue(atk.bonus)}
          onChange={(e) => setAttack({ bonus: valueFromText(e.target.value) })}
          placeholder="0"
          aria-label="Extra to hit"
          className={`${inputCls} !w-24`}
        />
      </span>
      <DamageEditor parts={atk.damage} onChange={(damage) => setAttack({ damage })} label="Extra damage on a hit" />
    </div>
  );
}

/* `pools`: the character's pools (featureHelpers.resourceRows), to pick
   one this feature spends from. `onTurnIntoPool`: make its own uses a
   pool (Resources tab), so other features can share them. */
/* pb: the character's proficiency bonus (shown as PB(3) in the attack and
   save windows). */
export function FeatureEditor({ row, pools = [], pb = null, onPatch, onRemove, onDone, onTurnIntoPool, onRestore }) {
  const f = row.feature;
  // The parts write `undefined` for "take it off"; the sheet keeps null.
  const patch = (p) => onPatch(Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v === undefined ? null : v])));
  const usesExtra = (row.uses || (f.uses && onTurnIntoPool) || row.consumes?.missing) && (
    <div className="flex flex-wrap items-baseline gap-x-4 text-xs italic text-ink-faded">
      {row.uses && <span>for this character: {row.uses.max} per {row.uses.reset === "short" ? "short" : "long"} rest</span>}
      {row.consumes?.missing && (
        <span className={INK.rubric}>{row.consumes.unpicked ? "pick the pool it spends from" : "no such pool: add it in Resources"}</span>
      )}
      {f.uses && onTurnIntoPool && (
        <button type="button" onClick={onTurnIntoPool} className={`not-italic ${ghostBtn}`} title="Make these uses a pool in Resources, so other features can spend them too">
          turn into a pool
        </button>
      )}
    </div>
  );
  return (
    <div className="@container mb-4 ml-[26px] mt-2 space-y-4 border-l-2 border-rubric/40 pl-4">
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field label="Name">
          <input type="text" value={f.name ?? ""} autoFocus={!f.name} onChange={(e) => onPatch({ name: e.target.value })} placeholder="e.g. Second Wind" className={`${inputCls} text-[17px]`} />
        </Field>
        <Field label="Used as">
          <Segmented size="sm" options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} value={row.category} onChange={(category) =>
                       onPatch(category === "riders" && !riderOf(f) ? { category, rider: { damage: [{ dice: "1d6", type: "" }], on: "attacks" } } : { category })} />
        </Field>
      </div>

      <FeatureParts
        f={f}
        onPatch={patch}
        pools={pools.map((p) => ({ id: p.id, name: p.name }))}
        actionMode="auto"
        pb={pb}
        traitGrants={false}
        usesExtra={usesExtra}
        itemCharges={row.itemCharges}
        action={row.linked ? { words: `made with your ${row.linked.item?.name || "item"}: its numbers follow the item`, editor: <LinkedAttackEditor row={row} onPatch={onPatch} /> } : null}
      />

      <Field label="Text">
        {row.kind === "manual" || f.own || f.edited_text ? (
          <TextBlock value={typeof f.text === "string" ? f.text : ""} onChange={(e) => onPatch({ text: e.target.value, edited_text: row.kind !== "manual" && !f.own })} placeholder="What it does, in words" minRows={3} />
        ) : f.text ? (
          <div>
            <RichText text={f.text} className="text-[14px]" />
            <button type="button" onClick={() => onPatch({ edited_text: true })} className={`mt-1 ${ghostBtn}`}>
              edit the text
            </button>
          </div>
        ) : (
          <TextBlock value="" onChange={(e) => onPatch({ text: e.target.value, edited_text: true })} placeholder="What it does, in words" minRows={2} />
        )}
      </Field>


      <div className="flex flex-wrap items-baseline gap-x-5">
        <button type="button" onClick={onDone} className={ghostBtn}>
          done
        </button>
        {onRestore && f.edited && f.book && (
          <button type="button" onClick={onRestore} className={ghostBtn} title="Undo every change you made to this feature">
            back to the book's
          </button>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} className={`ml-auto ${dangerBtn}`}>
            remove
          </button>
        )}
      </div>
    </div>
  );
}
