import React, { useMemo, useState } from "react";
import useAuthStore from "../store/AuthStore";
import deleteSkull from "../assets/deleteSkull.svg";
import { INK, InkHeading, ParchmentSheet, Title } from "../styles/parchment";
import { ghostBtn } from "../styles/parchmentForm";
import { THEMES, TOKENS, contrast, getAppearance, loadAppearance, saveAppearance, tokenHex } from "../styles/theme";

/* ═══════════════════════════════════════════════════════════════════
   Settings — one parchment sheet with four parts:

     Appearance     pick a theme (a small preview of each)
     Colours        recolour single slots of the chosen theme, with a
                    readability check against the page
     AI & API keys  empty for now — to be filled in later
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

        {/* ─── AI & API keys (to be built) ─── */}
        <section className="mb-10">
          <InkHeading right={<span className={`text-xs italic ${INK.faint}`}>coming soon</span>}>AI &amp; API Keys</InkHeading>
          <p className={`text-sm italic ${INK.faded}`}>API keys and the DM assistant's settings will be configured here.</p>
          {/* Add the API key fields and AI settings here. */}
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