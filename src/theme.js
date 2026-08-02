const THEME_KEY = "kwenta_theme";

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

// Call once on startup: uses the saved preference, falling back to the
// system's light/dark preference, defaulting to dark if neither is available.
export function initTheme() {
  const stored = getStoredTheme();
  if (stored) {
    applyTheme(stored);
    return;
  }
  const prefersLight =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(prefersLight ? "light" : "dark");
}

export function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
