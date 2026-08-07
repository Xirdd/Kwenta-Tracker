import { currentTheme } from "../theme.js";
import { escapeHtml } from "../format.js";

const SUN_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;
const MOON_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>`;
const PERSON_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const HOME_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10h14V10"/></svg>`;

export function renderHeader(user, household) {
  const theme = currentTheme();
  const themeIcon = theme === "dark" ? SUN_ICON : MOON_ICON;
  const accountContent = user ? escapeInitial(user.email) : PERSON_ICON;
  return `
  <header>
    <div class="brand">
      <h1>Kwenta</h1>
      ${
        household
          ? `<button class="household-badge" id="householdBadge">${HOME_ICON}<span>${escapeHtml(household.name)}</span></button>`
          : `<p>sulit sa bawat piso</p>`
      }
    </div>
    <div class="header-actions">
      <button class="icon-btn ${user ? "icon-btn-account" : ""}" id="accountBtn" title="${user ? user.email : "Sign in"}">${accountContent}</button>
      <button class="icon-btn" id="themeToggle" title="Toggle light/dark mode">${themeIcon}</button>
      <button class="icon-btn" id="exportBtn" title="Export CSV">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/></svg>
      </button>
      <div class="peso-mark">₱</div>
    </div>
  </header>`;
}

function escapeInitial(email) {
  return (email || "?").trim().charAt(0).toUpperCase();
}
