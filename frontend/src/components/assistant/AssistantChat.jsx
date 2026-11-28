import React, { useEffect, useRef, useState } from "react";
import useCampaignStore from "../../store/CampaignStore";
import { useAssistantStore } from "../../store/AssistantStore";
import { useAiStore } from "../../store/AiStore";
import SaveToModal from "../../pages/Campaigns/SaveToModal";
import TokenMeter from "../TokenMeter";
import { fetchFilesTree, useImageUrl } from "../../pages/Campaigns/notes/notesApi";
import { openCampaignFile } from "../../pages/Campaigns/notes/fileCards";
import { chipBtn, ghostBtn } from "../../styles/parchmentForm";
import { textareaCls } from "../../pages/Catalogues/catalogueStyle";
import { pictureUrl, savePicture } from "./assistantApi";

/* ═══════════════════════════════════════════════════════════════════
   AssistantChat — the chat in the footer's Assistant window. Its state
   (messages, drafts, the answer streaming in) lives in AssistantStore.

   Two chats, like two tabs, switched under the box ("make: Words |
   Pictures"):
     words     asks the assistant (with a campaign: its ticked prompts, and
               its notes are searched for each question)
     pictures  sends the words straight to the image model; nothing else
               goes with them, so you always know what it painted from

   Under each answer: edit (what the model remembers from then on), copy,
   and with a campaign quick save / save to… (as a note or a picture in its
   Files). Without a campaign a picture's "save" puts it in your pictures.
   ═══════════════════════════════════════════════════════════════════ */

const sendBtn =
  "rounded-md border border-rubric/60 px-4 py-1 text-sm text-rubric transition hover:bg-rubric hover:text-page-light disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-rubric";
const noteBtn = `${ghostBtn} disabled:cursor-default`;
const COPIED_FOR = 1500; // ms

const MODES = [
  { id: "words", label: "Words", hint: "Ask your assistant… (Enter to send, Shift+Enter for a new line)", send: "Send", busy: "Thinking…" },
  { id: "pictures", label: "Pictures", hint: "Describe the picture… (Enter to paint, Shift+Enter for a new line)", send: "Paint", busy: "Painting… a picture can take a minute" },
];

