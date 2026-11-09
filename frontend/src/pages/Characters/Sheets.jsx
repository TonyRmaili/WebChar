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
import { ParchmentSheet } from "../../styles/parchment";

const API = "http://localhost:8000";
const TAB_KEY = "sheet.defineTab";

const charId = (c) => c.id || c._id || c.name;

const isActiveChar = (c) => c?.active === true || c?.is_active === true || c?.status === "active";

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
  const fetchChar = useCharStore((s) => s.fetchChar);
  const loadMinions = useMinionStore((s) => s.loadMinions);
  const minionCount = useMinionStore((s) => s.minions.length);

  const navigate = useNavigate();

  const [activeCharId, setActiveCharId] = useState(null);
  const [defineTab, setDefineTabState] = useState(readTab);
  const [busy, setBusy] = useState(false);

  const setDefineTab = useCallback((id) => {
    setDefineTabState(id);
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {
      /* storage blocked: the tab still switches for this visit */
    }
  }, []);

  const activeChars = useMemo(() => (userData?.characters ?? []).filter(isActiveChar), [userData]);

  const selectedChar = useMemo(() => activeChars.find((c) => charId(c) === activeCharId), [activeChars, activeCharId]);

  /* ---- guards & loading ---- */

  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  // Pick the first active character when none is chosen yet, or when the
  // chosen one is no longer active.
  useEffect(() => {
    if (activeChars.length === 0) return;
    if (!activeCharId || !selectedChar) setActiveCharId(charId(activeChars[0]));
  }, [activeChars, activeCharId, selectedChar]);

  useEffect(() => {
    if (!token || !activeCharId) return;
    (async () => {
      await fetchChar(activeCharId);
      const charData = useCharStore.getState().charData;
      if (charData?.name) await loadMinions(charData.name);
    })();
  }, [token, activeCharId, fetchChar, loadMinions]);

  /* ---- party actions ---- */
  // TODO (store pass): move these two calls into a store like the newer
  // catalogue actions, instead of calling fetch from the page.

  const post = async (path, body) => {
    const authToken = token || localStorage.getItem("token");
    if (!authToken) throw new Error("Token not found");

    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`Failed: ${res.status} ${payload ? JSON.stringify(payload) : ""}`);
    }
    return payload;
  };

  // Rests every active character at once.
  async function onRestAll(rest_type) {
    if (busy || activeChars.length === 0) return;
    setBusy(true);
    try {
      await post("/combat/rest_all", { rest_type, characters: activeChars });
      if (activeCharId) await fetchChar(activeCharId);
    } catch (e) {
      console.error("rest error:", e.message);
    } finally {
      setBusy(false);
    }
  }

  // Sends only the signed delta. Returns true on success so the bar can
  // clear its input.
  async function onAdjustExperience(delta) {
    if (busy || !selectedChar || !delta) return false;
    setBusy(true);
    try {
      await post("/combat/experience", { delta });
      if (activeCharId) await fetchChar(activeCharId);
      return true;
    } catch (e) {
      console.error("experience error:", e.message);
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

  const activeDefineTab = findDefineTab(defineTab);
  const ActiveDefine = activeDefineTab.Component;
  const waiting = <p className="text-sm italic text-ink-faded">Loading character…</p>;
  const hasMinions = minionCount > 0;

  // The Play panel is one parchment sheet; its sections are headings on it.
  const playContent = (
    <ParchmentSheet>
      {!selectedChar ? (
        waiting
      ) : (
        <div className="space-y-6">
          <PlaySection title="Health" storageKey="sheet.play.health">
            <HealthPlay id={activeCharId} />
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
      {selectedChar && activeDefineTab.bare ? <ActiveDefine /> : <ParchmentSheet>{selectedChar ? <ActiveDefine /> : waiting}</ParchmentSheet>}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4 py-4">
      <PartyBar characters={activeChars} activeId={activeCharId} onSelect={setActiveCharId} onRest={onRestAll} onExperience={onAdjustExperience} busy={busy} />

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