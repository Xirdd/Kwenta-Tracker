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

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  storeTheme(theme);
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
