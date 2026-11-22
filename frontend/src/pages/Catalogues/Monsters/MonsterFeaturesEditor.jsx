import React, { useState } from "react";
import { fieldCls, hintCls, addRowCls, removeRowCls, textareaCls } from "../catalogueStyle";
import { ActionEditor, Segmented } from "../catalogueParts";
import { numOrNull, describeFeature, valueFromText, textFromValue } from "../catalogueHelpers";
import { CATEGORY_OPTIONS, SECTIONS, SECTION_TITLES, emptyFeature, featureUsesWords } from "./monsterHelpers";

const USES_MODES = [
  { value: "", label: "always" },
  { value: "long", label: "per day" },
  { value: "short", label: "per short rest" },
  { value: "turn", label: "per turn" },
  { value: "recharge", label: "recharge" },
];

const usesFor = (mode, old) =>
  !mode ? undefined
  : mode === "recharge" ? { max: 1, reset: "recharge", recharge: old?.recharge ?? 5 }
  : { ...old, max: old?.reset === "recharge" ? 1 : old?.max ?? 1, reset: mode, recharge: undefined };

/* A statblock's traits and actions, grouped by section. Each feature folds
   open to edit its name, section, uses, its book text and its numbers
   (attack roll, saving throw, damage). Options of another feature (a
   beholder's eye rays) and abilities from a variant are labelled. */
