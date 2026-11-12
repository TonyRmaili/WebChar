import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../store/AuthStore";
import useCharStore from "../../store/CharStore";
import useMinionStore from "../../store/MinionStore";

import HealthPlay from "./sheet/play/HealthPlay";
import ActionsCharges from "./sheet/play/ActionsCharges";
import MinionsPlay from "./sheet/minions/MinionsPlay";

import SplitPanels, { RAIL_BTN, RAIL_DIVIDER } from "./sheet/SplitPanels";
import PlaySection from "./sheet/PlaySection";
import PartyBar from "./sheet/PartyBar";
import { DEFINE_TABS, DEFAULT_DEFINE_TAB, findDefineTab } from "./sheet/defineTabs";
import { ViewSwitch, WithViewRail } from "./ViewSwitch";
import { INK, InkButton, ParchmentSheet } from "../../styles/parchment";

/* Characters › Sheets: the active characters, one open at a time.

   Characters are found by their database id. The open one lives in
   CharStore (memory only): it is fetched from the server when you pick
   it, and every change is saved back from there. */

const TAB_KEY = "sheet.defineTab";

const readTab = () => {
  try {
    return localStorage.getItem(TAB_KEY) || DEFAULT_DEFINE_TAB;
  } catch {
    return DEFAULT_DEFINE_TAB;
  }
};

/* ---------- Define panel pieces ---------- */

