import React, { useMemo, useState } from "react";
import { INK, InkText } from "../../../styles/parchment";
import { ABILITY_SHORT, labelFromId } from "../../Catalogues/catalogueHelpers";
import { ChoiceHead, Note, Pick, PickRow } from "./wizardInk";

/* ═══════════════════════════════════════════════════════════════════
   ChoiceList — draws the choices the server's preview sends
   (app/builder/character.py _choice_view), one block each:

     pool      { options: [{value, label, note, unmet}], count, picked }
     ability   { from_abilities, bonus_sets, picked: {wis: 2, cha: 1} }
     bundle    { options: [{value, label}], picked: "a" }

   What the player picked lives in the wizard (`own(from, path)`); what
   the server shows as picked can also be the randomizer's roll, drawn
   lighter until the player picks for themselves. A feat or optional
   feature whose prerequisites aren't met is marked, never blocked.
   Right-click an option (a spell, feat, item…) to see its card.
   ═══════════════════════════════════════════════════════════════════ */

const SEARCH_FROM = 16; // a list this long gets a search line
const SHOW_FIRST = 48;

const optionLabel = (o) => o.label || labelFromId(o.value);
const asList = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

export function PoolChoice({ c, own, onPick, rolled, onView }) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const picked = asList(own ?? (rolled ? c.picked : null));
  const count = c.count || 1;

  const toggle = (value) => {
    const cur = asList(own);
    let next;
    if (cur.includes(value)) next = cur.filter((v) => v !== value);
    else if (count === 1) next = [value];
    else if (cur.length >= count) return;
    else next = [...cur, value];
    onPick(next.length ? next : null);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const opts = (c.options || []).filter((o) => !q || optionLabel(o).toLowerCase().includes(q));
    // what's picked first, so it never scrolls out of sight
    return [...opts.filter((o) => picked.includes(o.value)), ...opts.filter((o) => !picked.includes(o.value))];
  }, [c.options, query, picked]);
  const visible = all || query ? shown : shown.slice(0, SHOW_FIRST);
  const left = Math.max(0, count - asList(own).length);

  return (
    <div>
      <ChoiceHead
        title={c.label || labelFromId(c.id)}
        need={`choose ${count}${left ? ` · ${left} left` : " · done"}${rolled && own == null && c.picked ? " · rolled" : ""}`}
        done={!left}
      >
        {(c.options || []).length >= SEARCH_FROM && (
          <InkText value={query} onChange={(e) => setQuery(e.target.value)} placeholder="find…" aria-label="Find an option" className="h-7 w-40 text-sm" />
        )}
      </ChoiceHead>
      {(c.options || []).length === 0 ? (
        <Note>Nothing to choose from here.</Note>
      ) : (
        <PickRow>
          {visible.map((o) => {
            const on = picked.includes(o.value);
            return (
              <Pick
                key={o.value}
                on={on}
                round={count === 1}
                warn={!!o.unmet}
                title={o.unmet ? "The character doesn't meet its prerequisites" : undefined}
                onClick={() => toggle(o.value)}
                onView={onView ? () => onView(c.grant, o.value) : undefined}
              >
                <span className={on && own == null ? "opacity-60" : ""}>{optionLabel(o)}</span>
                {o.note && <span className={`ml-1.5 text-[11px] font-normal italic ${INK.faint}`}>{o.note}</span>}
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
    </div>
  );
}

export function BundleChoice({ c, own, onPick, rolled }) {
  const picked = own ?? (rolled ? c.picked : null);
  return (
    <div>
      <ChoiceHead title={c.label || labelFromId(c.id)} need={own ? "pick one · done" : `pick one${rolled && c.picked ? " · rolled" : " · 1 left"}`} done={!!own} />
      <div className="space-y-1">
        {(c.options || []).map((o) => (
          <div key={o.value}>
            <Pick round on={picked === o.value} onClick={() => onPick(own === o.value ? null : o.value)}>
              <span className={picked === o.value && !own ? "opacity-60" : ""}>{optionLabel(o)}</span>
            </Pick>
          </div>
        ))}
      </div>
    </div>
  );
}

/* +2 / +1 or +1 / +1 / +1 to different abilities: pick the set, then an
   ability for each amount. The pick is {ability: amount}, sent once every
   amount has its ability (half an answer stays here meanwhile). */
const sortedDesc = (s) => [...s].sort((a, b) => b - a);
const slotsFrom = (pick, set) => {
  const pool = Object.entries(pick || {}).map(([a, n]) => ({ a, n }));
  return set.map((n) => {
    const i = pool.findIndex((p) => p.n === n);
    return i === -1 ? null : pool.splice(i, 1)[0].a;
  });
};

export function AbilityChoice({ c, own, onPick, rolled }) {
  const sets = (c.bonus_sets || [[1]]).map(sortedDesc);
  const ownAmounts = sortedDesc(Object.values(own || {})).join();
  const [setIndex, setSetIndex] = useState(() => Math.max(0, sets.findIndex((s) => s.join() === ownAmounts)));
  const set = sets[setIndex] || sets[0];
  const [slots, setSlots] = useState(() => slotsFrom(own, set));

  const update = (next) => {
    setSlots(next);
    if (next.every(Boolean)) {
      const pick = {};
      next.forEach((a, k) => (pick[a] = set[k]));
      onPick(pick);
    } else if (own) onPick(null);
  };
  const assign = (i, ability) => {
    const next = slots.map((a) => (a === ability ? null : a));
    next[i] = slots[i] === ability ? null : ability;
    update(next);
  };
  const chooseSet = (i) => {
    setSetIndex(i);
    setSlots(sets[i].map(() => null));
    if (own) onPick(null);
  };
  const done = !!own;

  return (
    <div>
      <ChoiceHead title={c.label || "Ability Scores"} need={done ? "done" : rolled && c.picked ? "rolled" : "assign"} done={done} />
      {sets.length > 1 && (
        <PickRow className="mb-1">
          {sets.map((s, i) => (
            <Pick key={i} round on={setIndex === i} onClick={() => chooseSet(i)}>
              {s.map((n) => `+${n}`).join(" / ")}
            </Pick>
          ))}
        </PickRow>
      )}
      {!own && rolled && c.picked && (
        <Note>Rolled: {Object.entries(c.picked).map(([a, n]) => `${ABILITY_SHORT[a] || a} +${n}`).join(", ")}</Note>
      )}
      <div className="space-y-1">
        {set.map((n, i) => (
          <div key={i} className="flex flex-wrap items-baseline gap-x-4">
            <span className={`w-8 text-sm tabular-nums ${INK.faded}`}>+{n}</span>
            <PickRow>
              {(c.from_abilities || []).map((a) => (
                <Pick key={a} round on={slots[i] === a} onClick={() => assign(i, a)}>
                  {ABILITY_SHORT[a] || a}
                </Pick>
              ))}
            </PickRow>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChoiceList({ choices, own, onPick, ownerLabel, rolled = false, empty, onView }) {
  if (!choices?.length) return empty ? <Note>{empty}</Note> : null;
  return (
    <div className="space-y-5">
      {choices.map((c) => {
        const props = {
          c,
          own: own(c.from, c.path),
          onPick: (value) => onPick(c.from, c.path, value),
          rolled,
          onView,
        };
        return (
          <div key={`${c.from}|${c.path}`}>
            {ownerLabel?.(c.from) && <div className={`-mb-1 text-right text-xs italic ${INK.faint}`}>from {ownerLabel(c.from)}</div>}
            {c.type === "bundle" ? <BundleChoice {...props} /> : c.type === "ability" ? <AbilityChoice {...props} /> : <PoolChoice {...props} />}
          </div>
        );
      })}
    </div>
  );
}
