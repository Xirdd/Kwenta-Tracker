import { state } from "../state.js";

const OVERVIEW_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>`;
const GOALS_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`;
const LOANS_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15V9a3 3 0 0 1 3-3h1"/><path d="M17 9v6a3 3 0 0 1-3 3h-1"/><path d="M9 3 7 6l3 1"/><path d="M15 21l2-3-3-1"/></svg>`;
const PROFILE_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

const SECTIONS = [
  ["overview", "Overview", OVERVIEW_ICON],
  ["goals", "Goals", GOALS_ICON],
  ["loans", "Utang", LOANS_ICON],
  ["profile", "Profile", PROFILE_ICON],
];

export function renderBottomNav() {
  return `
  <nav class="bottom-nav">
    ${SECTIONS.map(
      ([id, label, icon]) => `
      <button class="bottom-nav-btn ${state.section === id ? "active" : ""}" data-section="${id}">
        ${icon}
        <span>${label}</span>
      </button>
    `,
    ).join("")}
  </nav>`;
}
