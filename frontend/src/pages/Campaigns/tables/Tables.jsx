import React, { useEffect, useMemo, useState } from "react";
import useEncounterStore from "../../../store/EncounterStore";
import useTableStore from "../../../store/TableStore";
import { INK, InkButton, InkHeading, InkRemove, InkSelect, InkText, Leader, ParchmentSheet, Title } from "../../../styles/parchment";
import { addBtn, chipBtn } from "../../../styles/parchmentForm";
import ParchmentMenu from "../../../styles/ParchmentMenu";
import { closeTable, openTable } from "./TableWindow";
import { DICE, checkRows, hasProblems, newTable, rowsOf, searchText, tableSummary } from "./tableLogic";

/* Campaign › Tables — tables to roll on with real dice: random
   encounters, loot, events, weather… Shape: claude/tables-contract.md.

   Two kinds, like templates:
     this campaign   kept with the campaign, seen only here
     all campaigns   kept on your profile, seen in every campaign

   The list is grouped by category and can be filtered by words (names,
   categories and what's written in the rows), category, die and kind.
   Click a name to open the table's card (a window like the statblocks);
   right-click a line to copy it, move it between the two kinds or delete
   it. A new table opens already editing. */

const EMPTY = [];
const NONE = "";
const SHOW = [
  { value: "both", label: "both" },
  { value: "campaign", label: "this campaign" },
  { value: "all", label: "all campaigns" },
];
const where = (scope) => (scope === "all" ? "all campaigns" : "this campaign");
const UNSORTED = "Other";

