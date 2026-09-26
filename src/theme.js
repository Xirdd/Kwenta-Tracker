// Also loads the mobile shell (hidden scrollbars + double-tap-zoom guard).
// It lives here only so main.js doesn't need touching — theme.js is already
// imported once at startup. Feel free to move this line into main.js.
import "./mobileShell.js";
//rename
const THEME_KEY = "kwenta_theme";

// id must match the [data-theme="..."] selector in style.css.
// mode groups the theme for display in Profile → Appearance (Light section
// vs Dark section) — it's purely a UI grouping label, separate from the
// actual color tokens each theme defines in style.css. Only "light" is
// genuinely a light theme; Midnight and Sepia are dark themes despite their
// warmer/cooler names, so they belong in the Dark group, not mixed in with
// Light.
export const THEMES = [
  {
    id: "light",
    label: "Light",
    bg: "#efe9d8",
    paper: "#f5f0e1",
    mode: "light",
  },
  { id: "dark", label: "Dark", bg: "#0e211b", paper: "#f5f0e1", mode: "dark" },
  {
    id: "midnight",
    label: "Midnight",
    bg: "#0d1420",
    paper: "#eef1f7",
    mode: "dark",
  },
  {
    id: "sepia",
    label: "Sepia",
    bg: "#ddc9a3",
    paper: "#faf3e0",
    mode: "dark",
  },
  {
    id: "slate",
    label: "Slate",
    bg: "#191c20",
    paper: "#f4f4f2",
    mode: "dark",
  },
];
const THEME_IDS = THEMES.map((t) => t.id);

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
//     Android status bar. A static tag (or a pair of tags switched by
//     `prefers-color-scheme`) follows the phone's system setting, NOT the
//     theme picked in Profile, so e.g. a light-mode phone running Kwenta's
//     dark theme gets a white strip across the top. Every existing tag is
//     removed and one fresh tag is added (Safari can ignore in-place edits).
//  2. The <html> background — the area behind the page that shows in the
//     safe-area/notch region and during rubber-band overscroll. Without a
//     solid color here it can flash the browser default (white).
//
// The color is read from the theme's own --bg token so this can never drift
// out of sync with style.css.
//  3. The strip behind the clock/battery (iPhone Home Screen app). Measured
//     from a screenshot, the old top scrim painted a neutral gray
//     (≈ #999) fading out over safe-area + 22px — not any color in the
//     theme, and light enough that iOS flipped the clock to black. It is
//     replaced here by a plain opaque fill in the theme's own --bg color
//     (no backdrop-filter, which is what lets iOS re-tint that edge), and
//     the old `.status-bar-scrim` is hidden so the two never stack.
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
  return document.documentElement.getAttribute("data-theme") || "dark";
}

// Call once on startup: uses the saved preference (any of the 5 themes),
// falling back to the system's light/dark preference for a first-time
// visitor, defaulting to dark if neither is available. The 3 extra dark
// themes are only ever reached by deliberately picking them in Profile —
// there's no "system preference" for Midnight/Sepia/Slate to fall back to.
export function initTheme() {
  const stored = getStoredTheme();
  if (stored && THEME_IDS.includes(stored)) {
    applyTheme(stored);
    return;
  }
  const prefersLight =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(prefersLight ? "light" : "dark");
}

export function setTheme(themeId) {
  if (!THEME_IDS.includes(themeId)) return;
  applyTheme(themeId);
}
