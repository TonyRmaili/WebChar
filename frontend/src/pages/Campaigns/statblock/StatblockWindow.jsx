import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useEncounterStore from "../../../store/EncounterStore";
import useGroupStore from "../../../store/GroupStore";
import useTemplateStore from "../../../store/TemplateStore";
import { INK, InkText, ParchmentSheet } from "../../../styles/parchment";
import ParchmentMenu from "../../../styles/ParchmentMenu";
import Statblock from "./Statblock";
import useStatblockDrafts from "./statblockDrafts";
import { useStatblockSource } from "./statblockSource";
import CharacterRowEditor from "./characterRowEditor";
import MonsterRowEditor from "./monsterRowEditor";
import { CHARACTER_ACTIONS, CHARACTER_ADD_KINDS, CHARACTER_EDITS, characterView } from "./characterStatblock";
import { MONSTER_ACTIONS, MONSTER_ADD_KINDS, MONSTER_EDITS, monsterView } from "./monsterStatblock";
import { TEMPLATE_EDITS, templateView } from "../templates/templateStatblock";
import { applyTemplates, attachedTemplates, givenTemplates, memberIn, resolveTemplates, templateMenuGroups, withTemplateSections } from "../templates/templateLogic";

/* ═══════════════════════════════════════════════════════════════════
   StatblockWindow — a campaign copy's statblock as one of the app's card
   windows (registered as popup type "statblock"), so it can be moved,
   resized, minimized to the footer, and kept open while you use the page.

   Window data is only a reference: { name, campaignName, kind, file } for
   a campaign copy, or { name, campaignName, kind: "encounter", encounterId,
   monsterId } for a monster inside an encounter (statblockSource.js reads
   and saves either). The creature itself is read from its store (fetched
   if it isn't loaded), so a minimized card in the footer never goes stale.
   `kind` picks the adapter: party / npc → a character, monster or
   encounter → a catalogue monster. All draw with the same Statblock.

   Reading by default; using a dot (charges, slots) saves at once.
   Editing is only through the right-click menu (anywhere on the card):
   Edit makes a draft (kept while minimized), then Save / Discard; the
   same menu has Minimize, Standard size and Close.
   ═══════════════════════════════════════════════════════════════════ */

const asList = (v) => (Array.isArray(v) ? v : []);
// A character's template traits/actions sit next to its own; a monster
// gets them inside its worked-out data already.
const characterWithTemplates = (raw, { editing, templates = [] }) =>
  editing ? characterView(raw, { editing }) : withTemplateSections(characterView(raw, { editing }), templates, raw?.template_uses);

const CHARACTER = { view: characterWithTemplates, edits: CHARACTER_EDITS, actions: CHARACTER_ACTIONS, RowEditor: CharacterRowEditor, addKinds: CHARACTER_ADD_KINDS };
const MONSTER = { view: monsterView, edits: MONSTER_EDITS, actions: MONSTER_ACTIONS, RowEditor: MonsterRowEditor, addKinds: MONSTER_ADD_KINDS };
const TEMPLATE = { view: templateView, edits: TEMPLATE_EDITS, actions: MONSTER_ACTIONS, RowEditor: MonsterRowEditor, addKinds: MONSTER_ADD_KINDS };
const ADAPTERS = { party: CHARACTER, npc: CHARACTER, monster: MONSTER, encounter: MONSTER, template: TEMPLATE };

export const statblockWindowId = (d) =>
  d.kind === "encounter"
    ? `statblock__${d.campaignName}__encounter__${d.encounterId}__${d.monsterId}`
    : d.kind === "template"
      ? `statblock__${d.campaignName}__template__${d.templateId}`
      : `statblock__${d.campaignName}__${d.kind}__${d.file}`;

// The size the card is designed for: wide enough for two columns, nearly full height.
export const standardFrame = () => {
  const width = Math.min(1180, window.innerWidth - 32);
  const height = Math.max(420, window.innerHeight - 96);
  return { width, height, x: Math.max(16, Math.round((window.innerWidth - width) / 2)), y: 48 };
};

// Open (or bring forward) a card, placed at the standard size the first time.
// `editFrom`: open it already editing, starting from this (e.g. a template
// that was just made — empty, so you want to fill it in straight away).
export function openStatblock(data, { editFrom } = {}) {
  const store = usePopupStore.getState();
  const id = statblockWindowId(data);
  if (editFrom) useStatblockDrafts.getState().setDraft(id, structuredClone(editFrom));
  const known = store.openPopups.some((p) => p.id === id) || store.minimized.some((p) => p.id === id);
  store.open("statblock", data);
  if (!known) {
    const f = standardFrame();
    usePopupStore.getState().resize(id, f.width, f.height);
    usePopupStore.getState().move(id, f.x, f.y);
  }
}