function remembered(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export default function Tables({ campaignName }) {
  const tables = useTableStore((s) => s.records[campaignName]) || EMPTY;
  const loading = useTableStore((s) => s.loading);
  const problem = useTableStore((s) => s.problem);
  const encounters = useEncounterStore((s) => s.encounters[campaignName]);
  const store = useTableStore;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(NONE);
  const [die, setDie] = useState(NONE);
  const [show, setShow] = useState(() => remembered("tables.show", "both"));
  const [menu, setMenu] = useState(null); // { x, y, table }
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    store.getState().fetch(campaignName).then((res) => !res.ok && setNotice(`Couldn't fetch the tables — ${res.message}.`));
    if (!useEncounterStore.getState().encounters[campaignName]) useEncounterStore.getState().fetchEncounters(campaignName);
  }, [campaignName, store]);

  const choose = (v) => {
    setShow(v);
    try {
      localStorage.setItem("tables.show", v);
    } catch {
      /* fine without it */
    }
  };

  const open = (t, editing = false) => openTable({ name: t.name, campaignName, tableId: t.id }, editing ? { editFrom: t } : undefined);

  const create = async (scope) => {
    const res = await store.getState().create(campaignName, { scope, data: { ...newTable(), category: category || "" } });
    if (!res.ok) return setNotice(`Couldn't make a table — ${res.message}.`);
    open(res.record, true); // a new one opens ready to fill in
    setNotice(null);
  };

  const copy = async (t, toScope) => {
    const res = await store.getState().copy(campaignName, t.id, { to_scope: toScope });
    setNotice(res.ok ? `${res.record.name} was made (${where(res.record.scope)}).` : `Couldn't copy ${t.name} — ${res.message}.`);
  };

  const move = async (t, toScope) => {
    const res = await store.getState().move(campaignName, t.id, toScope);
    setNotice(res.ok ? `${t.name} is now for ${where(toScope)}.` : `Couldn't move ${t.name} — ${res.message}.`);
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete the table ${t.name}? Rows in other tables that roll on it stop working.`)) return;
    const res = await store.getState().remove(campaignName, t.id);
    if (res.ok) closeTable({ campaignName, tableId: t.id });
    setNotice(res.ok ? `${t.name} was deleted.` : `Couldn't delete ${t.name} — ${res.message}.`);
  };

  // Only what exists can be chosen.
  const categories = useMemo(() => [...new Set(tables.map((t) => t.category || UNSORTED))].sort((a, b) => a.localeCompare(b)), [tables]);
  const dice = useMemo(() => DICE.filter((d) => tables.some((t) => Number(t.die) === d)), [tables]);
  const filtering = Boolean(query || category || die || show !== "both");

  const groups = useMemo(() => {
    const names = { encounters, tables };
    const words = query.trim().toLowerCase();
    const shown = tables
      .filter((t) => show === "both" || t.scope === show)
      .filter((t) => !category || (t.category || UNSORTED) === category)
      .filter((t) => !die || Number(t.die) === Number(die))
      .filter((t) => !words || searchText(t, names).includes(words))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const byCategory = new Map();
    for (const t of shown) {
      const c = t.category || UNSORTED;
      if (!byCategory.has(c)) byCategory.set(c, []);
      byCategory.get(c).push(t);
    }
    return [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tables, encounters, query, category, die, show]);
  const shownCount = groups.reduce((n, [, list]) => n + list.length, 0);

  return (
    <ParchmentSheet>
      <Title
        after={<span className={`text-sm italic ${INK.faded}`}>{tables.length ? `${tables.length}` : ""}</span>}
        right={
          <>
            <button type="button" onClick={() => create("campaign")} className={addBtn} title="Only in this campaign">
              + new table
            </button>
            <button type="button" onClick={() => create("all")} className={addBtn} title="In every campaign of yours">
              + new for all campaigns
            </button>
          </>
        }
      >
        Tables
      </Title>

      {problem && <p className={`mb-2 text-sm italic ${INK.rubric}`}>{problem}</p>}

      {tables.length === 0 ? (
        <p className={`py-4 italic ${INK.faint}`}>
          {loading ? "Fetching…" : "None yet. A table is a die and a list of what each roll means — random encounters, loot, weather, rumours. Roll your real dice and look it up here."}
        </p>
      ) : (
        <>
          <div className="mb-4 space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
              <InkText value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search names and rows…" aria-label="Search the tables" className="h-7 w-64 text-[15px]" />
              <label className={`flex items-baseline gap-1.5 text-xs italic ${die ? INK.rubric : INK.faded}`}>
                die
                <InkSelect value={die} onChange={(e) => setDie(e.target.value)} aria-label="Die" className="h-6 text-sm">
                  <option value={NONE}>any</option>
                  {dice.map((d) => (
                    <option key={d} value={d}>
                      d{d}
                    </option>
                  ))}
                </InkSelect>
              </label>
              <span className="flex flex-wrap items-baseline gap-x-3 text-xs italic">
                <span className={INK.faded}>show</span>
                {SHOW.map((o) => (
                  <button key={o.value} type="button" onClick={() => choose(o.value)} className={chipBtn(show === o.value)}>
                    {o.label}
                  </button>
                ))}
              </span>
              {filtering && (
                <InkButton
                  onClick={() => {
                    setQuery("");
                    setCategory(NONE);
                    setDie(NONE);
                    choose("both");
                  }}
                >
                  clear
                </InkButton>
              )}
              <span className={`ml-auto text-xs italic ${INK.faint}`}>
                {filtering ? `${shownCount} of ${tables.length} shown` : "click to open · right-click for more"}
              </span>
            </div>
            {categories.length > 1 && (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className={`text-xs italic ${INK.faded}`}>category</span>
                <button type="button" onClick={() => setCategory(NONE)} className={chipBtn(!category)}>
                  all
                </button>
                {categories.map((c) => (
                  <button key={c} type="button" onClick={() => setCategory(category === c ? NONE : c)} className={chipBtn(category === c)}>
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {groups.length === 0 ? (
            <p className={`py-2 text-sm italic ${INK.faint}`}>No table matches.</p>
          ) : (
            <div className="space-y-5">
              {groups.map(([name, list]) => (
                <div key={name}>
                  <InkHeading right={<span className={`text-xs italic ${INK.faint}`}>{list.length}</span>}>{name}</InkHeading>
                  <div className="grid grid-cols-1 gap-x-10 @3xl:grid-cols-2">
                    {list.map((t) => {
                      const unfinished = rowsOf(t).length > 0 && hasProblems(checkRows(t));
                      return (
                        <div
                          key={t.id}
                          className="flex items-baseline gap-2 py-[3px] text-[15px]"
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setMenu({ x: e.clientX, y: e.clientY, table: t });
                          }}
                        >
                          <button type="button" onClick={() => open(t)} className="truncate text-left hover:underline hover:decoration-dotted hover:underline-offset-4" title="Open the table">
                            {t.name}
                          </button>
                          {t.scope === "all" && <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`}>all</span>}
                          <Leader />
                          {unfinished && (
                            <span className={`shrink-0 text-xs italic ${INK.rubric}`} title="Some numbers have no row, more than one row, or can't be rolled">
                              unfinished ·
                            </span>
                          )}
                          <span className={`shrink-0 text-xs italic ${INK.faded}`}>{tableSummary(t)}</span>
                          <InkRemove onClick={() => remove(t)} label={`Delete the table ${t.name}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {notice && (
        <p className={`mt-4 flex flex-wrap items-baseline gap-x-3 text-sm italic ${INK.faded}`} role="status">
          {notice}
          <InkButton onClick={() => setNotice(null)}>dismiss</InkButton>
        </p>
      )}

      {menu && (
        <ParchmentMenu
          x={menu.x}
          y={menu.y}
          title={menu.table.name}
          subtitle={`${tableSummary(menu.table)} · for ${where(menu.table.scope)}`}
          groups={[
            {
              items: [
                { label: "Open", onSelect: () => open(menu.table) },
                { label: "Edit", onSelect: () => open(menu.table, true) },
                { label: "Make a copy", onSelect: () => copy(menu.table, menu.table.scope) },
                { label: `Make a copy for ${where(menu.table.scope === "all" ? "campaign" : "all")}`, onSelect: () => copy(menu.table, menu.table.scope === "all" ? "campaign" : "all") },
                {
                  label: menu.table.scope === "all" ? "Keep it in this campaign only" : "Use it in all campaigns",
                  note: menu.table.scope === "all" ? "other campaigns lose it" : "links to this campaign's encounters and tables only work here",
                  onSelect: () => move(menu.table, menu.table.scope === "all" ? "campaign" : "all"),
                },
              ],
            },
            { items: [{ label: "Delete…", onSelect: () => remove(menu.table), danger: true }] },
          ]}
          onClose={() => setMenu(null)}
        />
      )}
    </ParchmentSheet>
  );
}