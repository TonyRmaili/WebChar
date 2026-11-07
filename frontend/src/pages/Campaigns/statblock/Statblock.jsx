import React, { useState } from "react";
import { Bubble, INK, InkButton, InkNumber, InkRemove, InkSelect, InkText, InkTextArea, Mark } from "../../../styles/parchment";
import { Chevron, Switch, addBtn } from "../../../styles/parchmentForm";
import CataloguePicker from "./CataloguePicker";

/* ═══════════════════════════════════════════════════════════════════
   Statblock — draws one creature on parchment, the way a printed stat
   block reads: vitals, ability scores, bold-labelled lines, then what it
   can do, its spells and its gear.

   It only knows the "view" and the adapter's EDITS / ACTIONS (see
   characterStatblock.js and monsterStatblock.js), never the raw JSON
   layout. The adapter also brings its own RowEditor (what opens under a
   trait or action while editing) and the catalogue kinds you can add.

   Two kinds of change:
     onUse(next)     spending or regaining a use (the dots). Works while
                     reading — the card saves it straight away.
     onChange(next)  everything else, only while editing (goes into the
                     card's draft, saved with "save").
   ═══════════════════════════════════════════════════════════════════ */

/* The red rule under a statblock header, fading out to the right. */
export const RubricRule = ({ className = "" }) => (
  <div aria-hidden="true" className={`my-4 h-[2px] bg-gradient-to-r from-[#9a3412] via-[#9a3412]/50 to-transparent ${className}`} />
);

function Heading({ children, right }) {
  return (
    <div className="mb-2 flex items-baseline gap-3 border-b border-[#9a3412]/40 pb-0.5">
      <h4 className={`text-lg ${INK.rubric}`}>{children}</h4>
      {right && <div className="ml-auto flex flex-wrap items-baseline gap-x-4">{right}</div>}
    </div>
  );
}

// "Label  text" as one hanging sentence, like "Senses darkvision 60 ft".
// The hanging indent is for the paragraph only: buttons inside inherit
// text-indent and would shift out of their own boxes, so it's reset there.
function Labelled({ label, children }) {
  return (
    <p className="pl-4 -indent-4 text-[15px] leading-relaxed [&_*]:indent-0">
      <span className="font-semibold">{label}</span> {children}
    </p>
  );
}

/* Uses as small dots, like spell slots on the sheet: click a filled dot
   to spend one, an empty one to get one back. Long tracks (more than 10)
   become "7 / 20" with − and +. */
export function Pips({ cur, max, onSet, label, title }) {
  if (!max) return null;
  if (max > 10) {
    const btn = `w-4 leading-none ${INK.faded} hover:text-[#3a2716] disabled:opacity-30`;
    return (
      <span className="inline-flex items-baseline gap-1 text-sm tabular-nums" title={title}>
        <button type="button" className={btn} onClick={() => onSet(cur - 1)} disabled={cur <= 0} aria-label={`Spend one ${label}`}>
          −
        </button>
        <span className={INK.rubric}>{cur}</span>
        <span className={INK.faint}>/ {max}</span>
        <button type="button" className={btn} onClick={() => onSet(cur + 1)} disabled={cur >= max} aria-label={`Regain one ${label}`}>
          +
        </button>
      </span>
    );
  }
  return (
    <span className="inline-flex translate-y-[1px] items-center gap-[3px]" title={title} role="group" aria-label={`${label}: ${cur} of ${max} left`}>
      {Array.from({ length: max }, (_, i) => {
        const full = i < cur;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSet(full ? cur - 1 : cur + 1)}
            aria-label={full ? `Spend one ${label}` : `Regain one ${label}`}
            className={`h-[11px] w-[11px] rounded-full border-[1.5px] border-[#9a3412] transition hover:scale-125 ${full ? "bg-[#9a3412]" : "bg-transparent"}`}
          />
        );
      })}
    </span>
  );
}

// A catalogue name you can click to read its card.
function CatalogueName({ entry, onView, className = "" }) {
  if (!entry.catalogue) return <span className={className}>{entry.name}</span>;
  return (
    <button type="button" onClick={() => onView(entry.catalogue.type, entry.catalogue)} className={`text-left hover:underline hover:decoration-dotted hover:underline-offset-4 ${className}`} title="Read its card">
      {entry.name}
    </button>
  );
}

/* ─── folds ──────────────────────────────────────────────────────────
   A block that can be folded away to its heading (the vitals and ability
   scores, the saves/skills/senses lines). Remembered across cards and
   visits; if the browser's storage isn't available it just starts open. */

function useStoredOpen(key, initial = true) {
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v == null ? initial : v === "1";
    } catch {
      return initial;
    }
  });
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(key, o ? "0" : "1");
      } catch {
        /* storage unavailable — fine, just not remembered */
      }
      return !o;
    });
  return [open, toggle];
}