// Take a card away entirely (open or in the footer), e.g. when its copy
// was removed from the campaign. Unsaved edits go with it.
export function closeStatblock(data) {
  const id = statblockWindowId(data);
  usePopupStore.setState((s) => ({ openPopups: s.openPopups.filter((p) => p.id !== id), minimized: s.minimized.filter((p) => p.id !== id) }));
  useStatblockDrafts.getState().clearDraft(id);
}

// Where each catalogue keeps its entries, and how to fetch it.
const CATALOGUE = {
  feat: { list: (s) => s.featsData?.feats, load: "loadFeats" },
  spell: { list: (s) => s.spellsData?.spells, load: "loadSpells" },
  item: { list: (s) => s.items, load: "loadItems" },
  optionalFeature: { list: (s) => s.optionalFeaturesData?.features, load: "loadOptionalFeatures" },
};

// `embedded`: drawn inside another window (the initiative tracker's turn
// card) instead of as its own window — the right-click menu then offers
// "open as its own card" instead of minimize / standard size / close.
export default function StatblockWindow({ statblock, embedded = false }) {
  const { campaignName, kind } = statblock;
  const id = statblockWindowId(statblock);
  const adapter = ADAPTERS[kind] || CHARACTER;
  const source = useStatblockSource(statblock);
  const canTemplate = kind !== "template";
  const allTemplates = useTemplateStore((s) => s.records[campaignName]);
  const groups = useGroupStore((s) => s.records[campaignName]);
  // A party member or NPC gets its groups' templates from its place in an encounter.
  const member = useEncounterStore((s) => (kind === "party" || kind === "npc" ? memberIn(s.encounters[campaignName], kind, statblock.file) : null));

  const draft = useStatblockDrafts((s) => s.drafts[id]) ?? null;
  const setDraftFor = useStatblockDrafts((s) => s.setDraft);
  const clearDraft = useStatblockDrafts((s) => s.clearDraft);
  const setDraft = (d) => setDraftFor(id, d);

  const openPopup = usePopupStore((s) => s.open);
  const minimize = usePopupStore((s) => s.minimize);
  const closeWindow = usePopupStore((s) => s.close);

  const [loadProblem, setLoadProblem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState(null);
  const [menu, setMenu] = useState(null); // { x, y }

  // Restored from the footer after a reload, or opened before the list was loaded.
  useEffect(() => {
    if (source.raw) return;
    source.load().then((res) => setLoadProblem(res.ok ? null : res.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Templates are needed to show the creature as it is with them on.
  useEffect(() => {
    if (canTemplate && !allTemplates) useTemplateStore.getState().fetch(campaignName);
    if (canTemplate && !groups) useGroupStore.getState().fetch(campaignName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignName]);

  const raw = source.raw;
  const editing = draft !== null;
  const current = draft ?? raw;
  const given = useMemo(() => (canTemplate && current ? givenTemplates(current, member, groups) : []), [canTemplate, current, member, groups]);
  // Reading shows the creature with its templates on; editing shows its own
  // statblock (what you change), with the templates named above it.
  const view = useMemo(() => {
    if (!current) return null;
    if (!canTemplate || editing) return adapter.view(current, { editing });
    const templates = resolveTemplates(current, allTemplates, given);
    return adapter.view(applyTemplates(kind, current, templates), { editing, templates });
  }, [adapter, current, editing, allTemplates, canTemplate, kind, given]);
  const attached = canTemplate && current ? attachedTemplates(current, allTemplates, given) : [];

  // Keep the window's title (and its footer button) on the name shown, e.g.
  // after renaming a template or when a template adds "Ghostly".
  useEffect(() => {
    if (!view?.name || view.name === statblock.name) return;
    usePopupStore.setState((s) => ({
      openPopups: s.openPopups.map((p) => (p.id === id ? { ...p, data: { ...p.data, name: view.name } } : p)),
      minimized: s.minimized.map((p) => (p.id === id ? { ...p, data: { ...p.data, name: view.name } } : p)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.name]);
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(raw);

  if (!raw) {
    return (
      <div className="h-full overflow-y-auto bg-[#1c120b] p-3">
        <ParchmentSheet>
          <p className={`py-6 text-center italic ${INK.faint}`}>
            {loadProblem ? `Couldn't find ${statblock.name} in ${campaignName} — ${loadProblem}.` : "Fetching…"}
          </p>
        </ParchmentSheet>
      </div>
    );
  }

  /* ── actions ── */

  const save = async () => {
    if (!dirty) return clearDraft(id);
    setSaving(true);
    const res = await source.save(draft);
    setSaving(false);
    if (res?.ok) {
      clearDraft(id);
      setProblem(null);
    } else {
      setProblem(res?.message || "couldn't save");
    }
  };

  const discard = () => {
    clearDraft(id);
    setProblem(null);
  };

  const startEdit = () => {
    setProblem(null);
    setDraft(structuredClone(raw));
  };

  // A spent or regained use (or a hidden row): into the draft while editing, saved at once while reading.
  const use = async (next) => {
    if (editing) return setDraft(next);
    const res = await source.save(next, { now: false });
    setProblem(res?.ok ? null : res?.message || "couldn't save");
  };

  const toStandardSize = () => {
    const f = standardFrame();
    usePopupStore.getState().resize(id, f.width, f.height);
    usePopupStore.getState().move(id, f.x, f.y);
  };

  const close = () => {
    if (dirty && !window.confirm("Close without saving your changes?")) return;
    clearDraft(id);
    closeWindow(id);
  };

  // Catalogue cards: the statblock only knows name + source, so look the entry up.
  // Monster spells are kept in lower case and often without a source.
  const viewCatalogue = async (type, ref) => {
    const cfg = CATALOGUE[type];
    if (!cfg) return;
    const same = (e) => String(e?.name || "").toLowerCase() === String(ref.name || "").toLowerCase();
    const find = () => {
      const all = asList(cfg.list(useCatalogueStore.getState())).filter(same);
      return all.find((e) => ref.source && e.source === ref.source) || all.find((e) => e.source === "XPHB") || all[0];
    };
    let full = find();
    if (!full) {
      await useCatalogueStore.getState()[cfg.load]?.();
      full = find();
    }
    openPopup(type, full || ref);
  };

  // Right-click anywhere on the card: our own menu instead of the window's
  // usual right-click-to-minimize.
  const onContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  // Templates are changed on the creature itself and saved at once.
  const changeTemplates = (fn) => (editing ? setDraft(fn(current)) : use(fn(raw)));
  const templateGroups = canTemplate ? templateMenuGroups(current, allTemplates, changeTemplates, given) : [];

  const menuGroups = [
    ...templateGroups,
    {
      items: editing
        ? [
            { label: saving ? "Saving…" : "Save changes", onSelect: save, disabled: !dirty || saving },
            { label: "Discard changes", onSelect: discard },
          ]
        : [{ label: "Edit", onSelect: startEdit }],
    },
    {
      items: embedded
        ? [{ label: "Open as its own card", onSelect: () => openStatblock(statblock) }]
        : [
            { label: "Minimize", onSelect: () => minimize(id), note: editing ? "keeps your edits" : undefined },
            { label: "Standard size", onSelect: toStandardSize },
            { label: "Close", onSelect: close, danger: dirty },
          ],
    },
  ];

  return (
    <div className={`h-full overflow-y-auto ${embedded ? "" : "bg-[#1c120b] p-2"}`} onContextMenu={onContextMenu}>
      <ParchmentSheet>
        {/* header — scrolls with the card; edit / save / discard live in the right-click menu */}
        <div className="mb-3">
          {editing ? (
            <InkText value={adapter.edits.name.get(current)} onChange={(e) => setDraft(adapter.edits.name.set(current, e.target.value))} aria-label="Name" className="h-9 w-full max-w-sm text-2xl" />
          ) : (
            <h2 className="text-2xl tracking-wide">{view.name}</h2>
          )}
          <p className={`text-[13px] italic ${INK.faded}`}>
            {view.subtitle}
            <span className={`ml-2 ${INK.faint}`}>· right-click to {editing ? "save or discard" : "edit"}</span>
          </p>
          {attached.length > 0 && (
            <p className={`text-[13px] italic ${INK.rubric}`}>
              with{" "}
              {attached.map((a, i) => (
                <span key={a.id} className={a.on ? "" : `line-through ${INK.faint}`} title={`${a.on ? "On" : "Switched off"}${a.group ? ` · from ${a.group}` : ""}`}>
                  {a.template?.name || "a deleted template"}
                  {i < attached.length - 1 ? " · " : ""}
                </span>
              ))}
              {editing && <span className={INK.faint}> — shown here without them while you edit</span>}
            </p>
          )}
          {editing && (
            <p className={`text-[13px] italic ${INK.rubric}`}>
              {kind === "encounter" ? "Editing this encounter's copy only — the shelf and the catalogue are not touched." : view.editingNote}
              {dirty ? " Unsaved changes." : ""}
            </p>
          )}
          {saving && <p className={`text-[13px] italic ${INK.faded}`}>Saving…</p>}
          {problem && <p className={`text-[13px] italic ${INK.rubric}`}>Couldn't save — {problem}.</p>}
        </div>

        <Statblock
          view={view}
          raw={current}
          editing={editing}
          edits={adapter.edits}
          actions={adapter.actions}
          RowEditor={adapter.RowEditor}
          addKinds={adapter.addKinds}
          onChange={setDraft}
          onUse={use}
          onView={viewCatalogue}
        />
      </ParchmentSheet>

      {menu && <ParchmentMenu x={menu.x} y={menu.y} title={view.name} subtitle={editing ? (dirty ? "editing · unsaved changes" : "editing") : undefined} groups={menuGroups} onClose={() => setMenu(null)} />}
    </div>
  );
}