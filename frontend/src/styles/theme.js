/* ═══════════════════════════════════════════════════════════════════
   theme.js — switching the look. The colours themselves live in
   themes.css; this only says which theme is on, and lets one slot be
   changed (for a future Settings page: "Theme", "Accent colour", …).

     applyTheme("classic")            the whole look at once
     setToken("rubric", "#1e3a8a")    one slot, on top of the theme
     clearTokens()                    back to the theme's own colours

   The user's choice ("appearance") is saved in this browser:

     loadAppearance()                 read it and apply it — Layout calls
                                      this once, before the first paint
     getAppearance() / saveAppearance(a)
                                      { theme, colours: { parchment: {ink: "#…"}, classic: {…} } }
                                      Custom colours are kept per theme, so
                                      recolouring one doesn't touch the other.

   Settings (src/pages/Settings.jsx) is the page that changes it.
   ═══════════════════════════════════════════════════════════════════ */

export const THEMES = [
  { id: "parchment", label: "Parchment", hint: "Ink on parchment, laid on leather" },
  { id: "classic", label: "Classic", hint: "The original dark look: slate and amber" },
];

export const DEFAULT_THEME = "parchment";

// The slots a user may recolour (names as in themes.css, without --c-).
export const TOKENS = [
  { id: "ink", label: "Writing" },
  { id: "ink-faded", label: "Labels" },
  { id: "ink-faint", label: "Quiet marks" },
  { id: "rubric", label: "Emphasis" },
  { id: "page", label: "Page" },
  { id: "desk", label: "Desk" },
  { id: "good", label: "Healing / success" },
  { id: "bad", label: "Damage / failure" },
];

const root = () => document.documentElement;

export function applyTheme(id) {
  const known = THEMES.some((t) => t.id === id);
  root().dataset.theme = known ? id : DEFAULT_THEME;
}

export const currentTheme = () => root().dataset.theme || DEFAULT_THEME;

// "#9a3412" → "154 52 18" (the form themes.css uses)
function channels(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  return m.slice(1).map((h) => parseInt(h, 16)).join(" ");
}

export function setToken(id, hex) {
  const value = channels(hex);
  if (!value || !TOKENS.some((t) => t.id === id)) return false;
  root().style.setProperty(`--c-${id}`, value);
  return true;
}

export function clearTokens() {
  TOKENS.forEach((t) => root().style.removeProperty(`--c-${t.id}`));
}

/* ─── Reading the colours that are on now ────────────────────────── */

const hex2 = (n) => Number(n).toString(16).padStart(2, "0");

// The slot's current colour as "#rrggbb" (theme colour, or the user's).
export function tokenHex(id) {
  const raw = getComputedStyle(root()).getPropertyValue(`--c-${id}`).trim();
  const parts = raw.split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return "#000000";
  return `#${parts.map(hex2).join("")}`;
}

// How readable one colour is on another (WCAG contrast ratio, 1–21).
// Body text wants ≥ 4.5, faint decoration ≥ 3.
export function contrast(hexA, hexB) {
  const lum = (hex) => {
    const c = channels(hex);
    if (!c) return 0;
    const [r, g, b] = c.split(" ").map((v) => {
      const x = Number(v) / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(hexA), lum(hexB)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/* ─── Saving the user's choice (this browser) ────────────────────── */

const STORE_KEY = "wc.appearance";

export function getAppearance() {
  try {
    const a = JSON.parse(localStorage.getItem(STORE_KEY));
    if (a && typeof a === "object") return { theme: a.theme || DEFAULT_THEME, colours: a.colours || {} };
  } catch {
    /* nothing saved, or storage blocked */
  }
  return { theme: DEFAULT_THEME, colours: {} };
}

export function saveAppearance(a) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(a));
  } catch {
    /* storage blocked — the choice still applies until reload */
  }
}

// Apply a saved (or given) appearance: the theme, then its own colours.
export function loadAppearance(a = getAppearance()) {
  applyTheme(a.theme);
  clearTokens();
  const own = a.colours?.[currentTheme()] || {};
  Object.entries(own).forEach(([id, hex]) => setToken(id, hex));
}