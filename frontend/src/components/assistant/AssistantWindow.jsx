import React, { useEffect } from "react";
import { usePopupStore } from "../../store/PopupStore";
import { useAssistantStore } from "../../store/AssistantStore";
import { InkSelect } from "../../styles/parchment";
import { ghostBtn } from "../../styles/parchmentForm";
import AssistantChat from "./AssistantChat";

/* ═══════════════════════════════════════════════════════════════════
   AssistantWindow — the assistant as a card window (popup type
   "assistant"; there is only one), opened from the footer on any page.
   Like the dice tower it's a footer window: its button, ×, or a
   right-click puts it away, and it keeps everything (AssistantStore),
   even an answer still being written.

   At the top: which campaign it's on, or none. A campaign brings its
   notes (searched for each question), its ticked prompts and saving into
   its Files; without one it's a plain D&D assistant with your own
   instructions (Settings → AI). When the Campaigns page has another
   campaign open, it offers to switch — it never switches by itself.
   ═══════════════════════════════════════════════════════════════════ */

export const ASSISTANT_WINDOW = "assistant";
export const assistantWindowId = () => ASSISTANT_WINDOW;

export function openAssistant() {
  const store = usePopupStore.getState();
  const known = store.openPopups.some((p) => p.id === ASSISTANT_WINDOW) || store.minimized.some((p) => p.id === ASSISTANT_WINDOW);
  store.open("assistant", { name: "Assistant" });
  if (!known) {
    const width = Math.min(760, window.innerWidth - 32);
    const height = Math.max(480, window.innerHeight - 120);
    usePopupStore.getState().resize(ASSISTANT_WINDOW, width, height);
    usePopupStore.getState().move(ASSISTANT_WINDOW, Math.max(16, window.innerWidth - width - 24), 56);
  }
}

// The footer's Assistant button: open it, bring it to the front, or — when
// it's already in front — put it away (minimized; it isn't in the deck).
export function toggleAssistant() {
  const store = usePopupStore.getState();
  const open = store.openPopups.find((p) => p.id === ASSISTANT_WINDOW);
  if (!open) return openAssistant();
  const onTop = store.openPopups.every((p) => p.id === ASSISTANT_WINDOW || (p.zIndex ?? 0) < (open.zIndex ?? 0));
  if (onTop) store.minimize(ASSISTANT_WINDOW);
  else store.focus(ASSISTANT_WINDOW);
}

function CampaignPicker() {
  const campaign = useAssistantStore((s) => s.campaign);
  const campaigns = useAssistantStore((s) => s.campaigns);
  const pageCampaign = useAssistantStore((s) => s.pageCampaign);
  const busy = useAssistantStore((s) => s.busy.words || s.busy.pictures);
  const { pick, refreshSettings } = useAssistantStore.getState();
  const offer = pageCampaign && pageCampaign !== campaign && !busy;

  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule/40 pb-2">
      <h2 className="text-xl tracking-wide">Assistant</h2>
      <label className="flex items-baseline gap-2 text-sm italic text-ink-faded">
        for
        <InkSelect
          value={campaign}
          disabled={busy}
          onMouseDown={() => refreshSettings()} // a campaign made a moment ago is in the list
          onChange={(e) => pick(e.target.value)}
          title={busy ? "Wait for the answer before switching" : "Which campaign's notes and prompts it uses"}
          className="not-italic"
        >
          <option value="">no campaign</option>
          {campaigns.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </InkSelect>
      </label>
      {offer && (
        <button type="button" onClick={() => pick(pageCampaign)} className={`${ghostBtn} ml-auto`} title="Switch the assistant to the campaign the page shows">
          you're looking at {pageCampaign} · use it
        </button>
      )}
    </div>
  );
}

export default function AssistantWindow() {
  const ready = useAssistantStore((s) => s.ready);
  const problem = useAssistantStore((s) => s.problem);
  const { load, clearProblem } = useAssistantStore.getState();

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="wc-page flex h-full flex-col px-5 py-4">
      {problem && (
        <p className="mb-2 text-sm italic text-bad">
          {problem}{" "}
          <button type="button" className={ghostBtn} onClick={ready ? clearProblem : load}>
            {ready ? "ok" : "try again"}
          </button>
        </p>
      )}
      {ready && (
        <>
          <CampaignPicker />
          <AssistantChat />
        </>
      )}
      {!ready && !problem && <p className="text-sm italic text-ink-faded">Opening the assistant…</p>}
    </div>
  );
}