export default function MonsterFeaturesEditor({ features, onChange, variants = [] }) {
  const [open, setOpen] = useState(null); // index of the feature being edited
  const list = features || [];
  const variantName = Object.fromEntries(variants.map((v) => [v.id, v.name]));
  const nameOf = Object.fromEntries(list.filter((f) => f.id).map((f) => [f.id, f.name]));

  const update = (i, f) => onChange(list.map((x, j) => (j === i ? f : x)));
  const patch = (i, key, v) => {
    const next = { ...list[i], [key]: v };
    if (v === undefined) delete next[key];
    update(i, next);
  };
  const remove = (i) => {
    onChange(list.filter((_, j) => j !== i));
    setOpen(null);
  };
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setOpen(open === i ? j : open);
  };
  const add = (category) => {
    onChange([...list, emptyFeature(category)]);
    setOpen(list.length);
  };

  return (
    <div className="space-y-4">
      {SECTIONS.map((section) => {
        const rows = list.map((f, i) => ({ f, i })).filter(({ f }) => (f.category || "traits") === section);
        if (!rows.length && !["traits", "actions"].includes(section)) return null;
        return (
          <div key={section}>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-rubric">{SECTION_TITLES[section]}</div>
            {rows.length === 0 && <p className={hintCls}>None.</p>}
            <div className="space-y-1">
              {rows.map(({ f, i }) => (
                <FeatureRow key={f.id || `new-${i}`} feature={f} open={open === i} onToggle={() => setOpen(open === i ? null : i)}
                            onPatch={(key, v) => patch(i, key, v)} onRemove={() => remove(i)} onMove={(dir) => move(i, dir)}
                            parentName={f.parent ? nameOf[f.parent] || f.parent : null}
                            variantName={f.variant ? variantName[f.variant] || f.variant : null} />
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <button type="button" onClick={() => add("traits")} className={addRowCls}>+ trait</button>
        <button type="button" onClick={() => add("actions")} className={addRowCls}>+ action</button>
        <button type="button" onClick={() => add("bonus_actions")} className={addRowCls}>+ bonus action</button>
        <button type="button" onClick={() => add("reactions")} className={addRowCls}>+ reaction</button>
        <button type="button" onClick={() => add("legendary_actions")} className={addRowCls}>+ legendary action</button>
      </div>
    </div>
  );
}

function FeatureRow({ feature: f, open, onToggle, onPatch, onRemove, onMove, parentName, variantName }) {
  const uses = featureUsesWords(f);
  const numbers = describeFeature({ ...f, category: "traits", uses: null }).join(" · ");
  const mode = f.uses?.reset || "";
  return (
    <div className={open ? "space-y-2 border-l border-rubric/40 pb-2 pl-3" : ""}>
      <div className="flex items-baseline gap-2">
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 truncate text-left text-sm hover:text-rubric">
          <span className={`mr-1.5 inline-block text-[9px] text-ink-faded transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
          <span className="font-semibold italic">{f.name || <span className="text-ink-faded">(no name)</span>}</span>
          {uses && <span className="ml-1 text-xs text-ink-faded">{uses}</span>}
          {numbers && <span className="ml-2 text-xs italic text-ink-faded">{numbers}</span>}
          {parentName && <span className="ml-2 text-xs italic text-ink-faint">option of {parentName}{f.roll ? ` (roll ${f.roll})` : ""}</span>}
          {variantName && <span className="ml-2 text-xs italic text-ink-faint">variant: {variantName}, off by default</span>}
        </button>
        <button type="button" onClick={() => onMove(-1)} className={removeRowCls} aria-label="Move up">▲</button>
        <button type="button" onClick={() => onMove(1)} className={removeRowCls} aria-label="Move down">▼</button>
        <button type="button" onClick={onRemove} className={removeRowCls} aria-label="Remove">✕</button>
      </div>
      {open && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <input type="text" value={f.name || ""} onChange={(e) => onPatch("name", e.target.value)} placeholder="name (e.g. Bite)"
                   className={`${fieldCls} min-w-[10rem] flex-1`} />
            <select value={f.category || "traits"} onChange={(e) => onPatch("category", e.target.value)} className={`${fieldCls} !w-44`}>
              {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-xs text-ink-faded">Uses</span>
            <Segmented size="sm" options={USES_MODES} value={mode} onChange={(m) => onPatch("uses", usesFor(m, f.uses))} />
            {mode && mode !== "recharge" && (
              <input type="text" value={textFromValue(f.uses?.max)} aria-label="How many"
                     onChange={(e) => onPatch("uses", { ...f.uses, max: valueFromText(e.target.value) })}
                     className={`${fieldCls} !w-12`} />
            )}
            {mode === "long" && (
              <label className="flex items-baseline gap-1.5">
                <span className="text-xs text-ink-faded">in its lair</span>
                <input type="number" min={1} value={f.uses?.max_in_lair ?? ""} placeholder="—" className={`${fieldCls} !w-12`}
                       onChange={(e) => onPatch("uses", { ...f.uses, max_in_lair: numOrNull(e.target.value) ?? undefined })} />
              </label>
            )}
            {mode === "recharge" && (
              <label className="flex items-baseline gap-1.5">
                <span className="text-xs text-ink-faded">on a</span>
                <select value={f.uses?.recharge ?? 6} onChange={(e) => onPatch("uses", { ...f.uses, recharge: Number(e.target.value) })}
                        className={`${fieldCls} !w-20`}>
                  {[6, 5, 4, 3, 2].map((n) => <option key={n} value={n}>{n === 6 ? "6" : `${n}–6`}</option>)}
                </select>
              </label>
            )}
            {f.category === "legendary_actions" && (
              <label className="flex items-baseline gap-1.5">
                <span className="text-xs text-ink-faded">costs</span>
                <select value={f.cost ?? 1} onChange={(e) => onPatch("cost", Number(e.target.value) > 1 ? Number(e.target.value) : undefined)}
                        className={`${fieldCls} !w-14`}>
                  {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="text-xs text-ink-faded">actions</span>
              </label>
            )}
          </div>
          <textarea value={f.text || ""} onChange={(e) => onPatch("text", e.target.value)} rows={4} className={textareaCls}
                    placeholder={f.category === "actions" ? "Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Piercing damage." : "What it does…"} />
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faded">
              Numbers the tracker and dice tower use
            </div>
            <ActionEditor value={f.action} onChange={(a) => onPatch("action", a && Object.keys(a).length ? a : undefined)} />
          </div>
        </>
      )}
    </div>
  );
}
