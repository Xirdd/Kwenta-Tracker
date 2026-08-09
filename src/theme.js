const THEME_KEY = "kwenta_theme";

// id must match the [data-theme="..."] selector in style.css.
export const THEMES = [
  { id: "dark", label: "Dark", bg: "#0e211b", paper: "#f5f0e1" },
  { id: "light", label: "Light", bg: "#efe9d8", paper: "#f5f0e1" },
  { id: "midnight", label: "Midnight", bg: "#0d1420", paper: "#eef1f7" },
  { id: "sepia", label: "Sepia", bg: "#ddc9a3", paper: "#faf3e0" },
  { id: "slate", label: "Slate", bg: "#191c20", paper: "#f4f4f2" },
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
// visitor, defaulting to dark if neither is available. The 3 extra themes
// are only ever reached by deliberately picking them in Profile — there's
// no "system preference" for Midnight/Sepia/Slate to fall back to.
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