// One line shown when the vitals are folded: "AC 18 · HP 31 of 52 · 30 ft · init +3"
const SHORT = { ac: "AC", hp: "HP", speed: "", initiative: "init" };
const foldSummary = (view) =>
  view.vitals
    .filter((v) => v.key in SHORT)
    .map((v) => [SHORT[v.key], v.value, v.key === "hp" && v.sub ? v.sub.split(" · ")[0] : ""].filter(Boolean).join(" "))
    .join(" · ");

function Fold({ id, title, summary, children }) {
  const [open, toggle] = useStoredOpen(`statblock.fold.${id}`);
  return (
    <div>
      <button type="button" onClick={toggle} aria-expanded={open} className="group mb-2 flex w-full items-center gap-2 text-left">
        <Chevron open={open} />
        <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-[0.25em] ${INK.faded} group-hover:text-[#3a2716]`}>{title}</span>
        {!open && summary && <span className={`truncate text-sm italic ${INK.faded}`}>{summary}</span>}
        <span className="h-px min-w-[1rem] flex-1 bg-[#7b6346]/25" />
      </button>
      {open && children}
    </div>
  );
}

/* ─── vitals ─────────────────────────────────────────────────────── */

function Vital({ label, value, sub, children }) {
  return (
    <div className="min-w-0">
      <div className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${INK.faded}`}>{label}</div>
      {children ?? <div className="text-3xl leading-tight tabular-nums">{value}</div>}
      {sub && <div className={`truncate text-xs italic ${INK.faded}`}>{sub}</div>}
    </div>
  );
}

// While editing, a vital shows the blanks its view entry asks for:
//   { edit, label, min, max, step, size }   a number (EDITS[edit])
//   { select, label, options }              a list to pick from
//   { mark, label }                         an on/off diamond
//   { text }                                a word in between ("of", "ft")
const SIZE = { lg: "h-8 w-14 text-2xl", md: "h-8 w-12 text-xl", sm: "h-6 w-10 text-sm" };

function Blanks({ parts, raw, edits, set }) {
  return parts.map((p, i) => {
    if (p.text) {
      return (
        <span key={i} className={`text-sm italic ${INK.faded}`}>
          {p.text}
        </span>
      );
    }
    if (p.select) {
      return (
        <InkSelect key={i} value={edits[p.select].get(raw)} onChange={(e) => set(edits[p.select].set(raw, e.target.value))} aria-label={p.label} className="h-8 text-2xl">
          {p.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </InkSelect>
      );
    }
    if (p.mark) {
      const on = edits[p.mark].get(raw);
      return (
        <span key={i} className={`flex items-center gap-1 text-xs italic ${on ? INK.rubric : INK.faded}`}>
          <Mark on={on} onClick={() => set(edits[p.mark].set(raw, !on))} label={p.label} />
          {p.label}
        </span>
      );
    }
    return (
      <InkNumber
        key={i}
        value={edits[p.edit].get(raw)}
        onChange={(v) => set(edits[p.edit].set(raw, v))}
        min={p.min}
        max={p.max}
        step={p.step}
        fallback={p.fallback ?? 0}
        aria-label={p.label}
        className={SIZE[p.size || "lg"]}
      />
    );
  });
}

function Vitals({ view, raw, editing, edits, set }) {
  return (
    <div className="grid grid-cols-3 gap-x-6 gap-y-4 @3xl:grid-cols-6">
      {view.vitals.map((v) =>
        !editing ? (
          <Vital key={v.key} label={v.label} value={v.value} sub={v.sub} />
        ) : !v.inputs ? (
          <Vital key={v.key} label={v.label} value={v.value} sub={v.editSub ?? v.sub} />
        ) : (
          <Vital key={v.key} label={v.label} sub={v.editSub}>
            <span className="flex items-baseline gap-1.5">
              <Blanks parts={v.inputs} raw={raw} edits={edits} set={set} />
            </span>
            {v.extra && (
              <span className="flex items-baseline gap-1.5">
                <Blanks parts={v.extra} raw={raw} edits={edits} set={set} />
              </span>
            )}
          </Vital>
        )
      )}
    </div>
  );
}

/* ─── ability scores ─────────────────────────────────────────────── */

function Abilities({ view, raw, editing, edits, set }) {
  return (
    <div className="grid grid-cols-3 gap-x-4 gap-y-5 text-center @2xl:grid-cols-6">
      {view.abilities.map((a) => (
        <div key={a.key}>
          <div className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${INK.faded}`}>{a.short}</div>
          {editing ? (
            <div className="flex justify-center">
              <InkNumber value={edits.score.get(raw, a.key)} onChange={(v) => set(edits.score.set(raw, a.key, v))} min={1} max={30} aria-label={`${a.short} score`} className="h-10 w-14 text-3xl" />
            </div>
          ) : (
            <div className="text-3xl leading-tight tabular-nums">{a.score ?? "—"}</div>
          )}
          <div className="text-sm tabular-nums">{a.mod}</div>
          <div className={`mt-0.5 flex items-center justify-center gap-1 text-xs italic ${a.saveProf ? INK.rubric : INK.faded}`}>
            {editing ? (
              <Mark on={a.saveProf} onClick={() => set(edits.saveProf.set(raw, a.key, !a.saveProf))} label={`${a.short} save proficiency`} />
            ) : (
              a.saveProf && <span aria-hidden="true">◆</span>
            )}
            save {a.save}
          </div>
        </div>
      ))}
    </div>
  );
}

