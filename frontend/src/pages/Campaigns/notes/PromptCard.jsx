import React, { useCallback, useEffect, useRef, useState } from "react";
import useCampaignStore from "../../../store/CampaignStore";
import { fetchPrompt, pendingSaveOf, savePrompt, setPendingSave } from "./notesApi";

/* ═══════════════════════════════════════════════════════════════════
   PromptCard — an assistant prompt as a card (popup type "prompt"; data
   { name, path, campaignName }, see fileCards.js). Prompts are plain
   text, instructions for the DM Assistant, so they stay a lined page.
   Saved a second after you stop typing and when the card closes.
   ═══════════════════════════════════════════════════════════════════ */

const SAVE_AFTER = 1000;
const STATUS_WORDS = { saved: "Saved", unsaved: "Not saved yet", saving: "Saving…" };

export default function PromptCard({ prompt: ref }) {
  const { path } = ref;
  const [text, setText] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("saved");
  const latest = useRef("");
  const dirty = useRef(false);
  const timer = useRef(null);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    let live = true;
    fetchPrompt(path).then((r) => {
      if (!live) return;
      if (r.ok) {
        latest.current = r.content;
        setText(r.content);
      } else setError(r.message);
    });
    return () => {
      live = false;
    };
  }, [path]);

  const saveNow = useCallback(() => {
    clearTimeout(timer.current);
    if (!dirty.current) return queue.current;
    dirty.current = false;
    setPendingSave(path, null);
    const content = latest.current;
    setStatus("saving");
    queue.current = queue.current.then(async () => {
      const r = await savePrompt(path, content);
      if (r.ok) {
        // The assistant reads prompts from the tree, so it gets the new text too.
        useCampaignStore.getState().patchPrompt(path, content);
        setError(null);
        setStatus(dirty.current ? "unsaved" : "saved");
      } else {
        dirty.current = true;
        setPendingSave(path, saveNow);
        setError(`Not saved: ${r.message}`);
        setStatus("unsaved");
      }
    });
    return queue.current;
  }, [path]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pendingSaveOf(path) === saveNow) saveNow();
    },
    [path, saveNow],
  );

  const change = (value) => {
    setText(value);
    latest.current = value;
    dirty.current = true;
    setPendingSave(path, saveNow);
    setStatus("unsaved");
    clearTimeout(timer.current);
    timer.current = setTimeout(saveNow, SAVE_AFTER);
  };

  return (
    <div className="wc-page flex h-full flex-col !rounded-none" onContextMenu={(e) => e.stopPropagation()}>
      <div className="flex shrink-0 items-center gap-2 border-b border-rule/40 px-3 py-1 text-xs italic">
        <span className="flex-1 text-ink-faded">Instructions for the DM Assistant, sent with every question while ticked.</span>
        <span className="text-ink-faint">{text === null ? "" : STATUS_WORDS[status]}</span>
      </div>
      {error && <div className="shrink-0 border-b border-rule/30 px-3 py-1 text-xs italic text-bad">{error}</div>}
      {text === null ? (
        !error && <div className="p-4 text-sm italic text-ink-faded">Opening the prompt…</div>
      ) : (
        <textarea
          className="wc-lined min-h-0 w-full flex-1 resize-none border-0 bg-transparent px-4 py-1 font-body text-[15px] leading-7 text-ink outline-none focus:ring-0"
          value={text}
          onChange={(e) => change(e.target.value)}
          spellCheck
        />
      )}
    </div>
  );
}
