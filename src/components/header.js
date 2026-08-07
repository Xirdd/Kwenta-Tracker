import { escapeHtml } from "../format.js";

const PERSON_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const HOME_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10h14V10"/></svg>`;

export function renderHeader(user, household) {
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
      <button class="icon-btn ${user ? "icon-btn-account" : ""}" id="accountBtn" title="${user ? user.email : "Profile"}">${accountContent}</button>
      <div class="peso-mark">₱</div>
    </div>
  </header>`;
}

function escapeInitial(email) {
  return (email || "?").trim().charAt(0).toUpperCase();
}