function slugifyResponse(content, maxLen = 50) {
  const firstLine = content.trim().split("\n", 1)[0] || "";
  const noLinks = firstLine.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const noMarkers = noLinks.replace(/[*_`#>\-]+/g, " ");
  const noPunct = noMarkers.replace(/[^a-zA-Z0-9\s]+/g, " ");
  const slug = noPunct.trim().replace(/\s+/g, "-").toLowerCase();
  return slug.slice(0, maxLen) || "response";
}

// A picture in the chat: fetched with the login like the notes' pictures.
function ChatPicture({ campaign, file, prompt }) {
  const { src, error } = useImageUrl(pictureUrl(campaign, file));
  if (!src) return <div className="py-6 text-sm italic text-ink-faded">{error || "Loading the picture…"}</div>;
  return (
    <a href={src} target="_blank" rel="noreferrer" title="Open it full size in a new tab">
      <img src={src} alt={prompt} className="max-h-[420px] max-w-full rounded-sm shadow" />
    </a>
  );
}

// Under an answer: the notes it read, closest first; click one to open it.
// The number is how close in meaning the note was (0 to 1); "words" means
// it also had the question's words in it.
function NoteSources({ msg, campaign }) {
  if (msg.notes === "failed") {
    return (
      <div className="mt-1 text-[11px] italic text-warn">
        answered without your notes: the notes search didn't work this time{msg.search_error ? ` (${msg.search_error})` : ""}
      </div>
    );
  }
  const sources = msg.sources || [];
  if (!sources.length) return null;
  return (
    <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[11px] italic text-ink-faded">
      <span>{msg.notes === "all" ? "read all your notes:" : "from your notes:"}</span>
      {sources.map((s) => (
        <button
          key={s.path}
          type="button"
          onClick={() => openCampaignFile({ kind: "note", name: s.path.split(/[/\\]/).pop(), path: s.path }, campaign)}
          title={[
            s.sections?.length ? `Sections: ${s.sections.join(", ")}` : null,
            s.score != null ? `Match ${s.score.toFixed(2)} (how close in meaning, 0 to 1)` : null,
            s.words ? "Had words from your question" : null,
            "Click to open the note",
          ]
            .filter(Boolean)
            .join("\n")}
          className="not-italic text-info underline decoration-dotted underline-offset-4 hover:text-rubric"
        >
          {s.note}
          {s.score != null && <span className="ml-1 text-ink-faint">{s.score.toFixed(2)}</span>}
        </button>
      ))}
    </div>
  );
}

export default function AssistantChat() {
  const campaign = useAssistantStore((s) => s.campaign);
  const chatFor = useAssistantStore((s) => s.chatFor);
  const chats = useAssistantStore((s) => s.chats);
  const drafts = useAssistantStore((s) => s.drafts);
  const busy = useAssistantStore((s) => s.busy);
  const mode = useAssistantStore((s) => s.mode);
  const { setDraft, setMode, ask, paint, stop, clear, edit, markSaved } = useAssistantStore.getState();
  const saveResponse = useCampaignStore((s) => s.saveResponse);

  const MODE = MODES.find((m) => m.id === mode);
  const messages = chats[mode];
  const chatInput = drafts[mode];
  const isSending = busy[mode];
  const loaded = chatFor === campaign;

  // Today's tokens (the meter under the box); none left → no sending.
  const refreshUsage = useAiStore((s) => s.refresh);
  const usedUp = useAiStore((s) => s.usage?.left === 0);
  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  const chatLogRef = useRef(null);
  useEffect(() => {
    if (chatLogRef.current) chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
  }, [messages, isSending, mode]);

  const [editingIndex, setEditingIndex] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [copied, setCopied] = useState(null); // `${tab}:${index}` just copied
  // "saving" | "error" while a save runs or after it failed, by `${tab}:${index}`
  // (a done save is `saved: true` on the message itself, so it's kept).
  const [saveStates, setSaveStates] = useState({});
  const [saveModal, setSaveModal] = useState(null); // { index, thread, msg, tree, root }

  // Another campaign or tab: nothing half edited carries over.
  useEffect(() => {
    setEditingIndex(null);
    setEditDraft("");
    setSaveStates({});
  }, [campaign, mode]);

  const send = () => (mode === "pictures" ? paint() : ask());

  /* ---------- edit (words only) ---------- */

  const startEdit = (i, content) => {
    if (isSending) return;
    setEditingIndex(i);
    setEditDraft(content);
  };
  const cancelEdit = () => {
    setEditingIndex(null);
    setEditDraft("");
  };
  const commitEdit = (i) => {
    edit(i, editDraft);
    cancelEdit();
  };

  /* ---------- copy ---------- */

  const copy = async (i, msg) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      const key = `${mode}:${i}`;
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), COPIED_FOR);
    } catch {
      setCopied(null);
    }
  };

  /* ---------- save ---------- */

  // With a campaign an answer is saved as a note and a picture as a picture
  // file, in its Files; without one only pictures, into your pictures.
  const saveMessage = async (msg, fileName, folderPath) => {
    const campaigns = useCampaignStore.getState();
    if (!msg.image) return !!(await saveResponse(campaign, msg.content, fileName, folderPath));
    const r = await savePicture(campaign, msg.image.file, fileName, folderPath);
    if (r.ok && campaign && campaigns.currentCampaignName === campaign) await campaigns.refreshCampaignData();
    return r.ok;
  };

  const nameFor = (msg) => slugifyResponse(msg.image ? msg.image.prompt : msg.content);

  const runSave = async (thread, i, msg, fileName, folderPath) => {
    const key = `${thread}:${i}`;
    setSaveStates((prev) => ({ ...prev, [key]: "saving" }));
    const ok = await saveMessage(msg, fileName, folderPath);
    setSaveStates((prev) => {
      const next = { ...prev };
      if (ok) delete next[key];
      else next[key] = "error";
      return next;
    });
    if (ok) markSaved(thread, i);
  };

  const openSaveModal = async (i, msg) => {
    const key = `${mode}:${i}`;
    const tree = await fetchFilesTree(campaign); // this campaign's Files, as they are now
    if (!tree.ok) return setSaveStates((prev) => ({ ...prev, [key]: "error" }));
    setSaveModal({ index: i, thread: mode, msg, tree: tree.children, root: tree.root });
  };

  const saveFromModal = async (fileName, folderPath) => {
    if (!saveModal) return;
    const { index, thread, msg } = saveModal;
    setSaveModal(null);
    await runSave(thread, index, msg, fileName, folderPath);
  };

  /* ---------- render ---------- */

  const emptyText = !loaded
    ? "Opening the chat…"
    : mode === "pictures"
      ? `Describe a picture below and it gets painted. Only your words go to the painter.${campaign ? "" : " Saved pictures go in your pictures."}`
      : campaign
        ? `Ask anything about ${campaign}. Its notes are searched for each question. Pictures are painted in the Pictures tab below.`
        : "Ask anything about D&D. No campaign is picked, so no notes are read: pick one above to use its notes and prompts.";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Message log */}
      <div ref={chatLogRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 && !isSending ? (
          <p className="text-sm italic text-ink-faded">{emptyText}</p>
        ) : (
          <>
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              const isEditing = editingIndex === i;
              const key = `${mode}:${i}`;
              const saveState = saveStates[key] || (msg.saved ? "saved" : undefined);
              const saveDisabled = saveState === "saving" || saveState === "saved";
              const saveWord = saveState === "saving" ? "saving…" : saveState === "saved" ? "✓ saved" : saveState === "error" ? "failed" : null;
              const saveInk = saveState === "saved" ? "!text-good !no-underline" : saveState === "error" ? "!text-bad" : "";

              return (
                <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap text-[15px] leading-relaxed ${
                      isUser ? "rounded-sm border-r-2 border-rubric/50 bg-ink/[0.05] px-3 py-2 italic text-ink" : "border-l border-rule/40 pl-3 text-ink"
                    }`}
                  >
                    {msg.picture && <div className="mb-0.5 text-[11px] not-italic text-ink-faded">picture of</div>}
                    {msg.image ? (
                      <ChatPicture campaign={campaign} file={msg.image.file} prompt={msg.image.prompt} />
                    ) : (
                      <div
                        contentEditable={isEditing}
                        suppressContentEditableWarning
                        ref={(el) => {
                          if (isEditing && el && document.activeElement !== el) {
                            el.focus();
                            const range = document.createRange();
                            range.selectNodeContents(el);
                            range.collapse(false);
                            const sel = window.getSelection();
                            sel.removeAllRanges();
                            sel.addRange(range);
                          }
                        }}
                        onBlur={(e) => isEditing && setEditDraft(e.currentTarget.innerText)}
                        onInput={(e) => setEditDraft(e.currentTarget.innerText)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                        className={`outline-none ${isEditing ? "-mx-1 rounded-sm bg-page-light/60 px-1 ring-1 ring-rubric/40" : ""} ${msg.failed ? "italic text-bad" : ""}`}
                      >
                        {msg.content}
                      </div>
                    )}
                    {msg.streaming && !msg.content && <div className="italic text-ink-faded">Thinking…</div>}
                    {msg.stopped && <div className="mt-1 text-[11px] italic text-warn">{msg.stopped === "stopped" ? "— stopped here" : `— ${msg.stopped}`}</div>}
                    {!isUser && !msg.failed && campaign && <NoteSources msg={msg} campaign={campaign} />}

                    {!isUser && !msg.failed && !msg.streaming && (
                      <div className="mt-1.5 flex items-baseline justify-end gap-4 border-t border-dotted border-rule/30 pt-1">
                        {msg.edited && <span className="mr-auto text-[11px] italic text-ink-faded">edited</span>}

                        {isEditing ? (
                          <>
                            <button onClick={cancelEdit} className={noteBtn}>
                              cancel
                            </button>
                            <button onClick={() => commitEdit(i)} className={`${noteBtn} !text-rubric`}>
                              done
                            </button>
                          </>
                        ) : (
                          <>
                            {!msg.image && (
                              <>
                                <button onClick={() => startEdit(i, msg.content)} disabled={isSending} className={noteBtn} title="Change the answer: the assistant remembers it as you leave it">
                                  edit
                                </button>
                                <button onClick={() => copy(i, msg)} className={`${noteBtn} ${copied === key ? "!text-good !no-underline" : ""}`} title="Copy this answer">
                                  {copied === key ? "✓ copied" : "copy"}
                                </button>
                              </>
                            )}
                            {campaign ? (
                              <>
                                <button
                                  onClick={() => runSave(mode, i, msg, nameFor(msg), "")}
                                  disabled={saveDisabled}
                                  className={noteBtn}
                                  title={msg.image ? `Save the picture at the top of ${campaign}'s files` : `Save as a note at the top of ${campaign}'s files`}
                                >
                                  quick save
                                </button>
                                <button onClick={() => openSaveModal(i, msg)} disabled={saveDisabled} className={`${noteBtn} ${saveInk}`} title="Save to a folder…">
                                  {saveWord || "save to…"}
                                </button>
                              </>
                            ) : (
                              msg.image && (
                                <button onClick={() => runSave(mode, i, msg, nameFor(msg), "")} disabled={saveDisabled} className={`${noteBtn} ${saveInk}`} title="Save it in your pictures">
                                  {saveWord || "save"}
                                </button>
                              )
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isSending && mode === "pictures" && (
              <div className="flex justify-start">
                <div className="border-l border-rule/40 pl-3 text-sm italic text-ink-faded">{MODE.busy}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input area */}
      <div className="mt-3 border-t border-rule/40 pt-3">
        <textarea
          value={chatInput}
          onChange={(e) => setDraft(mode, e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a new line. (Not while an input
            // method is still putting a character together, e.g. for Japanese.)
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          disabled={!loaded}
          rows={4}
          placeholder={MODE.hint}
          className={`${textareaCls} resize-none`}
        />

        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <TokenMeter />
          {messages.length > 0 && (
            <button onClick={() => clear(mode)} disabled={isSending} className={noteBtn} title={`Empty the ${MODE.label.toLowerCase()} chat`}>
              clear
            </button>
          )}
          <span className="ml-auto flex items-baseline gap-2 text-xs italic text-ink-faded" role="radiogroup" aria-label="What to make">
            make:
            {MODES.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} onClick={() => setMode(m.id)} className={chipBtn(mode === m.id)}>
                {m.label}
                {busy[m.id] && m.id !== mode && <span title={m.busy}> …</span>}
              </button>
            ))}
          </span>
          {isSending && mode === "words" ? (
            <button onClick={stop} className={sendBtn} title="Stop the answer here (what's written so far stays)">
              Stop
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!loaded || !chatInput.trim() || isSending || usedUp}
              title={usedUp ? "Today's AI tokens are used up (Settings → AI & API keys)" : undefined}
              className={sendBtn}
            >
              {isSending ? "…" : MODE.send}
            </button>
          )}
        </div>
      </div>

      {/* The dialog is drawn over everything (a portal), but its clicks still
          reach this window: a right-click in it mustn't put the window away. */}
      <div onContextMenu={(e) => e.stopPropagation()}>
        {saveModal && (
          <SaveToModal
            initialName={nameFor(saveModal.msg)}
            title={saveModal.msg.image ? "Save picture" : undefined}
            hint={saveModal.msg.image ? `Saved as a picture in ${campaign}'s files` : `Saved as a note in ${campaign}'s files`}
            tree={saveModal.tree}
            rootPath={saveModal.root}
            onConfirm={saveFromModal}
            onClose={() => setSaveModal(null)}
          />
        )}
      </div>
    </div>
  );
}
