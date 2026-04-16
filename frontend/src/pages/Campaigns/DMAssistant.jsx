import React, { useEffect, useRef, useState } from "react";
import useCampaignStore from "../../store/CampaignStore";
import SaveToModal from "./SaveToModal";

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
      <div className="bg-slate-900/40 border border-slate-700 rounded-lg flex flex-col h-[640px]">
        {/* Message log */}
        <div ref={chatLogRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && !isSending ? (
            <div className="text-slate-500 italic text-sm">
              Ask the DM assistant anything about your campaign.
            </div>
          ) : (
            <>
              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                const isEditing = editingIndex === i;
                const saveState = savedMessages[i];
                const saveDisabled =
                  saveState === "saving" || saveState === "saved";

                return (
                  <div
                    key={i}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                        isUser
                          ? "bg-amber-600/90 text-slate-900 font-medium"
                          : "bg-slate-800 text-slate-200 border border-slate-700"
                      }`}
                    >
                      <div
                        contentEditable={isEditing}
                        suppressContentEditableWarning
                        ref={(el) => {
                          if (
                            isEditing &&
                            el &&
                            document.activeElement !== el
                          ) {
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
                        className={`outline-none ${
                          isEditing
                            ? "ring-1 ring-amber-500/40 rounded px-1 -mx-1"
                            : ""
                        }`}
                      >
                        {msg.content}
                      </div>

                      {!isUser && (
                        <div className="flex items-center justify-end gap-2 mt-2 pt-1 border-t border-slate-700/60">
                          {msg.edited && (
                            <span className="text-[10px] text-slate-500 italic mr-auto">
                              edited
                            </span>
                          )}

                          {isEditing ? (
                            <>
                              <button
                                onClick={handleCancelEdit}
                                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleCommitEdit(i)}
                                className="text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors"
                              >
                                Done
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStartEdit(i, msg.content)}
                                disabled={isSending}
                                className="text-xs text-slate-500 hover:text-amber-400 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
                                title="Edit response"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleQuickSave(i, msg.content)}
                                disabled={saveDisabled}
                                className="text-xs text-slate-500 hover:text-amber-400 disabled:text-slate-600 disabled:cursor-default transition-colors"
                                title="Quick save to root"
                              >
                                ⚡
                              </button>
                              <button
                                onClick={() =>
                                  handleOpenSaveModal(i, msg.content)
                                }
                                disabled={saveDisabled}
                                className="text-xs text-slate-500 hover:text-amber-400 disabled:text-slate-600 disabled:cursor-default transition-colors"
                                title="Save to folder…"
                              >
                                {saveState === "saving"
                                  ? "Saving…"
                                  : saveState === "saved"
                                    ? "✓ Saved"
                                    : saveState === "error"
                                      ? "Failed"
                                      : "Save"}
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
                  <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-slate-800 border border-slate-700 text-slate-500 italic">
                    Thinking…
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-slate-700 p-3">
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSendChat();
              }
            }}
            placeholder="Ask your DM assistant... (Ctrl+Enter to send)"
            className="w-full h-32 bg-slate-800 text-white rounded-md p-3 resize-none outline-none border border-slate-700 focus:border-amber-500/60 transition-colors text-sm"
          />

          <div className="flex items-center mt-2">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="px-4 h-8 rounded-md bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 font-semibold text-sm transition-colors"
              >
                Clear chat
              </button>
            )}
            <button
              onClick={handleSendChat}
              disabled={!chatInput.trim() || isSending}
              className="ml-auto px-4 h-8 rounded-md bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 font-semibold text-sm transition-colors"
            >
              {isSending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>

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