import React, { useEffect, useRef, useState } from "react";
import useCampaignStore from "../../store/CampaignStore";
import SaveToModal from "./SaveToModal";
import { ParchmentSheet } from "../../styles/parchment";
import { ghostBtn } from "../../styles/parchmentForm";
import { textareaCls } from "../Catalogues/catalogueStyle";

// The rubric-edged button (Send), like Save in the create windows.
const sendBtn =
  "rounded-md border border-rubric/60 px-4 py-1 text-sm text-rubric transition hover:bg-rubric hover:text-page-light disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-rubric";
// The small notes under an answer (edit · quick save · save).
const noteBtn = `${ghostBtn} disabled:cursor-default`;

function slugifyResponse(content, maxLen = 50) {
  const firstLine = content.trim().split("\n", 1)[0] || "";
  const noLinks = firstLine.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const noMarkers = noLinks.replace(/[*_`#>\-]+/g, " ");
  const noPunct = noMarkers.replace(/[^a-zA-Z0-9\s]+/g, " ");
  const slug = noPunct.trim().replace(/\s+/g, "-").toLowerCase();
  return slug.slice(0, maxLen) || "response";
}

function DMAssistant({ campaignName }) {
  const sendChat = useCampaignStore((s) => s.sendChat);
  const saveResponse = useCampaignStore((s) => s.saveResponse);
  const campaignData = useCampaignStore((s) => s.campaignData);

  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatLogRef = useRef(null);

  const [editingIndex, setEditingIndex] = useState(null);
  const [editDraft, setEditDraft] = useState("");

  const [savedMessages, setSavedMessages] = useState({});
  // { [idx]: "saving" | "saved" | "error" }
  const [saveModal, setSaveModal] = useState(null);
  // { index, content }

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  /* ---------- send ---------- */

  const handleSendChat = async () => {
    if (!chatInput.trim() || isSending) return;

    const userMessage = { role: "user", content: chatInput };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setChatInput("");
    setIsSending(true);

    try {
      const instructions = useCampaignStore.getState().getActivePromptText();
      const data = await sendChat(nextMessages, instructions, campaignName);
      if (data) {
        setMessages((prev) => [...prev, { role: "assistant", content: data }]);
      }
    } finally {
      setIsSending(false);
    }
  };

  /* ---------- edit ---------- */

  const handleStartEdit = (i, content) => {
    if (isSending) return;
    setEditingIndex(i);
    setEditDraft(content);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditDraft("");
  };

  const handleCommitEdit = (i) => {
    setMessages((prev) =>
      prev.map((m, idx) =>
        idx === i ? { ...m, content: editDraft, edited: true } : m,
      ),
    );
    setSavedMessages((prev) => {
      if (prev[i] !== "saved") return prev;
      const next = { ...prev };
      delete next[i];
      return next;
    });
    setEditingIndex(null);
    setEditDraft("");
  };

  /* ---------- save ---------- */

  const handleQuickSave = async (i, content) => {
    setSavedMessages((prev) => ({ ...prev, [i]: "saving" }));
    const name = slugifyResponse(content);
    const res = await saveResponse(campaignName, content, name, "");
    setSavedMessages((prev) => ({ ...prev, [i]: res ? "saved" : "error" }));
  };

  const handleOpenSaveModal = (i, content) => {
    setSaveModal({ index: i, content });
  };

  const handleSaveFromModal = async (fileName, folderPath) => {
    if (!saveModal) return;
    const { index, content } = saveModal;
    setSaveModal(null);
    setSavedMessages((prev) => ({ ...prev, [index]: "saving" }));
    const res = await saveResponse(campaignName, content, fileName, folderPath);
    setSavedMessages((prev) => ({ ...prev, [index]: res ? "saved" : "error" }));
  };

  const getFilesTreeRoot = () => {
    if (campaignData.length === 0) return null;
    const firstPath = campaignData[0].path;
    return firstPath.replace(/[/\\][^/\\]+$/, "");
  };

  /* ---------- render ---------- */

  return (
    <>
      <ParchmentSheet>
        <div className="flex h-[600px] flex-col">
          {/* Message log */}
          <div ref={chatLogRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
            {messages.length === 0 && !isSending ? (
              <p className="text-sm italic text-ink-faded">Ask the DM assistant anything about your campaign.</p>
            ) : (
              <>
                {messages.map((msg, i) => {
                  const isUser = msg.role === "user";
                  const isEditing = editingIndex === i;
                  const saveState = savedMessages[i];
                  const saveDisabled = saveState === "saving" || saveState === "saved";

                  return (
                    <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] whitespace-pre-wrap text-[15px] leading-relaxed ${
                          isUser
                            ? "rounded-sm border-r-2 border-rubric/50 bg-ink/[0.05] px-3 py-2 italic text-ink"
                            : "border-l border-rule/40 pl-3 text-ink"
                        }`}
                      >
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
                          onBlur={(e) => {
                            if (isEditing) {
                              setEditDraft(e.currentTarget.innerText);
                            }
                          }}
                          onInput={(e) => setEditDraft(e.currentTarget.innerText)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.preventDefault();
                              handleCancelEdit();
                            }
                          }}
                          className={`outline-none ${isEditing ? "-mx-1 rounded-sm bg-page-light/60 px-1 ring-1 ring-rubric/40" : ""}`}
                        >
                          {msg.content}
                        </div>

                        {!isUser && (
                          <div className="mt-1.5 flex items-baseline justify-end gap-4 border-t border-dotted border-rule/30 pt-1">
                            {msg.edited && <span className="mr-auto text-[11px] italic text-ink-faded">edited</span>}

                            {isEditing ? (
                              <>
                                <button onClick={handleCancelEdit} className={noteBtn}>
                                  cancel
                                </button>
                                <button onClick={() => handleCommitEdit(i)} className={`${noteBtn} !text-rubric`}>
                                  done
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => handleStartEdit(i, msg.content)} disabled={isSending} className={noteBtn} title="Edit response">
                                  edit
                                </button>
                                <button onClick={() => handleQuickSave(i, msg.content)} disabled={saveDisabled} className={noteBtn} title="Quick save to root">
                                  quick save
                                </button>
                                <button
                                  onClick={() => handleOpenSaveModal(i, msg.content)}
                                  disabled={saveDisabled}
                                  className={`${noteBtn} ${saveState === "saved" ? "!text-good !no-underline" : saveState === "error" ? "!text-bad" : ""}`}
                                  title="Save to folder…"
                                >
                                  {saveState === "saving" ? "saving…" : saveState === "saved" ? "✓ saved" : saveState === "error" ? "failed" : "save to…"}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isSending && (
                  <div className="flex justify-start">
                    <div className="border-l border-rule/40 pl-3 text-sm italic text-ink-faded">Thinking…</div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Input area */}
          <div className="mt-3 border-t border-rule/40 pt-3">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
              rows={4}
              placeholder="Ask your DM assistant... (Ctrl+Enter to send)"
              className={`${textareaCls} resize-none`}
            />

            <div className="mt-2 flex items-baseline">
              {messages.length > 0 && (
                <button onClick={() => setMessages([])} className={ghostBtn}>
                  clear chat
                </button>
              )}
              <button onClick={handleSendChat} disabled={!chatInput.trim() || isSending} className={`ml-auto ${sendBtn}`}>
                {isSending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      </ParchmentSheet>

      {saveModal && (
        <SaveToModal
          initialName={slugifyResponse(saveModal.content)}
          tree={campaignData}
          rootPath={getFilesTreeRoot()}
          onConfirm={handleSaveFromModal}
          onClose={() => setSaveModal(null)}
        />
      )}
    </>
  );
}

export default DMAssistant;