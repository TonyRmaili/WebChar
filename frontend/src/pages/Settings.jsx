import React, { useEffect, useMemo, useState } from "react";
import useAuthStore from "../store/AuthStore";
import { tokens, untilMidnight, useAiStore } from "../store/AiStore";
import { useAssistantStore } from "../store/AssistantStore";
import { textareaCls } from "./Catalogues/catalogueStyle";
import deleteSkull from "../assets/deleteSkull.svg";
import { INK, InkHeading, ParchmentSheet, Title } from "../styles/parchment";
import { ghostBtn } from "../styles/parchmentForm";
import { THEMES, TOKENS, contrast, getAppearance, loadAppearance, saveAppearance, tokenHex } from "../styles/theme";

/* ═══════════════════════════════════════════════════════════════════
   Settings — one parchment sheet with four parts:

     Appearance     pick a theme (a small preview of each)
     Colours        recolour single slots of the chosen theme, with a
                    readability check against the page
     AI & API keys  the daily token limit and today's use, and the
                    assistant's instructions without a campaign (API keys later)
     Account        who's logged in; delete the account

   The look is saved in this browser (theme.js → saveAppearance) and
   applied when the app starts (Layout → loadAppearance).
   ═══════════════════════════════════════════════════════════════════ */

// How readable each writing colour must be on the page (WCAG contrast).
// Body text 4.5:1; "quiet marks" are decoration only, so 3:1.
const NEEDS = { ink: 4.5, "ink-faded": 4.5, "ink-faint": 3, rubric: 4.5, good: 4.5, bad: 4.5 };

