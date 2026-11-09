import React, { useEffect, useState } from "react";
import useTemplateStore from "../../../store/TemplateStore";
import { INK, InkButton, InkRemove, Leader } from "../../../styles/parchment";
import { addBtn } from "../../../styles/parchmentForm";
import ParchmentMenu from "../../../styles/ParchmentMenu";
import CombatSection from "../encounters/CombatSection";
import { closeStatblock, openStatblock } from "../statblock/StatblockWindow";
import { templateSummary } from "./templateLogic";
import { newTemplate } from "./templateStatblock";

/* Campaign › Combat › Templates — "statblocks without a creature" laid
   on monsters and NPCs (templateLogic.js). Two kinds:

     this campaign   kept with the campaign, seen only here
     all campaigns   kept on your profile, seen in every campaign

   A compact list; click a name to open the template's card (right-click
   it to edit — a new one opens already editing), right-click a line to copy it, move it between the two
   kinds or delete it. Creatures point at a template, so changing one
   changes every creature that has it. */

const EMPTY = [];
const SHOW = [
  { value: "both", label: "both" },
  { value: "campaign", label: "this campaign" },
  { value: "all", label: "all campaigns" },
];
const where = (scope) => (scope === "all" ? "all campaigns" : "this campaign");

export default function Templates({ campaignName }) {
  const templates = useTemplateStore((s) => s.records[campaignName]) || EMPTY;
  const loading = useTemplateStore((s) => s.loading);
  const problem = useTemplateStore((s) => s.problem);
  const store = useTemplateStore;

  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem("combat.templates.show") || "both";
    } catch {
      return "both";
    }
  });
  const [menu, setMenu] = useState(null); // { x, y, template }
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    store.getState().fetch(campaignName).then((res) => !res.ok && setNotice(`Couldn't fetch the templates — ${res.message}.`));
  }, [campaignName, store]);

  const choose = (v) => {
    setShow(v);
    try {
      localStorage.setItem("combat.templates.show", v);
    } catch {
      /* fine */
    }
  };

  const open = (t, editing = false) => openStatblock({ name: t.name, campaignName, kind: "template", templateId: t.id }, editing ? { editFrom: t } : undefined);

  const create = async (scope) => {
    const res = await store.getState().create(campaignName, { scope, data: newTemplate() });
    if (!res.ok) return setNotice(`Couldn't make a template — ${res.message}.`);
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
    if (!window.confirm(`Delete the ${t.name} template? Creatures that have it lose what it gives them.`)) return;
    const res = await store.getState().remove(campaignName, t.id);
    if (res.ok) closeStatblock({ campaignName, kind: "template", templateId: t.id });
    setNotice(res.ok ? `${t.name} was deleted.` : `Couldn't delete ${t.name} — ${res.message}.`);
  };

  const shown = templates.filter((t) => show === "both" || t.scope === show).sort((a, b) => String(a.name).localeCompare(String(b.name)));

  return (
    <CombatSection
      id="templates"
      title="Templates"
      summary={templates.length ? `${templates.length}` : undefined}
      right={
        <span className="flex items-baseline gap-x-4">
          <button type="button" onClick={() => create("campaign")} className={addBtn} title="Only in this campaign">
            + new
          </button>
          <button type="button" onClick={() => create("all")} className={addBtn} title="In every campaign of yours">
            + new for all campaigns
          </button>
        </span>
      }
    >
      {problem && <p className={`mb-2 text-sm italic ${INK.rubric}`}>{problem}</p>}

      {templates.length === 0 ? (
        <p className={`py-4 italic ${INK.faint}`}>
          {loading ? "Fetching…" : "None yet. A template is a statblock without a creature — bonuses, defenses, extra actions — that you lay on monsters and NPCs."}
        </p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-baseline gap-x-4 text-xs italic">
            <span className={INK.faded}>show</span>
            {SHOW.map((o) => (
              <button key={o.value} type="button" onClick={() => choose(o.value)} className={show === o.value ? `${INK.rubric} underline decoration-dotted underline-offset-4` : `${INK.faded} hover:text-ink`}>
                {o.label}
              </button>
            ))}
            <span className={`ml-auto ${INK.faint}`}>click to open · right-click for more</span>
          </div>
          {shown.length === 0 ? (
            <p className={`py-2 text-sm italic ${INK.faint}`}>None here.</p>
          ) : (
            <div className="grid grid-cols-1 gap-x-10 @3xl:grid-cols-2">
              {shown.map((t) => (
                <div
                  key={t.id}
                  className="flex items-baseline gap-2 py-[3px] text-[15px]"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ x: e.clientX, y: e.clientY, template: t });
                  }}
                >
                  <button type="button" onClick={() => open(t)} className="truncate text-left hover:underline hover:decoration-dotted hover:underline-offset-4" title="Open the template">
                    {t.name}
                  </button>
                  {t.scope === "all" && <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`}>all</span>}
                  <Leader />
                  <span className={`min-w-0 truncate text-xs italic ${INK.faded}`}>{templateSummary(t)}</span>
                  <InkRemove onClick={() => remove(t)} label={`Delete the ${t.name} template`} />
                </div>
              ))}
            </div>
          )}
        </>
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
          title={menu.template.name}
          subtitle={`for ${where(menu.template.scope)}`}
          groups={[
            {
              items: [
                { label: "Open", onSelect: () => open(menu.template) },
                { label: "Make a copy", onSelect: () => copy(menu.template, menu.template.scope) },
                { label: `Make a copy for ${where(menu.template.scope === "all" ? "campaign" : "all")}`, onSelect: () => copy(menu.template, menu.template.scope === "all" ? "campaign" : "all") },
                {
                  label: menu.template.scope === "all" ? "Keep it in this campaign only" : "Use it in all campaigns",
                  note: menu.template.scope === "all" ? "other campaigns lose it" : "creatures keep it",
                  onSelect: () => move(menu.template, menu.template.scope === "all" ? "campaign" : "all"),
                },
              ],
            },
            { items: [{ label: "Delete…", onSelect: () => remove(menu.template), danger: true }] },
          ]}
          onClose={() => setMenu(null)}
        />
      )}
    </CombatSection>
  );
}