// Characters: a proficiency dot per skill (the total is worked out).
// Monsters: the bonus itself; a blank keeps the skill off the statblock.
function SkillGrid({ view, raw, edits, set }) {
  const byBonus = view.skillMode === "bonus";
  return (
    <div>
      <div className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${INK.faded}`}>
        {byBonus ? "Skills — write a bonus to show it, leave blank to hide it" : "Skills — click the dot: none, proficient, expertise"}
      </div>
      <div className="grid grid-cols-1 gap-x-8 @xl:grid-cols-2 @4xl:grid-cols-3">
        {view.skills.map((s) => (
          <div key={s.key} className="flex items-center gap-2 py-0.5 text-[15px]">
            {!byBonus && <Bubble level={s.level} onClick={() => set(edits.skillProf.cycle(raw, s.key))} label={s.label} />}
            <span className={(byBonus ? s.bonus != null : s.level !== "none") ? "" : INK.faded}>{s.label}</span>
            <span className={`text-[10px] uppercase tracking-wider ${INK.faint}`}>{s.ability}</span>
            {byBonus ? (
              <InkNumber value={s.bonus} onChange={(v) => set(edits.skillBonus.set(raw, s.key, v))} min={-10} max={30} placeholder="—" aria-label={`${s.label} bonus`} className="ml-auto h-6 w-10 text-sm" />
            ) : (
              <span className="ml-auto tabular-nums">{s.total}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── lines you can change (monsters) ────────────────────────────────
   A line's `editor` says how:
     { type: "chips", edit, arg, options }   words picked from a list
     { type: "fields", fields: [...] }       small blanks: number, text,
                                             select or an on/off mark */

function ChipEditor({ editor, raw, edits, set }) {
  const [adding, setAdding] = useState(false);
  const chosen = edits[editor.edit].get(raw, editor.arg);
  const has = (o) => chosen.some((c) => String(c).toLowerCase() === String(o).toLowerCase());
  const shown = (w) => (editor.keepCase ? w : String(w).replace(/^./, (c) => c.toUpperCase()));
  const save = (next) => set(edits[editor.edit].set(raw, editor.arg, next));
  const rest = editor.options.filter((o) => !has(o));
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {chosen.map((c) => (
        <span key={c} className="inline-flex items-baseline">
          {shown(c)}
          <InkRemove onClick={() => save(chosen.filter((x) => x !== c))} label={`Remove ${c}`} />
        </span>
      ))}
      {!chosen.length && <span className={`italic ${INK.faint}`}>none</span>}
      {rest.length > 0 && (
        <button type="button" onClick={() => setAdding((a) => !a)} className={addBtn}>
          {adding ? "done" : "+ add"}
        </button>
      )}
      {adding && (
        <span className="flex w-full flex-wrap gap-x-3 gap-y-0.5 pt-0.5">
          {rest.map((o) => (
            <button key={o} type="button" onClick={() => save([...chosen, o])} className={`text-sm italic ${INK.faded} hover:text-[#3a2716]`}>
              {shown(o)}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function FieldsEditor({ editor, raw, edits, set }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-5 gap-y-1">
      {editor.fields.map((f) => {
        const e = edits[f.edit];
        const get = () => (f.arg != null ? e.get(raw, f.arg) : e.get(raw));
        const put = (v) => set(f.arg != null ? e.set(raw, f.arg, v) : e.set(raw, v));
        const key = `${f.edit}:${f.arg ?? ""}`;
        if (f.kind === "mark") {
          return (
            <span key={key} className={`inline-flex items-center gap-1 text-sm italic ${get() ? INK.rubric : INK.faded}`}>
              <Mark on={get()} onClick={() => put(!get())} label={f.label} />
              {f.label}
            </span>
          );
        }
        return (
          <span key={key} className="inline-flex items-baseline gap-1.5">
            <span className={`text-sm italic ${INK.faded}`}>{f.label}</span>
            {f.kind === "number" ? (
              <InkNumber value={get()} onChange={put} min={0} step={f.step} placeholder="—" aria-label={f.label} className="h-6 w-12 text-sm" />
            ) : f.kind === "select" ? (
              <InkSelect value={get()} onChange={(ev) => put(ev.target.value)} aria-label={f.label} className="h-6 text-sm">
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </InkSelect>
            ) : (
              <InkText value={get()} onChange={(ev) => put(ev.target.value)} placeholder={f.placeholder} aria-label={f.label} className={`h-6 text-sm ${f.wide ? "w-40" : "w-28"}`} />
            )}
            {f.suffix && <span className={`text-xs ${INK.faint}`}>{f.suffix}</span>}
          </span>
        );
      })}
    </span>
  );
}

function LineEditor({ line, raw, edits, set }) {
  const Editor = line.editor.type === "chips" ? ChipEditor : FieldsEditor;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 py-0.5 text-[15px]">
      <span className="font-semibold">{line.label}</span>
      <Editor editor={line.editor} raw={raw} edits={edits} set={set} />
    </div>
  );
}

/* ─── traits, actions… ───────────────────────────────────────────── */

// Reading: "◆ Longsword. Melee · +7 to hit · 1d8+3 slashing.  ●●○   ▸"
// The diamond hides the row from the statblock (it comes back in edit);
// the arrow on the right opens or closes this entry's text.
function EntryLine({ entry, textOpen, onToggleText, onUses, onHide, onView }) {
  return (
    <div className="mb-1.5 break-inside-avoid text-[15px] leading-relaxed">
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 self-start pt-[5px]">
          <Switch checked onChange={onHide} label={`Hide ${entry.name} from the statblock (bring it back in edit)`} />
        </span>
        <p className="min-w-0 flex-1">
          <CatalogueName entry={entry} onView={onView} className="font-semibold italic" />
          <span className="font-semibold italic">.</span>{" "}
          {entry.roll && <span className="italic">{entry.roll}.</span>}{" "}
          {entry.uses && (
            <span className="whitespace-nowrap">
              <Pips cur={entry.uses.cur} max={entry.uses.max} onSet={onUses} label={`use of ${entry.name}`} title={entry.regain} />
            </span>
          )}
        </p>
        {entry.text && (
          <button
            type="button"
            onClick={onToggleText}
            aria-expanded={textOpen}
            aria-label={`${textOpen ? "Hide" : "Show"} the text of ${entry.name}`}
            title={textOpen ? "Hide its text" : "Show its text"}
            className={`shrink-0 self-start pt-[3px] transition ${textOpen ? INK.rubric : INK.faint} hover:text-[#3a2716]`}
          >
            <Chevron open={textOpen} />
          </button>
        )}
      </div>
      {textOpen && entry.text && <p className={`whitespace-pre-line pl-[26px] text-sm ${INK.faded}`}>{entry.text}</p>}
    </div>
  );
}

// Editing: the same line with an on/off diamond and ✕; the name opens the
// adapter's editor underneath, which closes again with "done".
function EntryEditable({ entry, row, open, onToggle, onUses, onReplace, onRemove, onMove, onView, RowEditor }) {
  const patch = (p) => onReplace({ ...row, ...p });
  return (
    <div className={`text-[15px] ${entry.inactive ? "opacity-60" : ""}`}>
      <div className="flex items-baseline gap-2 py-[3px]">
        <span className="self-center">
          <Switch checked={!entry.inactive} onChange={(v) => patch({ active: v })} label={entry.inactive ? "Hidden — not on the statblock" : "Shown on the statblock"} />
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={`truncate text-left font-semibold italic hover:underline hover:decoration-dotted hover:underline-offset-4 ${open ? "underline decoration-dotted underline-offset-4" : ""}`}
        >
          {entry.name}
        </button>
        {entry.tag && <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`}>{entry.tag}</span>}
        <span aria-hidden="true" className="mx-1 min-w-[0.75rem] flex-1 translate-y-[-4px] border-b-2 border-dotted border-[#7b6346]/35" />
        {entry.roll && <span className={`shrink-0 text-xs italic ${INK.faded}`}>{entry.roll}</span>}
        {entry.uses && <Pips cur={entry.uses.cur} max={entry.uses.max} onSet={onUses} label={`use of ${entry.name}`} title={entry.regain} />}
        <InkRemove onClick={onRemove} label={`Remove ${entry.name}`} />
      </div>
      {open && <RowEditor entry={entry} row={row} onPatch={patch} onReplace={onReplace} onRemove={onRemove} onMove={onMove} onDone={onToggle} onView={onView} />}
    </div>
  );
}

// A pool shared by the whole section (legendary actions): dots while
// reading, how many while editing.
function PoolHeading({ pool, raw, editing, edits, actions, set, use }) {
  if (editing) {
    return (
      <span className={`flex items-baseline gap-1.5 text-xs italic ${INK.faded}`}>
        <InkNumber value={edits[pool.edit].get(raw)} onChange={(v) => set(edits[pool.edit].set(raw, v))} min={0} max={10} fallback={0} aria-label={`${pool.label}s per round`} className="h-6 w-8 text-sm" />
        per round
      </span>
    );
  }
  return pool.max > 0 ? <Pips cur={pool.cur} max={pool.max} onSet={(cur) => use(actions.setUses(raw, pool.ref, cur))} label={pool.label} title={`${pool.max} per round, back at the start of its turn`} /> : null;
}

function Sections({ view, raw, editing, edits, actions, set, use, onView, openRef, setOpenRef, RowEditor }) {
  const [textOpen, setTextOpen] = useState({}); // "list:id" → its text is shown
  const isOpen = (ref) => openRef && openRef.list === ref.list && openRef.id === ref.id;
  const keyOf = (e) => `${e.ref.list}:${e.ref.id}`;

  return view.sections.map((s) => {
    const withText = s.entries.filter((e) => e.text);
    const allOpen = withText.length > 0 && withText.every((e) => textOpen[keyOf(e)]);
    // "show all" / "hide all" for the section; each entry still has its own arrow.
    const setAll = (open) => setTextOpen((m) => ({ ...m, ...Object.fromEntries(withText.map((e) => [keyOf(e), open])) }));
    return (
    <div key={s.key} className="mb-3">
      <div className="break-inside-avoid">
        <Heading
          right={
            <>
              {s.pool && <PoolHeading pool={s.pool} raw={raw} editing={editing} edits={edits} actions={actions} set={set} use={use} />}
              {!editing && withText.length > 0 && <InkButton onClick={() => setAll(!allOpen)}>{allOpen ? "hide all text" : "show all text"}</InkButton>}
            </>
          }
        >
          {s.title}
        </Heading>
      </div>
      {s.entries.map((e) =>
        editing ? (
          <EntryEditable
            key={`${e.ref.list}:${e.ref.id}`}
            entry={e}
            row={actions.row(raw, e.ref)}
            open={isOpen(e.ref)}
            onToggle={() => setOpenRef(isOpen(e.ref) ? null : e.ref)}
            onUses={(cur) => set(actions.setUses(raw, e.ref, cur))}
            onReplace={(next) => set(actions.replace(raw, e.ref, next))}
            onRemove={() => {
              if (!window.confirm(`Remove ${e.name}?`)) return;
              set(actions.remove(raw, e.ref));
              if (isOpen(e.ref)) setOpenRef(null);
            }}
            onMove={(to) => {
              if (!actions.move) return;
              const res = actions.move(raw, e.ref, to);
              set(res.raw);
              setOpenRef(res.ref);
            }}
            onView={onView}
            RowEditor={RowEditor}
          />
        ) : (
          <EntryLine
            key={keyOf(e)}
            entry={e}
            textOpen={!!textOpen[keyOf(e)]}
            onToggleText={() => setTextOpen((m) => ({ ...m, [keyOf(e)]: !m[keyOf(e)] }))}
            onUses={(cur) => use(actions.setUses(raw, e.ref, cur))}
            onHide={() => use(actions.replace(raw, e.ref, { ...actions.row(raw, e.ref), active: false }))}
            onView={onView}
          />
        )
      )}
    </div>
    );
  });
}

/* ─── spells ─────────────────────────────────────────────────────── */

// Characters: slots, sorcery points and spells by level.
function LevelSpellcasting({ sc, raw, editing, actions, set, use, onView }) {
  const uses = editing ? set : use;
  const addLevel = (list) => set(actions.addSlotLevel(raw, list).raw);
  return (
    <div className="mb-3">
      <div className="break-inside-avoid">
        <Heading
          right={
            editing && (
              <>
                <button type="button" className={addBtn} onClick={() => addLevel("spellslots")}>
                  + slot level
                </button>
                <button type="button" className={addBtn} onClick={() => addLevel("pactslots")}>
                  + pact slots
                </button>
              </>
            )
          }
        >
          Spellcasting
        </Heading>
        <p className="text-[15px] italic">{sc.line}</p>
      </div>

      {(sc.slots.some((slot) => editing || slot.max > 0) || sc.sorcery) && (
        <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5">
          {sc.slots.filter((slot) => editing || slot.max > 0).map((slot) => (
            <span key={`${slot.ref.list}:${slot.ref.id}`} className="flex items-center gap-1.5 text-sm">
              <span className={INK.faded}>{slot.label}</span>
              {editing && (
                <InkNumber value={slot.max} onChange={(v) => set(actions.setSlotMax(raw, slot.ref, v))} min={0} max={9} fallback={0} aria-label={`${slot.label} slots`} className="h-6 w-8 text-sm" />
              )}
              <Pips cur={slot.cur} max={slot.max} onSet={(cur) => uses(actions.setUses(raw, slot.ref, cur))} label={`${slot.label} slot`} />
              {editing && <InkRemove onClick={() => set(actions.remove(raw, slot.ref))} label={`Remove ${slot.label} slots`} />}
            </span>
          ))}
          {sc.sorcery && (
            <span className="flex items-center gap-1.5 text-sm">
              <span className={INK.faded}>sorcery points</span>
              <Pips cur={sc.sorcery.cur} max={sc.sorcery.max} onSet={(cur) => uses(actions.setUses(raw, { list: "sorcery" }, cur))} label="sorcery point" />
            </span>
          )}
        </div>
      )}

      <div className="mt-2 space-y-1">
        {sc.lists.map((l) => (
          <Labelled key={l.label} label={`${l.label}:`}>
            {l.spells.map((sp, i) => (
              <span key={sp.ref.id} className="inline-flex items-baseline gap-1">
                <CatalogueName entry={sp} onView={onView} className="italic" />
                {sp.uses && <Pips cur={sp.uses.cur} max={sp.uses.max} onSet={(cur) => uses(actions.setUses(raw, sp.ref, cur))} label={`use of ${sp.name}`} title="innate — its own uses" />}
                {editing && <InkRemove onClick={() => set(actions.remove(raw, sp.ref))} label={`Remove ${sp.name}`} />}
                {i < l.spells.length - 1 && <span className={INK.faint}>,&nbsp;</span>}
              </span>
            ))}
          </Labelled>
        ))}
        {editing && sc.lists.length === 0 && <p className={`text-sm italic ${INK.faint}`}>No spells yet — add some above.</p>}
      </div>
    </div>
  );
}

// Monsters: one or more spellcasting blocks, each with lists like
// "At will", "3/day each" or "2/day" (uses shared by the list).
function GroupSpellcasting({ sc, raw, editing, actions, set, use, onView }) {
  const [picking, setPicking] = useState(null); // group ref the spell picker adds to
  const uses = editing ? set : use;
  const patchBlock = (b, p) => set(actions.replace(raw, b.ref, { ...actions.row(raw, b.ref), ...p }));
  const patchGroup = (g, p) => set(actions.replace(raw, g.ref, { ...actions.row(raw, g.ref), ...p }));
  const many = sc.blocks.length > 1;

  return (
    <div className="mb-3">
      <div className="break-inside-avoid">
        <Heading
          right={
            editing && (
              <button type="button" className={addBtn} onClick={() => set(actions.addSpellBlock(raw))}>
                + spellcasting
              </button>
            )
          }
        >
          Spellcasting
        </Heading>
      </div>

      {sc.blocks.map((b) => (
        <div key={b.ref.id} className="mb-2">
          {editing ? (
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              <InkText value={actions.row(raw, b.ref)?.name ?? ""} onChange={(e) => patchBlock(b, { name: e.target.value })} aria-label="Spellcasting name" className="h-6 w-40 text-[15px] font-semibold italic" />
              <InkSelect value={b.ability} onChange={(e) => patchBlock(b, { ability: e.target.value })} aria-label="Spellcasting ability" className="h-6 text-sm">
                {sc.abilityOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </InkSelect>
              <span className={`flex items-baseline gap-1 italic ${INK.faded}`}>
                save DC
                <InkNumber value={b.saveDc} onChange={(v) => patchBlock(b, { save_dc: v })} min={0} max={40} placeholder="—" aria-label="Spell save DC" className="h-6 w-10 text-sm" />
              </span>
              <span className={`flex items-baseline gap-1 italic ${INK.faded}`}>
                to hit +
                <InkNumber value={b.attack} onChange={(v) => patchBlock(b, { spell_attack_bonus: v })} min={-5} max={30} placeholder="—" aria-label="Spell attack bonus" className="h-6 w-10 text-sm" />
              </span>
              <InkRemove
                onClick={() => window.confirm(`Remove ${b.title} and all its spells?`) && set(actions.remove(raw, b.ref))}
                label={`Remove ${b.title}`}
              />
            </div>
          ) : (
            <p className="text-[15px] italic">
              {many && <span className="font-semibold">{b.title}. </span>}
              {b.line}
            </p>
          )}
          {editing ? (
            <InkTextArea value={actions.row(raw, b.ref)?.notes ?? ""} onChange={(e) => patchBlock(b, { notes: e.target.value })} rows={1} placeholder="It casts one of the following spells, needing no material components…" aria-label="Spellcasting text" />
          ) : (
            b.notes && <p className={`text-sm ${INK.faded}`}>{b.notes}</p>
          )}

          <div className="mt-1 space-y-1">
            {b.groups.map((g) =>
              editing ? (
                <div key={g.ref.id} className="text-[15px]">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <InkText value={g.rawLabel} onChange={(e) => patchGroup(g, { label: e.target.value })} placeholder={g.label} aria-label="List name" className="h-6 w-28 text-sm font-semibold" />
                    <span className={`flex items-baseline gap-1 text-xs italic ${INK.faded}`}>
                      <InkNumber value={g.max} onChange={(v) => set(actions.setGroupUses(raw, g.ref, v))} min={0} max={9} placeholder="∞" aria-label="Uses per day" className="h-6 w-8 text-sm" />
                      /day
                    </span>
                    {g.max > 0 && (
                      <span className={`flex items-center gap-1 text-xs italic ${g.each ? INK.rubric : INK.faded}`}>
                        <Mark on={g.each} onClick={() => patchGroup(g, { each: !g.each })} label="each spell has its own uses" />
                        each
                      </span>
                    )}
                    <button type="button" className={addBtn} onClick={() => setPicking((p) => (p?.id === g.ref.id ? null : g.ref))}>
                      + spell
                    </button>
                    <InkRemove onClick={() => set(actions.remove(raw, g.ref))} label={`Remove the ${g.label} list`} />
                  </div>
                  <p className="pl-4 text-[15px]">
                    {g.spells.length ? (
                      g.spells.map((sp, i) => (
                        <span key={sp.ref.id} className="inline-flex items-baseline">
                          <CatalogueName entry={sp} onView={onView} className="italic" />
                          <InkRemove onClick={() => set(actions.remove(raw, sp.ref))} label={`Remove ${sp.name}`} />
                          {i < g.spells.length - 1 && <span className={INK.faint}>,&nbsp;</span>}
                        </span>
                      ))
                    ) : (
                      <span className={`text-sm italic ${INK.faint}`}>no spells yet</span>
                    )}
                  </p>
                  {picking?.id === g.ref.id && (
                    <div className="mt-2">
                      <CataloguePicker
                        kind="spell"
                        has={(entry) => actions.hasSpell(raw, g.ref, entry)}
                        onAdd={(entry) => set(actions.addSpell(raw, g.ref, entry))}
                        onView={onView}
                        onClose={() => setPicking(null)}
                      />
                    </div>
                  )}
                </div>
              ) : (
                g.spells.length > 0 && (
                  <Labelled key={g.ref.id} label={`${g.label}:`}>
                    {g.uses && (
                      <span className="mr-1.5 whitespace-nowrap">
                        <Pips cur={g.uses.cur} max={g.uses.max} onSet={(cur) => uses(actions.setUses(raw, g.ref, cur))} label={`use of the ${g.label} spells`} />
                      </span>
                    )}
                    {g.spells.map((sp, i) => (
                      <span key={sp.ref.id} className="inline-flex items-baseline gap-1">
                        <CatalogueName entry={sp} onView={onView} className="italic" />
                        {sp.uses && <Pips cur={sp.uses.cur} max={sp.uses.max} onSet={(cur) => uses(actions.setUses(raw, sp.ref, cur))} label={`use of ${sp.name}`} />}
                        {i < g.spells.length - 1 && <span className={INK.faint}>,&nbsp;</span>}
                      </span>
                    ))}
                  </Labelled>
                )
              )
            )}
            {editing && (
              <button type="button" className={addBtn} onClick={() => set(actions.addSpellGroup(raw, b.ref))}>
                + spell list
              </button>
            )}
          </div>
        </div>
      ))}
      {editing && sc.blocks.length === 0 && <p className={`text-sm italic ${INK.faint}`}>Doesn't cast spells — “+ spellcasting” to give it some.</p>}
    </div>
  );
}

const Spellcasting = (props) => (props.sc.kind === "groups" ? <GroupSpellcasting {...props} /> : <LevelSpellcasting {...props} />);

/* ─── gear ───────────────────────────────────────────────────────── */

function Equipment({ eq, raw, editing, edits, actions, set, use, onView }) {
  const uses = editing ? set : use;
  return (
    <div className="mb-3 break-inside-avoid">
      <Heading>Equipment</Heading>
      <div className="space-y-0.5 text-[15px]">
        {eq.magic.map((m) => (
          <div key={m.ref.id} className="flex flex-wrap items-baseline gap-x-2">
            {editing && <Mark on={m.attuned} onClick={() => set(actions.replace(raw, m.ref, { ...actions.row(raw, m.ref), attuned: !m.attuned }))} label={`${m.name} attuned`} />}
            <CatalogueName entry={m} onView={onView} />
            {m.attuned && !editing && <span className={`text-xs italic ${INK.faded}`}>attuned</span>}
            {m.uses && <Pips cur={m.uses.cur} max={m.uses.max} onSet={(cur) => uses(actions.setUses(raw, m.ref, cur))} label={`charge of ${m.name}`} title={m.regain} />}
            {editing && <InkRemove onClick={() => set(actions.remove(raw, m.ref))} label={`Remove ${m.name}`} />}
          </div>
        ))}
        {eq.gear.length > 0 &&
          (editing ? (
            eq.gear.map((g) => (
              <div key={g.ref.id} className="flex items-baseline gap-2">
                <CatalogueName entry={g} onView={onView} />
                <span aria-hidden="true" className="mx-1 min-w-[0.75rem] flex-1 translate-y-[-4px] border-b-2 border-dotted border-[#7b6346]/35" />
                <span className={`text-xs italic ${INK.faded}`}>×</span>
                <InkNumber value={g.amount} onChange={(v) => set(actions.setAmount(raw, g.ref, v))} min={0} fallback={0} aria-label={`${g.name} amount`} className="h-6 w-12 text-sm" />
                <InkRemove onClick={() => set(actions.remove(raw, g.ref))} label={`Remove ${g.name}`} />
              </div>
            ))
          ) : (
            <Labelled label="Gear">
              {eq.gear.map((g, i) => (
                <span key={g.ref.id}>
                  <CatalogueName entry={g} onView={onView} />
                  {g.amount > 1 && ` ×${g.amount}`}
                  {i < eq.gear.length - 1 && ", "}
                </span>
              ))}
            </Labelled>
          ))}
        {!eq.coins ? null : editing ? (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-1">
            <span className="font-semibold">Coins</span>
            {eq.coins.map((coin) => (
              <span key={coin.key} className="flex items-baseline gap-1">
                <InkNumber value={edits.coin.get(raw, coin.key)} onChange={(v) => set(edits.coin.set(raw, coin.key, v))} min={0} fallback={0} aria-label={`${coin.key} coins`} className="h-6 w-14 text-sm" />
                <span className={`text-xs ${INK.faded}`}>{coin.key}</span>
              </span>
            ))}
          </div>
        ) : (
          eq.coins.some((c) => c.amount > 0) && (
            <Labelled label="Coins">
              {eq.coins
                .filter((c) => c.amount > 0)
                .map((c) => `${c.amount} ${c.key}`)
                .join(", ")}
            </Labelled>
          )
        )}
        {editing && !eq.magic.length && !eq.gear.length && <p className={`text-sm italic ${INK.faint}`}>No gear yet — add items above.</p>}
      </div>
    </div>
  );
}

/* ─── adding ─────────────────────────────────────────────────────── */

function AddBar({ raw, actions, addKinds, set, onView, onAdded }) {
  const [picking, setPicking] = useState(null);
  const add = (kind, entry) => {
    const res = actions.add(raw, kind, entry);
    set(res.raw);
    if (res.open) {
      setPicking(null);
      onAdded(res.ref);
    }
  };
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <span className={`text-sm italic ${INK.faded}`}>Add from the catalogue:</span>
        {addKinds.map((k) => (
          <button key={k.kind} type="button" onClick={() => setPicking((p) => (p === k.kind ? null : k.kind))} className={`${addBtn} ${picking === k.kind ? "font-semibold" : ""}`}>
            {k.label}
          </button>
        ))}
        <span className={`text-sm italic ${INK.faint}`}>or</span>
        <button type="button" onClick={() => add("own")} className={addBtn}>
          write your own
        </button>
      </div>
      {picking && (
        <div className="mt-3">
          <CataloguePicker kind={picking} has={(entry) => actions.has(raw, picking, entry)} onAdd={(entry) => add(picking, entry)} onView={onView} onClose={() => setPicking(null)} />
        </div>
      )}
    </div>
  );
}

/* ─── the card body ──────────────────────────────────────────────── */

export default function Statblock({ view, raw, editing = false, edits, actions, RowEditor, addKinds = [], onChange, onUse, onView }) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [openRef, setOpenRef] = useState(null);
  const set = onChange;
  const use = onUse;
  const shared = { view, raw, editing, edits, set };
  const rowProps = { raw, editing, actions, set, use, onView };
  const showSpells = editing || !view.spellcasting.empty;
  const showGear = editing || !view.equipment.empty;

  return (
    <div>
      <Fold id="base" title="Vitals & ability scores" summary={foldSummary(view)}>
        <Vitals {...shared} />
        <RubricRule />
        <Abilities {...shared} />
      </Fold>
      <RubricRule />

      <Fold id="lines" title="Saves, skills & senses">
        <div className="space-y-0.5">
          {editing && (
            <div className="mb-3">
              <SkillGrid {...shared} />
            </div>
          )}
          {view.lines
            .filter((l) => !editing || (l.label !== "Saving Throws" && l.label !== "Skills"))
            .map((l) =>
              editing && l.editor ? (
                <LineEditor key={l.label} line={l} raw={raw} edits={edits} set={set} />
              ) : (
                <Labelled key={l.label} label={l.label}>
                  {l.text}
                </Labelled>
              )
            )}
        </div>
      </Fold>

      <RubricRule />

      {editing && <AddBar raw={raw} actions={actions} addKinds={addKinds} set={set} onView={onView} onAdded={setOpenRef} />}

      {/* Reading: two columns. Editing: one, so an open editor has room. */}
      <div className={editing ? "" : "gap-10 @4xl:columns-2"}>
        <Sections {...rowProps} view={view} edits={edits} openRef={openRef} setOpenRef={setOpenRef} RowEditor={RowEditor} />
        {showSpells && <Spellcasting sc={view.spellcasting} {...rowProps} />}
        {showGear && <Equipment eq={view.equipment} edits={edits} {...rowProps} />}
      </div>

      <RubricRule />

      <div className="space-y-4">
        <div>
          <Heading>Notes</Heading>
          {editing ? (
            <InkTextArea
              value={edits.notes.get(raw)}
              onChange={(e) => set(edits.notes.set(raw, e.target.value))}
              rows={4}
              placeholder={view.notesPlaceholder}
              aria-label="Notes"
            />
          ) : view.notes ? (
            <p className="whitespace-pre-line text-[15px] leading-relaxed">{view.notes}</p>
          ) : (
            <p className={`text-sm italic ${INK.faint}`}>No notes yet — right-click and choose Edit to write some.</p>
          )}
        </div>

        {view.about.length > 0 && (
          <div>
            <InkButton onClick={() => setAboutOpen((o) => !o)}>{aboutOpen ? "hide" : "show"} their story</InkButton>
            {aboutOpen && (
              <div className="mt-2 space-y-1.5">
                {view.about.map((a) => (
                  <Labelled key={a.label} label={a.label}>
                    <span className="whitespace-pre-line">{a.text}</span>
                  </Labelled>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}