function Settings() {

  const { deleteAccount, userData} = useAuthStore()

  const [appearance, setAppearance] = useState(getAppearance);
  // Bumped after every change so the colour list re-reads what's on now.
  const [tick, setTick] = useState(0);

  const update = (next) => {
    setAppearance(next);
    saveAppearance(next);
    loadAppearance(next);
    setTick((t) => t + 1);
  };

  const own = appearance.colours?.[appearance.theme] || {};

  const pickTheme = (id) => update({ ...appearance, theme: id });

  const setColour = (id, hex) =>
    update({ ...appearance, colours: { ...appearance.colours, [appearance.theme]: { ...own, [id]: hex } } });

  const resetColour = (id) => {
    const rest = { ...own };
    delete rest[id];
    update({ ...appearance, colours: { ...appearance.colours, [appearance.theme]: rest } });
  };

  const resetAll = () => update({ ...appearance, colours: { ...appearance.colours, [appearance.theme]: {} } });

  // The colours on screen right now (the theme's, or the user's own).
  const shown = useMemo(() => {
    const out = {};
    TOKENS.forEach((t) => (out[t.id] = tokenHex(t.id)));
    return out;
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDeleteAccount = async () => {
    if (!window.confirm("Delete your account permanently? This cannot be undone.")) return;

    await deleteAccount()
  };

  const themeLabel = THEMES.find((t) => t.id === appearance.theme)?.label || appearance.theme;

  return (
    <div className="mx-auto max-w-4xl py-8">
      <ParchmentSheet>
        <Title after={userData && <span className={`text-sm italic ${INK.faded}`}>Welcome, {userData.name}!</span>}>Settings</Title>

        {/* ─── Appearance ─── */}
        <section className="mb-10">
          <InkHeading>Appearance</InkHeading>
          <div className="grid gap-5 sm:grid-cols-2" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => {
              const on = appearance.theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pickTheme(t.id)}
                  className={`group rounded-xl p-1 text-left transition ${on ? "ring-2 ring-rubric" : "ring-1 ring-rule/30 hover:ring-rubric/50"}`}
                >
                  <ThemePreview id={t.id} />
                  <div className="mt-2 flex items-baseline gap-2 px-2 pb-1">
                    <span className={`text-[17px] ${on ? "font-semibold text-rubric" : "text-ink group-hover:text-rubric"}`}>{t.label}</span>
                    {on && <span className="text-xs italic text-rubric">in use</span>}
                  </div>
                  <p className={`px-2 pb-1 text-xs italic ${INK.faded}`}>{t.hint}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* ─── Colours ─── */}
        <section className="mb-10">
          <InkHeading
            right={
              Object.keys(own).length > 0 && (
                <button type="button" onClick={resetAll} className={ghostBtn}>
                  reset all to {themeLabel}
                </button>
              )
            }
          >
            Colours
          </InkHeading>
          <p className={`-mt-1 mb-4 text-sm italic ${INK.faded}`}>
            Change single colours of the {themeLabel} theme. Writing colours show how readable they are on the page.
          </p>

          <div className="divide-y divide-dotted divide-rule/30">
            {TOKENS.map((t) => {
              const hex = shown[t.id];
              const custom = own[t.id] != null;
              const need = NEEDS[t.id];
              const ratio = need ? contrast(hex, shown.page) : null;
              const ok = ratio != null && ratio >= need;
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                  <label htmlFor={`colour-${t.id}`} className="w-40 text-[15px] text-ink">
                    {t.label}
                  </label>
                  <input
                    id={`colour-${t.id}`}
                    type="color"
                    value={hex}
                    onChange={(e) => setColour(t.id, e.target.value)}
                    className="h-7 w-12 cursor-pointer rounded border border-rule/50 bg-transparent p-0.5"
                  />
                  <code className={`w-20 text-xs ${INK.faded}`}>{hex}</code>

                  {ratio != null && (
                    <span className={`text-xs italic ${ok ? "text-good" : "text-bad"}`} title={`Needs ${need}:1 on the page`}>
                      {ratio.toFixed(1)}:1 {ok ? "readable" : "hard to read"}
                    </span>
                  )}

                  {custom && (
                    <button type="button" onClick={() => resetColour(t.id)} className={`ml-auto ${ghostBtn}`}>
                      reset
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── AI & API keys ─── */}
        <section className="mb-10">
          <InkHeading>AI &amp; API Keys</InkHeading>
          <AiBudget />
          <AssistantInstructions />
          <p className={`mt-4 text-xs italic ${INK.faint}`}>API keys: the server's own OpenAI key is used for now; your own keys come later.</p>
        </section>

        {/* ─── Account ─── */}
        <section>
          <InkHeading>Account</InkHeading>
          {userData ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <span className="text-[15px] text-ink">
                Logged in as <span className="font-semibold">{userData.name}</span>
              </span>
              <button
                type="button"
                onClick={onDeleteAccount}
                title="Delete account"
                className="ml-auto inline-flex items-center gap-2 rounded-md border border-bad/50 px-4 py-1.5 text-sm text-bad transition hover:bg-bad hover:text-page-light"
              >
                <img src={deleteSkull} alt="" className="h-5 w-5" />
                <span>Delete account</span>
              </button>
            </div>
          ) : (
            <p className={`text-sm italic ${INK.faded}`}>Log in to manage your account.</p>
          )}
        </section>
      </ParchmentSheet>
    </div>
  );
}

/* The daily token limit, and what today has used. Tokens are what OpenAI
   counts and bills; the assistant stops (until midnight here) once the
   day's are used up. Empty = no limit. */
function AiBudget() {
  const usage = useAiStore((s) => s.usage);
  const refresh = useAiStore((s) => s.refresh);
  const setLimit = useAiStore((s) => s.setLimit);
  const [draft, setDraft] = useState(null); // what's typed, until saved
  const [note, setNote] = useState(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saved = usage?.daily_limit == null ? "" : String(usage.daily_limit);
  const value = draft ?? saved;
  const changed = draft !== null && draft.trim() !== saved;

  const save = async () => {
    const text = value.trim().replace(/[\s,.]/g, "");
    if (text && !/^\d+$/.test(text)) {
      setNote({ bad: true, text: "A whole number of tokens, or empty for no limit" });
      return;
    }
    const r = await setLimit(text ? Number(text) : null);
    setNote(r.ok ? { text: "Saved" } : { bad: true, text: r.message });
    if (r.ok) setDraft(null);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label htmlFor="ai-daily-limit" className="w-40 text-[15px] text-ink">
          Daily token limit
        </label>
        <input
          id="ai-daily-limit"
          inputMode="numeric"
          value={value}
          placeholder="no limit"
          onChange={(e) => {
            setDraft(e.target.value);
            setNote(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && changed && save()}
          className="w-36 border-0 border-b border-rule/60 bg-transparent px-0 py-0.5 font-body text-[15px] text-ink placeholder:italic placeholder:text-ink-faint focus:border-rubric focus:outline-none focus:ring-0"
        />
        {changed && (
          <button type="button" onClick={save} className={ghostBtn}>
            save
          </button>
        )}
        {note && <span className={`text-xs italic ${note.bad ? "text-bad" : "text-good"}`}>{note.text}</span>}
      </div>

      {usage && (
        <p className={`mt-3 text-sm ${INK.faded}`}>
          Today: <span className="text-ink">{tokens(usage.used)}</span> tokens
          {usage.daily_limit != null && (
            <>
              {" "}
              of {tokens(usage.daily_limit)},{" "}
              <span className={usage.left === 0 ? "text-bad" : "text-ink"}>{tokens(usage.left)} left</span>
            </>
          )}{" "}
          <span className="italic">
            (words {tokens(usage.words)} · pictures {tokens(usage.pictures)} · notes search {tokens(usage.search)})
          </span>
          <br />
          <span className="text-xs italic">A new day starts at midnight on this computer's clock, in {untilMidnight(usage.resets_in_minutes)}.</span>
        </p>
      )}
      <p className={`mt-2 text-xs italic ${INK.faint}`}>
        Tokens are what OpenAI counts and bills. Every question sends the ticked prompts and the notes found for it along, so those count too; a picture usually costs more than an answer. The notes search costs very little: changed notes are read again, and each question once.
      </p>
    </div>
  );
}

/* What the assistant is told when it's on no campaign (with a campaign,
   its ticked prompts are sent instead). Empty = the default, shown here so
   it can be changed. Saved on the server (routers/assistant.py). */
function AssistantInstructions() {
  const instructions = useAssistantStore((s) => s.instructions);
  const own = useAssistantStore((s) => s.ownInstructions);
  const { refreshSettings, setInstructions } = useAssistantStore.getState();
  const [draft, setDraft] = useState(null); // what's typed, until saved
  const [note, setNote] = useState(null);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const value = draft ?? instructions;
  const changed = draft !== null && draft.trim() !== instructions.trim();

  const save = async (text) => {
    const r = await setInstructions(text);
    setNote(r.ok ? { text: text ? "Saved" : "Back to the default" } : { bad: true, text: r.message });
    if (r.ok) setDraft(null);
  };

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <label htmlFor="assistant-instructions" className="text-[15px] text-ink">
          The assistant without a campaign
        </label>
        <span className={`text-xs italic ${INK.faded}`}>{own ? "your own instructions" : "the default instructions"}</span>
        <span className="ml-auto flex items-baseline gap-4">
          {note && <span className={`text-xs italic ${note.bad ? "text-bad" : "text-good"}`}>{note.text}</span>}
          {own && !changed && (
            <button type="button" onClick={() => save("")} className={ghostBtn} title="Forget your own instructions and use the default">
              back to the default
            </button>
          )}
          {changed && (
            <>
              <button type="button" onClick={() => setDraft(null)} className={ghostBtn}>
                cancel
              </button>
              <button type="button" onClick={() => save(value.trim())} className={`${ghostBtn} !text-rubric`}>
                save
              </button>
            </>
          )}
        </span>
      </div>
      <textarea
        id="assistant-instructions"
        value={value}
        onChange={(e) => {
          setDraft(e.target.value);
          setNote(null);
        }}
        rows={10}
        maxLength={20000}
        className={`${textareaCls} mt-2 resize-y font-mono text-[13px]`}
      />
      <p className={`mt-1 text-xs italic ${INK.faint}`}>
        Sent with every question when the assistant is on no campaign. With a campaign, its ticked prompts are sent instead.
      </p>
    </div>
  );
}

/* A small picture of a theme: its desk, a page, writing, a label and an
   emphasised word. data-theme on the box switches the colours inside it
   to that theme's, so both previews show at once. */
function ThemePreview({ id }) {
  return (
    <div data-theme={id} className="wc-desk rounded-lg p-2">
      <div className="wc-page px-4 py-3 font-body">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faded">Initiative</div>
        <div className="flex items-baseline justify-between">
          <span className="text-lg text-ink">Elara Moonwhisper</span>
          <span className="text-lg font-semibold text-rubric">+3</span>
        </div>
        <div className="mt-1 border-t border-dotted border-rule/50 pt-1 text-xs italic text-ink-faded">
          Hit points <span className="not-italic text-good">24</span> · damage <span className="not-italic text-bad">7</span>
        </div>
      </div>
    </div>
  );
}

export default Settings;