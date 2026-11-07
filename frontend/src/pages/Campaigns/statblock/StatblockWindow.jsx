import React, { useEffect, useMemo, useState } from "react";
import useCampaignStore, { copiesKey } from "../../../store/CampaignStore";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import { INK, InkText, ParchmentSheet } from "../../../styles/parchment";
import ParchmentMenu from "../../../styles/ParchmentMenu";
import Statblock from "./Statblock";
import useStatblockDrafts from "./statblockDrafts";
import CharacterRowEditor from "./characterRowEditor";
import MonsterRowEditor from "./monsterRowEditor";
import { CHARACTER_ACTIONS, CHARACTER_ADD_KINDS, CHARACTER_EDITS, characterView } from "./characterStatblock";
import { MONSTER_ACTIONS, MONSTER_ADD_KINDS, MONSTER_EDITS, monsterView } from "./monsterStatblock";

/* ═══════════════════════════════════════════════════════════════════
   StatblockWindow — a campaign copy's statblock as one of the app's card
   windows (registered as popup type "statblock"), so it can be moved,
   resized, minimized to the footer, and kept open while you use the page.

   Window data is only a reference: { name, campaignName, kind, file }.
   The creature itself is read from the campaign store (fetched if it
   isn't loaded), so a minimized card in the footer never goes stale.
   `kind` picks the adapter: party / npc → a character, monster → a
   catalogue monster. Both draw with the same Statblock.

   Reading by default; using a dot (charges, slots) saves at once.
   Editing is only through the right-click menu (anywhere on the card):
   Edit makes a draft (kept while minimized), then Save / Discard; the
   same menu has Minimize, Standard size and Close.
   ═══════════════════════════════════════════════════════════════════ */

const asList = (v) => (Array.isArray(v) ? v : []);
const CHARACTER = { view: characterView, edits: CHARACTER_EDITS, actions: CHARACTER_ACTIONS, RowEditor: CharacterRowEditor, addKinds: CHARACTER_ADD_KINDS };
const MONSTER = { view: monsterView, edits: MONSTER_EDITS, actions: MONSTER_ACTIONS, RowEditor: MonsterRowEditor, addKinds: MONSTER_ADD_KINDS };
const ADAPTERS = { party: CHARACTER, npc: CHARACTER, monster: MONSTER };

export const statblockWindowId = (d) => `statblock__${d.campaignName}__${d.kind}__${d.file}`;

// The size the card is designed for: wide enough for two columns, nearly full height.
export const standardFrame = () => {
  const width = Math.min(1180, window.innerWidth - 32);
  const height = Math.max(420, window.innerHeight - 96);
  return { width, height, x: Math.max(16, Math.round((window.innerWidth - width) / 2)), y: 48 };
};

// Open (or bring forward) a card, placed at the standard size the first time.
export function openStatblock(data) {
  const store = usePopupStore.getState();
  const id = statblockWindowId(data);
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

export default function StatblockWindow({ statblock }) {
  const { campaignName, kind, file } = statblock;
  const id = statblockWindowId(statblock);
  const adapter = ADAPTERS[kind] || CHARACTER;

  const entry = useCampaignStore((s) => asList(s.campaignCharacters[copiesKey(campaignName, kind)]).find((c) => c.file === file));
  const fetchCampaignCharacters = useCampaignStore((s) => s.fetchCampaignCharacters);
  const saveCampaignCharacter = useCampaignStore((s) => s.saveCampaignCharacter);

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
    if (entry) return;
    fetchCampaignCharacters(campaignName, kind).then((res) => {
      if (!res.ok) return setLoadProblem(res.message);
      const found = asList(useCampaignStore.getState().campaignCharacters[copiesKey(campaignName, kind)]).some((c) => c.file === file);
      setLoadProblem(found ? null : "it isn't in this campaign any more");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignName, kind, file]);

  const raw = entry?.data;
  const editing = draft !== null;
  const current = draft ?? raw;
  const view = useMemo(() => (current ? adapter.view(current, { editing }) : null), [adapter, current, editing]);
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
    const res = await saveCampaignCharacter(campaignName, kind, file, draft);
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
    const res = await saveCampaignCharacter(campaignName, kind, file, next);
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

  const menuGroups = [
    {
      items: editing
        ? [
            { label: saving ? "Saving…" : "Save changes", onSelect: save, disabled: !dirty || saving },
            { label: "Discard changes", onSelect: discard },
          ]
        : [{ label: "Edit", onSelect: startEdit }],
    },
    {
      items: [
        { label: "Minimize", onSelect: () => minimize(id), note: editing ? "keeps your edits" : undefined },
        { label: "Standard size", onSelect: toStandardSize },
        { label: "Close", onSelect: close, danger: dirty },
      ],
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#1c120b] p-2" onContextMenu={onContextMenu}>
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
          {editing && (
            <p className={`text-[13px] italic ${INK.rubric}`}>
              {view.editingNote}
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