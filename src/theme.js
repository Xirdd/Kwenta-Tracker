// Also loads the mobile shell (hidden scrollbars + double-tap-zoom guard) and
// the dark theme palettes. They live here only so main.js doesn't need
// touching — theme.js is already imported once at startup, and importing
// themes.css from here puts it AFTER style.css in the bundle, which is what
// lets its [data-theme] rules override :root.
import "./mobileShell.js";
import "./themes.css";
const THEME_KEY = "kwenta_theme";

// id must match the [data-theme="..."] selector in themes.css.
// bg / paper are only the two colors used to draw this theme's swatch in
// Profile → Appearance: the circle is a dark surface tone and the dot inside
// is a lighter tint of the same hue, so the five read as clearly different.
// mode groups the swatch row in Profile — every theme is "dark", so only the
// "Dark" group renders (profileTab.js skips a group with no themes).
export const THEMES = [
  {
    id: "forest",
    label: "Forest",
    bg: "#182b20",
    paper: "#3f7a60",
    mode: "dark",
  },
  {
    id: "deepsea",
    label: "Deep Sea",
    bg: "#142b39",
    paper: "#3f7f9c",
    mode: "dark",
  },
  { id: "plum", label: "Plum", bg: "#271730", paper: "#8a5aa8", mode: "dark" },
  { id: "wine", label: "Wine", bg: "#2e1720", paper: "#b0505f", mode: "dark" },
  {
    id: "amoled",
    label: "Amoled",
    bg: "#181818",
    paper: "#5a5a5a",
    mode: "dark",
  },
];
const THEME_IDS = THEMES.map((t) => t.id);

// Used for first-time visitors AND for anyone whose saved theme no longer
// exists (the old "light", "dark", "midnight", "sepia" and "slate" ids).
export const DEFAULT_THEME_ID = "forest";

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (e) {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    /* ignore */
  }
}

// Keeps everything OUTSIDE the page content in sync with the active theme:
//
//  1. <meta name="theme-color"> — this is what tints Safari's top bar and the
//     Android status bar. A static tag follows the phone's system setting,
//     NOT the theme picked in Profile. Every existing tag is removed and one
//     fresh tag is added (Safari can ignore in-place edits).
//  2. The <html> background — the area behind the page that shows in the
//     safe-area/notch region and during rubber-band overscroll. Without a
//     solid color here it can flash the browser default (white).
//
// The color is read from the theme's own --bg token so this can never drift
// out of sync with themes.css.
//  3. The strip behind the clock/battery (iPhone Home Screen app): a plain
//     opaque fill in the theme's own --bg color (no backdrop-filter, which is
//     what lets iOS re-tint that edge), and the old `.status-bar-scrim` is
//     hidden so the two never stack.
const TOP_FILL_ID = "statusBarFill";

function ensureStatusBarFill() {
  if (!document.body) return;

  if (!document.getElementById("statusBarFillStyle")) {
    const style = document.createElement("style");
    style.id = "statusBarFillStyle";
    style.textContent = `
      .status-bar-scrim { display: none !important; }
      #${TOP_FILL_ID} {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: calc(env(safe-area-inset-top, 0px) + 14px);
        background: linear-gradient(to bottom, var(--bg) 0%, var(--bg) 75%, transparent 100%);
        z-index: 45;
        pointer-events: none;
      }`;
    document.head.appendChild(style);
  }

  if (!document.getElementById(TOP_FILL_ID)) {
    const el = document.createElement("div");
    el.id = TOP_FILL_ID;
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
  }
}

function syncBrowserChrome() {
  ensureStatusBarFill();
  const root = document.documentElement;
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
  if (!bg) return;

  root.style.backgroundColor = bg;

  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.remove());
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = bg;
  document.head.appendChild(meta);
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  storeTheme(theme);
  syncBrowserChrome();
}

export function currentTheme() {
  return (
    document.documentElement.getAttribute("data-theme") || DEFAULT_THEME_ID
  );
}

// Call once on startup: uses the saved theme if it's still one of the five,
// otherwise the default. There's no system light/dark lookup anymore — the
// app is dark-only.
export function initTheme() {
  const stored = getStoredTheme();
  applyTheme(stored && THEME_IDS.includes(stored) ? stored : DEFAULT_THEME_ID);
}

export function setTheme(themeId) {
  if (!THEME_IDS.includes(themeId)) return;
  applyTheme(themeId);
}
