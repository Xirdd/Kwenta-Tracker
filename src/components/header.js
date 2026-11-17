import { escapeHtml } from "../format.js";
import { getAvatarUrl } from "../avatar.js";
import { state } from "../state.js";
import { TAB_LIST } from "./tabs.js";

const PERSON_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const HOME_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10h14V10"/></svg>`;
const SEARCH_ICON = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

// The big iOS-style title is simply the screen you are on.
const SECTION_TITLES = {
  goals: "Goals",
  loans: "Utang",
  settings: "Settings",
  profile: "Profile",
};

function screenTitle() {
  if (SECTION_TITLES[state.section]) return SECTION_TITLES[state.section];
  const tab = TAB_LIST.find(([id]) => id === state.tab);
  return tab ? tab[1] : "Overview";
}

function initialOf(email) {
  return escapeHtml((email || "?").trim().charAt(0).toUpperCase());
}

// The profile button: the person's photo if they have one, else their initial.
// The initial always sits underneath, so a photo that fails to load (avatar.js
// removes the <img>) just leaves the initial showing.
function profileButton(user) {
  if (!user) {
    return `<button class="icon-btn" id="accountBtn" title="Profile" aria-label="Profile">${PERSON_ICON}</button>`;
  }
  const url = getAvatarUrl();
  return `
    <button class="icon-btn icon-btn-account ${url ? "has-avatar" : ""}" id="accountBtn" title="Profile" aria-label="Profile">
      <span class="avatar-initial" aria-hidden="true">${initialOf(user.email)}</span>
      ${url ? `<img class="header-avatar" data-avatar src="${escapeHtml(url)}" alt="" width="44" height="44" decoding="async"/>` : ""}
    </button>`;
}

export function renderHeader(user, household) {
  return `
  <header class="ios-header">
    <div class="ios-header-text">
      <h1 class="ios-title">${escapeHtml(screenTitle())}</h1>
      ${
        household
          ? `<button class="household-badge" id="householdBadge">${HOME_ICON}<span>${escapeHtml(household.name)}</span></button>`
          : `<p class="ios-tagline">sulit sa bawat piso</p>`
      }
    </div>
    <div class="ios-header-actions">
      <button class="icon-btn" id="searchBtn" title="Search" aria-label="Search">${SEARCH_ICON}</button>
      ${profileButton(user)}
    </div>
  </header>`;
}
