import React, { useEffect, useState } from "react";
import useGroupStore from "../../../store/GroupStore";
import useTemplateStore from "../../../store/TemplateStore";
import { INK, InkButton, InkNumber, InkRemove, InkSelect, InkText, InkTextArea, Leader, SubHeading } from "../../../styles/parchment";
import { addBtn } from "../../../styles/parchmentForm";
import ParchmentMenu from "../../../styles/ParchmentMenu";
import { monsterSummary } from "../../Catalogues/Monsters/catalogueMonsters";
import CombatSection from "../encounters/CombatSection";

/* Campaign › Combat › Groups — saved packs of creatures ("Goblin war
   band": 4 × Goblin, 1 × Goblin Boss) to drop into an encounter in one go.
   A group can give templates to everyone in it; it works without any too.

   Group shape (routers/groups.py):
     { name, notes, monsters: [{ shelf, count }], npcs: [{ file }], templates: [id, …] }

   Monsters come from the shelf; adding the group to an encounter makes
   fresh numbered copies (encounterActions.addGroup). `shelf` and `npcs`
   are the campaign's copies ({ file, data }). */

const EMPTY = [];
const asList = (v) => (Array.isArray(v) ? v : []);
const label = `text-[10px] font-semibold uppercase tracking-[0.18em] ${INK.faded}`;

// "4 × Goblin, Goblin Boss · Captain Vos · with Ghostly"
export function groupSummary(g, shelf, npcs, templates) {
  const name = (list, file) => list.find((x) => x.file === file)?.data?.name || file.replace(/\.json$/, "");
  const monsters = asList(g.monsters).map((m) => `${m.count > 1 ? `${m.count} × ` : ""}${name(shelf, m.shelf)}`);
  const people = asList(g.npcs).map((n) => name(npcs, n.file));
  const tpl = asList(g.templates).map((id) => asList(templates).find((t) => t.id === id)?.name).filter(Boolean);
  return [monsters.join(", "), people.join(", "), tpl.length ? `with ${tpl.join(", ")}` : ""].filter(Boolean).join(" · ") || "empty";
}

