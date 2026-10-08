import { escapeHtml } from "../format.js";
import { getAvatarUrl } from "../avatar.js";

const PERSON_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const HOME_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10h14V10"/></svg>`;
const SEARCH_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

// The corner mark is the app's real icon file (public/icon-192.png — the same
// one the home-screen icon and the PDF statement use), not a typed "₱" on a
// gradient square. Replace that file and this updates with it.
const APP_ICON = `<img class="app-icon" src="/icon-192.png" alt="Kwenta" width="44" height="44" style="width:44px;height:44px;border-radius:16px;flex-shrink:0;display:block;box-shadow:var(--shadow-pop);"/>`;

// The Profile button, right next to Search: the person's photo if they've
// uploaded one, otherwise their initial. The initial is always rendered
// underneath, so if the photo fails to load (offline, deleted) and avatar.js
// removes the <img>, the initial is simply what's left.
function profileButton(user) {
  const url = user ? getAvatarUrl() : null;
  const initial = user ? escapeInitial(user.email) : "";
  if (!user) {
    return `<button class="icon-btn" id="accountBtn" title="Profile" aria-label="Profile">${PERSON_ICON}</button>`;
  }
  return `
    <button class="icon-btn icon-btn-account ${url ? "has-avatar" : ""}" id="accountBtn" title="Profile" aria-label="Profile">
      <span class="avatar-initial" aria-hidden="true">${initial}</span>
      ${url ? `<img class="header-avatar" data-avatar src="${escapeHtml(url)}" alt="" width="44" height="44" decoding="async"/>` : ""}
    </button>`;
}

export function renderHeader(user, household) {
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
      <button class="icon-btn" id="searchBtn" title="Search" aria-label="Search">${SEARCH_ICON}</button>
      ${profileButton(user)}
      ${APP_ICON}
    </div>
  </header>`;
}

function escapeInitial(email) {
  return escapeHtml((email || "?").trim().charAt(0).toUpperCase());
}