function DefineTabStrip({ activeTab, onSelect }) {
  return (
    <div className="wc-desk mb-4 flex flex-wrap gap-1 rounded-xl border border-stitch/25 p-1.5 font-body">
      {DEFINE_TABS.map((t) => {
        const active = t.id === activeTab;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={`h-8 rounded-md px-3 text-[15px] transition ${
              active ? "bg-page font-semibold text-ink shadow" : "text-desk-ink-faded hover:bg-desk-deep/50 hover:text-desk-accent"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// Icon shortcuts shown in the define rail. Clicking one jumps to that
// tab and opens the panel if it was collapsed.
function DefineRailTabs({ activeTab, panelOpen, onPick }) {
  return (
    <div className={`flex flex-col items-center gap-1 ${RAIL_DIVIDER}`}>
      {DEFINE_TABS.map((t) => {
        const active = panelOpen && t.id === activeTab;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.id)}
            title={t.label}
            aria-label={t.label}
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${RAIL_BTN(active)}`}
          >
            {t.icon}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Page ---------- */

/* `onView(id)`: switch the Characters page to "create" — the switch sits in
   the Play panel's rail (or a rail of its own while there's no sheet). */
export default function Sheets({ onView }) {
  const token = useAuthStore((s) => s.token);
  const userData = useAuthStore((s) => s.userData);
  const userStatus = useAuthStore((s) => s.userStatus);
  const fetchUser = useAuthStore((s) => s.fetchUser);

  const charId = useCharStore((s) => s.charId);
  const charData = useCharStore((s) => s.charData);
  const loadError = useCharStore((s) => s.error);
  const saveError = useCharStore((s) => s.saveError);
  const clearSaveError = useCharStore((s) => s.clearSaveError);
  const loadChar = useCharStore((s) => s.loadChar);
  const restAll = useCharStore((s) => s.restAll);
  const grantExperience = useCharStore((s) => s.grantExperience);

  const loadMinions = useMinionStore((s) => s.loadMinions);
  const minionCount = useMinionStore((s) => s.minions.length);

  const navigate = useNavigate();

  const [activeCharId, setActiveCharId] = useState(null);
  const [defineTab, setDefineTabState] = useState(readTab);
  const [busy, setBusy] = useState(false);
  const [partyError, setPartyError] = useState(null);

  const setDefineTab = useCallback((id) => {
    setDefineTabState(id);
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {
      /* storage blocked: the tab still switches for this visit */
    }
  }, []);

  const activeChars = useMemo(() => (userData?.characters ?? []).filter((c) => c.active), [userData]);
  const selectedChar = useMemo(() => activeChars.find((c) => c.id === activeCharId), [activeChars, activeCharId]);
  const selectedName = selectedChar?.name ?? "";

  /* ---- guards & loading ---- */

  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  // Pick the first active character when none is chosen yet, or when the
  // chosen one is no longer active.
  useEffect(() => {
    if (activeChars.length === 0) return;
    if (!activeCharId || !selectedChar) setActiveCharId(activeChars[0].id);
  }, [activeChars, activeCharId, selectedChar]);

  // Open the chosen character (CharStore saves anything still waiting
  // for the previous one first).
  useEffect(() => {
    if (token && activeCharId) loadChar(activeCharId);
  }, [token, activeCharId, loadChar]);

  // Its minions. The name is only for the dice tower's Minions tab, so a
  // renamed character shows its new name there too.
  useEffect(() => {
    if (token && activeCharId) loadMinions(activeCharId, selectedName);
  }, [token, activeCharId, selectedName, loadMinions]);

  /* ---- party actions ---- */

  // Rests every active character at once.
  async function onRestAll(restType) {
    if (busy || activeChars.length === 0) return;
    setBusy(true);
    setPartyError(null);
    try {
      await restAll(restType, activeChars.map((c) => c.id));
    } catch (e) {
      setPartyError(`Couldn't rest — ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  // Sends only the signed delta. Returns true on success so the bar can
  // clear its input.
  async function onAdjustExperience(delta) {
    if (busy || !selectedChar || !delta) return false;
    setBusy(true);
    setPartyError(null);
    try {
      await grantExperience(delta);
      return true;
    } catch (e) {
      setPartyError(`Couldn't change experience — ${e.message}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  /* ---- empty states ---- */

  // No sheet to show yet: the switch gets a rail of its own, so Create is still a click away.
  const alone = (body) => (
    <div className="py-4">
      <WithViewRail view="sheets" onView={onView}>
        {body}
      </WithViewRail>
    </div>
  );

  if (!userData) {
    if (userStatus === "error") {
      return alone(
        <div className="mt-10 text-center text-sm italic text-desk-ink-faded">
          <p>Couldn't reach the server to load your characters.</p>
          <button type="button" onClick={fetchUser} className="mt-2 underline decoration-dotted underline-offset-4 hover:text-desk-accent">
            try again
          </button>
        </div>
      );
    }
    return alone(<p className="mt-10 text-center text-sm italic text-desk-ink-faded">Loading characters…</p>);
  }

  if (activeChars.length === 0) {
    return alone(
      <div className="mx-auto mt-10 max-w-md">
        <ParchmentSheet>
          <div className="text-center">
            <h2 className="text-xl tracking-wide">No active characters</h2>
            <p className="mt-2 text-sm italic text-ink-faded">Create a character, or mark one as active, and its sheet will show up here.</p>
          </div>
        </ParchmentSheet>
      </div>,
    );
  }

  /* ---- panels ---- */

  // The sheet is shown once the chosen character has arrived from the server.
  const ready = !!charData && charId === activeCharId;

  const activeDefineTab = findDefineTab(defineTab);
  const ActiveDefine = activeDefineTab.Component;
  const waiting = (
    <p className="text-sm italic text-ink-faded">
      {loadError && charId === activeCharId ? (
        <>
          Couldn't load the character — {loadError}.{" "}
          <InkButton onClick={() => loadChar(activeCharId)}>try again</InkButton>
        </>
      ) : (
        "Loading character…"
      )}
    </p>
  );
  const hasMinions = minionCount > 0;

  // The Play panel is one parchment sheet; its sections are headings on it.
  const playContent = (
    <ParchmentSheet>
      {!ready ? (
        waiting
      ) : (
        <div className="space-y-6">
          <PlaySection title="Health" storageKey="sheet.play.health">
            <HealthPlay />
          </PlaySection>

          <PlaySection title="Actions & Charges" storageKey="sheet.play.charges">
            <ActionsCharges />
          </PlaySection>

          <PlaySection title="Minions" storageKey="sheet.play.minions" empty={hasMinions ? null : "No minions yet. Add them in the Minions tab."}>
            <MinionsPlay />
          </PlaySection>
        </div>
      )}
    </ParchmentSheet>
  );

  const defineContent = (
    <div>
      <DefineTabStrip activeTab={defineTab} onSelect={setDefineTab} />
      {/* Tabs draw their own parchment sheet (bare: true); anything else gets one. */}
      {ready && activeDefineTab.bare ? <ActiveDefine /> : <ParchmentSheet>{ready ? <ActiveDefine /> : waiting}</ParchmentSheet>}
    </div>
  );

  // Problems worth showing above the sheet: a save that failed, or a party action.
  const problem = (saveError && `Couldn't save ${selectedName || "the character"} — ${saveError}. The saved version is shown again.`) || partyError;

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4 py-4">
      <PartyBar characters={activeChars} activeId={activeCharId} onSelect={setActiveCharId} onRest={onRestAll} onExperience={onAdjustExperience} busy={busy} />

      {problem && (
        <ParchmentSheet>
          <p className={`flex flex-wrap items-baseline gap-x-3 text-sm italic ${INK.rubric}`} role="alert">
            {problem}
            <InkButton
              onClick={() => {
                clearSaveError();
                setPartyError(null);
              }}
            >
              dismiss
            </InkButton>
          </p>
        </ParchmentSheet>
      )}

      <SplitPanels
        storageKey="sheet.split"
        left={{ label: "Play", content: playContent, rail: () => <ViewSwitch view="sheets" onView={onView} /> }}
        right={{
          label: "Define",
          content: defineContent,
          rail: ({ open, openPanel }) => (
            <DefineRailTabs
              activeTab={defineTab}
              panelOpen={open}
              onPick={(id) => {
                setDefineTab(id);
                openPanel();
              }}
            />
          ),
        }}
      />
    </div>
  );
}