function GroupEditor({ group, shelf, npcs, templates, change }) {
  const [adding, setAdding] = useState(null); // "monsters" | "npcs"
  const patch = (p) => change((g) => ({ ...g, ...p }));
  const monsters = asList(group.monsters);
  const people = asList(group.npcs);
  const chosen = asList(group.templates);
  const nameIn = (list, file) => list.find((x) => x.file === file)?.data?.name || file.replace(/\.json$/, "");

  const addMonster = (file) =>
    change((g) => {
      const list = asList(g.monsters);
      const same = list.find((m) => m.shelf === file);
      return { ...g, monsters: same ? list.map((m) => (m === same ? { ...m, count: m.count + 1 } : m)) : [...list, { shelf: file, count: 1 }] };
    });

  return (
    <div className="space-y-5">
      <InkText value={group.name} onChange={(e) => patch({ name: e.target.value })} aria-label="Group name" className="h-9 w-full max-w-md text-2xl" />

      <div className="grid grid-cols-1 gap-x-12 gap-y-5 @4xl:grid-cols-2">
        <div>
          <SubHeading count={monsters.reduce((n, m) => n + m.count, 0)}>Monsters</SubHeading>
          {monsters.map((m) => (
            <div key={m.shelf} className="flex items-baseline gap-2 py-[3px] text-[15px]">
              <InkNumber
                value={m.count}
                onChange={(v) => change((g) => ({ ...g, monsters: asList(g.monsters).map((x) => (x.shelf === m.shelf ? { ...x, count: Math.max(1, v ?? 1) } : x)) }))}
                min={1}
                max={20}
                fallback={1}
                aria-label={`How many ${nameIn(shelf, m.shelf)}`}
                className="h-6 w-9 text-sm"
              />
              <span>× {nameIn(shelf, m.shelf)}</span>
              <Leader />
              <span className={`shrink-0 text-xs italic ${INK.faded}`}>{shelf.some((x) => x.file === m.shelf) ? monsterSummary(shelf.find((x) => x.file === m.shelf).data) : "no longer on the shelf"}</span>
              <InkRemove onClick={() => change((g) => ({ ...g, monsters: asList(g.monsters).filter((x) => x.shelf !== m.shelf) }))} label={`Take ${nameIn(shelf, m.shelf)} out`} />
            </div>
          ))}
          <button type="button" onClick={() => setAdding((a) => (a === "monsters" ? null : "monsters"))} className={`${addBtn} mt-1`}>
            {adding === "monsters" ? "done" : "+ from the shelf"}
          </button>
          {adding === "monsters" &&
            (shelf.length ? (
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {shelf.map((e) => (
                  <button key={e.file} type="button" onClick={() => addMonster(e.file)} className={`text-[15px] italic ${INK.faded} hover:text-[#3a2716]`}>
                    {e.data?.name || e.file}
                  </button>
                ))}
              </p>
            ) : (
              <p className={`mt-1 text-sm italic ${INK.faint}`}>The shelf is empty — put some monsters on it first.</p>
            ))}

          <SubHeading count={people.length}>NPCs</SubHeading>
          {people.map((n) => (
            <div key={n.file} className="flex items-baseline gap-2 py-[3px] text-[15px]">
              <span>{nameIn(npcs, n.file)}</span>
              <Leader />
              <InkRemove onClick={() => change((g) => ({ ...g, npcs: asList(g.npcs).filter((x) => x.file !== n.file) }))} label={`Take ${nameIn(npcs, n.file)} out`} />
            </div>
          ))}
          <button type="button" onClick={() => setAdding((a) => (a === "npcs" ? null : "npcs"))} className={`${addBtn} mt-1`}>
            {adding === "npcs" ? "done" : "+ NPC"}
          </button>
          {adding === "npcs" && (
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {npcs.filter((n) => !people.some((p) => p.file === n.file)).map((n) => (
                <button key={n.file} type="button" onClick={() => change((g) => ({ ...g, npcs: [...asList(g.npcs), { file: n.file }] }))} className={`text-[15px] italic ${INK.faded} hover:text-[#3a2716]`}>
                  {n.data?.name || n.file}
                </button>
              ))}
              {npcs.every((n) => people.some((p) => p.file === n.file)) && <span className={`text-sm italic ${INK.faint}`}>No other NPCs.</span>}
            </p>
          )}
        </div>

        <div>
          <SubHeading count={chosen.length}>Templates for everyone in it</SubHeading>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[15px]">
            {chosen.map((id) => (
              <span key={id} className="inline-flex items-baseline">
                {asList(templates).find((t) => t.id === id)?.name || "a deleted template"}
                <InkRemove onClick={() => change((g) => ({ ...g, templates: asList(g.templates).filter((x) => x !== id) }))} label="Take this template off the group" />
              </span>
            ))}
            <InkSelect value="" onChange={(e) => e.target.value && change((g) => ({ ...g, templates: [...asList(g.templates), e.target.value] }))} aria-label="Give the group a template" className="h-6 text-sm">
              <option value="">+ template…</option>
              {asList(templates)
                .filter((t) => !chosen.includes(t.id))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </InkSelect>
          </p>
          <p className={`mt-1 text-xs italic ${INK.faint}`}>Everyone who joins an encounter with this group has these while they're in it — changes here reach them straight away.</p>

          <SubHeading>Notes</SubHeading>
          <InkTextArea value={group.notes || ""} onChange={(e) => patch({ notes: e.target.value })} rows={3} placeholder="How they fight together, where they camp…" aria-label="Group notes" />
        </div>
      </div>
    </div>
  );
}

export default function Groups({ campaignName, shelf, npcs }) {
  const groups = useGroupStore((s) => s.records[campaignName]) || EMPTY;
  const loading = useGroupStore((s) => s.loading);
  const problem = useGroupStore((s) => s.problem);
  const templates = useTemplateStore((s) => s.records[campaignName]);
  const store = useGroupStore;

  const [openId, setOpenId] = useState(null);
  const [menu, setMenu] = useState(null); // { x, y, group }
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    store.getState().fetch(campaignName).then((res) => !res.ok && setNotice(`Couldn't fetch the groups — ${res.message}.`));
  }, [campaignName, store]);

  const create = async () => {
    const res = await store.getState().create(campaignName, { name: `Group ${groups.length + 1}` });
    if (res.ok) setOpenId(res.record.id);
    else setNotice(`Couldn't make a group — ${res.message}.`);
  };

  const copy = async (g) => {
    const res = await store.getState().copy(campaignName, g.id);
    if (res.ok) setOpenId(res.record.id);
    setNotice(res.ok ? `${res.record.name} was made.` : `Couldn't copy ${g.name} — ${res.message}.`);
  };

  const remove = async (g) => {
    if (!window.confirm(`Delete the group ${g.name}? Encounters keep the creatures already added from it, but they lose the group's templates.`)) return;
    const res = await store.getState().remove(campaignName, g.id);
    setNotice(res.ok ? `${g.name} was deleted.` : `Couldn't delete ${g.name} — ${res.message}.`);
  };

  return (
    <CombatSection
      id="groups"
      title="Groups"
      summary={groups.length ? `${groups.length}` : undefined}
      right={
        <button type="button" onClick={create} className={addBtn}>
          + new group
        </button>
      }
    >
      {problem && <p className={`mb-2 text-sm italic ${INK.rubric}`}>{problem}</p>}
      {groups.length === 0 ? (
        <p className={`py-4 italic ${INK.faint}`}>{loading ? "Fetching…" : "None yet. A group is a pack of shelf monsters (and NPCs) that joins an encounter in one go, templates and all."}</p>
      ) : (
        groups.map((g) => {
          const open = g.id === openId;
          return (
            <div key={g.id} className="border-b border-[#7b6346]/20 last:border-b-0">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : g.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ x: e.clientX, y: e.clientY, group: g });
                }}
                aria-expanded={open}
                className="group flex w-full items-baseline gap-3 py-2 text-left"
              >
                <span className="self-center">
                  <span className={`block h-2.5 w-2.5 rotate-45 border-[1.5px] transition ${open ? "border-[#9a3412] bg-[#9a3412]" : "border-[#7b6346]/70 group-hover:border-[#3a2716]"}`} />
                </span>
                <span className={`shrink-0 text-lg ${open ? INK.rubric : ""} group-hover:underline group-hover:decoration-dotted group-hover:underline-offset-4`}>{g.name || "Unnamed"}</span>
                <span className={`min-w-0 truncate text-sm italic ${INK.faded}`}>{groupSummary(g, shelf, npcs, templates)}</span>
              </button>
              {open && (
                <div className="pb-6 pl-[22px]">
                  <GroupEditor group={g} shelf={shelf} npcs={npcs} templates={templates} change={(fn) => store.getState().update(campaignName, g.id, fn)} />
                </div>
              )}
            </div>
          );
        })
      )}

      {notice && (
        <p className={`mt-3 flex flex-wrap items-baseline gap-x-3 text-sm italic ${INK.faded}`} role="status">
          {notice}
          <InkButton onClick={() => setNotice(null)}>dismiss</InkButton>
        </p>
      )}

      {menu && (
        <ParchmentMenu
          x={menu.x}
          y={menu.y}
          title={menu.group.name}
          groups={[
            {
              items: [
                { label: menu.group.id === openId ? "Close" : "Open", onSelect: () => setOpenId(menu.group.id === openId ? null : menu.group.id) },
                { label: "Make a copy", onSelect: () => copy(menu.group) },
              ],
            },
            { items: [{ label: "Delete…", onSelect: () => remove(menu.group), danger: true }] },
          ]}
          onClose={() => setMenu(null)}
        />
      )}
    </CombatSection>
  );
}