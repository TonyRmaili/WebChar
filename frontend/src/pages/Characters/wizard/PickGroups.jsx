import React, { useMemo, useState } from "react";
import { INK, InkText } from "../../../styles/parchment";
import { Chevron } from "../../../styles/parchmentForm";
import { labelFromId } from "../../Catalogues/catalogueHelpers";
import { AbilityChoice, BundleChoice, PoolChoice } from "./ChoiceList";
import { ChoiceHead, Note, Pick, PickRow } from "./wizardInk";
import { asList, countsByLevel, distribute, groupOptions } from "./classPicks";

/* ═══════════════════════════════════════════════════════════════════
   PickGroups — one class's choices, condensed (classPicks.js): every
   level's spell picks in one "Spells" block, every Ability Score
   Improvement in one, and so on, with the subclass's own in theirs.
   Left-click picks, right-click shows the option's card. Each block
   folds away with its chevron.

   Used by the wizard's Class step and the sheet's level-up form.
   ═══════════════════════════════════════════════════════════════════ */

const SEARCH_FROM = 16;
const SHOW_FIRST = 48;
const optionLabel = (o) => o.label || labelFromId(o.value);

function Fold({ open, onToggle, title, need, done, owner, children, head }) {
  return (
    <div>
      <div className="flex items-baseline gap-1">
        <button type="button" onClick={onToggle} aria-expanded={open} className={`self-center ${INK.faded} hover:text-ink`} title={open ? "Fold away" : "Show"}>
          <Chevron open={open} />
        </button>
        <div className="min-w-0 flex-1">
          <ChoiceHead title={title} need={need} done={done} owner={owner}>
            {head}
          </ChoiceHead>
        </div>
      </div>
      {open && <div className="pl-5">{children}</div>}
    </div>
  );
}

/* A merged pool: the options of every member, the picks spread over them. */
function GroupChoice({ group, own, onPick, rolled, onView }) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const options = useMemo(() => groupOptions(group), [group]);
  const mine = group.members.flatMap((m) => asList(own(m.from, m.path)));
  const rolledPicks = rolled ? group.members.flatMap((m) => asList(m.picked)) : [];
  const picked = [...new Set([...mine, ...rolledPicks])];
  const left = Math.max(0, group.count - mine.length);
  const [open, setOpen] = useState(true);

  const write = (values) => {
    const lists = distribute(group, values, options);
    group.members.forEach((m, i) => {
      const before = asList(own(m.from, m.path));
      const after = asList(lists[i]);
      if (before.length !== after.length || before.some((v, k) => v !== after[k])) onPick(m.from, m.path, lists[i]);
    });
  };
  const toggle = (value) => {
    if (mine.includes(value)) return write(mine.filter((v) => v !== value));
    if (group.count === 1) return write([value]);
    if (mine.length >= group.count) return;
    write([...mine, value]);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const opts = options.filter((o) => !q || optionLabel(o).toLowerCase().includes(q));
    return [...opts.filter((o) => picked.includes(o.value)), ...opts.filter((o) => !picked.includes(o.value))];
  }, [options, query, picked]);
  const visible = all || query ? shown : shown.slice(0, SHOW_FIRST);
  const split = group.members.length > 1 ? `levels ${countsByLevel(group)}` : null;

  return (
    <Fold
      open={open}
      onToggle={() => setOpen(!open)}
      title={group.label || labelFromId(group.members[0]?.id)}
      need={`choose ${group.count}${left ? ` · ${left} left` : " · done"}${rolled && left && rolledPicks.length ? " · rolled" : ""}`}
      done={!left}
      head={
        <>
          {split && <span className={`text-[11px] italic ${INK.faint}`}>{split}</span>}
          {open && options.length >= SEARCH_FROM && (
            <InkText value={query} onChange={(e) => setQuery(e.target.value)} placeholder="find…" aria-label="Find an option" className="h-7 w-40 text-sm" />
          )}
        </>
      }
    >
      {!open ? null : options.length === 0 ? (
        <Note>Nothing to choose from here.</Note>
      ) : (
        <PickRow>
          {visible.map((o) => {
            const on = picked.includes(o.value);
            const later = o.from > group.level ? `from level ${o.from}` : null;
            return (
              <Pick
                key={o.value}
                on={on}
                round={group.count === 1}
                warn={!!o.unmet}
                title={o.unmet ? "The character doesn't meet its prerequisites" : undefined}
                onClick={() => toggle(o.value)}
                onView={onView ? () => onView(group.grant, o.value) : undefined}
              >
                <span className={on && !mine.includes(o.value) ? "opacity-60" : ""}>{optionLabel(o)}</span>
                {(o.note || later) && <span className={`ml-1.5 text-[11px] font-normal italic ${INK.faint}`}>{[o.note, later].filter(Boolean).join(" · ")}</span>}
              </Pick>
            );
          })}
          {!all && !query && shown.length > SHOW_FIRST && (
            <button type="button" onClick={() => setAll(true)} className={`text-sm italic ${INK.faded} hover:underline`}>
              {shown.length - SHOW_FIRST} more…
            </button>
          )}
        </PickRow>
      )}
    </Fold>
  );
}

/* A choice that stays on its own (gear, +2/+1, a feat's own choice). */
function SingleChoice({ group, own, onPick, rolled, onView, ownerLabel }) {
  const c = group.members[0];
  const props = { c, own: own(c.from, c.path), onPick: (v) => onPick(c.from, c.path, v), rolled, onView };
  const owner = group.owner ? ownerLabel?.(group.owner) : null;
  return (
    <div>
      {owner && <div className={`-mb-1 text-right text-xs italic ${INK.faint}`}>from {owner}</div>}
      {c.type === "bundle" ? <BundleChoice {...props} /> : c.type === "ability" ? <AbilityChoice {...props} /> : <PoolChoice {...props} />}
    </div>
  );
}

export default function PickGroups({ groups, own, onPick, rolled = false, onView, ownerLabel, empty = "Nothing to choose." }) {
  if (!groups?.length) return <Note>{empty}</Note>;
  return (
    <div className="space-y-5">
      {groups.map((g) =>
        g.single ? (
          <SingleChoice key={g.key} group={g} own={own} onPick={onPick} rolled={rolled} onView={onView} ownerLabel={ownerLabel} />
        ) : (
          <GroupChoice key={g.key} group={g} own={own} onPick={onPick} rolled={rolled} onView={onView} />
        )
      )}
    </div>
  );
}
