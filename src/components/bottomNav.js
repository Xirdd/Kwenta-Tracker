import { state } from "../state.js";

const OVERVIEW_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>`;
const GOALS_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`;
const LOANS_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15V9a3 3 0 0 1 3-3h1"/><path d="M17 9v6a3 3 0 0 1-3 3h-1"/><path d="M9 3 7 6l3 1"/><path d="M15 21l2-3-3-1"/></svg>`;
// A gear — this tab is app Settings now. "Profile" (you: photo, name, email)
// lives in the header, next to Search.
const SETTINGS_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;

const SECTIONS = [
  ["overview", "Overview", OVERVIEW_ICON],
  ["goals", "Goals", GOALS_ICON],
  ["loans", "Utang", LOANS_ICON],
  ["settings", "Settings", SETTINGS_ICON],
];

export function renderBottomNav() {
  return `
  <nav class="bottom-nav" aria-label="Main">
    ${SECTIONS.map(
      ([id, label, icon]) => `
      <button class="bottom-nav-btn ${state.section === id ? "active" : ""}" data-section="${id}" ${state.section === id ? 'aria-current="page"' : ""}>
        ${icon}
        <span>${label}</span>
      </button>
    `,
    ).join("")}
  </nav>`;
}
