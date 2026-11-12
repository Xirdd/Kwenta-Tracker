import { escapeHtml } from "../format.js";
import { getAvatarUrl } from "../avatar.js";
import { state } from "../state.js";

const PERSON_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const HOME_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10h14V10"/></svg>`;
const SEARCH_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

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

const TAB_TITLES = {
  overview: "Overview",
  income: "Income",
  expenses: "Expenses",
  budgets: "Budgets",
  bills: "Bills",
  wallets: "Wallets",
};

// The large title is the current screen's name. On Overview it follows the
// sub-tab (Expenses, Budgets, …), since those are what people think of as
// separate screens.
function navTitle() {
  if (state.section === "goals") return "Goals";
  if (state.section === "loans") return "Utang";
  if (state.section === "settings") return "Settings";
  if (state.section === "profile") return "Profile";
  return TAB_TITLES[state.tab] || "Overview";
}

// Most screens start with their own heading that would repeat the large
// title ("Expenses" over "Expenses · 4 entries"); ios.css hides that one.
// Overview and Income don't: their first heading says something different.
function repeatsTitle() {
  if (state.section !== "overview") return true;
  return state.tab !== "overview" && state.tab !== "income";
}

export function renderHeader(user, household) {
  const title = navTitle();
  const isProfile = state.section === "profile";
  // On Profile the header is hidden (the page has its own back header), but it
  // stays in the DOM: main.js looks up #searchBtn and #accountBtn on every render.
  return `
  <header class="nav-bar ${isProfile ? "nav-hidden" : ""}" data-dup="${repeatsTitle() ? 1 : 0}">
    <div class="nav-compact" aria-hidden="true"><span>${escapeHtml(title)}</span></div>
    <div class="nav-large">
      <div class="nav-large-text">
        <h1 class="nav-title">${escapeHtml(title)}</h1>
        ${household ? `<button class="household-badge" id="householdBadge">${HOME_ICON}<span>${escapeHtml(household.name)}</span></button>` : ""}
      </div>
      <div class="header-actions">
        <button class="icon-btn" id="searchBtn" title="Search" aria-label="Search">${SEARCH_ICON}</button>
        ${profileButton(user)}
      </div>
    </div>
  </header>`;
}

function escapeInitial(email) {
  return escapeHtml((email || "?").trim().charAt(0).toUpperCase());
}
